import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { compressImageFile } from '@/lib/imageCompression';

export type ProfileRecord = Tables<'profiles'>;

type ProfileInsert = TablesInsert<'profiles'>;
type ProfileUpdate = TablesUpdate<'profiles'>;
type CompanyAssetKind = 'logo' | 'header' | 'stamp' | 'artisan-signature';

const ABORT_RETRY_DELAY_MS = 700;
const DEFAULT_LEGAL_FOOTER = "Dispensé d'immatriculation au registre du commerce et des sociétés (RCS) et au répertoire des métiers (RM). TVA non applicable, art. 293 B du CGI.";
const DEFAULT_ASSURANCE_COVERAGE = 'France métropolitaine';

const wait = (ms: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, ms));

const readErrorField = (error: unknown, key: string) => {
  if (!error || typeof error !== 'object' || !(key in error)) return null;

  const value = (error as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

export const getSupabaseErrorDetails = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim();
  }

  const details = [
    readErrorField(error, 'message'),
    readErrorField(error, 'details'),
    readErrorField(error, 'hint'),
    readErrorField(error, 'error_description'),
  ].filter((value): value is string => Boolean(value));

  return details.join(' — ') || 'Erreur inconnue';
};

export const isAbortLikeError = (error: unknown) => {
  const lowerMessage = getSupabaseErrorDetails(error).toLowerCase();
  return (
    lowerMessage.includes('abort') ||
    lowerMessage.includes('signal') ||
    lowerMessage.includes('failed to fetch')
  );
};

const withSingleAbortRetry = async <T>(label: string, operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (isAbortLikeError(error)) {
      console.warn(`[${label}] Request aborted, retrying once...`);
      await wait(ABORT_RETRY_DELAY_MS);
      return operation();
    }

    throw error;
  }
};

const isDuplicateProfileError = (error: unknown) => {
  const lowerMessage = getSupabaseErrorDetails(error).toLowerCase();
  return readErrorField(error, 'code') === '23505' || lowerMessage.includes('duplicate key');
};

export const logSupabaseError = (
  context: string,
  error: unknown,
  extra?: Record<string, unknown>
) => {
  console.error(`[${context}] Supabase error`, {
    message: getSupabaseErrorDetails(error),
    error,
    extra,
  });
};

export const getProfileErrorMessage = (
  error: unknown,
  fallback = 'Une erreur est survenue.'
) => {
  const message = getSupabaseErrorDetails(error);
  const lowerMessage = message.toLowerCase();

  if (message === 'AUTH_REQUIRED' || lowerMessage.includes('auth_required')) {
    return 'Votre session a expiré. Reconnectez-vous puis réessayez.';
  }

  if (lowerMessage.includes('jwt') || lowerMessage.includes('session')) {
    return 'Votre session n’est plus valide. Reconnectez-vous puis réessayez.';
  }

  if (lowerMessage.includes('abort') || lowerMessage.includes('signal')) {
    return 'La requête a été interrompue avant la réponse du serveur.';
  }

  if (lowerMessage.includes('failed to fetch')) {
    return 'Le serveur n’a pas répondu ou la connexion a été interrompue.';
  }

  if (lowerMessage.includes('violates row-level security')) {
    return 'La sauvegarde a été refusée par les règles de sécurité du compte.';
  }

  if (lowerMessage.includes('siret_format')) {
    return 'Le SIRET doit contenir exactement 14 chiffres.';
  }

  if (lowerMessage.includes('header_type_check')) {
    return 'Le type d’en-tête est invalide.';
  }

  if (lowerMessage.includes('legal_status_check')) {
    return 'Le statut juridique est invalide.';
  }

  if (lowerMessage.includes('bucket') || lowerMessage.includes('storage')) {
    return `Erreur de stockage : ${message}`.slice(0, 180);
  }

  return message !== 'Erreur inconnue' ? message.slice(0, 180) : fallback;
};

export const sanitizeProfileUpdates = (updates: Partial<ProfileRecord>): ProfileUpdate => {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (
      value === undefined ||
      key === 'id' ||
      key === 'user_id' ||
      key === 'created_at' ||
      key === 'updated_at'
    ) {
      continue;
    }

    if (typeof value === 'string' && value.trim() === '') {
      cleaned[key] = null;
      continue;
    }

    if (key === 'siret' && typeof value === 'string' && !/^\d{14}$/.test(value)) {
      cleaned[key] = null;
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned as ProfileUpdate;
};

const buildDefaultProfileInsert = (
  user: User,
  updates?: Partial<ProfileRecord>
): ProfileInsert => {
  const cleaned = updates ? sanitizeProfileUpdates(updates) : {};

  return {
    user_id: user.id,
    email:
      typeof cleaned.email === 'string'
        ? cleaned.email
        : user.email?.trim().toLowerCase() ?? null,
    legal_status: 'auto-entrepreneur',
    header_type: 'automatic',
    legal_footer: DEFAULT_LEGAL_FOOTER,
    assurance_geographic_coverage: DEFAULT_ASSURANCE_COVERAGE,
    tva_exempt: false,
    urssaf_rate: 21.2,
    is_rate: 15,
    ...cleaned,
  };
};

const getProfileByUserId = async (userId: string): Promise<ProfileRecord | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const getAuthenticatedProfileUser = async (): Promise<User> => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;

  const activeUser = session?.user;

  if (!activeUser || activeUser.is_anonymous) {
    throw new Error('AUTH_REQUIRED');
  }

  return activeUser;
};

export const ensureProfileExists = async (user: User): Promise<ProfileRecord> => {
  return withSingleAbortRetry('profile:ensure', async () => {
    const existingProfile = await getProfileByUserId(user.id);

    if (existingProfile) {
      return existingProfile;
    }

    console.info('[profile:ensure] Creating missing profile', { userId: user.id });

    const { data, error } = await supabase
      .from('profiles')
      .insert(buildDefaultProfileInsert(user))
      .select()
      .single();

    if (error) {
      if (isDuplicateProfileError(error)) {
        const retryProfile = await getProfileByUserId(user.id);
        if (retryProfile) return retryProfile;
      }

      throw error;
    }

    return data;
  });
};

export const saveProfileForUser = async (
  user: User,
  updates: Partial<ProfileRecord>
): Promise<{ created: boolean; profile: ProfileRecord }> => {
  return withSingleAbortRetry('profile:save', async () => {
    const cleaned = sanitizeProfileUpdates(updates);
    const existingProfile = await getProfileByUserId(user.id);

    if (!existingProfile) {
      console.info('[profile:save] Inserting profile', {
        userId: user.id,
        fields: Object.keys(cleaned),
      });

      const { data, error } = await supabase
        .from('profiles')
        .insert(buildDefaultProfileInsert(user, updates))
        .select()
        .single();

      if (error) {
        if (isDuplicateProfileError(error)) {
          const retryProfile = await getProfileByUserId(user.id);

          if (retryProfile) {
            if (Object.keys(cleaned).length === 0) {
              return { created: false, profile: retryProfile };
            }

            const { data: updatedProfile, error: updateError } = await supabase
              .from('profiles')
              .update(cleaned)
              .eq('user_id', user.id)
              .select()
              .single();

            if (updateError) throw updateError;

            return { created: false, profile: updatedProfile };
          }
        }

        throw error;
      }

      return { created: true, profile: data };
    }

    if (Object.keys(cleaned).length === 0) {
      return { created: false, profile: existingProfile };
    }

    console.info('[profile:save] Updating profile', {
      userId: user.id,
      fields: Object.keys(cleaned),
    });

    const { data, error } = await supabase
      .from('profiles')
      .update(cleaned)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return { created: false, profile: data };
  });
};

const uploadCompanyAssetBlob = async (
  blob: Blob,
  options: { contentType: string; extension: string; type: CompanyAssetKind }
) => {
  return withSingleAbortRetry(`asset:${options.type}`, async () => {
    const activeUser = await getAuthenticatedProfileUser();
    await ensureProfileExists(activeUser);

    const fileName = `${activeUser.id}/${options.type}-${Date.now()}.${options.extension}`;

    const { error } = await supabase.storage.from('company-assets').upload(fileName, blob, {
      upsert: true,
      contentType: options.contentType,
    });

    if (error) throw error;

    return fileName;
  });
};

export const uploadCompanyImage = async (
  file: File,
  type: 'header' | 'logo' | 'stamp'
) => {
  const compressedBlob = await compressImageFile(file, {
    maxWidth: type === 'header' ? 1920 : 500,
    maxHeight: type === 'header' ? 400 : 500,
    quality: 0.85,
  });

  return uploadCompanyAssetBlob(compressedBlob, {
    type,
    extension: 'jpg',
    contentType: 'image/jpeg',
  });
};

export const uploadCompanySignature = async (blob: Blob) => {
  return uploadCompanyAssetBlob(blob, {
    type: 'artisan-signature',
    extension: 'png',
    contentType: 'image/png',
  });
};