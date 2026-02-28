import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "@/contexts/SessionProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
    Bot, Sparkles, Save, Info, Smartphone, CheckCircle, Truck,
    User, Hash, DollarSign, MapPin, Building, Clock, List, ArrowRight,
    MessageCircle, Layers, ShieldCheck, Activity, AlertTriangle, Bell
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { showError, showSuccess } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

const VARIABLE_CONFIG: Record<string, { label: string, icon: any, description: string }> = {
    cliente: { label: "Nome do Cliente", icon: User, description: "Nome do cliente que fez o pedido." },
    order_number: { label: "Nº do Pedido", icon: Hash, description: "Número identificador do pedido." },
    total: { label: "Total Geral", icon: DollarSign, description: "Valor final com frete e descontos." },
    tracking_code: { label: "Cód. Rastreio", icon: MapPin, description: "Código para rastreamento da entrega." },
    endereco_empresa: { label: "Endereço Loja", icon: Building, description: "Endereço físico da sua empresa." },
    horario_empresa: { label: "Horário Loja", icon: Clock, description: "Seu horário de funcionamento." },
    itens: { label: "Lista de Itens", icon: List, description: "Resumo dos produtos comprados." },
    // Extended variables for Summary
    data_criacao: { label: "Data", icon: Clock, description: "Data e hora do pedido." },
    telefone: { label: "Telefone", icon: Smartphone, description: "Telefone do cliente." },
    servicos: { label: "Serviços", icon: Layers, description: "Lista de serviços extras." },
    entrega_info: { label: "Entrega", icon: Truck, description: "Detalhes do frete/entrega." },
    status: { label: "Status", icon: CheckCircle, description: "Status atual do pagamento." },
};

// ============ EXTERNAL COMPONENT: AI Modal ============
const AIModal = React.memo(({ status, onGenerate, generatingAI }: {
    status: string,
    onGenerate: (status: string, prompt: string) => Promise<boolean>,
    generatingAI: boolean
}) => {
    const [localPrompt, setLocalPrompt] = useState("");
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-3 gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary hover:text-primary hover:bg-primary/10 rounded-full border border-primary/20">
                    <Sparkles className="h-3 w-3" />
                    Pedir para Gabi escrever
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 rounded-3xl shadow-2xl border-2 bg-background/95 backdrop-blur-xl" align="end">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                        <Bot className="h-5 w-5" />
                        <span className="text-xs font-black uppercase tracking-tight">O que a Gabi deve escrever?</span>
                    </div>
                    <Textarea
                        placeholder="Ex: 'Seja mais formal', 'Adicione um aviso sobre o horário de almoço'..."
                        className="min-h-[100px] text-sm resize-none rounded-2xl border-2 focus:ring-4 focus:ring-primary/10"
                        value={localPrompt}
                        onChange={e => setLocalPrompt(e.target.value)}
                        autoFocus
                    />
                    <Button
                        className="w-full h-12 rounded-2xl font-black gap-2 shadow-lg shadow-primary/20"
                        onClick={async () => {
                            const success = await onGenerate(status, localPrompt);
                            if (success) {
                                setLocalPrompt("");
                                setIsOpen(false);
                            }
                        }}
                        disabled={generatingAI || !localPrompt}
                    >
                        {generatingAI ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                            <Sparkles className="h-4 w-4" />
                        )}
                        Gerar com IA ✨
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
});
AIModal.displayName = "AIModal";

// ============ EXTERNAL COMPONENT: Visual Message ============
const VisualMessage = React.memo(({ text }: { text: string }) => {
    if (!text) return <span className="text-muted-foreground italic">Sua mensagem aparecerá aqui...</span>;

    const parts = text.split(/({{.*?}})/g);

    return (
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
            {parts.map((part, i) => {
                const match = part.match(/{{(.*?)}}/);
                if (match) {
                    const varName = match[1];
                    const cfg = VARIABLE_CONFIG[varName];
                    if (!cfg) return <span key={i} className="text-red-500">{part}</span>;

                    return (
                        <Badge
                            key={i}
                            variant="secondary"
                            className="mx-0.5 h-6 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 px-2 rounded-full font-bold select-none inline-flex items-center gap-1 align-baseline translate-y-[1px]"
                        >
                            {React.createElement(cfg.icon, { className: "h-3 w-3" })}
                            {cfg.label}
                        </Badge>
                    );
                }
                return <span key={i} className="text-zinc-900 dark:text-zinc-100 font-medium">{part}</span>;
            })}
        </div>
    );
});
VisualMessage.displayName = "VisualMessage";

// ============ EXTERNAL COMPONENT: Template Editor ============
const TemplateEditor = React.memo(({
    status, label, icon: Icon, description, variables,
    templateValue, onTemplateChange, onInsertVariable, onAIGenerate, generatingAI
}: {
    status: string,
    label: string,
    icon: any,
    description: string,
    variables: string[],
    templateValue: string,
    onTemplateChange: (value: string) => void,
    onInsertVariable: (variable: string) => void,
    onAIGenerate: (status: string, prompt: string) => Promise<boolean>,
    generatingAI: boolean
}) => {
    // Render visual pills
    const visualParts = useMemo(() => {
        if (!templateValue) return null;
        return templateValue.split(/({{.*?}})/g).map((part, i) => {
            const match = part.match(/{{(.*?)}}/);
            if (match) {
                const varName = match[1];
                const cfg = VARIABLE_CONFIG[varName];
                if (!cfg) return <span key={i} className="text-red-500 opacity-50">{part}</span>;
                return (
                    <span
                        key={i}
                        className="inline-flex items-center gap-1 bg-amber-400 text-amber-950 px-2 py-0.5 rounded-md font-black text-[10px] uppercase shadow-sm border border-amber-500 mx-0.5 select-none align-baseline transform translate-y-[-1px]"
                    >
                        {cfg.label}
                    </span>
                );
            }
            return <span key={i} className="text-zinc-600 dark:text-zinc-400">{part}</span>;
        });
    }, [templateValue]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h4 className="font-black text-xl tracking-tight">{label}</h4>
                        <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                </div>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex -space-x-2">
                                {variables.map(v => {
                                    const vIcon = VARIABLE_CONFIG[v]?.icon || Info;
                                    return (
                                        <div key={v} className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                                            {React.createElement(vIcon, { className: "h-3 w-3 text-muted-foreground" })}
                                        </div>
                                    );
                                })}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="text-xs">{variables.length} variáveis disponíveis para este template</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <div className="grid lg:grid-cols-5 gap-8">
                <div className="lg:col-span-3 space-y-4">
                    <div className="relative group">
                        <div className="flex justify-between items-end mb-2">
                            <Label htmlFor={`textarea-${status}`} className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1 block">
                                Edição da Mensagem
                            </Label>

                            <AIModal status={status} onGenerate={onAIGenerate} generatingAI={generatingAI} />
                        </div>
                        <div className="relative group/editor">
                            {/* Visual Layer for Pills behind the transparent textarea */}
                            <div
                                id={`visual-layer-${status}`}
                                className="absolute inset-0 p-6 text-base font-medium leading-relaxed z-0 whitespace-pre-wrap break-words overflow-hidden border-2 border-transparent pointer-events-none"
                                style={{
                                    fontFamily: 'inherit',
                                    letterSpacing: 'inherit'
                                }}
                            >
                                {visualParts || <span className="text-muted-foreground/30">{"Olá {{cliente}}, seu pedido #{{order_number}}..."}</span>}
                            </div>

                            <Textarea
                                id={`textarea-${status}`}
                                placeholder="Olá {{cliente}}, seu pedido #{{order_number}}..."
                                className="min-h-[250px] text-base font-medium leading-relaxed rounded-3xl border-2 focus:ring-8 focus:ring-primary/5 transition-all resize-none shadow-sm p-6 bg-transparent relative z-10 text-transparent caret-foreground selection:bg-primary/20"
                                style={{
                                    fontFamily: 'inherit',
                                    letterSpacing: 'inherit'
                                }}
                                value={templateValue}
                                onChange={(e) => onTemplateChange(e.target.value)}
                                onKeyDown={(e) => {
                                    const textarea = e.target as HTMLTextAreaElement;
                                    const cursorPos = textarea.selectionStart;
                                    const text = templateValue;

                                    // Find all variable positions
                                    const variableRegex = /{{.*?}}/g;
                                    let match;
                                    const variables: { start: number, end: number, text: string }[] = [];
                                    while ((match = variableRegex.exec(text)) !== null) {
                                        variables.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
                                    }

                                    // Check if cursor is inside or at the edge of a variable
                                    for (const v of variables) {
                                        // Backspace at the end of a variable -> delete entire variable
                                        if (e.key === 'Backspace' && cursorPos === v.end) {
                                            e.preventDefault();
                                            const newText = text.substring(0, v.start) + text.substring(v.end);
                                            onTemplateChange(newText);
                                            setTimeout(() => {
                                                textarea.setSelectionRange(v.start, v.start);
                                            }, 0);
                                            return;
                                        }

                                        // Delete at the start of a variable -> delete entire variable
                                        if (e.key === 'Delete' && cursorPos === v.start) {
                                            e.preventDefault();
                                            const newText = text.substring(0, v.start) + text.substring(v.end);
                                            onTemplateChange(newText);
                                            return;
                                        }

                                        // Cursor is inside a variable -> jump out
                                        if (cursorPos > v.start && cursorPos < v.end) {
                                            if (e.key === 'Backspace' || e.key === 'Delete') {
                                                e.preventDefault();
                                                const newText = text.substring(0, v.start) + text.substring(v.end);
                                                onTemplateChange(newText);
                                                setTimeout(() => {
                                                    textarea.setSelectionRange(v.start, v.start);
                                                }, 0);
                                                return;
                                            }
                                            // For any other key (typing), jump cursor to the end of the variable
                                            if (e.key.length === 1) {
                                                e.preventDefault();
                                                const newText = text.substring(0, v.end) + e.key + text.substring(v.end);
                                                onTemplateChange(newText);
                                                setTimeout(() => {
                                                    textarea.setSelectionRange(v.end + 1, v.end + 1);
                                                }, 0);
                                                return;
                                            }
                                        }
                                    }
                                }}
                                onScroll={(e) => {
                                    const visualLayer = document.getElementById(`visual-layer-${status}`);
                                    if (visualLayer) {
                                        visualLayer.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
                                    }
                                }}
                                onDrop={(e) => {
                                    const data = e.dataTransfer.getData("text/plain");
                                    if (data.startsWith("{{") && data.endsWith("}}")) {
                                        const varName = data.replace(/{{|}}/g, "");
                                        onInsertVariable(varName);
                                    }
                                }}
                            />
                        </div>
                        <div className="absolute bottom-4 right-4 text-[10px] font-bold text-muted-foreground/50 pointer-events-none group-focus-within:text-primary/50 transition-colors uppercase tracking-widest">
                            {templateValue?.length || 0} caracteres
                        </div>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-900/40 p-5 rounded-[2rem] border-2 border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4 flex items-center gap-2 ml-1">
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Variáveis Disponíveis
                        </h5>
                        <div className="flex flex-wrap gap-2">
                            {variables.map(v => {
                                const cfg = VARIABLE_CONFIG[v];
                                const VIcon = cfg?.icon || Info;
                                return (
                                    <button
                                        key={v}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData("text/plain", `{{${v}}}`);
                                        }}
                                        className="group relative flex items-center gap-2 px-3 py-2 bg-background border-2 border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-primary hover:bg-primary/5 transition-all active:scale-95 cursor-grab active:cursor-grabbing"
                                        onClick={() => onInsertVariable(v)}
                                    >
                                        <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 group-hover:bg-primary/10 transition-colors">
                                            <VIcon className="h-3 w-3 text-zinc-600 dark:text-zinc-400 group-hover:text-primary" />
                                        </div>
                                        <div className="flex flex-col items-start leading-none pr-1">
                                            <span className="text-[10px] font-black tracking-tight">{cfg?.label || v}</span>
                                            <span className="text-[8px] font-bold text-muted-foreground opacity-50">{`{{${v}}}`}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="mt-4 text-[9px] text-muted-foreground/60 text-center font-medium italic">
                            Dica: Clique em uma variável para inseri-la onde o cursor estiver.
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1 mb-2 block">
                        Prévia no WhatsApp
                    </Label>
                    <div className="bg-[#e5ddd5] dark:bg-[#0b141a] rounded-3xl p-4 h-[400px] shadow-inner relative overflow-hidden border-4 border-zinc-200 dark:border-zinc-800">
                        {/* WhatsApp Header Mockup */}
                        <div className="absolute top-0 left-0 right-0 h-12 bg-[#075e54] dark:bg-[#202c33] flex items-center px-4 gap-3 z-10 shadow-md">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-[1.5px] flex items-center justify-center shadow-sm">
                                <div className="h-full w-full rounded-full bg-zinc-900 flex items-center justify-center">
                                    <Bot className="h-5 w-5 text-white" />
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="text-xs font-bold text-white">Assistente Virtual Gabi</div>
                                <div className="text-[10px] text-white/70">Online agora</div>
                            </div>
                        </div>

                        {/* Chat area */}
                        <div className="mt-12 space-y-4 overflow-y-auto h-full pt-4 pb-12 scrollbar-none">
                            <div className="bg-white dark:bg-[#1f2c33] rounded-2xl rounded-tl-none p-3 shadow-sm max-w-[85%] animate-in fade-in slide-in-from-left-2 duration-500">
                                <VisualMessage text={templateValue} />
                                <div className="text-[10px] text-muted-foreground text-right mt-1">
                                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>

                        {/* Input area mockup */}
                        <div className="absolute bottom-0 left-0 right-0 h-14 bg-[#f0f2f5] dark:bg-[#111b21] flex items-center px-4 gap-2 border-t dark:border-zinc-800">
                            <div className="flex-1 bg-white dark:bg-[#2a3942] h-9 rounded-full" />
                            <div className="h-9 w-9 rounded-full bg-[#00a884] flex items-center justify-center text-white">
                                <MessageCircle className="h-5 w-5" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex gap-3 italic">
                        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed text-primary/80">
                            Os valores acima são apenas exemplos para a prévia. No envio real, a Gabi usará os dados corretos de cada pedido.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
});
TemplateEditor.displayName = "TemplateEditor";


// ============ MAIN COMPONENT ============
const GabiSettings = () => {
    const { profile, supabase, session } = useSession();
    const [loading, setLoading] = useState(false);
    const [templates, setTemplates] = useState<Record<string, string>>({});
    const [generatingAI, setGeneratingAI] = useState<Record<string, boolean>>({});

    // Company details
    const [companyParams, setCompanyParams] = useState({
        business_hours: "",
        address_street: "",
        address_number: "",
        address_city: ""
    });

    // Boss Config (Gabi Executiva)
    const [bossConfig, setBossConfig] = useState({
        group_id: "",
        enabled: true,
        alert_types: ['payment', 'inactivity', 'error'] as string[]
    });

    // Default template for Order Summary if none exists
    const DEFAULT_SUMMARY_TEMPLATE = `*PEDIDO #{{order_number}}*
{{data_criacao}}

------------------------------------------
*{{cliente}}*
Tel: {{telefone}}
------------------------------------------

{{itens}}

{{servicos}}

------------------------------------------
*TOTAL: {{total}}*
{{entrega_info}}
STATUS: {{status}}

*** AGRADECEMOS A PREFERÊNCIA ***`;

    useEffect(() => {
        if (profile) {
            const currentTemplates = profile.gabi_templates || {};
            // Ensure order_summary has a default if missing
            if (!currentTemplates["order_summary"]) {
                currentTemplates["order_summary"] = DEFAULT_SUMMARY_TEMPLATE;
            }
            setTemplates(currentTemplates);

            setCompanyParams({
                business_hours: profile.company_business_hours || "",
                address_street: profile.company_address_street || "",
                address_number: profile.company_address_number || "",
                address_city: profile.company_address_city || ""
            });

            setBossConfig({
                group_id: profile.whatsapp_boss_group_id || "",
                enabled: profile.whatsapp_boss_notifications_enabled ?? true,
                alert_types: profile.whatsapp_boss_alert_types || ['payment', 'inactivity', 'error']
            });
        }
    }, [profile]);

    const handleSave = async () => {
        if (!session?.user.id) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .update({
                    gabi_templates: templates,
                    company_business_hours: companyParams.business_hours,
                    company_address_street: companyParams.address_street,
                    company_address_number: companyParams.address_number,
                    company_address_city: companyParams.address_city,
                    whatsapp_boss_group_id: bossConfig.group_id,
                    whatsapp_boss_notifications_enabled: bossConfig.enabled,
                    whatsapp_boss_alert_types: bossConfig.alert_types
                })
                .eq("id", session.user.id);

            if (error) throw error;
            showSuccess("Configurações da Gabi salvas com sucesso!");
        } catch (error: any) {
            showError(`Erro ao salvar: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleTestAlert = async () => {
        if (!bossConfig.group_id) {
            showError("Informe o ID do Grupo antes de testar!");
            return;
        }

        try {
            console.log("[Test] Sending mock insight to database...");
            const { data, error } = await supabase
                .from('agent_insights')
                .insert({
                    user_id: session?.user.id,
                    insight_type: 'executive_alert',
                    title: 'Teste Gabi Executiva 🎩',
                    description: '🚀 *Teste de Conexão Gabi Executiva!*\n\nSe você recebeu isso, sua secretária particular já está pronta para te manter informado nos bastidores. 🎩✨',
                    confidence: 1.0,
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;

            showSuccess("Insight criado! Tentando disparo direto para garantir...");

            // Tentativa de disparo direto via Edge Function para ignorar delay de trigger
            const funcUrl = "https://zdbjzrpgliqicwvncfpc.supabase.co/functions/v1/gabi-executiva-agent";
            await fetch(funcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    type: 'INSERT',
                    table: 'agent_insights',
                    record: data
                })
            });

            showSuccess("Alerta de teste processado! Verifique seu WhatsApp.");
        } catch (error: any) {
            console.error("Test Error:", error);
            showError("Erro no teste: " + error.message);
        }
    };

    const updateTemplate = useCallback((status: string, value: string) => {
        setTemplates(prev => ({ ...prev, [status]: value }));
    }, []);

    const insertVariable = useCallback((status: string, variable: string) => {
        const textarea = document.getElementById(`textarea-${status}`) as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = templates[status] || "";
        const variableText = `{{${variable}}}`;
        const newText = text.substring(0, start) + variableText + text.substring(end);

        updateTemplate(status, newText);

        // Focus back and set cursor position after render
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + variableText.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 50);
    }, [templates, updateTemplate]);

    const handleGenerateAI = useCallback(async (status: string, prompt: string) => {
        if (!prompt) return false;

        setGeneratingAI(prev => ({ ...prev, [status]: true }));
        try {
            const isSummary = status === "order_summary";
            const systemPrompt = `Você é um especialista em escrita para WhatsApp. 
            Crie um template de mensagem para o status "${status}".
            Use as variáveis disponíveis: ${Object.keys(VARIABLE_CONFIG).map(v => `{{${v}}}`).join(", ")}.
            Regras:
            ${isSummary ? '- Mantenha TODAS as informações financeiras e de lista (itens, serviços, totais).' : '- Seja curto e direto.'}
            ${isSummary ? '- NÃO remova as variáveis de lista {{itens}} e {{servicos}} se elas já existirem no texto atual.' : ''}
            - Use emojis.
            - Coloque em negrito dados importantes apenas (como número do pedido ou totais).
            - Se o usuário pedir mudanças (ex: "mais formal"), refine o texto atual ou crie um novo seguindo a instrução.
            O texto atual é: "${templates[status] || ""}"
            O pedido do cliente é: "${prompt}"
            Retorne APENAS o texto da mensagem, sem explicações.`;

            const { data, error } = await supabase.functions.invoke('openai-proxy', {
                body: {
                    messages: [{ role: 'system', content: systemPrompt }],
                    model: 'gpt-4o-mini',
                    temperature: 0.7
                }
            });

            if (error) throw error;

            const text = data.choices[0].message.content.trim();
            updateTemplate(status, text);
            showSuccess("Template gerado com sucesso!");
            return true;
        } catch (error: any) {
            showError(`Erro na IA: ${error.message}`);
            return false;
        } finally {
            setGeneratingAI(prev => ({ ...prev, [status]: false }));
        }
    }, [templates, supabase, updateTemplate]);

    return (
        <div className="container max-w-6xl mx-auto py-8 space-y-8 pb-32">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    <div className="h-16 w-16 rounded-3xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/40 shrink-0 transform -rotate-3 hover:rotate-0 transition-transform cursor-pointer">
                        <Bot className="h-10 w-10 text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter leading-none mb-1">Cérebro da Gabi</h1>
                        <p className="text-muted-foreground font-medium">Configure as mensagens automáticas e dados da sua empresa.</p>
                    </div>
                </div>
                <Button onClick={handleSave} disabled={loading} className="shrink-0 h-14 px-10 rounded-2xl font-black text-lg gap-3 shadow-xl shadow-primary/30 transition-all hover:scale-105 active:scale-95">
                    {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-5 w-5" />}
                    Salvar Alterações
                </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-2 rounded-[2.5rem] shadow-lg overflow-hidden translate-y-0 hover:-translate-y-1 transition-transform">
                    <CardHeader className="bg-muted/30 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10">
                                <MapPin className="h-5 w-5 text-primary" />
                            </div>
                            <CardTitle className="text-lg font-black tracking-tight">Onde sua loja fica?</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2 space-y-1.5">
                                <Label className="text-[10px] uppercase font-black tracking-widest opacity-60">Rua / Avenida</Label>
                                <Input
                                    placeholder="Ex: Av. Brasil"
                                    className="rounded-xl h-12"
                                    value={companyParams.address_street}
                                    onChange={e => setCompanyParams(p => ({ ...p, address_street: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black tracking-widest opacity-60">Número</Label>
                                <Input
                                    placeholder="123"
                                    className="rounded-xl h-12"
                                    value={companyParams.address_number}
                                    onChange={e => setCompanyParams(p => ({ ...p, address_number: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-black tracking-widest opacity-60">Cidade</Label>
                            <Input
                                placeholder="Sua Cidade"
                                className="rounded-xl h-12"
                                value={companyParams.address_city}
                                onChange={e => setCompanyParams(p => ({ ...p, address_city: e.target.value }))}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-2 rounded-[2.5rem] shadow-lg overflow-hidden translate-y-0 hover:-translate-y-1 transition-transform">
                    <CardHeader className="bg-muted/30 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10">
                                <Clock className="h-5 w-5 text-primary" />
                            </div>
                            <CardTitle className="text-lg font-black tracking-tight">Quando você atende?</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-black tracking-widest opacity-60">Horário de Funcionamento</Label>
                            <Input
                                placeholder="Ex: Seg a Sex das 08h às 18h"
                                className="rounded-xl h-12"
                                value={companyParams.business_hours}
                                onChange={e => setCompanyParams(p => ({ ...p, business_hours: e.target.value }))}
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                            Esse texto aparecerá sempre que você usar a variável <code className="bg-muted px-1 rounded text-primary font-bold">horario_empresa</code>.
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="pago" className="w-full">
                <TabsList className="flex flex-wrap w-full h-auto min-h-[64px] p-1.5 bg-muted/50 rounded-3xl border-2 mb-8 gap-2">
                    <TabsTrigger value="pago" className="flex-1 min-w-[120px] rounded-2xl font-black gap-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:text-primary transition-all uppercase tracking-tighter py-2.5">
                        <CheckCircle className="h-4 w-4" /> Pago
                    </TabsTrigger>
                    <TabsTrigger value="aguardando retirada" className="flex-1 min-w-[120px] rounded-2xl font-black gap-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:text-primary transition-all uppercase tracking-tighter py-2.5">
                        <Smartphone className="h-4 w-4" /> Retirada
                    </TabsTrigger>
                    <TabsTrigger value="enviado" className="flex-1 min-w-[120px] rounded-2xl font-black gap-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:text-primary transition-all uppercase tracking-tighter py-2.5">
                        <Truck className="h-4 w-4" /> Enviado
                    </TabsTrigger>
                    <TabsTrigger value="order_summary" className="flex-1 min-w-[120px] rounded-2xl font-black gap-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:text-primary transition-all uppercase tracking-tighter py-2.5">
                        <List className="h-4 w-4" /> Resumo
                    </TabsTrigger>
                    <TabsTrigger value="gabi_executiva" className="flex-1 min-w-[120px] rounded-2xl font-black gap-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:text-primary transition-all uppercase tracking-tighter py-2.5">
                        <ShieldCheck className="h-4 w-4" /> Executiva
                    </TabsTrigger>
                </TabsList>

                <Card className="border-2 shadow-2xl rounded-[3rem] overflow-hidden">
                    <CardContent className="p-10">
                        <TabsContent value="pago">
                            <TemplateEditor
                                status="pago"
                                label="Confirmação de Pagamento"
                                icon={CheckCircle}
                                description="Disparado quando o pagamento é confirmado."
                                variables={["cliente", "order_number", "total", "itens", "horario_empresa"]}
                                templateValue={templates["pago"] || ""}
                                onTemplateChange={(val) => updateTemplate("pago", val)}
                                onInsertVariable={(v) => insertVariable("pago", v)}
                                onAIGenerate={handleGenerateAI}
                                generatingAI={generatingAI["pago"] || false}
                            />
                        </TabsContent>

                        <TabsContent value="aguardando retirada">
                            <TemplateEditor
                                status="aguardando retirada"
                                label="Pronto para Retirada"
                                icon={Smartphone}
                                description="Disparado quando o cliente pode vir buscar o pedido."
                                variables={["cliente", "order_number", "itens", "endereco_empresa", "horario_empresa"]}
                                templateValue={templates["aguardando retirada"] || ""}
                                onTemplateChange={(val) => updateTemplate("aguardando retirada", val)}
                                onInsertVariable={(v) => insertVariable("aguardando retirada", v)}
                                onAIGenerate={handleGenerateAI}
                                generatingAI={generatingAI["aguardando retirada"] || false}
                            />
                        </TabsContent>

                        <TabsContent value="enviado">
                            <TemplateEditor
                                status="enviado"
                                label="Código de Rastreio"
                                icon={Truck}
                                description="Disparado quando o pedido sai para entrega."
                                variables={["cliente", "order_number", "itens", "total", "tracking_code"]}
                                templateValue={templates["enviado"] || ""}
                                onTemplateChange={(val) => updateTemplate("enviado", val)}
                                onInsertVariable={(v) => insertVariable("enviado", v)}
                                onAIGenerate={handleGenerateAI}
                                generatingAI={generatingAI["enviado"] || false}
                            />
                        </TabsContent>

                        <TabsContent value="order_summary">
                            <TemplateEditor
                                status="order_summary"
                                label="Resumo do Pedido"
                                icon={List}
                                description="Modelo usado no botão 'WhatsApp' dos detalhes do pedido."
                                variables={["cliente", "telefone", "order_number", "data_criacao", "itens", "servicos", "total", "entrega_info", "status", "tracking_code", "endereco_empresa"]}
                                templateValue={templates["order_summary"] || ""}
                                onTemplateChange={(val) => updateTemplate("order_summary", val)}
                                onInsertVariable={(v) => insertVariable("order_summary", v)}
                                onAIGenerate={handleGenerateAI}
                                generatingAI={generatingAI["order_summary"] || false}
                            />
                        </TabsContent>

                        <TabsContent value="gabi_executiva">
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-2xl bg-primary/10">
                                            <ShieldCheck className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-xl tracking-tight">Gabi Executiva 🎩</h4>
                                            <p className="text-sm text-muted-foreground">Sua assistente proativa que cuida dos bastidores.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-2xl">
                                        <Label htmlFor="gabi-enabled" className="text-xs font-bold">Monitoramento Ativo</Label>
                                        <Switch
                                            id="gabi-enabled"
                                            checked={bossConfig.enabled}
                                            onCheckedChange={(val) => setBossConfig(p => ({ ...p, enabled: val }))}
                                        />
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Para quem enviar? (Grupo ou Número)</Label>
                                            <div className="relative">
                                                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Ex: 12036312345678@g.us (ou apenas o número longo)"
                                                    className="pl-11 h-14 rounded-2xl border-2"
                                                    value={bossConfig.group_id}
                                                    onChange={e => setBossConfig(p => ({ ...p, group_id: e.target.value }))}
                                                />
                                            </div>
                                            <p className="text-[10px] text-muted-foreground ml-2 italic">
                                                Dica: O ID de grupo no WhatsApp costuma ser bem longo e terminar em @g.us. Você pode encontrá-lo nos logs da Evolution API ou me perguntar!
                                            </p>
                                        </div>

                                        <div className="bg-zinc-50 dark:bg-zinc-900/40 p-6 rounded-[2rem] border-2 border-zinc-200 dark:border-zinc-800">
                                            <h5 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                                                <Bell className="h-4 w-4 text-primary" /> Tipos de Alertas
                                            </h5>
                                            <div className="grid gap-4">
                                                {[
                                                    { id: 'payment', label: 'Dinheiro no Bolso', desc: 'Notifica quando um cliente paga o pedido.', icon: DollarSign },
                                                    { id: 'inactivity', label: 'Vendas Perdidas', desc: 'Notifica se alguém ficar sem resposta por mais de 2h.', icon: Clock },
                                                    { id: 'sales', label: 'Resumo Diário', desc: 'Um pequeno dashboard do dia enviado à noite.', icon: Activity },
                                                ].map(type => (
                                                    <div key={type.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-background transition-colors cursor-pointer"
                                                        onClick={() => {
                                                            const exists = bossConfig.alert_types.includes(type.id);
                                                            const newTypes = exists
                                                                ? bossConfig.alert_types.filter(t => t !== type.id)
                                                                : [...bossConfig.alert_types, type.id];
                                                            setBossConfig(p => ({ ...p, alert_types: newTypes }));
                                                        }}
                                                    >
                                                        <Checkbox
                                                            checked={bossConfig.alert_types.includes(type.id)}
                                                            className="mt-1"
                                                        />
                                                        <div className="flex-1 space-y-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <type.icon className="h-3.5 w-3.5 text-primary" />
                                                                <span className="text-sm font-bold">{type.label}</span>
                                                            </div>
                                                            <p className="text-[11px] text-muted-foreground">{type.desc}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1 block">
                                            Exemplo de Notificação
                                        </Label>
                                        <div className="bg-[#e5ddd5] dark:bg-[#0b141a] rounded-3xl p-4 h-[350px] shadow-inner relative overflow-hidden border-4 border-zinc-200 dark:border-zinc-800">
                                            <div className="absolute top-0 left-0 right-0 h-12 bg-[#075e54] dark:bg-[#202c33] flex items-center px-4 gap-3 z-10">
                                                <ShieldCheck className="h-6 w-6 text-white" />
                                                <div className="text-xs font-bold text-white">Gabi Executiva 🎩</div>
                                            </div>
                                            <div className="mt-12 space-y-4 pt-4">
                                                <div className="bg-white dark:bg-[#1f2c33] rounded-2xl rounded-tl-none p-4 shadow-sm max-w-[90%]">
                                                    <p className="text-sm font-medium leading-relaxed">
                                                        *Chefe, olha só!* 🚀<br /><br />
                                                        O cliente *Gabriel* acaba de pagar o pedido *#1245*. <br />
                                                        💰 O valor de *R$ 450,00* já caiu!<br /><br />
                                                        _Deseja que eu envie a mensagem de agradecimento agora?_
                                                    </p>
                                                    <div className="text-[10px] text-muted-foreground text-right mt-1">20:39</div>
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="w-full h-12 rounded-2xl border-2 font-black gap-2 hover:bg-primary hover:text-white transition-all"
                                            onClick={handleTestAlert}
                                        >
                                            <Smartphone className="h-4 w-4" /> Testar Envio Agora
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </CardContent>
                </Card>
            </Tabs>
        </div>
    );
};

export default GabiSettings;
