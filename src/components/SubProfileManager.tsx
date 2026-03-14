import React, { useState, useEffect } from 'react';
import { useSession } from '@/contexts/SessionProvider';
import { supabase } from '@/integrations/supabase/client';
import { 
    Card, 
    CardContent, 
    CardDescription, 
    CardHeader, 
    CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Users, 
    Phone, 
    Lock, 
    Save, 
    Loader2, 
    Briefcase,
    Shield,
    Palette,
    Printer,
    Wrench,
    MessageSquare,
    RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

type SubProfile = {
    id: string;
    name: string;
    role: 'chefe' | 'designer' | 'operador' | 'atendente';
    whatsapp_number: string | null;
    pin: string | null;
    avatar_url: string | null;
    is_active: boolean;
};

export function SubProfileManager() {
    const { profile, activeSubProfile } = useSession();
    const [subProfiles, setSubProfiles] = useState<SubProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);

    const isBoss = !profile?.is_multi_profile_enabled || activeSubProfile?.role === 'chefe';

    useEffect(() => {
        fetchSubProfiles();
    }, [profile?.id]);

    const fetchSubProfiles = async () => {
        if (!profile?.id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('sub_profiles')
                .select('*')
                .eq('user_id', profile.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setSubProfiles(data || []);
        } catch (error) {
            console.error('Erro ao buscar sub-perfis:', error);
            toast.error('Não foi possível carregar a equipe');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (id: string, updates: Partial<SubProfile>) => {
        setSavingId(id);
        try {
            const { error } = await supabase
                .from('sub_profiles')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
            
            setSubProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
            toast.success('Perfil atualizado com sucesso!');
        } catch (error) {
            console.error('Erro ao atualizar sub-perfil:', error);
            toast.error('Erro ao salvar alterações');
        } finally {
            setSavingId(null);
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'chefe': return <Shield className="w-4 h-4 text-amber-500" />;
            case 'designer': return <Palette className="w-4 h-4 text-blue-500" />;
            case 'operador': return <Printer className="w-4 h-4 text-purple-500" />;
            case 'atendente': return <MessageSquare className="w-4 h-4 text-green-500" />;
            default: return <Users className="w-4 h-4" />;
        }
    };

    if (!isBoss) return null;

    return (
        <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
                <div className="flex items-center gap-2 mb-1">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-xl font-bold">Gestão da Equipe</CardTitle>
                        <CardDescription>Configure os números de WhatsApp dos seus colaboradores para notificações da Gabi.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {subProfiles.map((p) => (
                            <motion.div 
                                key={p.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all group"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex items-center justify-center border-2 border-primary/20">
                                            {p.avatar_url ? (
                                                <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-lg font-bold text-primary">{p.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 p-1 bg-background rounded-full border border-border shadow-sm">
                                            {getRoleIcon(p.role)}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">{p.name}</h4>
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-semibold">
                                            {p.role}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase text-muted-foreground font-bold flex items-center gap-1">
                                            <Phone className="w-3 h-3" /> WhatsApp para Notificações
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input 
                                                defaultValue={p.whatsapp_number || ''}
                                                placeholder="Ex: 5511999999999"
                                                className="h-9 text-sm"
                                                onBlur={(e) => {
                                                    if (e.target.value !== (p.whatsapp_number || '')) {
                                                        handleUpdate(p.id, { whatsapp_number: e.target.value });
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {p.role === 'chefe' && (
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase text-muted-foreground font-bold flex items-center gap-1">
                                                <Lock className="w-3 h-3" /> PIN de Acesso (4 dígitos)
                                            </Label>
                                            <Input 
                                                defaultValue={p.pin || ''}
                                                maxLength={4}
                                                type="password"
                                                placeholder="****"
                                                className="h-9 text-sm"
                                                onBlur={(e) => {
                                                    if (e.target.value.length === 4 && e.target.value !== (p.pin || '')) {
                                                        handleUpdate(p.id, { pin: e.target.value });
                                                    }
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                                
                                {savingId === p.id && (
                                    <div className="mt-2 flex items-center gap-2 text-[10px] text-primary animate-pulse font-bold uppercase italic">
                                        <RefreshCw className="w-3 h-3 animate-spin" /> Salvando...
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}

                {!loading && subProfiles.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground italic">
                        Nenhum sub-perfil configurado ainda.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
