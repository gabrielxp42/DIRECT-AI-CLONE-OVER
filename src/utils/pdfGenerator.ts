import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Pedido } from '@/types/pedido';

// Função para converter imagem para base64
const getImageAsBase64 = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      resolve(dataURL);
    };
    img.onerror = reject;
    img.src = url;
  });
};

export const generateOrderPDF = async (pedido: Pedido, action: 'save' | 'print' = 'save') => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Helper function to format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Helper function to format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  let yPosition = 15;

  // Header section with logo area and company info
  doc.setDrawColor(0, 0, 0); // PRETO
  doc.setLineWidth(0.5);
  doc.rect(10, 10, pageWidth - 20, 35); // Main header border

  // Logo area (black background)
  doc.setFillColor(0, 0, 0);
  doc.rect(15, 15, 25, 25, 'F');
  
  // Tentar carregar a logo real
  try {
    // Carregar a logo do projeto
    const logoBase64 = await getImageAsBase64('/logo.png');
    
    // Inserir a logo real no PDF
    doc.addImage(logoBase64, 'PNG', 17, 17, 21, 21);
    
  } catch (error) {
    console.log('Erro ao carregar logo, usando placeholder:', error);
    
    // Fallback: Representação melhorada da sua logo
    // Fundo escuro (representando o "D" invertido ou a área ao redor)
    doc.setFillColor(0, 0, 0); // Preto
    doc.rect(17, 17, 21, 21, 'F');
    
    // Área amarela interna (formato do "D")
    doc.setFillColor(255, 242, 0); // Amarelo #FFF200
    doc.ellipse(27.5, 27.5, 8, 8, 'F');
    
    // Camiseta amarela no centro
    doc.setFillColor(255, 242, 0); // Amarelo #FFF200
    doc.rect(24, 24, 7, 7, 'F');
  }
  
  // Company name
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('DIRECT DTF', 45, 25);
  
  // Company address - INFORMAÇÕES ATUALIZADAS
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Rod. Washington Luiz, 3926 - Vila Sao Sebastiao', 45, 32);
  doc.text('Duque de Caxias - RJ, 25055-009 | CORREDOR F | LOJA 246', 45, 36);
  doc.text('TELEFONE: +55 21 99594-0055', 45, 40);
  
  // Contact info (right side) - INFORMAÇÕES ATUALIZADAS
  doc.setFontSize(8);
  doc.text('PIX: +55 21 99594-0055', pageWidth - 60, 25);
  doc.text('EMAIL: DIRETONODTF@GMAIL.COM', pageWidth - 60, 29);

  yPosition = 55;

  // Order number and date - BARRA PRETA
  doc.setDrawColor(0, 0, 0); // PRETO
  doc.setLineWidth(0.5);
  doc.rect(10, yPosition, pageWidth - 20, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pedido nº ${pedido.order_number}`, 15, yPosition + 8); // Usando order_number
  doc.text(`Data: ${formatDate(pedido.created_at)}`, pageWidth - 60, yPosition + 8);

  yPosition += 20;

  // Client section - BARRAS PRETAS
  doc.setDrawColor(0, 0, 0); // PRETO
  doc.rect(10, yPosition, pageWidth - 20, 8);
  doc.setFillColor(240, 240, 240);
  doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente', 15, yPosition + 6);

  yPosition += 8;
  doc.setDrawColor(0, 0, 0); // PRETO
  doc.rect(10, yPosition, pageWidth - 20, 8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${pedido.clientes?.nome || 'Cliente não encontrado'}`, 15, yPosition + 6);

  yPosition += 8;
  doc.setDrawColor(0, 0, 0); // PRETO
  doc.rect(10, yPosition, pageWidth - 20, 8);
  doc.text(`Telefone: ${pedido.clientes?.telefone || 'N/A'}`, 15, yPosition + 6); // Usando o telefone do cliente
  
  yPosition += 15;

  // Products section - BARRAS PRETAS
  if (pedido.pedido_items.length > 0) {
    doc.setDrawColor(0, 0, 0); // PRETO
    doc.rect(10, yPosition, pageWidth - 20, 8);
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Produtos', 15, yPosition + 6);

    yPosition += 8;

    // Products table - TODAS AS LINHAS PRETAS
    const productRows = pedido.pedido_items.map(item => {
      const productName = item.produto_nome || item.produtos?.nome || 'Produto não encontrado';
      const itemDescription = item.observacao ? `\nObs: ${item.observacao}` : ''; // Adiciona quebra de linha e prefixo
      
      // Combina nome e observação em uma única string
      const firstColumnContent = productName + itemDescription;

      return [
        firstColumnContent,
        item.quantidade.toString(),
        formatCurrency(item.preco_unitario),
        formatCurrency(item.quantidade * item.preco_unitario)
      ];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [['Nome', 'Quantidade', 'Valor Unitário', 'Total']],
      body: productRows,
      theme: 'grid',
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center',
        lineColor: [0, 0, 0], // PRETO
        lineWidth: 0.5
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0], // PRETO
        lineWidth: 0.5
      },
      columnStyles: {
        0: { cellWidth: 100, halign: 'left' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' }
      },
      margin: { left: 10, right: 10 },
      tableWidth: pageWidth - 20,
      tableLineColor: [0, 0, 0], // PRETO
      tableLineWidth: 0.5
    });

    yPosition = (doc as any).lastAutoTable.finalY + 5;
  }

  // Services section - BARRAS PRETAS
  if (pedido.servicos && pedido.servicos.length > 0) {
    doc.setDrawColor(0, 0, 0); // PRETO
    doc.rect(10, yPosition, pageWidth - 20, 8);
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Serviços', 15, yPosition + 6);

    yPosition += 8;

    // Services table - TODAS AS LINHAS PRETAS
    const serviceRows = pedido.servicos.map(servico => [
      servico.nome,
      servico.quantidade.toString(),
      formatCurrency(servico.valor_unitario),
      formatCurrency(servico.quantidade * servico.valor_unitario)
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Nome', 'Quantidade', 'Valor Unitário', 'Total']],
      body: serviceRows,
      theme: 'grid',
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center',
        lineColor: [0, 0, 0], // PRETO
        lineWidth: 0.5
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0], // PRETO
        lineWidth: 0.5
      },
      columnStyles: {
        0: { cellWidth: 100, halign: 'left' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' }
      },
      margin: { left: 10, right: 10 },
      tableWidth: pageWidth - 20,
      tableLineColor: [0, 0, 0], // PRETO
      tableLineWidth: 0.5
    });

    yPosition = (doc as any).lastAutoTable.finalY + 5;
  }

  // Observations section - BARRAS PRETAS
  if (pedido.observacoes) {
    doc.setDrawColor(0, 0, 0); // PRETO
    doc.rect(10, yPosition, pageWidth - 20, 8);
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações', 15, yPosition + 6);

    yPosition += 8;
    
    const observationsHeight = Math.max(15, doc.splitTextToSize(pedido.observacoes, pageWidth - 30).length * 5); // Calculate height based on split text
    doc.setDrawColor(0, 0, 0); // PRETO
    doc.rect(10, yPosition, pageWidth - 20, observationsHeight);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    const splitText = doc.splitTextToSize(pedido.observacoes, pageWidth - 30);
    doc.text(splitText, 15, yPosition + 5);
    
    yPosition += observationsHeight + 5;
  }

  // Financial summary table - BARRAS PRETAS
  const summaryData = [
    ['Subtotal Produtos', formatCurrency(pedido.subtotal_produtos || 0)],
    ['Subtotal Serviços', formatCurrency(pedido.subtotal_servicos || 0)]
  ];

  // Add discount row if there's a discount
  if (pedido.desconto_valor > 0) {
    const discountLabel = pedido.desconto_percentual > 0 
      ? `Desconto (${pedido.desconto_percentual}%)`
      : 'Desconto';
    summaryData.push([discountLabel, `-${formatCurrency(pedido.desconto_valor)}`]);
  }
  
  // NOVO: Adicionar Total Metros
  if (pedido.total_metros > 0) {
    summaryData.push(['Total Metros (ML)', `${pedido.total_metros.toFixed(2)} ML`]);
  }

  summaryData.push(['Total Final', formatCurrency(pedido.valor_total)]);

  autoTable(doc, {
    startY: yPosition,
    body: summaryData,
    theme: 'grid',
    bodyStyles: {
      fontSize: 9,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0], // PRETO
      lineWidth: 0.5
    },
    columnStyles: {
      0: { cellWidth: 40, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 40, halign: 'right' }
    },
    margin: { left: pageWidth - 90, right: 10 },
    tableWidth: 80,
    tableLineColor: [0, 0, 0], // PRETO
    tableLineWidth: 0.5
  });

  // Save or Print the PDF
  const clientName = pedido.clientes?.nome?.replace(/[^a-zA-Z0-9]/g, '_') || 'Cliente_Desconhecido';
  const orderNumber = pedido.order_number; // Usando order_number
  const fileName = `PEDIDO_${orderNumber}_${clientName}.pdf`;

  if (action === 'print') {
    // Nova abordagem: gerar blob, criar URL e abrir para impressão
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    const printWindow = window.open(pdfUrl, '_blank');
    
    if (printWindow) {
      // Tenta acionar a impressão após o carregamento
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        // Opcional: Revogar o URL do objeto após um pequeno atraso
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
      };
    } else {
      // Se o pop-up for bloqueado, tenta abrir diretamente
      window.location.href = pdfUrl;
    }
    
  } else {
    // Default action: save
    doc.save(fileName);
  }
};