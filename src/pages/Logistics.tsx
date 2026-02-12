import React from 'react';
import { Truck } from 'lucide-react';
import { ShippingSection } from '@/components/ShippingSection';
import { LogisticsSettings } from '@/components/LogisticsSettings';

const Logistics = () => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black italic tracking-tighter uppercase text-primary flex items-center gap-3">
                    <Truck className="h-8 w-8" />
                    Hub de Logística
                </h1>
                <p className="text-muted-foreground text-sm font-medium">
                    Gestão centralizada de fretes, carteira de envios e etiquetas avulsas.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <ShippingSection />
                </div>

                <div className="space-y-6">
                    <LogisticsSettings />

                    <div className="p-6 rounded-2xl border bg-card text-card-foreground shadow-sm">
                        <h2 className="text-sm font-bold mb-4 flex items-center gap-2 uppercase tracking-wide">
                            <Truck className="h-4 w-4 text-primary" />
                            Como faturamos?
                        </h2>
                        <ul className="space-y-3 text-[11px] text-muted-foreground">
                            <li className="flex gap-2">
                                <span className="font-bold text-primary">1.</span>
                                <div>
                                    <p className="font-bold text-foreground">Saldo Direct AI</p>
                                    As etiquetas são debitadas do seu saldo interno na plataforma.
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold text-primary">2.</span>
                                <div>
                                    <p className="font-bold text-foreground">Taxa Zero</p>
                                    Não cobramos taxas extras além do valor do frete (contrato Super Frete).
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Logistics;
