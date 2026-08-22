CREATE OR REPLACE FUNCTION public.save_chantier_report(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_id uuid := auth.uid();
  _chantier_id uuid;
  _owner_id uuid;
  _report_number text;
  _report_id uuid;
BEGIN
  IF _caller_id IS NULL OR COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  BEGIN
    _chantier_id := NULLIF(_payload ->> 'chantier_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'CHANTIER_ID_INVALID';
  END;

  _report_number := NULLIF(BTRIM(_payload ->> 'report_number'), '');

  IF _chantier_id IS NULL THEN
    RAISE EXCEPTION 'CHANTIER_ID_MISSING';
  END IF;
  IF _report_number IS NULL THEN
    RAISE EXCEPTION 'REPORT_NUMBER_MISSING';
  END IF;

  SELECT c.user_id
  INTO _owner_id
  FROM public.chantiers c
  WHERE c.id = _chantier_id;

  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'CHANTIER_NOT_FOUND';
  END IF;

  IF _caller_id <> _owner_id
     AND NOT public.is_chantier_team_member(_caller_id, _chantier_id) THEN
    RAISE EXCEPTION 'CHANTIER_ACCESS_DENIED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_chantier_id::text || ':' || _report_number, 0));

  SELECT cr.id
  INTO _report_id
  FROM public.chantier_reports cr
  WHERE cr.chantier_id = _chantier_id
    AND cr.report_number = _report_number
  ORDER BY cr.created_at ASC
  LIMIT 1;

  IF _report_id IS NULL THEN
    INSERT INTO public.chantier_reports (
      user_id, chantier_id, client_id, report_number, report_date,
      worker_count, worker_names, hours_worked, weather, work_done_fr,
      materials_fr, observations_fr, supervisor_name, pdf_url,
      submitted_by, submitted_by_name, created_at_timestamp,
      gps_latitude, gps_longitude, gps_address, status
    ) VALUES (
      _owner_id,
      _chantier_id,
      NULLIF(_payload ->> 'client_id', '')::uuid,
      _report_number,
      NULLIF(_payload ->> 'report_date', '')::date,
      NULLIF(_payload ->> 'worker_count', '')::integer,
      NULLIF(_payload ->> 'worker_names', ''),
      NULLIF(_payload ->> 'hours_worked', ''),
      NULLIF(_payload ->> 'weather', ''),
      NULLIF(_payload ->> 'work_done_fr', ''),
      NULLIF(_payload ->> 'materials_fr', ''),
      NULLIF(_payload ->> 'observations_fr', ''),
      NULLIF(_payload ->> 'supervisor_name', ''),
      NULLIF(_payload ->> 'pdf_url', ''),
      _caller_id,
      NULLIF(_payload ->> 'submitted_by_name', ''),
      COALESCE(NULLIF(_payload ->> 'created_at_timestamp', '')::timestamptz, now()),
      NULLIF(_payload ->> 'gps_latitude', '')::double precision,
      NULLIF(_payload ->> 'gps_longitude', '')::double precision,
      NULLIF(_payload ->> 'gps_address', ''),
      'a_valider'
    )
    RETURNING id INTO _report_id;
  ELSE
    UPDATE public.chantier_reports
    SET
      user_id = _owner_id,
      client_id = NULLIF(_payload ->> 'client_id', '')::uuid,
      report_date = NULLIF(_payload ->> 'report_date', '')::date,
      worker_count = NULLIF(_payload ->> 'worker_count', '')::integer,
      worker_names = NULLIF(_payload ->> 'worker_names', ''),
      hours_worked = NULLIF(_payload ->> 'hours_worked', ''),
      weather = NULLIF(_payload ->> 'weather', ''),
      work_done_fr = NULLIF(_payload ->> 'work_done_fr', ''),
      materials_fr = NULLIF(_payload ->> 'materials_fr', ''),
      observations_fr = NULLIF(_payload ->> 'observations_fr', ''),
      supervisor_name = NULLIF(_payload ->> 'supervisor_name', ''),
      pdf_url = COALESCE(NULLIF(_payload ->> 'pdf_url', ''), pdf_url),
      submitted_by = _caller_id,
      submitted_by_name = NULLIF(_payload ->> 'submitted_by_name', ''),
      created_at_timestamp = COALESCE(NULLIF(_payload ->> 'created_at_timestamp', '')::timestamptz, created_at_timestamp),
      gps_latitude = NULLIF(_payload ->> 'gps_latitude', '')::double precision,
      gps_longitude = NULLIF(_payload ->> 'gps_longitude', '')::double precision,
      gps_address = NULLIF(_payload ->> 'gps_address', '')
    WHERE id = _report_id;
  END IF;

  RETURN _report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_chantier_report(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_chantier_report(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_chantier_report(jsonb) TO service_role;