import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

// CRÍTICO: Forçar a remoção de quaisquer Service Workers ativos em desenvolvimento
// para evitar que cache antigo interfira com as credenciais novas.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    if(registrations.length > 0) {
      console.log('[Dev] Removendo Service Workers ativos para garantir código fresco...');
      for(let registration of registrations) {
        registration.unregister().then(success => {
          console.log('[Dev] Service Worker removido:', success);
          // Se encontrou e removeu um SW, pode ser necessário recarregar a página
          // mas vamos deixar o usuário fazer isso se necessário
        });
      }
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
