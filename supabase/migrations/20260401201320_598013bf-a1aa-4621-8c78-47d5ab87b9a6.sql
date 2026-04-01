
-- Add unique constraint on document_number per user to prevent duplicates at DB level
-- This ensures no two documents for the same user can share the same number
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_comptables_unique_number 
ON public.documents_comptables (user_id, document_number) 
WHERE document_number NOT LIKE 'BROUILLON-%';
