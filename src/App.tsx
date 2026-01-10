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
      // Retry com backoff exponencial para falhas de rede temporárias
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch apenas quando realmente necessário
      refetchOnWindowFocus: false, // Desabilitado para evitar refetch excessivo
      refetchOnReconnect: true, // Mantém para reconexão de rede
      // Dados considerados frescos por 5 minutos
      staleTime: 5 * 60 * 1000, // 5 minutos
      // Cache mantido por 15 minutos
      gcTime: 15 * 60 * 1000, // 15 minutos (anteriormente cacheTime)
    },
  },
});

// Componente para limpar cache quando a sessão mudar
const CacheInvalidator = () => {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const previousUserIdRef = useRef<string | undefined>(undefined);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const currentUserId = session?.user?.id;
    const previousUserId = previousUserIdRef.current;

    // Limpar timer anterior
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Se o usuário mudou, aguardar 1 segundo antes de limpar cache
    // Isso evita limpar durante refresh de token (que causa SIGNED_OUT momentâneo)
    if (currentUserId !== previousUserId) {
      debounceTimerRef.current = setTimeout(() => {
        // Verificar novamente após o debounce
        const finalUserId = session?.user?.id;
        const finalPreviousUserId = previousUserIdRef.current;

        if (finalUserId !== finalPreviousUserId) {
          console.log('[CacheInvalidator] User changed, clearing all queries');
          queryClient.clear(); // Limpa todo o cache
          previousUserIdRef.current = finalUserId;
        }
      }, 1000); // 1 segundo de debounce
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [session?.user?.id, queryClient, session]);

  return null;
};

import { PWAManager } from "./components/PWAManager";
import { InstallPrompt } from "./components/InstallPrompt";

// ... (código existente)

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="direct-ai-theme">
      <TooltipProvider>
        <AIAssistantProvider>
          <Toaster />
          <Sonner position="top-center" /> {/* Alterado para top-center */}
          <BrowserRouter>
            <SessionProvider>
              <PWAManager />
              <InstallPrompt />
              <TrialBanner />
              <CacheInvalidator />
              <ErrorBoundary>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route element={<ProtectedRoute />}>
                    <Route element={<Layout />}>
                      <Route path="/" element={<Index />} />
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/produtos" element={<Produtos />} />
                      <Route path="/pedidos" element={<Pedidos />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/insumos" element={<Insumos />} />
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