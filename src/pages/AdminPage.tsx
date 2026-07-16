import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  HelpCircle,
  Loader2,
  BarChart3,
  Users,
  MapPin,
  Receipt,
  ClipboardList,
  Activity,
  HeadphonesIcon,
  Settings,
  TrendingUp,
  ShieldAlert,
  Stethoscope,
  KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { normalizeEmail, PRIMARY_ADMIN_EMAIL } from '@/lib/auth';
import LessonsManager from '@/components/admin/LessonsManager';
import QuestionsManager from '@/components/admin/QuestionsManager';
import PromoStatsManager from '@/components/admin/PromoStatsManager';
import UsersManager from '@/components/admin/UsersManager';
import VisitStatsManager from '@/components/admin/VisitStatsManager';
import TransactionsManager from '@/components/admin/TransactionsManager';
import ServiceRequestsManager from '@/components/admin/ServiceRequestsManager';
import AnalyticsManager from '@/components/admin/AnalyticsManager';
import SupportTicketsManager from '@/components/admin/SupportTicketsManager';
import SystemHealthCard from '@/components/admin/SystemHealthCard';
import AdminAlertBanner from '@/components/admin/AdminAlertBanner';
import AdminDashboard from '@/components/admin/AdminDashboard';
import SystemDiagnosticManager from '@/components/admin/SystemDiagnosticManager';
import AdminConnectionLogs from '@/components/admin/AdminConnectionLogs';

const AdminPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'warning' | 'error'>('checking');
  const [apiMessage, setApiMessage] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  useEffect(() => {
    let isMounted = true;

    // While auth is hydrating, keep checking state — do NOT deny access prematurely.
    if (authLoading) {
      setIsCheckingAdmin(true);
      return;
    }

    if (!user || user.is_anonymous) {
      setIsAdmin(false);
      setIsCheckingAdmin(false);
      return;
    }

    setIsCheckingAdmin(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('is_admin', { _user_id: user.id });
        if (!isMounted) return;
        if (error) {
          console.error('is_admin RPC error:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data === true);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        if (!isMounted) return;
        setIsAdmin(false);
      } finally {
        if (isMounted) {
          setIsCheckingAdmin(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.is_anonymous, authLoading]);

  if (authLoading || isCheckingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.is_anonymous || !isAdmin) {
    return (
      <div className="py-8">
        <Card className="max-w-lg mx-auto border-border/60 shadow-sm">
          <CardContent className="pt-6 space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h1 className={cn('text-xl font-bold text-foreground', isRTL && 'font-cairo')}>
                {isRTL ? 'الدخول الإداري محمي' : 'Accès admin protégé'}
              </h1>
              <p className={cn('text-sm text-muted-foreground', isRTL && 'font-cairo')}>
                {isRTL
                  ? 'يجب تسجيل الدخول بحساب المدير للوصول إلى لوحة الإدارة.'
                  : 'Vous devez vous connecter avec le compte administrateur pour ouvrir ce panneau.'}
              </p>
            </div>
            <div className={cn('flex flex-col sm:flex-row gap-3 justify-center', isRTL && 'sm:flex-row-reverse')}>
              <Button onClick={() => navigate('/login')} className={cn(isRTL && 'font-cairo')}>
                {isRTL ? 'تسجيل الدخول' : 'Se connecter'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/')} className={cn(isRTL && 'font-cairo')}>
                {isRTL ? 'العودة للرئيسية' : 'Retour à l’accueil'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <AdminAlertBanner isRTL={isRTL} status={apiStatus} message={apiMessage} />

      <div className="py-6 space-y-6">
        <section className={cn('flex items-center gap-4', isRTL && 'flex-row-reverse')}>
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
            <BackArrow className="h-5 w-5" />
          </Button>
          <div className={cn('flex-1', isRTL && 'text-right')}>
            <h1 className={cn('text-2xl font-bold text-foreground', isRTL && 'font-cairo')}>
              {isRTL ? 'لوحة الإدارة' : "Panneau d'administration"}
            </h1>
            <p className={cn('text-sm text-muted-foreground', isRTL && 'font-cairo')}>
              {isRTL ? 'إدارة الدروس والأسئلة' : 'Gérer les leçons et les questions'}
            </p>
          </div>
        </section>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/pro/pricing-settings')}
            className={cn('gap-2', isRTL && 'flex-row-reverse font-cairo')}
          >
            <Settings className="h-4 w-4" />
            {isRTL ? 'إعدادات الأسعار' : 'Réglages Tarifs'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/opportunites/moderation')}
            className={cn('gap-2', isRTL && 'flex-row-reverse font-cairo')}
          >
            <ShieldAlert className="h-4 w-4" />
            {isRTL ? 'مراجعة إعلانات الفرص' : 'Modération des opportunités'}
          </Button>
        </div>

        <SystemHealthCard
          isRTL={isRTL}
          onStatusChange={(s, m) => {
            setApiStatus(s);
            setApiMessage(m);
          }}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto scrollbar-thin -mx-1 px-1 pb-1">
            <TabsList
              className={cn(
                'inline-flex w-max min-w-full gap-1',
                isRTL && 'direction-rtl flex-row-reverse',
              )}
            >
              <TabsTrigger value="dashboard" className={cn('gap-1 text-xs whitespace-nowrap', isRTL && 'flex-row-reverse font-cairo')}>
                <BarChart3 className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="users" className={cn('gap-1 text-xs whitespace-nowrap', isRTL && 'flex-row-reverse font-cairo')}>
                <Users className="h-4 w-4" />
                {isRTL ? 'مستخدمون' : 'Utilisateurs'}
              </TabsTrigger>
              <TabsTrigger value="visits" className={cn('gap-1 text-xs whitespace-nowrap', isRTL && 'flex-row-reverse font-cairo')}>
                <MapPin className="h-4 w-4" />
                {isRTL ? 'زيارات' : 'Visites'}
              </TabsTrigger>
              <TabsTrigger value="stats" className={cn('gap-1 text-xs whitespace-nowrap', isRTL && 'flex-row-reverse font-cairo')}>
                <TrendingUp className="h-4 w-4" />
                Stats
              </TabsTrigger>
              <TabsTrigger value="analytics" className={cn('gap-1 text-xs whitespace-nowrap', isRTL && 'flex-row-reverse font-cairo')}>
                <Activity className="h-4 w-4" />
                {isRTL ? 'تحليلات' : 'Analytics'}
              </TabsTrigger>
              <TabsTrigger value="transactions" className={cn('gap-1 text-xs whitespace-nowrap', isRTL && 'flex-row-reverse font-cairo')}>
                <Receipt className="h-4 w-4" />
                {isRTL ? 'معاملات' : 'Trans.'}
              </TabsTrigger>
              <TabsTrigger value="service-requests" className={cn('gap-1 text-xs whitespace-nowrap', isRTL && 'flex-row-reverse font-cairo')}>
                <ClipboardList className="h-4 w-4" />
                {isRTL ? 'طلبات' : 'Demandes'}
              </TabsTrigger>
              <TabsTrigger value="lessons" className={cn('gap-1 text-xs whitespace-nowrap', isRTL && 'flex-row-reverse font-cairo')}>
                <BookOpen className="h-4 w-4" />
                {isRTL ? 'دروس' : 'Leçons'}
              </TabsTrigger>
              <TabsTrigger value="questions" className={cn('gap-1 text-xs whitespace-nowrap', isRTL && 'flex-row-reverse font-cairo')}>
                <HelpCircle className="h-4 w-4" />
                {isRTL ? 'أسئلة' : 'Questions'}
              </TabsTrigger>
              <TabsTrigger value="support" className={cn('gap-1 text-xs whitespace-nowrap', isRTL && 'flex-row-reverse font-cairo')}>
                <HeadphonesIcon className="h-4 w-4" />
                {isRTL ? 'تذاكر' : 'Tickets'}
              </TabsTrigger>
              <TabsTrigger value="diagnostic" className={cn('gap-1 text-xs whitespace-nowrap', isRTL && 'flex-row-reverse font-cairo')}>
                <Stethoscope className="h-4 w-4" />
                Diagnostic
              </TabsTrigger>
              <TabsTrigger value="connections" className={cn('gap-1 text-xs whitespace-nowrap', isRTL && 'flex-row-reverse font-cairo')}>
                <KeyRound className="h-4 w-4" />
                {isRTL ? 'اتصالات' : 'Connexions'}
              </TabsTrigger>
            </TabsList>
          </div>


          <TabsContent value="dashboard" className="mt-6">
            <AdminDashboard isRTL={isRTL} />
          </TabsContent>
          <TabsContent value="stats" className="mt-6">
            <PromoStatsManager isRTL={isRTL} />
          </TabsContent>
          <TabsContent value="users" className="mt-6">
            <UsersManager isRTL={isRTL} />
          </TabsContent>
          <TabsContent value="visits" className="mt-6">
            <VisitStatsManager isRTL={isRTL} />
          </TabsContent>
          <TabsContent value="analytics" className="mt-6">
            <AnalyticsManager isRTL={isRTL} />
          </TabsContent>
          <TabsContent value="transactions" className="mt-6">
            <TransactionsManager isRTL={isRTL} />
          </TabsContent>
          <TabsContent value="service-requests" className="mt-6">
            <ServiceRequestsManager isRTL={isRTL} />
          </TabsContent>
          <TabsContent value="lessons" className="mt-6">
            <LessonsManager isRTL={isRTL} />
          </TabsContent>
          <TabsContent value="questions" className="mt-6">
            <QuestionsManager isRTL={isRTL} />
          </TabsContent>
          <TabsContent value="support" className="mt-6">
            <SupportTicketsManager isRTL={isRTL} />
          </TabsContent>
          <TabsContent value="diagnostic" className="mt-6">
            <SystemDiagnosticManager isRTL={isRTL} />
          </TabsContent>
          <TabsContent value="connections" className="mt-6">
            <AdminConnectionLogs isRTL={isRTL} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPage;
