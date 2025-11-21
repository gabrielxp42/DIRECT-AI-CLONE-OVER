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
// import { setupAuthRefreshInterceptor } from "./utils/authRefresh";

// Configurar interceptor de renovação de token
// setupAuthRefreshInterceptor();

// Configurar QueryClient com opções para evitar problemas de cache
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Não usar cache quando há erro
      retry: 1,
      // Refetch quando a janela ganha foco
      refetchOnWindowFocus: true,
      // Refetch quando reconecta
      refetchOnReconnect: true,
      // Não manter dados em cache por muito tempo
      staleTime: 0, // Sempre considerar dados como stale
      // Cache por apenas 2 minutos
      gcTime: 2 * 60 * 1000, // 2 minutos (anteriormente cacheTime)
    },
  },
});

// Componente para limpar cache quando a sessão mudar
const CacheInvalidator = () => {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const previousUserIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentUserId = session?.user?.id;
    const previousUserId = previousUserIdRef.current;

    // Se o usuário mudou (login/logout), limpar todo o cache
    if (currentUserId !== previousUserId) {
      console.log('[CacheInvalidator] User changed, clearing all queries');
      queryClient.clear(); // Limpa todo o cache
      previousUserIdRef.current = currentUserId;
    }
  }, [session?.user?.id, queryClient]);

  return null;
};

import { PWAManager } from "./components/PWAManager";

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
              <CacheInvalidator />
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
            </SessionProvider>
          </BrowserRouter>
        </AIAssistantProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;