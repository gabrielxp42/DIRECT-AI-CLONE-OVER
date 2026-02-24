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

// Função centralizada que constrói o documento PDF
const generateOrderPDFDocument = async (
  pedido: Pedido,
  tiposProducao?: TipoProducao[],
  companyInfo?: CompanyInfoForPDF
): Promise<jsPDF> => {
  console.log(`[PDF] Iniciando documentação unificada para pedido #${pedido.order_number}`);
  const doc = new jsPDF({ compress: true });
  const pageWidth = doc.internal.pageSize.width;
  const company = { ...DEFAULT_COMPANY_INFO, ...companyInfo };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('pt-BR');
    } catch (e) {
      return 'N/A';
    }
  };

  let yPosition = 15;

  // Cabeçalho e Logo
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5); doc.rect(10, 10, pageWidth - 20, 28);

  // Black box for logo (visual consistency)
  doc.setFillColor(0, 0, 0); doc.rect(15, 13, 20, 20, 'F');

  const logoUrl = company.logo_url || '/logo.png';
  try {
    const logoBase64 = await getImageAsBase64(logoUrl);
    doc.addImage(logoBase64, 'PNG', 16, 14, 18, 18, undefined, 'FAST');
  } catch (e) {
    console.warn("[PDF] Falha ao carregar logo, usando fallback visual.");
    doc.setFillColor(0, 0, 0); doc.rect(16, 14, 18, 18, 'F');
    doc.setFillColor(255, 242, 0); doc.ellipse(25, 23, 7, 7, 'F');
    doc.setFillColor(255, 242, 0); doc.rect(22, 20, 6, 6, 'F');
  }

  // Info da Empresa
  doc.setTextColor(0, 0, 0); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(company.company_name.toUpperCase(), 40, 20);
  doc.setFontSize(7); doc.setFont('helvetica', 'normal');

  if (company.address_full) {
    const addressLines = doc.splitTextToSize(company.address_full, 80);
    addressLines.slice(0, 2).forEach((l: string, i: number) => doc.text(l, 40, 26 + (i * 3)));
  }

  if (company.phone) doc.text(`TELEFONE: ${company.phone}`, 40, 32);

  // Dados de Contato / PIX à Direita
  doc.setFontSize(8);
  if (company.pix_key) doc.text(`PIX: ${company.pix_key}`, pageWidth - 15, 20, { align: 'right' });
  if (company.email) doc.text(`EMAIL: ${company.email.toUpperCase()}`, pageWidth - 15, 24, { align: 'right' });

  yPosition = 45;

  // Informações do Pedido
  doc.setDrawColor(0, 0, 0); doc.rect(10, yPosition, pageWidth - 20, 10);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text(`Pedido nº ${pedido.order_number}`, 15, yPosition + 6);
  doc.text(`Data: ${formatDate(pedido.created_at)}`, pageWidth - 15, yPosition + 6, { align: 'right' });
  yPosition += 15;

  // Seção do Cliente
  doc.rect(10, yPosition, pageWidth - 20, 7);
  doc.setFillColor(240, 240, 240); doc.rect(10, yPosition, pageWidth - 20, 7, 'F');
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('Cliente', 15, yPosition + 5);
  yPosition += 7;

  doc.rect(10, yPosition, pageWidth - 20, 7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${pedido.clientes?.nome || 'Cliente não encontrado'}`, 15, yPosition + 5);
  yPosition += 7;

  doc.rect(10, yPosition, pageWidth - 20, 7);
  doc.text(`Telefone: ${pedido.clientes?.telefone || 'N/A'}`, 15, yPosition + 5);
  yPosition += 12;

  // Seção de Produtos
  if (pedido.pedido_items && pedido.pedido_items.length > 0) {
    doc.rect(10, yPosition, pageWidth - 20, 7);
    doc.setFillColor(240, 240, 240); doc.rect(10, yPosition, pageWidth - 20, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Produtos', 15, yPosition + 5);
    yPosition += 7;

    const sortedItems = [...pedido.pedido_items].sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0));
    const productRows = sortedItems.map(item => {
      const name = item.produto_nome || item.produtos?.nome || 'Produto';
      const obs = (item.observacao || '').trim() ? `\nObs: ${item.observacao}` : '';
      return [
        name + obs,
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
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontSize: 8, fontStyle: 'bold', halign: 'center', lineColor: 0, lineWidth: 0.5 },
      bodyStyles: { fontSize: 7, textColor: 0, lineColor: 0, lineWidth: 0.5 },
      columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 25, halign: 'center' }, 2: { cellWidth: 30, halign: 'right' }, 3: { cellWidth: 35, halign: 'right' } },
      margin: { left: 10, right: 10 },
      tableWidth: pageWidth - 20,
    });
    yPosition = (doc as any).lastAutoTable.finalY + 3;
  }

  // Seção de Serviços
  if (pedido.servicos && pedido.servicos.length > 0) {
    doc.rect(10, yPosition, pageWidth - 20, 7);
    doc.setFillColor(240, 240, 240); doc.rect(10, yPosition, pageWidth - 20, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Serviços', 15, yPosition + 5);
    yPosition += 7;

    autoTable(doc, {
      startY: yPosition,
      head: [['Nome', 'Quantidade', 'Valor Unitário', 'Total']],
      body: pedido.servicos.map(s => [
        s.nome,
        s.quantidade.toString(),
        formatCurrency(s.valor_unitario),
        formatCurrency(s.quantidade * s.valor_unitario)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontSize: 8, fontStyle: 'bold', halign: 'center', lineColor: 0, lineWidth: 0.5 },
      bodyStyles: { fontSize: 7, textColor: 0, lineColor: 0, lineWidth: 0.5 },
      columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 25, halign: 'center' }, 2: { cellWidth: 30, halign: 'right' }, 3: { cellWidth: 35, halign: 'right' } },
      margin: { left: 10, right: 10 },
      tableWidth: pageWidth - 20,
    });
    yPosition = (doc as any).lastAutoTable.finalY + 3;
  }

  // Totais Por Tipo (Cálculo Dinâmico)
  // Re-garantir que temos Totais por Tipo se houver itens
  const totalsByType = new Map<string, number>();
  pedido.pedido_items?.forEach(item => {
    const tipo = (item.tipo || 'dtf').toLowerCase();
    totalsByType.set(tipo, (totalsByType.get(tipo) || 0) + Number(item.quantidade || 0));
  });

  if (totalsByType.size > 0) {
    const typesArr = Array.from(totalsByType.entries());
    const boxH = Math.ceil(typesArr.length / 2) * 6 + 2;
    doc.setDrawColor(0, 0, 0); doc.rect(10, yPosition, pageWidth - 20, boxH);
    doc.setFillColor(240, 240, 240); doc.rect(10, yPosition, pageWidth - 20, boxH, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');

    typesArr.forEach(([tipo, total], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = col === 0 ? 15 : pageWidth / 2;
      const y = yPosition + 5 + (row * 6);

      const tInfo = tiposProducao?.find(t => t.nome.toLowerCase() === tipo);
      const unit = tInfo?.unidade_medida === 'unidade' ? 'und' : 'm';
      const label = tInfo?.nome || tipo.toUpperCase();

      doc.text(`Total ${label}: ${total.toFixed(total % 1 === 0 && unit === 'und' ? 0 : 2)} ${unit}`, x, y);
    });
    yPosition += boxH + 3;
  }

  // Observações
  if (pedido.observacoes) {
    doc.rect(10, yPosition, pageWidth - 20, 7);
    doc.setFillColor(240, 240, 240); doc.rect(10, yPosition, pageWidth - 20, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Observações', 15, yPosition + 5);
    yPosition += 7;

    const splitObs = doc.splitTextToSize(pedido.observacoes, pageWidth - 30);
    const obsH = Math.max(12, splitObs.length * 4);
    doc.rect(10, yPosition, pageWidth - 20, obsH);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text(splitObs, 15, yPosition + 4);
    yPosition += obsH + 3;
  }

  // Resumo Financeiro
  const subtotal = (pedido.subtotal_produtos || 0) + (pedido.subtotal_servicos || 0);
  const discountTotal = (pedido.desconto_valor || 0) + (subtotal * ((pedido.desconto_percentual || 0) / 100));
  const finalTotal = Math.max(0, subtotal + (pedido.tipo_entrega === 'frete' ? (pedido.valor_frete || 0) : 0) - discountTotal);

  const summaryRows = [
    ['Subtotal Produtos', formatCurrency(pedido.subtotal_produtos || 0)],
    ['Subtotal Serviços', formatCurrency(pedido.subtotal_servicos || 0)]
  ];

  if (pedido.desconto_valor > 0 || pedido.desconto_percentual > 0) {
    const discLabel = pedido.desconto_percentual > 0 ? `Desconto (${pedido.desconto_percentual}%)` : 'Desconto';
    summaryRows.push([discLabel, `-${formatCurrency(discountTotal)}`]);
  }

  if (pedido.tipo_entrega) {
    summaryRows.push([pedido.tipo_entrega === 'frete' ? 'Entrega (Frete)' : 'Retirada', formatCurrency(pedido.valor_frete || 0)]);
    if (pedido.transportadora) summaryRows.push(['Transportadora', pedido.transportadora]);
    if (pedido.tracking_code) summaryRows.push(['Rastreio', pedido.tracking_code]);
  }
  summaryRows.push(['Total Final', formatCurrency(finalTotal)]);

  autoTable(doc, {
    startY: yPosition,
    body: summaryRows,
    theme: 'grid',
    bodyStyles: { fontSize: 8, textColor: 0, lineColor: 0, lineWidth: 0.5, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 40, halign: 'left', fontStyle: 'bold' }, 1: { cellWidth: 40, halign: 'right' } },
    margin: { left: pageWidth - 90 },
    tableWidth: 80,
  });

  return doc;
};

export const generateOrderPDF = async (
  pedido: Pedido,
  action: 'save' | 'print' = 'save',
  tiposProducao?: TipoProducao[],
  companyInfo?: CompanyInfoForPDF
) => {
  const doc = await generateOrderPDFDocument(pedido, tiposProducao, companyInfo);

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
    const clientName = pedido.clientes?.nome?.replace(/[^a-zA-Z0-9]/g, '_') || 'Cliente_Desconhecido';
    doc.save(`PEDIDO_${pedido.order_number}_${clientName}.pdf`);
  }
};

export const generateOrderPDFBase64 = async (
  pedido: Pedido,
  tiposProducao?: TipoProducao[],
  companyInfo?: CompanyInfoForPDF
): Promise<string> => {
  const doc = await generateOrderPDFDocument(pedido, tiposProducao, companyInfo);
  // Ensure we get clean Base64
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
};