import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '@/contexts/SessionProvider';
import { toast } from 'sonner';
import SubscriptionCheckoutStandalone from '@/features/subscription-checkout/SubscriptionCheckoutStandalone';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Checkout() {
    const { session, profile } = useSession();
    const navigate = useNavigate();
    const [plans, setPlans] = useState<any[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);

    useEffect(() => {
        // Redirecionar se já tiver assinatura ativa
        if (session?.user && profile?.subscription_status === 'active') {
            navigate('/');
            toast.success("Bem-vindo de volta! Sua assinatura já está ativa.");
        }
    }, [session, profile, navigate]);

    useEffect(() => {
        async function fetchPlans() {
            try {
                // Fetch dynamic plans from Supabase if table exists
                const { data, error } = await supabase.from('subscription_plans').select('*').order('amount', { ascending: true });
                
                if (error) throw error;
                
                if (data && data.length > 0) {
                    const formattedPlans = data.map(p => ({
                        id: p.id,
                        plan_key: p.plan_key,
                        name: p.name,
                        amount: p.amount
                    }));
                    setPlans(formattedPlans);
                } else {
                    // Fallback to defaults if table is empty
                    setPlans([
                        { id: 'plan_dtf_monthly', plan_key: 'PRO', name: 'DTF Factory Mensal', amount: 97.00 },
                        { id: 'plan_dtf_yearly', plan_key: 'PRO_YEARLY', name: 'DTF Factory Anual', amount: 931.20 },
                        { id: 'plan_ai_monthly', plan_key: 'DIRECT_AI_MONTHLY', name: 'Direct AI Mensal', amount: 47.00 },
                        { id: 'plan_ai_yearly', plan_key: 'DIRECT_AI_YEARLY', name: 'Direct AI Anual', amount: 470.00 }
                    ]);
                }
            } catch (e) {
                console.warn("Could not fetch plans from DB, using fallback", e);
                setPlans([
                    { id: 'plan_dtf_monthly', plan_key: 'PRO', name: 'DTF Factory Mensal', amount: 97.00 },
                    { id: 'plan_dtf_yearly', plan_key: 'PRO_YEARLY', name: 'DTF Factory Anual', amount: 931.20 },
                    { id: 'plan_ai_monthly', plan_key: 'DIRECT_AI_MONTHLY', name: 'Direct AI Mensal', amount: 47.00 },
                    { id: 'plan_ai_yearly', plan_key: 'DIRECT_AI_YEARLY', name: 'Direct AI Anual', amount: 470.00 }
                ]);
            } finally {
                setLoadingPlans(false);
            }
        }
        fetchPlans();
    }, []);

    if (loadingPlans) {
        return (
            <div className="min-h-screen bg-black text-white w-full flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-sky-400 animate-spin mb-4" />
                <p className="text-gray-400">Carregando planos...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#05070b] text-white w-full relative overflow-hidden">
            {/* Background elements to match Overpixel Brand */}
            <div className="absolute inset-0 z-0 pointer-events-none" style={{
                background: 'radial-gradient(circle at 50% -20%, rgba(56,189,248,0.15), transparent 60%)'
            }} />
            
            <div className="relative z-10 w-full h-full pt-10">
                <SubscriptionCheckoutStandalone 
                    supabaseUrl={SUPABASE_URL}
                    supabaseAnonKey={session?.access_token || SUPABASE_ANON_KEY}
                    plans={plans}
                    defaultPlanId={plans[0]?.id || 'plan_pro_monthly'}
                    defaultBilling="PIX"
                    userId={session?.user?.id || 'GUEST'}
                    initialCustomerData={{
                        name: session?.user?.user_metadata?.full_name || '',
                        email: session?.user?.email || '',
                        cpfCnpj: profile?.cpf_cnpj || '',
                        mobilePhone: profile?.whatsapp || profile?.phone || ''
                    }}
                />
            </div>
        </div>
    );
}