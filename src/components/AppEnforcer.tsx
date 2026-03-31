import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionProvider';
import { UpgradeModal } from '@/components/Checkout/UpgradeModal';
import { AppPaywall } from '@/components/AppPaywall';
import { DirectAIShowcase } from '@/components/Showcases/DirectAIShowcase';
import { DTFShowcase } from '@/components/Showcases/DTFShowcase';
import { MontadorShowcase } from '@/components/Showcases/MontadorShowcase';
import { MelhoradorShowcase } from '@/components/Showcases/MelhoradorShowcase';

interface AppEnforcerProps {
  appId: string;
  children: React.ReactNode;
}

console.log("🛠️ [AppEnforcer.tsx] Component File Loaded - Ver 5");

export const AppEnforcer: React.FC<AppEnforcerProps> = ({ appId, children }) => {
  const { hasAppAccess, profile, consumeTrialToken, isLoading, session } = useSession();
  const navigate = useNavigate();
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);

  console.log("🛡️ [AppEnforcer] Checking access for:", appId, {
    isLoading,
    hasSession: !!session,
    hasProfile: !!profile,
    profileTier: profile?.subscription_tier,
    is_admin: profile?.is_admin
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const hasAccess = hasAppAccess(appId);

  if (!hasAccess) {
    console.warn(`🛑 [AppEnforcer] ACCESS DENIED for app: '${appId}'. Strict blocking active.`);
    
    const isDirectAI = appId === 'direct-ai' || appId === 'gabi' || appId === 'reports' || appId === 'logistics';
    const isDTF = appId === 'dtf-factory' || appId === 'vetorizador';
    const isMontador = appId === 'montador';
    const isMelhorador = appId === 'melhorador';

    const handleUpgrade = () => {
      const at = session?.access_token || '';
      const rt = (session as any)?.refresh_token || '';
      const plan = isDirectAI ? 'direct_ai' : 'factory';
      const qs = new URLSearchParams({ 
        access_token: at, 
        refresh_token: rt, 
        plan,
        app: appId 
      }).toString();
      window.open(`https://overpixel.online/checkout?${qs}`, '_blank');
    };

    type ThemeType = 'emerald' | 'blue' | 'rose' | 'amber' | 'purple';
    
    let configName = 'App Premium';
    let configTheme: ThemeType = 'emerald';
    let configShowcase: () => React.ReactNode = () => (
      <div className="h-full flex items-center justify-center text-white/20 uppercase font-black text-2xl tracking-widest">
        ACESSO RESTRITO
      </div>
    );
    
    if (isDirectAI) {
      configName = 'Direct AI';
      configTheme = 'emerald';
      configShowcase = () => <DirectAIShowcase />;
    } else if (isDTF) {
      configName = 'DTF Factory';
      configTheme = 'emerald';
      configShowcase = () => <DTFShowcase />;
    } else if (isMontador) {
      configName = 'Montador Flow';
      configTheme = 'blue';
      configShowcase = () => <MontadorShowcase />;
    } else if (isMelhorador) {
      configName = 'Melhorador Cloud';
      configTheme = 'rose';
      configShowcase = () => <MelhoradorShowcase />;
    }

    return (
      <div className="min-h-screen bg-neutral-950 relative flex items-center justify-center overflow-hidden">
        {/* Holographic Security Tease - Fake background to prevent UI bypass */}
        <div className="absolute inset-0 saturate-50 blur-[120px] opacity-10 pointer-events-none scale-105 overflow-hidden">
           {/* CRITICAL: Not rendering children here. The real app remains unmounted for security. */}
           <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-blue-500/20 animate-pulse" />
           <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]" />
           <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px]" />
        </div>

        <AppPaywall 
          isVisible={true}
          appId={appId}
          appName={configName}
          themeColor={configTheme}
          onClose={() => navigate('/')}
          onUpgrade={handleUpgrade}
          renderShowcase={configShowcase}
        />
      </div>
    );
  }

  console.log(`✅ [AppEnforcer] Permissão total para '${appId}'. Carregando aplicativo.`);
  return <>{children}</>;
};
