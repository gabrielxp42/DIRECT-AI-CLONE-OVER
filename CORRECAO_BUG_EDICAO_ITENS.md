# Correção do Bug de Edição de Itens no PedidoForm

## 🐛 Problema Reportado

### Sintomas:
1. **Primeiro bug**: Ao criar um novo item, os campos apareciam vazios no card superior, mas não eram editáveis
2. **Segundo bug (mais grave)**: Ao editar itens existentes, o **último item da lista** ficava "travado" - não era possível editar nem apagar o texto
3. **Padrão identificado**: O item de CIMA era editável, mas o de BAIXO não. Ao inverter a ordem, o problema seguia o item que estava na posição inferior

## 🔍 Causa Raiz Identificada

### Problema 1: Conflito entre `{...field}` e `value` sobrescrito
```tsx
// ❌ ERRADO - Causa conflito
<Input 
  {...field}              // Já inclui value e onChange
  value={field.value || ''}  // Sobrescreve value mas não onChange
/>
```

Quando usamos `{...field}` do React Hook Form, ele já inclui:
- `name`
- `value`  
- `onChange`
- `onBlur`
- `ref`

Se sobrescrevemos apenas o `value` mas mantemos o `onChange` original do spread, o input fica "dessinconizado" - o React vê o value mas o onChange não atualiza corretamente.

### Problema 2: Mutação Direta do Array
```tsx
// ❌ ERRADO - Muta o objeto diretamente
if (!item.tempId) {
  item.tempId = Math.random().toString(36).substr(2, 9);
}
```

Quando você muta um objeto que vem do `form.watch()`, você está modificando o estado interno do React Hook Form de forma incorreta. Isso causa:
- Dessinconização entre estado e UI
- Re-renders inesperados
- Campos "travados" especialmente no último item da lista

### Por que afetava especialmente o último item?
O React processa arrays do início para o fim. Quando:
1. Um item é aberto (via accordion)
2. O array é mutado diretamente
3. O React Hook Form re-renderiza

O **último item** sofre mais porque:
- É o último a ser processado
- Acumula problemas de re-renders anteriores
- O índice muda mas o accordion ainda aponta para o índice antigo
- O FormField perde a referência correta

## ✅ Solução Implementada

### 1. Remover `{...field}` e definir props explicitamente

**Para campos de texto:**
```tsx
<Input
  name={field.name}
  value={field.value || ''}  // Garante string ao invés de undefined
  onChange={field.onChange}
  onBlur={field.onBlur}
  ref={field.ref}
  placeholder="Nome do produto"
  className="bg-background"
/>
```

**Para campos numéricos:**
```tsx
<Input
  type="number"
  step="0.01"
  name={field.name}
  value={field.value ?? ''}  // Usa ?? para aceitar 0
  onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
  onBlur={field.onBlur}
  ref={field.ref}
  className="bg-background"
/>
```

### 2. Remover mutação direta e usar keys estáveis

```tsx
// ✅ CORRETO - Não muta, usa fallback para key
{items.map((item, index) => {
  const isOpen = accordionItemValue === `item-${index}`;
  const itemKey = item.tempId || `temp-${index}-${item.produto_nome || 'novo'}`;
  
  return (
    <SortableItem key={itemKey} id={itemKey}>
      {/* ... */}
    </SortableItem>
  );
})}
```

### 3. Manter `form.watch('items')` sem mutações

```tsx
const items = form.watch('items') || [];
const itemIds = useMemo(() => items.map((item) => item.tempId || `temp-${items.indexOf(item)}`), [items]);
```

O `watch` é necessário para re-renderizar quando items mudam, mas agora sem mutações diretas.

## 📊 Arquivos Modificados

- ✏️ `src/components/PedidoForm.tsx`
  - Linhas 999-1007: Campo `produto_nome`
  - Linhas 1018-1028: Campo `quantidade`  
  - Linhas 1057-1067: Campo `observacao`
  - Linhas 1230-1240: Campo `servicos[].nome`
  - Linhas 1242-1252: Campo `servicos[].quantidade`
  - Linha 689: Mantido `form.watch('items')`
  - Linhas 894-897: Removida mutação de `tempId`

## 🎯 Resultado Esperado

Agora TODOS os campos devem:
- ✅ Ser editáveis tanto em novos itens quanto em itens existentes
- ✅ Funcionar corretamente independente da posição na lista (topo, meio ou fundo)
- ✅ Aceitar edição, remoção e adição de texto normalmente
- ✅ Manter sincronia entre o valor exibido e o valor no formulário
- ✅ Funcionar após reordenação via drag-and-drop

## 🧪 Como Testar

1. Criar um novo pedido
2. Adicionar múltiplos itens (pelo menos 3)
3. Tentar editar o ÚLTIMO item da lista - deve funcionar
4. Reordenar os itens via drag-and-drop
5. Editar novamente o item que agora está na última posição - deve funcionar
6. Editar campos de texto (nome, observação)
7. Editar campos numéricos (quantidade)
8. Todos devem aceitar edição sem travar

## 📝 Lições Aprendidas

1. **NUNCA use `{...field}` e sobrescreva `value`** - defina todas as props explicitamente
2. **NUNCA mute objetos** que vêm de `watch()` ou `getValues()`
3. **Use keys estáveis** baseadas em IDs únicos, não apenas em índices
4. **Teste especialmente o último item** de listas dinâmicas - ele acumula bugs mais facilmente
