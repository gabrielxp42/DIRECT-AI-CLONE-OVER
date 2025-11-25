# Correção do Erro 401 (JWT Expired) ao Criar Pedidos

## Problema Identificado

O erro **"JWT expired" (401)** estava acontecendo porque:

1. O token do Supabase expira em **1 hora**
2. Quando o usuário ficava muito tempo na página, o token expirava
3. Ao tentar criar um pedido ou fazer qualquer requisição, o sistema fazia a requisição **ANTES** de renovar o token
4. Resultado: Erro 401 e necessidade de dar F5 para recarregar

## Solução Implementada

### 1. **Token Refresh Proativo** (`tokenRefresh.ts`)
- Modificado para fazer refresh **IMEDIATO** se o token expira em menos de **10 minutos**
- Antes: Apenas agendava o refresh para o futuro
- Agora: Verifica e renova imediatamente se necessário

### 2. **Token Guard** (`tokenGuard.ts` - NOVO)
- Criado um módulo de proteção que **garante** que o token está válido antes de cada requisição
- Verifica se o token expira em menos de **2 minutos**
- Se sim, faz refresh **IMEDIATO** e **AGUARDA** a conclusão antes de prosseguir
- Evita que múltiplos refreshes aconteçam simultaneamente (usa Promise compartilhada)

### 3. **Integração com Hooks**
- `useDataFetch.ts`: Adicionado `ensureValidToken()` antes de todas as requisições
- `useDashboardData.ts`: Adicionado `ensureValidToken()` antes de buscar dados do dashboard

## Como Funciona Agora

```
1. Usuário tenta criar pedido
   ↓
2. Sistema chama ensureValidToken()
   ↓
3. Verifica: Token expira em menos de 2 minutos?
   ├─ SIM → Faz refresh IMEDIATO e aguarda
   └─ NÃO → Continua normalmente
   ↓
4. Requisição é feita com token VÁLIDO
   ↓
5. ✅ Sucesso! Sem erro 401
```

## Benefícios

✅ **Sem mais erros 401** ao criar pedidos
✅ **Sem necessidade de F5** para recarregar a página
✅ **Experiência do usuário melhorada** - tudo funciona automaticamente
✅ **Proteção em camadas**:
   - Refresh automático agendado (tokenRefresh.ts)
   - Verificação antes de cada requisição (tokenGuard.ts)

## Arquivos Modificados

1. `src/utils/tokenRefresh.ts` - Refresh proativo
2. `src/utils/tokenGuard.ts` - **NOVO** - Proteção de token
3. `src/hooks/useDataFetch.ts` - Integração do tokenGuard
4. `src/hooks/useDashboardData.ts` - Integração do tokenGuard

## Teste

Para testar:
1. Faça login
2. Deixe a página aberta por mais de 55 minutos
3. Tente criar um pedido
4. ✅ Deve funcionar sem erro 401
5. ✅ Não precisa mais dar F5

## Logs no Console

Você verá logs como:
- `[TokenGuard] Token expires in X minutes, refreshing NOW...`
- `[TokenGuard] Token refreshed successfully`
- `[TokenRefresh] Token will be refreshed in X minutes`

Esses logs confirmam que o sistema está protegendo contra tokens expirados.
