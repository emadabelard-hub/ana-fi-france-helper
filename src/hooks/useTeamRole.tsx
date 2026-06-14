import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TeamAssignment {
  chantier_id: string;
  patron_user_id: string;
  role: string;
}

/**
 * Détecte si l'utilisateur actuel est un chef d'équipe (membre d'un chantier
 * dont il n'est pas le patron) et expose la liste des chantiers auxquels il
 * a été invité. Si l'utilisateur est aussi propriétaire d'au moins un
 * chantier (table `chantiers` lui appartient), on considère qu'il reste en
 * mode patron (full access) — pas de bridage UI.
 */
export const useTeamRole = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<TeamAssignment[]>([]);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (authLoading) return;
      if (!user || user.is_anonymous) {
        if (!cancelled) {
          setAssignments([]);
          setIsOwner(false);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const [tm, ch] = await Promise.all([
          (supabase.from('chantier_team_members' as any) as any)
            .select('chantier_id, patron_user_id, role')
            .eq('member_user_id', user.id),
          supabase.from('chantiers').select('id').eq('user_id', user.id).limit(1),
        ]);
        if (cancelled) return;
        setAssignments((tm.data as TeamAssignment[]) || []);
        setIsOwner(Array.isArray(ch.data) && ch.data.length > 0);
      } catch (e) {
        console.warn('[useTeamRole] load failed', e);
        if (!cancelled) {
          setAssignments([]);
          setIsOwner(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [authLoading, user]);

  // Mode chef d'équipe restreint = membre d'au moins un chantier ET non propriétaire d'aucun chantier.
  const isTeamMemberOnly = !isOwner && assignments.length > 0;

  return {
    loading,
    assignments,
    isOwner,
    isTeamMemberOnly,
    hasAnyAssignment: assignments.length > 0,
  };
};

export default useTeamRole;
