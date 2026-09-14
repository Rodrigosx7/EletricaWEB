import type { Project } from '../types.ts';
import { PRELIMINARY_NOTICE } from '../types.ts';
import { materialList } from '../circuits/analysis.ts';
import { boardSize } from '../wiring/routing.ts';

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

export async function boardImage(project: Project): Promise<string> {
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
    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('O navegador não suporta exportação de imagem.');
    context.fillStyle = '#eef0ee'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}
export async function exportPNG(project: Project) {
  const url = await boardImage(project);
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
    const image = await boardImage(project), size = boardSize(project);
    const scale = Math.min((w - 28) / size.width, (h - 69) / size.height);
    doc.addImage(image, 'PNG', (w - size.width * scale) / 2, 34, size.width * scale, size.height * scale);
    doc.setFontSize(7); doc.text(doc.splitTextToSize(PRELIMINARY_NOTICE, w - 28), 14, h - 18);
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
