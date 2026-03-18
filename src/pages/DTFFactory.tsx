import React, { Suspense } from 'react';
import HomePage from '@dtf/app/page';
import { LauncherAuthProvider } from '@dtf/contexts/LauncherAuthContext';
import { WidgetProvider } from '@dtf/contexts/WidgetContext';
import '@dtf/app/globals.css';

// Componente Wrapper para fornecer contextos necessários
export default function DTFFactory() {
  return (
    <div className="dtf-factory-root min-h-screen bg-black text-white">
      <LauncherAuthProvider>
        <WidgetProvider>
          <Suspense fallback={<div className="flex items-center justify-center h-screen">Carregando Factory...</div>}>
            <HomePage />
          </Suspense>
        </WidgetProvider>
      </LauncherAuthProvider>
    </div>
  );
}
