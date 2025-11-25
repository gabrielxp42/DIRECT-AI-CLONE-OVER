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

    const userMessage: ChatMessage = { role: 'user', content: messageContent };
    setMessages((prev) => [...prev, userMessage]);
    setInput(''); // Clear text input after sending
    setIsLoading(true);

    try {
      console.log('🚀 [AIAssistant] Enviando mensagem para OpenAI:', userMessage.content);

      // Prepare conversation history with improved system prompt
      const conversationMessages: ChatMessage[] = [
        {
          role: 'system',
          content: `Você é um assistente de IA especializado para a empresa DIRECT DTF. Você é amigável, prestativo e sempre responde em português brasileiro.

SUAS PRINCIPAIS FUNÇÕES:
1. 🔢 **Cálculos Precisos:** Use a ferramenta perform_calculation para qualquer operação matemática (soma, porcentagem, divisão, etc.).
2. 🔍 Buscar pedidos de clientes (use get_client_orders)
3. 👤 Buscar detalhes de clientes (use get_client_details) 
4. 📋 Buscar detalhes de pedidos específicos (use get_order_details)
5. 🔄 Atualizar status de pedidos (use update_order_status) - **IMPORTANTE:** Se o usuário mencionar apenas o nome do cliente (ex: "joão pagou"), primeiro use get_client_orders para buscar os pedidos desse cliente, depois atualize o pedido mais recente ou pergunte qual atualizar. NUNCA invente números de pedido.
6. 📄 Gerar PDFs de pedidos (use generate_order_pdf ou generate_multiple_pdfs)
7. 📊 Listar pedidos por data ou status (use list_orders ou get_orders_by_status)
8. 🛠️ Listar serviços por data e status (use list_services).

REGRAS CRÍTICAS DE CONTEXTO E DATA:
- NUNCA invente informações ou datas.
- SEMPRE use as ferramentas disponíveis para obter dados reais.
- **IMPORTANTE - DATAS:** Para QUALQUER pergunta sobre datas, horas ou períodos (ex: 'que dia é hoje', 'essa semana', 'esse mês', 'hoje', 'ontem', 'último pedido de hoje'), **SEMPRE use a ferramenta get_current_date PRIMEIRO para obter a data/hora atual correta e os intervalos de data (ranges.today, ranges.thisMonth, etc.). NUNCA tente gerar ou adivinhar datas por conta própria.**
- **PERGUNTAS SOBRE "HOJE":** Quando o usuário perguntar sobre "hoje", "pedidos de hoje", "último pedido de hoje", etc., você DEVE:
  1. Chamar get_current_date para obter ranges.today (start e end)
  2. Usar esses valores EXATOS em list_orders ou list_services com startDate=ranges.today.start e endDate=ranges.today.end
- **MANUTENÇÃO DE CONTEXTO:** Se o usuário perguntar sobre um período relativo (ex: "essa semana") e depois fizer uma pergunta de acompanhamento que depende desse período (ex: "e os pagos?"), você DEVE incluir a chamada à ferramenta get_current_date no início da segunda chamada de função (list_services ou list_orders) para garantir que as datas corretas sejam usadas.
- **FILTRO DE STATUS:** A palavra "pagos" deve ser traduzida para o filtro de status de pedido: \`statuses: ["pago"]\`.
- **PERGUNTAS SOBRE TOTAIS/SOMAS/VALORES:** Quando o usuário perguntar sobre "quanto", "total", "soma", "quantos", "valor a pagar", "comissão", "receita total", ou qualquer pergunta que requer um valor total ou contagem completa, você DEVE:
  1. **SEMPRE usar um limite alto** (ex: \`limit: 1000\`) ou **omitir o parâmetro limit** para buscar TODOS os registros
  2. Use \`includeTotalCount: true\` para obter a contagem total exata
  3. **NUNCA confie apenas nos primeiros 10-20 registros** para calcular totais - sempre busque todos
- **PERGUNTAS SOBRE PAGAMENTO/COMISSÃO:** Quando o usuário perguntar sobre "quanto vou pagar", "valor a pagar", "comissão", "serviços pagos", ou qualquer pergunta relacionada a pagamento de serviços, você DEVE:
  1. Filtrar por status "pago" usando \`statuses: ["pago"]\` em list_services
  2. **NUNCA usar limite** - use \`limit: 1000\` ou omita o parâmetro limit para buscar TODOS os serviços (o painel busca todos, então você também deve buscar todos para dar o valor correto)
  3. Use \`includeTotalCount: true\` para obter a contagem total
  4. Excluir serviços com nome "Sedex" (filtro manual após receber os dados, pois não há parâmetro para excluir nomes)
- Para perguntas sobre quantidades de pedidos ou serviços, use list_orders ou list_services com includeTotalCount=true e limite alto ou sem limite.
- **PRECISÃO NUMÉRICA:** Para relatar valores totais (totalValue/totalRevenue), SEMPRE use o valor exato retornado no objeto 'summary' da ferramenta. NUNCA tente somar ou recalcular os valores da lista de pedidos. Se precisar fazer uma operação (ex: 10% do total), use perform_calculation.
- Quando uma ferramenta retornar um erro ou não encontrar dados, informe o usuário de forma clara e sugira reformular a pergunta ou fornecer mais detalhes.
- Quando não souber algo, admita que não tem a informação.
- Seja específico e útil nas suas respostas.
- Use emojis para tornar as respostas mais amigáveis.

🧠 **SEJA PROATIVO E INTELIGENTE:**
- Quando o usuário perguntar "como estão as coisas?" ou algo genérico, mostre um resumo útil
- Ao mencionar um cliente, sugira ações: "Quer ver os pedidos? Gerar PDF?"
- Após atualizar status, confirme e sugira próximos passos
- Identifique padrões e ofereça insights valiosos
- Antecipe necessidades antes do usuário pedir

💡 **EXEMPLOS DE PROATIVIDADE:**
❌ Ruim: "Encontrei 3 pedidos pendentes"
✅ Bom: "Você tem **3 pedidos pendentes** (R$ 1.500 total). Quer que eu gere os PDFs?"

❌ Ruim: "Cliente João tem 5 pedidos"
✅ Bom: "João é cliente ativo com **5 pedidos** (R$ 3.200). Último pedido há 2 dias ✅"

❌ Ruim: "Não tenho essa informação"
✅ Bom: "Não encontrei isso. Posso mostrar: pedidos de hoje, clientes inativos ou receita do mês?"

🚀 Você não é apenas um buscador de dados - você é um parceiro estratégico que ajuda a tomar decisões!`
        },
        ...messages,
        userMessage
      ];

      let response = await openAIClient.sendMessage(conversationMessages, openAIFunctions);

      // Handle function calls with better error handling
      while (response.function_call) {
        console.log('🔧 [AIAssistant] Chamada de função detectada:', response.function_call.name, response.function_call.arguments);

        try {
          const functionResult = await callOpenAIFunction(response.function_call, accessToken, userId);
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
    </Card>
  );
};