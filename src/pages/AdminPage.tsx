import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, BookOpen, HelpCircle, Shield, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AuthModal from '@/components/auth/AuthModal';
import LessonsManager from '@/components/admin/LessonsManager';
import QuestionsManager from '@/components/admin/QuestionsManager';

const AdminPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTab, setActiveTab] = useState('lessons');

  // PIN protection as fallback
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isPinValid, setIsPinValid] = useState(false);

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
        // Check if user is in admin_users table
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

  const handlePinSubmit = () => {
    // Simple PIN check - you can change this PIN
    const ADMIN_PIN = '1234'; // Change this to your preferred PIN
    
    if (pinInput === ADMIN_PIN) {
      setIsPinValid(true);
      setShowPinEntry(false);
      toast({
        title: isRTL ? 'تم التحقق' : 'Verified',
        description: isRTL ? 'مرحباً بك في لوحة الإدارة' : 'Welcome to the admin panel',
      });
    } else {
      toast({
        title: isRTL ? 'رمز خاطئ' : 'Wrong PIN',
        description: isRTL ? 'حاول مرة أخرى' : 'Please try again',
        variant: 'destructive',
      });
      setPinInput('');
    }
  };

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
        <section className={cn(
          "flex items-center gap-4",
          isRTL && "flex-row-reverse"
        )}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="shrink-0"
          >
            <BackArrow className="h-5 w-5" />
          </Button>
          <div className={cn("flex-1", isRTL && "text-right")}>
            <h1 className={cn(
              "text-2xl font-bold text-foreground",
              isRTL && "font-cairo"
            )}>
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
              {isRTL 
                ? 'يجب تسجيل الدخول للوصول لهذه الصفحة'
                : 'You must be logged in to access this page'}
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

  // Not admin - show PIN entry or access denied
  if (!isAdmin && !isPinValid) {
    return (
      <div className="py-6 space-y-6">
        <section className={cn(
          "flex items-center gap-4",
          isRTL && "flex-row-reverse"
        )}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="shrink-0"
          >
            <BackArrow className="h-5 w-5" />
          </Button>
          <div className={cn("flex-1", isRTL && "text-right")}>
            <h1 className={cn(
              "text-2xl font-bold text-foreground",
              isRTL && "font-cairo"
            )}>
              {isRTL ? 'لوحة الإدارة' : 'Admin Panel'}
            </h1>
          </div>
        </section>

        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className={cn("text-center", isRTL && "font-cairo")}>
              <Lock className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              {showPinEntry 
                ? (isRTL ? 'أدخل الرمز' : 'Enter PIN')
                : (isRTL ? 'الوصول محدود' : 'Access Restricted')}
            </CardTitle>
          </CardHeader>
          <CardContent className={cn("space-y-4", isRTL && "font-cairo")}>
            {showPinEntry ? (
              <>
                <Input
                  type="password"
                  placeholder={isRTL ? 'الرمز السري...' : 'Enter PIN...'}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                />
                <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowPinEntry(false)}
                  >
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handlePinSubmit}
                    disabled={!pinInput}
                  >
                    {isRTL ? 'دخول' : 'Enter'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-center text-muted-foreground">
                  {isRTL 
                    ? 'هذه الصفحة للمسؤولين فقط. إذا كان لديك رمز الوصول، اضغط أدناه.'
                    : 'This page is for administrators only. If you have the access PIN, click below.'}
                </p>
                <Button
                  className="w-full"
                  onClick={() => setShowPinEntry(true)}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {isRTL ? 'أدخل رمز الوصول' : 'Enter Access PIN'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin access granted
  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <section className={cn(
        "flex items-center gap-4",
        isRTL && "flex-row-reverse"
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          className="shrink-0"
        >
          <BackArrow className="h-5 w-5" />
        </Button>
        <div className={cn("flex-1", isRTL && "text-right")}>
          <h1 className={cn(
            "text-2xl font-bold text-foreground",
            isRTL && "font-cairo"
          )}>
            {isRTL ? 'لوحة إدارة المحتوى' : 'Content Admin Panel'}
          </h1>
          <p className={cn(
            "text-sm text-muted-foreground",
            isRTL && "font-cairo"
          )}>
            {isRTL ? 'إدارة الدروس والأسئلة' : 'Manage lessons and questions'}
          </p>
        </div>
      </section>

      {/* Admin Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={cn("grid w-full grid-cols-2", isRTL && "direction-rtl")}>
          <TabsTrigger value="lessons" className={cn("gap-2", isRTL && "flex-row-reverse font-cairo")}>
            <BookOpen className="h-4 w-4" />
            {isRTL ? 'الدروس' : 'Lessons'}
          </TabsTrigger>
          <TabsTrigger value="questions" className={cn("gap-2", isRTL && "flex-row-reverse font-cairo")}>
            <HelpCircle className="h-4 w-4" />
            {isRTL ? 'الأسئلة' : 'Questions'}
          </TabsTrigger>
        </TabsList>

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
