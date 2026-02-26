import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Send, X, Bot, Sparkles, Mic, Paperclip, Share2, Calculator, Settings, Volume2, Maximize2, Minimize2, Image as ImageIcon, User, Check, ShoppingBag, Loader2, LayoutGrid, CheckCircle2, Zap, MessageCircle, ExternalLink } from 'lucide-react';
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
    setLoadingStatus("Gabi está pesquisando no banco de dados...");

    try {
      // Chamar o Cérebro Unificado via Edge Function
      const { data, error: invokeError } = await supabase.functions.invoke('gabi-brain', {
        body: {
          message: content,
          history: messages.slice(-10) // Limitar histórico para performance
        }
      });

      if (invokeError) throw invokeError;

      // Adicionar passos intermediários ao histórico para renderização de UI (Cards, Previews, etc)
      if (data.intermediateSteps && data.intermediateSteps.length > 0) {
        const intermediateMessages: ChatMessage[] = [];

        data.intermediateSteps.forEach((step: any) => {
          // Mensagem do assistente chamando a função
          intermediateMessages.push({
            role: 'assistant',
            content: null,
            function_call: {
              name: step.tool,
              arguments: JSON.stringify(step.args)
            }
          });

          // Resposta da função
          intermediateMessages.push({
            role: 'function',
            name: step.tool,
            content: step.result
          });

          // Lógica especial de efeitos colaterais no frontend
          if (step.tool === 'update_branding') {
            queryClient.invalidateQueries({ queryKey: ['companyProfile'] });
          }
        });

        setMessages(prev => [...prev, ...intermediateMessages]);
      }

      // Adicionar resposta final
      if (data.text) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.text
        }]);

        // Sugestões dinâmicas
        const suggestions = data.text.match(/([A-Z][^.!?]*\?)/g);
        if (suggestions && suggestions.length > 0) {
          const cleanSuggestions = suggestions.slice(-3).map((s: string) => s.trim().replace(/^\?+|\?+$/g, '') + '?');
          setSuggestedActions(cleanSuggestions);
        }
      }

    } catch (error: any) {
      console.error("❌ [AIAssistant] Erro:", error);
      logAIError(error, "handleSendMessage");
      toast({
        title: "Erro ao processar mensagem",
        description: error.message || "Tente novamente.",
        variant: "destructive"
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Ops! Tive um problema de conexão com o meu cérebro. Pode tentar de novo? 🧠💨"
      }]);
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
                      {messages.map((msg, idx) => {
                        return (
                          <div key={idx} className={cn("flex flex-col gap-2", msg.role === 'user' ? "items-end" : "items-start")}>
                            {msg.role === 'user' ? (
                              <div className="flex flex-col gap-2 w-full items-end">
                                <div className="flex items-center gap-2 max-w-[85%] group">
                                  <div className="relative p-4 rounded-2xl bg-yellow-400 text-black font-bold shadow-lg rounded-tr-none animate-in slide-in-from-right-4 fade-in duration-300">
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
                              <div className="flex flex-col gap-2 w-full items-start">
                                <div className="flex items-center gap-2 mb-1 px-1">
                                  <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-[#FF6B6B] to-[#6c5ce7] flex items-center justify-center p-[1px] shadow-lg shadow-purple-500/20">
                                    <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                                      <Sparkles className="h-2.5 w-2.5 text-primary" strokeWidth={3} />
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Gabi Intelligence</span>
                                </div>
                                <div className="relative max-w-[90%] rounded-2xl p-[1px] bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] shadow-[0_10px_40px_rgba(0,0,0,0.3)] animate-in slide-in-from-left-4 fade-in duration-300 group">
                                  <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] opacity-10 blur-xl group-hover:opacity-25 transition-opacity duration-700" />
                                  <div className="relative bg-slate-950/95 backdrop-blur-2xl rounded-[15px] p-4 text-sm leading-relaxed text-slate-100 shadow-inner">
                                    <div dangerouslySetInnerHTML={{ __html: formatMessage(typeof msg.content === 'string' ? msg.content : '') }} />
                                  </div>
                                </div>
                              </div>
                            ) : ((msg.role as string) === 'function' || (msg.role as string) === 'tool') ? (
                              <div className="w-full max-w-[90%]">
                                {msg.name === 'calculate_dtf_packing' ? (
                                  (() => {
                                    try {
                                      const content = typeof msg.content === 'string' ? msg.content : '';
                                      const resultData = JSON.parse(content);
                                      if (resultData.type === 'dtf_calculation') {
                                        const { imageWidth, imageHeight, results, quantity } = resultData.data;
                                        // results pode ser objeto ou array dependendo da versão
                                        const totalMeters = typeof results === 'object' && !Array.isArray(results) ? results.totalMeters : results?.[0]?.totalMeters ?? 0;

                                        return (
                                          <div className="mt-2 w-full max-w-[360px] animate-in zoom-in-95 duration-500 font-sans">
                                            <div className="bg-[#111] rounded-[40px] p-6 shadow-2xl border border-white/5 space-y-6">
                                              {/* Header Estilo Direct */}
                                              <div className="flex justify-center">
                                                <div className="bg-[#f2e635] px-10 py-2 rounded-full shadow-lg transform -rotate-1">
                                                  <span className="text-black font-black uppercase italic tracking-tighter text-lg">CALCULADORA DIRECT</span>
                                                </div>
                                              </div>

                                              {/* Grid de Informações */}
                                              <div className="grid grid-cols-2 gap-4 text-center">
                                                <div className="space-y-2">
                                                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Quantidade</span>
                                                  <div className="bg-[#f2e635] rounded-[30px] p-6 flex flex-col items-center justify-center shadow-inner group transition-transform hover:scale-105 duration-300">
                                                    <span className="text-4xl font-black text-black leading-none">{quantity}</span>
                                                    <span className="text-xs font-black text-black/60 uppercase">UNDS</span>
                                                  </div>
                                                </div>
                                                <div className="space-y-2">
                                                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Tamanho :</span>
                                                  <div className="bg-[#f2e635] rounded-[30px] p-6 flex flex-col items-center justify-center shadow-inner group transition-transform hover:scale-105 duration-300">
                                                    <span className="text-4xl font-black text-black leading-none">{Number(totalMeters).toFixed(1)}</span>
                                                    <span className="text-xs font-black text-black/60 uppercase">METR</span>
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Botão de Ação */}
                                              <button
                                                onClick={() => { setCalcData(resultData.data); setIsCalcOpen(true); }}
                                                className="w-full bg-[#f2e635] hover:bg-white text-black font-black uppercase italic py-4 rounded-full transition-all duration-300 shadow-[0_10px_30px_rgba(242,230,53,0.3)] hover:shadow-white/20 active:scale-95 flex items-center justify-center gap-2 group"
                                              >
                                                <span className="tracking-tight text-lg">VER VISUALIZAÇÃO</span>
                                                <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center transition-transform group-hover:rotate-12">
                                                  <Zap className="w-3 h-3 text-black" />
                                                </div>
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      }
                                    } catch (e) { return null; }
                                    return null;
                                  })()
                                ) : msg.name === 'create_order_draft' ? (
                                  (() => {
                                    try {
                                      const content = typeof msg.content === 'string' ? msg.content : '';
                                      const resultData = JSON.parse(content);
                                      if (resultData.type === 'order_draft') {
                                        return (
                                          <div className="mt-2 border rounded-xl p-4 bg-zinc-950 shadow-xl border-white/10 animate-in zoom-in-95">
                                            <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
                                              <ShoppingBag className="h-5 w-5 text-primary" />
                                              <span className="font-bold text-white uppercase tracking-tighter">Rascunho de Pedido</span>
                                            </div>
                                            <div className="space-y-2 text-xs mb-4">
                                              <div className="flex justify-between">
                                                <span className="text-zinc-500 font-bold uppercase tracking-widest">Cliente:</span>
                                                <span className="font-black text-white italic">{resultData.data.client?.nome || 'Não identificado'}</span>
                                              </div>
                                              {resultData.data.items.map((item: any, idx: number) => (
                                                <div key={idx} className="flex justify-between border-t border-white/5 pt-1.5 mt-1.5">
                                                  <span className="text-slate-300">{item.quantity}x {item.productName}</span>
                                                  <span className="font-bold text-primary italic">R$ {item.price}</span>
                                                </div>
                                              ))}
                                            </div>
                                            <Button className="w-full gap-2 bg-primary text-primary-foreground font-black uppercase tracking-widest h-11 rounded-xl shadow-lg shadow-primary/20" onClick={() => handleCreateOrder(resultData)} disabled={isLoading}>
                                              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                              Confirmar e Criar Pedido
                                            </Button>
                                          </div>
                                        );
                                      }
                                    } catch (e) { return null; }
                                    return null;
                                  })()
                                ) : msg.name === 'send_whatsapp_message' ? (
                                  (() => {
                                    try {
                                      const content = typeof msg.content === 'string' ? msg.content : '';
                                      const resultData = JSON.parse(content);
                                      if (resultData.type === 'whatsapp_action' || resultData.type === 'whatsapp_direct_sent') {
                                        const isSent = resultData.type === 'whatsapp_direct_sent';
                                        const { clientName, phone, message, link } = resultData.data;

                                        return (
                                          <div className="mt-2 w-full max-w-[350px] animate-in zoom-in-95 group">
                                            <div className="flex items-center gap-2 mb-2 px-1">
                                              <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                                <MessageCircle className="h-2.5 w-2.5 text-white" />
                                              </div>
                                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">WhatsApp Skill</span>
                                            </div>

                                            <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-slate-950/60 backdrop-blur-xl border border-white/5">
                                              <div className="relative h-1.5 w-full bg-gradient-to-r from-emerald-400 via-green-500 to-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.4)]" />

                                              <div className="relative p-6 space-y-5">
                                                <div className="flex items-center justify-between">
                                                  <div className="space-y-1">
                                                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Envio de Mensagem</h4>
                                                    <p className="text-xl font-black text-white italic tracking-tighter">{clientName || 'Cliente'}</p>
                                                  </div>
                                                  <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                                    <User className="w-5 h-5 text-emerald-400" />
                                                  </div>
                                                </div>

                                                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
                                                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                    <span>Telefone</span>
                                                    <span className="text-white italic">{phone}</span>
                                                  </div>
                                                  <div className="h-px bg-white/5 w-full" />
                                                  <div className="space-y-1.5">
                                                    <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest">Conteúdo Proposto</span>
                                                    <p className="text-xs text-slate-300 leading-relaxed italic">"{message}"</p>
                                                  </div>
                                                </div>

                                                {!isSent ? (
                                                  <Button
                                                    className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-[0.2em] text-[11px] gap-3 shadow-[0_15px_35px_rgba(16,185,129,0.3)] border-none rounded-2xl transition-all hover:scale-[1.02] active:scale-95"
                                                    onClick={() => window.open(link, '_blank')}
                                                  >
                                                    <ExternalLink className="w-4 h-4" />
                                                    Confirmar e Enviar
                                                  </Button>
                                                ) : (
                                                  <div className="w-full h-14 flex items-center justify-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 font-black uppercase tracking-widest text-[10px]">
                                                    <CheckCircle2 className="w-5 h-5" />
                                                    Mensagem Enviada
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
                                ) : msg.name === 'calculate_shipping' ? (
                                  (() => {
                                    try {
                                      const content = typeof msg.content === 'string' ? msg.content : '';
                                      const resultData = JSON.parse(content);
                                      if (resultData.options && Array.isArray(resultData.options)) {
                                        return (
                                          <div className="mt-2 w-full max-w-[350px] animate-in zoom-in-95">
                                            <div className="flex items-center gap-2 mb-2 px-1">
                                              <div className="h-5 w-5 rounded-full bg-sky-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
                                                <Calculator className="h-2.5 w-2.5 text-white" />
                                              </div>
                                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Shipping Skill</span>
                                            </div>

                                            <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-slate-950/60 backdrop-blur-xl border border-white/5">
                                              <div className="relative h-1.5 w-full bg-gradient-to-r from-sky-400 to-blue-600 shadow-[0_0_20px_rgba(56,189,248,0.4)]" />

                                              <div className="relative p-6 space-y-5">
                                                <div className="space-y-1">
                                                  <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-[0.2em]">Cotação de Frete</h4>
                                                  <p className="text-xl font-black text-white italic tracking-tighter uppercase">Opções Disponíveis</p>
                                                </div>

                                                <div className="space-y-2.5">
                                                  {resultData.options.map((opt: any, i: number) => (
                                                    <div key={i} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-sky-500/30 transition-all cursor-pointer group/opt">
                                                      <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20">
                                                          <ShoppingBag className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                          <span className="block text-[10px] font-black text-white uppercase tracking-tight">{opt.name}</span>
                                                          <span className="block text-[8px] font-bold text-slate-500 uppercase">{opt.delivery_time} dias úteis</span>
                                                        </div>
                                                      </div>
                                                      <div className="text-right">
                                                        <span className="block text-sm font-black text-sky-400 italic">R$ {opt.price}</span>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>

                                                <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-2xl text-[9px] text-sky-200/70 text-center font-bold tracking-tight">
                                                  Valores baseados em pacote padrão (0.5kg)
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      }
                                    } catch (e) { return null; }
                                    return null;
                                  })()
                                ) : (
                                  <div dangerouslySetInnerHTML={{ __html: formatMessage(typeof msg.content === 'string' ? msg.content : '') }} />
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
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
