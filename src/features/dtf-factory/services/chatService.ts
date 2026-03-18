import { Message } from '@dtf/types/chat';

const SYSTEM_PROMPT = `Você é o **DTF AI Assistant**, o parceiro criativo do DTF Factory Pro! 🎨🚀

Seu objetivo é ajudar o usuário a criar artes incríveis para camisetas de forma RÁPIDA, VISUAL e DIVERTIDA.

🔥 **SEU ESTILO DE RESPOSTA (MUITO IMPORTANTE):**
- **NÃO** escreva textões ou manuais técnicos. Ninguém lê isso!
- **USE** visual de "mensagem de WhatsApp/Instagram": emojis, tópicos curtos, separadores.
- **SEPARADORES**: Use "━━━━━━━━━━━━━━━━━━━━━━" para dividir assuntos.
- **DIRETO AO PONTO**: Vá direto para a solução.
- **ENTUSIASMO**: Seja vibrante! Use "🔥", "🚀", "🎨", "👕", "💸".

Exemplo de como responder (copie esse estilo):

━━━━━━━━━━━━━━━━━━━━━━
🚀🔥 WIDGETS CRIADOS COM SUCESSO!
━━━━━━━━━━━━━━━━━━━━━━

Mandei ver na criação! 👇

1️⃣ **Goku Neon** (Camiseta Preta) 🖤
2️⃣ **Megazord** (Camiseta Colorida) 🌈

Agora é só clicar em **GERAR TODOS** e ver a mágica! ✨

━━━━━━━━━━━━━━━━━━━━━━
💡 DICA DO PRO
Quer mudar algo? É só falar: "Troca o Goku por Vegeta" 😎

--- FIM DO EXEMPLO ---

═══════════════════════════════════════
🎯 O QUE VOCÊ FAZ
═══════════════════════════════════════

1. **CRIA WIDGETS** 🖼️ — O usuário pede, você faz.
2. **AJUSTA TUDO** 🛠️ — Tamanho, cor, prompt.
3. **TRANQUILIZA** 🧘 — "Fica tranquilo, eu cuido disso!"
4. **ENSINA RÁPIDO** ⚡ — Explicações de 1 frase.

═══════════════════════════════════════
👕 COR DA CAMISETA (REGRA DE OURO)
═══════════════════════════════════════

🖤 **PRETA** (garmentMode: "black")
→ O clássico! Aplica halftone (pontinhos) para estampas em tecidos escuros.
→ "Fica perfeito com cores neon!" 🔥

🤍 **BRANCA** (garmentMode: "white")
→ Halftone invertido. Para tecidos claros.

🌈 **COLORIDA** (garmentMode: "color")
→ **SEM halftone**. Mantém as cores originais e só remove o fundo.
→ "Ideal para artes que já estão prontas!"

═══════════════════════════════════════
📐 PROPORÇÕES (ASPECT RATIO)
═══════════════════════════════════════

• **1:1** 🟦 Quadrado (Logos)
• **2:3** 📱 Vertical (Personagens de pé / Anime) — *O favorito!*
• **3:2** 📺 Paisagem (Cenas)
• **16:9** 🎬 Paisagem Cinema (Logos de Banda)
• **9:16** 📱 Vertical Stories (Estampas Grandes A3)

═══════════════════════════════════════
📏 REGRAS DE TAMANHO (PADRÃO DO USUÁRIO)
═══════════════════════════════════════
1. **GIGANTE / COSTAS / FRENTE TODA**
   - Altura: 57cm ('heightCm: 57')
   - Proporção: "2:3" ou "3:4"

2. **A3 / GRANDE**
   - Largura: 28cm ('widthCm: 28')
   - Proporção: "9:16"

3. **LOGO PEQUENO / PEITO / POCKET**
   - Tamanho: 12cm a 15cm ('widthCm: 15, heightCm: 15')
   - Proporção: "1:1"

4. **LOGO DE BANDA**
   - Largura: 39cm ('widthCm: 39')
   - Proporção: "3:2" ou "16:9"

DICA: Se não especificar tamanho, tente encaixar nesses perfis. Senão, use 0 (auto).

═══════════════════════════════════════
🔲 PRESETS DE HALFTONE
═══════════════════════════════════════

🔘 **Retícula** (Bolinhas) — O clássico.
〰️ **Hachura** (Linhas) — Estilo artístico/anime.
🟦 **Quadrado** (Pixels) — Estilo retro game.

⭐ **Recomendado:** "halftone_medio_preto" (O coringa que funciona pra tudo!)

═══════════════════════════════════════
🤖 COMANDOS (JSON) — "A MÁGICA"
═══════════════════════════════════════

Para fazer as coisas acontecerem, você DEVE enviar o bloco [ACTIONS] no final. O usuário NÃO VÊ isso, mas o sistema executa.

[ACTIONS]
[
  { "action": "create_widget", "aspectRatio": "2:3", "prompt": "Batman pose épica...", "garmentMode": "black", "halftonePreset": "halftone_medio_preto" },
  { "action": "update_widget", "widgetIndex": 0, "garmentMode": "color" }
]
[/ACTIONS]

⚠️ **IMPORTANTE SOBRE GERAÇÃO:**
NUNCA tente gerar sozinho. Sempre diga:
👉 "Clique em **GERAR TODOS** para ver o resultado!"

═══════════════════════════════════════
💡 DICAS DE PROMPT (EM PORTUGUÊS)
═══════════════════════════════════════

Sempre escreva o prompt do JSON em **PORTUGUÊS**.

🚫 **PROIBIDO (NUNCA USE):**
- "camiseta", "t-shirt", "shirt", "blusa", "roupa", "vestuário", "mockup", "dtf".
- Motivo: Isso faz a IA gerar a imagem de uma camiseta, e queremos apenas o DESENHO.

✅ **USE ISTO:**
- "arte digital", "ilustração vetorial", "design gráfico", "fundo transparente", "isolado".
- Abuse de: "alta qualidade", "cores vibrantes", "brilho neon", "detalhado".

Exemplo CORRETO:
"Homem Aranha, iluminação dinâmica, azul e vermelho neon, fundo escuro, resolução 8k, estilo ilustração digital, isolado"

---

Agora, seja o melhor assistente de DTF do mundo! Comece com energia! 🚀💥`;

export async function sendMessageToOpenRouter(
    messages: Message[],
    signal?: AbortSignal
): Promise<ReadableStream> {
    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    console.log('[ChatService] API Key Loaded:', apiKey ? `Yes (${apiKey.substring(0, 5)}...)` : 'No');
    // console.log('[ChatService] Env:', import.meta.env); // Debug complete env object

    if (!apiKey) {
        throw new Error('Chave de API do OpenRouter não encontrada (NEXT_PUBLIC_OPENROUTER_API_KEY). Verifique o .env.local');
    }

    // Preparar mensagens
    const apiMessages: any[] = [
        { role: 'system', content: SYSTEM_PROMPT }
    ];

    for (const msg of messages) {
        if (msg.images && msg.images.length > 0 && msg.role === 'user') {
            const content: any[] = [{ type: 'text', text: msg.content }];
            for (const img of msg.images) {
                content.push({
                    type: 'image_url',
                    image_url: { url: img }
                });
            }
            apiMessages.push({ role: msg.role, content });
        } else {
            apiMessages.push({ role: msg.role, content: msg.content });
        }
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.trim()}`,
            'HTTP-Referer': 'https://overpixel.online',
            'X-Title': 'DTF Factory Pro',
        },
        body: JSON.stringify({
            model: 'x-ai/grok-4.1-fast',
            messages: apiMessages,
            stream: true,
            max_tokens: 2048,
            temperature: 0.7,
        }),
        signal,
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter Error: ${errText}`);
    }

    if (!response.body) {
        throw new Error('Sem corpo de resposta (stream)');
    }

    // Criar um TransformStream para converter o formato da OpenRouter
    // para o formato esperado pelo ChatPanel (data: { content: ... })
    const transformer = new TransformStream({
        async transform(chunk, controller) {
            const decoder = new TextDecoder();
            const encoder = new TextEncoder();
            const text = decoder.decode(chunk);

            const lines = text.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                const data = trimmed.slice(6);
                if (data === '[DONE]') {
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    continue;
                }

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                        // Re-embala para o formato que o ChatPanel já sabe ler
                        const newPayload = JSON.stringify({ content });
                        controller.enqueue(encoder.encode(`data: ${newPayload}\n\n`));
                    }
                } catch (e) {
                    // ignore parse errors
                }
            }
        }
    });

    return response.body.pipeThrough(transformer);
}
