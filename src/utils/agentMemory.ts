import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';

// ============================================
// TIPOS
// ============================================

export type MemoryType = 'fact' | 'preference' | 'pattern' | 'insight' | 'context';

export interface AgentMemory {
    id: string;
    user_id: string;
    conversation_id?: string;
    memory_type: MemoryType;
    category?: string;
    content: string;
    metadata?: Record<string, any>;
    importance: number;
    access_count: number;
    last_accessed_at?: string;
    created_at: string;
    expires_at?: string;
}

export interface Conversation {
    id: string;
    user_id: string;
    title?: string;
    started_at: string;
    last_message_at: string;
    message_count: number;
    is_active: boolean;
    metadata?: Record<string, any>;
}

export interface Message {
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant' | 'system' | 'function';
    content?: string;
    function_call?: any;
    function_result?: any;
    tokens_used?: number;
    created_at: string;
}

export interface AgentInsight {
    id: string;
    user_id: string;
    insight_type: string;
    title: string;
    description?: string;
    data?: Record<string, any>;
    confidence?: number;
    is_active: boolean;
    created_at: string;
    acknowledged_at?: string;
}

// ============================================
// GERENCIADOR DE MEMÓRIA
// ============================================

export class AgentMemoryManager {
    private userId: string;
    private currentConversationId?: string;

    constructor(userId: string) {
        this.userId = userId;
    }

    // ============================================
    // CONVERSAS
    // ============================================

    /**
     * Cria uma nova conversa
     */
    async createConversation(title?: string): Promise<Conversation> {
        console.log('🆕 [Memory] Criando nova conversa...');

        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido');

            const response = await fetch(`${SUPABASE_URL}/rest/v1/agent_conversations`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    user_id: this.userId,
                    title: title || 'Nova conversa',
                    is_active: true
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Erro ao criar conversa: ${error}`);
            }

            const [conversation] = await response.json();
            this.currentConversationId = conversation.id;

            console.log('✅ [Memory] Conversa criada:', conversation.id);
            return conversation;
        } catch (error) {
            console.error('❌ [Memory] Erro ao criar conversa:', error);
            throw error;
        }
    }

    /**
     * Busca a conversa ativa atual ou cria uma nova
     */
    async getOrCreateActiveConversation(): Promise<Conversation> {
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido');

            // Busca conversa ativa
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/agent_conversations?user_id=eq.${this.userId}&is_active=eq.true&order=last_message_at.desc&limit=1`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                }
            );

            if (!response.ok) throw new Error('Erro ao buscar conversa');

            const conversations = await response.json();

            if (conversations && conversations.length > 0) {
                this.currentConversationId = conversations[0].id;
                console.log('📖 [Memory] Usando conversa existente:', conversations[0].id);
                return conversations[0];
            }

            // Cria nova conversa se não houver ativa
            return await this.createConversation();
        } catch (error) {
            console.error('❌ [Memory] Erro ao buscar/criar conversa:', error);
            throw error;
        }
    }

    /**
     * Adiciona uma mensagem à conversa
     */
    async addMessage(
        role: 'user' | 'assistant' | 'system' | 'function',
        content?: string,
        functionCall?: any,
        functionResult?: any
    ): Promise<Message> {
        try {
            if (!this.currentConversationId) {
                await this.getOrCreateActiveConversation();
            }

            const token = await getValidToken();
            if (!token) throw new Error('Token inválido');

            const response = await fetch(`${SUPABASE_URL}/rest/v1/agent_messages`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    conversation_id: this.currentConversationId,
                    role,
                    content,
                    function_call: functionCall,
                    function_result: functionResult
                })
            });

            if (!response.ok) throw new Error('Erro ao adicionar mensagem');

            const [message] = await response.json();
            console.log('💬 [Memory] Mensagem adicionada:', role);
            return message;
        } catch (error) {
            console.error('❌ [Memory] Erro ao adicionar mensagem:', error);
            throw error;
        }
    }

    /**
     * Busca histórico de mensagens da conversa atual
     */
    async getConversationHistory(limit: number = 20): Promise<Message[]> {
        try {
            if (!this.currentConversationId) {
                return [];
            }

            const token = await getValidToken();
            if (!token) throw new Error('Token inválido');

            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/agent_messages?conversation_id=eq.${this.currentConversationId}&order=created_at.desc&limit=${limit}`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                }
            );

            if (!response.ok) throw new Error('Erro ao buscar histórico');

            const messages = await response.json();
            console.log('📜 [Memory] Histórico carregado:', messages.length, 'mensagens');
            return messages.reverse(); // Retorna em ordem cronológica
        } catch (error) {
            console.error('❌ [Memory] Erro ao buscar histórico:', error);
            return [];
        }
    }

    // ============================================
    // MEMÓRIAS
    // ============================================

    /**
     * Cria ou atualiza uma memória
     */
    async saveMemory(
        memoryType: MemoryType,
        content: string,
        options: {
            category?: string;
            importance?: number;
            metadata?: Record<string, any>;
            expiresInDays?: number;
        } = {}
    ): Promise<AgentMemory> {
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido');

            const expiresAt = options.expiresInDays
                ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
                : null;

            // Usa a função RPC upsert_memory para evitar duplicatas
            const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_memory`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    p_user_id: this.userId,
                    p_memory_type: memoryType,
                    p_category: options.category || null,
                    p_content: content,
                    p_importance: options.importance || 0.5,
                    p_conversation_id: this.currentConversationId || null
                })
            });

            if (!response.ok) throw new Error('Erro ao salvar memória');

            const memoryId = await response.json();
            console.log('🧠 [Memory] Memória salva:', memoryType, '-', content.substring(0, 50));

            // Busca a memória criada/atualizada
            const getResponse = await fetch(
                `${SUPABASE_URL}/rest/v1/agent_memory?id=eq.${memoryId}`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.pgrst.object+json'
                    }
                }
            );

            return await getResponse.json();
        } catch (error) {
            console.error('❌ [Memory] Erro ao salvar memória:', error);
            throw error;
        }
    }

    /**
     * Busca memórias relevantes
     */
    async getRelevantMemories(
        limit: number = 10,
        minImportance: number = 0.3
    ): Promise<AgentMemory[]> {
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido');

            // Usa a função RPC get_relevant_memories
            const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_relevant_memories`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    p_user_id: this.userId,
                    p_limit: limit,
                    p_min_importance: minImportance
                })
            });

            if (!response.ok) throw new Error('Erro ao buscar memórias');

            const memories = await response.json();
            console.log('🔍 [Memory] Memórias relevantes encontradas:', memories.length);
            return memories;
        } catch (error) {
            console.error('❌ [Memory] Erro ao buscar memórias:', error);
            return [];
        }
    }

    /**
     * Busca memórias por categoria
     */
    async getMemoriesByCategory(category: string): Promise<AgentMemory[]> {
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido');

            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/agent_memory?user_id=eq.${this.userId}&category=eq.${category}&order=importance.desc,created_at.desc`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                }
            );

            if (!response.ok) throw new Error('Erro ao buscar memórias por categoria');

            const memories = await response.json();
            console.log(`📂 [Memory] Memórias da categoria "${category}":`, memories.length);
            return memories;
        } catch (error) {
            console.error('❌ [Memory] Erro ao buscar memórias por categoria:', error);
            return [];
        }
    }

    // ============================================
    // INSIGHTS
    // ============================================

    /**
     * Cria um novo insight
     */
    async createInsight(
        insightType: string,
        title: string,
        description?: string,
        data?: Record<string, any>,
        confidence?: number
    ): Promise<AgentInsight> {
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido');

            const response = await fetch(`${SUPABASE_URL}/rest/v1/agent_insights`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    user_id: this.userId,
                    insight_type: insightType,
                    title,
                    description,
                    data,
                    confidence,
                    is_active: true
                })
            });

            if (!response.ok) throw new Error('Erro ao criar insight');

            const [insight] = await response.json();
            console.log('💡 [Memory] Insight criado:', title);
            return insight;
        } catch (error) {
            console.error('❌ [Memory] Erro ao criar insight:', error);
            throw error;
        }
    }

    /**
     * Busca insights ativos
     */
    async getActiveInsights(): Promise<AgentInsight[]> {
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido');

            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/agent_insights?user_id=eq.${this.userId}&is_active=eq.true&order=created_at.desc`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                }
            );

            if (!response.ok) throw new Error('Erro ao buscar insights');

            const insights = await response.json();
            console.log('💡 [Memory] Insights ativos:', insights.length);
            return insights;
        } catch (error) {
            console.error('❌ [Memory] Erro ao buscar insights:', error);
            return [];
        }
    }

    // ============================================
    // UTILITÁRIOS
    // ============================================

    /**
     * Formata memórias para injetar no contexto da agente
     */
    formatMemoriesForContext(memories: AgentMemory[]): string {
        if (memories.length === 0) return '';

        const formatted = memories.map(m => {
            const emoji = {
                fact: '📌',
                preference: '⭐',
                pattern: '📊',
                insight: '💡',
                context: '🔍'
            }[m.memory_type] || '📝';

            return `${emoji} ${m.content}${m.category ? ` [${m.category}]` : ''}`;
        }).join('\n');

        return `\n\n🧠 **MEMÓRIAS RELEVANTES:**\n${formatted}\n`;
    }

    /**
     * Extrai memórias automaticamente de uma conversa
     */
    async extractMemoriesFromConversation(
        userMessage: string,
        assistantResponse: string
    ): Promise<void> {
        // Aqui você pode implementar lógica para extrair automaticamente
        // fatos, preferências e padrões da conversa
        // Por exemplo, usando regex ou outra chamada à LLM

        // Exemplo simples: detectar preferências
        const preferencePatterns = [
            /prefiro|gosto de|sempre uso|costumo/i,
            /não gosto|evito|nunca uso/i
        ];

        for (const pattern of preferencePatterns) {
            if (pattern.test(userMessage)) {
                await this.saveMemory('preference', userMessage, {
                    category: 'preferência_usuário',
                    importance: 0.6
                });
                break;
            }
        }

        // Detectar fatos sobre o negócio
        if (/fornecedor|cliente|produto|estoque/i.test(userMessage)) {
            await this.saveMemory('fact', userMessage, {
                category: 'negócio',
                importance: 0.5
            });
        }
    }
}
