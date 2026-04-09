import type { Session } from '@supabase/supabase-js';

export const PRIMARY_ADMIN_EMAIL = 'emadabelard@gmail.com';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const getResetPasswordRedirectUrl = () => `${window.location.origin}/reset-password`;

export const AUTH_OPERATION_TIMEOUT_MS = 12000;

export const withAuthTimeout = async <T>(
  operation: Promise<T>,
  message = 'La requête prend trop de temps. Réessayez.'
): Promise<T> => {
  let timeoutId: number | null = null;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(message));
        }, AUTH_OPERATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
};

const readHashParams = () => {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;

  return new URLSearchParams(hash);
};

const safeDecode = (value: string | null) => {
  if (!value) return null;

  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value.replace(/\+/g, ' ');
  }
};

export const getRecoveryContext = () => {
  const hashParams = readHashParams();
  const searchParams = new URLSearchParams(window.location.search);

  const getParam = (key: string) => hashParams.get(key) ?? searchParams.get(key);

  const type = getParam('type');
  const accessToken = getParam('access_token');
  const refreshToken = getParam('refresh_token');
  const code = getParam('code');
  const error = getParam('error');
  const errorDescription = safeDecode(getParam('error_description'));

  return {
    type,
    error,
    errorDescription,
    hasRecoveryType: type === 'recovery',
    hasTokens: Boolean(accessToken && refreshToken),
    hasCode: Boolean(code),
    isRecoveryLink: type === 'recovery' || Boolean(accessToken && refreshToken) || Boolean(code),
  };
};

export const isAnonymousSession = (session: Session | null | undefined) => session?.user?.is_anonymous === true;

export const isAuthenticatedSession = (session: Session | null | undefined) => Boolean(session?.user) && !isAnonymousSession(session);