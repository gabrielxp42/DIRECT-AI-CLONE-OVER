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
        title: 'Serviços e Mão de Obra',
        description: 'Não trabalhe de graça! Adicione taxas de montagem, edições de arte ou ajustes rápidos. Valorize cada minuto do seu trabalho técnico.',
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
