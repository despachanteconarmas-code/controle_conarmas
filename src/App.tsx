import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import NewServiceOrder from "./pages/NewServiceOrder";
import ServiceOrderDetails from "./pages/ServiceOrderDetails";
import EditServiceOrder from "./pages/EditServiceOrder";
import Customers from "./pages/Customers";
import Members from "./pages/Members";
import MemberDetails from "./pages/MemberDetails";
import MemberExpirations from "./pages/MemberExpirations";
import MemberImport from "./pages/MemberImport";
import CardSettingsPage from "./pages/CardSettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="conarmas-theme">
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/nova-os" element={<NewServiceOrder />} />
              <Route path="/os/:id" element={<ServiceOrderDetails />} />
              <Route path="/os/:id/editar" element={<EditServiceOrder />} />
              <Route path="/clientes" element={<Customers />} />
              <Route path="/filiados" element={<Members />} />
              <Route path="/filiados/vencimentos" element={<MemberExpirations />} />
              <Route path="/filiados/importar" element={<MemberImport />} />
              <Route path="/filiados/configuracoes" element={<CardSettingsPage />} />
              <Route path="/filiados/:id" element={<MemberDetails />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
