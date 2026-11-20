CREATE TABLE public.btp_analysis_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.btp_analysis_jobs(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL,
  step text NOT NULL,
  attempt_number integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  detected_at timestamptz,
  duration_ms double precision,
  status text NOT NULL DEFAULT 'running',
  error_type text,
  error_message text,
  UNIQUE(job_id, worker_id), UNIQUE(job_id, step, attempt_number)
);
GRANT SELECT ON public.btp_analysis_attempts TO authenticated;
GRANT ALL ON public.btp_analysis_attempts TO service_role;
ALTER TABLE public.btp_analysis_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY analysis_attempts_owner_read ON public.btp_analysis_attempts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.btp_analysis_jobs j WHERE j.id = job_id AND j.user_id = auth.uid()));

CREATE TABLE public.btp_analysis_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.btp_analysis_jobs(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL,
  step text NOT NULL,
  attempt_number integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  detected_at timestamptz,
  duration_ms double precision,
  model text NOT NULL,
  input_chars bigint NOT NULL,
  request_bytes bigint NOT NULL,
  estimated_tokens bigint NOT NULL,
  input_tokens bigint,
  output_tokens bigint,
  provider_request_id text,
  http_status integer,
  saved_at timestamptz,
  status text NOT NULL DEFAULT 'call_started',
  error_type text,
  error_message text,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE(job_id, step, attempt_number),
  FOREIGN KEY(job_id, worker_id) REFERENCES public.btp_analysis_attempts(job_id, worker_id)
);
GRANT SELECT ON public.btp_analysis_calls TO authenticated;
GRANT ALL ON public.btp_analysis_calls TO service_role;
ALTER TABLE public.btp_analysis_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY analysis_calls_owner_read ON public.btp_analysis_calls FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.btp_analysis_jobs j WHERE j.id = job_id AND j.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.analysis_step_limit(_kind text, _step text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _kind = 'project_docs_facts' AND _step LIKE 'doc:%' THEN 2 ELSE 3 END;
$$;

CREATE OR REPLACE FUNCTION public.analysis_next_step(_payload jsonb, _results jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE i integer; n integer;
BEGIN
  IF _payload->>'kind' = 'project_docs_facts' THEN
    n := jsonb_array_length(COALESCE(_payload->'documents', '[]'::jsonb));
    IF n > 0 THEN FOR i IN 0..n-1 LOOP
      IF NOT (_results ? ('doc:' || i)) THEN RETURN 'doc:' || i; END IF;
    END LOOP; END IF;
    IF NOT (_results ? 'dossier') THEN RETURN 'dossier'; END IF;
    IF NOT (_results ? 'global_analysis') THEN RETURN 'global_analysis'; END IF;
  ELSIF _payload->>'kind' = 'docx_quote_batch' THEN
    IF NOT (_results ? 'prepare') THEN RETURN 'prepare'; END IF;
    n := COALESCE((_payload->'plan'->>'batchCount')::integer,
      ceil(jsonb_array_length(COALESCE(_payload->'sourceRows', '[]'::jsonb)) / 50.0)::integer);
    IF n > 0 THEN FOR i IN 0..n-1 LOOP
      IF NOT (_results ? ('extract:' || i)) THEN RETURN 'extract:' || i; END IF;
    END LOOP; END IF;
    IF NOT (_results ? 'merge') THEN RETURN 'merge'; END IF;
  ELSE
    IF NOT (_results ? 'prepare') THEN RETURN 'prepare'; END IF;
    IF NOT (_results ? 'ai_test') THEN RETURN 'ai_test'; END IF;
  END IF;
  IF NOT (_results ? 'final') THEN RETURN 'finalize'; END IF;
  RETURN 'completed';
END; $$;

CREATE OR REPLACE FUNCTION public.analysis_close_failed_document(
  _job_id uuid, _step text, _attempts integer, _reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.btp_analysis_jobs; i integer; d jsonb; r jsonb; safe_reason text;
BEGIN
  SELECT * INTO j FROM public.btp_analysis_jobs WHERE id = _job_id
    AND status IN ('queued', 'running') FOR UPDATE;
  IF NOT FOUND OR j.payload->>'kind' IS DISTINCT FROM 'project_docs_facts'
    OR _step !~ '^doc:[0-9]+$' OR COALESCE(j.step_results, '{}'::jsonb) ? _step THEN RETURN false; END IF;
  i := substring(_step from 5)::integer;
  d := j.payload->'documents'->i;
  IF d IS NULL THEN RETURN false; END IF;
  safe_reason := CASE WHEN _reason IN ('worker_interrupted', 'save_failed', 'lease_lost',
    'response_empty', 'output_truncated', 'invalid_contract', 'step_failed') THEN _reason ELSE 'attempt_limit' END;
  r := jsonb_build_object('docId', d->>'docId', 'fileName', d->>'fileName',
    'status', 'failed', 'attempts', greatest(_attempts,
      (SELECT count(*)::integer FROM public.btp_analysis_calls WHERE job_id = j.id AND step = _step)), 'contract', NULL,
    'coverage', d->'coverage', 'failure_code', 'attempt_limit', 'failure_reason', safe_reason,
    'error', 'ANALYSIS_ATTEMPT_LIMIT: Document non exploité après épuisement des tentatives.');
  UPDATE public.btp_analysis_attempts SET status = 'failed', detected_at = now(),
    error_type = 'attempt_limit', error_message = 'Limite documentaire atteinte.'
    WHERE job_id = j.id AND step = _step AND status = 'running';
  UPDATE public.btp_analysis_calls SET status = 'response_rejected', detected_at = now(),
    error_type = 'attempt_limit', error_message = 'Limite documentaire atteinte.',
    events = events || jsonb_build_array(jsonb_build_object('status', 'response_rejected', 'at', now()))
    WHERE job_id = j.id AND step = _step AND status IN ('call_started', 'response_received');
  UPDATE public.btp_analysis_jobs SET status = 'queued',
    step_results = COALESCE(step_results, '{}'::jsonb) || jsonb_build_object(_step, r),
    current_step = public.analysis_next_step(j.payload, COALESCE(j.step_results, '{}'::jsonb) || jsonb_build_object(_step, r)),
    progress = round(85.0 * (i + 1) / jsonb_array_length(j.payload->'documents')),
    attempts = COALESCE(attempts, 0) + 1, error_message = NULL, updated_at = now(),
    payload = COALESCE(payload, '{}'::jsonb) - 'lease_owner' - 'lease_started_at' - 'next_retry_at'
    WHERE id = j.id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.claim_analysis_job(_job_id uuid, _owner uuid)
RETURNS public.btp_analysis_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END; $$;

CREATE OR REPLACE FUNCTION public.begin_analysis_call(
  _job_id uuid, _owner uuid, _step text, _model text, _chars bigint, _bytes bigint, _tokens bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.btp_analysis_jobs; n integer; c uuid;
BEGIN
  SELECT * INTO j FROM public.btp_analysis_jobs WHERE id = _job_id AND status = 'running'
    AND payload->>'lease_owner' = _owner::text FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.btp_analysis_attempts WHERE job_id = _job_id AND worker_id = _owner AND step = _step AND status = 'running') THEN RETURN NULL; END IF;
  SELECT count(*) INTO n FROM public.btp_analysis_calls WHERE job_id = _job_id AND step = _step;
  IF n >= public.analysis_step_limit(j.payload->>'kind', _step) THEN RETURN NULL; END IF;
  UPDATE public.btp_analysis_calls SET status = 'response_rejected', error_type = 'invalid_contract',
    error_message = 'Réponse non validée avant la tentative suivante.',
    events = events || jsonb_build_array(jsonb_build_object('status', 'response_rejected', 'at', now()))
    WHERE job_id = _job_id AND worker_id = _owner AND step = _step AND status = 'response_received';
  INSERT INTO public.btp_analysis_calls(job_id, worker_id, step, attempt_number, model, input_chars, request_bytes, estimated_tokens, events)
    VALUES(_job_id, _owner, _step, n + 1, _model, _chars, _bytes, _tokens,
      jsonb_build_array(jsonb_build_object('status', 'call_started', 'at', now()))) RETURNING id INTO c;
  RETURN c;
END; $$;

CREATE OR REPLACE FUNCTION public.record_analysis_call(
  _call_id uuid, _owner uuid, _status text, _duration_ms double precision,
  _input_tokens bigint DEFAULT NULL, _output_tokens bigint DEFAULT NULL, _provider_id text DEFAULT NULL, _http_status integer DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _status NOT IN ('response_received', 'timeout', 'network_error', 'provider_error', 'save_failed') THEN RETURN false; END IF;
  PERFORM 1 FROM public.btp_analysis_jobs j JOIN public.btp_analysis_calls c ON c.job_id = j.id
    WHERE c.id = _call_id AND c.worker_id = _owner AND j.status = 'running'
      AND j.payload->>'lease_owner' = _owner::text FOR UPDATE OF j;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.btp_analysis_calls SET status = _status, ended_at = now(), duration_ms = _duration_ms,
    input_tokens = COALESCE(_input_tokens, input_tokens), output_tokens = COALESCE(_output_tokens, output_tokens),
    provider_request_id = COALESCE(_provider_id, provider_request_id), http_status = COALESCE(_http_status, http_status),
    error_type = CASE WHEN _status = 'response_received' THEN NULL ELSE _status END,
    error_message = CASE _status WHEN 'timeout' THEN 'Délai du fournisseur dépassé.'
      WHEN 'network_error' THEN 'Connexion fournisseur interrompue.' WHEN 'provider_error' THEN 'Échec retourné par le fournisseur.'
      WHEN 'save_failed' THEN 'Réponse reçue mais sauvegarde non confirmée.' ELSE NULL END,
    events = events || jsonb_build_array(jsonb_build_object('status', _status, 'at', now()))
    WHERE id = _call_id AND worker_id = _owner AND status IN ('call_started', 'response_received');
  RETURN FOUND;
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
$$;

CREATE OR REPLACE FUNCTION public.fail_analysis_step(_job_id uuid, _owner uuid, _message text, _terminal boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.btp_analysis_jobs; a public.btp_analysis_attempts; exhausted boolean; st text; call_failure text; error_kind text; safe_message text;
BEGIN
  SELECT * INTO j FROM public.btp_analysis_jobs WHERE id = _job_id AND status = 'running'
    AND payload->>'lease_owner' = _owner::text FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO a FROM public.btp_analysis_attempts WHERE job_id = _job_id AND worker_id = _owner;
  IF a.id IS NULL THEN
    a.step := public.analysis_next_step(j.payload, COALESCE(j.step_results, '{}'::jsonb));
    a.attempt_number := COALESCE((j.payload->'recovery_by_step'->>a.step)::integer, 0) + 1;
  END IF;
  exhausted := a.attempt_number >= public.analysis_step_limit(j.payload->>'kind', a.step)
    OR _message LIKE 'ANALYSIS_ATTEMPT_LIMIT:%';
  st := CASE WHEN _terminal OR exhausted THEN 'failed' ELSE 'queued' END;
  error_kind := CASE WHEN _message LIKE 'ANALYSIS_ATTEMPT_LIMIT:%' THEN 'attempt_limit'
    WHEN _message LIKE 'ANALYSIS_SAVE_FAILED:%' THEN 'save_failed'
    WHEN _message LIKE 'lease_lost:%' OR _message LIKE 'Lease perdu%' THEN 'lease_lost'
    WHEN _message LIKE 'output_truncated:%' OR _message LIKE '%tronquée (longueur maximale)%' THEN 'output_truncated'
    WHEN _message LIKE 'response_empty:%' OR _message = 'Analyse globale vide.' THEN 'response_empty'
    WHEN _message LIKE 'invalid_contract:%' OR _message LIKE 'Bloc %' OR _message LIKE 'Aucune entrée exploitable%' THEN 'invalid_contract'
    ELSE 'step_failed' END;
  safe_message := CASE error_kind
    WHEN 'attempt_limit' THEN 'Limite de tentatives atteinte. Résultats conservés.'
    WHEN 'save_failed' THEN 'La sauvegarde de la réponse a échoué.'
    WHEN 'lease_lost' THEN 'Le traitement ne possède plus le verrou.'
    WHEN 'output_truncated' THEN 'Réponse limitée par le plafond de sortie du fournisseur.'
    WHEN 'response_empty' THEN 'Le fournisseur a retourné une réponse vide.'
    WHEN 'invalid_contract' THEN 'Le contrat factuel reçu ne peut pas être validé.'
    ELSE 'Échec du traitement de cette étape.' END;
  UPDATE public.btp_analysis_attempts SET status = 'failed', ended_at = now(),
    duration_ms = extract(epoch from (now() - started_at)) * 1000,
    error_type = error_kind, error_message = safe_message
    WHERE id = a.id;
  call_failure := CASE WHEN _message LIKE 'ANALYSIS_SAVE_FAILED:%' THEN 'save_failed' ELSE 'response_rejected' END;
  UPDATE public.btp_analysis_calls SET status = CASE WHEN status = 'response_received' THEN call_failure ELSE 'worker_failed' END,
    error_type = error_kind,
    error_message = safe_message, detected_at = now(),
    events = events || jsonb_build_array(jsonb_build_object('status', CASE WHEN status = 'response_received' THEN call_failure ELSE 'worker_failed' END, 'at', now()))
    WHERE job_id = _job_id AND worker_id = _owner AND status IN ('call_started', 'response_received');
  IF exhausted AND public.analysis_close_failed_document(j.id, a.step, a.attempt_number, error_kind) THEN
    RETURN 'queued';
  END IF;
  UPDATE public.btp_analysis_jobs SET status = st, attempts = COALESCE(attempts, 0) + 1,
    error_message = CASE WHEN exhausted THEN 'ANALYSIS_ATTEMPT_LIMIT: Limite de tentatives atteinte. Résultats conservés.'
      WHEN error_kind = 'save_failed' THEN 'ANALYSIS_SAVE_FAILED: La sauvegarde de la réponse a échoué.'
      ELSE error_kind || ': ' || safe_message END,
    updated_at = now(), payload = (COALESCE(payload, '{}'::jsonb) - 'lease_owner' - 'lease_started_at' - 'next_retry_at')
      || CASE WHEN a.id IS NULL THEN jsonb_build_object('recovery_by_step',
           COALESCE(payload->'recovery_by_step', '{}'::jsonb) || jsonb_build_object(a.step, a.attempt_number)) ELSE '{}'::jsonb END
      || CASE WHEN exhausted THEN jsonb_build_object('failure_code', 'attempt_limit', 'failed_step', a.step)
         WHEN st = 'queued' THEN jsonb_build_object('next_retry_at', now() + interval '30 seconds') ELSE '{}'::jsonb END
    WHERE id = _job_id;
  RETURN st;
END; $$;

CREATE OR REPLACE FUNCTION public.requeue_stale_analysis_jobs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.btp_analysis_jobs; a public.btp_analysis_attempts; s text; n integer; exhausted boolean; total integer := 0;
BEGIN
  FOR j IN SELECT * FROM public.btp_analysis_jobs WHERE status = 'running'
    AND updated_at < now() - interval '3 minutes' FOR UPDATE SKIP LOCKED LOOP
    s := public.analysis_next_step(j.payload, COALESCE(j.step_results, '{}'::jsonb));
    SELECT * INTO a FROM public.btp_analysis_attempts WHERE job_id = j.id AND worker_id::text = j.payload->>'lease_owner';
    n := COALESCE(a.attempt_number, (j.payload->'recovery_by_step'->>s)::integer, 0);
    IF a.id IS NULL THEN
      n := n + 1;
    END IF;
    exhausted := n >= public.analysis_step_limit(j.payload->>'kind', s);
    UPDATE public.btp_analysis_attempts SET status = 'worker_interrupted', detected_at = now(),
      error_type = 'worker_interrupted', error_message = 'Interruption détectée après absence de battement de cœur.' WHERE id = a.id AND status = 'running';
    UPDATE public.btp_analysis_calls SET status = 'worker_interrupted', detected_at = now(),
      error_type = 'worker_interrupted', error_message = 'Interruption détectée après absence de battement de cœur.',
      events = events || jsonb_build_array(jsonb_build_object('status', 'worker_interrupted', 'at', now()))
      WHERE job_id = j.id AND worker_id::text = j.payload->>'lease_owner' AND status IN ('call_started', 'response_received');
    IF exhausted AND public.analysis_close_failed_document(j.id, s, n, 'worker_interrupted') THEN
      total := total + 1;
      CONTINUE;
    END IF;
    UPDATE public.btp_analysis_jobs SET status = CASE WHEN exhausted THEN 'failed' ELSE 'queued' END,
      attempts = COALESCE(attempts, 0) + 1,
      error_message = CASE WHEN exhausted THEN 'ANALYSIS_ATTEMPT_LIMIT: Limite de tentatives atteinte pour ' || s || '. Résultats conservés.' ELSE 'Worker interrompu : reprise différée, résultats conservés.' END,
      updated_at = now(), payload = (COALESCE(payload, '{}'::jsonb) - 'lease_owner' - 'lease_started_at' - 'next_retry_at')
        || jsonb_build_object('recovery_by_step', COALESCE(payload->'recovery_by_step', '{}'::jsonb) || jsonb_build_object(s, n))
        || CASE WHEN exhausted THEN jsonb_build_object('failure_code', 'attempt_limit', 'failed_step', s)
           ELSE jsonb_build_object('next_retry_at', now() + interval '30 seconds') END
      WHERE id = j.id;
    total := total + 1;
  END LOOP;
  RETURN total;
END; $$;
REVOKE ALL ON FUNCTION public.analysis_step_limit(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analysis_step_limit(text, text) TO service_role;
REVOKE ALL ON FUNCTION public.analysis_next_step(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analysis_next_step(jsonb, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.claim_analysis_job(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_analysis_job(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.begin_analysis_call(uuid, uuid, text, text, bigint, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_analysis_call(uuid, uuid, text, text, bigint, bigint, bigint) TO service_role;
REVOKE ALL ON FUNCTION public.record_analysis_call(uuid, uuid, text, double precision, bigint, bigint, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_analysis_call(uuid, uuid, text, double precision, bigint, bigint, text, integer) TO service_role;
REVOKE ALL ON FUNCTION public.commit_analysis_step(uuid, uuid, text, jsonb, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_analysis_step(uuid, uuid, text, jsonb, integer, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.fail_analysis_step(uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_analysis_step(uuid, uuid, text, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.requeue_stale_analysis_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_stale_analysis_jobs() TO service_role;

REVOKE ALL ON FUNCTION public.analysis_close_failed_document(uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analysis_close_failed_document(uuid, text, integer, text) TO service_role;