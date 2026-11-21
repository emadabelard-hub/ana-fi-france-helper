-- PREPARED ONLY: restores the exact installed 4A bis definitions verified by MD5.
-- claim: e5304597c43704d69cc55db26e8b2873; commit: b38c3231a1139cd84db5fa8aae7de0dc.
-- CREATE OR REPLACE preserves existing function privileges and all 4A bis protections.
DROP TRIGGER IF EXISTS guard_project_analysis_completed ON public.btp_analysis_jobs;
DROP FUNCTION IF EXISTS public.guard_project_analysis_completed();

CREATE OR REPLACE FUNCTION public.claim_analysis_job(_job_id uuid, _owner uuid)
 RETURNS btp_analysis_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE j public.btp_analysis_jobs; s text; n integer; lim integer;
BEGIN
  SELECT * INTO j FROM public.btp_analysis_jobs WHERE id = _job_id AND status = 'queued' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NULLIF(j.payload->>'next_retry_at', '')::timestamptz > now() THEN RETURN NULL; END IF;
  s := public.analysis_next_step(j.payload, COALESCE(j.step_results, '{}'::jsonb));
  IF s = 'completed' THEN
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
END; $function$;

CREATE OR REPLACE FUNCTION public.commit_analysis_step(_job_id uuid, _owner uuid, _step text, _result jsonb, _progress integer, _current_step text, _status text, _final_report text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE document_failed boolean; failure_kind text;
BEGIN
  UPDATE public.btp_analysis_jobs
     SET step_results = COALESCE(step_results, '{}'::jsonb) || jsonb_build_object(_step, _result),
         progress = _progress,
         current_step = _current_step,
         status = _status,
         final_report = COALESCE(_final_report, final_report),
         error_message = NULL,
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
$function$;
