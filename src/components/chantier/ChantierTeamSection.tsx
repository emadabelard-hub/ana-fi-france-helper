import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface Props {
  chantierId: string;
  userId: string;
  isRTL: boolean;
}

interface Invitation {
  id: string;
  token: string;
  phone: string | null;
  status: string;
  created_at: string;
  expires_at: string;
}

interface Member {
  id: string;
  member_user_id: string;
  created_at: string;
}

const ChantierTeamSection = ({ chantierId, userId, isRTL }: Props) => {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const load = async () => {
    setLoading(true);
    const [inv, mem] = await Promise.all([
      (supabase.from('chantier_invitations' as any) as any)
        .select('id, token, phone, status, created_at, expires_at')
        .eq('chantier_id', chantierId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      (supabase.from('chantier_team_members' as any) as any)
        .select('id, member_user_id, created_at')
        .eq('chantier_id', chantierId)
        .eq('patron_user_id', userId)
        .order('created_at', { ascending: false }),
    ]);
    setInvitations((inv.data as Invitation[]) || []);
    setMembers((mem.data as Member[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [chantierId, userId]);

  const handleInvite = async () => {
    setCreating(true);
    try {
      const { data, error } = await (supabase.from('chantier_invitations' as any) as any)
        .insert({ chantier_id: chantierId, user_id: userId, status: 'pending' })
        .select('token')
        .single();
      if (error) throw error;
      const token = (data as any).token;
      const link = `${window.location.origin}/invite/${token}`;
      const msg = `Bonjour, vous êtes invité à rejoindre Anafy Pro en tant que responsable de chantier. Cliquez sur ce lien pour accéder : ${link}`;
      const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(wa, '_blank');
      await load();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e?.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    const { error } = await (supabase.from('chantier_invitations' as any) as any)
      .update({ status: 'revoked' })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      return;
    }
    await load();
  };

  const handleRemoveMember = async (id: string) => {
    const { error } = await (supabase.from('chantier_team_members' as any) as any)
      .delete()
      .eq('id', id)
      .eq('patron_user_id', userId);
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      return;
    }
    await load();
  };

  const acceptedMemberIds = new Set(members.map((m) => m.member_user_id));

  return (
    <Card className="border-border/50">
      <CardContent className="p-3 space-y-3">
        <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
          <h3 className={cn('text-sm font-bold', isRTL && 'font-cairo')}>
            {isRTL ? 'الفريق' : 'Équipe'}
          </h3>
          <Button size="sm" onClick={handleInvite} disabled={creating} className="gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white shadow-md">
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            <span className={cn('text-xs font-bold', isRTL && 'font-cairo')}>
              {isRTL ? '➕ دعوة مسئول الشانتي' : 'Inviter chef d\'équipe'}
            </span>
          </Button>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-2">...</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className={cn('flex items-center justify-between p-2 rounded bg-emerald-500/10', isRTL && 'flex-row-reverse')}>
                <div className={cn('text-xs', isRTL && 'font-cairo text-right')}>
                  <Badge className="text-[10px] bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                    {isRTL ? 'نشط' : 'Actif'}
                  </Badge>
                  <span className="ml-2 font-mono">{m.member_user_id.slice(0, 8)}…</span>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRemoveMember(m.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            {invitations.filter((i) => i.status === 'pending' && new Date(i.expires_at).getTime() > Date.now()).map((inv) => (
              <div key={inv.id} className={cn('flex items-center justify-between p-2 rounded bg-amber-500/10', isRTL && 'flex-row-reverse')}>
                <div className={cn('text-xs', isRTL && 'font-cairo text-right')}>
                  <Badge className="text-[10px] bg-amber-500/20 text-amber-600 border-amber-500/30">
                    {isRTL ? 'في الانتظار' : 'En attente'}
                  </Badge>
                  <span className="ml-2 text-muted-foreground">
                    {isRTL ? 'تنتهي:' : 'Expire:'} {new Date(inv.expires_at).toLocaleString('fr-FR')}
                  </span>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRevoke(inv.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            {members.length === 0 && invitations.filter((i) => i.status === 'pending').length === 0 && (
              <p className={cn('text-xs text-muted-foreground text-center py-2', isRTL && 'font-cairo')}>
                {isRTL ? 'لا يوجد أعضاء بعد' : 'Aucun membre pour le moment'}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ChantierTeamSection;
