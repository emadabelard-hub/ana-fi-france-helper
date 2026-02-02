import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/MainLayout";
import Dashboard from "@/pages/Dashboard";
import AssistantPage from "@/pages/AssistantPage";
import ProfilePage from "@/pages/ProfilePage";
import ProPage from "@/pages/ProPage";
import ProSettingsPage from "@/pages/ProSettingsPage";
import InvoiceCreatorPage from "@/pages/InvoiceCreatorPage";
import ProAdminAssistantPage from "@/pages/ProAdminAssistantPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <MainLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/assistant" element={<AssistantPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/pro" element={<ProPage />} />
                <Route path="/pro/invoice-creator" element={<InvoiceCreatorPage />} />
                <Route path="/pro/admin-assistant" element={<ProAdminAssistantPage />} />
                <Route path="/pro/settings" element={<ProSettingsPage />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </MainLayout>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
