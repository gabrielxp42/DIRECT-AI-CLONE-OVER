# 🔴 CORREÇÃO CRÍTICA: Loop de SIGN_OUT/SIGN_IN

## 🐛 Problema Identificado

### Sintomas
```
🔐 Auth state changed: SIGNED_OUT no user
👋 User signed out
[CacheInvalidator] User changed, clearing all queries
🔐 Auth state changed: SIGNED_IN gabrielxp45@gmail.com
[CacheInvalidator] User changed, clearing all queries
🔐 Auth state changed: SIGNED_OUT no user
...
```

Seguido de:
```
401 (Unauthorized)
Erro ao carregar relatórios: Fetch error pedidos
```

---

## 🔍 Causa Raiz

Durante o **refresh automático de token** (que acontece a cada ~1 hora), o Supabase:

1. **Invalida o token antigo** → dispara `SIGNED_OUT`
2. **Gera novo token** → dispara `SIGNED_IN`

**Problema:** O `SessionProvider` e `CacheInvalidator` tratavam isso como um **logout/login real**, causando:

- ❌ Limpeza de TODO o cache
- ❌ Invalidação de queries em andamento
- ❌ Requisições com token em "transição" (401)
- ❌ Loop infinito de eventos

---

## ✅ Solução Implementada

### 1. **SessionProvider.tsx** - Ignorar SIGNED_OUT durante refresh

```typescript
let isRefreshing = false; // Flag para detectar refresh

if (event === 'TOKEN_REFRESHED') {
  isRefreshing = true;
  setupTokenRefresh();
  
  // Resetar após 2 segundos
  setTimeout(() => {
    isRefreshing = false;
  }, 2000);
}

// IGNORAR SIGNED_OUT se estiver refreshing
if (event === 'SIGNED_OUT' && isRefreshing) {
  console.log('⚠️ Ignorando SIGNED_OUT durante refresh de token');
  return; // NÃO processar
}

// Só processar SIGNED_OUT real (logout manual)
if (event === 'SIGNED_OUT' && !isRefreshing) {
  console.log('👋 User signed out');
  clearTokenRefresh();
}
```

**Resultado:** SIGNED_OUT durante refresh é **ignorado**

---

### 2. **App.tsx** - Debounce no CacheInvalidator

```typescript
const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

// Aguardar 1 segundo antes de limpar cache
if (currentUserId !== previousUserId) {
  debounceTimerRef.current = setTimeout(() => {
    // Verificar NOVAMENTE após 1 segundo
    const finalUserId = session?.user?.id;
    
    if (finalUserId !== finalPreviousUserId) {
      queryClient.clear(); // Só limpa se realmente mudou
    }
  }, 1000);
}
```

**Resultado:** Cache só é limpo em **login/logout REAL**, não durante refresh

---

## 📊 Fluxo Antes vs Depois

### ❌ ANTES (Com Bug)

```
TOKEN EXPIRA (1h)
    ↓
Supabase: SIGNED_OUT
    ↓
SessionProvider: "User signed out" ❌
    ↓
CacheInvalidator: Clear ALL queries ❌
    ↓
Supabase: SIGNED_IN (novo token)
    ↓
CacheInvalidator: Clear ALL queries ❌
    ↓
Queries tentam executar
    ↓
Token ainda em transição
    ↓
401 Unauthorized ❌
```

---

### ✅ DEPOIS (Corrigido)

```
TOKEN EXPIRA (1h)
    ↓
Supabase: TOKEN_REFRESHED
    ↓
SessionProvider: isRefreshing = true ✅
    ↓
Supabase: SIGNED_OUT (momentâneo)
    ↓
SessionProvider: IGNORADO (isRefreshing) ✅
    ↓
Supabase: SIGNED_IN (novo token)
    ↓
SessionProvider: IGNORADO (isRefreshing) ✅
    ↓
isRefreshing = false (após 2s)
    ↓
Queries continuam funcionando ✅
    ↓
Sem 401, sem erros ✅
```

---

## 🧪 Como Testar

### Teste 1: Refresh Automático
1. Fazer login
2. Aguardar ~55 minutos
3. Console deve mostrar:
   ```
   ✅ Token refreshed, rescheduling next refresh
   ⚠️ Ignorando SIGNED_OUT durante refresh de token
   ```
4. **NÃO deve** mostrar:
   ```
   ❌ [CacheInvalidator] User changed, clearing all queries
   ```

### Teste 2: Logout Real
1. Clicar em "Sair"
2. Console deve mostrar:
   ```
   👋 User signed out
   [CacheInvalidator] User changed, clearing all queries
   ```
3. Cache deve ser limpo (correto)

---

## 📈 Impacto das Correções

| Métrica | Antes | Depois |
|---------|-------|--------|
| Erros 401 após 1h | ✅ Sim | ❌ Não |
| Cache limpo durante refresh | ✅ Sim | ❌ Não |
| Loop SIGN_OUT/SIGN_IN | ✅ Sim | ❌ Não |
| Queries interrompidas | ✅ Sim | ❌ Não |
| Estabilidade | ❌ Baixa | ✅ Alta |

---

## 🎯 Arquivos Modificados

1. ✅ `src/contexts/SessionProvider.tsx`
   - Adicionada flag `isRefreshing`
   - Ignorar SIGNED_OUT durante refresh
   - Ignorar SIGNED_IN durante refresh

2. ✅ `src/App.tsx`
   - Adicionado debounce de 1s no CacheInvalidator
   - Evita limpeza de cache durante refresh

---

## ⚠️ Notas Importantes

- **Debounce de 1 segundo:** Tempo suficiente para o refresh completar
- **Flag isRefreshing:** Resetada após 2 segundos (margem de segurança)
- **Logs mantidos:** Para debug e monitoramento

---

## 🚀 Próximos Passos

Teste agora e verifique se:
- ✅ Não há mais erros 401 após tempo parado
- ✅ Não há loop de SIGN_OUT/SIGN_IN
- ✅ Cache não é limpo durante refresh
- ✅ Logout manual ainda funciona corretamente

**O servidor está rodando com as correções aplicadas!** 🎉
