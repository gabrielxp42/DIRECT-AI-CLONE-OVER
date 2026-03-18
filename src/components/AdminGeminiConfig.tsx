import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Save, Loader2, Bot, Info, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function AdminGeminiConfig() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState({
        gemini_api_key: '',
        gemini_training_model: 'gemini-2.5-flash',
        gemini_response_model: 'gemini-2.5-flash',
        ai_auto_reply_enabled: false,
        kieai_api_key: ''
    });

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles_v2')
                .select('gemini_api_key, gemini_training_model, gemini_response_model, ai_auto_reply_enabled, kieai_api_key')
                .eq('uid', user.id)
                .single();

            if (error) throw error;

            if (data) {
                setConfig({
                    gemini_api_key: data.gemini_api_key || '',
                    gemini_training_model: data.gemini_training_model || 'gemini-2.5-flash',
                    gemini_response_model: data.gemini_response_model || 'gemini-2.5-flash',
                    ai_auto_reply_enabled: data.ai_auto_reply_enabled || false,
                    kieai_api_key: data.kieai_api_key || ''
                });
            }
        } catch (error) {
            console.error('Error loading Gemini config:', error);
            toast.error('Erro ao carregar configurações');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('profiles_v2')
                .update(config)
                .eq('uid', user.id);

            if (error) throw error;

            toast.success('Configurações salvas com sucesso!');
        } catch (error) {
            console.error('Error saving config:', error);
            toast.error('Erro ao salvar configurações');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Bot className="w-6 h-6 text-primary" />
                    Configuração de IAs
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Configure as integrações de Inteligência Artificial do sistema
                </p>
            </div>

            <div className="grid gap-6">
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary" />
                            KIE.AI (Vetorizador Nano Banana)
                        </CardTitle>
                        <CardDescription>
                            Chave de API necessária para a ferramenta de vetorização de logos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="kieai_api_key">KIE.AI API Key</Label>
                            <Input
                                id="kieai_api_key"
                                type="password"
                                value={config.kieai_api_key}
                                onChange={(e) => setConfig({ ...config, kieai_api_key: e.target.value })}
                                placeholder="sk-..."
                                className="font-mono bg-background"
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Obtenha sua chave em <a href="https://kie.ai" target="_blank" rel="noopener noreferrer" className="underline">kie.ai</a>. Esta chave será usada globalmente para todos os usuários.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Google Gemini</CardTitle>
                        <CardDescription>
                            Chave de API do Google AI Studio para o funcionamento dos agentes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="api_key">Gemini API Key</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="api_key"
                                    type="password"
                                    value={config.gemini_api_key}
                                    onChange={(e) => setConfig({ ...config, gemini_api_key: e.target.value })}
                                    placeholder="AIzaSy..."
                                    className="font-mono"
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                <ShieldAlert className="w-3 h-3 inline mr-1" />
                                Esta chave será usada para todos os agentes do sistema. Mantenha segura.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Modelos & Performance</CardTitle>
                        <CardDescription>
                            Escolha os modelos adequados para cada etapa do processo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label>Modelo de Treinamento (Background)</Label>
                                <Select
                                    value={config.gemini_training_model}
                                    onValueChange={(value) => setConfig({ ...config, gemini_training_model: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash (Padrão Gratuito/Estável)</SelectItem>
                                        <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (Mais Rápido)</SelectItem>
                                        <SelectItem value="gemini-3-flash">Gemini 3 Flash (Preview)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">
                                    Usado pelos agentes Extrator, Validador e Sintetizador. Recomenda-se Flash-Lite para menor custo.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Modelo de Resposta (Atendimento)</Label>
                                <Select
                                    value={config.gemini_response_model}
                                    onValueChange={(value) => setConfig({ ...config, gemini_response_model: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash (Estável)</SelectItem>
                                        <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro (Qualidade Máxima)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">
                                    Usado pela Gabi para responder os clientes finais. Recomenda-se Flash ou Pro para melhor qualidade.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                            <div className="space-y-0.5">
                                <Label className="text-base">Resposta Automática Global</Label>
                                <p className="text-xs text-muted-foreground">
                                    Permitir que agentes prontos respondam automaticamente.
                                    O usuário final ainda precisa ativar individualmente.
                                </p>
                            </div>
                            <Switch
                                checked={config.ai_auto_reply_enabled}
                                onCheckedChange={(checked) => setConfig({ ...config, ai_auto_reply_enabled: checked })}
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
                        {saving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        Salvar Configurações
                    </Button>
                </div>
            </div>
        </div>
    );
}
