import { materiaisQuadro, type Quadro } from './quadros';

export async function exportarQuadroPdf(q: Quadro) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const pdf = new jsPDF();
  pdf.setFontSize(18);
  pdf.text('Montagem de quadro', 14, 18);
  pdf.setFontSize(11);
  pdf.text(pdf.splitTextToSize(q.nome, 180), 14, 27);
  pdf.text(pdf.splitTextToSize(`Cliente / obra: ${q.cliente || 'Não informado'}`, 180), 14, 43);
  pdf.setFontSize(9);
  pdf.text('Disposição física ilustrativa. Não representa ligações ou dimensionamento elétrico.', 14, 59);
  pdf.text('Larguras informadas pelo usuário; conferir componentes e quadro com o fabricante.', 14, 65);
  pdf.text(`Barramentos externos aos trilhos: ${[q.barramentoN && 'N', q.barramentoPE && 'PE'].filter(Boolean).join(' / ') || 'não indicados'}`, 14, 71);
  let y = 78;
  const larguraModulo = 180 / q.modulosPorTrilho;
  for (let trilho = 0; trilho < q.trilhos; trilho++) {
    if (y + 40 > 280) { pdf.addPage(); y = 20; }
    pdf.setFontSize(9);
    pdf.setTextColor(30);
    pdf.text(`Trilho ${trilho + 1}`, 14, y);
    for (let slot = 0; slot < q.modulosPorTrilho; slot++) {
      pdf.setDrawColor(205);
      pdf.rect(14 + slot * larguraModulo, y + 4, larguraModulo, 24);
    }
    q.componentes.filter(c => c.trilho === trilho).forEach(c => {
      const x = 14 + c.inicio * larguraModulo;
      const w = c.modulos * larguraModulo;
      pdf.setFillColor(225, 233, 236);
      pdf.setDrawColor(35, 55, 65);
      pdf.rect(x, y + 4, w, 24, 'FD');
      pdf.setFontSize(Math.min(9, w < 12 ? 6 : 8));
      pdf.text(String(q.componentes.indexOf(c) + 1).padStart(2, '0'), x + w / 2, y + 18, { align: 'center' });
    });
    y += 38;
  }
  pdf.addPage();
  pdf.setFontSize(15);
  pdf.text('Identificação dos componentes', 14, 18);
  autoTable(pdf, {
    startY: 25, head: [['Ref.', 'Componente / especificação', 'Circuito', 'Trilho / posição', 'Mód.']],
    body: q.componentes.map((c, i) => [String(i + 1).padStart(2, '0'), `${c.tipo}\n${c.descricao}`, c.circuito || '—', `${c.trilho + 1} / ${c.inicio + 1}`, c.modulos]),
    styles: { fontSize: 9 }, headStyles: { fillColor: [19, 35, 45] },
  });
  pdf.addPage();
  pdf.text('Lista de materiais', 14, 18);
  autoTable(pdf, {
    startY: 25, head: [['Material', 'Especificação', 'Mód. por peça', 'Quantidade']],
    body: [
      ['Quadro', `${q.trilhos} trilhos × ${q.modulosPorTrilho} módulos`, '—', 1],
      ...(q.barramentoN ? [['Barramento N', 'Capacidade e fixação a definir', '—', 1]] : []),
      ...(q.barramentoPE ? [['Barramento PE', 'Capacidade e fixação a definir', '—', 1]] : []),
      ...materiaisQuadro(q).map(c => [c.tipo, c.descricao || 'A definir', c.modulos, c.quantidade]),
    ], styles: { fontSize: 9 }, headStyles: { fillColor: [19, 35, 45] },
  });
  pdf.save(`${q.nome.replace(/[^\p{L}\p{N}_-]/gu, '_') || 'quadro'}.pdf`);
}
