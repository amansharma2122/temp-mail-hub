
-- Deterministic conflict resolution for app_settings.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_by UUID NULL;

-- Deep-merge two jsonb values. Right side wins on scalar/array collisions;
-- objects merge recursively so simultaneous edits to different fields
-- converge to the union of both patches.
CREATE OR REPLACE FUNCTION public.jsonb_deep_merge(a JSONB, b JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result JSONB;
  k TEXT;
  v JSONB;
BEGIN
  IF a IS NULL OR jsonb_typeof(a) <> 'object' THEN RETURN COALESCE(b, a); END IF;
  IF b IS NULL OR jsonb_typeof(b) <> 'object' THEN RETURN COALESCE(b, a); END IF;
  result := a;
  FOR k, v IN SELECT * FROM jsonb_each(b) LOOP
    IF jsonb_typeof(result -> k) = 'object' AND jsonb_typeof(v) = 'object' THEN
      result := jsonb_set(result, ARRAY[k], public.jsonb_deep_merge(result -> k, v));
    ELSE
      result := jsonb_set(result, ARRAY[k], v, true);
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- Atomic patch-upsert. Only admins may write.
--   p_base_version: caller's known version. When it matches, the caller's
--     patch is applied on top of the current value (deep-merge). When it
--     doesn't match, a concurrent edit happened — we still merge on top of
--     the *current* value (patch wins for touched keys, other admin's
--     untouched keys survive). All tabs converge to the same row because
--     the merge is commutative on non-overlapping keys and deterministic
--     (last-committed value wins) on overlapping ones.
--   Version is bumped on every write so subscribers can detect staleness.
CREATE OR REPLACE FUNCTION public.upsert_app_setting(
  p_key TEXT,
  p_patch JSONB,
  p_base_version INTEGER DEFAULT NULL
)
RETURNS TABLE(id UUID, key TEXT, value JSONB, version INTEGER, updated_at TIMESTAMPTZ, merged BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.app_settings%ROWTYPE;
  merged_value JSONB;
  did_merge BOOLEAN := FALSE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can update app_settings';
  END IF;

  SELECT * INTO current_row FROM public.app_settings WHERE app_settings.key = p_key FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.app_settings(key, value, version, updated_at, updated_by)
    VALUES (p_key, COALESCE(p_patch, '{}'::jsonb), 1, now(), auth.uid())
    RETURNING app_settings.id, app_settings.key, app_settings.value, app_settings.version, app_settings.updated_at, FALSE
    INTO id, key, value, version, updated_at, merged;
    RETURN NEXT;
    RETURN;
  END IF;

  merged_value := public.jsonb_deep_merge(current_row.value, COALESCE(p_patch, '{}'::jsonb));
  did_merge := (p_base_version IS NOT NULL AND p_base_version <> current_row.version);

  UPDATE public.app_settings
    SET value = merged_value,
        version = current_row.version + 1,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE app_settings.id = current_row.id
    RETURNING app_settings.id, app_settings.key, app_settings.value, app_settings.version, app_settings.updated_at, did_merge
    INTO id, key, value, version, updated_at, merged;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_app_setting(TEXT, JSONB, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_app_setting(TEXT, JSONB, INTEGER) TO authenticated;
