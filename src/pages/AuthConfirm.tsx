import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthConfirm() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const handleConfirm = async () => {
            const token_hash = searchParams.get('token_hash');
            const type = searchParams.get('type') as any;

            if (!token_hash || !type) {
                console.warn('⚠️ [AuthConfirm] Parâmetros inválidos');
                navigate('/login');
                return;
            }

            console.log(`🔍 [AuthConfirm] Confirmando link do tipo: ${type}`);

            try {
                const { error } = await supabase.auth.verifyOtp({
                    token_hash,
                    type,
                });

                if (error) {
                    console.error('❌ [AuthConfirm] Erro ao verificar OTP:', error);
                    toast.error('O link de confirmação é inválido ou expirou.');
                    navigate('/login');
                } else {
                    console.log('✅ [AuthConfirm] Verificação bem-sucedida');
                    
                    if (type === 'recovery' || type === 'email_change' || type === 'invite') {
                        // Para recuperação, vamos para a página de resetar senha
                        navigate('/reset-password');
                    } else {
                        // Para confirmação de email (signup), vai para o dashboard
                        navigate('/dashboard');
                    }
                }
            } catch (err) {
                console.error('❌ [AuthConfirm] Erro inesperado:', err);
                navigate('/login');
            }
        };

        handleConfirm();
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
            <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-[#FFF200] mx-auto" />
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white uppercase italic tracking-tight">Verificando</h2>
                    <p className="text-zinc-400">Por favor, aguarde enquanto validamos seu acesso...</p>
                </div>
            </div>
        </div>
    );
}
