import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, BookOpen, HelpCircle, Shield, Loader2, BarChart3, Users, MapPin, Receipt, ClipboardList, Activity, HeadphonesIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
// AuthModal removed — auto-login active
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

const AdminPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'warning' | 'error'>('checking');
  const [apiMessage, setApiMessage] = useState('');
  
  const [activeTab, setActiveTab] = useState('stats');

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (authLoading) return;

      // Emergency restore mode: allow direct admin dashboard access
      if (!user || user.is_anonymous) {
        setIsAdmin(true);
        setIsCheckingAdmin(false);
        return;
      }

      // Keep authenticated admin check for non-anonymous sessions
      try {
        const { data } = await supabase.rpc('is_admin', { _user_id: user.id });
        setIsAdmin(data === true);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(true);
      } finally {
        setIsCheckingAdmin(false);
      }
    };

    checkAdminAccess();
  }, [user, authLoading]);

  // Show loading state
  if (authLoading || isCheckingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Auto-login in progress, show loading
  if (!user || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        <ApiStatusIndicator isRTL={isRTL} />
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
        <TabsList className={cn("grid w-full grid-cols-4", isRTL && "direction-rtl")}>
          <TabsTrigger value="analytics" className={cn("gap-1 text-xs", isRTL && "flex-row-reverse font-cairo")}>
            <Activity className="h-4 w-4" />
            {isRTL ? 'تحليلات' : 'Analytics'}
          </TabsTrigger>
          <TabsTrigger value="transactions" className={cn("gap-1 text-xs", isRTL && "flex-row-reverse font-cairo")}>
            <Receipt className="h-4 w-4" />
            {isRTL ? 'معاملات' : 'Trans.'}
          </TabsTrigger>
          <TabsTrigger value="service-requests" className={cn("gap-1 text-xs", isRTL && "flex-row-reverse font-cairo")}>
            <ClipboardList className="h-4 w-4" />
            {isRTL ? 'طلبات' : 'Demandes'}
          </TabsTrigger>
          <TabsTrigger value="lessons" className={cn("gap-1 text-xs", isRTL && "flex-row-reverse font-cairo")}>
            <BookOpen className="h-4 w-4" />
            {isRTL ? 'دروس' : 'Leçons'}
          </TabsTrigger>
        </TabsList>
        <TabsList className={cn("grid w-full grid-cols-2", isRTL && "direction-rtl")}>
          <TabsTrigger value="questions" className={cn("gap-1 text-xs", isRTL && "flex-row-reverse font-cairo")}>
            <HelpCircle className="h-4 w-4" />
            {isRTL ? 'أسئلة' : 'Questions'}
          </TabsTrigger>
          <TabsTrigger value="support" className={cn("gap-1 text-xs", isRTL && "flex-row-reverse font-cairo")}>
            <HeadphonesIcon className="h-4 w-4" />
            {isRTL ? 'تذاكر' : 'Tickets'}
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
      </Tabs>
    </div>
  );
};

export default AdminPage;
