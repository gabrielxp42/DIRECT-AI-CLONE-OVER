# 🐛 Problemas Encontrados e Soluções

## Problemas Críticos Identificados

### 1. **Refetch Agressivo Causando Loops Infinitos**
**Problema:** `staleTime: 0` em TODAS as queries força refetch constante
**Impacto:** Sobrecarga de requisições, possível rate limiting, loading infinito
**Localização:**
- `src/App.tsx` linha 37
- `src/hooks/useDataFetch.ts` (múltiplas queries)
- `src/pages/Reports.tsx` linha 472
- `src/hooks/useServiceCommissionReport.ts` linha 170

**Solução:** Usar `staleTime` apropriado (5-10 minutos para dados que não mudam frequentemente)

---

### 2. **Token Refresh Não Está Configurado**
**Problema:** Código de refresh de token está comentado
**Impacto:** Após 1 hora, token expira e usuário fica em loading infinito
**Localização:** `src/App.tsx` linhas 21-24

**Solução:** Implementar refresh automático de token

---

### 3. **Validação de Token Duplicada no SessionProvider**
**Problema:** `getUser()` + `getSession()` chamados juntos
**Impacto:** 2 requisições ao Supabase toda vez que a página carrega
**Localização:** `src/contexts/SessionProvider.tsx` linhas 78-93

**Solução:** Usar apenas `getSession()` com tratamento de erro

---

### 4. **Logs Excessivos em Produção**
**Problema:** Console.log em todos os lugares, mesmo em produção
**Impacto:** Performance degradada, informações sensíveis expostas
**Localização:** `SessionProvider.tsx` (15+ console.logs)

**Solução:** Remover ou condicionar logs apenas para desenvolvimento

---

### 5. **RefetchOnWindowFocus Muito Agressivo**
**Problema:** `refetchOnWindowFocus: true` com `staleTime: 0`
**Impacto:** Toda vez que usuário volta para a aba, refaz TODAS as queries
**Localização:** `src/App.tsx` linha 33

**Solução:** Desabilitar ou usar com `staleTime` maior

---

### 6. **GC Time Muito Curto (2 minutos)**
**Problema:** Cache é limpo muito rápido
**Impacto:** Dados precisam ser rebuscados constantemente
**Localização:** `src/App.tsx` linha 39

**Solução:** Aumentar para 10-15 minutos

---

### 7. **Falta de Error Boundaries**
**Problema:** Nenhum error boundary implementado
**Impacto:** Um erro em qualquer query pode travar toda a aplicação
**Solução:** Adicionar error boundaries nas rotas principais

---

### 8. **Retry Muito Baixo**
**Problema:** `retry: 1` pode causar falhas desnecessárias
**Impacto:** Falhas de rede temporárias causam erros permanentes
**Localização:** `src/App.tsx` linha 31

**Solução:** Aumentar para 2-3 com backoff exponencial

---

## Prioridade de Correção

### 🔴 CRÍTICO (Corrigir Imediatamente)
1. Token Refresh
2. StaleTime = 0 (causando loops)
3. Validação duplicada de token

### 🟡 IMPORTANTE (Corrigir em Breve)
4. RefetchOnWindowFocus
5. GC Time muito curto
6. Logs em produção

### 🟢 MELHORIAS (Quando Possível)
7. Error Boundaries
8. Retry strategy

---

## Sintomas que Você Relatou vs Causas

| Sintoma | Causa Provável |
|---------|----------------|
| "Loading infinito após um tempo" | Token expira (1h) sem refresh |
| "Precisa limpar cache e fazer login de novo" | Token inválido não é detectado corretamente |
| "Página parada começa a dar erro" | `staleTime: 0` + `refetchInterval` causando sobrecarga |
| "Bugs estranhos" | Race conditions de múltiplas queries simultâneas |

---

## Próximos Passos

Vou implementar as correções na seguinte ordem:
1. ✅ Configurar staleTime apropriado
2. ✅ Implementar token refresh automático
3. ✅ Remover validação duplicada
4. ✅ Otimizar configuração do QueryClient
5. ✅ Adicionar error boundaries básicos
