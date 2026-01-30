
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, QrCode, RefreshCw, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionProvider";
import { toast } from "sonner";

export function WhatsAppConnection() {
    const { profile } = useSession();
    const [loading, setLoading] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [adminConfig, setAdminConfig] = useState<{ url: string; key: string } | null>(null);

    useEffect(() => {
        fetchAdminConfig();
        checkConnectionStatus();
    }, []);

    const fetchAdminConfig = async () => {
        // Busca a configuração global salva pelo Admin (is_admin = true)
        const { data: adminProfiles, error } = await supabase
            .from('profiles')
            .select('whatsapp_api_url, whatsapp_api_key')
            .eq('is_admin', true)
            .limit(1);

        if (adminProfiles && adminProfiles[0]) {
            setAdminConfig({
                url: adminProfiles[0].whatsapp_api_url || '',
                key: adminProfiles[0].whatsapp_api_key || ''
            });
        }
    };

    const checkConnectionStatus = async () => {
        if (profile?.whatsapp_instance_id && profile?.whatsapp_instance_token) {
            // Aqui faríamos o polling na Evolution API para ver se está CONNECTED
            // Por enquanto vamos simular ou olhar o banco
            if (profile.whatsapp_status === 'connected') {
                setStatus('connected');
            }
        }
    };

    const handleConnect = async () => {
        if (!adminConfig?.url || !adminConfig?.key) {
            toast.error("Configuração da Evolution API não localizada. Contate o suporte.");
            return;
        }

        setLoading(true);
        setStatus('connecting');

        try {
            // 1. Criar instância se não existir
            // 2. Buscar QR Code
            // 3. Salvar tokens no profile

            const instanceName = profile?.company_name?.toLowerCase().replace(/\s/g, '_') || `user_${profile?.id?.substring(0, 8)}`;

            const createResponse = await fetch(`${adminConfig.url}/instance/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': adminConfig.key
                },
                body: JSON.stringify({
                    instanceName,
                    token: Math.random().toString(36).substring(7),
                    qrcode: true
                })
            });

            const data = await createResponse.json();

            if (data.qrcode?.base64) {
                setQrCode(data.qrcode.base64);

                // Atualiza o profile localmente e no banco
                await supabase
                    .from('profiles')
                    .update({
                        whatsapp_instance_id: instanceName,
                        whatsapp_instance_token: data.token,
                        whatsapp_status: 'connecting'
                    })
                    .eq('id', profile?.id);

                toast.success("QR Code gerado! Escaneie agora.");
            } else if (data.status === 403 || data.status === 'error') {
                // Talvez já exista, tentar buscar o QR
                fetchQRCode(instanceName);
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao conectar com a Evolution API.");
            setStatus('disconnected');
        } finally {
            setLoading(false);
        }
    };

    const fetchQRCode = async (instanceName: string) => {
        try {
            const response = await fetch(`${adminConfig?.url}/instance/connect/${instanceName}`, {
                headers: { 'apikey': adminConfig?.key || '' }
            });
            const data = await response.json();
            if (data.base64) {
                setQrCode(data.base64);
            }
        } catch (e) {
            toast.error("Erro ao recuperar QR Code.");
        }
    };

    return (
        <Card className="border-none shadow-xl bg-white dark:bg-zinc-900 rounded-[2rem] overflow-hidden">
            <CardHeader className="p-8">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${status === 'connected' ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'}`}>
                        <MessageSquare size={24} />
                    </div>
                    <div>
                        <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Conexão WhatsApp</CardTitle>
                        <CardDescription className="text-sm font-medium">Conecte sua empresa ao motor da Gabi AI.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
                {status === 'connected' ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-4 bg-green-500/5 rounded-[2rem] border border-green-500/20">
                        <div className="p-4 bg-green-500 rounded-full text-white">
                            <CheckCircle size={48} />
                        </div>
                        <div className="text-center">
                            <h3 className="text-2xl font-black italic uppercase tracking-tighter text-green-600">Conectado!</h3>
                            <p className="text-sm font-bold text-green-700/60 uppercase tracking-widest">A Gabi já pode falar com seus clientes.</p>
                        </div>
                        <Button variant="outline" className="mt-4 rounded-xl text-red-500 hover:text-red-600 border-red-200">
                            Desconectar Aparelho
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <h3 className="text-lg font-black uppercase italic tracking-tighter">Como conectar?</h3>
                                <ol className="text-sm space-y-3 text-muted-foreground font-medium">
                                    <li className="flex gap-3"><span className="flex-none w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px] font-black">1</span> Clique no botão para gerar o QR Code.</li>
                                    <li className="flex gap-3"><span className="flex-none w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px] font-black">2</span> Abra o WhatsApp no seu celular.</li>
                                    <li className="flex gap-3"><span className="flex-none w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px] font-black">3</span> Vá em Configurações {'>'} Aparelhos Conectados.</li>
                                    <li className="flex gap-3"><span className="flex-none w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px] font-black">4</span> Aponte a câmera para o código ao lado.</li>
                                </ol>
                            </div>

                            {!qrCode && (
                                <Button
                                    onClick={handleConnect}
                                    disabled={loading}
                                    className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl hover:scale-[1.02] transition-all"
                                >
                                    {loading ? <Loader2 className="animate-spin mr-2" /> : <QrCode className="mr-2" />}
                                    Gerar QR Code de Conexão
                                </Button>
                            )}
                        </div>

                        <div className="flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-[2.5rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800 min-h-[300px]">
                            {qrCode ? (
                                <div className="relative p-4 bg-white rounded-3xl shadow-2xl">
                                    <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 rounded-xl" />
                                    <div className="absolute inset-x-0 -bottom-10 text-center">
                                        <Button variant="link" size="sm" onClick={handleConnect} className="text-[10px] font-black uppercase italic tracking-widest">
                                            <RefreshCw size={12} className="mr-1" /> Atualizar Código
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center space-y-4 opacity-30">
                                    <QrCode size={80} className="mx-auto" />
                                    <p className="text-xs font-black uppercase tracking-[0.2em]">Aguardando Geração</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 flex gap-4">
                    <AlertCircle className="text-amber-500 shrink-0" size={20} />
                    <p className="text-[11px] font-medium text-amber-700 leading-relaxed">
                        <strong>Atenção:</strong> Mantenha seu celular conectado à internet para que a Gabi AI possa enviar as mensagens em seu nome. A conexão é segura e transparente.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
