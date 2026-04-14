import { supabase } from '@/integrations/supabase/client';

export type OfficialDocumentType = 'devis' | 'facture';

const DOCUMENT_NUMBER_PATTERNS: Record<OfficialDocumentType, RegExp> = {
  devis: /^D-\d{4}-\d{3,}$/,
  facture: /^F-\d{4}-\d{3,}$/,
};

export const isOfficialDocumentNumber = (
  value?: string | null,
  documentType?: OfficialDocumentType,
): value is string => {
  const normalized = (value || '').trim();

  if (!normalized) return false;

  if (documentType) {
    return DOCUMENT_NUMBER_PATTERNS[documentType].test(normalized);
  }

  return Object.values(DOCUMENT_NUMBER_PATTERNS).some((pattern) => pattern.test(normalized));
};

export const reserveOfficialDocumentNumber = async (
  userId: string,
  documentType: OfficialDocumentType,
): Promise<string> => {
  const { data, error } = await supabase.rpc('get_next_document_number', {
    _user_id: userId,
    _document_type: documentType,
  });

  if (error || !isOfficialDocumentNumber(data, documentType)) {
    throw new Error(error?.message || 'Impossible de générer un numéro officiel');
  }

  return data;
};