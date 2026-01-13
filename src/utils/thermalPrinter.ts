
import { Pedido } from '@/types/pedido';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const printThermalReceipt = (pedido: Pedido) => {
  const width = '80mm';

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM - HH:mm", { locale: ptBR });
  };

  // Determine status text
  const statusText = pedido.status === 'pago' ? 'PAGO' : 'NÃO PAGO';

  // Extract Freight from services
  let freightValue = 0;
  const servicesWithoutFreight = pedido.servicos.filter(s => {
    if (s.nome.toLowerCase().includes('frete') || s.nome.toLowerCase().includes('entrega')) {
      freightValue += (s.valor_unitario * s.quantidade);
      return false; // Remove from generic services list
    }
    return true; // Keep other services
  });

  const hasFreight = freightValue > 0;

  // Build Items HTML
  const itemsHtml = pedido.pedido_items.map(item => {
    // Determine unit labels based on type
    const isLinear = item.tipo === 'dtf' || item.tipo === 'vinil';
    const unitFull = isLinear ? 'Metros' : 'Unidades';
    const unitSingular = isLinear ? 'metro' : 'unidade';

    // Format quantity to always show decimals for linear items
    const quantityDisplay = isLinear
      ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(item.quantidade))
      : item.quantidade;

    return `
    <div class="item-block">
      <div class="line"><strong>Produto:</strong> ${item.produto_nome} ${(item.tipo) ? `(${item.tipo.toUpperCase()})` : ''}</div>
      <div class="line"><strong>Tamanho:</strong> ${quantityDisplay} ${unitFull}</div>
      <div class="line"><strong>Valor unitário:</strong> ${formatCurrency(item.preco_unitario)}/${unitSingular}</div>
      <div class="line"><strong>Total:</strong> ${formatCurrency(item.preco_unitario * item.quantidade)}</div>
      ${item.observacao ? `<div class="line" style="font-style: italic; font-size: 11px; margin-top: 2px;">Obs: ${item.observacao}</div>` : ''}
    </div>
    <div class="separator-dashed">- - - - - - - - - - - -</div>
  `}).join('');

  // Build Services HTML (excluding freight)
  const servicesHtml = servicesWithoutFreight.length > 0 ?
    `<div class="section-title" style="margin-top: 10px; font-size: 12px;">SERVIÇOS EXTRAS</div>` +
    servicesWithoutFreight.map(servico => `
    <div class="compact-row">
      <span class="compact-name">${servico.nome} (${servico.quantidade}x)</span>
      <span class="compact-price">${formatCurrency(servico.valor_unitario * servico.quantidade)}</span>
    </div>
  `).join('') : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Cupom Pedido #${pedido.order_number}</title>
      <style>
        @page {
          margin: 0;
          size: 80mm auto; 
        }
        body {
          font-family: 'Arial', 'Helvetica', sans-serif; /* Cleaner sans-serif font */
          width: 72mm;
          margin: 0 auto;
          padding: 5px 0;
          color: #000;
          background: #fff;
          font-size: 13px; /* Increased from 12px */
          line-height: 1.3;
          font-weight: 500;
        }
        .header {
          text-align: center;
          margin-bottom: 15px;
        }
        .title {
          font-size: 18px; /* Larger title */
          font-weight: 900;
          display: block;
        }
        .subtitle {
          font-size: 14px;
          margin-top: 5px;
        }
        .section {
          margin-bottom: 10px;
        }
        .section-title {
          font-weight: bold;
          text-decoration: underline;
          margin-bottom: 5px;
          font-size: 14px;
        }
        .line {
          margin-bottom: 3px;
        }
        .separator {
          margin: 10px 0;
          border-bottom: 2px solid #000;
        }
        .separator-dashed {
          margin: 5px 0;
          text-align: center;
          color: #333;
          font-size: 10px;
        }
        .item-block {
          margin-bottom: 8px;
        }
        .compact-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px; /* Smaller font for secondary info */
          margin-bottom: 2px;
        }
        .compact-name {
          flex: 1;
          text-align: left;
        }
        .compact-price {
          text-align: right;
          min-width: 60px;
        }
        .total-block {
          margin-top: 10px;
          font-size: 18px;
          font-weight: 900;
          text-align: right;
          border-top: 2px solid #000;
          padding-top: 5px;
        }
        .footer {
          margin-top: 25px;
          text-align: center;
          font-size: 11px;
        }
        /* Hide scrollbars */
        ::-webkit-scrollbar {
          display: none;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <span class="title">PEDIDO #${pedido.order_number}</span>
        <span class="subtitle">${formatDate(pedido.created_at)}</span>
      </div>

      <div class="separator"></div>

      <div class="section">
        <div class="line" style="font-size: 15px; font-weight: bold;">${pedido.clientes?.nome?.toUpperCase() || 'CLIENTE NÃO IDENTIFICADO'}</div>
        <div class="line">Tel: ${pedido.clientes?.telefone || '-'}</div>
      </div>

      <div class="separator"></div>

      ${itemsHtml}

      ${servicesHtml}

      ${hasFreight ? `
      <div class="compact-row" style="margin-top: 5px; font-weight: bold;">
         <span class="compact-name" style="text-align: right; padding-right: 10px;">FRETE:</span>
         <span class="compact-price">${formatCurrency(freightValue)}</span>
      </div>` : ''}
      
      <div class="total-block">
        TOTAL: ${formatCurrency(pedido.valor_total)}
      </div>
      
      <div class="line" style="text-align: right; margin-top: 5px;">
        Status: <strong>${statusText}</strong>
      </div>

      <div class="footer">
        <p>*** AGRADECEMOS A PREFERÊNCIA ***</p>
      </div>
      
      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=450,height=600');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
  } else {
    alert('Pop-up bloqueado. Permita pop-ups para imprimir.');
  }
};
