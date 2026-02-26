import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, Loader2, CreditCard, Download, PackageOpen, ExternalLink, ChevronDown, ChevronUp, Zap, Sparkles, MapPin, User, Search, CheckCircle2, Copy, Clock, Filter } from 'lucide-react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const BRAZILIAN_STATES = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

interface ShippingOption {
    id: string | number;
    name: string;
    price: string;
    discount: string;
    delivery_time: number;
    arrival_date?: string;
    provider: 'superfrete' | 'frenet';
    carrier_logo?: string;
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
    const [labelProvider, setLabelProvider] = useState<'superfrete' | 'frenet' | null>(null);
    const [status, setStatus] = useState<string | undefined>(initialStatus);
    const [labelUrl, setLabelUrl] = useState<string | null>(null);
    const [trackingCode, setTrackingCode] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [manualCEP, setManualCEP] = useState("");
    const [manualDestName, setManualDestName] = useState("");
    const [manualDestAddress, setManualDestAddress] = useState("");
    const [manualDestNumber, setManualDestNumber] = useState("");
    const [manualDestDistrict, setManualDestDistrict] = useState("");
    const [manualDestCity, setManualDestCity] = useState("");
    const [manualDestState, setManualDestState] = useState("");
    const [manualDestComplement, setManualDestComplement] = useState("");
    const [addressAutoFilled, setAddressAutoFilled] = useState(false);
    const [loadingCEP, setLoadingCEP] = useState(false);
    const lastViaCEPLookup = useRef("");
    const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
    const [isClientPopoverOpen, setIsClientPopoverOpen] = useState(false);
    const { data: clientes } = useClientes();
    const [packageDimensions, setPackageDimensions] = useState({
        weight: 0.5,
        height: 2,
        width: 25,
        length: 35
    });

    useEffect(() => {
        // Forçar atualização do saldo ao abrir o modal
        refetch();

        // Se já existe uma etiqueta vinculada, buscar os detalhes dela (como PDF e tracking)
        const fetchExistingLabel = async () => {
            if (initialLabelId) {
                try {
                    const token = await getValidToken();
                    const response = await fetch(`${SUPABASE_URL}/rest/v1/shipping_labels?id=eq.${initialLabelId}&select=*`, {
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    const data = await response.json();
                    if (data && data.length > 0) {
                        const label = data[0];
                        console.log("[ShippingSection] Etiqueta existente encontrada:", label);
                        if (label.pdf_url) setLabelUrl(label.pdf_url);
                        if (label.status) setStatus(label.status);
                        if (label.tracking_code) setTrackingCode(label.tracking_code);
                        if (label.provider) setLabelProvider(label.provider as any);
                    }
                } catch (err) {
                    console.error("[ShippingSection] Erro ao buscar etiqueta existente:", err);
                }
            }
        };

        fetchExistingLabel();
    }, [initialLabelId]);

    // Extrair CEP do endereço (Regex simples)
    const extractCEP = (address: string) => {
        if (!address) return "";
        const match = address.match(/\d{5}-?\d{3}/);
        return match ? match[0].replace('-', '') : "";
    };

    // Auto-preenchimento de endereço via ViaCEP
    const fetchAddressFromCEP = async (cep: string) => {
        const cleanCEP = cep.replace(/\D/g, '');
        if (cleanCEP.length !== 8 || lastViaCEPLookup.current === cleanCEP) return;
        lastViaCEPLookup.current = cleanCEP;
        setLoadingCEP(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
            const data = await response.json();
            if (!data.erro) {
                console.log("[ShippingSection] ViaCEP retornou:", data);
                if (data.logradouro) setManualDestAddress(data.logradouro);
                if (data.bairro) setManualDestDistrict(data.bairro);
                if (data.localidade) setManualDestCity(data.localidade);
                if (data.uf && BRAZILIAN_STATES.includes(data.uf)) setManualDestState(data.uf);
                if (data.complemento) setManualDestComplement(data.complemento);
                setAddressAutoFilled(true);
                // Foca no campo Número que é o que o user precisa digitar
                setTimeout(() => {
                    const numInput = document.getElementById('dest-number-input');
                    if (numInput) numInput.focus();
                }, 100);
            } else {
                console.log("[ShippingSection] CEP não encontrado no ViaCEP");
                setAddressAutoFilled(false);
            }
        } catch (err) {
            console.error("[ShippingSection] Erro ViaCEP:", err);
            setAddressAutoFilled(false);
        } finally {
            setLoadingCEP(false);
        }
    };

    // Trigger ViaCEP quando o CEP muda
    useEffect(() => {
        const cleanCEP = manualCEP.replace(/\D/g, '');
        if (cleanCEP.length === 8) {
            fetchAddressFromCEP(cleanCEP);
        } else {
            setAddressAutoFilled(false);
        }
    }, [manualCEP]);

    useEffect(() => {
        if (clientAddress && !manualCEP) {
            const cep = extractCEP(clientAddress);
            setManualCEP(cep);
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
        if (manualCEP && manualCEP.length === 8 && options.length === 0 && !loading && !labelId) {
            handleCalculate(manualCEP);
        }
    }, [manualCEP, labelId]);

    const handleSelectClient = (cliente: Cliente) => {
        setSelectedClient(cliente);
        setManualDestName(cliente.nome);

        if (cliente.endereco) {
            const cep = extractCEP(cliente.endereco);
            if (cep) {
                setManualCEP(cep);
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

        const originCEP = companyProfile?.company_address_zip?.replace(/\D/g, '') || "04571010";
        const destinationCEP = cepToUse.replace(/\D/g, '');

        // Validação de dimensões mínimas
        const validatedPackage = {
            weight: packageDimensions.weight || 0.5,
            height: Math.max(packageDimensions.height || 0, 2),
            width: Math.max(packageDimensions.width || 0, 11),
            length: Math.max(packageDimensions.length || 0, 16)
        };

        console.log("[ShippingSection] Calculando frete multi-provedor:", { originCEP, destinationCEP, validatedPackage });
        setLoading(true);
        setOptions([]);

        try {
            const token = await getValidToken();

            const provider = companyProfile?.logistics_provider &&
                (companyProfile.logistics_provider === 'superfrete' || companyProfile.logistics_provider === 'frenet')
                ? companyProfile.logistics_provider
                : 'both';

            // 1. Promessa para SuperFrete (se provider 'superfrete' ou 'both')
            const superFretePromise = (provider === 'both' || provider === 'superfrete')
                ? fetch(`${SUPABASE_URL}/functions/v1/superfrete-proxy`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'calculate',
                        params: {
                            from: { postal_code: originCEP },
                            to: { postal_code: destinationCEP },
                            package: validatedPackage,
                            services: "1,2,17"
                        }
                    })
                }).then(async res => {
                    const data = await res.json();
                    if (data.error && data.needs_config) return { sf_needs_config: true, ...data };
                    return data;
                })
                    .catch((err: any) => ({ error: true, message: `SuperFrete indisponível: ${err.message}` }))
                : Promise.resolve(null);

            // 2. Promessa para Frenet (se provider 'frenet' ou 'both')
            const frenetPromise = (provider === 'both' || provider === 'frenet')
                ? fetch(`${SUPABASE_URL}/functions/v1/frenet-proxy`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'calculate',
                        params: {
                            seller_cep: originCEP,
                            recipient_cep: destinationCEP,
                            invoice_value: valorTotal || 0,
                            items: [{
                                Weight: validatedPackage.weight,
                                Height: validatedPackage.height,
                                Width: validatedPackage.width,
                                Length: validatedPackage.length,
                                Quantity: 1
                            }]
                        }
                    })
                }).then(async res => {
                    const data = await res.json();
                    if (data.error && data.needs_config) return { fr_needs_config: true, ...data };
                    return data;
                })
                    .catch((err: any) => ({ error: true, message: `Frenet indisponível: ${err.message}` }))
                : Promise.resolve(null);

            // Executar em paralelo
            const [sfData, frData] = await Promise.all([superFretePromise, frenetPromise]);

            console.log("[ShippingSection] Provider selecionado:", provider);
            console.log("[ShippingSection] SuperFrete response:", sfData);
            console.log("[ShippingSection] Frenet response:", frData);

            let combinedOptions: ShippingOption[] = [];

            // Processar SuperFrete
            if (sfData && !sfData.error) {
                // SuperFrete pode retornar array direto ou objeto com dispatchers/data
                let sfOptions: any[] = [];
                if (Array.isArray(sfData)) {
                    sfOptions = sfData;
                } else if (Array.isArray(sfData.dispatchers)) {
                    sfOptions = sfData.dispatchers;
                } else if (Array.isArray(sfData.data)) {
                    sfOptions = sfData.data;
                }

                if (sfOptions.length > 0) {
                    combinedOptions = [
                        ...combinedOptions,
                        ...sfOptions.map((opt: any) => ({
                            id: opt.id,
                            name: opt.name,
                            price: opt.price,
                            discount: opt.discount || "0",
                            delivery_time: opt.delivery_time,
                            provider: 'superfrete' as const,
                            carrier_logo: opt.name.toLowerCase().includes('correios')
                                ? 'https://logodownload.org/wp-content/uploads/2014/05/correios-logo-1.png'
                                : opt.name.toLowerCase().includes('jadlog')
                                    ? 'https://logodownload.org/wp-content/uploads/2019/07/jadlog-logo.png'
                                    : undefined
                        }))
                    ];
                } else {
                    console.warn("[ShippingSection] SuperFrete retornou 0 opções. Data:", sfData);
                }
            } else if (sfData) {
                console.warn("[ShippingSection] SuperFrete retornou erro:", sfData);
            }

            // Processar Frenet
            if (frData && !frData.error && frData.ShippingSevicesArray) {
                combinedOptions = [
                    ...combinedOptions,
                    ...frData.ShippingSevicesArray
                        .filter((opt: any) => !opt.Error)
                        .map((opt: any) => ({
                            id: opt.ServiceCode,
                            name: opt.ServiceDescription,
                            price: String(opt.ShippingPrice).replace(',', '.'),
                            discount: "0",
                            delivery_time: parseInt(opt.DeliveryTime),
                            provider: 'frenet' as const,
                            carrier_logo: opt.Carrier === 'Correios'
                                ? 'https://logodownload.org/wp-content/uploads/2014/05/correios-logo-1.png'
                                : opt.Carrier === 'Jadlog'
                                    ? 'https://logodownload.org/wp-content/uploads/2019/07/jadlog-logo.png'
                                    : opt.Carrier === 'Loggi'
                                        ? 'https://logodownload.org/wp-content/uploads/2019/08/loggi-logo.png'
                                        : opt.Carrier?.toLowerCase().includes('j&t')
                                            ? 'https://upload.wikimedia.org/wikipedia/commons/4/4c/J%26T_Express_logo.png'
                                            : opt.Carrier?.toLowerCase().includes('imile')
                                                ? 'https://imile.com/wp-content/uploads/2021/04/imile-logo.png'
                                                : undefined
                        }))
                ];
            } else if (frData) {
                console.warn("[ShippingSection] Frenet retornou formato inesperado ou erro:", frData);
            }

            console.log("[ShippingSection] Opções combinadas:", combinedOptions.length);

            // Ordenar por preço
            const sorted = combinedOptions.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
            setOptions(sorted);

            if (sorted.length > 0) {
                setSelectedOption(sorted[0]);
                showSuccess(`${sorted.length} opções de frete encontradas.`);
            } else {
                // Montar mensagem de erro detalhada
                const errorParts: string[] = [];
                if (sfData?.error) {
                    if (sfData.sf_needs_config) {
                        console.log("[ShippingSection] SuperFrete requer configuração");
                    } else {
                        errorParts.push(`SuperFrete: ${sfData.message || 'erro desconhecido'}`);
                    }
                }
                if (frData?.error) {
                    if (frData.fr_needs_config) {
                        console.log("[ShippingSection] Frenet requer configuração");
                    } else {
                        errorParts.push(`Frenet: ${frData.message || 'erro desconhecido'}`);
                    }
                }

                if (errorParts.length > 0) {
                    showError(errorParts.join(' | '));
                } else if ((sfData?.sf_needs_config || !superFretePromise) && (frData?.fr_needs_config || !frenetPromise)) {
                    showError("Configuração logística pendente. Acesse Configurações > Logística para ativar.");
                } else {
                    showError("Nenhuma opção de frete disponível para este destino com as dimensões informadas.");
                }
            }
        } catch (error: any) {
            console.error("[ShippingSection] Erro no cálculo:", error);
            showError("Falha ao comunicar com os serviços de frete.");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLabel = async () => {
        if (!selectedOption || !manualCEP) return;

        const price = parseFloat(selectedOption.price);
        const provider = selectedOption.provider;

        // Para SuperFrete: verificar saldo local antes de tentar criar
        // Para Frenet: a verificação de saldo é feita pela própria API da Frenet
        if (provider !== 'frenet') {
            const balance = companyProfile?.wallet_balance || 0;
            if (balance < price) {
                showError(`Saldo insuficiente na carteira SuperFrete. Você tem ${formatCurrency(balance)} mas a etiqueta custa ${formatCurrency(price)}.`);
                setShowRechargeModal(true);
                return;
            }
        }

        setLoading(true);
        const providerSlug = selectedOption.provider === 'frenet' ? 'frenet' : 'superfrete';
        const proxy = `${providerSlug}-proxy`;

        try {
            const token = await getValidToken();
            const payload = {
                action: 'cart',
                params: {
                    recipient_name: manualDestName,
                    service_name: selectedOption.name,
                    pedido_id: pedidoId,
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
                        state_abbr: manualDestState || "UF",
                        complement: manualDestComplement
                    },
                    invoice_value: valorTotal || 1,
                    service: selectedOption.id,
                    volumes: [{
                        weight: packageDimensions.weight || 0.5,
                        height: Math.max(packageDimensions.height || 0, 2),
                        width: Math.max(packageDimensions.width || 0, 11),
                        length: Math.max(packageDimensions.length || 0, 16)
                    }],
                    options: { non_commercial: true }
                }
            };
            console.log(`[ShippingSection] Creating label via ${proxy}:`, payload);

            const response = await fetch(`${SUPABASE_URL}/functions/v1/${proxy}`, {
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
                // Se for Frenet, mostrar mensagem amigável sobre saldo
                if (provider === 'frenet') {
                    showError('Não foi possível gerar a etiqueta. Confira se sua carteira no Frenet tem saldo suficiente.');
                    window.open('https://painel.frenet.com.br', '_blank');
                    setLoading(false);
                    return;
                }
                throw new Error(errorMessage);
            }

            setLabelId(data.id);
            setLabelProvider(selectedOption.provider);
            setStatus(data.status);

            // Salvar no pedido
            const { supabase } = await import('@/integrations/supabase/client');

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

        const price = parseFloat(selectedOption.price);
        const provider = selectedOption.provider;

        // Para SuperFrete: verificar saldo local antes de emitir
        // Para Frenet: a verificação é feita pela API da Frenet
        if (provider !== 'frenet') {
            const balance = companyProfile?.wallet_balance || 0;
            if (balance < price) {
                showError(`Saldo insuficiente na carteira SuperFrete para emitir a etiqueta. Por favor, recarregue.`);
                setShowRechargeModal(true);
                return;
            }
        }

        setLoading(true);
        const providerSlug = selectedOption.provider === 'frenet' ? 'frenet' : 'superfrete';
        const proxy = `${providerSlug}-proxy`;

        try {
            const token = await getValidToken();
            const response = await fetch(`${SUPABASE_URL}/functions/v1/${proxy}`, {
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
                        price: parseFloat(selectedOption.price),
                        pedido_id: pedidoId,
                        recipient_name: manualDestName,
                        service_name: selectedOption.name
                    }
                })
            });

            const data = await response.json();
            if (data.error) {
                // Se for Frenet, mostrar mensagem amigável sobre saldo
                if (provider === 'frenet') {
                    showError('Não foi possível emitir a etiqueta. Confira se sua carteira no Frenet tem saldo suficiente.');
                    window.open('https://painel.frenet.com.br', '_blank');
                    setLoading(false);
                    return;
                }
                const detailsStr = data.details ? (typeof data.details === 'object' ? JSON.stringify(data.details) : String(data.details)) : '';
                throw new Error(`${data.message}${detailsStr ? ` (${detailsStr})` : ''}`);
            }

            // A API pode retornar um objeto ou um array com o link
            const result = Array.isArray(data) ? data[0] : data;
            const pdfUrl = result.pdf || result.url;

            setStatus('released');
            if (pdfUrl) {
                setLabelUrl(pdfUrl);
            }

            // Refresh balance after purchase
            refetch();

            const trackingCode = data.tracking_code || data.tracking;

            // Atualizar pedido (apenas se existir)
            if (pedidoId) {
                const { supabase } = await import('@/integrations/supabase/client');

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
                    const trackingResponse = await fetch(`${SUPABASE_URL}/functions/v1/${proxy}`, {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            action: 'tracking',
                            params: {
                                orders: [labelId],
                                id: labelId,
                                order_id: labelId
                            }
                        })
                    });
                    let trackingData;
                    const responseText = await trackingResponse.text();
                    try {
                        trackingData = JSON.parse(responseText);
                    } catch (e) {
                        const correiosMatch = responseText.match(/([A-Z]{2}\d{9}[A-Z]{2})/i);
                        const adiMatch = responseText.match(/(ADI\d{8,12}[A-Z]{0,2})/i);
                        const foundTracking = correiosMatch?.[0] || adiMatch?.[0];
                        if (foundTracking) {
                            trackingData = { tracking_code: foundTracking.toUpperCase() };
                        }
                    }

                    if (trackingData && !trackingData.error && trackingData.tracking_code) {
                        await supabase
                            .from('pedidos')
                            .update({ tracking_code: trackingData.tracking_code })
                            .eq('id', pedidoId);
                    }
                } catch (err) {
                    console.warn("Falha ao buscar tracking code imediato", err);
                }
            }

            // CRITICAL FIX: Ensure PDF URL and Tracking are saved to shipping_labels
            if (pdfUrl || trackingCode) {
                const { supabase } = await import('@/integrations/supabase/client');
                await supabase
                    .from('shipping_labels')
                    .update({
                        pdf_url: pdfUrl,
                        tracking_code: trackingCode,
                        status: 'released'
                    })
                    .eq('id', labelId);
            }

            showSuccess("Etiqueta emitida com sucesso!");
            setLoading(false);
        } catch (error: any) {
            showError(`Erro ao emitir etiqueta: ${error.message}`);
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!labelId) return;

        // SE já temos a URL (já veio do banco ou da geração), abre direto
        if (labelUrl) {
            window.open(labelUrl, '_blank');
            return;
        }

        setLoading(true);
        const currentProvider = labelProvider || selectedOption?.provider || 'superfrete';
        const proxy = currentProvider === 'frenet' ? 'frenet-proxy' : 'superfrete-proxy';

        try {
            const token = await getValidToken();
            const response = await fetch(`${SUPABASE_URL}/functions/v1/${proxy}`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'tracking',
                    params: currentProvider === 'superfrete'
                        ? { orders: [labelId] }
                        : { id: labelId }
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.message);

            const result = Array.isArray(data) ? data[0] : data;
            const url = result.pdf || result.url;

            if (!url) {
                throw new Error(`Aguardando geração do link do PDF pela ${currentProvider === 'frenet' ? 'Frenet' : 'SuperFrete'}...`);
            }

            setLabelUrl(url);
            window.open(url, '_blank');

            // CRITICAL FIX: Persist the fresh PDF URL to the database
            const { supabase } = await import('@/integrations/supabase/client');
            await supabase
                .from('shipping_labels')
                .update({ pdf_url: url })
                .eq('id', labelId);

        } catch (error: any) {
            showError(`Erro ao obter link: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const bestPrice = options.length > 0 ? options[0] : null;
    const fastestOption = options.length > 0 ? [...options].sort((a, b) => a.delivery_time - b.delivery_time)[0] : null;

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
                            {(status === 'cart' || status === 'pending') ? 'Aguardando Pagamento' : status}
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
                        {companyProfile?.logistics_provider === 'frenet' ? (
                            <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">
                                    Carteira Frenet
                                </p>
                                <p className="text-xs font-bold text-muted-foreground mt-0.5">
                                    Gerencie seu saldo diretamente no painel Frenet
                                </p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">
                                    Saldo SuperFrete
                                </p>
                                <p className="text-lg font-black text-primary leading-none mt-0.5">
                                    {companyProfile ? formatCurrency(companyProfile.wallet_balance || 0) : 'R$ 0,00'}
                                </p>
                            </div>
                        )}
                    </div>
                    {companyProfile?.logistics_provider === 'frenet' ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open('https://painel.frenet.com.br', '_blank')}
                            className="h-8 text-[11px] font-bold gap-1.5 border-primary/20 hover:bg-primary hover:text-white transition-all rounded-lg"
                        >
                            <ExternalLink className="h-3.5 w-3.5" /> Ver Saldo
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowRechargeModal(true)}
                            className="h-8 text-[11px] font-bold gap-1.5 border-primary/20 hover:bg-primary hover:text-white transition-all rounded-lg"
                        >
                            <Zap className="h-3.5 w-3.5" /> Recarregar
                        </Button>
                    )}
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
                                    key={`${opt.provider}-${opt.id}`}
                                    onClick={() => setSelectedOption(opt)}
                                    className={cn(
                                        "group relative p-4 rounded-xl border-2 transition-all cursor-pointer active:scale-[0.98] overflow-hidden",
                                        selectedOption?.id === opt.id && selectedOption?.provider === opt.provider
                                            ? "border-primary bg-primary/5 shadow-inner ring-4 ring-primary/5"
                                            : "border-border hover:border-primary/40 hover:bg-white"
                                    )}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    opt.name.toLowerCase().includes('pac') ? "bg-yellow-400" :
                                                        opt.name.toLowerCase().includes('sedex') ? "bg-blue-500" : "bg-red-500"
                                                )} />
                                                {opt.carrier_logo && (
                                                    <div className="h-6 w-6 mr-1 flex items-center justify-center">
                                                        <img
                                                            src={opt.carrier_logo}
                                                            alt=""
                                                            className="h-full w-full object-contain"
                                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                                        />
                                                    </div>
                                                )}
                                                <span className="font-bold text-sm tracking-tight line-clamp-1 max-w-[150px]">{opt.name}</span>

                                                {/* Logo do Provedor ao lado do nome */}
                                                <div className="h-4 w-10 bg-white border border-border rounded-md flex items-center justify-center p-0.5 shadow-xs overflow-hidden ml-1">
                                                    <img
                                                        src={opt.provider === 'superfrete' ? "/logo - superfrete.png" : "/logo - fre net.png"}
                                                        alt={opt.provider}
                                                        className="h-full w-full object-contain"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    Prazo: {opt.delivery_time} {opt.delivery_time === 1 ? 'dia útil' : 'dias úteis'}
                                                </span>
                                                {opt.arrival_date && (
                                                    <span className="text-[9px] text-muted-foreground italic">Entrega estimada: {new Date(opt.arrival_date).toLocaleDateString('pt-BR')}</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="text-right flex flex-col items-end">
                                            <span className="text-lg font-black text-primary leading-none">{formatCurrency(parseFloat(opt.price))}</span>
                                            {opt.discount && parseFloat(opt.discount) > 0 && (
                                                <Badge className="bg-green-500 hover:bg-green-600 text-[8px] h-3.5 px-1 font-black mt-1">
                                                    -{opt.discount}% OFF
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Seleção Visual */}
                                    <div className={cn(
                                        "mt-3 h-1 w-full rounded-full transition-all",
                                        selectedOption?.id === opt.id && selectedOption?.provider === opt.provider ? "bg-primary opacity-100" : "bg-primary/5 opacity-0 group-hover:opacity-100"
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
                                                id="dest-number-input"
                                                placeholder="123"
                                                value={manualDestNumber}
                                                onChange={(e) => setManualDestNumber(e.target.value)}
                                                className="h-9 bg-background/50 border-primary/10"
                                            />
                                        </div>
                                    </div>
                                    {addressAutoFilled && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold animate-in fade-in duration-300">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Endereço preenchido automaticamente via CEP
                                        </div>
                                    )}
                                    {loadingCEP && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-primary font-bold animate-pulse">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Buscando endereço...
                                        </div>
                                    )}
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Bairro</Label>
                                            <Input
                                                placeholder="Bairro"
                                                value={manualDestDistrict}
                                                onChange={(e) => setManualDestDistrict(e.target.value)}
                                                className={cn("h-9 bg-background/50 border-primary/10", addressAutoFilled && manualDestDistrict && "border-emerald-500/30")}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cidade</Label>
                                            <Input
                                                placeholder="Cidade"
                                                value={manualDestCity}
                                                onChange={(e) => setManualDestCity(e.target.value)}
                                                className={cn("h-9 bg-background/50 border-primary/10", addressAutoFilled && manualDestCity && "border-emerald-500/30")}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">UF</Label>
                                            <Select value={manualDestState} onValueChange={setManualDestState}>
                                                <SelectTrigger className={cn("h-9 bg-background/50 border-primary/10 text-xs", addressAutoFilled && manualDestState && "border-emerald-500/30")}>
                                                    <SelectValue placeholder="UF" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[200px]">
                                                    {BRAZILIAN_STATES.map((uf) => (
                                                        <SelectItem key={uf} value={uf} className="text-xs font-bold">
                                                            {uf}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
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
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        {status === 'released' || status === 'printed' ? (
                            <div className="space-y-4">
                                <div className="p-6 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-3xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                                        <CheckCircle2 className="h-16 w-16 text-emerald-500" />
                                    </div>

                                    <div className="relative z-10 flex flex-col gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-emerald-500 p-2 rounded-xl shadow-lg shadow-emerald-500/20">
                                                <Truck className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black uppercase text-emerald-700 tracking-tight">Etiqueta Emitida!</h4>
                                                <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest">Pronta para download e postagem</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2">
                                            <div className="p-3 bg-white/60 rounded-xl border border-emerald-200/50 flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-emerald-600/60 uppercase">Código de Rastreio</span>
                                                    <span className="text-sm font-mono font-black text-emerald-800">
                                                        {(trackingCode && !trackingCode.startsWith('ADI')) ? trackingCode : 'AGUARDANDO SYNC...'}
                                                    </span>
                                                </div>
                                                {trackingCode && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-emerald-600 hover:bg-emerald-100"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(trackingCode);
                                                            showSuccess("Rastreio copiado!");
                                                        }}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Button
                                        className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase italic tracking-tighter rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 border-none"
                                        onClick={handleDownload}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                        ) : (
                                            <Download className="h-6 w-6" />
                                        )}
                                        {loading ? 'Obtendo link...' : 'Imprimir Etiqueta (PDF)'}
                                    </Button>

                                    {labelUrl && (
                                        <Button
                                            variant="outline"
                                            className="w-full h-12 border-primary/20 text-primary font-bold rounded-2xl gap-2"
                                            onClick={() => window.open(labelUrl, '_blank')}
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            Re-abrir Visualização
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] uppercase font-black text-muted-foreground mb-0.5">Etiqueta Reservada</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-lg font-mono font-bold text-primary">#{labelId}</p>
                                            {selectedOption && (
                                                <Badge className="bg-primary/20 text-primary border-none text-[10px] font-black h-5">
                                                    {formatCurrency(parseFloat(selectedOption.price))}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <Truck className="h-8 w-8 text-zinc-300 animate-bounce" />
                                </div>

                                {(status === 'cart' || status === 'pending') && (
                                    <Button
                                        className="w-full h-14 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase italic tracking-tighter rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-3 group transition-all duration-300 active:scale-[0.98] border-none"
                                        onClick={handleCheckout}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <CreditCard className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                        )}
                                        Pagar e Emitir Etiqueta
                                    </Button>
                                )}
                            </>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-[10px] text-muted-foreground opacity-50 hover:opacity-100 mt-2"
                            onClick={() => {
                                setLabelId(undefined);
                                setOptions([]);
                                setManualCEP("");
                                setStatus(undefined);
                                setTrackingCode(null);
                                setLabelUrl(null);
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
                currentBalance={companyProfile?.logistics_provider === 'frenet' ? (companyProfile?.frenet_balance || 0) : (companyProfile?.wallet_balance || 0)}
                provider={companyProfile?.logistics_provider || 'superfrete'}
            />
        </Card>
    );
};
