import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Pedido } from '@/types/pedido';
import { TipoProducao } from '@/types/producao';

// Company info interface for PDF generation
export interface CompanyInfoForPDF {
  company_name: string;
  phone?: string;
  email?: string;
  address_full?: string;
  pix_key?: string;
  logo_url?: string;
}

// Default company info (fallback)
const DEFAULT_COMPANY_INFO: CompanyInfoForPDF = {
  company_name: 'Minha Empresa',
  phone: '',
  email: '',
  address_full: '',
  pix_key: '',
  logo_url: '/logo.png',
};

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

export const generateOrderPDF = async (
  pedido: Pedido,
  action: 'save' | 'print' = 'save',
  tiposProducao?: TipoProducao[],
  companyInfo?: CompanyInfoForPDF
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Use provided company info or defaults
  const company = { ...DEFAULT_COMPANY_INFO, ...companyInfo };

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

  // Tentar carregar a logo (company logo or fallback)
  const logoUrl = company.logo_url || '/logo.png';
  try {
    const logoBase64 = await getImageAsBase64(logoUrl);
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

  // Company name (dynamic)
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(company.company_name.toUpperCase(), 40, 20);

  // Company address - MAIS COMPACTO (dynamic)
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');

  // Split address into lines if too long
  if (company.address_full) {
    const addressLines = doc.splitTextToSize(company.address_full, 80);
    addressLines.slice(0, 2).forEach((line: string, index: number) => {
      doc.text(line, 40, 26 + (index * 3));
    });
  }

  if (company.phone) {
    doc.text(`TELEFONE: ${company.phone}`, 40, 32);
  }

  // Contact info (right side) - dynamic
  doc.setFontSize(7);
  if (company.pix_key) {
    doc.text(`PIX: ${company.pix_key}`, pageWidth - 55, 20);
  }
  if (company.email) {
    doc.text(`EMAIL: ${company.email.toUpperCase()}`, pageWidth - 55, 24);
  }

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

      // Observação limpa (agora nativa)
      const cleanObs = (item.observacao || '').trim();
      const itemDescription = cleanObs ? `\nObs: ${cleanObs}` : '';

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

  // CÁLCULO DINÂMICO DE TOTAIS POR TIPO
  const totalsByType = new Map<string, number>();

  pedido.pedido_items.forEach(item => {
    const tipo = (item.tipo || 'dtf').toLowerCase();
    const current = totalsByType.get(tipo) || 0;
    totalsByType.set(tipo, current + Number(item.quantidade || 0));
  });

  // Exibir totais separados
  if (totalsByType.size > 0) {
    const typesWithTotal = Array.from(totalsByType.entries());
    const boxHeight = Math.ceil(typesWithTotal.length / 2) * 6 + 2;

    doc.setDrawColor(0, 0, 0);
    doc.rect(10, yPosition, pageWidth - 20, boxHeight);
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPosition, pageWidth - 20, boxHeight, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');

    typesWithTotal.forEach(([tipo, total], index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = col === 0 ? 15 : pageWidth / 2;
      const y = yPosition + 5 + (row * 6);

      const tipoInfo = tiposProducao?.find(t => t.nome.toLowerCase() === tipo);
      const unit = tipoInfo?.unidade_medida === 'unidade' ? 'und' : 'm';
      const label = tipoInfo?.nome || tipo.toUpperCase();

      doc.text(`Total ${label}: ${total.toFixed(total % 1 === 0 && unit === 'und' ? 0 : 2)} ${unit}`, x, y);
    });

    yPosition += boxHeight + 3;
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

  const subtotal = (pedido.subtotal_produtos || 0) + (pedido.subtotal_servicos || 0);
  const freteValue = pedido.tipo_entrega === 'frete' ? (pedido.valor_frete || 0) : 0;
  const discountTotal = (pedido.desconto_valor || 0) + (subtotal * ((pedido.desconto_percentual || 0) / 100));
  const finalTotalCalculated = Math.max(0, subtotal + freteValue - discountTotal);

  if (pedido.tipo_entrega) {
    const deliveryLabel = pedido.tipo_entrega === 'frete' ? 'Entrega (Frete)' : 'Retirada no Local';
    const deliveryValue = pedido.tipo_entrega === 'frete' ? formatCurrency(pedido.valor_frete || 0) : 'R$ 0,00';
    summaryData.push([deliveryLabel, deliveryValue]);

    if (pedido.tipo_entrega === 'frete' && pedido.transportadora) {
      summaryData.push(['Transportadora', pedido.transportadora]);
    }
  }

  summaryData.push(['Total Final', formatCurrency(finalTotalCalculated)]);

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

export const generateOrderPDFBase64 = async (
  pedido: Pedido,
  tiposProducao?: TipoProducao[],
  companyInfo?: CompanyInfoForPDF
): Promise<string> => {
  // Create a new doc for base64 export
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const company = { ...DEFAULT_COMPANY_INFO, ...companyInfo };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  let yPosition = 15;

  // Header & Logo
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5); doc.rect(10, 10, pageWidth - 20, 28);
  doc.setFillColor(0, 0, 0); doc.rect(15, 13, 20, 20, 'F');
  const logoUrl = company.logo_url || '/logo.png';
  try {
    const logoBase64 = await getImageAsBase64(logoUrl);
    doc.addImage(logoBase64, 'PNG', 16, 14, 18, 18);
  } catch (e) {
    doc.setFillColor(0, 0, 0); doc.rect(16, 14, 18, 18, 'F');
    doc.setFillColor(255, 242, 0); doc.ellipse(25, 23, 7, 7, 'F');
  }

  // Info
  doc.setTextColor(0, 0, 0); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(company.company_name.toUpperCase(), 40, 20);
  doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  if (company.address_full) {
    doc.splitTextToSize(company.address_full, 80).slice(0, 2).forEach((l: any, i: number) => doc.text(l, 40, 26 + (i * 3)));
  }
  if (company.phone) doc.text(`TELEFONE: ${company.phone}`, 40, 32);
  if (company.pix_key) doc.text(`PIX: ${company.pix_key}`, pageWidth - 55, 20);

  yPosition = 45;

  // Order Info
  doc.setDrawColor(0, 0, 0); doc.rect(10, yPosition, pageWidth - 20, 10);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text(`Pedido nº ${pedido.order_number}`, 15, yPosition + 6);
  doc.text(`Data: ${formatDate(pedido.created_at)}`, pageWidth - 60, yPosition + 6);
  yPosition += 15;

  // Client
  doc.rect(10, yPosition, pageWidth - 20, 7); doc.setFillColor(240, 240, 240); doc.rect(10, yPosition, pageWidth - 20, 7, 'F');
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('Cliente', 15, yPosition + 5);
  yPosition += 7;
  doc.rect(10, yPosition, pageWidth - 20, 7); doc.setFont('helvetica', 'normal'); doc.text(`Nome: ${pedido.clientes?.nome || ''}`, 15, yPosition + 5);
  yPosition += 7;
  doc.rect(10, yPosition, pageWidth - 20, 7); doc.text(`Tel: ${pedido.clientes?.telefone || ''}`, 15, yPosition + 5);
  yPosition += 12;

  // Items
  if (pedido.pedido_items.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [['Nome', 'Qtd', 'Unit', 'Total']],
      body: pedido.pedido_items.map((i: any) => [
        i.produto_nome || i.produtos?.nome,
        i.quantidade,
        formatCurrency(i.preco_unitario),
        formatCurrency(i.quantidade * i.preco_unitario)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontSize: 8 },
      bodyStyles: { fontSize: 7, textColor: 0 },
      margin: { left: 10, right: 10 },
      tableWidth: pageWidth - 20
    });
    yPosition = (doc as any).lastAutoTable.finalY + 3;
  }

  // Services
  if (pedido.servicos?.length) {
    autoTable(doc, {
      startY: yPosition,
      head: [['Nome', 'Qtd', 'Unit', 'Total']],
      body: pedido.servicos.map((s: any) => [s.nome, s.quantidade, formatCurrency(s.valor_unitario), formatCurrency(s.quantidade * s.valor_unitario)]),
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontSize: 8 },
      bodyStyles: { fontSize: 7, textColor: 0 },
      margin: { left: 10, right: 10 },
      tableWidth: pageWidth - 20
    });
    yPosition = (doc as any).lastAutoTable.finalY + 3;
  }

  // Totals
  const subtotal = (pedido.subtotal_produtos || 0) + (pedido.subtotal_servicos || 0);
  const discount = (pedido.desconto_valor || 0) + (subtotal * ((pedido.desconto_percentual || 0) / 100));
  const final = Math.max(0, subtotal + (pedido.tipo_entrega === 'frete' ? (pedido.valor_frete || 0) : 0) - discount);

  autoTable(doc, {
    startY: yPosition,
    body: [['Total Final', formatCurrency(final)]],
    theme: 'grid',
    bodyStyles: { fontSize: 8, fontStyle: 'bold' },
    margin: { left: pageWidth - 90 },
    tableWidth: 80
  });

  return doc.output('datauristring').split(',')[1];
};