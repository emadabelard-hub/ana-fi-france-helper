-- POINT 1 : Bucket lesson-images privé
UPDATE storage.buckets 
SET public = false 
WHERE id = 'lesson-images';

CREATE POLICY "lesson_images_read_by_url"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'lesson-images');

-- POINT 2 : Table user_api_keys
CREATE TABLE public.user_api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_name text NOT NULL DEFAULT 'openai',
  encrypted_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, key_name)
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_only_select" ON public.user_api_keys
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "owner_only_insert" ON public.user_api_keys
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_only_update" ON public.user_api_keys
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_only_delete" ON public.user_api_keys
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "no_anonymous_sessions" ON public.user_api_keys
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
  WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

CREATE TRIGGER update_user_api_keys_updated_at
  BEFORE UPDATE ON public.user_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();