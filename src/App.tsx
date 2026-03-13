// App entry point - v3.0 (auth splash + lazy loading)
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProfileProvider } from "@/hooks/useProfile";
import MainLayout from "@/components/layout/MainLayout";
import GlobalErrorHandler from "@/components/app/GlobalErrorHandler";
import AuthSplashScreen from "@/components/auth/AuthSplashScreen";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const ProPage = lazy(() => import("@/pages/ProPage"));
const ProSettingsPage = lazy(() => import("@/pages/ProSettingsPage"));
const InvoiceCreatorPage = lazy(() => import("@/pages/InvoiceCreatorPage"));
const SmartDevisPage = lazy(() => import("@/pages/SmartDevisPage"));
const QuoteToInvoicePage = lazy(() => import("@/pages/QuoteToInvoicePage"));
const DocumentsListPage = lazy(() => import("@/pages/DocumentsListPage"));
const ArchiveAccountingPage = lazy(() => import("@/pages/ArchiveAccountingPage"));
const ProAdminAssistantPage = lazy(() => import("@/pages/ProAdminAssistantPage"));
const CVGeneratorPage = lazy(() => import("@/pages/CVGeneratorPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const NewsPage = lazy(() => import("@/pages/NewsPage"));
const AIAssistantPage = lazy(() => import("./pages/AIAssistantPage"));
const PremiumConsultationPage = lazy(() => import("./pages/PremiumConsultationPage"));
const PeinturePage = lazy(() => import("./pages/PeinturePage"));
const ConsultationsPage = lazy(() => import("./pages/ConsultationsPage"));
const LanguageSchoolPage = lazy(() => import("./pages/LanguageSchoolPage"));
const PaymentSuccessPage = lazy(() => import("./pages/PaymentSuccessPage"));
const UniversalAdminAssistantPage = lazy(() => import("./pages/UniversalAdminAssistantPage"));
const ServiceRequestPage = lazy(() => import("./pages/ServiceRequestPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));
const DocumentHubPage = lazy(() => import("./pages/DocumentHubPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const ClientDetailPage = lazy(() => import("./pages/ClientDetailPage"));
const ChantiersPage = lazy(() => import("./pages/ChantiersPage"));
const ChantierDetailPage = lazy(() => import("./pages/ChantierDetailPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const PricingSettingsPage = lazy(() => import("./pages/PricingSettingsPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { isLoading } = useAuth();

  // Show professional splash screen while verifying session
  if (isLoading) {
    return <AuthSplashScreen />;
  }

  return (
    <BrowserRouter>
      <MainLayout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/home" element={<Index />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/pro" element={<ProPage />} />
            <Route path="/pro/invoice-creator" element={<InvoiceCreatorPage />} />
            <Route path="/pro/smart-devis" element={<SmartDevisPage />} />
            <Route path="/pro/quote-to-invoice" element={<QuoteToInvoicePage />} />
            <Route path="/pro/documents" element={<DocumentsListPage />} />
            <Route path="/pro/archive" element={<ArchiveAccountingPage />} />
            <Route path="/pro/admin-assistant" element={<ProAdminAssistantPage />} />
            <Route path="/pro/cv-generator" element={<CVGeneratorPage />} />
            <Route path="/pro/settings" element={<ProSettingsPage />} />
            <Route path="/ai-assistant" element={<AIAssistantPage />} />
            <Route path="/premium-consultation" element={<PremiumConsultationPage />} />
            <Route path="/consultations" element={<ConsultationsPage />} />
            <Route path="/pro/peinture" element={<PeinturePage />} />
            <Route path="/language-school" element={<LanguageSchoolPage />} />
            <Route path="/universal-admin-assistant" element={<UniversalAdminAssistantPage />} />
            <Route path="/service-request" element={<ServiceRequestPage />} />
            <Route path="/payment-success" element={<PaymentSuccessPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/accounts" element={<ExpensesPage />} />
            <Route path="/document-hub" element={<DocumentHubPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/chantiers" element={<ChantiersPage />} />
            <Route path="/chantiers/:id" element={<ChantierDetailPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </MainLayout>
    </BrowserRouter>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProfileProvider>
          <LanguageProvider>
            <ThemeProvider>
              <TooltipProvider>
                <GlobalErrorHandler />
                <Toaster />
                <Sonner />
                <AppRoutes />
              </TooltipProvider>
            </ThemeProvider>
          </LanguageProvider>
        </ProfileProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
