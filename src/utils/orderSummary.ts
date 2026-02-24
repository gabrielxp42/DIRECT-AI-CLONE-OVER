import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pedido } from '@/types/pedido';

export const generateOrderSummary = (pedido: Pedido, template?: string, pixKey?: string | null) => {
    const formatDate = (dateString: string) => {
        try {
            return format(new Date(dateString), "dd/MM - HH:mm", { locale: ptBR });
        } catch (e) {
            return "-";
        }
    };

    const formatCurrency = (value: any) => {
        const val = Number(value) || 0;
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(val);
    };

    const separator = "------------------------------------------";
    const dashedSeparator = "        ------------------";

    // Lógica de Status Unificada
    const statusText = (pedido.status === 'pago' || pedido.pago_at) ? 'PAGO' : pedido.status.toUpperCase();

    // --- Logic for Dynamic Template ---
    if (template) {
        const clientName = pedido.clientes?.nome || "Cliente";

        const itemsList = pedido.pedido_items?.map((item: any) => {
            const isLinear = item.tipo === 'dtf' || item.tipo === 'vinil';
            const unitSingular = isLinear ? 'metro' : 'unid.';
            const itemTotal = Number(item.preco_unitario || 0) * Number(item.quantidade || 0);
            const totalStr = formatCurrency(itemTotal);
            const unitStr = formatCurrency(item.preco_unitario || 0);
            return `• ${item.quantidade}x ${item.produtos?.nome || item.produto_nome || "Item"} (${unitStr}/${unitSingular}) - ${totalStr}`;
        }).join('\n') || "";

        const dateStr = formatDate(pedido.created_at);
        const phoneStr = pedido.clientes?.telefone || '-';

        let servicosStr = "";
        if (pedido.servicos && pedido.servicos.length > 0) {
            servicosStr += `*SERVIÇOS EXTRAS*\n`;
            pedido.servicos.forEach(servico => {
                const lineTotal = formatCurrency(Number(servico.valor_unitario) * Number(servico.quantidade));
                servicosStr += `${servico.nome} (${servico.quantidade}x) - ${lineTotal}\n`;
            });
        }

        let entregaStr = "";
        if (pedido.tipo_entrega === 'frete') {
            if (pedido.valor_frete && Number(pedido.valor_frete) > 0) {
                entregaStr += `FRETE: ${formatCurrency(pedido.valor_frete)}\n`;
            }
            if (pedido.transportadora) {
                entregaStr += `TRANSPORTADORA: ${pedido.transportadora.toUpperCase()}\n`;
            }
        } else if (pedido.tipo_entrega === 'retirada') {
            entregaStr = "RETIRADA NO LOCAL";
        }

        const subtotalProdutos = Number(pedido.subtotal_produtos || 0);
        const subtotalServicos = Number(pedido.subtotal_servicos || 0);
        const subtotal = subtotalProdutos + subtotalServicos;
        const frete = (pedido.tipo_entrega === 'frete' ? Number(pedido.valor_frete || 0) : 0);
        const descontoValor = Number(pedido.desconto_valor || 0);
        const descontoPercentual = Number(pedido.desconto_percentual || 0);
        const descontoPercentualCalculado = subtotal * (descontoPercentual / 100);
        const valorTotalCalculado = Math.max(0, subtotal + frete - descontoValor - descontoPercentualCalculado);

        let finalMessage = template
            .replace(/{{cliente}}/g, clientName)
            .replace(/{{telefone}}/g, phoneStr)
            .replace(/{{order_number}}/g, (pedido.order_number || 0).toString())
            .replace(/{{data_criacao}}/g, dateStr)
            .replace(/{{tracking_code}}/g, (pedido.tracking_code && !pedido.tracking_code.startsWith('ADI')) ? pedido.tracking_code : "")
            .replace(/{{tracking}}/g, (pedido.tracking_code && !pedido.tracking_code.startsWith('ADI')) ? pedido.tracking_code : "")
            .replace(/{{total}}/g, formatCurrency(valorTotalCalculado))
            .replace(/{{subtotal}}/g, formatCurrency(subtotal))
            .replace(/{{frete_valor}}/g, formatCurrency(frete))
            .replace(/{{desconto}}/g, formatCurrency(descontoValor + descontoPercentualCalculado))
            .replace(/{{transportadora}}/g, pedido.transportadora || "")
            .replace(/{{itens}}/g, itemsList || "Nenhum item")
            .replace(/{{servicos}}/g, servicosStr)
            .replace(/{{entrega_info}}/g, entregaStr)
            .replace(/{{pix}}/g, pixKey || "")
            .replace(/{{status}}/g, statusText);

        return finalMessage;
    }

    // --- Fallback to Hardcoded (Original) Logic ---
    let summary = `*PEDIDO #${pedido.order_number}*\n`;
    summary += `${formatDate(pedido.created_at)}\n\n`;
    summary += `${separator}\n`;
    summary += `*${pedido.clientes?.nome?.toUpperCase() || 'CLIENTE NÃO IDENTIFICADO'}*\n`;
    summary += `Tel: ${pedido.clientes?.telefone || '-'}\n`;
    summary += `${separator}\n\n`;

    if (pedido.pedido_items && pedido.pedido_items.length > 0) {
        pedido.pedido_items.forEach((item, index) => {
            const isLinear = item.tipo === 'dtf' || item.tipo === 'vinil';
            const unitFull = isLinear ? 'Metros' : 'Unid.';
            const unitSingular = isLinear ? 'metro' : 'unid.';
            const quantityDisplay = isLinear
                ? Number(item.quantidade).toFixed(2).replace('.', ',')
                : item.quantidade;

            summary += `*Produto:* ${item.produto_nome} ${(item.tipo) ? `(${item.tipo.toUpperCase()})` : ''}\n`;
            summary += `*Tamanho:* ${quantityDisplay} ${unitFull}\n`;
            summary += `*Valor unitário:* ${formatCurrency(item.preco_unitario)}/${unitSingular}\n`;
            summary += `*Total:* ${formatCurrency(Number(item.preco_unitario) * Number(item.quantidade))}\n`;
            if (item.observacao) {
                summary += `_Obs: ${item.observacao}_\n`;
            }

            if (index < pedido.pedido_items.length - 1 || (pedido.servicos && pedido.servicos.length > 0)) {
                summary += `${dashedSeparator}\n\n`;
            }
        });
    }

    if (pedido.servicos && pedido.servicos.length > 0) {
        summary += `*SERVIÇOS EXTRAS*\n`;
        pedido.servicos.forEach(servico => {
            const lineTotal = formatCurrency(Number(servico.valor_unitario) * Number(servico.quantidade));
            const namePart = `${servico.nome} (${servico.quantidade}x)`;
            summary += `${namePart}\nTotal: ${lineTotal}\n`;
        });
        summary += `${separator}\n\n`;
    } else if (pedido.pedido_items && pedido.pedido_items.length > 0) {
        summary += `${separator}\n\n`;
    }

    const subtotalProdutos = Number(pedido.subtotal_produtos || 0);

    if (pedido.tipo_entrega === 'frete' && pedido.tracking_code && !pedido.tracking_code.startsWith('ADI')) {
        summary += `📦 *CÓD. RASTREIO:* ${pedido.tracking_code}\n`;
        summary += `${separator}\n\n`;
    }
    const subtotalServicos = Number(pedido.subtotal_servicos || 0);
    const subtotal = subtotalProdutos + subtotalServicos;
    const frete = (pedido.tipo_entrega === 'frete' ? Number(pedido.valor_frete || 0) : 0);
    const descontoValor = Number(pedido.desconto_valor || 0);
    const descontoPercentual = Number(pedido.desconto_percentual || 0);
    const descontoPercentualCalculado = subtotal * (descontoPercentual / 100);
    const valorTotalCalculado = Math.max(0, subtotal + frete - descontoValor - descontoPercentualCalculado);

    summary += `*TOTAL: ${formatCurrency(valorTotalCalculado)}*\n`;

    if (pedido.tipo_entrega === 'frete') {
        if (pedido.valor_frete && Number(pedido.valor_frete) > 0) {
            summary += `FRETE: ${formatCurrency(pedido.valor_frete)}\n`;
        }
        if (pedido.transportadora) {
            summary += `TRANSPORTADORA: ${pedido.transportadora.toUpperCase()}\n`;
        }
    } else if (pedido.tipo_entrega === 'retirada') {
        summary += `RETIRADA NO LOCAL\n`;
    }

    summary += `STATUS: ${statusText}\n`;
    summary += `\n*** AGRADECEMOS A PREFERÊNCIA ***`;

    return summary;
};
