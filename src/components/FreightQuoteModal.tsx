
import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Truck,
    Loader2,
    Check,
    ChevronRight,
    MapPin,
    Package,
    AlertCircle
} from "lucide-react";
import { getValidToken } from "@/utils/tokenGuard";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { useCompanyProfile } from '@/hooks/useCompanyProfile';

interface FreightQuoteModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectQuote: (quote: { price: number; carrier: string; service_id: number; destination_cep?: string }) => void;
    defaultCEP?: string;
}

export const FreightQuoteModal = ({ open, onOpenChange, onSelectQuote, defaultCEP = "" }: FreightQuoteModalProps) => {
    const { companyProfile } = useCompanyProfile();
    const [destCEP, setDestCEP] = useState(defaultCEP);
    const [loading, setLoading] = useState(false);
    const [quotes, setQuotes] = useState<any[]>([]);
    const [dimensions, setDimensions] = useState({
        weight: 0.5,
        height: 2,
        width: 25,
        length: 35
    });

    useEffect(() => {
        if (defaultCEP) setDestCEP(defaultCEP);
    }, [defaultCEP]);

    const handleCalculate = async () => {
        if (!destCEP || destCEP.length < 8) {
            showError("CEP de destino inválido.");
            return;
        }

        const originCEP = companyProfile?.company_address_zip?.replace(/\D/g, '') || "04571010";
        const destinationCEP = destCEP.replace(/\D/g, '');

        setLoading(true);
        try {
            const token = await getValidToken();
            const payload = {
                action: 'calculate',
                params: {
                    from: { postal_code: originCEP },
                    to: { postal_code: destinationCEP },
                    package: dimensions,
                    services: "1,2,17" // PAC, SEDEX, Mini Envios
                }
            };

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
            if (data.error) throw new Error(data.message || "Erro no cálculo");

            const sorted = Array.isArray(data) ? [...data].sort((a, b) => parseFloat(a.price) - parseFloat(b.price)) : [];
            setQuotes(sorted);
            if (sorted.length === 0) showError("Nenhuma opção de frete encontrada para este CEP.");
        } catch (error: any) {
            showError(`Erro: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl bg-zinc-950">
                <DialogHeader className="p-6 bg-zinc-900/50 border-b border-white/5">
                    <DialogTitle className="flex items-center gap-2 text-white italic font-black uppercase tracking-tighter">
                        <Truck className="h-5 w-5 text-primary" />
                        Cotação de Frete
                    </DialogTitle>
                    <DialogDescription className="text-zinc-500 font-medium">
                        Calcule o valor do envio rapidamente
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-4">
                    <div className="space-y-4 bg-white/5 p-4 rounded-xl border border-white/10">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 pl-1">CEP de Destino</Label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                                <Input
                                    value={destCEP}
                                    onChange={(e) => setDestCEP(e.target.value)}
                                    placeholder="00000-000"
                                    className="pl-10 h-11 bg-black/40 border-white/10 text-white font-bold rounded-xl focus:border-primary transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 pl-1">Peso (kg)</Label>
                                <Input
                                    type="number"
                                    value={dimensions.weight}
                                    onChange={(e) => setDimensions({ ...dimensions, weight: Number(e.target.value) })}
                                    className="h-10 bg-black/40 border-white/10 text-white font-bold rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 pl-1">Altura (cm)</Label>
                                <Input
                                    type="number"
                                    value={dimensions.height}
                                    onChange={(e) => setDimensions({ ...dimensions, height: Number(e.target.value) })}
                                    className="h-10 bg-black/40 border-white/10 text-white font-bold rounded-xl"
                                />
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={handleCalculate}
                        disabled={loading}
                        className="w-full h-12 bg-primary text-black hover:bg-primary/90 font-black uppercase italic tracking-tighter rounded-xl shadow-lg shadow-primary/10"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calcular Opções"}
                    </Button>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {quotes.map((quote) => (
                            <button
                                key={quote.id}
                                onClick={() => {
                                    onSelectQuote({
                                        price: parseFloat(quote.price),
                                        carrier: quote.name,
                                        service_id: quote.id,
                                        destination_cep: destCEP
                                    });
                                    onOpenChange(false);
                                }}
                                className="w-full p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-primary/10 hover:border-primary/30 transition-all flex items-center justify-between group"
                            >
                                <div className="text-left">
                                    <p className="text-sm font-black text-white uppercase italic leading-none mb-1 group-hover:text-primary transition-colors">{quote.name}</p>
                                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{quote.delivery_time} dias úteis</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-black text-primary italic tracking-tighter leading-none">R$ {quote.price}</p>
                                    <p className="text-[9px] font-bold text-emerald-500/80 uppercase tracking-tighter">Escolher</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    {quotes.length === 0 && !loading && (
                        <div className="py-8 text-center space-y-2">
                            <Package className="h-8 w-8 text-zinc-800 mx-auto" />
                            <p className="text-xs text-zinc-600 font-medium italic">Seus preços aparecerão aqui</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
