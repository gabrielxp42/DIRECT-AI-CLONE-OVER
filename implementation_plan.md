# Plano de Implementação: Melhorias Gerais e IA Proativa

Este plano detalha a implementação das melhorias aprovadas para o sistema DIRECT AI, focando em UX, funcionalidades de negócio e inteligência artificial proativa.

## Fase 1: UX e Navegação (Prioridade Imediata)
- [x] **Busca Global (Command Palette)**
    - Implementar atalho `Ctrl+K` / `Cmd+K`.
    - Permitir busca rápida de Clientes e Pedidos.
    - Ações rápidas de navegação (Ir para Dashboard, Novo Pedido, etc.).
    - Utilizar a biblioteca `cmdk` já instalada.
- [x] **Empty States Ricos**
    - [x] Criar componentes visuais para quando não houver dados em Pedidos e Clientes.
    - [ ] Aplicar Empty State na página de Relatórios.
    - Incluir botões de ação direta (CTA) nesses estados.
- [ ] **Feedback Visual Aprimorado**
    - Adicionar micro-animações (ex: `framer-motion` ou CSS transitions) em ações de sucesso.
    - Melhorar visualização de status em mobile (barra lateral colorida nos cards).

## Fase 2: Inteligência Artificial Proativa
- [x] **Criação de Pedidos via IA (Chat/Voz)**
    - [x] Criar nova tool `create_order_draft` para a IA.
    - [x] Permitir que a IA preencha um "rascunho" de pedido baseado em texto livre (ex: "Pedido pro João de 5m").
    - [x] Interface para o usuário revisar e confirmar o rascunho (Card Interativo no Chat).
- [x] **Insights no Dashboard**
    - Criar componente `AIMessagesWidget` (substituto do AIInsightsCard).
    - Implementar lógica de fetch direto para performance e resiliência.
    - Funcionalidade de Swipe-to-dismiss e persistência.
- [ ] **Resumo Diário Inteligente**
    - Botão "Gerar Resumo do Dia" que compila vendas, pendências e alertas em um texto conciso.

## Fase 3: Funcionalidades de Negócio (ERP)
- [x] **Gestão de Estoque de Insumos**
    - [x] Criar tabela `insumos` (Script SQL gerado).
    - [x] Criar lógica de baixa automática (Script SQL `estoque_automacao.sql` criado e UI atualizada).
    - [x] Interface para gestão de insumos (CRUD).
    - [x] Alertas de estoque baixo (Visual na listagem).
- [x] **Melhorias de UX/UI (Dashboard 2.0)**
    - [x] Ações Rápidas (Quick Actions) no Dashboard com abertura direta de modais.
    - [x] Sugestões de Comandos (Chips) no Chat da IA.
    - [x] Card de Resumo Rápido com métricas visuais.
    - [x] Responsividade otimizada (botões ocultos no mobile).
    - [x] Gráficos de vendas e metragem na página de Relatórios.
- [ ] **Controle de Despesas (Fluxo de Caixa)**
    - Criar tabela `despesas`.
    - Interface para lançamento de contas (luz, aluguel, matéria-prima).
    - Atualizar relatórios para mostrar Lucro Líquido (Receita - Despesas).

## Fase 4: Polimento Final
- [ ] Revisão geral de acessibilidade e performance.
- [ ] Testes de usabilidade das novas funções.
