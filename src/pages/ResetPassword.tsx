import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Lock, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/utils/version';
import { showSuccess, showError } from '@/utils/toast';

const ResetPassword = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }
        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password,
            });

            if (updateError) throw updateError;

            setSuccess(true);
            showSuccess('Senha atualizada com sucesso!');
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err: any) {
            console.error('Error updating password:', err);
            setError(err.message || 'Erro ao atualizar senha.');
            showError('Falha ao atualizar senha.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-[#0a0a0a] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
            {/* Dynamic Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#1a1a00] to-[#0f0f00] animate-gradient-xy opacity-80"></div>

            {/* Decorative Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#FFF200]/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#FFD700]/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>

            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,242,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,242,0,0.02)_1px,transparent_1px)] bg-[size:60px_60px] opacity-20"></div>

            {/* Glass Card */}
            <div className="w-full max-w-[400px] relative z-10 backdrop-blur-xl bg-black/40 border border-white/10 rounded-3xl p-6 md:p-10 animate-in fade-in zoom-in duration-500 ring-1 ring-white/5 mx-auto">

                {/* Header */}
                <div className="text-center space-y-4 mb-8">
                    <div className="inline-flex p-4 rounded-3xl bg-white/5 border border-white/10 mb-2 shadow-xl shadow-[#FFF200]/10 ring-1 ring-white/5">
                        <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold text-white tracking-tight">Nova Senha</h1>
                        <p className="text-base text-zinc-400 font-medium">
                            Defina sua nova senha de acesso
                        </p>
                    </div>
                </div>

                {success ? (
                    <div className="text-center space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex justify-center">
                            <div className="p-4 rounded-full bg-green-500/10 border border-green-500/20">
                                <CheckCircle2 className="h-12 w-12 text-green-400" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-white">Tudo pronto!</h2>
                            <p className="text-zinc-400">Sua senha foi alterada. Redirecionando para o login...</p>
                        </div>
                        <Button
                            onClick={() => navigate('/login')}
                            className="w-full bg-[#FFF200] text-black hover:bg-[#ffe600] rounded-2xl h-14 font-extrabold"
                        >
                            IR PARA LOGIN
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="relative group">
                                <Lock className="absolute left-5 top-[1.1rem] h-5 w-5 text-zinc-500 group-focus-within:text-[#FFF200] transition-colors" />
                                <Input
                                    type="password"
                                    placeholder="Nova senha"
                                    className="pl-14 h-14 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-black/50 focus:border-[#FFF200]/50 focus:ring-4 focus:ring-[#FFF200]/10 transition-all rounded-2xl"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="relative group">
                                <Lock className="absolute left-5 top-[1.1rem] h-5 w-5 text-zinc-500 group-focus-within:text-[#FFF200] transition-colors" />
                                <Input
                                    type="password"
                                    placeholder="Confirme a nova senha"
                                    className="pl-14 h-14 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-black/50 focus:border-[#FFF200]/50 focus:ring-4 focus:ring-[#FFF200]/10 transition-all rounded-2xl"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm flex items-start gap-3 animate-in fade-in scale-95">
                                <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className={cn(
                                "w-full h-14 rounded-2xl font-extrabold text-lg transition-all duration-300",
                                "bg-[#FFF200] text-black hover:bg-[#ffe600]",
                                "shadow-[0_0_20px_-5px_rgba(255,242,0,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                            )}
                        >
                            {loading ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <span className="flex items-center gap-2">
                                    ATUALIZAR SENHA
                                    <ArrowRight className="h-5 w-5" />
                                </span>
                            )}
                        </Button>
                    </form>
                )}

                <div className="mt-8 text-center border-t border-white/5 pt-6">
                    <span className="text-[10px] text-zinc-600 font-bold tracking-[0.3em] uppercase">
                        Direct AI &bull; {APP_VERSION}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
