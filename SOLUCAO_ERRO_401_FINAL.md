# ✅ Solução Definitiva para Erro 401 (JWT Expired)

## 🎯 O Problema
O usuário relatou que, após um tempo logado, o site começava a apresentar erros `401 Unauthorized` (JWT expired) ao tentar carregar dados (clientes, produtos, pedidos) ou salvar alterações.

**Causa Raiz:**
1. O token de acesso (`access_token`) tem validade de 1 hora.
2. O `SessionProvider` do React mantém o token em memória.
3. Embora o refresh automático estivesse configurado, em alguns casos (especialmente PWA ou abas inativas), o token em memória ficava estale (antigo).
4. As requisições `fetch` manuais e mutações usavam esse token estale, causando erro 401.

## 🛠️ A Solução Implementada

Implementamos uma estratégia de **"Token on Demand"** (Token sob Demanda). Em vez de confiar no token do contexto, agora **sempre verificamos e obtemos um token válido imediatamente antes de qualquer requisição**.

### 1. `src/utils/tokenGuard.ts`
- Criada função `getValidToken()` que:
    - Lê o token do `localStorage`.
    - Verifica se está expirado (com margem de segurança).
    - **Faz refresh automático via fetch** se necessário.
    - Retorna um token garantidamente válido.

### 2. `src/hooks/useDataFetch.ts`
- Atualizado o mecanismo de retry para usar `getValidToken()` quando ocorre um erro 401.
- Corrigido problema de importação que causava `ReferenceError`.

### 3. Atualização de Componentes e Páginas
Todos os locais que faziam `fetch` manual ou mutações foram atualizados para usar `getValidToken()`:

- **`src/pages/Pedidos.tsx`**: Mutações de criar, atualizar, excluir e mudar status.
- **`src/pages/Clientes.tsx`**: Mutações de criar, atualizar e excluir.
- **`src/pages/Produtos.tsx`**: Mutações de criar, atualizar e excluir.
- **`src/pages/Insumos.tsx`**: Fetch de listagem e salvamento.
- **`src/components/AIMessagesWidget.tsx`**: Fetch de insights.
- **`src/hooks/useServiceCommissionReport.ts`**: Fetch de relatórios.

## 🧪 Como Verificar
1. Logar na aplicação.
2. Aguardar 1 hora (ou simular expiração alterando o `expires_at` no localStorage).
3. Tentar realizar qualquer operação (salvar pedido, carregar clientes, etc.).
4. O sistema deve:
    - Detectar o token expirado.
    - Renovar o token silenciosamente em background.
    - Completar a operação com sucesso.
    - **Nenhum erro 401 deve aparecer para o usuário.**

## ⚠️ Importante
Nunca mais use `session.access_token` diretamente para requisições `fetch` críticas. Sempre use:
```typescript
import { getValidToken } from '@/utils/tokenGuard';

// ...
const token = await getValidToken();
if (!token) throw new Error("Sessão expirada");
// ... fetch com token
```
