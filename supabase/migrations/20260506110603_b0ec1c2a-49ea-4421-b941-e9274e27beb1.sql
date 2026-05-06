-- Repair: backfill sourceDevisId on milestone invoices that are missing it.
-- Match by user_id + sourceDevisNumber → unique devis with the matching official number.
UPDATE documents_comptables f
SET document_data = f.document_data || jsonb_build_object('sourceDevisId', d.id::text)
FROM documents_comptables d
WHERE f.document_type = 'facture'
  AND d.document_type = 'devis'
  AND f.user_id = d.user_id
  AND f.document_data ? 'milestoneId'
  AND NOT (f.document_data ? 'sourceDevisId')
  AND f.document_data ? 'sourceDevisNumber'
  AND d.document_number = (f.document_data->>'sourceDevisNumber');