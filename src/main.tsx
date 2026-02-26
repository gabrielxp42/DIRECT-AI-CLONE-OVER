import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

// Log de inicialização para debug de produção
console.log('🚀 [Main] Starting application...', {
  env: import.meta.env.MODE,
  version: import.meta.env.VITE_APP_VERSION
});

// Global error handlers for React context
window.addEventListener('error', (event) => {
  // Ignorar erros de extensão conhecidos
  if (event.message?.includes('message channel closed') ||
    event.message?.includes('webpage_content_reporter')) {
    event.preventDefault();
    return false;
  }
});

// SISTEMA DE ATUALIZAÇAO FORÇADA (PREVINE CACHE ANTIGO NO PWA)
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION;
const LAST_VERSION = localStorage.getItem('app_version');

if (CURRENT_VERSION && LAST_VERSION && CURRENT_VERSION !== LAST_VERSION) {
  console.log(`[Update] Nova versão detectada: ${CURRENT_VERSION}. Limpando cache e recarregando...`);
  localStorage.setItem('app_version', CURRENT_VERSION);
  // Limpar caches específicos se necessário, ou apenas recarregar
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.update();
      }
    });
  }
  // Pequeno delay para garantir que o SW receba o sinal antes do reload
  setTimeout(() => window.location.reload(), 500);
} else if (CURRENT_VERSION) {
  localStorage.setItem('app_version', CURRENT_VERSION);
}

// CRÍTICO: Forçar a remoção de quaisquer Service Workers ativos em desenvolvimento
// para evitar que cache antigo interfira com as credenciais novas.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (registrations) {
    if (registrations.length > 0) {
      console.log('[Dev] Removendo Service Workers ativos para garantir código fresco...');
      let unregistered = 0;

      registrations.forEach(registration => {
        registration.unregister().then(success => {
          if (success) {
            unregistered++;
            console.log('[Dev] Service Worker removido com sucesso');

            // Se removeu algum SW, recarregar a página APENAS UMA VEZ
            if (unregistered === registrations.length && !sessionStorage.getItem('sw_cleaned')) {
              sessionStorage.setItem('sw_cleaned', 'true');
              console.log('[Dev] Recarregando página para aplicar mudanças...');
              window.location.reload();
            }
          }
        });
      });
    }
  });
}

// Também capturar promessas rejeitadas não tratadas relacionadas a estes erros
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('message channel closed') ||
    event.reason?.message?.includes('asynchronous response') ||
    event.reason?.name === 'AbortError' || // Catch standard AbortError
    event.reason?.message?.includes('AbortError')) {
    event.preventDefault();
    return false;
  }
});

createRoot(document.getElementById("root")!).render(<App />);
