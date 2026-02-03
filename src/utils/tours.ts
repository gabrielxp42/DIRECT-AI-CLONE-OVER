import { TutorialStep } from '@/components/TutorialGuide';

export const PEDIDOS_TOUR: TutorialStep[] = [
    {
        targetId: 'btn-novo-pedido',
        title: 'O Ponto de Partida',
        description: 'Tudo começa aqui. Nossa interface de criação é otimizada para ser extremamente rápida, permitindo que você cadastre pedidos complexos em segundos.',
        position: 'bottom'
    },
    {
        targetId: 'search-pedidos',
        title: 'Busca Inteligente',
        description: 'Encontre qualquer coisa instantaneamente. Nome do cliente, número do pedido ou até mesmo um produto específico. Pare de procurar em pastas e planilhas.',
        position: 'bottom'
    },
    {
        targetId: 'btn-gerar-orcamento',
        title: 'Orçamentos em Segundos',
        description: 'A nova Calculadora DTF 2.0 ajuda você a calcular a metragem exata para seus pedidos. Evite desperdícios e dê orçamentos precisos para seus clientes instantaneamente.',
        position: 'bottom'
    },
    {
        targetId: 'first-order-card',
        title: 'O Card do Pedido',
        description: 'Cada card é um resumo vivo. Ele mostra o valor total, o cliente e, o mais importante: os indicadores de produção (DTF, Vinil, etc.) para você saber exatamente o que precisa ser feito sem precisar abrir o pedido.',
        position: 'bottom'
    },
    {
        targetId: 'order-status-badge',
        title: 'Gestão de Fluxo',
        description: 'O status indica onde o pedido está. Clique diretamente no ícone de status para alterá-lo. Isso mantém sua equipe alinhada e o cliente informado.',
        position: 'bottom'
    },
    {
        targetId: 'order-card-actions',
        title: 'Documentos e Notas',
        description: 'Agilidade é lucro! Gere PDFs, etiquetas de produção ou imprima a nota para o cliente com apenas um clique. Sem burocracia, direto ao ponto.',
        position: 'top'
    }
];

export const NEW_ORDER_TOUR: TutorialStep[] = [
    {
        targetId: 'field-cliente',
        title: 'Gestão Inteligente de Clientes',
        description: 'Selecione um cliente e veja o sistema carregar automaticamente a tabela de preços personalizada dele. Eficiência total!',
        position: 'bottom'
    },
    {
        targetId: 'btn-magic-import',
        title: 'Poder da Inteligência Artificial',
        description: 'Não perca tempo digitando! Copie a lista do WhatsApp ou cole um texto bruto aqui. Nossa IA identifica produtos, quantidades e medidas instantaneamente.',
        position: 'bottom'
    },
    {
        targetId: 'items-section',
        title: 'Controle de Produção',
        description: 'Aqui você organiza o que será produzido. O sistema soma os metros lineares em tempo real para te dar o custo exato.',
        position: 'top'
    },
    {
        targetId: 'item-type-selector',
        title: 'Múltiplos Processos',
        description: 'Troque entre DTF, Vinil ou outros processos. Cada tipo tem sua própria cor e ícone para que sua equipe de produção não cometa erros.',
        position: 'right'
    },
    {
        targetId: 'item-details-fields',
        title: 'Especificações Técnicas',
        description: 'Ajuste quantidades, preços ou adicione observações detalhadas. Tudo o que você preencher aqui vai direto para a ficha de produção.',
        position: 'top'
    },
    {
        targetId: 'services-section',
        title: 'Atalhos de Serviços Inteligentes',
        description: 'Não trabalhe de graça! Use os novos atalhos inteligentes para adicionar taxas de entrega ou montagem em um clique. O sistema aprende quais você mais usa para agilizar seu dia.',
        position: 'top'
    },
    {
        targetId: 'btn-save-pedido',
        title: 'Finalização Profissional',
        description: 'Salve o pedido para gerar o financeiro e enviar a ordem para a fila de produção. Pronto para faturar!',
        position: 'top'
    }
];

export const WELCOME_TOUR: TutorialStep[] = [
    {
        targetId: 'ai-assistant-widget',
        title: 'Sua Inteligência de Negócio',
        description: 'Eu analiso seu histórico para prever demandas, sugerir preços e organizar sua rotina. É como ter um gerente de produção 24h ao seu lado.',
        position: 'bottom'
    },
    {
        targetId: 'user-nav-dropdown',
        title: 'Sua Empresa, Sua Identidade',
        description: 'Clique aqui e acesse "Configurações" para personalizar suas ordens de serviço com sua logo, dados de contato e chave PIX. Deixe o sistema com a cara da sua marca!',
        position: 'bottom'
    },
    {
        targetId: 'quick-actions-container, mobile-quick-actions, mobile-action-pedido',
        title: 'Agilidade Operacional',
        description: 'As tarefas mais comuns estão a um toque de distância. Cadastre clientes ou inicie produções sem navegar por menus complexos.',
        position: 'bottom'
    },
    {
        targetId: 'status-charts-container',
        title: 'Visão 360° da Fábrica',
        description: 'Gráficos em tempo real mostram sua capacidade produtiva e gargalos. Tome decisões baseadas em dados, não em palpites.',
        position: 'top'
    }
];

export const SETTINGS_TOUR: TutorialStep[] = [
    {
        targetId: 'company-logo-section',
        title: 'Sua Marca em Destaque',
        description: 'Faça upload da sua logo aqui. Ela aparecerá automaticamente no topo de todos os PDFs e notas gerados pelo sistema.',
        position: 'bottom'
    },
    {
        targetId: 'company-info-section',
        title: 'Dados Profissionais',
        description: 'Mantenha o nome e slogan da sua empresa atualizados para que seus clientes identifiquem suas ordens de serviço instantaneamente.',
        position: 'bottom'
    },
    {
        targetId: 'contact-info-section',
        title: 'Facilite o Contato',
        description: 'Seus telefones e e-mails comerciais aparecerão no rodapé dos documentos, facilitando a comunicação com seus clientes.',
        position: 'bottom'
    },
    {
        targetId: 'address-info-section',
        title: 'Presença Física',
        description: 'O endereço completo da sua gráfica ajuda na credibilidade e serve como referência para retiradas e entregas.',
        position: 'bottom'
    },
    {
        targetId: 'payment-info-section',
        title: 'Receba Mais Rápido',
        description: 'Configure sua chave PIX para que ela apareça direto na nota do cliente. Menos burocracia, mais dinheiro no caixa!',
        position: 'top'
    }
];

export const REPORTS_TOUR: TutorialStep[] = [
    {
        targetId: 'reports-period-selector',
        title: 'Controle de Tempo',
        description: 'Aqui você altera a janela de análise. Compare o desempenho de hoje com o de meses anteriores para entender sua sazonalidade.',
        position: 'bottom'
    },
    {
        targetId: 'reports-revenue-card',
        title: 'Receita e Crescimento',
        description: 'Veja quanto entrou no caixa e, o mais importante: o indicador de crescimento comparando com o mês passado. Se estiver verde, você está no caminho certo!',
        position: 'bottom'
    },
    {
        targetId: 'reports-meters-card',
        title: 'Inteligência de Produção',
        description: 'O grande diferencial! Saiba exatamente quantos metros lineares ou unidades de cada tipo (DTF, Vinil) você produziu. Isso é vital para gerir estoque e insumos.',
        position: 'bottom'
    },
    {
        targetId: 'reports-profit-card',
        title: 'A Realidade do Lucro',
        description: 'Aqui calculamos seu lucro real subtraindo o custo dos insumos. Saiba sua margem líquida e pare de ter surpresas no fim do mês.',
        position: 'bottom'
    },
    {
        targetId: 'reports-charts-section',
        title: 'Tendências Visuais',
        description: 'Os gráficos mostram os picos de demanda. Use o botão "Diária" para ver o detalhe dia a dia e identificar seus melhores períodos.',
        position: 'top'
    },
    {
        targetId: 'reports-tabs-section',
        title: 'Aprofundamento Financeiro',
        description: 'Explore as abas para gerir Comissões, entender quais status de pedidos mais geram receita e quem são seus melhores clientes.',
        position: 'top'
    }
];
export const PRODUTOS_GENERAL_TOUR: TutorialStep[] = [
    {
        targetId: 'tab-produtos',
        title: 'Gestão de Catálogo',
        description: 'Aqui você gerencia seus produtos. Cadastre preços, controle o estoque e vincule insumos para descontar automaticamente na produção.',
        position: 'bottom'
    },
    {
        targetId: 'search-produtos',
        title: 'Busca Rápida',
        description: 'Encontre seus produtos instantaneamente por nome ou descrição. Mantenha seu catálogo organizado e acessível.',
        position: 'bottom'
    },
    {
        targetId: 'btn-add-produto',
        title: 'Novo item',
        description: 'Cadastre novos itens em seu catálogo aqui. Defina se é um produto de balcão ou um serviço personalizado.',
        position: 'bottom'
    }
];

export const PRODUTOS_PRODUCAO_TOUR: TutorialStep[] = [
    {
        targetId: 'tab-producao',
        title: 'Tipos de Produção',
        description: 'Configure seus processos (DTF, Vinil, etc.). Você pode definir cores e ícones para facilitar a identificação visual em toda a plataforma.',
        position: 'bottom'
    }
];

export const PRODUTOS_SERVICOS_TOUR: TutorialStep[] = [
    {
        targetId: 'tab-servicos',
        title: 'Atalhos de Serviços',
        description: 'A grande novidade! Aqui você gerencia os atalhos que aparecem no modal de pedidos. O sistema aprende seus serviços mais usados automaticamente.',
        position: 'bottom'
    },
    {
        targetId: 'card-novo-atalho',
        title: 'Criação Manual',
        description: 'Adicione atalhos personalizados para serviços fixos, como "Arte Final" ou "Frete". Eles ficarão disponíveis para acesso rápido.',
        position: 'top'
    },
    {
        targetId: 'card-atalhos-fixados',
        title: 'Itens de Elite',
        description: 'Serviços fixados aparecem sempre no topo da lista no momento da venda. Use para o que você mais precisa!',
        position: 'top'
    },
    {
        targetId: 'card-sugestoes-automaticas',
        title: 'Inteligência Artificial',
        description: 'O sistema monitora o que você digita nos pedidos e sugere automaticamente novos atalhos',
        position: 'top'
    }
];

/*
# Task: Budget Calculator Analysis & Optimization

- [x] Integrate Tutorial System in DTF Calculator
    - [x] Create `CALCULADORA_TOUR` steps
    - [x] Add "Learn how to use" button to calculator header
    - [x] Trigger tutorial automatically on first access
    - [x] Implement visual anchors for all tutorial steps
    - [x] Implement dynamic mode switching during tutorial (Simple <=> Multi)
- [x] Deep analysis of `DTFCalculatorModal.tsx` logic
    - [x] Analyze multi-item stacking vs nesting
    - [x] Identify bugs in summary generation
    - [x] Identify UI/UX imperfections
- [ ] Implement fixes for identified bugs
    - [ ] Fix multi-item WhatsApp/Copy summary
    - [ ] Add per-item overflow validation in multi-mode
    - [ ] Add global efficiency metric for multi-item
- [ ] Enhance Multi-Item features
    - [ ] Add names/labels to items
    - [ ] Improve "Fill by Meters" logic
- [ ] Propose/Implement integration with `PedidoForm.tsx`

# Task: Login System & Launch Readiness Audit

- [x] Line-by-line analysis of `Login.tsx`
- [x] Analysis of `SessionProvider.tsx` and session management stability
- [x] Review of payment systems (Stripe integration, Edge Functions)
- [/] Develop Launch Readiness Plan
    - [x] Identify security vulnerabilities (RLS, token management)
    - [x] Identify UX/UX missing pieces (Subscription management)
    - [x] Audit cross-user data isolation (RLS audit)
- [ ] Implement priority launch fixes
    - [ ] Update `tokenGuard.ts` for session storage compatibility
    - [ ] Enhance Stripe webhook error handling and cancellation logic
    - [ ] Add "Manage Subscription" capability via Stripe Customer Portal
*/

export const CALCULADORA_TOUR: TutorialStep[] = [
    {
        targetId: 'calculator-title',
        title: 'Bem-vindo à Calculadora 2.0',
        description: 'Nossa ferramenta foi reconstruída para ser a mais precisa do mercado. Agora você pode simular layouts complexos com vários itens de uma vez.',
        position: 'bottom'
    },
    {
        targetId: 'calculator-mode-switch',
        title: 'Modos de Trabalho',
        description: 'Alterne entre o modo SIMPLES (uma logo repetida) ou MULTI (várias logos diferentes no mesmo rolo).',
        position: 'bottom'
    },
    {
        targetId: 'calculator-main-input',
        title: 'Modo Simples',
        description: 'Ideal para quando você tem apenas um arquivo e quer repetir ele várias vezes no rolo.',
        position: 'top',
        onEnter: () => { window.dispatchEvent(new CustomEvent('tour-set-mode', { detail: 'simple' })); }
    },
    {
        targetId: 'calculator-main-input',
        title: 'Poder do Multi-Itens',
        description: 'Agora a parte incrível: no modo Multi-Itens você pode adicionar DIFERENTES logos e tamanhos no mesmo orçamento.',
        position: 'top',
        onEnter: () => { window.dispatchEvent(new CustomEvent('tour-set-mode', { detail: 'multi' })); }
    },
    {
        targetId: 'calculator-material-settings',
        title: 'Configurações de Material',
        description: 'Defina a largura do seu rolo e a margem de segurança. O sistema recalcula tudo em tempo real.',
        position: 'bottom'
    },
    {
        targetId: 'calculator-efficiency-badge',
        title: 'Eficiência de Material',
        description: 'Este indicador diz quanto do seu material está sendo aproveitado. Economize material e aumente seu lucro!',
        position: 'bottom'
    },
    {
        targetId: 'calculator-item-actions',
        title: 'Recursos Avançados',
        description: 'Use o botão "Preencher" para completar o rolo automaticamente ou deixe o sistema sugerir a melhor rotação.',
        position: 'left'
    },
    {
        targetId: 'calculator-finalize',
        title: 'Finalização e Rapidez',
        description: 'Gere um resumo detalhado para seu cliente. Se o seu WhatsApp estiver conectado, enviamos direto! Caso contrário, geramos o link ou o resumo para você copiar.',
        position: 'top'
    }
];
