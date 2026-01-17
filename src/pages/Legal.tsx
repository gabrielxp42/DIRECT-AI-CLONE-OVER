import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Shield, FileText, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { APP_VERSION } from '@/utils/version';

const Legal = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const defaultTab = location.pathname === '/privacy' ? 'privacy' : 'terms';

    return (
        <div className="min-h-screen w-full bg-[#0a0a0a] text-zinc-300 font-sans selection:bg-[#FFF200]/30 relative overflow-x-hidden">
            {/* Dynamic Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#1a1a00] to-[#0f0f00] opacity-80 z-0"></div>
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#FFF200]/5 rounded-full blur-[120px] z-0"></div>

            <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 md:py-20 flex flex-col min-h-screen">
                {/* Header */}
                <header className="flex items-center justify-between mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
                    <Button
                        variant="ghost"
                        onClick={() => navigate(-1)}
                        className="text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl gap-2 transition-all"
                    >
                        <ChevronLeft className="h-5 w-5" />
                        Voltar
                    </Button>
                    <div className="text-right">
                        <div className="flex items-center gap-2 justify-end mb-1">
                            <span className="text-xl font-bold text-white tracking-tighter">Direct AI</span>
                            <div className="w-8 h-8 rounded-lg bg-[#FFF200] flex items-center justify-center p-1.5 shadow-[0_0_15px_rgba(255,242,0,0.3)]">
                                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain brightness-0" />
                            </div>
                        </div>
                        <span className="text-[10px] text-zinc-600 font-bold tracking-[0.2em] uppercase whitespace-nowrap">
                            Legal &bull; Compliance
                        </span>
                    </div>
                </header>

                {/* Content Card */}
                <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl flex-1 animate-in fade-in zoom-in duration-700">
                    <Tabs defaultValue={defaultTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10 rounded-2xl h-14 p-1 mb-10">
                            <TabsTrigger
                                value="terms"
                                className="rounded-xl data-[state=active]:bg-[#FFF200] data-[state=active]:text-black font-bold flex gap-2 transition-all duration-300"
                            >
                                <FileText className="h-4 w-4" />
                                Termos de Uso
                            </TabsTrigger>
                            <TabsTrigger
                                value="privacy"
                                className="rounded-xl data-[state=active]:bg-[#FFF200] data-[state=active]:text-black font-bold flex gap-2 transition-all duration-300"
                            >
                                <Shield className="h-4 w-4" />
                                Privacidade
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="privacy" className="space-y-8 mt-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <section className="space-y-4">
                                <h1 className="text-3xl font-bold text-white">Política de Privacidade</h1>
                                <p className="text-zinc-400 leading-relaxed">
                                    A sua privacidade é importante para nós. É política da Direct AI respeitar a sua privacidade em relação a qualquer informação sua que possamos coletar no site Direct AI e em outros sites que possuímos e operamos.
                                </p>
                            </section>

                            <div className="space-y-6">
                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-lg font-bold text-[#FFF200] mb-3">1. Coleta de Informações</h3>
                                    <p className="text-sm leading-relaxed">
                                        Solicitamos informações pessoais apenas quando realmente precisamos delas para lhe fornecer um serviço. Fazemo-lo por meios justos e legais, com o seu conhecimento e consentimento. Também informamos por que estamos coletando e como será usado.
                                    </p>
                                </div>

                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-lg font-bold text-[#FFF200] mb-3">2. Uso de Dados</h3>
                                    <p className="text-sm leading-relaxed">
                                        Apenas retemos as informações coletadas pelo tempo necessário para fornecer o serviço solicitado. Quando armazenamos dados, os protegemos dentro de meios comercialmente aceitáveis ​​para evitar perdas e roubos, bem como acesso, divulgação, cópia, uso ou modificação não autorizados.
                                    </p>
                                </div>

                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-lg font-bold text-[#FFF200] mb-3">3. Compartilhamento com Terceiros</h3>
                                    <p className="text-sm leading-relaxed">
                                        Não compartilhamos informações de identificação pessoal publicamente ou com terceiros, exceto quando exigido por lei ou para processamento de pagamentos através do Stripe. Seus dados de cartão de crédito nunca são armazenados em nossos servidores.
                                    </p>
                                </div>

                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-lg font-bold text-[#FFF200] mb-3">4. Direitos do Usuário</h3>
                                    <p className="text-sm leading-relaxed">
                                        Você é livre para recusar a nossa solicitação de informações pessoais, entendendo que talvez não possamos fornecer alguns dos serviços desejados. O uso continuado de nosso site será considerado como aceitação de nossas práticas em torno de privacidade e informações pessoais.
                                    </p>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-white/5 text-center">
                                <p className="text-xs text-zinc-500">Última atualização: 17 de Janeiro de 2026</p>
                            </div>
                        </TabsContent>

                        <TabsContent value="terms" className="space-y-8 mt-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <section className="space-y-4">
                                <h1 className="text-3xl font-bold text-white">Termos de Uso</h1>
                                <p className="text-zinc-400 leading-relaxed">
                                    Ao acessar o site Direct AI, você concorda em cumprir estes termos de serviço, todas as leis e regulamentos aplicáveis ​​e concorda que é responsável pelo cumprimento de todas as leis locais aplicáveis.
                                </p>
                            </section>

                            <div className="space-y-6">
                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-lg font-bold text-[#FFF200] mb-3">1. Licença de Uso</h3>
                                    <p className="text-sm leading-relaxed">
                                        É concedida permissão para baixar temporariamente uma cópia dos materiais (informações ou software) no site Direct AI, apenas para visualização transitória pessoal e não comercial. Esta é a concessão de uma licença, não uma transferência de título.
                                    </p>
                                </div>

                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-lg font-bold text-[#FFF200] mb-3">2. Isenção de Responsabilidade</h3>
                                    <p className="text-sm leading-relaxed italic">
                                        Os materiais no site da Direct AI são fornecidos 'como estão'. A Direct AI não oferece garantias, expressas ou implícitas, e por este meio isenta e nega todas as outras garantias. Além disso, a Direct AI não garante que os resultados obtidos pela calculadora de DTF sejam 100% livres de variações físicas de impressão, sendo estas de responsabilidade do operador.
                                    </p>
                                </div>

                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-lg font-bold text-[#FFF200] mb-3">3. Pagamentos e Assinaturas</h3>
                                    <p className="text-sm leading-relaxed">
                                        As assinaturas são processadas pelo Stripe. O cancelamento pode ser feito a qualquer momento através do painel de perfil, interrompendo cobranças futuras. Reembolsos são regidos pela política de cada plano, conforme detalhado no momento da compra.
                                    </p>
                                </div>

                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-lg font-bold text-[#FFF200] mb-3">4. Modificações</h3>
                                    <p className="text-sm leading-relaxed">
                                        A Direct AI pode revisar estes termos de serviço do site a qualquer momento, sem aviso prévio. Ao usar este site, você concorda em ficar vinculado à versão atual desses termos de serviço.
                                    </p>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-white/5 text-center">
                                <p className="text-xs text-zinc-500">Última atualização: 17 de Janeiro de 2026</p>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Footer info */}
                <footer className="mt-12 text-center space-y-4">
                    <div className="flex items-center justify-center gap-6">
                        <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-widest font-bold">
                            <Scale className="h-4 w-4 text-[#FFF200]" />
                            Jurisdição Brasileira
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-widest font-bold">
                            <Shield className="h-4 w-4 text-[#FFF200]" />
                            Proteção via LGPD
                        </div>
                    </div>
                    <p className="text-xs text-zinc-600 font-bold tracking-[0.3em] uppercase">
                        Direct AI &bull; {APP_VERSION}
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default Legal;
