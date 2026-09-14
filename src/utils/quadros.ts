export type ComponenteQuadro = {
  id: string;
  tipo: string;
  descricao: string;
  circuito: string;
  modulos: number;
  trilho: number;
  inicio: number;
  bornes?: number;
};

export type Quadro = {
  id: string;
  nome: string;
  cliente: string;
  trilhos: number;
  modulosPorTrilho: number;
  componentes: ComponenteQuadro[];
  barramentoN?: boolean;
  barramentoPE?: boolean;
  fios?: FioQuadro[];
};

export type BorneQuadro = { componente: string; lado: 'superior' | 'inferior'; numero: number };
export type FioQuadro = { id: string; origem: BorneQuadro; destino: BorneQuadro; cor: string; identificacao: string };
export const CORES_FIO = [
  { nome: 'Preto', valor: '#20252b' }, { nome: 'Vermelho', valor: '#c73535' },
  { nome: 'Azul', valor: '#1686cf' }, { nome: 'Verde', valor: '#27854c' },
  { nome: 'Amarelo', valor: '#ba8b12' }, { nome: 'Branco', valor: '#f5f5f5' },
];
export function numeroBornes(c: ComponenteQuadro) { return c.bornes ?? Number(c.tipo.match(/(\d)P/)?.[1] ?? 1); }
export function borneValido(q: Quadro, b: BorneQuadro): boolean {
  if (!b || !['superior', 'inferior'].includes(b.lado) || !Number.isInteger(b.numero) || b.numero < 0) return false;
  if (b.componente === '@N' || b.componente === '@PE') return !!(b.componente === '@N' ? q.barramentoN : q.barramentoPE) && b.numero < 10 && b.lado === 'superior';
  const c = q.componentes.find(c => c.id === b.componente);
  return !!c && b.numero < numeroBornes(c);
}
export function mesmoBorne(a: BorneQuadro, b: BorneQuadro) { return a.componente === b.componente && a.lado === b.lado && a.numero === b.numero; }
export function nomeBorne(q: Quadro, b: BorneQuadro) {
  if (b.componente.startsWith('@')) return `${b.componente.slice(1)} · borne ${b.numero + 1}`;
  const c = q.componentes.find(c => c.id === b.componente);
  return `${c?.circuito || c?.tipo || 'Componente'} [${q.componentes.indexOf(c!) + 1}] · ${b.lado} ${b.numero + 1}`;
}
export function fiosValidos(q: Quadro) { return (q.fios ?? []).filter(f => borneValido(q, f.origem) && borneValido(q, f.destino)); }

export const CATALOGO_QUADRO = [
  { tipo: 'Disjuntor 1P', modulos: 1 },
  { tipo: 'Disjuntor 2P', modulos: 2 },
  { tipo: 'Disjuntor 3P', modulos: 3 },
  { tipo: 'DR 2P', modulos: 2 },
  { tipo: 'DR 4P', modulos: 4 },
  { tipo: 'DPS', modulos: 1 },
  { tipo: 'Contator', modulos: 2 },
  { tipo: 'Outro componente', modulos: 1 },
];

export function cabeNoQuadro(q: Quadro, item: ComponenteQuadro): boolean {
  return Number.isInteger(item.modulos) && item.modulos >= 1 &&
    Number.isInteger(item.trilho) && item.trilho >= 0 && item.trilho < q.trilhos &&
    Number.isInteger(item.inicio) && item.inicio >= 0 &&
    item.inicio + item.modulos <= q.modulosPorTrilho &&
    !q.componentes.some(c => c.id !== item.id && c.trilho === item.trilho &&
      c.inicio < item.inicio + item.modulos && item.inicio < c.inicio + c.modulos);
}

export function primeiroEspaco(q: Quadro, modulos: number): { trilho: number; inicio: number } | null {
  for (let trilho = 0; trilho < q.trilhos; trilho++) {
    for (let inicio = 0; inicio <= q.modulosPorTrilho - modulos; inicio++) {
      if (cabeNoQuadro(q, { id: '', tipo: '', descricao: '', circuito: '', modulos, trilho, inicio })) {
        return { trilho, inicio };
      }
    }
  }
  return null;
}

export function quadroValido(value: unknown): value is Quadro {
  if (!value || typeof value !== 'object') return false;
  const q = value as Quadro;
  if (typeof q.id !== 'string' || typeof q.nome !== 'string' || typeof q.cliente !== 'string' ||
    !Number.isInteger(q.trilhos) || q.trilhos < 1 || q.trilhos > 6 ||
    !Number.isInteger(q.modulosPorTrilho) || q.modulosPorTrilho < 4 || q.modulosPorTrilho > 36 ||
    !Array.isArray(q.componentes) ||
    (q.barramentoN !== undefined && typeof q.barramentoN !== 'boolean') ||
    (q.barramentoPE !== undefined && typeof q.barramentoPE !== 'boolean')) return false;
  const ids = new Set<string>();
  for (const c of q.componentes) {
    if (!c || typeof c.id !== 'string' || !c.id || ids.has(c.id) ||
      typeof c.tipo !== 'string' || typeof c.descricao !== 'string' || typeof c.circuito !== 'string') return false;
    ids.add(c.id);
  }
  if (!q.componentes.every(c => cabeNoQuadro(q, c) && Number.isInteger(numeroBornes(c)) && numeroBornes(c) >= 1 && numeroBornes(c) <= 12)) return false;
  if (q.fios === undefined) return true;
  if (!Array.isArray(q.fios)) return false;
  const fiosIds = new Set<string>();
  return q.fios.every(f => {
    if (!f || typeof f.id !== 'string' || fiosIds.has(f.id) || typeof f.identificacao !== 'string' || !CORES_FIO.some(c => c.valor === f.cor) ||
      !borneValido(q, f.origem) || !borneValido(q, f.destino) || mesmoBorne(f.origem, f.destino)) return false;
    fiosIds.add(f.id); return true;
  });
}

export function materiaisQuadro(q: Quadro) {
  const grupos = new Map<string, { tipo: string; descricao: string; modulos: number; quantidade: number }>();
  for (const c of q.componentes) {
    const chave = JSON.stringify([c.tipo, c.descricao, c.modulos]);
    const grupo = grupos.get(chave);
    if (grupo) grupo.quantidade++;
    else grupos.set(chave, { tipo: c.tipo, descricao: c.descricao, modulos: c.modulos, quantidade: 1 });
  }
  return [...grupos.values()];
}
