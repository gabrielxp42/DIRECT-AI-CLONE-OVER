import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

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

// Suprimir erro comum de extensões do navegador que não afeta a aplicação
// Este erro ocorre quando extensões (bloqueadores de anúncios, DevTools, etc.)
// tentam interceptar mensagens mas não conseguem responder a tempo
window.addEventListener('error', (event) => {
  if (event.message?.includes('message channel closed before a response was received')) {
    event.preventDefault();
    // Não logar este erro específico pois é causado por extensões do navegador
    return false;
  }
});

// Também capturar promessas rejeitadas não tratadas relacionadas a este erro
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('message channel closed before a response was received') ||
    event.reason?.message?.includes('asynchronous response')) {
    event.preventDefault();
    // Não logar este erro específico pois é causado por extensões do navegador
    return false;
  }
});

createRoot(document.getElementById("root")!).render(<App />);
