// Na função list_orders, modifique a parte de aplicar o limite:

if (name === "list_orders") {
  let { startDate, endDate, limit = 10, orderBy = 'created_at_desc', includeTotalCount } = args;

  // ... código anterior mantido ...

  // Modificação chave: Remover limite quando includeTotalCount for verdadeiro
  if (!includeTotalCount || (limit && limit > 0)) {
    query = query.limit(limit);
  } else {
    // Se includeTotalCount for verdadeiro, não aplicar limite
    // Isso garantirá que todos os pedidos sejam retornados
    limit = null;
  }

  const { data: orders, error, count } = await query;

  // ... resto do código mantido ...
}