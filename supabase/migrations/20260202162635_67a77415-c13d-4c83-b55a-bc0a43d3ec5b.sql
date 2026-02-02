-- Create storage bucket for lesson images
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-images', 'lesson-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload lesson images
CREATE POLICY "Allow authenticated users to upload lesson images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lesson-images');

-- Allow authenticated users to update their uploads
CREATE POLICY "Allow authenticated users to update lesson images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'lesson-images');

-- Allow authenticated users to delete lesson images
CREATE POLICY "Allow authenticated users to delete lesson images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'lesson-images');

-- Allow public read access to lesson images
CREATE POLICY "Allow public read access to lesson images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'lesson-images');