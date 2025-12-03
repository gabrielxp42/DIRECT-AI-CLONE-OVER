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

  // Header section with logo area and company info - MAIS COMPACTO
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(10, 10, pageWidth - 20, 28); // Reduzido de 35 para 28

  // Logo area (black background)
  doc.setFillColor(0, 0, 0);
  doc.rect(15, 13, 20, 20, 'F'); // Reduzido

  // Tentar carregar a logo real
  try {
    const logoBase64 = await getImageAsBase64('/logo.png');
    doc.addImage(logoBase64, 'PNG', 16, 14, 18, 18); // Ajustado
  } catch (error) {
    console.log('Erro ao carregar logo, usando placeholder:', error);
    doc.setFillColor(0, 0, 0);
    doc.rect(16, 14, 18, 18, 'F');
    doc.setFillColor(255, 242, 0);
    doc.ellipse(25, 23, 7, 7, 'F');
    doc.setFillColor(255, 242, 0);
    doc.rect(22, 20, 6, 6, 'F');
  }

  // Company name
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14); // Reduzido de 16
  doc.setFont('helvetica', 'bold');
  doc.text('DIRECT DTF', 40, 20);

  // Company address - MAIS COMPACTO
  doc.setFontSize(7); // Reduzido de 8
  doc.setFont('helvetica', 'normal');
  doc.text('Rod. Washington Luiz, 3926 - Vila Sao Sebastiao', 40, 26);
  doc.text('Duque de Caxias - RJ, 25055-009 | CORREDOR F | LOJA 246', 40, 29);
  doc.text('TELEFONE: +55 21 99594-0055', 40, 32);

  // Contact info (right side)
  doc.setFontSize(7);
  doc.text('PIX: +55 21 99594-0055', pageWidth - 55, 20);
  doc.text('EMAIL: DIRETONODTF@GMAIL.COM', pageWidth - 55, 24);

  yPosition = 45; // Reduzido de 55

  // Order number and date - MAIS COMPACTO
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(10, yPosition, pageWidth - 20, 10); // Reduzido de 12 para 10
  doc.setFontSize(9); // Reduzido de 10
  doc.setFont('helvetica', 'bold');
  doc.text(`Pedido nº ${pedido.order_number}`, 15, yPosition + 6);
  doc.text(`Data: ${formatDate(pedido.created_at)}`, pageWidth - 60, yPosition + 6);

  yPosition += 15; // Reduzido de 20

  // Client section - MAIS COMPACTO
  doc.setDrawColor(0, 0, 0);
  doc.rect(10, yPosition, pageWidth - 20, 7); // Reduzido de 8
  doc.setFillColor(240, 240, 240);
  doc.rect(10, yPosition, pageWidth - 20, 7, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Cliente', 15, yPosition + 5);

  yPosition += 7;
  doc.setDrawColor(0, 0, 0);
  doc.rect(10, yPosition, pageWidth - 20, 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Nome: ${pedido.clientes?.nome || 'Cliente não encontrado'}`, 15, yPosition + 5);

  yPosition += 7;
  doc.setDrawColor(0, 0, 0);
  doc.rect(10, yPosition, pageWidth - 20, 7);
  doc.text(`Telefone: ${pedido.clientes?.telefone || 'N/A'}`, 15, yPosition + 5);

  yPosition += 12; // Reduzido de 15

  // Products section
  if (pedido.pedido_items.length > 0) {
    doc.setDrawColor(0, 0, 0);
    doc.rect(10, yPosition, pageWidth - 20, 7);
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPosition, pageWidth - 20, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Produtos', 15, yPosition + 5);

    yPosition += 7;

    // Products table - MAIS COMPACTA
    const sortedItems = [...pedido.pedido_items].sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0));

    const productRows = sortedItems.map(item => {
      const productName = item.produto_nome || item.produtos?.nome || 'Produto não encontrado';
      const itemDescription = item.observacao ? `\nObs: ${item.observacao}` : '';
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
        fontSize: 8, // Reduzido de 9
        fontStyle: 'bold',
        halign: 'center',
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
        cellPadding: 2 // Reduzido
      },
      bodyStyles: {
        fontSize: 7, // Reduzido de 8
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
        cellPadding: 2 // Reduzido
      },
      columnStyles: {
        0: { cellWidth: 100, halign: 'left' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' }
      },
      margin: { left: 10, right: 10 },
      tableWidth: pageWidth - 20,
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.5
    });

    yPosition = (doc as any).lastAutoTable.finalY + 3; // Reduzido de 5
  }

  // Services section
  if (pedido.servicos && pedido.servicos.length > 0) {
    doc.setDrawColor(0, 0, 0);
    doc.rect(10, yPosition, pageWidth - 20, 7);
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPosition, pageWidth - 20, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Serviços', 15, yPosition + 5);

    yPosition += 7;

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
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
        cellPadding: 2
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
        cellPadding: 2
      },
      columnStyles: {
        0: { cellWidth: 100, halign: 'left' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' }
      },
      margin: { left: 10, right: 10 },
      tableWidth: pageWidth - 20,
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.5
    });

    yPosition = (doc as any).lastAutoTable.finalY + 3;
  }

  // Total Metros - POSIÇÃO FIXA E ÚNICA (removido duplicação)
  if (pedido.total_metros && pedido.total_metros > 0) {
    doc.setDrawColor(0, 0, 0);
    doc.rect(10, yPosition, pageWidth - 20, 7);
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPosition, pageWidth - 20, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Metros (ML): ${pedido.total_metros.toFixed(2)} ML`, 15, yPosition + 5);
    yPosition += 10;
  }

  // Observations section - MAIS COMPACTO
  if (pedido.observacoes) {
    doc.setDrawColor(0, 0, 0);
    doc.rect(10, yPosition, pageWidth - 20, 7);
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPosition, pageWidth - 20, 7, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Observações', 15, yPosition + 5);

    yPosition += 7;

    const observationsHeight = Math.max(12, doc.splitTextToSize(pedido.observacoes, pageWidth - 30).length * 4);
    doc.setDrawColor(0, 0, 0);
    doc.rect(10, yPosition, pageWidth - 20, observationsHeight);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    const splitText = doc.splitTextToSize(pedido.observacoes, pageWidth - 30);
    doc.text(splitText, 15, yPosition + 4);

    yPosition += observationsHeight + 3;
  }

  // Financial summary table - MAIS COMPACTO
  const summaryData = [
    ['Subtotal Produtos', formatCurrency(pedido.subtotal_produtos || 0)],
    ['Subtotal Serviços', formatCurrency(pedido.subtotal_servicos || 0)]
  ];

  if (pedido.desconto_valor > 0) {
    const discountLabel = pedido.desconto_percentual > 0
      ? `Desconto (${pedido.desconto_percentual}%)`
      : 'Desconto';
    summaryData.push([discountLabel, `-${formatCurrency(pedido.desconto_valor)}`]);
  }

  summaryData.push(['Total Final', formatCurrency(pedido.valor_total)]);

  autoTable(doc, {
    startY: yPosition,
    body: summaryData,
    theme: 'grid',
    bodyStyles: {
      fontSize: 8, // Reduzido de 9
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      cellPadding: 2
    },
    columnStyles: {
      0: { cellWidth: 40, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 40, halign: 'right' }
    },
    margin: { left: pageWidth - 90, right: 10 },
    tableWidth: 80,
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.5
  });

  // Save or Print the PDF
  const clientName = pedido.clientes?.nome?.replace(/[^a-zA-Z0-9]/g, '_') || 'Cliente_Desconhecido';
  const orderNumber = pedido.order_number;
  const fileName = `PEDIDO_${orderNumber}_${clientName}.pdf`;

  if (action === 'print') {
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);

    const printWindow = window.open(pdfUrl, '_blank');

    if (printWindow) {
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
      };
    } else {
      window.location.href = pdfUrl;
    }

  } else {
    doc.save(fileName);
  }
};