import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, X, Bot, User } from 'lucide-react';
import { getOpenAIClient, type ChatMessage } from '@/integrations/openai/client';
import { openAIFunctions, callOpenAIFunction } from '@/integrations/openai/aiTools';
import { useToast } from '@/hooks/use-toast';
import { useAIAssistant } from '@/contexts/AIAssistantProvider';
import { AudioRecorder } from './AudioRecorder';
import { AudioMessageDisplay } from './AudioMessageDisplay';

export const AIAssistant = () => {
  const { isOpen, close } = useAIAssistant();
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
5. 🔄 Atualizar status de pedidos (use update_order_status)
6. 📄 Gerar PDFs de pedidos (use generate_order_pdf ou generate_multiple_pdfs)
7. 📊 Listar pedidos por data ou status (use list_orders ou get_orders_by_status)
8. 🛠️ Listar serviços por data (use list_services)

REGRAS CRÍTICAS DE CONTEXTO E DATA:
- NUNCA invente informações ou datas.
- SEMPRE use as ferramentas disponíveis para obter dados reais.
- Para perguntas sobre datas, horas ou períodos (ex: 'que dia é hoje', 'essa semana', 'esse mês', 'hoje', 'ontem'), **SEMPRE use a ferramenta get_current_date para obter os intervalos de data corretos e NUNCA tente gerar datas por conta própria.**
- **MANUTENÇÃO DE CONTEXTO:** Se o usuário perguntar sobre um período relativo (ex: "essa semana") e depois fizer uma pergunta de acompanhamento que depende desse período (ex: "e os pagos?"), você DEVE incluir a chamada à ferramenta get_current_date no início da segunda chamada de função (list_services ou list_orders) para garantir que as datas corretas sejam usadas, mesmo que o modelo já as tenha visto.
- Para perguntas sobre quantidades de pedidos ou serviços, use list_orders ou list_services com includeTotalCount=true.
- **PRECISÃO NUMÉRICA:** Para relatar valores totais (totalValue/totalRevenue), SEMPRE use o valor exato retornado no objeto 'summary' da ferramenta. NUNCA tente somar ou recalcular os valores da lista de pedidos. Se precisar fazer uma operação (ex: 10% do total), use perform_calculation.
- Quando uma ferramenta retornar um erro ou não encontrar dados, informe o usuário de forma clara e sugira reformular a pergunta ou fornecer mais detalhes.
- Quando não souber algo, admita que não tem a informação.
- Seja específico e útil nas suas respostas.
- Use emojis para tornar as respostas mais amigáveis.

EXEMPLOS DE COMO RESPONDER:
- "Encontrei 3 pedidos para o João Silva..."
- "O pedido #123 está com status 'pendente'..."
- "PDF gerado com sucesso! 📄"
- "Não tenho essa informação. Vou precisar consultar o sistema..."

Responda sempre de forma clara, direta e amigável.`
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
              className={`max-w-[85%] p-3 rounded-lg text-sm leading-relaxed ${
                msg.role === 'user'
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
                <div 
                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                />
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
      
      <CardFooter className="p-4 border-t bg-muted/20">
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