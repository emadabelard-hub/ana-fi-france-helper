import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/MainLayout";
import GlobalErrorHandler from "@/components/app/GlobalErrorHandler";
import ProfilePage from "@/pages/ProfilePage";
import ProPage from "@/pages/ProPage";
import ProSettingsPage from "@/pages/ProSettingsPage";
import InvoiceCreatorPage from "@/pages/InvoiceCreatorPage";
import QuoteToInvoicePage from "@/pages/QuoteToInvoicePage";
import ProAdminAssistantPage from "@/pages/ProAdminAssistantPage";
import CVGeneratorPage from "@/pages/CVGeneratorPage";
import AdminPage from "@/pages/AdminPage";
import NewsPage from "@/pages/NewsPage";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";
import AIAssistantPage from "./pages/AIAssistantPage";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <ThemeProvider>
          <TooltipProvider>
            <GlobalErrorHandler />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <MainLayout>
                <Routes>
                  {/* Home is the main hub */}
                  <Route path="/" element={<Index />} />
                  <Route path="/home" element={<Index />} />
                  <Route path="/news" element={<NewsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/pro" element={<ProPage />} />
                  <Route path="/pro/invoice-creator" element={<InvoiceCreatorPage />} />
                  <Route path="/pro/quote-to-invoice" element={<QuoteToInvoicePage />} />
                  <Route path="/pro/admin-assistant" element={<ProAdminAssistantPage />} />
                  <Route path="/pro/cv-generator" element={<CVGeneratorPage />} />
                  <Route path="/pro/settings" element={<ProSettingsPage />} />
                  <Route path="/ai-assistant" element={<AIAssistantPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </MainLayout>
            </BrowserRouter>
          </TooltipProvider>
          </ThemeProvider>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;

