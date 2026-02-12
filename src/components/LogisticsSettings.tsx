import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Save, Loader2, Home, History, ArrowDownLeft, ArrowUpRight, PackageOpen, Download } from 'lucide-react';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { useQuery } from '@tanstack/react-query';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import { Badge } from '@/components/ui/badge';
import { WalletRechargeModal } from './WalletRechargeModal';
import { Zap } from 'lucide-react';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

export const LogisticsSettings: React.FC = () => {
    const { companyProfile, updateProfileAsync, isUpdating } = useCompanyProfile();
    const [saving, setSaving] = useState(false);
    const [showRechargeModal, setShowRechargeModal] = useState(false);

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
        </div>
    );
};
