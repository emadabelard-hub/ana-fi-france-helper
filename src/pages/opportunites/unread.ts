import { supabase } from '@/integrations/supabase/client';

const CHANGE_EVENT = 'anafypro:unread-changed';
export const emitUnreadChanged = () => {
  try { window.dispatchEvent(new Event(CHANGE_EVENT)); } catch { /* ignore */ }
};
export const onUnreadChanged = (cb: () => void) => {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
};

export const fetchUnreadMessagesCount = async (userId: string): Promise<number> => {
  // Get conversations the user is part of, then count unread messages.
  const { data: convs, error: cErr } = await supabase
    .from('opportunite_conversations')
    .select('id')
    .or(`owner_id.eq.${userId},contact_user_id.eq.${userId}`)
    .limit(500);
  if (cErr) { console.warn('unread conv', cErr); return 0; }
  const ids = (convs || []).map((c: any) => c.id);
  if (ids.length === 0) return 0;
  const { count, error } = await supabase
    .from('opportunite_messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', ids)
    .is('read_at', null)
    .neq('sender_id', userId)
    .eq('is_deleted', false);
  if (error) { console.warn('unread messages', error); return 0; }
  return count || 0;
};
