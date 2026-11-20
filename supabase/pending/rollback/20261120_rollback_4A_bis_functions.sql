-- RETOUR ARRIÈRE 4A BIS — NE PAS APPLIQUER SANS AUTORISATION EXPLICITE.
-- Rétablit uniquement les 5 RPC historiques lues en production le 2026-11-20 21:50 UTC
-- (définitions et droits : service_role seul). Conserve tables de traces, données et résultats.
CREATE OR REPLACE FUNCTION public.claim_analysis_job(_job_id uuid, _owner uuid)
 RETURNS btp_analysis_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE j public.btp_analysis_jobs;
BEGIN
  UPDATE public.btp_analysis_jobs
     SET status = 'running', updated_at = now(),
         payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object('lease_owner', _owner::text, 'lease_started_at', now())
   WHERE id = _job_id AND status = 'queued'
  RETURNING * INTO j;
  IF j.id IS NULL THEN RETURN NULL; END IF;
  RETURN j;
END;
$function$;

CREATE OR REPLACE FUNCTION public.heartbeat_analysis_job(_job_id uuid, _owner uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.btp_analysis_jobs SET updated_at = now()
   WHERE id = _job_id AND status = 'running' AND payload->>'lease_owner' = _owner::text;
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.commit_analysis_step(_job_id uuid, _owner uuid, _step text, _result jsonb, _progress integer, _current_step text, _status text, _final_report text DEFAULT NULL::text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.btp_analysis_jobs
     SET step_results = COALESCE(step_results, '{}'::jsonb) || jsonb_build_object(_step, _result),
         progress = _progress, current_step = _current_step, status = _status,
         final_report = COALESCE(_final_report, final_report), error_message = NULL, updated_at = now(),
         payload = (COALESCE(payload, '{}'::jsonb) - 'lease_owner') - 'lease_started_at'
   WHERE id = _job_id AND status = 'running' AND payload->>'lease_owner' = _owner::text
     AND NOT (COALESCE(step_results, '{}'::jsonb) ? _step);
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fail_analysis_step(_job_id uuid, _owner uuid, _message text, _terminal boolean DEFAULT false)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_attempts integer; new_status text;
BEGIN
  SELECT COALESCE(attempts, 0) + 1 INTO new_attempts FROM public.btp_analysis_jobs
   WHERE id = _job_id AND payload->>'lease_owner' = _owner::text;
  IF new_attempts IS NULL THEN RETURN NULL; END IF;
  new_status := CASE WHEN _terminal OR new_attempts >= 3 THEN 'failed' ELSE 'queued' END;
  UPDATE public.btp_analysis_jobs
     SET status = new_status, attempts = new_attempts,
         error_message = left(COALESCE(_message, 'Erreur inconnue'), 500), updated_at = now(),
         payload = (COALESCE(payload, '{}'::jsonb) - 'lease_owner') - 'lease_started_at'
   WHERE id = _job_id AND payload->>'lease_owner' = _owner::text;
  RETURN new_status;
END;
$function$;

CREATE OR REPLACE FUNCTION public.requeue_stale_analysis_jobs()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  UPDATE public.btp_analysis_jobs
     SET status = 'queued', attempts = COALESCE(attempts, 0) + 1, updated_at = now(),
         payload = (COALESCE(payload, '{}'::jsonb) - 'lease_owner') - 'lease_started_at'
   WHERE status = 'running' AND updated_at < now() - interval '3 minutes';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_analysis_job(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.heartbeat_analysis_job(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_analysis_step(uuid, uuid, text, jsonb, integer, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_analysis_step(uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.requeue_stale_analysis_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_analysis_job(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_analysis_job(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_analysis_step(uuid, uuid, text, jsonb, integer, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_analysis_step(uuid, uuid, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.requeue_stale_analysis_jobs() TO service_role;
