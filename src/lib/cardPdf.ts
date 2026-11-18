// PDF da carteirinha de filiado (frente e verso), usado no painel e no app.
//   cr80 -> 2 páginas no tamanho do cartão (85,6 × 54 mm), para gráfica
//   a4   -> frente e verso lado a lado numa folha A4, com marcas de corte
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { formatDateBR, verifyUrl } from "./members";

export { verifyUrl };

export type CardPdfFormat = "cr80" | "a4";

export interface CardData {
  full_name: string;
  member_number: number;
  membership_expires_at: string;
  cr_number: string | null;
  cr_expires_at: string | null;
  verify_token: string;
}

export interface ClubData {
  club_name: string;
  club_cr: string;
  address: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  email: string | null;
  legal_text: string | null;
}

const W = 85.6;
const H = 54;
const GOLD: [number, number, number] = [201, 165, 75];
const WHITE: [number, number, number] = [255, 255, 255];
const MUTED: [number, number, number] = [170, 170, 170];

async function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function imageUrlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Imagem indisponível (${res.status})`);
  return toDataUrl(await res.blob());
}

/** Recorta a foto no centro em 3×4 e reduz para 600×800 (JPEG) */
export async function photoTo3x4(src: string): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Não foi possível carregar a foto"));
    img.src = src;
  });
  const targetRatio = 3 / 4;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (sw / sh > targetRatio) sw = sh * targetRatio;
  else sh = sw / targetRatio;
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 800;
  canvas.getContext("2d")!.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, 600, 800);
  return canvas.toDataURL("image/jpeg", 0.88);
}

/** Fundo preto e filete dourado. bleed = preto até a borda da página (CR80) */
function frame(doc: jsPDF, x: number, y: number, bleed: boolean) {
  doc.setFillColor(0, 0, 0);
  if (bleed) doc.rect(x, y, W, H, "F");
  else doc.roundedRect(x, y, W, H, 3, 3, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.roundedRect(x + 1.4, y + 1.4, W - 2.8, H - 2.8, 2.2, 2.2, "S");
}

function label(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.6);
  doc.setTextColor(...GOLD);
  doc.text(text.toUpperCase(), x, y);
}

function value(doc: jsPDF, text: string, x: number, y: number, size = 7.2) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size);
  doc.setTextColor(...WHITE);
  doc.text(text, x, y);
}

function drawFront(doc: jsPDF, x: number, y: number, card: CardData, club: ClubData, brasao: string, photo: string | null, bleed: boolean) {
  frame(doc, x, y, bleed);

  doc.addImage(brasao, "JPEG", x + 4, y + 3.6, 13, 13, "brasao");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.4);
  doc.setTextColor(...GOLD);
  doc.text("CARTEIRA DE FILIADO", x + 19.5, y + 9.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...WHITE);
  doc.text(club.club_name, x + 19.5, y + 13.2);

  // Foto 3×4
  const px = x + 4.5;
  const py = y + 19;
  if (photo) {
    doc.addImage(photo, "JPEG", px, py, 20.25, 27);
  } else {
    doc.setFillColor(38, 38, 38);
    doc.rect(px, py, 20.25, 27, "F");
    doc.setFontSize(4.6);
    doc.setTextColor(...MUTED);
    doc.text("SEM FOTO", px + 10.1, py + 14, { align: "center" });
  }
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.rect(px, py, 20.25, 27, "S");

  const tx = x + 28.5;
  const col2 = x + 57;
  label(doc, "Nome", tx, y + 21.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.setTextColor(...WHITE);
  const nameLines = doc.splitTextToSize(card.full_name.toUpperCase(), W - 28.5 - 4.5).slice(0, 2);
  doc.text(nameLines, tx, y + 24.6);

  const row1 = y + (nameLines.length > 1 ? 33.5 : 31);
  label(doc, "Nº de filiação", tx, row1);
  value(doc, String(card.member_number), tx, row1 + 3.4);
  label(doc, "Vencimento", col2, row1);
  value(doc, formatDateBR(card.membership_expires_at), col2, row1 + 3.4);

  const row2 = row1 + 8.6;
  label(doc, "Nº do CR", tx, row2);
  value(doc, card.cr_number || "—", tx, row2 + 3.4);
  label(doc, "Validade do CR", col2, row2);
  value(doc, card.cr_expires_at ? formatDateBR(card.cr_expires_at) : "—", col2, row2 + 3.4);
}

function drawBack(doc: jsPDF, x: number, y: number, club: ClubData, qr: string, bleed: boolean) {
  frame(doc, x, y, bleed);

  // QR com fundo branco (leitura confiável em qualquer câmera)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x + 4.5, y + 6, 25, 25, 1, 1, "F");
  doc.addImage(qr, "PNG", x + 5.5, y + 7, 23, 23, "qr", "FAST");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.6);
  doc.setTextColor(...GOLD);
  doc.text("Aponte a câmera para", x + 17, y + 35, { align: "center" });
  doc.text("conferir os dados", x + 17, y + 37.4, { align: "center" });

  const tx = x + 33;
  const width = W - 33 - 4.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.6);
  doc.setTextColor(...GOLD);
  doc.text(club.club_name.toUpperCase(), tx, y + 8.5);

  let cursor = y + 12;
  if (club.legal_text) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.8);
    doc.setTextColor(...WHITE);
    const lines = doc.splitTextToSize(club.legal_text, width).slice(0, 7);
    doc.text(lines, tx, cursor);
    cursor += lines.length * 2.1 + 1.6;
  }

  const contacts = [club.address, club.whatsapp && `WhatsApp ${club.whatsapp}`, club.instagram, club.website, club.email].filter(
    Boolean,
  ) as string[];
  doc.setFontSize(4.6);
  doc.setTextColor(...MUTED);
  for (const line of contacts) {
    if (cursor > y + H - 7) break;
    const wrapped = doc.splitTextToSize(line, width).slice(0, 2);
    doc.text(wrapped, tx, cursor);
    cursor += wrapped.length * 2.1;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.2);
  doc.setTextColor(...GOLD);
  doc.text(`CR DO CLUBE: ${club.club_cr}`, x + 4.5, y + H - 4.5);
}

function cropMarks(doc: jsPDF, x: number, y: number) {
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.15);
  const m = 2;
  const l = 4;
  for (const [cx, cy] of [[x, y], [x + W, y], [x, y + H], [x + W, y + H]]) {
    const dx = cx === x ? -1 : 1;
    const dy = cy === y ? -1 : 1;
    doc.line(cx + dx * m, cy, cx + dx * (m + l), cy);
    doc.line(cx, cy + dy * m, cx, cy + dy * (m + l));
  }
}

/**
 * Monta o PDF. `brasao` (JPEG) e `photo` (JPEG) são data URLs (use imageUrlToDataUrl e
 * photoTo3x4). A foto é opcional: sem ela o cartão sai com "SEM FOTO".
 */
export async function buildCardPdf(
  card: CardData,
  club: ClubData,
  images: { brasao: string; photo: string | null },
  format: CardPdfFormat,
): Promise<jsPDF> {
  const qr = await QRCode.toDataURL(verifyUrl(card.verify_token), {
    errorCorrectionLevel: "M",
    margin: 0,
    width: 320,
    color: { dark: "#000000", light: "#ffffff" },
  });

  if (format === "cr80") {
    const doc = new jsPDF({ unit: "mm", format: [W, H], orientation: "landscape" });
    drawFront(doc, 0, 0, card, club, images.brasao, images.photo, true);
    doc.addPage([W, H], "landscape");
    drawBack(doc, 0, 0, club, qr, true);
    doc.setProperties({ title: `Carteira de filiado nº ${card.member_number}` });
    return doc;
  }

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Carteira de filiado · ${club.club_name}`, 105, 18, { align: "center" });
  doc.setFontSize(7.5);
  doc.text(
    "Imprima em 100% (sem ajustar à página). Recorte nas marcas e cole frente e verso, ou leve à gráfica.",
    105,
    23,
    { align: "center" },
  );
  const left = (210 - W) / 2;
  drawFront(doc, left, 34, card, club, images.brasao, images.photo, false);
  cropMarks(doc, left, 34);
  drawBack(doc, left, 34 + H + 14, club, qr, false);
  cropMarks(doc, left, 34 + H + 14);
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text("FRENTE", left, 32);
  doc.text("VERSO", left, 34 + H + 12);
  doc.setProperties({ title: `Carteira de filiado nº ${card.member_number}` });
  return doc;
}

export const cardPdfFileName = (memberNumber: number, format: CardPdfFormat) =>
  `carteira-filiado-${memberNumber}${format === "a4" ? "-a4" : ""}.pdf`;
