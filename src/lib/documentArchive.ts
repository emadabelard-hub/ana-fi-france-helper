import { supabase } from '@/integrations/supabase/client';

export type ArchiveDocType = 'devis' | 'facture' | 'note_frais';

const FOLDERS: Record<ArchiveDocType, string> = {
  devis: 'devis',
  facture: 'factures',
  note_frais: 'notes-frais',
};

interface ArchiveParams {
  blob: Blob;
  type: ArchiveDocType;
  numero?: string | null;
  fileName: string;
  amount?: number | null;
  status?: string | null;
}

/**
 * Upload a generated PDF to Supabase Storage and register it in the documents table.
 * Fails silently (logs to console) so it never blocks the main PDF download flow.
 */
export async function archivePdf({
  blob,
  type,
  numero,
  fileName,
  amount,
  status,
}: ArchiveParams): Promise<{ pdf_url: string; storage_path: string } | null> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user || user.is_anonymous) return null;

    const folder = FOLDERS[type];
    const safeName = fileName.replace(/[^\w.\-]+/g, '_');
    const storagePath = `${user.id}/${folder}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, blob, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.warn('[archivePdf] upload failed:', uploadError.message);
      return null;
    }

    const { data: signed } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    const pdfUrl = signed?.signedUrl ?? storagePath;
    const sizeKb = Math.max(1, Math.round(blob.size / 1024));

    const { error: insertError } = await supabase.from('documents').insert({
      user_id: user.id,
      type,
      numero: numero ?? null,
      nom_fichier: fileName,
      pdf_url: pdfUrl,
      storage_path: storagePath,
      taille_kb: sizeKb,
      amount: amount ?? null,
      status: status ?? null,
    });

    if (insertError) {
      console.warn('[archivePdf] insert failed:', insertError.message);
    }

    return { pdf_url: pdfUrl, storage_path: storagePath };
  } catch (err) {
    console.warn('[archivePdf] unexpected error:', err);
    return null;
  }
}

export async function getFreshSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 60 * 10);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
