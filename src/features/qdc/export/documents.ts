import type { Project } from '../types.ts';
import { PRELIMINARY_NOTICE } from '../types.ts';
import { materialList } from '../circuits/analysis.ts';
import { boardSize, isRailMounted } from '../wiring/routing.ts';

function filename(name: string) { return name.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 90) || 'quadro'; }
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function exportProject(project: Project) {
  downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), `${filename(project.name)}.qdc.json`);
}
export function exportMaterials(project: Project) {
  const escape = (v: unknown) => `"${String(v).replace(/^[=+@-]/, "'").replaceAll('"', '""')}"`;
  const rows = [['Material', 'Especificação', 'Quantidade', 'Unidade'], ...materialList(project).map(m => [m.name, m.specification, m.quantity, m.unit])];
  downloadBlob(new Blob(['\ufeff' + rows.map(r => r.map(escape).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${filename(project.name)}-materiais.csv`);
}

export async function boardImage(project: Project, includeNotice = false): Promise<string> {
  const original = document.querySelector<SVGSVGElement>('[data-qdc-export]');
  if (!original) throw new Error('Abra o desenho para exportá-lo.');
  const svg = original.cloneNode(true) as SVGSVGElement;
  const { width, height } = boardSize(project);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height));
  svg.style.cssText = 'background:#eef0ee;font-family:Arial,sans-serif';
  svg.querySelector('[data-qdc-viewport]')?.removeAttribute('transform');
  svg.querySelectorAll('[data-qdc-editor-only]').forEach(el => el.remove());
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Não foi possível renderizar o desenho.')); img.src = url; });
    const scale = Math.min(2, 4096 / Math.max(width, height));
    const noticeHeight = includeNotice ? 52 : 0;
    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil((height + noticeHeight) * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('O navegador não suporta exportação de imagem.');
    context.fillStyle = '#eef0ee'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, width * scale, height * scale);
    if (includeNotice) {
      const top = height * scale;
      context.fillStyle = '#fff8e6'; context.fillRect(0, top, canvas.width, noticeHeight * scale);
      context.fillStyle = '#d6b85c'; context.fillRect(0, top, canvas.width, scale);
      context.fillStyle = '#594a1f'; context.font = `600 ${Math.max(11, 11 * scale)}px Arial, sans-serif`;
      const words = PRELIMINARY_NOTICE.split(' '), lines: string[] = [];
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (context.measureText(candidate).width > canvas.width - 28 * scale && line) { lines.push(line); line = word; }
        else line = candidate;
      }
      if (line) lines.push(line);
      lines.slice(0, 3).forEach((text, index) => context.fillText(text, 14 * scale, top + (18 + index * 14) * scale));
    }
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

function loadImage(source: string) {
  const image = new Image();
  return new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível montar a apresentação.'));
    image.src = source;
  });
}

function card(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string) {
  context.beginPath(); context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill; context.fill();
  if (stroke) { context.strokeStyle = stroke; context.lineWidth = 1; context.stroke(); }
}

function fitText(context: CanvasRenderingContext2D, value: string, width: number) {
  if (context.measureText(value).width <= width) return value;
  let text = value;
  while (text.length > 1 && context.measureText(`${text}…`).width > width) text = text.slice(0, -1);
  return `${text.trimEnd()}…`;
}

function wrapText(context: CanvasRenderingContext2D, value: string, width: number, maxLines: number) {
  const lines: string[] = []; let line = '';
  for (const word of value.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > width) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const visible = lines.slice(0, maxLines);
    visible[maxLines - 1] = fitText(context, `${visible[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`, width);
    return visible;
  }
  return lines;
}

/** Client-facing board sheet with the active visualization, project summary and circuit legend. */
export async function presentationImage(project: Project): Promise<string> {
  const board = await loadImage(await boardImage(project));
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1131;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('O navegador não suporta exportação de imagem.');

  const navy = '#17384f', ink = '#243d4d', muted = '#657b89', accent = '#e5b947';
  context.fillStyle = '#edf2f4'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = navy; context.fillRect(0, 0, canvas.width, 188);
  context.fillStyle = accent; context.fillRect(0, 0, 14, 188);
  card(context, 64, 48, 84, 84, 18, '#ffffff10', '#ffffff30');
  context.strokeStyle = '#efc45b'; context.lineWidth = 4; context.strokeRect(88, 70, 36, 36);
  context.beginPath(); context.moveTo(95, 88); context.lineTo(117, 88); context.moveTo(106, 77); context.lineTo(106, 99); context.stroke();
  context.fillStyle = '#d9e5ec'; context.font = '700 17px Arial, sans-serif'; context.fillText('ELETRICAWEB · APRESENTAÇÃO DO QUADRO', 180, 58);
  context.fillStyle = '#fff'; context.font = '700 36px Arial, sans-serif'; context.fillText(fitText(context, project.name, 1020), 180, 105);
  context.fillStyle = '#bfd0da'; context.font = '400 18px Arial, sans-serif';
  context.fillText(fitText(context, project.client ? `Cliente: ${project.client}` : 'Cliente não informado', 780), 180, 138);

  const supply = project.supply === 'mono' ? 'Monofásico' : project.supply === 'bi' ? 'Bifásico' : 'Trifásico';
  const chips = [`${supply} · ${project.voltage} V`, `${project.rails} trilhos DIN`, `${project.modulesPerRail * project.rails} módulos`];
  let chipX = 1546;
  context.font = '700 14px Arial, sans-serif';
  for (const label of chips.reverse()) {
    const width = context.measureText(label).width + 28; chipX -= width;
    card(context, chipX, 124, width, 34, 17, '#ffffff12', '#ffffff30');
    context.fillStyle = '#f3f7f9'; context.fillText(label, chipX + 14, 146); chipX -= 10;
  }

  card(context, 54, 220, 1042, 810, 20, '#fff', '#d4dfe4');
  context.save(); context.shadowColor = '#17384f22'; context.shadowBlur = 26; context.shadowOffsetY = 8;
  card(context, 80, 246, 990, 744, 14, '#e4ebed'); context.restore();
  const imageScale = Math.min(930 / board.width, 690 / board.height);
  const imageWidth = board.width * imageScale, imageHeight = board.height * imageScale;
  context.drawImage(board, 80 + (990 - imageWidth) / 2, 246 + (744 - imageHeight) / 2, imageWidth, imageHeight);

  card(context, 1124, 220, 422, 810, 20, '#fff', '#d4dfe4');
  context.fillStyle = muted; context.font = '700 14px Arial, sans-serif'; context.fillText('RESUMO DA MONTAGEM', 1160, 266);
  context.fillStyle = ink; context.font = '700 25px Arial, sans-serif'; context.fillText('Dados do quadro', 1160, 303);
  const used = project.devices.filter(isRailMounted).reduce((total, device) => total + device.modules, 0);
  const summary = [
    ['Dimensões', `${project.widthMm} × ${project.heightMm} mm`],
    ['Ocupação', `${used} de ${project.modulesPerRail * project.rails} módulos`],
    ['Componentes', String(project.devices.length)],
    ['Condutores', String(project.wires.length)],
  ];
  let rowY = 340;
  for (const [label, value] of summary) {
    context.fillStyle = muted; context.font = '400 15px Arial, sans-serif'; context.fillText(label, 1160, rowY);
    context.fillStyle = ink; context.font = '700 16px Arial, sans-serif'; context.textAlign = 'right'; context.fillText(value, 1508, rowY); context.textAlign = 'left';
    context.strokeStyle = '#e5ecef'; context.beginPath(); context.moveTo(1160, rowY + 18); context.lineTo(1508, rowY + 18); context.stroke(); rowY += 52;
  }

  context.fillStyle = muted; context.font = '700 14px Arial, sans-serif'; context.fillText('CIRCUITOS', 1160, 566);
  const shownCircuits = project.circuits.slice(0, 7);
  shownCircuits.forEach((circuit, index) => {
    const y = 602 + index * 48;
    card(context, 1160, y - 23, 44, 30, 8, circuit.color || accent);
    context.fillStyle = '#172f3e'; context.font = '800 13px Arial, sans-serif'; context.textAlign = 'center'; context.fillText(`C${circuit.number}`, 1182, y - 3); context.textAlign = 'left';
    context.fillStyle = ink; context.font = '700 15px Arial, sans-serif'; context.fillText(fitText(context, circuit.name || 'Circuito sem nome', 208), 1220, y - 4);
    context.fillStyle = muted; context.font = '400 12px Arial, sans-serif'; context.textAlign = 'right'; context.fillText(`${circuit.phase} · ${circuit.voltage} V`, 1508, y - 4); context.textAlign = 'left';
  });
  if (project.circuits.length > shownCircuits.length) {
    context.fillStyle = muted; context.font = '600 13px Arial, sans-serif'; context.fillText(`+ ${project.circuits.length - shownCircuits.length} circuitos no relatório completo`, 1160, 950);
  }

  context.fillStyle = '#f7fafb'; context.fillRect(0, 1060, canvas.width, 71);
  context.strokeStyle = '#d5e0e5'; context.beginPath(); context.moveTo(54, 1060); context.lineTo(1546, 1060); context.stroke();
  context.fillStyle = '#667b88'; context.font = '400 12px Arial, sans-serif';
  wrapText(context, PRELIMINARY_NOTICE, 1240, 2).forEach((line, index) => context.fillText(line, 54, 1084 + index * 16));
  context.textAlign = 'right'; context.fillStyle = '#8a9ba5'; context.fillText('REPRESENTAÇÃO VISUAL · SEM ESCALA', 1546, 1101); context.textAlign = 'left';
  return canvas.toDataURL('image/png');
}

export async function exportPresentationPNG(project: Project) {
  const url = await presentationImage(project);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${filename(project.name)}-apresentacao.png`; anchor.click();
}

export async function exportPNG(project: Project) {
  const url = await boardImage(project, true);
  const a = document.createElement('a'); a.href = url; a.download = `${filename(project.name)}.png`; a.click();
}
export async function exportPDF(project: Project, labelsOnly = false) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: labelsOnly ? 'portrait' : 'landscape', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text('ELETRICAWEB / MONTADOR DE QDC', 14, 18);
  doc.setFontSize(12); doc.text(project.name.slice(0, 90), 14, 27);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  if (labelsOnly) {
    doc.text('Etiquetas de identificação · imprimir em tamanho real (100%)', 14, 34);
    let x = 14, y = 44;
    for (const circuit of project.circuits) {
      if (y + 22 > h - 15) { doc.addPage(); y = 15; }
      doc.setDrawColor(150); doc.roundedRect(x, y, 58, 22, 1, 1);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(`C${circuit.number}`, x + 4, y + 8);
      doc.setFontSize(8); doc.text(doc.splitTextToSize(circuit.name.toUpperCase(), 50).slice(0, 2), x + 4, y + 14);
      x += 62; if (x + 58 > w - 14) { x = 14; y += 26; }
    }
  } else {
    const presentation = await presentationImage(project);
    doc.addImage(presentation, 'PNG', 0, 0, w, h);
    doc.addPage(); doc.setFontSize(14); doc.text('Circuitos e materiais · proposta visual', 14, 18);
    autoTable(doc, { startY: 24, head: [['Circuito', 'Nome', 'Fases', 'Disjuntor', 'Cabo', 'Carga informada']], body: project.circuits.map(c => {
      const d = project.devices.find(d => d.id === c.breakerId);
      return [`C${c.number}`, c.name, c.phase, d?.amperage ? `${d.amperage} A / ${d.poles}P` : 'A definir', c.cableGauge ? `${c.cableGauge} mm²` : 'A definir', c.load !== null ? `${c.load} ${c.loadUnit}` : 'Não informada'];
    }), styles: { fontSize: 8 }, headStyles: { fillColor: [27, 41, 47] } });
    doc.addPage(); doc.setFontSize(14); doc.text('Lista de materiais', 14, 18);
    autoTable(doc, { startY: 24, head: [['Material', 'Especificação', 'Quantidade', 'Unidade']], body: materialList(project).map(m => [m.name, m.specification, m.quantity, m.unit]), styles: { fontSize: 8 }, headStyles: { fillColor: [27, 41, 47] } });
  }
  doc.save(`${filename(project.name)}${labelsOnly ? '-etiquetas' : ''}.pdf`);
}
