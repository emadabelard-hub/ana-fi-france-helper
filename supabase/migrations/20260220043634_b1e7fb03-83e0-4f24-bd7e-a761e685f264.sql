
-- Make company-assets bucket private (now that all code uses signed URLs)
UPDATE storage.buckets SET public = false WHERE id = 'company-assets';
