import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Save, Loader2, Home, History, ArrowDownLeft, ArrowUpRight, PackageOpen, Download, Filter, Copy, Truck, RefreshCw, ExternalLink } from 'lucide-react';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabase } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import { Badge } from '@/components/ui/badge';
import { WalletRechargeModal } from './WalletRechargeModal';
import { Zap, Settings2, Globe, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/contexts/SessionProvider';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

export const LogisticsSettings: React.FC = () => {
    const { session } = useSession();
    const userId = session?.user?.id;
    const queryClient = useQueryClient();
    const { companyProfile, updateProfileAsync, isUpdating } = useCompanyProfile();
    const [saving, setSaving] = useState(false);
    const [showRechargeModal, setShowRechargeModal] = useState(false);
    const [activeProvider, setActiveProvider] = useState<'superfrete' | 'frenet' | null>(null);
    const [tokens, setTokens] = useState({
        superfrete: '',
        frenet: '',
        frenet_key: '',
        frenet_password: ''
    });
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Fetch user settings
    const { data: profileData } = useQuery({
        queryKey: ['profile_logistics_settings', userId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('logistics_provider, superfrete_token, frenet_token, frenet_access_key, frenet_access_password')
                .eq('id', userId!)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!userId
    });

    React.useEffect(() => {
        if (profileData) {
            setActiveProvider((profileData.logistics_provider as 'superfrete' | 'frenet' | null) || null);
            setTokens({
                superfrete: profileData.superfrete_token || '',
                frenet: profileData.frenet_token || '',
                frenet_key: profileData.frenet_access_key || '',
                frenet_password: profileData.frenet_access_password || ''
            });
        }
    }, [profileData]);

    const handleSyncFrenetBalance = async () => {
        const loading = toast.loading("Sincronizando saldo Frenet...");
        try {
            const { data, error } = await supabase.functions.invoke('frenet-proxy', {
                body: { action: 'balance' }
            });

            if (error) throw error;
            if (data.error) throw new Error(data.message || "Erro na Frenet");

            toast.success("Saldo sincronizado!", { id: loading });
            queryClient.invalidateQueries({ queryKey: ['profile_logistics_settings'] });
        } catch (error: any) {
            console.error("Erro sync Frenet:", error);
            toast.error("Erro ao sincronizar: " + error.message, { id: loading });
        }
    };

    const handleSaveProviderSettings = async () => {
        setSaving(true);
        const loading = toast.loading("Sincronizando plataforma...");
        try {
            await updateProfileAsync({
                logistics_provider: activeProvider!,
                superfrete_token: tokens.superfrete,
                frenet_token: tokens.frenet,
                frenet_access_key: tokens.frenet_key,
                frenet_access_password: tokens.frenet_password
            });

            toast.success("Plataforma configurada com sucesso!", { id: loading });
            queryClient.invalidateQueries({ queryKey: ['profile_logistics_settings'] });
            setIsModalOpen(false);
        } catch (error: any) {
            toast.error("Erro ao salvar: " + error.message, { id: loading });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAddress = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // updates are handled by the hook
            const formData = new FormData(e.target as HTMLFormElement);
            await updateProfileAsync({
                company_address_zip: formData.get('zip') as string,
                company_address_street: formData.get('street') as string,
                company_address_number: formData.get('number') as string,
                company_address_neighborhood: formData.get('neighborhood') as string,
                company_address_city: formData.get('city') as string,
                company_address_state: formData.get('state') as string,
            });
        } finally {
            setSaving(false);
        }
    };

    // Fetch labels
    const { data: labels, isLoading: loadingLabels } = useQuery({
        queryKey: ['shipping_labels'],
        queryFn: async () => {
            const token = await getValidToken();
            const response = await fetch(`${SUPABASE_URL}/rest/v1/shipping_labels?order=created_at.desc&limit=10`, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.json();
        }
    });

    // Fetch transactions
    const { data: transactions, isLoading: loadingTx } = useQuery({
        queryKey: ['logistics_transactions'],
        queryFn: async () => {
            const token = await getValidToken();
            const response = await fetch(`${SUPABASE_URL}/rest/v1/logistics_transactions?order=created_at.desc&limit=10`, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.json();
        }
    });

    return (
        <div className="space-y-6">
            {/* Seção Simplificada de Provedor */}
            <Card className="border-primary/20 bg-primary/5 shadow-sm overflow-hidden border-dashed">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 rounded-2xl bg-white border border-primary/10 flex items-center justify-center p-3 shadow-sm">
                                {activeProvider === 'frenet' ? (
                                    <img src="/logo - fre net.png" alt="Frenet" className="h-full w-full object-contain" />
                                ) : activeProvider === 'superfrete' ? (
                                    <img src="/logo - superfrete.png" alt="SuperFrete" className="h-full w-full object-contain" />
                                ) : (
                                    <div className="flex items-center -space-x-4">
                                        <div className="h-10 w-10 rounded-full bg-background border border-primary/20 flex items-center justify-center p-1.5 shadow-sm z-10 transition-transform hover:scale-110">
                                            <img src="/logo - superfrete.png" alt="SuperFrete" className="h-full w-full object-contain" />
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-background border border-primary/20 flex items-center justify-center p-1.5 shadow-sm z-0 transition-transform hover:scale-110">
                                            <img src="/logo - fre net.png" alt="Frenet" className="h-full w-full object-contain" />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="text-sm font-black italic uppercase tracking-tighter text-primary flex items-center gap-2">
                                    <Globe className="h-4 w-4" />
                                    Plataforma Ativa: <span className="text-zinc-600 ml-1">{activeProvider === 'superfrete' ? "SuperFrete" : activeProvider === 'frenet' ? "Frenet" : "Ambos"}</span>
                                </h3>
                                <div className="mt-1 flex items-center gap-3">
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight flex items-center gap-1">
                                        <ShieldCheck className="h-3 w-3 text-green-500" />
                                        {!activeProvider ? "Ambas plataformas são consultadas" : activeProvider === 'superfrete' && !tokens.superfrete ? "Modo Direct AI (Taxa Reduzida)" : "API Key Própria Ativa"}
                                    </p>
                                    <div className="h-4 w-[1px] bg-border" />
                                    {activeProvider === 'frenet' ? (
                                        <button
                                            onClick={handleSyncFrenetBalance}
                                            className="text-[10px] font-black uppercase text-primary tracking-tighter italic flex items-center gap-1 hover:underline cursor-pointer group"
                                        >
                                            <RefreshCw className="h-3 w-3 group-hover:rotate-180 transition-transform duration-500" />
                                            Saldo: {formatCurrency(companyProfile?.frenet_balance || 0)} (Sync)
                                        </button>
                                    ) : (
                                        <p className="text-[10px] font-black uppercase text-primary tracking-tighter italic flex items-center gap-1">
                                            Saldo SuperFrete: {formatCurrency(companyProfile?.wallet_balance || 0)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                            <DialogTrigger asChild>
                                <Button className="w-full md:w-auto gap-2 font-black italic uppercase tracking-tighter rounded-2xl h-auto py-3 md:h-12 px-6 shadow-lg hover:scale-105 transition-all whitespace-normal text-center leading-tight">
                                    <Settings2 className="h-4 w-4 shrink-0" />
                                    <span>Configurar PLATAFORMA DE ENVIO</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px] rounded-3xl p-6 gap-6">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-2">
                                        <Truck className="h-5 w-5" />
                                        Seleção de Plataforma
                                    </DialogTitle>
                                    <DialogDescription className="text-xs font-bold uppercase tracking-tight text-muted-foreground pt-1">
                                        Escolha o seu provedor de logística e configure suas chaves de acesso.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-6 pt-2">
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            className={`flex-1 h-24 rounded-2xl transition-all flex flex-col gap-2 group ${activeProvider === 'superfrete' ? 'bg-primary/5 border-2 border-primary ring-4 ring-primary/5' : 'hover:bg-muted grayscale opacity-60'}`}
                                            onClick={() => setActiveProvider('superfrete')}
                                        >
                                            <img src="/logo - superfrete.png" alt="SuperFrete" className="h-8 object-contain group-hover:scale-110 transition-transform" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">SuperFrete</span>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className={`flex-1 h-24 rounded-2xl transition-all flex flex-col gap-2 group ${activeProvider === null ? 'bg-primary/5 border-2 border-primary ring-4 ring-primary/5' : 'hover:bg-muted grayscale opacity-60'}`}
                                            onClick={() => setActiveProvider(null)}
                                        >
                                            <div className="flex items-center -space-x-2">
                                                <div className="h-8 w-8 rounded-full bg-background border border-primary/20 flex items-center justify-center p-1 shadow-sm z-10 transition-transform hover:scale-110">
                                                    <img src="/logo - superfrete.png" alt="SuperFrete" className="h-full w-full object-contain" />
                                                </div>
                                                <div className="h-8 w-8 rounded-full bg-background border border-primary/20 flex items-center justify-center p-1 shadow-sm z-0 transition-transform hover:scale-110">
                                                    <img src="/logo - fre net.png" alt="Frenet" className="h-full w-full object-contain" />
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Ambos</span>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className={`flex-1 h-24 rounded-2xl transition-all flex flex-col gap-2 group ${activeProvider === 'frenet' ? 'bg-primary/5 border-2 border-primary ring-4 ring-primary/5' : 'hover:bg-muted grayscale opacity-60'}`}
                                            onClick={() => setActiveProvider('frenet')}
                                        >
                                            <img src="/logo - fre net.png" alt="Frenet" className="h-8 object-contain group-hover:scale-110 transition-transform" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Frenet</span>
                                        </Button>
                                    </div>

                                    <div className="bg-muted/50 border border-border rounded-2xl p-5 space-y-4">
                                        {activeProvider === 'superfrete' ? (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-primary uppercase flex items-center gap-2">
                                                    <Copy className="h-3 w-3" /> Token SuperFrete
                                                </label>
                                                <input
                                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none shadow-sm"
                                                    type="password"
                                                    placeholder="Deixe vazio para usar nossa conta padrão"
                                                    value={tokens.superfrete}
                                                    onChange={(e) => setTokens(prev => ({ ...prev, superfrete: e.target.value }))}
                                                />
                                                <p className="text-[9px] text-muted-foreground font-bold italic leading-tight">Dica: Deixar vazio permite descontos exclusivos da Direct AI.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-primary uppercase flex items-center gap-2">
                                                        <Copy className="h-3 w-3" /> Token Frenet (Lojista)
                                                    </label>
                                                    <input
                                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none shadow-sm"
                                                        type="password"
                                                        placeholder="Ex: 56DCF50FR..."
                                                        value={tokens.frenet}
                                                        onChange={(e) => setTokens(prev => ({ ...prev, frenet: e.target.value }))}
                                                    />
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black text-primary uppercase flex items-center gap-2">
                                                                <Globe className="h-3 w-3" /> Chave Acesso (Email)
                                                            </label>
                                                            <input
                                                                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none shadow-sm"
                                                                type="text"
                                                                placeholder="Email do Frenet"
                                                                value={tokens.frenet_key}
                                                                onChange={(e) => setTokens(prev => ({ ...prev, frenet_key: e.target.value }))}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black text-primary uppercase flex items-center gap-2">
                                                                <ShieldCheck className="h-3 w-3" /> Senha Painel
                                                            </label>
                                                            <input
                                                                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 outline-none shadow-sm"
                                                                type="password"
                                                                placeholder="Senha do painel"
                                                                value={tokens.frenet_password}
                                                                onChange={(e) => setTokens(prev => ({ ...prev, frenet_password: e.target.value }))}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <DialogFooter className="sm:justify-end gap-3 pt-4 border-t">
                                    <Button
                                        variant="outline"
                                        className="rounded-xl font-bold uppercase text-[10px] h-10 px-6"
                                        onClick={() => setIsModalOpen(false)}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        className="rounded-xl font-black italic uppercase text-[10px] h-10 px-8 shadow-md"
                                        onClick={handleSaveProviderSettings}
                                        disabled={saving}
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Configuração"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Home className="h-4 w-4 text-primary" />
                        Endereço de Origem
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSaveAddress} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="zip" className="text-[10px] uppercase font-bold">CEP</Label>
                                <Input id="zip" name="zip" defaultValue={companyProfile?.company_address_zip || ''} placeholder="00000-000" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="number" className="text-[10px] uppercase font-bold">Número</Label>
                                <Input id="number" name="number" defaultValue={companyProfile?.company_address_number || ''} placeholder="123" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="street" className="text-[10px] uppercase font-bold">Logradouro</Label>
                            <Input id="street" name="street" defaultValue={companyProfile?.company_address_street || ''} placeholder="Rua..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="neighborhood" className="text-[10px] uppercase font-bold">Bairro</Label>
                                <Input id="neighborhood" name="neighborhood" defaultValue={companyProfile?.company_address_neighborhood || ''} placeholder="Bairro" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="city" className="text-[10px] uppercase font-bold">Cidade</Label>
                                <Input id="city" name="city" defaultValue={companyProfile?.company_address_city || ''} placeholder="Cidade" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="state" className="text-[10px] uppercase font-bold">Estado (UF)</Label>
                            <Input id="state" name="state" defaultValue={companyProfile?.company_address_state || ''} placeholder="SP" maxLength={2} />
                        </div>
                        <Button type="submit" className="w-full gap-2 font-bold" disabled={saving || isUpdating}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Salvar Endereço
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <PackageOpen className="h-4 w-4 text-primary" />
                        Minhas Etiquetas
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {loadingLabels ? (
                            <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                        ) : labels?.length > 0 ? (
                            labels.map((label: any) => (
                                <div key={label.id} className="p-3 hover:bg-zinc-50 transition-colors">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex gap-2 items-center">
                                            <Badge variant="outline" className="text-[9px] uppercase font-bold py-0">{label.tracking_code || 'Etiqueta'}</Badge>
                                            <span className="text-[10px] text-muted-foreground">{new Date(label.created_at).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                        <p className="text-xs font-bold text-primary">{formatCurrency(label.price)}</p>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-medium text-muted-foreground truncate max-w-[150px]">
                                            {label.origin_zip} → {label.destination_zip}
                                        </p>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 text-[10px] gap-1 px-2 font-bold hover:text-primary"
                                            onClick={() => window.open(label.pdf_url, '_blank')}
                                        >
                                            <Download className="h-3 w-3" /> PDF
                                        </Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-muted-foreground text-xs italic">Nenhuma etiqueta emitida.</div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" />
                        Fluxo de Caixa
                    </CardTitle>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowRechargeModal(true)}
                        className="h-8 text-[10px] gap-1.5 font-bold border-primary/20 hover:bg-primary hover:text-white transition-all"
                    >
                        <Zap className="h-3 w-3" /> Recarregar
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {loadingTx ? (
                            <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                        ) : transactions?.length > 0 ? (
                            transactions.map((tx: any) => (
                                <div key={tx.id} className="p-3 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-full ${tx.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                            {tx.type === 'credit' ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold leading-none">{tx.description || (tx.type === 'credit' ? 'Recarga' : 'Emissão de Etiqueta')}</p>
                                            <p className="text-[9px] text-muted-foreground mt-1">{new Date(tx.created_at).toLocaleString('pt-BR')}</p>
                                        </div>
                                    </div>
                                    <p className={`text-xs font-black ${tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                        {tx.type === 'credit' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-muted-foreground text-xs italic">Nenhuma transação encontrada.</div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <WalletRechargeModal
                open={showRechargeModal}
                onOpenChange={setShowRechargeModal}
                currentBalance={activeProvider === 'frenet' ? (companyProfile?.frenet_balance || 0) : (companyProfile?.wallet_balance || 0)}
                provider={activeProvider || 'superfrete'}
            />
        </div>
    );
};
