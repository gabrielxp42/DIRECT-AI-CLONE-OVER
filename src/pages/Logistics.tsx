import React from 'react';
import { Truck, Calculator, PackageCheck, History } from 'lucide-react';
import { ShippingSection } from '@/components/ShippingSection';
import { LogisticsSettings } from '@/components/LogisticsSettings';
import { LogisticsOverview } from '@/components/LogisticsOverview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

            <Tabs defaultValue="calculator" className="w-full space-y-6">
                <TabsList className="bg-muted/50 p-1 rounded-xl h-11 border border-border">
                    <TabsTrigger value="calculator" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary font-black italic uppercase tracking-tighter text-xs gap-2">
                        <Calculator className="h-3.5 w-3.5" />
                        Gerar Envios
                    </TabsTrigger>
                    <TabsTrigger value="labels" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary font-black italic uppercase tracking-tighter text-xs gap-2">
                        <PackageCheck className="h-3.5 w-3.5" />
                        Minhas Etiquetas
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="calculator" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <ShippingSection />
                        </div>

                        <div className="space-y-6">
                            <LogisticsSettings />

                            <div className="p-6 rounded-2xl border bg-card text-card-foreground shadow-sm">
                                <h2 className="text-sm font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-primary">
                                    <Truck className="h-4 w-4" />
                                    Como faturamos?
                                </h2>
                                <ul className="space-y-4 text-[11px] text-muted-foreground font-medium">
                                    <li className="flex gap-3">
                                        <div className="bg-primary/10 text-primary h-5 w-5 rounded flex items-center justify-center shrink-0 font-black">1</div>
                                        <div>
                                            <p className="font-bold text-foreground">Saldo Direct AI</p>
                                            As etiquetas são debitadas do seu saldo interno na plataforma.
                                        </div>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="bg-primary/10 text-primary h-5 w-5 rounded flex items-center justify-center shrink-0 font-black">2</div>
                                        <div>
                                            <p className="font-bold text-foreground">Taxa Zero</p>
                                            Não cobramos taxas extras além do valor do frete. Preço direto de tabela.
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="labels" className="space-y-6">
                    <LogisticsOverview />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default Logistics;
