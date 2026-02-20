import { supabase } from '@/integrations/supabase/client';

/**
 * Extract the storage path from a company-assets public URL.
 * Public URLs look like: https://<project>.supabase.co/storage/v1/object/public/company-assets/<user_id>/file.jpg
 * Signed URLs look like: https://<project>.supabase.co/storage/v1/object/sign/company-assets/<user_id>/file.jpg?token=...
 * We need just the path after "company-assets/".
 */
function extractStoragePath(url: string): string | null {
  if (!url) return null;
  const marker = 'company-assets/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  // Remove any query params
  const pathWithParams = url.substring(idx + marker.length);
  return pathWithParams.split('?')[0];
}

/**
 * Convert a company-assets URL (public or signed) to a fresh signed URL.
 * Returns the original URL if conversion fails, to avoid breaking the UI.
 * Signed URLs expire after `expiresIn` seconds (default: 300 = 5 min).
 */
export async function getSignedAssetUrl(
  url: string | null | undefined,
  expiresIn = 300
): Promise<string | null> {
  if (!url) return null;
  
  const path = extractStoragePath(url);
  if (!path) return url; // Not a company-assets URL, return as-is

  const { data, error } = await supabase.storage
    .from('company-assets')
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    console.warn('Failed to create signed URL, falling back to original:', error?.message);
    return url;
  }

  return data.signedUrl;
}

/**
 * Resolve multiple asset URLs in parallel.
 * Useful for invoice/document rendering where multiple assets are needed.
 */
export async function resolveAssetUrls(urls: {
  logoUrl?: string | null;
  artisanSignatureUrl?: string | null;
  stampUrl?: string | null;
  headerImageUrl?: string | null;
}): Promise<{
  logoUrl: string | null;
  artisanSignatureUrl: string | null;
  stampUrl: string | null;
  headerImageUrl: string | null;
}> {
  const [logoUrl, artisanSignatureUrl, stampUrl, headerImageUrl] = await Promise.all([
    getSignedAssetUrl(urls.logoUrl),
    getSignedAssetUrl(urls.artisanSignatureUrl),
    getSignedAssetUrl(urls.stampUrl),
    getSignedAssetUrl(urls.headerImageUrl),
  ]);

  return { logoUrl, artisanSignatureUrl, stampUrl, headerImageUrl };
}
