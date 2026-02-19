import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Send, X, Bot, Sparkles, Mic, Paperclip, Share2, Calculator, Settings, Volume2, Maximize2, Minimize2, Image as ImageIcon, User, Check, ShoppingBag, Loader2, LayoutGrid, CheckCircle2, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getOpenAIClient, type ChatMessage } from '@/integrations/openai/client';
import { openAIFunctions, callOpenAIFunction } from '@/integrations/openai/aiTools';
import { useToast } from '@/hooks/use-toast';
import { formatMessage } from "../utils/messageFormatter";
import { AudioRecorder } from './AudioRecorder';
import { AudioMessageDisplay } from "./AudioMessageDisplay";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { logAIError } from '@/utils/logger';
import { DTFCalculatorModal } from './DTFCalculatorModal';
import { cn } from '@/lib/utils';
import { AgentMemoryManager, type AgentMemory, type AgentInsight } from '@/utils/agentMemory';
import { generateReActSystemPrompt } from '@/utils/agentPrompts';
import { useAIAssistant } from '@/contexts/AIAssistantProvider';
import { LiveGabi } from './LiveGabi';
import { LiveGabiGemini } from './LiveGabiGemini';

export const AIAssistant = () => {
  const { isOpen, close: closeAssistant } = useAIAssistant();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [calcData, setCalcData] = useState<any>(null);
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [insights, setInsights] = useState<AgentInsight[]>([]);
  const [memoryManager, setMemoryManager] = useState<AgentMemoryManager | null>(null);
  const [suggestedActions, setSuggestedActions] = useState<string[]>(["Novo pedido", "Resumo do dia", "Estoque baixo?", "Clientes inativos", "Criar cliente"]);
  const [isLive, setIsLive] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const initAI = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const manager = new AgentMemoryManager(user.id);
        setMemoryManager(manager);

        // Carregar memórias e insights iniciais
        try {
          const [loadedMemories, loadedInsights] = await Promise.all([
            manager.getRelevantMemories(10, 0, ''),
            manager.getActiveInsights()
          ]);
          setMemories(loadedMemories);
          setInsights(loadedInsights);
        } catch (err) {
          console.error('❌ [AIAssistant] Erro ao carregar memórias:', err);
        }
      }
    };
    initAI();
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      if (messages.length === 0) {
        setMessages([{
          role: 'assistant',
          content: '👋 **Olá! Sou a Gabi!** Como posso ajudar hoje?\n\n[CARD]\n💡 **O que posso fazer:**\n- "pedidos do João" ou "pedido #43"\n- "gerar PDF do pedido 43"\n- "pedidos pendentes"\n- "qual é 10% do total de vendas?" 🔢\n[/CARD]\n\n[TIP]🎤 **Dica:** Mantenha o microfone pressionado para gravar[/TIP]'
        }]);
      }
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Listener para eventos externos (ex: clique no Dashboard para cobrar)
  useEffect(() => {
    const handleTrigger = (event: CustomEvent<string>) => {
      if (!isOpen) {
        // Se estiver fechado, não conseguimos abrir daqui pois quem controla o isOpen é o Contexto.
        // Mas quem dispara o evento (Widget) deve chamar open() antes.
        // Apenas garantimos que vamos processar.
      }

      const message = event.detail;
      if (message) {
        handleSendMessage(message);
      }
    };

    window.addEventListener('trigger-ai-message' as any, handleTrigger as any);
    return () => {
      window.removeEventListener('trigger-ai-message' as any, handleTrigger as any);
    };
  }, [isOpen]); // Dependência isOpen para garantir contexto atualizado, embora handleSendMessage seja estável

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setLoadingStatus("Gabi está pensando...");

    try {
      const openai = await getOpenAIClient();

      // Gerar system prompt dinâmico com ReAct e memórias
      const systemPrompt = generateReActSystemPrompt(memories, insights);

      const allMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages,
        userMessage
      ];

      // Usar sendMessage do nosso OpenAIClient (que trata o proxy e ReAct corretamente)
      let response = await openai.sendMessage(allMessages, openAIFunctions);

      // Loop de ReAct para lidar com chamadas de função
      let iterations = 0;
      const MAX_ITERATIONS = 5;

      while (response.function_call && iterations < MAX_ITERATIONS) {
        iterations++;
        const functionName = response.function_call.name;
        const functionArgs = response.function_call.arguments;

        console.log(`🎬 [AIAssistant] Executando função: ${functionName}`, functionArgs);

        // Atualizar status para o usuário saber o que está acontecendo
        if (functionName.includes('order') || functionName.includes('service')) {
          setLoadingStatus("Consultando o banco de pedidos...");
        } else if (functionName.includes('client')) {
          setLoadingStatus("Buscando informações do cliente...");
        } else if (functionName.includes('calculate')) {
          setLoadingStatus("Fazendo os cálculos para você...");
        }

        const functionResult = await callOpenAIFunction({ name: functionName, arguments: functionArgs });

        // EXCLUSIVO: Invalidação de queries em tempo real para Branding
        if (functionName === 'update_branding') {
          console.log("🎨 [AIAssistant] Branding alterado, invalidando queries...");
          queryClient.invalidateQueries({ queryKey: ['companyProfile'] });
        }

        setLoadingStatus("Gabi está finalizando a resposta...");

        const assistantFunctionCall: ChatMessage = {
          role: 'assistant',
          content: null,
          function_call: {
            name: functionName,
            arguments: JSON.stringify(functionArgs)
          }
        };

        const functionResponse: ChatMessage = {
          role: 'function',
          name: functionName,
          content: JSON.stringify(functionResult)
        };

        setMessages(prev => [...prev, assistantFunctionCall, functionResponse]);
        allMessages.push(assistantFunctionCall, functionResponse);

        response = await openai.sendMessage(allMessages, openAIFunctions);
      }

      if (response.content) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.content || ''
        }]);

        // Extrair sugestões dinâmicas da resposta (perguntas no final)
        const suggestions = response.content.match(/([A-Z][^.!?]*\?)/g);
        if (suggestions && suggestions.length > 0) {
          // Pegar as últimas 3 perguntas como sugestões, limpando pontuação extra
          const cleanSuggestions = suggestions.slice(-3).map(s => s.trim().replace(/^\?+|\?+$/g, '') + '?');
          setSuggestedActions(cleanSuggestions);
        } else {
          // Fallback para sugestões padrão se não houver perguntas
          setSuggestedActions(["Novo pedido", "Resumo do dia", "Estoque baixo?", "Clientes inativos", "Criar cliente"]);
        }

        // Extrair memórias de forma proativa se o gerenciador estiver pronto
        if (memoryManager && typeof userMessage.content === 'string') {
          memoryManager.extractMemoriesFromConversation(userMessage.content, response.content || '')
            .catch(err => console.error('🧠 [AIAssistant] Erro ao extrair memórias:', err));
        }
      } else if (!response.function_call) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "Desculpe, tive um problema ao processar. Poderia repetir? 😅"
        }]);
      }
    } catch (error: any) {
      console.error("❌ [AIAssistant] Erro:", error);
      logAIError(error, "handleSendMessage");
      toast({
        title: "Erro ao processar mensagem",
        description: error.message || "Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioRecorded = (transcription: string, blob: Blob) => {
    setLoadingStatus("Transcrevendo...");
    const audioUrl = URL.createObjectURL(blob);
    const userMessage: ChatMessage = { role: 'user', content: transcription, audioUrl };
    setMessages(prev => [...prev, userMessage]);
    handleSendMessage(transcription);
  };

  const handleCreateOrder = async (result: any) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .insert([{
          cliente_id: result.data.client.id,
          status: 'pendente',
          total: 0,
          metriagem_total: result.data.items.reduce((acc: number, item: any) => acc + (item.meters || 0), 0),
          data_entrega: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Pedido Criado!",
        description: `O rascunho do pedido para ${result.data.client.nome} foi salvo com sucesso.`,
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Pedido #${data.id.slice(0, 8)} criado com sucesso! Você pode visualizá-lo na tela de pedidos.`
      }]);
    } catch (error: any) {
      logAIError(error, 'AIAssistant create order');
      toast({
        title: "Erro ao criar pedido",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7, y: 40, x: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: 40, x: 20 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          style={{ originX: 1, originY: 1 }}
          className="fixed inset-x-0 bottom-0 md:inset-auto md:right-6 md:bottom-6 z-[60] p-0 md:p-0"
        >
          <Card className={cn(
            "flex flex-col shadow-2xl border-white/20 dark:bg-zinc-950/20 backdrop-blur-40 transition-all duration-300 overflow-hidden ring-1 ring-white/10",
            isMinimized
              ? "h-16 w-full md:w-72 rounded-t-3xl md:rounded-2xl"
              : "h-[90vh] md:h-[600px] w-full md:w-[420px] rounded-t-[2.5rem] md:rounded-3xl"
          )}>
            <CardHeader className="flex flex-row items-center justify-between p-4 border-b border-white/5 bg-white/5 backdrop-blur-40 pt-safe">
              <div className="flex items-center gap-3">
                <div className="p-0.5 rounded-full bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] shadow-lg">
                  <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black uppercase tracking-widest text-white">Gabi AI</span>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Escalando seu negócio</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8 transition-all",
                    isLive ? "text-primary animate-pulse" : "text-zinc-400 hover:text-white"
                  )}
                  title={isLive ? "Sair do Modo Ao Vivo" : "Gabi Ao Vivo (Voz)"}
                  onClick={() => setIsLive(!isLive)}
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-400 hover:text-red-500"
                  title="Resetar Memória"
                  onClick={() => {
                    const confirm = window.prompt("Para apagar todo o meu aprendizado sobre você, digite 'confirmar':");
                    if (confirm === 'confirmar') {
                      handleSendMessage("reset_user_memory(confirmation: 'confirmar')");
                    }
                  }}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={() => setIsMinimized(!isMinimized)}>
                  {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={() => closeAssistant()}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            {!isMinimized && (
              <>
                {isLive ? (
                  <div className="flex-1 flex flex-col justify-center backdrop-blur-40">
                    <LiveGabiGemini
                      onClose={() => setIsLive(false)}
                      onTranscript={(text, role) => {
                        if (role === 'assistant' || role === 'user') {
                          setMessages(prev => [...prev, { role, content: text }]);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 backdrop-blur-40">
                      {messages.map((msg, idx) => (
                        <div key={idx} className={cn("flex flex-col gap-2", msg.role === 'user' ? "items-end" : "items-start")}>
                          {msg.role === 'user' ? (
                            <div className="max-w-[85%] p-3 rounded-2xl bg-primary text-primary-foreground font-bold rounded-br-none shadow-lg animate-in slide-in-from-right-4 fade-in duration-300">
                              <div className="flex items-start gap-2">
                                <div className="flex-1">
                                  {msg.audioUrl ? (
                                    <AudioMessageDisplay
                                      audioUrl={typeof msg.audioUrl === 'string' ? msg.audioUrl : ''}
                                      transcription={typeof msg.content === 'string' ? msg.content : ''}
                                      isUserMessage={true}
                                    />
                                  ) : (
                                    <div dangerouslySetInnerHTML={{ __html: formatMessage(typeof msg.content === 'string' ? msg.content : '') }} />
                                  )}
                                </div>
                                <User className="h-4 w-4 flex-shrink-0 mt-0.5 opacity-70" />
                              </div>
                            </div>
                          ) : msg.role === 'assistant' && msg.content ? (
                            <div className="max-w-[85%] rounded-2xl p-[1px] bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] shadow-lg shadow-purple-500/5 animate-in slide-in-from-left-4 fade-in duration-300">
                              <div className="bg-slate-900/95 backdrop-blur-xl rounded-[15px] p-3">
                                <div className="flex items-center gap-1.5 mb-1 opacity-60">
                                  <Bot className="w-3 h-3 text-orange-400" />
                                  <span className="text-[10px] font-black uppercase tracking-widest text-white">GABI AI</span>
                                </div>
                                <div
                                  className="text-sm text-slate-200 leading-relaxed font-medium space-y-1"
                                  dangerouslySetInnerHTML={{ __html: formatMessage(typeof msg.content === 'string' ? msg.content : '') }}
                                />
                              </div>
                            </div>
                          ) : msg.role === 'function' ? (
                            <div className="w-full max-w-[85%]">
                              {msg.name === 'create_order_draft' ? (
                                (() => {
                                  try {
                                    const content = typeof msg.content === 'string' ? msg.content : '';
                                    const result = JSON.parse(content);
                                    if (result.type === 'order_draft') {
                                      return (
                                        <div className="mt-2 border rounded-lg p-4 bg-white dark:bg-slate-950 shadow-sm">
                                          <div className="flex items-center gap-2 mb-3 border-b pb-2">
                                            <ShoppingBag className="h-5 w-5 text-primary" />
                                            <span className="font-semibold">Rascunho de Pedido</span>
                                          </div>
                                          <div className="space-y-2 text-sm mb-4">
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Cliente:</span>
                                              <span className="font-medium">{result.data.client?.nome || 'Não identificado'}</span>
                                            </div>
                                            {result.data.items.map((item: any, idx: number) => (
                                              <div key={idx} className="flex justify-between border-t pt-1 mt-1">
                                                <span>{item.quantity}x {item.productName}</span>
                                              </div>
                                            ))}
                                          </div>
                                          <Button className="w-full gap-2" onClick={() => handleCreateOrder(result)} disabled={isLoading || !result.data.client?.id}>
                                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                            Confirmar e Criar
                                          </Button>
                                        </div>
                                      );
                                    }
                                  } catch (e) { return null; }
                                })()
                              ) : msg.name === 'calculate_dtf_packing' ? (
                                (() => {
                                  try {
                                    const content = typeof msg.content === 'string' ? msg.content : '';
                                    const result = JSON.parse(content);
                                    if (result.type === 'dtf_calculation') {
                                      return (
                                        <div className="mt-2 bg-white dark:bg-slate-900 border-2 border-primary/20 rounded-xl shadow-lg overflow-hidden">
                                          <div className="bg-primary/5 p-3 border-b border-primary/10 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <Calculator className="h-4 w-4 text-primary" />
                                              <span className="font-bold text-sm">Orçamento DTF</span>
                                            </div>
                                          </div>
                                          <div className="p-4 space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                              <div className="bg-muted/50 p-2 rounded-lg text-center">
                                                <p className="text-[9px] uppercase font-bold text-muted-foreground">Total Metros</p>
                                                <p className="text-xl font-black text-primary">{result.data.results.totalMeters.toFixed(2)}m</p>
                                              </div>
                                              <div className="bg-muted/50 p-2 rounded-lg text-center">
                                                <p className="text-[9px] uppercase font-bold text-muted-foreground">Rendimento/m</p>
                                                <p className="text-xl font-black text-primary">{result.data.results.imagesPerMeter} un</p>
                                              </div>
                                            </div>
                                            <Button className="w-full gap-2 h-9 text-xs" onClick={() => { setCalcData(result.data); setIsCalcOpen(true); }}>
                                              <LayoutGrid className="h-4 w-4" />
                                              Ver Preview e Detalhes
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    }
                                  } catch (e) { return null; }
                                  return <div dangerouslySetInnerHTML={{ __html: formatMessage(typeof msg.content === 'string' ? msg.content : '') }} />;
                                })()
                              ) : msg.name === 'send_whatsapp_message' ? (
                                (() => {
                                  try {
                                    const content = typeof msg.content === 'string' ? msg.content : '';
                                    const result = JSON.parse(content);
                                    if (result.type === 'whatsapp_action' || result.type === 'whatsapp_direct_sent') {
                                      const isSent = result.type === 'whatsapp_direct_sent';

                                      return (
                                        <div className="mt-2 w-full max-w-[340px] animate-in zoom-in-95 duration-300">
                                          <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                                            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" />
                                            <div className="relative h-1 w-full bg-gradient-to-r from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7]" />

                                            <div className="relative p-4 space-y-4">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                  <div className={cn(
                                                    "p-1.5 rounded-lg",
                                                    isSent ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
                                                  )}>
                                                    {isSent ? <CheckCircle2 className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                                                  </div>
                                                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-200">
                                                    {isSent ? "Envio Realizado" : "Pronto para Enviar"}
                                                  </span>
                                                </div>
                                                {result.data.isPlus && (
                                                  <Badge className="bg-[#ffd93d]/10 text-[#ffd93d] border-[#ffd93d]/20 text-[8px] font-black h-4 px-1.5 uppercase tracking-tighter">
                                                    Plus Mode
                                                  </Badge>
                                                )}
                                              </div>

                                              <div className="space-y-1">
                                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Mensagem Preparada</p>
                                                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                                  <p className="text-xs text-slate-300 italic leading-relaxed">
                                                    "{result.data.message}"
                                                  </p>
                                                </div>
                                              </div>

                                              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium pb-1 border-b border-white/5">
                                                <span>Destinatário:</span>
                                                <span className="font-black text-slate-200 truncate ml-2">
                                                  {result.data.clientName || result.data.phone || 'Cliente'}
                                                </span>
                                              </div>

                                              {!isSent ? (
                                                <Button
                                                  className={cn(
                                                    "w-full h-11 transition-all hover:scale-[1.02] active:scale-[0.98] font-black uppercase tracking-widest text-[11px] gap-2 shadow-lg",
                                                    result.data.canSendDirectly
                                                      ? "bg-gradient-to-r from-[#FF6B6B] to-[#ffd93d] text-slate-950"
                                                      : "bg-emerald-500 hover:bg-emerald-600 text-white"
                                                  )}
                                                  disabled={isLoading}
                                                  onClick={async () => {
                                                    if (isLoading) return;
                                                    if (result.data.canSendDirectly && result.data.cleanPhone) {
                                                      setIsLoading(true);
                                                      setLoadingStatus("Gabi está enviando...");
                                                      try {
                                                        const { data: proxyResult, error: proxyError } = await supabase.functions.invoke('whatsapp-proxy', {
                                                          body: {
                                                            action: 'send-text',
                                                            phone: result.data.cleanPhone,
                                                            message: result.data.message
                                                          }
                                                        });

                                                        if (!proxyError && proxyResult?.success) {
                                                          toast({ title: "Mensagem enviada!", description: `Sua mensagem para ${result.data.clientName || 'o cliente'} foi enviada.` });
                                                          setMessages(prev => [...prev, {
                                                            role: 'assistant',
                                                            content: `✅ Acabei de enviar a mensagem para **${result.data.clientName || result.data.phone}**! Tudo certinho. 🚀`
                                                          }]);
                                                        } else {
                                                          throw new Error(proxyError?.message || "Erro no envio");
                                                        }
                                                      } catch (err) {
                                                        console.error("Erro no envio:", err);
                                                        toast({ title: "Erro no envio direto", description: "Tentando abrir o WhatsApp Web...", variant: "destructive" });
                                                        window.open(result.data.link, '_blank');
                                                      } finally {
                                                        setIsLoading(false);
                                                      }
                                                    } else {
                                                      window.open(result.data.link, '_blank');
                                                    }
                                                  }}
                                                >
                                                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 fill-current" />}
                                                  {result.data.canSendDirectly ? 'Confirmar Envio Direto' : 'Enviar via Link'}
                                                </Button>
                                              ) : (
                                                <div className="flex items-center justify-center gap-1.5 py-2 text-[10px] text-emerald-500 font-black uppercase tracking-widest">
                                                  <Bot className="h-4 w-4" />
                                                  Processado por Gabi AI
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                  } catch (e) { return null; }
                                  return null;
                                })()
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex gap-3 justify-start animate-in fade-in slide-in-from-left-2 duration-300">
                          <div className="p-0.5 rounded-full bg-gradient-to-br from-[#FF6B6B] to-[#6c5ce7]">
                            <div className="w-8 h-8 rounded-full bg-slate-950 flex items-center justify-center">
                              <Bot className="w-4 h-4 text-white animate-pulse" />
                            </div>
                          </div>
                          <div className="max-w-[85%] p-3 rounded-2xl text-sm bg-slate-900/80 backdrop-blur-md text-slate-200 border border-white/5 rounded-tl-none shadow-xl">
                            <div className="flex items-center gap-3">
                              <div className="flex space-x-1">
                                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              </div>
                              <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">{loadingStatus}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </CardContent>

                    <div className="px-4 pb-2 backdrop-blur-40">
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {suggestedActions.map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              setInput(s);
                              handleSendMessage(s);
                            }}
                            className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white/5 text-zinc-300 text-[11px] font-bold uppercase tracking-tight border border-white/10 hover:border-primary/50 hover:bg-primary/20 transition-all hover:scale-105 flex-shrink-0"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {!isLive && (
                  <CardFooter className="p-4 pt-2 border-t bg-muted/10 backdrop-blur-40">
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        placeholder="Digite sua pergunta..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !isLoading) {
                            handleSendMessage(input);
                          }
                        }}
                        disabled={isLoading}
                        className="flex-1"
                      />
                      {input.trim() === '' ? (
                        <AudioRecorder onAudioRecorded={handleAudioRecorded} disabled={isLoading} />
                      ) : (
                        <Button onClick={() => handleSendMessage(input)} disabled={isLoading || input.trim() === ''} size="icon" className="h-10 w-10 rounded-full">
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardFooter>
                )}
              </>
            )}

            <SubscriptionModal open={isUpgradeModalOpen} onOpenChange={setIsUpgradeModalOpen} />
            <DTFCalculatorModal isOpen={isCalcOpen} onClose={() => setIsCalcOpen(false)} initialData={calcData} />
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
