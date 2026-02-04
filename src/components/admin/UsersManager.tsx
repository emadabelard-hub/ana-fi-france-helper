import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Users, Loader2, Mail, Calendar } from 'lucide-react';

interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  credits_balance: number;
}

interface UsersManagerProps {
  isRTL: boolean;
}

const UsersManager = ({ isRTL }: UsersManagerProps) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      // Note: This requires admin privileges via RLS
      // We fetch from profiles table which contains user info
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, email, full_name, created_at, credits_balance')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
      } else {
        setUsers(data || []);
      }
      setIsLoading(false);
    };

    fetchUsers();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardContent className="pt-6">
          <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
            <div className="p-3 rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className={cn(isRTL && "text-right")}>
              <p className="text-3xl font-bold">{users.length}</p>
              <p className="text-sm text-muted-foreground">
                {isRTL ? 'إجمالي المستخدمين' : 'Total Users'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className={cn("text-lg", isRTL && "text-right font-cairo")}>
            {isRTL ? 'قائمة المستخدمين' : 'User List'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className={cn("text-center text-muted-foreground py-8", isRTL && "font-cairo")}>
              {isRTL ? 'لا يوجد مستخدمين بعد' : 'No users yet'}
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors",
                    isRTL && "flex-row-reverse"
                  )}
                >
                  <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {(user.full_name || user.email || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className={cn(isRTL && "text-right")}>
                      <p className="font-medium text-sm">
                        {user.full_name || (isRTL ? 'بدون اسم' : 'No name')}
                      </p>
                      <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", isRTL && "flex-row-reverse")}>
                        <Mail className="h-3 w-3" />
                        <span>{user.email || (isRTL ? 'بدون بريد' : 'No email')}</span>
                      </div>
                    </div>
                  </div>
                  <div className={cn("text-right", isRTL && "text-left")}>
                    <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", isRTL && "flex-row-reverse")}>
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(user.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs font-medium text-primary">
                      {user.credits_balance} {isRTL ? 'رصيد' : 'credits'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersManager;
