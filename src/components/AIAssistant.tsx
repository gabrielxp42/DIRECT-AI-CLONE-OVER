import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, X, Bot, User, Check, ShoppingBag, Loader2 } from 'lucide-react';
import { getOpenAIClient, type ChatMessage } from '@/integrations/openai/client';
import { openAIFunctions, callOpenAIFunction } from '@/integrations/openai/aiTools';
import { useToast } from '@/hooks/use-toast';
import { useAIAssistant } from '@/contexts/AIAssistantProvider';
import { AudioRecorder } from './AudioRecorder';
import { AudioMessageDisplay } from './AudioMessageDisplay';
import { useSession } from '@/contexts/SessionProvider';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import { AgentMemoryManager } from '@/utils/agentMemory';
import { generateReActSystemPrompt } from '@/utils/agentPrompts';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionModal } from '@/components/SubscriptionModal';


export const AIAssistant = () => {
  const { isOpen, close } = useAIAssistant();
  const { session } = useSession();
  const accessToken = session?.access_token;
  const userId = session?.user?.id;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { canUseAI } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Initialize Memory Manager
  const memoryManager = useRef<AgentMemoryManager | null>(null);

  // Initialize memory manager when user is available
  useEffect(() => {
    if (userId && !memoryManager.current) {
      console.log('🧠 [AIAssistant] Inicializando Memory Manager para usuário:', userId);
      memoryManager.current = new AgentMemoryManager(userId);

      // Carrega ou cria conversa ativa
      memoryManager.current.getOrCreateActiveConversation().catch(err => {
        console.error('❌ [AIAssistant] Erro ao inicializar conversa:', err);
      });
    }
  }, [userId]);

  // Initialize OpenAI client
  const openAIClient = useRef(getOpenAIClient()).current;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Function to format message content with better markdown support
  const formatMessage = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/\n/g, '<br>') // Line breaks
      .trim();
  };

  const handleSendMessage = async (messageContent: string) => {
    if (messageContent.trim() === '') return;

    if (!canUseAI) {
      setShowUpgradeModal(true);
      return;
    }

    const userMessage: ChatMessage = { role: 'user', content: messageContent };
    setMessages((prev) => [...prev, userMessage]);
    setInput(''); // Clear text input after sending
    setIsLoading(true);

    try {
      console.log('🚀 [AIAssistant] Enviando mensagem para OpenAI:', userMessage.content);

      // Salva mensagem do usuário na memória
      if (memoryManager.current) {
        await memoryManager.current.addMessage('user', userMessage.content);
      }

      // Carrega memórias e insights relevantes
      let memories: any[] = [];
      let insights: any[] = [];

      if (memoryManager.current) {
        console.log('🧠 [AIAssistant] Carregando memórias relevantes...');
        [memories, insights] = await Promise.all([
          memoryManager.current.getRelevantMemories(10, 0.3, userMessage.content),
          memoryManager.current.getActiveInsights()
        ]);
        console.log('✅ [AIAssistant] Memórias carregadas:', memories.length, '| Insights:', insights.length);
      }

      // Gera system prompt com ReAct Pattern e memórias
      const systemPrompt = generateReActSystemPrompt(memories, insights);

      console.log('📝 [AIAssistant] System prompt gerado com', systemPrompt.length, 'caracteres');

      // Prepare conversation history with improved system prompt
      const conversationMessages: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt // Usando o novo prompt com ReAct + Memórias
        },
        ...messages,
        userMessage
      ];

      let response = await openAIClient.sendMessage(conversationMessages, openAIFunctions);

      // Handle function calls with better error handling
      while (response.function_call) {
        console.log('🔧 [AIAssistant] Chamada de função detectada:', response.function_call.name, response.function_call.arguments);

        try {
          const functionResult = await callOpenAIFunction(response.function_call);
          console.log('✅ [AIAssistant] Resultado da ferramenta:', functionResult);

          // Add function call and result to conversation
          const functionCallMessage: ChatMessage = {
            role: 'assistant',
            content: '',
            function_call: {
              name: response.function_call.name,
              arguments: JSON.stringify(response.function_call.arguments)
            }
          };

          const functionResultMessage: ChatMessage = {
            role: 'function',
            name: response.function_call.name,
            content: JSON.stringify(functionResult, null, 2)
          };

          conversationMessages.push(functionCallMessage, functionResultMessage);

          // Get the final response from OpenAI
          response = await openAIClient.sendMessage(conversationMessages, openAIFunctions);
        } catch (functionError: any) {
          console.error('❌ [AIAssistant] Erro na execução da ferramenta:', functionError);

          // Add error message to conversation
          const errorMessage: ChatMessage = {
            role: 'function',
            name: response.function_call.name,
            content: JSON.stringify({
              error: true,
              message: `Erro ao executar ${response.function_call.name}: ${functionError.message}`
            })
          };

          conversationMessages.push(errorMessage);

          // Try to get a response even with the error
          response = await openAIClient.sendMessage(conversationMessages, openAIFunctions);
          break;
        }
      }

      const finalResponseText = response.content || 'Desculpe, não consegui gerar uma resposta adequada.';
      const aiMessage: ChatMessage = { role: 'assistant', content: finalResponseText };
      setMessages((prev) => [...prev, aiMessage]);

      // Salva resposta da agente na memória
      if (memoryManager.current) {
        await memoryManager.current.addMessage('assistant', finalResponseText);

        // Extrai e salva memórias automaticamente da conversa
        await memoryManager.current.extractMemoriesFromConversation(
          userMessage.content,
          finalResponseText
        );
      }

    } catch (error: any) {
      console.error('❌ [AIAssistant] Erro completo:', error);

      let errorMessage = '❌ Ocorreu um erro ao processar sua solicitação.';

      if (error.message?.includes('API key')) {
        errorMessage = '❌ Erro de configuração da API. A chave da OpenAI não está configurada corretamente.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = '❌ Erro de conexão. Verifique sua internet e tente novamente.';
      } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
        errorMessage = '❌ Limite de uso da API atingido. Tente novamente mais tarde.';
      } else if (error.message?.includes('401')) {
        errorMessage = '❌ Chave da API inválida. Entre em contato com o administrador.';
      }

      toast({
        title: "Erro do Assistente",
        description: errorMessage,
        variant: "destructive",
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioRecorded = async (transcription: string, audioBlob: Blob) => {
    // Cria uma URL para o blob de áudio para exibi-lo
    const audioUrl = URL.createObjectURL(audioBlob);

    // Adiciona a mensagem de áudio ao chat
    const userAudioMessage: ChatMessage = {
      role: 'user',
      content: transcription || '[Áudio sem transcrição]',
      audioUrl: audioUrl
    };
    setMessages((prev) => [...prev, userAudioMessage]);

    // Envia a transcrição para a IA processar
    await handleSendMessage(transcription);
  };

  const handleCreateOrder = async (draftData: any) => {
    if (!draftData.data.client?.id) {
      toast({
        title: "Erro ao criar pedido",
        description: "Cliente não identificado.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);

      // CRÍTICO: Obter token válido ANTES da requisição
      const validToken = await getValidToken();
      const effectiveToken = validToken || accessToken;

      if (!effectiveToken) {
        toast({
          title: "Erro ao criar pedido",
          description: "Sessão inválida. Por favor, faça login novamente.",
          variant: "destructive"
        });
        return;
      }

      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${effectiveToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      // 1. Criar o pedido
      const orderResponse = await fetch(`${SUPABASE_URL}/rest/v1/pedidos`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          cliente_id: draftData.data.client.id,
          status: 'pendente',
          valor_total: 0, // Será atualizado futuramente
          total_metros: 0,
          observacoes: draftData.data.notes || 'Criado via Assistente IA'
        })
      });

      if (!orderResponse.ok) throw new Error('Falha ao criar pedido');
      const [newOrder] = await orderResponse.json();

      // TODO: Implementar inserção de itens quando tivermos produtos mapeados

      toast({
        title: "Pedido criado!",
        description: `Pedido criado para ${draftData.data.client.nome}.`
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ Pedido criado com sucesso! Você pode vê-lo na tela de Pedidos.`
      }]);

    } catch (error: any) {
      console.error('Erro ao criar pedido:', error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 w-[400px] h-[600px] flex flex-col shadow-xl z-50 border-2">
      <CardHeader className="flex flex-row items-center justify-between p-4 border-b bg-primary/5">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          🤖 Assistente DIRECT AI
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={close} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm mt-8">
            <Bot className="h-12 w-12 mx-auto mb-4 text-primary/50" />
            <div className="space-y-2">
              <p className="font-medium">👋 Olá! Sou seu assistente da DIRECT DTF!</p>
              <p className="text-xs">Como posso ajudar hoje?</p>
            </div>
            <div className="mt-4 text-xs space-y-1 bg-muted/50 p-3 rounded-lg">
              <p className="font-medium">💡 Exemplos do que posso fazer:</p>
              <div className="space-y-1 text-left">
                <p>• "pedidos do João"</p>
                <p>• "pedido #43"</p>
                <p>• "gerar PDF do pedido 43"</p>
                <p>• "pedidos pendentes"</p>
                <p>• "detalhes do cliente Maria"</p>
                <p>• "quantos pedidos temos este mês?"</p>
                <p>• "qual é 10% do total de vendas?" (Usa calculadora 🔢)</p>
              </div>
              <div className="mt-3 p-2 bg-blue-50 rounded text-blue-700">
                <p className="font-medium text-xs">🎤 Dica de áudio:</p>
                <p className="text-xs">Mantenha o botão do microfone pressionado para gravar</p>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0">
                <Bot className="h-6 w-6 text-primary mt-1" />
              </div>
            )}

            <div
              className={`max-w-[85%] p-3 rounded-lg text-sm leading-relaxed ${msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-br-sm ml-auto'
                : msg.role === 'assistant'
                  ? 'bg-muted text-foreground rounded-bl-sm border'
                  : 'bg-purple-100 text-purple-800 text-xs border border-purple-200'
                }`}
            >
              {msg.role === 'user' ? (
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    {msg.audioUrl ? (
                      <AudioMessageDisplay audioUrl={msg.audioUrl} transcription={msg.content || ''} isUserMessage={true} />
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                    )}
                  </div>
                  <User className="h-4 w-4 flex-shrink-0 mt-0.5 opacity-70" />
                </div>
              ) : (
                msg.role === 'function' && msg.name === 'create_order_draft' ? (
                  (() => {
                    try {
                      const result = JSON.parse(msg.content);
                      if (result.type === 'order_draft') {
                        return (
                          <div className="mt-2 border rounded-lg p-4 bg-white dark:bg-slate-950 shadow-sm w-full max-w-xs">
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
                              {result.data.notes && (
                                <div className="text-xs text-muted-foreground italic mt-2 bg-muted p-2 rounded">
                                  Obs: {result.data.notes}
                                </div>
                              )}
                            </div>

                            <Button
                              className="w-full gap-2"
                              onClick={() => handleCreateOrder(result)}
                              disabled={isLoading || !result.data.client?.id}
                            >
                              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              Confirmar e Criar
                            </Button>

                            {!result.data.client?.id && (
                              <p className="text-xs text-red-500 mt-2 text-center">
                                Cliente não encontrado. Crie o cliente primeiro.
                              </p>
                            )}
                          </div>
                        );
                      }
                    } catch (e) { return null; }
                    return <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />;
                  })()
                ) : (
                  <div
                    dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                  />
                )
              )}
            </div>

            {msg.role === 'user' && (
              <div className="flex-shrink-0">
                <User className="h-6 w-6 text-muted-foreground mt-1" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <Bot className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
            <div className="max-w-[85%] p-3 rounded-lg text-sm bg-muted text-foreground border rounded-bl-sm">
              <div className="flex items-center gap-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-muted-foreground">Processando sua solicitação...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      {/* Sugestões Rápidas */}
      <div className="px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mask-linear-fade">
          {[
            "Novo pedido",
            "Resumo do dia",
            "Estoque baixo?",
            "Clientes inativos",
            "Criar cliente"
          ].map((s) => (
            <button
              key={s}
              onClick={() => setInput(s)}
              className="whitespace-nowrap px-3 py-1.5 rounded-full bg-primary/5 text-primary text-xs border border-primary/10 hover:bg-primary/10 transition-all hover:scale-105 flex-shrink-0"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <CardFooter className="p-4 pt-2 border-t bg-muted/20">
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
            <Button
              onClick={() => handleSendMessage(input)}
              disabled={isLoading || input.trim() === ''}
              size="icon"
              className="h-10 w-10 rounded-full"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardFooter>
      <SubscriptionModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
    </Card>
  );
};