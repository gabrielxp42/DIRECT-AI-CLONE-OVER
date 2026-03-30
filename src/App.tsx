import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import Layout from "./components/Layout";
import { SessionProvider } from "./contexts/SessionProvider";
import { ThemeProvider } from "./components/ThemeProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import { AIAssistantProvider } from "./contexts/AIAssistantProvider";
import { DynamicThemeProvider } from "./components/DynamicThemeProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { TrialBanner } from "./components/TrialBanner";
import { AntiScraper } from "./components/AntiScraper";
import { PWAManager } from "./components/PWAManager";
import { InstallPrompt } from "./components/InstallPrompt";
import AdminRoute from "./components/AdminRoute";
import SubscriptionGuard from "./components/SubscriptionGuard";
import { DeviceTracker } from "./hooks/useDeviceTracker";

// Lazy Load Pages
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Produtos = lazy(() => import("./pages/Produtos"));
const Pedidos = lazy(() => import("./pages/Pedidos"));
const PedidosLoja = lazy(() => import("./pages/PedidosLoja"));
const ErrosDefeitos = lazy(() => import("./pages/ErrosDefeitos"));
const TrocasDevolucoes = lazy(() => import("./pages/TrocasDevolucoes"));
const Reports = lazy(() => import("./pages/Reports"));
const Insumos = lazy(() => import("./pages/Insumos"));
const Settings = lazy(() => import("./pages/Settings"));
const Admin = lazy(() => import("./pages/Admin"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Legal = lazy(() => import("./pages/Legal"));
const Profile = lazy(() => import("./pages/Profile"));
const GabiSettings = lazy(() => import("./pages/GabiSettings"));
const Affiliate = lazy(() => import("./pages/Affiliate"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const OverPixelLauncher = lazy(() => import("./modules/launcher/Launcher"));
const AuthConfirm = lazy(() => import("./pages/AuthConfirm"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const DTFFactory = lazy(() => import("./pages/DTFFactory.tsx"));
const Logistics = lazy(() => import("./pages/Logistics"));
const Vetorizador = lazy(() => import("./pages/Vetorizador"));
import ProductionKanban from "./pages/ProductionKanban";
const ProductionTV = lazy(() => import("./pages/ProductionTV"));
const MontadorPage = lazy(() => import("./pages/Montador"));
const MelhoradorPage = lazy(() => import("./pages/Melhorador"));
import { OverPixelDock } from './components/OverPixelDock';

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

const GlobalLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-background">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="direct-ai-theme">
      <TooltipProvider>
        <AIAssistantProvider>
          <Toaster />
          <Sonner position="top-center" />
          <AntiScraper />
          <BrowserRouter>
            <SessionProvider>
              <DynamicThemeProvider>
                <PWAManager />
                <InstallPrompt />
                <TrialBanner />
                <ErrorBoundary>
                  <Suspense fallback={<GlobalLoader />}>
                    <Routes>
                      <Route path="/login" element={<Login />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/terms" element={<Legal />} />
                      <Route path="/privacy" element={<Legal />} />
                      <Route path="/checkout" element={<Checkout />} />
                      <Route path="/landing-page" element={<LandingPage />} />
                      <Route path="/auth/confirm" element={<AuthConfirm />} />
                      <Route path="/auth/callback" element={<AuthCallback />} />
                      <Route path="/producao/tv" element={<ProductionTV />} />
                      <Route path="/index.html" element={<Navigate to="/" replace />} />
                      <Route element={<ProtectedRoute />}>
                        <Route element={<SubscriptionGuard />}>
                          {/* Rotas com Layout padrão (inclui os apps full-bleed persistentes) */}
                          <Route element={
                            <>
                              <DeviceTracker />
                              <Layout />
                            </>
                          }>
                            <Route path="/" element={<OverPixelLauncher />} />
                            <Route path="/dashboard" element={<Index />} />
                            <Route path="/clientes" element={<Clientes />} />
                            <Route path="/produtos" element={<Produtos />} />
                            <Route path="/pedidos" element={<Pedidos />} />
                            <Route path="/pedidos-dtf" element={<Pedidos />} />
                            <Route path="/pedidos-loja" element={<PedidosLoja />} />
                            <Route path="/erros-defeitos" element={<ErrosDefeitos />} />
                            <Route path="/trocas-devolucoes" element={<TrocasDevolucoes />} />
                            <Route path="/reports" element={<Reports />} />
                            <Route path="/insumos" element={<Insumos />} />
                            <Route path="/logistica" element={<Logistics />} />

                            <Route path="/settings" element={<Settings />} />
                            <Route path="/profile" element={<Profile />} />
                            <Route path="/gabi" element={<GabiSettings />} />
                            <Route path="/affiliate" element={<Affiliate />} />
                            <Route path="/vetorizar" element={<Vetorizador />} />
                            <Route path="/producao" element={<ProductionKanban />} />

                            <Route path="/admin" element={
                              <AdminRoute>
                                <Admin />
                              </AdminRoute>
                            } />
                            <Route path="/dtf-factory" element={<DTFFactory />} />
                            <Route path="/montador" element={<MontadorPage />} />
                            <Route path="*" element={<NotFound />} />
                          </Route>
                        </Route>
                      </Route>
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
                <OverPixelDock />
              </DynamicThemeProvider>
            </SessionProvider>
          </BrowserRouter>
        </AIAssistantProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
