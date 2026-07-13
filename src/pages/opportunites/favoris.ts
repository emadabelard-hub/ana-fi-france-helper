import { supabase } from '@/integrations/supabase/client';

const FAV_CHANGE_EVENT = 'anafypro:favoris-changed';

export const emitFavorisChanged = () => {
  try { window.dispatchEvent(new Event(FAV_CHANGE_EVENT)); } catch { /* ignore */ }
};

export const onFavorisChanged = (cb: () => void) => {
  window.addEventListener(FAV_CHANGE_EVENT, cb);
  return () => window.removeEventListener(FAV_CHANGE_EVENT, cb);
};

export const fetchFavorisIds = async (userId: string): Promise<Set<string>> => {
  const { data, error } = await supabase
    .from('opportunite_favoris')
    .select('annonce_id')
    .eq('user_id', userId)
    .limit(1000);
  if (error) { console.warn('fetchFavorisIds', error); return new Set(); }
  return new Set((data || []).map((r: any) => r.annonce_id));
};

export const addFavori = async (userId: string, annonceId: string) => {
  const { error } = await supabase
    .from('opportunite_favoris')
    .insert({ user_id: userId, annonce_id: annonceId });
  if (error && !String(error.message || '').includes('duplicate')) throw error;
  emitFavorisChanged();
};

export const removeFavori = async (userId: string, annonceId: string) => {
  const { error } = await supabase
    .from('opportunite_favoris')
    .delete()
    .eq('user_id', userId)
    .eq('annonce_id', annonceId);
  if (error) throw error;
  emitFavorisChanged();
};

export const toggleFavori = async (userId: string, annonceId: string, isFav: boolean) => {
  if (isFav) await removeFavori(userId, annonceId);
  else await addFavori(userId, annonceId);
};
