-- Corriger l'index unique : le filtre regex '___' était incorrect
-- (il excluait presque tous les numéros). On le remplace par un filtre
-- correct qui exclut uniquement les placeholders contenant des underscores.
DROP INDEX IF EXISTS public.uniq_documents_user_type_number;

CREATE UNIQUE INDEX uniq_documents_user_type_number
  ON public.documents_comptables (user_id, document_type, document_number)
  WHERE document_number IS NOT NULL
    AND position('_' in document_number) = 0;