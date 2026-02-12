import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, Loader2, CreditCard, Download, PackageOpen, ExternalLink, ChevronDown, ChevronUp, Zap, Sparkles, MapPin, User, Search } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import { showError, showSuccess } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { useClientes } from '@/hooks/useDataFetch';
import { Cliente } from '@/types/cliente';
import { WalletRechargeModal } from './WalletRechargeModal';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

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
    arrival_date?: string;
}

interface ShippingSectionProps {
    pedidoId?: string;
    clientId?: string;
    clientAddress?: string;
    clientName?: string;
    orderNumber?: number;
    valorTotal?: number;
    initialLabelId?: string;
    initialStatus?: string;
    shipping_cep?: string;
}

export const ShippingSection: React.FC<ShippingSectionProps> = ({
    pedidoId,
    clientId,
    clientAddress,
    clientName,
    orderNumber,
    valorTotal,
    initialLabelId,
    initialStatus,
    shipping_cep
}) => {
    const { companyProfile, refetch } = useCompanyProfile();
    const [showRechargeModal, setShowRechargeModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [options, setOptions] = useState<ShippingOption[]>([]);
    const [selectedOption, setSelectedOption] = useState<ShippingOption | null>(null);
    const [labelId, setLabelId] = useState<string | undefined>(initialLabelId);
    const [status, setStatus] = useState<string | undefined>(initialStatus);
    const [labelUrl, setLabelUrl] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [manualCEP, setManualCEP] = useState("");
    const [manualDestName, setManualDestName] = useState("");
    const [manualDestAddress, setManualDestAddress] = useState("");
    const [manualDestNumber, setManualDestNumber] = useState("");
    const [manualDestDistrict, setManualDestDistrict] = useState("");
    const [manualDestCity, setManualDestCity] = useState("");
    const [manualDestState, setManualDestState] = useState("");
    const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
    const [isClientPopoverOpen, setIsClientPopoverOpen] = useState(false);
    const { data: clientes } = useClientes();
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
            const cep = extractCEP(clientAddress);
            setManualCEP(cep);
            // Se o CEP foi extraído automaticamente, tenta calcular direto
            if (cep.length === 8) {
                setTimeout(() => handleCalculate(cep), 500);
            }
        }
    }, [clientAddress]);

    useEffect(() => {
        if (clientId && clientes && clientes.length > 0) {
            const cliente = clientes.find(c => c.id === clientId);
            if (cliente) {
                console.log("[ShippingSection] Pré-preenchendo dados do cliente:", cliente);
                setSelectedClient(cliente);
                setManualDestName(cliente.nome);

                // Ordem de prioridade para o CEP:
                // 1. CEP salvo especificamente no pedido (shipping_cep)
                // 2. Campo CEP do cadastro do cliente
                // 3. Extrair do endereço do cliente
                if (shipping_cep) {
                    setManualCEP(shipping_cep.replace(/\D/g, ''));
                } else if (cliente.cep) {
                    setManualCEP(cliente.cep.replace(/\D/g, ''));
                } else if (cliente.endereco) {
                    const extractedCEP = extractCEP(cliente.endereco);
                    if (extractedCEP) setManualCEP(extractedCEP);
                }

                if (cliente.endereco) {
                    // Tenta quebrar o endereço se possível
                    const parts = cliente.endereco.split(',');
                    if (parts.length > 0) setManualDestAddress(parts[0].trim());

                    const numberMatch = cliente.endereco.match(/,\s*(\d+)/);
                    if (numberMatch) setManualDestNumber(numberMatch[1]);

                    const stateMatch = cliente.endereco.match(/([A-Z]{2})\s*$/);
                    if (stateMatch) setManualDestState(stateMatch[1]);
                }
            }
        } else if (clientName && !manualDestName) {
            setManualDestName(clientName);
        }
    }, [clientId, clientes, clientName, shipping_cep]);

    // Calcular frete automaticamente se o CEP for preenchido via clientId
    useEffect(() => {
        if (manualCEP && manualCEP.length === 8 && options.length === 0 && !loading) {
            handleCalculate(manualCEP);
        }
    }, [manualCEP]);

    const handleSelectClient = (cliente: Cliente) => {
        setSelectedClient(cliente);
        setManualDestName(cliente.nome);

        if (cliente.endereco) {
            const cep = extractCEP(cliente.endereco);
            if (cep) {
                setManualCEP(cep);
                handleCalculate(cep);
            }

            // Tenta quebrar o endereço se possível (assumindo formato Rua, Numero - Bairro, Cidade - UF)
            const parts = cliente.endereco.split(',');
            if (parts.length > 0) setManualDestAddress(parts[0].trim());

            // Busca o número
            const numberMatch = cliente.endereco.match(/,\s*(\d+)/);
            if (numberMatch) setManualDestNumber(numberMatch[1]);

            // Busca UF (final do endereço geralmente)
            const stateMatch = cliente.endereco.match(/([A-Z]{2})\s*$/);
            if (stateMatch) setManualDestState(stateMatch[1]);
        }
        setIsClientPopoverOpen(false);
    };

    const handleCalculate = async (targetCEP?: string) => {
        const cepToUse = targetCEP || manualCEP;
        if (!cepToUse || cepToUse.length < 8) {
            showError("Por favor, insira um CEP de destino válido.");
            return;
        }

        const originCEP = companyProfile?.company_address_zip?.replace(/\D/g, '') || "04571010"; // Fallback se não houver no perfil
        const destinationCEP = cepToUse.replace(/\D/g, '');

        console.log("[ShippingSection] Calculando frete:", { originCEP, destinationCEP, packageDimensions });
        setLoading(true);
        try {
            const token = await getValidToken();
            const payload = {
                action: 'calculate',
                params: {
                    from: { postal_code: originCEP },
                    to: { postal_code: destinationCEP },
                    package: packageDimensions,
                    services: "1,2,17" // PAC, SEDEX, Mini Envios
                }
            };
            console.log("[ShippingSection] Payload enviado:", payload);

            const response = await fetch(`${SUPABASE_URL}/functions/v1/superfrete-proxy`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            console.log("[ShippingSection] Resposta recebida:", data);

            if (data.error) {
                console.error("[ShippingSection] Erro detalhado:", data);
                let errorMessage = data.message || "Erro desconhecido no cálculo";
                if (data.details?.errors) {
                    const errorDetails = Object.entries(data.details.errors)
                        .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
                        .join(' | ');
                    errorMessage += ` (${errorDetails})`;
                }
                throw new Error(errorMessage);
            }

            // Ordenar por preço
            const sorted = Array.isArray(data) ? [...data].sort((a, b) => parseFloat(a.price) - parseFloat(b.price)) : [];
            setOptions(sorted);

            if (sorted.length > 0) {
                setSelectedOption(sorted[0]);
                showSuccess(`${sorted.length} opções de frete encontradas.`);
            }
        } catch (error: any) {
            showError(`Erro ao calcular frete: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLabel = async () => {
        if (!selectedOption || !manualCEP) return;

        // Segurança: Verificar saldo antes de tentar criar
        const price = parseFloat(selectedOption.price);
        const balance = companyProfile?.wallet_balance || 0;

        if (balance < price) {
            showError(`Saldo insuficiente. Você tem ${formatCurrency(balance)} mas a etiqueta custa ${formatCurrency(price)}.`);
            setShowRechargeModal(true);
            return;
        }

        setLoading(true);
        try {
            const token = await getValidToken();
            const payload = {
                action: 'cart',
                params: {
                    from: {
                        name: companyProfile?.company_name || "DIRECT AI",
                        postal_code: (companyProfile?.company_address_zip || "04571010").replace(/\D/g, ''),
                        address: companyProfile?.company_address_street || "Av. Pres. Juscelino Kubitschek",
                        number: companyProfile?.company_address_number || "50",
                        district: companyProfile?.company_address_neighborhood || "Vila Nova Conceição",
                        city: companyProfile?.company_address_city || "São Paulo",
                        state_abbr: companyProfile?.company_address_state || "SP"
                    },
                    to: {
                        name: manualDestName || clientName || "Cliente",
                        postal_code: (manualCEP || "").replace(/\D/g, ''),
                        address: manualDestAddress || (clientAddress && clientAddress.split(',')[0]) || "Endereço não informado",
                        number: manualDestNumber || "S/N",
                        district: manualDestDistrict || "Bairro",
                        city: manualDestCity || "Cidade",
                        state_abbr: manualDestState || "UF"
                    },
                    service: selectedOption.id,
                    volumes: [packageDimensions], // Correção: v0/cart espera um array 'volumes'
                    options: { non_commercial: true }
                }
            };
            console.log("[ShippingSection] Payload Criar Etiqueta:", payload);

            const response = await fetch(`${SUPABASE_URL}/functions/v1/superfrete-proxy`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            console.log("[ShippingSection] Resposta Criar Etiqueta:", data);

            if (data.error) {
                console.error("[ShippingSection] Erro detalhado (Label):", data);
                let errorMessage = data.message || "Erro no checkout";
                if (data.details?.errors) {
                    const errorDetails = Object.entries(data.details.errors)
                        .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
                        .join(' | ');
                    errorMessage += ` (${errorDetails})`;
                }
                throw new Error(errorMessage);
            }

            setLabelId(data.id);
            setStatus(data.status);

            // Salvar no pedido
            const { supabase } = await import('@/integrations/supabase/client');

            // Se for cotação direta por checkout, já temos o tracking_code?
            // A API de cart às vezes retorna tracking_code se já estiver disponível, 
            // mas geralmente é só após o checkout. No entanto, o label_id é essencial.

            await supabase
                .from('pedidos')
                .update({
                    shipping_label_id: data.id,
                    shipping_label_status: data.status,
                    valor_frete: parseFloat(data.price),
                    transportadora: selectedOption.name,
                    tipo_entrega: 'frete'
                })
                .eq('id', pedidoId);

            showSuccess("Etiqueta gerada! Agora você pode emitir o pagamento.");

            // PERSISTÊNCIA: Se o CEP ou Endereço do cliente mudou/foi preenchido agora, salva no registro dele
            if (clientId) {
                const currentCEP = (manualCEP || "").replace(/\D/g, '');
                const currentAddressSnippet = manualDestAddress;

                // Só atualiza se tiver dados úteis e for diferente do que já tínhamos
                if (currentCEP && (selectedClient?.cep !== currentCEP || selectedClient?.endereco !== manualDestAddress)) {
                    console.log("[ShippingSection] Atualizando dados de envio do cliente...");
                    await supabase
                        .from('clientes')
                        .update({
                            cep: currentCEP,
                            endereco: `${manualDestAddress}${manualDestNumber ? `, ${manualDestNumber}` : ''}${manualDestDistrict ? ` - ${manualDestDistrict}` : ''}`
                        })
                        .eq('id', clientId);
                }
            }
        } catch (error: any) {
            showError(`Erro ao criar etiqueta: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckout = async () => {
        if (!labelId || !selectedOption) return;

        // Segurança Extra: Verificar saldo novamente antes de emitir
        const price = parseFloat(selectedOption.price);
        const balance = companyProfile?.wallet_balance || 0;

        if (balance < price) {
            showError("Saldo insuficiente para emitir a etiqueta. Por favor, recarregue.");
            setShowRechargeModal(true);
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
                    action: 'checkout',
                    params: {
                        id: labelId,
                        price: parseFloat(selectedOption.price)
                    }
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.message);

            setStatus(data.status);

            // Refresh balance after purchase
            refetch();

            // Atualizar pedido (apenas se existir)
            if (pedidoId) {
                const { supabase } = await import('@/integrations/supabase/client');

                // Buscar detalhes do tracking se disponíveis logo após checkout
                // Em alguns casos o tracking só aparece no tracking-label
                let trackingCode = data.tracking_code || data.tracking;

                await supabase
                    .from('pedidos')
                    .update({
                        shipping_label_status: data.status,
                        status: 'enviado',
                        tracking_code: trackingCode || null
                    })
                    .eq('id', pedidoId);

                // Tenta buscar o link da etiqueta/rastreio para registrar
                try {
                    const trackingResponse = await fetch(`${SUPABASE_URL}/functions/v1/superfrete-proxy`, {
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
                    const trackingData = await trackingResponse.json();
                    if (!trackingData.error && trackingData.tracking_code) {
                        await supabase
                            .from('pedidos')
                            .update({ tracking_code: trackingData.tracking_code })
                            .eq('id', pedidoId);
                    }
                } catch (err) {
                    console.warn("Falha ao buscar tracking code imediato", err);
                }
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

    const bestPriceId = options.length > 0 ? options[0].id : null;
    const fastestOptionId = options.length > 0 ? [...options].sort((a, b) => a.delivery_time - b.delivery_time)[0].id : null;

    return (
        <Card className="border-primary/20 shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
            <CardHeader className="bg-primary/5 py-3 border-b border-primary/10">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <div className="bg-primary/10 p-1.5 rounded-md">
                        <Truck className="h-4 w-4 text-primary" />
                    </div>
                    Logística "Bum" (Instantânea)
                    {status && (
                        <Badge variant="outline" className="ml-auto bg-white text-[10px] uppercase font-bold border-primary/20">
                            {status === 'cart' ? 'Aguardando Pagamento' : status}
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                {/* Wallet Balance Widget */}
                <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/10">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg">
                            <CreditCard className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">Saldo em Carteira</p>
                            <p className="text-lg font-black text-primary leading-none mt-0.5">
                                {companyProfile ? formatCurrency(companyProfile.wallet_balance || 0) : 'R$ 0,00'}
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRechargeModal(true)}
                        className="h-8 text-[11px] font-bold gap-1.5 border-primary/20 hover:bg-primary hover:text-white transition-all rounded-lg"
                    >
                        <Zap className="h-3.5 w-3.5" /> Recarregar
                    </Button>
                </div>

                {!labelId && (
                    <div className="space-y-4">
                        {/* Seletor de Cliente para Auto-preenchimento */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase text-muted-foreground flex items-center gap-1">
                                Selecionar Cliente (Opcional)
                                <User className="h-3 w-3" />
                            </label>
                            <Popover open={isClientPopoverOpen} onOpenChange={setIsClientPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isClientPopoverOpen}
                                        className="w-full justify-between h-11 rounded-xl border-2 border-primary/10 bg-background/50 font-bold"
                                    >
                                        {selectedClient ? selectedClient.nome : "Buscar cliente..."}
                                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Digite o nome do cliente..." />
                                        <CommandList>
                                            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                                            <CommandGroup>
                                                {clientes?.map((cliente) => (
                                                    <CommandItem
                                                        key={cliente.id}
                                                        value={cliente.nome}
                                                        onSelect={() => handleSelectClient(cliente)}
                                                        className="font-bold cursor-pointer"
                                                    >
                                                        <User className="mr-2 h-4 w-4" />
                                                        {cliente.nome}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* CEP Input - O Coração da Cotação */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase text-muted-foreground flex items-center gap-1">
                                CEP de Destino
                                <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                                    <input
                                        type="text"
                                        placeholder="00000-000"
                                        value={manualCEP}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                                            setManualCEP(val);
                                            if (val.length === 8) handleCalculate(val);
                                        }}
                                        className="w-full h-11 pl-10 pr-3 text-base font-bold rounded-xl border-2 border-primary/10 bg-background focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                                    />
                                </div>
                                <Button
                                    className="h-11 rounded-xl px-6 font-bold shadow-lg shadow-primary/20"
                                    onClick={() => handleCalculate()}
                                    disabled={loading || manualCEP.length < 8}
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Cotar"}
                                </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground/70 italic px-1">
                                Calculando de: <b>{(companyProfile?.company_address_zip || "04571010").replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2')}</b> • Para: <b>{manualCEP.replace(/(\d{5})(\d{3})/, '$1-$2')}</b> • Peso: <b>{packageDimensions.weight}kg</b>
                            </p>
                        </div>

                        {/* Opções Avançadas */}
                        <div className="border border-dashed border-primary/10 rounded-lg overflow-hidden">
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="w-full px-3 py-2 flex items-center justify-between text-[11px] font-bold text-muted-foreground bg-primary/5 hover:bg-primary/10 transition-colors"
                            >
                                <span className="flex items-center gap-1.5 uppercase tracking-wider">
                                    <PackageOpen className="h-3.5 w-3.5" />
                                    Opções do Pacote
                                </span>
                                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>

                            {showAdvanced && (
                                <div className="p-3 bg-white/50 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase">Peso (kg)</Label>
                                            <Input
                                                type="number"
                                                step="0.1"
                                                value={packageDimensions.weight}
                                                onChange={(e) => setPackageDimensions({ ...packageDimensions, weight: parseFloat(e.target.value) })}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase">Altura (cm)</Label>
                                            <Input
                                                type="number"
                                                value={packageDimensions.height}
                                                onChange={(e) => setPackageDimensions({ ...packageDimensions, height: parseInt(e.target.value) })}
                                                className="h-9"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase">Largura (cm)</Label>
                                            <Input
                                                type="number"
                                                value={packageDimensions.width}
                                                onChange={(e) => setPackageDimensions({ ...packageDimensions, width: parseInt(e.target.value) })}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase">Comprimento (cm)</Label>
                                            <Input
                                                type="number"
                                                value={packageDimensions.length}
                                                onChange={(e) => setPackageDimensions({ ...packageDimensions, length: parseInt(e.target.value) })}
                                                className="h-9"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase">Nome do Destinatário</Label>
                                        <Input
                                            type="text"
                                            placeholder="Para quem enviar?"
                                            value={manualDestName}
                                            onChange={(e) => setManualDestName(e.target.value)}
                                            className="h-9"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Lista de Opções Estilo SuperFrete */}
                {options.length > 0 && !labelId && (
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between px-1">
                            <p className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">Opções de Frete</p>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setOptions([])}>Limpar</Button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                            {options.map((opt) => (
                                <div
                                    key={opt.id}
                                    onClick={() => setSelectedOption(opt)}
                                    className={cn(
                                        "group relative p-4 rounded-xl border-2 transition-all cursor-pointer active:scale-[0.98]",
                                        selectedOption?.id === opt.id
                                            ? "border-primary bg-primary/5 shadow-inner"
                                            : "border-border hover:border-primary/40 hover:bg-white"
                                    )}
                                >
                                    {/* Badges Flutuantes */}
                                    <div className="absolute -top-2 right-4 flex gap-1">
                                        {opt.id === bestPriceId && (
                                            <Badge className="bg-green-500 hover:bg-green-600 border-none h-5 text-[9px] font-bold uppercase py-0 px-2 rounded-full shadow-sm">
                                                <Sparkles className="h-2.5 w-2.5 mr-1" /> Melhor Preço
                                            </Badge>
                                        )}
                                        {opt.id === fastestOptionId && opt.id !== bestPriceId && (
                                            <Badge className="bg-blue-500 hover:bg-blue-600 border-none h-5 text-[9px] font-bold uppercase py-0 px-2 rounded-full shadow-sm">
                                                <Zap className="h-2.5 w-2.5 mr-1" /> Mais Rápido
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    opt.name.toLowerCase().includes('pac') ? "bg-yellow-400" :
                                                        opt.name.toLowerCase().includes('sedex') ? "bg-blue-500" : "bg-red-500"
                                                )} />
                                                <span className="font-bold text-sm tracking-tight">{opt.name}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[11px] text-muted-foreground font-medium">Prazo: {opt.delivery_time} dias úteis</span>
                                                {opt.arrival_date && (
                                                    <span className="text-[9px] text-muted-foreground italic">Entrega estimada: {new Date(opt.arrival_date).toLocaleDateString('pt-BR')}</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="text-right flex flex-col items-end">
                                            <span className="text-lg font-black text-primary leading-none">R$ {opt.price}</span>
                                            {opt.discount && parseFloat(opt.discount) > 0 && (
                                                <span className="text-[10px] text-muted-foreground line-through decoration-red-400/50">R$ {(parseFloat(opt.price) + parseFloat(opt.discount)).toFixed(2)}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Seleção Visual */}
                                    <div className={cn(
                                        "mt-3 h-1 w-full rounded-full transition-all",
                                        selectedOption?.id === opt.id ? "bg-primary opacity-100" : "bg-primary/5 opacity-0 group-hover:opacity-100"
                                    )} />
                                </div>
                            ))}
                        </div>

                        {/* Dados Refinados do Destinatário - Aparece apenas após selecionar um serviço */}
                        {selectedOption && (
                            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                <p className="text-[11px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                    <Sparkles className="h-3.5 w-3.5" /> Detalhes do Destino
                                </p>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Nome Completo</Label>
                                        <Input
                                            placeholder="Nome do Cliente"
                                            value={manualDestName}
                                            onChange={(e) => setManualDestName(e.target.value)}
                                            className="h-9 bg-background/50 border-primary/10 focus:border-primary/30"
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="col-span-2 space-y-1">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Endereço</Label>
                                            <Input
                                                placeholder="Rua, Av..."
                                                value={manualDestAddress}
                                                onChange={(e) => setManualDestAddress(e.target.value)}
                                                className="h-9 bg-background/50 border-primary/10"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Nº</Label>
                                            <Input
                                                placeholder="123"
                                                value={manualDestNumber}
                                                onChange={(e) => setManualDestNumber(e.target.value)}
                                                className="h-9 bg-background/50 border-primary/10"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Bairro</Label>
                                            <Input
                                                placeholder="Bairro"
                                                value={manualDestDistrict}
                                                onChange={(e) => setManualDestDistrict(e.target.value)}
                                                className="h-9 bg-background/50 border-primary/10"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cidade</Label>
                                            <Input
                                                placeholder="Cidade"
                                                value={manualDestCity}
                                                onChange={(e) => setManualDestCity(e.target.value)}
                                                className="h-9 bg-background/50 border-primary/10"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">UF</Label>
                                            <Input
                                                placeholder="SP"
                                                maxLength={2}
                                                value={manualDestState}
                                                onChange={(e) => setManualDestState(e.target.value.toUpperCase())}
                                                className="h-9 bg-background/50 border-primary/10"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    className="w-full h-12 mt-4 rounded-xl font-black text-sm uppercase tracking-wider shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.98]"
                                    onClick={handleCreateLabel}
                                    disabled={loading || !selectedOption}
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <PackageOpen className="h-5 w-5 mr-2" />}
                                    Reservar Etiqueta Agora
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Label Status / Emission Flow */}
                {labelId && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] uppercase font-black text-muted-foreground mb-0.5">Etiqueta Reservada</p>
                                <p className="text-lg font-mono font-bold text-primary">#{labelId}</p>
                            </div>
                            <Truck className="h-8 w-8 text-zinc-300 animate-bounce" />
                        </div>

                        {status === 'cart' && (
                            <Button
                                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-200"
                                onClick={handleCheckout}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CreditCard className="h-5 w-5 mr-2" />}
                                Pagar e Emitir Etiqueta
                            </Button>
                        )}

                        {(status === 'released' || status === 'printed') && (
                            <Button className="w-full h-12 rounded-xl font-bold" variant="secondary" onClick={handleDownload} disabled={loading}>
                                {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Download className="h-5 w-5 mr-2" />}
                                Imprimir Etiqueta (PDF)
                            </Button>
                        )}

                        {labelUrl && (
                            <a
                                href={labelUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-primary hover:underline"
                            >
                                <ExternalLink className="h-4 w-4" /> Abrir PDF em nova aba
                            </a>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-[10px] text-muted-foreground opacity-50 hover:opacity-100"
                            onClick={() => {
                                setLabelId(undefined);
                                setOptions([]);
                                setManualCEP("");
                            }}
                        >
                            Voltar e Novo Frete
                        </Button>
                    </div>
                )}
            </CardContent>

            <WalletRechargeModal
                open={showRechargeModal}
                onOpenChange={setShowRechargeModal}
                currentBalance={companyProfile?.wallet_balance || 0}
            />
        </Card>
    );
};
