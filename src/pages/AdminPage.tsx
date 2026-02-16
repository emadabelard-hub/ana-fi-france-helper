import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, BookOpen, HelpCircle, Shield, Loader2, BarChart3, Users, MapPin, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AuthModal from '@/components/auth/AuthModal';
import LessonsManager from '@/components/admin/LessonsManager';
import QuestionsManager from '@/components/admin/QuestionsManager';
import PromoStatsManager from '@/components/admin/PromoStatsManager';
import UsersManager from '@/components/admin/UsersManager';
import VisitStatsManager from '@/components/admin/VisitStatsManager';
import TransactionsManager from '@/components/admin/TransactionsManager';

const AdminPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (authLoading) return;
      
      if (!user) {
        setIsCheckingAdmin(false);
        setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('is_admin', { _user_id: user.id });
        
        if (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data === true);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsCheckingAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user, authLoading]);

  // Show loading state
  if (authLoading || isCheckingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show auth modal if not logged in
  if (!user) {
    return (
      <div className="py-6 space-y-6">
        <section className={cn("flex items-center gap-4", isRTL && "flex-row-reverse")}>
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
            <BackArrow className="h-5 w-5" />
          </Button>
          <div className={cn("flex-1", isRTL && "text-right")}>
            <h1 className={cn("text-2xl font-bold text-foreground", isRTL && "font-cairo")}>
              {isRTL ? 'لوحة الإدارة' : 'Admin Panel'}
            </h1>
          </div>
        </section>

        <Card className="max-w-md mx-auto">
          <CardContent className={cn("py-8 text-center space-y-4", isRTL && "font-cairo")}>
            <Shield className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">
              {isRTL ? 'تسجيل الدخول مطلوب' : 'Login Required'}
            </h2>
            <p className="text-muted-foreground">
              {isRTL ? 'يجب تسجيل الدخول للوصول لهذه الصفحة' : 'You must be logged in to access this page'}
            </p>
            <Button onClick={() => setShowAuthModal(true)}>
              {isRTL ? 'تسجيل الدخول' : 'Log In'}
            </Button>
          </CardContent>
        </Card>
        
        <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      </div>
    );
  }

  // Not admin - access denied (server-side check via is_admin RPC)
  if (!isAdmin) {
    return (
      <div className="py-6 space-y-6">
        <section className={cn("flex items-center gap-4", isRTL && "flex-row-reverse")}>
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
            <BackArrow className="h-5 w-5" />
          </Button>
          <div className={cn("flex-1", isRTL && "text-right")}>
            <h1 className={cn("text-2xl font-bold text-foreground", isRTL && "font-cairo")}>
              {isRTL ? 'لوحة الإدارة' : 'Admin Panel'}
            </h1>
          </div>
        </section>

        <Card className="max-w-md mx-auto">
          <CardContent className={cn("py-8 text-center space-y-4", isRTL && "font-cairo")}>
            <Shield className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">
              {isRTL ? 'الوصول مرفوض' : 'Access Denied'}
            </h2>
            <p className="text-muted-foreground">
              {isRTL ? 'هذه الصفحة للمسؤولين فقط' : 'This page is for administrators only.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin access granted
  return (
    <div className="py-6 space-y-6">
      <section className={cn("flex items-center gap-4", isRTL && "flex-row-reverse")}>
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
          <BackArrow className="h-5 w-5" />
        </Button>
        <div className={cn("flex-1", isRTL && "text-right")}>
          <h1 className={cn("text-2xl font-bold text-foreground", isRTL && "font-cairo")}>
              {isRTL ? 'لوحة الإدارة' : "Panneau d'administration"}
            </h1>
            <p className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")}>
              {isRTL ? 'إدارة الدروس والأسئلة' : 'Gérer les leçons et les questions'}
            </p>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={cn("grid w-full grid-cols-3 mb-2", isRTL && "direction-rtl")}>
          <TabsTrigger value="stats" className={cn("gap-1 text-xs", isRTL && "flex-row-reverse font-cairo")}>
            <BarChart3 className="h-4 w-4" />
            {isRTL ? 'إحصائيات' : 'Stats'}
          </TabsTrigger>
          <TabsTrigger value="users" className={cn("gap-1 text-xs", isRTL && "flex-row-reverse font-cairo")}>
            <Users className="h-4 w-4" />
            {isRTL ? 'مستخدمون' : 'Utilisateurs'}
          </TabsTrigger>
          <TabsTrigger value="visits" className={cn("gap-1 text-xs", isRTL && "flex-row-reverse font-cairo")}>
            <MapPin className="h-4 w-4" />
            {isRTL ? 'زيارات' : 'Visites'}
          </TabsTrigger>
        </TabsList>
        <TabsList className={cn("grid w-full grid-cols-3", isRTL && "direction-rtl")}>
          <TabsTrigger value="transactions" className={cn("gap-1 text-xs", isRTL && "flex-row-reverse font-cairo")}>
            <Receipt className="h-4 w-4" />
            {isRTL ? 'معاملات' : 'Transactions'}
          </TabsTrigger>
          <TabsTrigger value="lessons" className={cn("gap-1 text-xs", isRTL && "flex-row-reverse font-cairo")}>
            <BookOpen className="h-4 w-4" />
            {isRTL ? 'دروس' : 'Leçons'}
          </TabsTrigger>
          <TabsTrigger value="questions" className={cn("gap-1 text-xs", isRTL && "flex-row-reverse font-cairo")}>
            <HelpCircle className="h-4 w-4" />
            {isRTL ? 'أسئلة' : 'Questions'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-6">
          <PromoStatsManager isRTL={isRTL} />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UsersManager isRTL={isRTL} />
        </TabsContent>
        <TabsContent value="visits" className="mt-6">
          <VisitStatsManager isRTL={isRTL} />
        </TabsContent>
        <TabsContent value="transactions" className="mt-6">
          <TransactionsManager isRTL={isRTL} />
        </TabsContent>
        <TabsContent value="lessons" className="mt-6">
          <LessonsManager isRTL={isRTL} />
        </TabsContent>
        <TabsContent value="questions" className="mt-6">
          <QuestionsManager isRTL={isRTL} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
