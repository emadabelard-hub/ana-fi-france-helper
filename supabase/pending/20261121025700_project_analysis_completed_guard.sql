-- PREPARED ONLY: do not register or apply without explicit authorization.
-- No data backfill; existing completed jobs are not changed.
CREATE OR REPLACE FUNCTION public.claim_analysis_job(_job_id uuid, _owner uuid)
RETURNS public.btp_analysis_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.btp_analysis_jobs; s text; n integer; lim integer;
BEGIN
  SELECT * INTO j FROM public.btp_analysis_jobs WHERE id = _job_id AND status = 'queued' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NULLIF(j.payload->>'next_retry_at', '')::timestamptz > now() THEN RETURN NULL; END IF;
  s := public.analysis_next_step(j.payload, COALESCE(j.step_results, '{}'::jsonb));
  IF s = 'completed' THEN
    IF j.payload->>'kind' = 'project_docs_facts' AND NOT (COALESCE((j.step_results #>> '{global_analysis,data,status}') = 'completed'
      AND jsonb_typeof(j.step_results #> '{global_analysis,data,text}') = 'string'
      AND length(btrim(j.step_results #>> '{global_analysis,data,text}', U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0, false)) THEN
      UPDATE public.btp_analysis_jobs SET status = 'completed_without_report',
        current_step = 'completed_without_report', progress = 97,
        updated_at = now(), error_message = CASE WHEN j.step_results #>> '{global_analysis,data,status}' = 'needs_chunking'
          THEN 'GLOBAL_ANALYSIS_TOO_LARGE' ELSE 'GLOBAL_ANALYSIS_FAILED' END,
        payload = COALESCE(payload, '{}'::jsonb) - 'lease_owner' - 'lease_started_at' - 'next_retry_at'
        WHERE id = j.id;
      RETURN NULL;
    END IF;
    UPDATE public.btp_analysis_jobs SET status = 'completed', current_step = 'completed', progress = 100,
      updated_at = now(), error_message = NULL,
      payload = COALESCE(payload, '{}'::jsonb) - 'lease_owner' - 'lease_started_at' - 'next_retry_at'
      WHERE id = j.id;
    RETURN NULL;
  END IF;
  lim := public.analysis_step_limit(j.payload->>'kind', s);
  SELECT COALESCE(max(attempt_number), 0) INTO n FROM public.btp_analysis_attempts WHERE job_id = j.id AND step = s;
  n := greatest(n, COALESCE((j.payload->'recovery_by_step'->>s)::integer, 0));
  IF n >= lim OR (j.payload->>'kind' = 'project_docs_facts' AND s LIKE 'doc:%'
    AND (SELECT count(*) FROM public.btp_analysis_calls WHERE job_id = j.id AND step = s) >= lim) THEN
    IF public.analysis_close_failed_document(j.id, s, n, 'attempt_limit') THEN RETURN NULL; END IF;
    UPDATE public.btp_analysis_jobs SET status = 'failed',
      error_message = 'ANALYSIS_ATTEMPT_LIMIT: Limite de tentatives atteinte pour ' || s || '. Résultats conservés.',
      payload = (COALESCE(payload, '{}'::jsonb) - 'lease_owner' - 'lease_started_at' - 'next_retry_at')
        || jsonb_build_object('failure_code', 'attempt_limit', 'failed_step', s), updated_at = now()
      WHERE id = j.id;
    RETURN NULL;
  END IF;
  INSERT INTO public.btp_analysis_attempts(job_id, worker_id, step, attempt_number)
    VALUES(j.id, _owner, s, n + 1);
  UPDATE public.btp_analysis_jobs SET status = 'running', current_step = s, updated_at = now(),
    payload = (COALESCE(payload, '{}'::jsonb) - 'next_retry_at')
      || jsonb_build_object('lease_owner', _owner::text, 'lease_started_at', now())
    WHERE id = j.id RETURNING * INTO j;
  RETURN j;
END; $$;

CREATE OR REPLACE FUNCTION public.commit_analysis_step(
  _job_id uuid,
  _owner uuid,
  _step text,
  _result jsonb,
  _progress integer,
  _current_step text,
  _status text,
  _final_report text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE document_failed boolean; failure_kind text;
  persisted_results jsonb; job_kind text; without_report boolean;
BEGIN
  SELECT payload->>'kind', COALESCE(step_results, '{}'::jsonb) || jsonb_build_object(_step, _result)
    INTO job_kind, persisted_results FROM public.btp_analysis_jobs
    WHERE id = _job_id AND status = 'running'
      AND payload->>'lease_owner' = _owner::text
      AND NOT (COALESCE(step_results, '{}'::jsonb) ? _step) FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  without_report := COALESCE(job_kind = 'project_docs_facts' AND _status = 'completed'
    AND NOT (COALESCE((persisted_results #>> '{global_analysis,data,status}') = 'completed'
      AND jsonb_typeof(persisted_results #> '{global_analysis,data,text}') = 'string'
      AND length(btrim(persisted_results #>> '{global_analysis,data,text}', U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0, false)), false);
  UPDATE public.btp_analysis_jobs
     SET step_results = COALESCE(step_results, '{}'::jsonb) || jsonb_build_object(_step, _result),
         progress = CASE WHEN without_report THEN 97 ELSE _progress END,
         current_step = CASE WHEN without_report THEN 'completed_without_report' ELSE _current_step END,
         status = CASE WHEN without_report THEN 'completed_without_report' ELSE _status END,
         final_report = COALESCE(_final_report, final_report),
         error_message = CASE WHEN without_report THEN CASE WHEN persisted_results #>> '{global_analysis,data,status}' = 'needs_chunking'
          THEN 'GLOBAL_ANALYSIS_TOO_LARGE' ELSE 'GLOBAL_ANALYSIS_FAILED' END ELSE NULL END,
         updated_at = now(),
         payload = (COALESCE(payload, '{}'::jsonb) - 'lease_owner') - 'lease_started_at'
   WHERE id = _job_id
     AND status = 'running'
     AND payload->>'lease_owner' = _owner::text
     AND NOT (COALESCE(step_results, '{}'::jsonb) ? _step);
  IF NOT FOUND THEN RETURN false; END IF;
  document_failed := _step LIKE 'doc:%' AND _result->>'status' = 'failed';
  failure_kind := CASE WHEN _result->>'failure_code' IN ('save_failed', 'attempt_limit', 'lease_lost',
    'response_empty', 'output_truncated', 'invalid_contract') THEN _result->>'failure_code' ELSE 'step_failed' END;
  IF document_failed THEN
    UPDATE public.btp_analysis_calls SET status = 'response_rejected', error_type = failure_kind,
      error_message = 'Extraction documentaire non validée.',
      events = events || jsonb_build_array(jsonb_build_object('status', 'response_rejected', 'at', now()))
      WHERE job_id = _job_id AND worker_id = _owner AND status = 'response_received';
  END IF;
  UPDATE public.btp_analysis_calls SET status = 'response_saved', saved_at = now(),
    events = events || jsonb_build_array(jsonb_build_object('status', 'response_saved', 'at', now()))
    WHERE job_id = _job_id AND worker_id = _owner AND status = 'response_received';
  UPDATE public.btp_analysis_attempts SET status = 'saved', ended_at = now(),
    duration_ms = extract(epoch from (now() - started_at)) * 1000,
    error_type = CASE WHEN document_failed THEN failure_kind ELSE NULL END,
    error_message = CASE WHEN document_failed THEN 'Résultat documentaire en échec enregistré.' ELSE NULL END
    WHERE job_id = _job_id AND worker_id = _owner AND status = 'running';
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_project_analysis_completed()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.payload->>'kind' = 'project_docs_facts' AND NEW.status = 'completed'
    AND OLD.status IS DISTINCT FROM 'completed' AND NOT (COALESCE((NEW.step_results #>> '{global_analysis,data,status}') = 'completed'
      AND jsonb_typeof(NEW.step_results #> '{global_analysis,data,text}') = 'string'
      AND length(btrim(NEW.step_results #>> '{global_analysis,data,text}', U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0, false)) THEN
    NEW.status := 'completed_without_report';
    NEW.current_step := 'completed_without_report';
    NEW.progress := 97;
    NEW.error_message := CASE WHEN NEW.step_results #>> '{global_analysis,data,status}' = 'needs_chunking'
          THEN 'GLOBAL_ANALYSIS_TOO_LARGE' ELSE 'GLOBAL_ANALYSIS_FAILED' END;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_project_analysis_completed() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_project_analysis_completed
BEFORE UPDATE ON public.btp_analysis_jobs
FOR EACH ROW EXECUTE FUNCTION public.guard_project_analysis_completed();
