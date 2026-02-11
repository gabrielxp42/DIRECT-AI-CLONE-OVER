import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, Loader2, CreditCard, Download, PackageOpen, ExternalLink } from 'lucide-react';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import { showError, showSuccess } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

interface ShippingOption {
    id: number;
    name: string;
    price: string;
    discount: string;
    delivery_time: number;
}

interface ShippingSectionProps {
    pedidoId?: string;
    clientAddress?: string;
    clientName?: string;
    orderNumber?: number;
    valorTotal?: number;
    initialLabelId?: string;
    initialStatus?: string;
}

export const ShippingSection: React.FC<ShippingSectionProps> = ({
    pedidoId,
    clientAddress,
    clientName,
    orderNumber,
    valorTotal,
    initialLabelId,
    initialStatus
}) => {
    const [loading, setLoading] = useState(false);
    const [options, setOptions] = useState<ShippingOption[]>([]);
    const [selectedOption, setSelectedOption] = useState<ShippingOption | null>(null);
    const [labelId, setLabelId] = useState<string | undefined>(initialLabelId);
    const [status, setStatus] = useState<string | undefined>(initialStatus);
    const [labelUrl, setLabelUrl] = useState<string | null>(null);

    const [manualCEP, setManualCEP] = useState("");
    const [manualDestName, setManualDestName] = useState("");
    const [manualDestAddress, setManualDestAddress] = useState("");
    const [packageDimensions, setPackageDimensions] = useState({
        weight: 0.5,
        height: 2,
        width: 25,
        length: 35
    });

    // Extrair CEP do endereço (Regex simples)
    const extractCEP = (address: string) => {
        if (!address) return "";
        const match = address.match(/\d{5}-?\d{3}/);
        return match ? match[0].replace('-', '') : "";
    };

    useEffect(() => {
        if (clientAddress && !manualCEP) {
            setManualCEP(extractCEP(clientAddress));
        }
    }, [clientAddress]);

    useEffect(() => {
        if (clientName && !manualDestName) {
            setManualDestName(clientName);
        }
    }, [clientName]);

    const handleCalculate = async () => {
        if (!manualCEP || manualCEP.length < 8) {
            showError("Por favor, insira um CEP de destino válido.");
            return;
        }

        setLoading(true);
        try {
            const token = await getValidToken();
            const response = await fetch(`${SUPABASE_URL}/functions/v1/superfrete-proxy`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'calculate',
                    params: {
                        from: "04571-010",
                        to: manualCEP,
                        package: packageDimensions
                    }
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.message);

            setOptions(data);
            showSuccess(`${data.length} opções de frete encontradas.`);
        } catch (error: any) {
            showError(`Erro ao calcular frete: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLabel = async () => {
        if (!selectedOption || !manualCEP) return;

        setLoading(true);
        try {
            const token = await getValidToken();
            const response = await fetch(`${SUPABASE_URL}/functions/v1/superfrete-proxy`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'cart',
                    params: {
                        from: {
                            name: "DIRECT AI",
                            postal_code: "04571-010",
                            address: "Av. Pres. Juscelino Kubitschek",
                            number: "50",
                            district: "Vila Nova Conceição",
                            city: "São Paulo",
                            state_abbr: "SP"
                        },
                        to: {
                            name: clientName,
                            postal_code: manualCEP,
                            address: (clientAddress && clientAddress.split(',')[0]) || "Endereço não informado",
                            number: "S/N",
                            district: "Bairro",
                            city: "Cidade",
                            state_abbr: "UF"
                        },
                        service: selectedOption.id,
                        volume: packageDimensions,
                        options: { non_commercial: true }
                    }
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.message);

            setLabelId(data.id);
            setStatus(data.status);

            // Salvar no pedido
            const { supabase } = await import('@/integrations/supabase/client');
            await supabase
                .from('pedidos')
                .update({
                    shipping_label_id: data.id,
                    shipping_label_status: data.status,
                    valor_frete: parseFloat(data.price),
                    transportadora: selectedOption.name
                })
                .eq('id', pedidoId);

            showSuccess("Etiqueta gerada! Agora você pode emitir o pagamento.");
        } catch (error: any) {
            showError(`Erro ao criar etiqueta: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckout = async () => {
        if (!labelId) return;

        setLoading(true);
        try {
            const token = await getValidToken();
            const response = await fetch(`${SUPABASE_URL}/functions/v1/superfrete-proxy`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'checkout',
                    params: { id: labelId }
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.message);

            setStatus(data.status);

            // Atualizar pedido (apenas se existir)
            if (pedidoId) {
                const { supabase } = await import('@/integrations/supabase/client');
                await supabase
                    .from('pedidos')
                    .update({ shipping_label_status: data.status })
                    .eq('id', pedidoId);
            }

            showSuccess("Etiqueta emitida com sucesso!");
        } catch (error: any) {
            showError(`Erro ao emitir etiqueta: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!labelId) return;

        setLoading(true);
        try {
            const token = await getValidToken();
            const response = await fetch(`${SUPABASE_URL}/functions/v1/superfrete-proxy`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'tracking',
                    params: { orders: [labelId] }
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.message);

            setLabelUrl(data.url);
            window.open(data.url, '_blank');
        } catch (error: any) {
            showError(`Erro ao obter link: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-primary/20 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
            <CardHeader className="bg-primary/5 py-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    Logística Super Frete
                    {status && (
                        <Badge variant="outline" className="ml-auto bg-white text-[10px] uppercase font-bold">
                            {status}
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                {!labelId && (
                    <div className="space-y-4">
                        {/* Destinatário */}
                        <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-muted-foreground">Nome do Destinatário</label>
                                <input
                                    type="text"
                                    placeholder="Nome ou Empresa"
                                    value={manualDestName}
                                    onChange={(e) => setManualDestName(e.target.value)}
                                    className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            {!clientAddress && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground">Endereço (Rua, Número)</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Av. Paulista, 1000"
                                        value={manualDestAddress}
                                        onChange={(e) => setManualDestAddress(e.target.value)}
                                        className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                            )}
                        </div>

                        {/* CEP e Dimensões */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-muted-foreground">CEP Destino</label>
                                <input
                                    type="text"
                                    placeholder="00000000"
                                    value={manualCEP}
                                    onChange={(e) => setManualCEP(e.target.value.replace(/\D/g, ''))}
                                    className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-muted-foreground">Peso (kg)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={packageDimensions.weight}
                                    onChange={(e) => setPackageDimensions({ ...packageDimensions, weight: parseFloat(e.target.value) })}
                                    className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-muted-foreground">Alt (cm)</label>
                                <input
                                    type="number"
                                    value={packageDimensions.height}
                                    onChange={(e) => setPackageDimensions({ ...packageDimensions, height: parseInt(e.target.value) })}
                                    className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-muted-foreground">Larg (cm)</label>
                                <input
                                    type="number"
                                    value={packageDimensions.width}
                                    onChange={(e) => setPackageDimensions({ ...packageDimensions, width: parseInt(e.target.value) })}
                                    className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-muted-foreground">Comp (cm)</label>
                                <input
                                    type="number"
                                    value={packageDimensions.length}
                                    onChange={(e) => setPackageDimensions({ ...packageDimensions, length: parseInt(e.target.value) })}
                                    className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background"
                                />
                            </div>
                        </div>

                        {options.length === 0 ? (
                            <Button
                                className="w-full h-9"
                                variant="outline"
                                onClick={handleCalculate}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
                                1. Calcular Opções
                            </Button>
                        ) : (
                            <Button
                                className="w-full h-9"
                                variant="ghost"
                                size="sm"
                                onClick={() => setOptions([])}
                                disabled={loading}
                            >
                                Recalcular
                            </Button>
                        )}
                    </div>
                )}

                {options.length > 0 && !labelId && (
                    <div className="space-y-2 border-t pt-4">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">2. Escolha o Serviço</p>
                        <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-1">
                            {options.map((opt) => (
                                <div
                                    key={opt.id}
                                    onClick={() => setSelectedOption(opt)}
                                    className={cn(
                                        "p-2 rounded-lg border-2 cursor-pointer transition-all hover:border-primary/50",
                                        selectedOption?.id === opt.id ? "border-primary bg-primary/5" : "border-border"
                                    )}
                                >
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="font-bold">{opt.name}</span>
                                        <span className="font-black text-primary">R$ {opt.price}</span>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground italic">Envio em {opt.delivery_time} dias</p>
                                </div>
                            ))}
                        </div>
                        <Button
                            className="w-full mt-2"
                            onClick={handleCreateLabel}
                            disabled={loading || !selectedOption}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PackageOpen className="h-4 w-4 mr-2" />}
                            3. Gerar Etiqueta
                        </Button>
                    </div>
                )}

                {labelId && (
                    <div className="space-y-2">
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
                            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">ID da Etiqueta</p>
                            <p className="text-sm font-mono font-bold">#{labelId}</p>
                        </div>

                        {status === 'cart' && (
                            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleCheckout} disabled={loading}>
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
                                Pagar e Emitir Etiqueta
                            </Button>
                        )}

                        {(status === 'released' || status === 'printed') && (
                            <Button className="w-full" variant="secondary" onClick={handleDownload} disabled={loading}>
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                                Imprimir Etiqueta (PDF)
                            </Button>
                        )}

                        {labelUrl && (
                            <a
                                href={labelUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-center gap-2 text-[10px] font-bold text-primary hover:underline mt-1"
                            >
                                Abrir PDF em nova aba <ExternalLink className="h-3 w-3" />
                            </a>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
