import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ServiceOrder, ServiceOrderItem } from '@/types/database';
import { formatCurrency, formatDate, formatCPF, formatPhone, formatZipCode, productLabels, typeLabels, authorityLabels, statusLabels } from './formatters';
import { supabase } from '@/integrations/supabase/client';

// Produto, tipo e autoridade são administráveis pelo usuário, então os
// rótulos vêm do banco. Os mapas estáticos ficam como fallback, para o
// PDF não sair com o código cru se a consulta falhar.
const loadOptionLabels = async (): Promise<Record<string, string>> => {
  const labels: Record<string, string> = {
    ...productLabels,
    ...typeLabels,
    ...authorityLabels,
  };

  try {
    const { data } = await supabase.from('option_lists').select('value, label');
    (data ?? []).forEach((option) => {
      labels[option.value] = option.label;
    });
  } catch {
    // Mantém apenas o fallback
  }

  return labels;
};

// URL da logo da empresa
const LOGO_URL = 'https://utwujmzfwpyixczstdjw.supabase.co/storage/v1/object/sign/logo/CAPA%20REDES%20SOCIAIS.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV81NmRkNTQxYi00NDkyLTRjYTUtOTg2ZC01ZDc3NjI5ODU5MTciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJsb2dvL0NBUEEgUkVERVMgU09DSUFJUy5wbmciLCJpYXQiOjE3NTkzNDkwNDcsImV4cCI6MTkxNzAyOTA0N30.HuUX3EU4YERLcy-vzGdmkckhMY6gXJU17v0UC3ffz0Y';

// Função auxiliar para carregar imagem
const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

// A logo tem 1968×1968 e é impressa num quadrado de 30mm. O jsPDF embute
// o bitmap cru (1968² × 4 bytes ≈ 15MB), então o arquivo inteiro da OS
// era praticamente a logo. Em 300px o mesmo quadrado de 30mm sai a
// 254 DPI, que a impressora não distingue do original.
const LOGO_MAX_PX = 300;

/** Reduz a imagem mantendo a proporção. Não amplia. */
const resizeImage = (img: HTMLImageElement, maxPx: number): HTMLCanvasElement => {
  const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  return canvas;
};

// A logo é a mesma em toda OS, mas era baixada de novo (8,5MB) a cada
// PDF. Guardar a versão já reduzida deixa a segunda geração instantânea.
let logoCache: HTMLCanvasElement | null = null;

const loadLogo = async (): Promise<HTMLCanvasElement> => {
  if (!logoCache) {
    logoCache = resizeImage(await loadImage(LOGO_URL), LOGO_MAX_PX);
  }
  return logoCache;
};

export const generateServiceOrderPDF = async (
  order: ServiceOrder,
  items: ServiceOrderItem[] = []
) => {
  const doc = new jsPDF();
  const optionLabels = await loadOptionLabels();
  const labelOf = (value?: string | null) => (value ? optionLabels[value] ?? value : '');

  // Configurações
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Cores - Opção 4: Tons Terrosos
  const primaryColor: [number, number, number] = [107, 91, 76]; // Marrom acinzentado
  const accentColor: [number, number, number] = [140, 122, 107]; // Taupe
  const secondaryColor: [number, number, number] = [168, 152, 136]; // Bege
  const darkColor: [number, number, number] = [30, 30, 30];
  const grayColor: [number, number, number] = [100, 100, 100];

  // Faixa reservada ao rodapé. Nada de conteúdo pode entrar aqui: antes
  // o texto era escrito direto até o fim da folha e o rodapé saía por
  // cima quando a OS tinha itens e observações.
  const contentBottom = pageHeight - 45;

  /** Abre uma página nova quando o próximo bloco não cabe mais. */
  const ensureSpace = (needed: number) => {
    if (yPosition + needed > contentBottom) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  /** Cabeçalho de seção (a faixa marrom com o título). */
  const sectionHeader = (title: string) => {
    // 8 da faixa + 13 até a primeira linha + uma linha de conteúdo
    ensureSpace(28);
    doc.setFillColor(...primaryColor);
    doc.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 3, yPosition + 5.5);
    yPosition += 13;
    doc.setTextColor(...darkColor);
    doc.setFontSize(10);
  };

  // ===== CABEÇALHO COM LOGO =====
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 50, 'F');

  try {
    // Carregar e adicionar logo
    const logo = await loadLogo();
    const logoHeight = 30;
    const logoWidth = (logo.width / logo.height) * logoHeight;
    doc.addImage(logo, 'PNG', margin, 10, logoWidth, logoHeight);
  } catch (error) {
    console.error('Erro ao carregar logo:', error);
  }

  // Título ao lado da logo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEM DE SERVIÇO', pageWidth - margin, 22, { align: 'right' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(order.os_number, pageWidth - margin, 34, { align: 'right' });

  yPosition = 60;

  // ===== INFORMAÇÕES GERAIS =====
  doc.setTextColor(...darkColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const generalInfo = [
    ['Data de Entrada:', formatDate(order.entry_date)],
    ['Status:', statusLabels[order.status]],
    ['Última Atualização:', formatDate(order.updated_at)],
  ];

  if (order.repair_date) {
    generalInfo.push(['Data de Conserto:', formatDate(order.repair_date)]);
  }
  if (order.delivery_date) {
    generalInfo.push(['Data de Entrega:', formatDate(order.delivery_date)]);
  }
  if (order.warranty_until) {
    generalInfo.push(['Garantia Válida Até:', formatDate(order.warranty_until)]);
  }

  generalInfo.forEach(([label, value]) => {
    ensureSpace(7);
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 50, yPosition);
    yPosition += 7;
  });

  yPosition += 5;

  // ===== DADOS DO CLIENTE =====
  sectionHeader('DADOS DO CLIENTE');

  const clientData = [
    ['Nome Completo:', order.customer_full_name],
    ['CPF:', formatCPF(order.customer_cpf)],
  ];

  if (order.customer_phone) {
    clientData.push(['Telefone:', formatPhone(order.customer_phone)]);
  }

  // Endereço completo
  const addressParts = [];
  if (order.address_street) addressParts.push(order.address_street);
  if (order.address_number) addressParts.push(`Nº ${order.address_number}`);
  if (order.address_neighborhood) addressParts.push(order.address_neighborhood);
  if (order.address_city) addressParts.push(order.address_city);
  if (order.address_complement) addressParts.push(order.address_complement);
  
  if (addressParts.length > 0) {
    clientData.push(['Endereço:', addressParts.join(', ')]);
  }

  if (order.address_zip_code) {
    clientData.push(['CEP:', formatZipCode(order.address_zip_code)]);
  }

  clientData.forEach(([label, value]) => {
    const lines = doc.splitTextToSize(value, pageWidth - margin - 60);
    ensureSpace(7 * lines.length);
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(lines, margin + 35, yPosition);
    yPosition += 7 * lines.length;
  });

  yPosition += 5;

  // ===== DADOS DO EQUIPAMENTO =====
  sectionHeader('DADOS DO EQUIPAMENTO');

  const equipmentData = [
    ['Produto:', labelOf(order.product)],
    ['Tipo:', labelOf(order.type)],
  ];

  // Marca, modelo e calibre só aparecem quando preenchidos: as OS
  // anteriores a estes campos não teriam o que mostrar
  if (order.brand) {
    equipmentData.push(['Marca:', labelOf(order.brand)]);
  }
  if (order.model) {
    equipmentData.push(['Modelo:', order.model]);
  }
  if (order.caliber) {
    equipmentData.push(['Calibre:', labelOf(order.caliber)]);
  }

  equipmentData.push(['Número de Série:', order.serial_number]);

  if (order.authority) {
    equipmentData.push(['Autoridade Competente:', labelOf(order.authority)]);
  }

  equipmentData.forEach(([label, value]) => {
    ensureSpace(7);
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 50, yPosition);
    yPosition += 7;
  });

  yPosition += 5;

  // ===== DADOS DO SERVIÇO =====
  sectionHeader('DADOS DO SERVIÇO');

  // Detalhamento dos itens, quando a OS tiver itens lançados
  if (items.length > 0) {
    // Cabeçalho da tabela mais uma linha, para não abrir página nova
    // logo depois de escrever "Descrição / Qtd. / Unitário / Subtotal"
    ensureSpace(13);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Descrição', margin, yPosition);
    doc.text('Qtd.', pageWidth - margin - 55, yPosition, { align: 'right' });
    doc.text('Unitário', pageWidth - margin - 30, yPosition, { align: 'right' });
    doc.text('Subtotal', pageWidth - margin, yPosition, { align: 'right' });

    yPosition += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    items.forEach((item) => {
      ensureSpace(6);
      const description = doc.splitTextToSize(item.description, pageWidth - 2 * margin - 60);
      doc.text(description[0], margin, yPosition);
      doc.text(String(item.quantity), pageWidth - margin - 55, yPosition, { align: 'right' });
      doc.text(formatCurrency(item.unit_value_cents), pageWidth - margin - 30, yPosition, { align: 'right' });
      doc.text(
        formatCurrency(item.quantity * item.unit_value_cents),
        pageWidth - margin,
        yPosition,
        { align: 'right' }
      );
      yPosition += 6;
    });

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;
  }

  ensureSpace(10);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Valor do Reparo:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrency(order.repair_value_cents), margin + 50, yPosition);

  yPosition += 10;
  doc.setTextColor(...darkColor);
  doc.setFontSize(10);

  // ===== OBSERVAÇÕES =====
  if (order.notes) {
    yPosition += 5;
    sectionHeader('OBSERVAÇÕES');
    doc.setFont('helvetica', 'normal');

    const notesLines = doc.splitTextToSize(order.notes, pageWidth - 2 * margin - 10);
    // Quebra a observação linha a linha: um texto longo não pode
    // atravessar o rodapé de uma vez só
    notesLines.forEach((line: string) => {
      ensureSpace(7);
      doc.text(line, margin + 5, yPosition);
      yPosition += 7;
    });
  }

  // ===== ASSINATURAS =====
  // Duas etapas na mesma folha: quando o cliente deixa o equipamento e
  // quando volta para retirar. Assim uma via só acompanha a OS do começo
  // ao fim, em vez de depender de reimprimir na entrega.
  // Altura real do conjunto, do título do primeiro bloco até a última
  // legenda: 9 (título→linha) + 10 (linha→fim) + 10 (respiro) + 9 + 8.
  // Reservar menos que isso empurra as assinaturas para dentro do rodapé.
  const signaturesHeight = 48;

  if (!ensureSpace(signaturesHeight + 6)) {
    // Coube: encosta no rodapé em vez de ficar boiando no meio da folha
    yPosition = contentBottom - signaturesHeight;
  } else {
    yPosition += 6;
  }

  const drawSignaturePair = (
    title: string,
    clientCaption: string,
    responsibleCaption: string
  ) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(title, margin, yPosition);
    yPosition += 9;

    const lineWidth = 70;
    const gap = 10;
    const leftX = (pageWidth - (lineWidth * 2 + gap)) / 2;
    const rightX = leftX + lineWidth + gap;

    doc.setDrawColor(...darkColor);
    doc.setLineWidth(0.3);
    doc.line(leftX, yPosition, leftX + lineWidth, yPosition);
    doc.line(rightX, yPosition, rightX + lineWidth, yPosition);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkColor);
    doc.text('Assinatura do Cliente', leftX + lineWidth / 2, yPosition + 4, { align: 'center' });
    doc.text('Assinatura do Responsável', rightX + lineWidth / 2, yPosition + 4, { align: 'center' });

    doc.setFontSize(7);
    doc.setTextColor(...grayColor);
    doc.text(clientCaption, leftX + lineWidth / 2, yPosition + 8, { align: 'center' });
    doc.text(responsibleCaption, rightX + lineWidth / 2, yPosition + 8, { align: 'center' });

    yPosition += 10;
  };

  drawSignaturePair(
    'ENTRADA DO EQUIPAMENTO',
    '(entregou o equipamento)',
    '(recebeu o equipamento)'
  );

  yPosition += 10;

  drawSignaturePair(
    'RETIRADA DO EQUIPAMENTO',
    '(retirou o equipamento)',
    '(entregou o equipamento)'
  );

  // ===== RODAPÉ COM INFORMAÇÕES DA EMPRESA =====
  // Repetido em todas as páginas: quando a OS passa de uma folha, a
  // segunda também precisa identificar a empresa
  const footerY = pageHeight - 35;
  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);

    // Linha separadora
    doc.setDrawColor(...secondaryColor);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    // Informações da empresa
    doc.setFontSize(8);
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');

    // Endereço
    doc.text(
      'Rua Maravilha, 175/179 – Bairro Niterói – Divinópolis/MG',
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );

    // Contatos
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Whatsapp: (37) 9.9975-5698 | Fone: (37) 3212-0987',
      pageWidth / 2,
      footerY + 5,
      { align: 'center' }
    );

    // Horários
    doc.setFontSize(7);
    doc.setTextColor(...accentColor);
    doc.text(
      '09h00 às 18h00 – Secretaria do Clube e Loja',
      pageWidth / 2,
      footerY + 10,
      { align: 'center' }
    );
    doc.text(
      '18h00 às 21h00 – Estande de Tiro Real (exclusivamente neste horário)',
      pageWidth / 2,
      footerY + 14,
      { align: 'center' }
    );

    // Data de geração e paginação
    doc.setFontSize(7);
    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'italic');
    const generatedAt = `Documento gerado em ${formatDate(new Date().toISOString())}`;
    doc.text(
      totalPages > 1 ? `${generatedAt} · Página ${page} de ${totalPages}` : generatedAt,
      pageWidth / 2,
      footerY + 20,
      { align: 'center' }
    );
  }

  // ===== SALVAR PDF =====
  doc.save(`OS_${order.os_number}.pdf`);
};

