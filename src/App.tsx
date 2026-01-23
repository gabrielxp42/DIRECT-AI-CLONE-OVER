import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import { SessionProvider } from "./contexts/SessionProvider";
import { ThemeProvider } from "./components/ThemeProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import Clientes from "./pages/Clientes";
import Produtos from "./pages/Produtos";
import Pedidos from "./pages/Pedidos";
import Reports from "./pages/Reports";
import Insumos from "./pages/Insumos";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import ResetPassword from "./pages/ResetPassword";
import Checkout from "./pages/Checkout";
import Legal from "./pages/Legal";
import Profile from "./pages/Profile";
import { AIAssistantProvider } from "./contexts/AIAssistantProvider";
import { useEffect, useRef } from "react";
import { useSession } from "./contexts/SessionProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { TrialBanner } from "./components/TrialBanner";
// import { setupAuthRefreshInterceptor } from "./utils/authRefresh";

// Configurar interceptor de renovação de token
// setupAuthRefreshInterceptor();

// Configurar QueryClient com opções otimizadas
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 2 * 60 * 1000, // Reduced to 2 minutes for better consistency
      gcTime: 10 * 60 * 1000,
    },
    mutations: {
      retry: 0, // Don't retry mutations automatically to avoid duplicate logical actions
    }
  },
});


import { PWAManager } from "./components/PWAManager";
import { InstallPrompt } from "./components/InstallPrompt";
import AdminRoute from "./components/AdminRoute";

// ... (código existente)

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="direct-ai-theme">
      <TooltipProvider>
        <AIAssistantProvider>
          <Toaster />
          <Sonner position="top-center" /> {/* Alterado para top-center */}
          <BrowserRouter>
            <SessionProvider>
              <PWAManager />
              <InstallPrompt />
              <TrialBanner />
              <ErrorBoundary>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/terms" element={<Legal />} />
                  <Route path="/privacy" element={<Legal />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route element={<ProtectedRoute />}>
                    <Route element={<Layout />}>
                      <Route path="/" element={<Index />} />
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/produtos" element={<Produtos />} />
                      <Route path="/pedidos" element={<Pedidos />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/insumos" element={<Insumos />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/admin" element={
                        <AdminRoute>
                          <Admin />
                        </AdminRoute>
                      } />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Route>
                  </Route>
                </Routes>
              </ErrorBoundary>
            </SessionProvider>
          </BrowserRouter>
        </AIAssistantProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;