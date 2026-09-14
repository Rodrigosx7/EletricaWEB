import { numeroBornes, type BorneQuadro, type FioQuadro, type Quadro } from './quadros';

export const PASSO_MODULO = 52;
export const PASSO_TRILHO = 240;
export function tamanhoDesenho(q: Quadro) { return { largura: q.modulosPorTrilho * PASSO_MODULO + 160, altura: q.trilhos * PASSO_TRILHO + 100 }; }
export function pontoBorne(q: Quadro, b: BorneQuadro): [number, number] {
  if (b.componente.startsWith('@')) return [65 + b.numero * 24, b.componente === '@N' ? 25 : tamanhoDesenho(q).altura - 25];
  const c = q.componentes.find(c => c.id === b.componente)!;
  return [40 + c.inicio * PASSO_MODULO + (b.numero + .5) * c.modulos * PASSO_MODULO / numeroBornes(c), 70 + c.trilho * PASSO_TRILHO + (b.lado === 'superior' ? 0 : 140)];
}
export function pontosFio(q: Quadro, f: FioQuadro, indice: number): [number, number][] {
  const a = pontoBorne(q, f.origem), b = pontoBorne(q, f.destino);
  const saida = (p: [number, number], borne: BorneQuadro): number => p[1] + (borne.componente === '@N' || borne.lado === 'inferior' ? 18 : -18);
  const corredor = 40 + q.modulosPorTrilho * PASSO_MODULO + 15 + (indice % 8) * 9;
  return [a, [a[0], saida(a, f.origem)], [corredor, saida(a, f.origem)], [corredor, saida(b, f.destino)], [b[0], saida(b, f.destino)], b];
}
