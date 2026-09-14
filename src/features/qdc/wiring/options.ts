import type { Conductor, WireTermination } from '../types';

export const WIRE_GAUGES = [.5, .75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];

export const WIRE_COLORS: Record<Conductor, { value: string; label: string }[]> = {
  phase: [
    { value: '#252d36', label: 'Preto' },
    { value: '#8b5a32', label: 'Marrom' },
    { value: '#777e87', label: 'Cinza' },
    { value: '#dc4037', label: 'Vermelho' },
  ],
  neutral: [{ value: '#38a8e8', label: 'Azul-claro' }],
  earth: [{ value: '#24a15c', label: 'Verde/amarelo' }],
  return: [
    { value: '#dc4037', label: 'Vermelho' },
    { value: '#e98a28', label: 'Laranja' },
    { value: '#925bc9', label: 'Violeta' },
    { value: '#8b5a32', label: 'Marrom' },
  ],
};

export const TERMINATION_OPTIONS: { value: WireTermination; label: string }[] = [
  { value: 'tubular', label: 'Tubular' },
  { value: 'pente', label: 'Pente' },
  { value: 'olhal', label: 'Olhal' },
  { value: 'garfo', label: 'Garfo' },
  { value: 'pino', label: 'Pino' },
  { value: 'sem-terminal', label: 'Sem terminal' },
];

/** Cor do colar isolante segundo a série DIN 46228-4. */
const FERRULE_COLORS = new Map<number, { hex: string; name: string }>([
  [.5, { hex: '#f7f7f3', name: 'branco' }], [.75, { hex: '#8a9095', name: 'cinza' }], [1, { hex: '#d84138', name: 'vermelho' }], [1.5, { hex: '#1f252a', name: 'preto' }],
  [2.5, { hex: '#2478b9', name: 'azul' }], [4, { hex: '#8a9095', name: 'cinza' }], [6, { hex: '#e1c229', name: 'amarelo' }], [10, { hex: '#d84138', name: 'vermelho' }],
  [16, { hex: '#2478b9', name: 'azul' }], [25, { hex: '#e1c229', name: 'amarelo' }], [35, { hex: '#d84138', name: 'vermelho' }], [50, { hex: '#2478b9', name: 'azul' }],
]);

export function ferruleColor(gauge: number | null): { hex: string; name: string } {
  return gauge === null ? { hex: '#d8dde0', name: 'neutro enquanto a bitola não estiver definida' } : FERRULE_COLORS.get(gauge) ?? { hex: '#d8dde0', name: 'sem cor padronizada neste editor' };
}
