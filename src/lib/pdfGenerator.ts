import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ServiceOrder } from '@/types/database';
import { formatCurrency, formatDate, formatCPF, productLabels, typeLabels, authorityLabels, statusLabels } from './formatters';

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

export const generateServiceOrderPDF = async (order: ServiceOrder) => {
  const doc = new jsPDF();
  
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

  // ===== CABEÇALHO COM LOGO =====
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  try {
    // Carregar e adicionar logo
    const logoImg = await loadImage(LOGO_URL);
    const logoHeight = 30;
    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
    doc.addImage(logoImg, 'PNG', margin, 10, logoWidth, logoHeight);
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
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 50, yPosition);
    yPosition += 7;
  });

  yPosition += 5;

  // ===== DADOS DO CLIENTE =====
  doc.setFillColor(...primaryColor);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO CLIENTE', margin + 3, yPosition + 5.5);
  
  yPosition += 13;
  doc.setTextColor(...darkColor);
  doc.setFontSize(10);

  const clientData = [
    ['Nome Completo:', order.customer_full_name],
    ['CPF:', formatCPF(order.customer_cpf)],
  ];

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

  clientData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, yPosition);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value, pageWidth - margin - 60);
    doc.text(lines, margin + 35, yPosition);
    yPosition += 7 * lines.length;
  });

  yPosition += 5;

  // ===== DADOS DO EQUIPAMENTO =====
  doc.setFillColor(...primaryColor);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO EQUIPAMENTO', margin + 3, yPosition + 5.5);
  
  yPosition += 13;
  doc.setTextColor(...darkColor);
  doc.setFontSize(10);

  const equipmentData = [
    ['Produto:', productLabels[order.product]],
    ['Tipo:', typeLabels[order.type]],
    ['Número de Série:', order.serial_number],
  ];

  if (order.authority) {
    equipmentData.push(['Autoridade Competente:', authorityLabels[order.authority]]);
  }

  equipmentData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 50, yPosition);
    yPosition += 7;
  });

  yPosition += 5;

  // ===== DADOS DO SERVIÇO =====
  doc.setFillColor(...primaryColor);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO SERVIÇO', margin + 3, yPosition + 5.5);
  
  yPosition += 13;
  doc.setTextColor(...darkColor);
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
    doc.setFillColor(...primaryColor);
    doc.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES', margin + 3, yPosition + 5.5);
    
    yPosition += 13;
    doc.setTextColor(...darkColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const notesLines = doc.splitTextToSize(order.notes, pageWidth - 2 * margin - 10);
    doc.text(notesLines, margin + 5, yPosition);
    yPosition += 7 * notesLines.length;
  }

  // ===== RODAPÉ COM INFORMAÇÕES DA EMPRESA =====
  const footerY = pageHeight - 35;
  
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
    '09h00 às 18h00 → Secretaria do Clube e Loja',
    pageWidth / 2,
    footerY + 10,
    { align: 'center' }
  );
  doc.text(
    '18h00 às 21h00 → Estande de Tiro Real (exclusivamente neste horário)',
    pageWidth / 2,
    footerY + 14,
    { align: 'center' }
  );
  
  // Data de geração
  doc.setFontSize(7);
  doc.setTextColor(...grayColor);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Documento gerado em ${formatDate(new Date().toISOString())}`,
    pageWidth / 2,
    footerY + 20,
    { align: 'center' }
  );

  // ===== SALVAR PDF =====
  doc.save(`OS_${order.os_number}.pdf`);
};

