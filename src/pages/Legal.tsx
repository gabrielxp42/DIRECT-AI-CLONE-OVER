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
                                    A sua privacidade é prioridade na Direct AI. Esta política descreve como coletamos, usamos e protegemos seus dados em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
                                </p>
                            </section>

                            <div className="space-y-6">
                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-lg font-bold text-[#FFF200] mb-3">1. Coleta e Finalidade</h3>
                                    <p className="text-sm leading-relaxed">
                                        Coletamos dados como e-mail, nome da empresa e informações de uso para fornecer acesso ao sistema, processar pagamentos e permitir as funcionalidades de inteligência artificial. Seus dados são processados com base na execução de contrato ou legítimo interesse.
                                    </p>
                                </div>

                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-lg font-bold text-[#FFF200] mb-3">2. Segurança e Retenção</h3>
                                    <p className="text-sm leading-relaxed">
                                        Retemos informações apenas pelo tempo necessário para cumprir as finalidades descritas. Utilizamos criptografia e práticas de segurança de ponta para evitar acessos não autorizados. Dados financeiros são processados por parceiros certificados (Stripe/Asaas) e não residem em nossos servidores.
                                    </p>
                                </div>

                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-lg font-bold text-[#FFF200] mb-3">3. Uso de IA e Gabriel</h3>
                                    <p className="text-sm leading-relaxed">
                                        Nossa inteligência artificial (Gabriel) analisa dados de faturamento e vendas para gerar insights. Estes dados são processados de forma privada e nunca são compartilhados ou utilizados para treinar modelos externos com informações identificáveis de sua empresa.
                                    </p>
                                </div>

                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-lg font-bold text-[#FFF200] mb-3">4. Seus Direitos</h3>
                                    <p className="text-sm leading-relaxed">
                                        Conforme a LGPD, você tem direito a confirmar a existência de tratamento, acessar seus dados, corrigir informações incompletas e solicitar a exclusão de seus dados pessoais a qualquer momento através de nosso suporte.
                                    </p>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-white/5 text-center">
                                <p className="text-xs text-zinc-500">Versão 2.4 &bull; Atualizada em: 17 de Janeiro de 2026</p>
                            </div>
                        </TabsContent>

                        <TabsContent value="terms" className="space-y-8 mt-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <section className="space-y-4">
                                <h1 className="text-3xl font-bold text-white">Termos de Uso</h1>
                                <p className="text-zinc-400 leading-relaxed">
                                    Ao utilizar a Direct AI, você concorda legalmente com estes termos. O serviço consiste em uma plataforma SaaS de gestão para gráficas e estamparias com auxílio de inteligência artificial.
                                </p>
                            </section>

                            <div className="space-y-6">
                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-lg font-bold text-[#FFF200] mb-3">1. Licença e Uso do Sistema</h3>
                                    <p className="text-sm leading-relaxed">
                                        Concedemos uma licença de uso pessoal, intransferível e revogável. O usuário é responsável pela veracidade dos dados inseridos e pelo uso ético das ferramentas de IA. É proibido o uso do sistema para atividades ilícitas ou extração automatizada de dados (scraping).
                                    </p>
                                </div>

                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-lg font-bold text-[#FFF200] mb-3">2. Isenção e Responsabilidade Técnica</h3>
                                    <p className="text-sm leading-relaxed italic">
                                        A Direct AI fornece ferramentas de cálculo (DTF) e insights via IA. Devido à natureza da tecnologia, a IA pode gerar aproximações. Os resultados devem ser validados pelo operador técnico. Não nos responsabilizamos por perdas de material decorrentes de configurações incorretas feitas pelo usuário.
                                    </p>
                                </div>

                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-lg font-bold text-[#FFF200] mb-3">3. Assinaturas e CDC (Direito de Arrependimento)</h3>
                                    <p className="text-sm leading-relaxed">
                                        Em conformidade com o Art. 49 do Código de Defesa do Consumidor (Brasil), garantimos o direito de arrependimento com reembolso total em até 7 dias após a primeira contratação. Após este período, o cancelamento interrompe cobranças futuras, mantendo o acesso até o fim do ciclo pago.
                                    </p>
                                </div>

                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-lg font-bold text-[#FFF200] mb-3">4. Modificações e Suspensão</h3>
                                    <p className="text-sm leading-relaxed">
                                        Podemos atualizar estes termos ou as funcionalidades do sistema para melhoria contínua. O uso excessivo ou abusivo das APIs de IA que comprometa a estabilidade do sistema poderá resultar em limitação temporária do recurso no perfil do usuário.
                                    </p>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-white/5 text-center">
                                <p className="text-xs text-zinc-500">Versão 2.4 &bull; Atualizada em: 17 de Janeiro de 2026</p>
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
