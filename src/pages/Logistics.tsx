import React from 'react';
import { Truck } from 'lucide-react';
import { ShippingSection } from '@/components/ShippingSection';

const Logistics = () => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black italic tracking-tighter uppercase text-primary flex items-center gap-3">
                    <Truck className="h-8 w-8" />
                    Central de Logística
                </h1>
                <p className="text-muted-foreground text-sm font-medium">
                    Calcule fretes e gere etiquetas avulsas sem necessidade de um pedido formal.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <ShippingSection />
                </div>

                <div className="space-y-4">
                    <div className="p-6 rounded-2xl border bg-card text-card-foreground shadow-sm">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Truck className="h-5 w-5 text-primary" />
                            Como funciona o modo avulso?
                        </h2>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li className="flex gap-2">
                                <span className="font-bold text-primary">1.</span>
                                <div>
                                    <p className="font-bold text-foreground">Sem Vínculo</p>
                                    As etiquetas geradas aqui não são salvas em nenhum pedido do sistema.
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold text-primary">2.</span>
                                <div>
                                    <p className="font-bold text-foreground">Dados Manuais</p>
                                    Você deve preencher o nome e endereço do destinatário manualmente.
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold text-primary">3.</span>
                                <div>
                                    <p className="font-bold text-foreground">Pagamento</p>
                                    O pagamento é feito utilizando o saldo da sua conta no Super Frete.
                                </div>
                            </li>
                        </ul>
                    </div>

                    <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20">
                        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Dica Pro</p>
                        <p className="text-sm text-primary/80">
                            Use esta ferramenta para passar orçamentos rápidos para clientes no WhatsApp antes mesmo deles fecharem o pedido.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Logistics;
