import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionProvider';
import { toast } from 'sonner';
import { Loader2, Database, AlertTriangle, Trash2 } from 'lucide-react';
import { subDays, addHours } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from '@/integrations/supabase/client';

export const DemoDataGenerator = () => {
    const { session } = useSession();
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [progress, setProgress] = useState(0);
    const [clearExisting, setClearExisting] = useState(false);

    const generateData = async () => {
        if (!session?.user?.id) return;
        setIsLoading(true);
        setProgress(0);

        try {
            const userId = session.user.id;

            // 0. LIMPAR DADOS
            if (clearExisting) {
                await supabase.from('pedidos').delete().eq('user_id', userId);
                toast.info('Base resetada para nova simulação ultra-realista.');
            }

            // 0.5 GARANTIR TIPOS DE PRODUTOS (Seguindo a imagem do usuário)
            const typesConfig = [
                { nome: 'DTF', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30', icon: 'Printer', unidade: 'metro' },
                { nome: 'DTF UV', color: 'text-purple-500 bg-purple-500/10 border-purple-500/30', icon: 'Zap', unidade: 'metro' },
                { nome: 'Vinil', color: 'text-orange-500 bg-orange-500/10 border-orange-500/30', icon: 'Scissors', unidade: 'metro' },
                { nome: 'VAREJO', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30', icon: 'Package', unidade: 'unidade' }
            ];

            for (const t of typesConfig) {
                const { data: existing } = await supabase
                    .from('tipos_producao')
                    .select('id')
                    .eq('user_id', userId)
                    .ilike('nome', t.nome)
                    .maybeSingle();

                if (!existing) {
                    await supabase.from('tipos_producao').insert({
                        user_id: userId,
                        nome: t.nome,
                        color: t.color,
                        icon: t.icon,
                        unidade_medida: t.unidade,
                        is_active: true
                    });
                }
            }

            // 1. Fetch clients
            const { data: clientes, error: cliError } = await supabase
                .from('clientes')
                .select('*')
                .eq('user_id', userId);

            if (cliError || !clientes || clientes.length < 5) {
                toast.error('Cadastre pelo menos 5 clientes antes de rodar a demo.');
                setIsLoading(false);
                return;
            }

            // --- ULTRA CONFIG (Bate com os 43k da imagem) ---
            const targetPedidos = 220;
            const vipClients = clientes.slice(0, 3);
            const debtor1 = clientes[3];
            const debtor2 = clientes[4];

            // Products list with Weight logic
            const products = [
                { name: 'Impressão DTF Premium (Metro)', price: 75.00, type: 'DTF', weight: 0.65 },
                { name: 'DTF UV - Alto Relevo (Metro)', price: 160.00, type: 'DTF UV', weight: 0.10 },
                { name: 'Vinil Adesivo Brilho (Metro)', price: 45.00, type: 'Vinil', weight: 0.10 },
                { name: 'Camiseta Algodão (Varejo)', price: 55.00, type: 'VAREJO', weight: 0.05 },
                { name: 'Caneca Ceramica (Varejo)', price: 35.00, type: 'VAREJO', weight: 0.05 },
                { name: 'Ecobag Personalizada (Varejo)', price: 42.00, type: 'VAREJO', weight: 0.05 },
            ];

            const getRandomProduct = () => {
                const r = Math.random();
                let acc = 0;
                for (const p of products) {
                    acc += p.weight;
                    if (r <= acc) return p;
                }
                return products[0];
            };

            const pedidosBatch = [];
            const itemsBatch = [];
            const historyBatch = [];
            const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

            const addDemoOrder = (client: any, daysAgo: number, forceStatus?: string, isPaid = true) => {
                const pedidoId = crypto.randomUUID();
                const createdAt = addHours(subDays(new Date(), daysAgo), randomInt(8, 19)).toISOString();
                const status = forceStatus || (isPaid ? 'entregue' : 'pendente');
                const pagoAt = (isPaid && (status === 'entregue' || status === 'pago')) ? createdAt : null;

                const numItems = randomInt(1, 2); // 1-2 types per order is more realistic
                let total = 0;
                let totalMetros = 0;
                let totalMetrosDTF = 0;
                let totalMetrosVinil = 0;

                for (let k = 0; k < numItems; k++) {
                    const prod = getRandomProduct();

                    // High volume for DTF and Vinil
                    let qtx = 1;
                    if (prod.type === 'DTF' || prod.type === 'Vinil' || prod.type === 'DTF UV') {
                        qtx = randomInt(3, 15); // Large meters per order
                    } else {
                        qtx = randomInt(1, 10); // Units for varejo
                    }

                    const subtotal = qtx * prod.price;
                    total += subtotal;

                    const isMeters = prod.name.includes('(Metro)');
                    if (isMeters || prod.type.includes('DTF') || prod.type === 'Vinil') {
                        totalMetros += qtx;
                        if (prod.type === 'DTF') totalMetrosDTF += qtx;
                        if (prod.type === 'Vinil') totalMetrosVinil += qtx;
                    }

                    itemsBatch.push({
                        pedido_id: pedidoId,
                        produto_nome: prod.name,
                        quantidade: qtx,
                        preco_unitario: prod.price,
                        tipo: prod.type as any
                    });
                }

                pedidosBatch.push({
                    id: pedidoId,
                    user_id: userId,
                    cliente_id: client.id,
                    valor_total: total,
                    subtotal_produtos: total,
                    status,
                    created_at: createdAt,
                    pago_at: pagoAt,
                    total_metros: totalMetros,
                    total_metros_dtf: totalMetrosDTF,
                    total_metros_vinil: totalMetrosVinil,
                    desconto_valor: 0,
                    desconto_percentual: 0,
                    subtotal_servicos: 0
                });

                historyBatch.push({
                    pedido_id: pedidoId,
                    status_novo: status,
                    status_anterior: 'novo',
                    user_id: userId,
                    created_at: createdAt
                });
            };

            // GENERATION PLAN
            // 1. VIP 1: 25 orders throughout the year, active
            for (let i = 0; i < 25; i++) addDemoOrder(vip1, i * 14 + randomInt(0, 5));

            // 2. VIP 2: 15 orders, inactive for 35 days (triggers VIP Alert)
            for (let i = 0; i < 15; i++) addDemoOrder(vip2, 35 + i * 20);

            // 3. Debtors
            addDemoOrder(debtor1, 4, 'pendente', false);
            addDemoOrder(debtor2, 12, 'pendente', false);

            // 4. Growth Simulation
            // Last 7 days: 35 orders
            for (let i = 0; i < 35; i++) addDemoOrder(clientes[randomInt(0, 4)], randomInt(0, 6));
            // Previous 7 days: 5 orders (massive growth)
            for (let i = 0; i < 5; i++) addDemoOrder(clientes[randomInt(0, 4)], randomInt(8, 13));

            // 5. Fill remaining to reach ~220
            const remaining = targetPedidos - pedidosBatch.length;
            for (let i = 0; i < remaining; i++) {
                const weight = Math.pow(Math.random(), 1.2);
                const days = Math.floor(weight * 365) + 1;
                addDemoOrder(clientes[randomInt(0, clientes.length - 1)], days);
            }

            // Chunked Inserts
            const chunks = <T>(arr: T[], size: number) => Array.from({length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

                const pedChunks = chunks(pedidosBatch, 40);
                for (let i = 0; i < pedChunks.length; i++) {
                    await supabase.from('pedidos').insert(pedChunks[i]);
                setProgress(Math.round(((i + 1) / pedChunks.length) * 100));
            }

                await supabase.from('pedido_items').insert(itemsBatch);
                await supabase.from('pedido_status_history').insert(historyBatch);

                toast.success('Demonstração Ultra Realista Gerada!');
                setIsOpen(false);
                window.location.reload();

        } catch (error: any) {
                    toast.error('Erro: ' + error.message);
        } finally {
                    setIsLoading(false);
        }
    };

                return (
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50">
                            <Database className="w-4 h-4 mr-2" />
                            Simular Histórico REALISTA (v4)
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Database className="w-5 h-5 text-primary" />
                                Geração Ultra Realista
                            </DialogTitle>
                            <DialogDescription>
                                Ajustado para espelhar uma operação real de DTF com alto volume:
                                <ul className="list-disc list-inside mt-2 text-[11px] space-y-1">
                                    <li><strong>DTF como Protagonista:</strong> Quantidade massiva de metros (~70% do volume).</li>
                                    <li><strong>Receita Alvo:</strong> Simulação de faturamento entre R$ 40k e R$ 50k/ano.</li>
                                    <li><strong>Consumo de Mídia:</strong> Gráficos detalhados com centenas de metros lineares.</li>
                                    <li><strong>Categorias:</strong> DTF, Vinil, DTF UV e VAREJO configurados.</li>
                                </ul>
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <input
                                    id="clearDbUltra"
                                    type="checkbox"
                                    checked={clearExisting}
                                    onChange={(e) => setClearExisting(e.target.checked)}
                                    className="w-4 h-4 mt-0.5 text-red-600 border-red-300 rounded focus:ring-red-500"
                                />
                                <label htmlFor="clearDbUltra" className="text-sm font-semibold text-red-900 cursor-pointer">
                                    REDEFINIR BASE DE DADOS?
                                    <span className="block text-xs font-normal text-red-700 mt-1">
                                        Apaga os dados anteriores para garantir que os novos bitem com os relatórios da imagem.
                                    </span>
                                </label>
                            </div>

                            {isLoading && (
                                <div className="space-y-2">
                                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                                    </div>
                                    <p className="text-[10px] text-center text-muted-foreground animate-pulse font-bold">RECONSTRUINDO HISTÓRICO... {progress}%</p>
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>Cancelar</Button>
                            <Button onClick={generateData} disabled={isLoading} className="bg-red-600 hover:bg-red-700 font-bold">
                                {isLoading ? 'Injetando Dados...' : 'Gerar Demo Realista'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                );
};
