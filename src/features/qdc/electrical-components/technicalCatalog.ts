import type { Device, Terminal } from '../types';

/** Illustrative editor presets, not certified manufacturer product data. */
export type TechnicalModel = {
  id: string;
  type: string;
  brand: string;
  model: string;
  visualVariant: string;
  availablePoles: readonly number[];
  availableCurrents: readonly number[];
  availableCurves: readonly Device['curve'][];
  availableBreakingCapacitiesKa: readonly number[];
  availableVoltages: readonly number[];
};

const COMMON_MCB = {
  brand: 'Genérico',
  availableCurrents: [6, 10, 16, 20, 25, 32, 40, 50, 63],
  availableCurves: ['B', 'C', 'D'] as const,
  availableBreakingCapacitiesKa: [3, 4.5, 6],
};

export const GENERIC_DIN_1P: TechnicalModel = {
  ...COMMON_MCB, id: 'generic-din-1p', type: 'breaker-1p', model: 'DIN 1P', visualVariant: 'generic-din-1p',
  availablePoles: [1], availableVoltages: [127, 220, 230],
};
export const GENERIC_DIN_2P: TechnicalModel = {
  ...COMMON_MCB, id: 'generic-din-2p', type: 'breaker-2p', model: 'DIN 2P', visualVariant: 'generic-din-2p',
  availablePoles: [2], availableVoltages: [220, 230, 380, 400],
};
export const GENERIC_DIN_3P: TechnicalModel = {
  ...COMMON_MCB, id: 'generic-din-3p', type: 'breaker-3p', model: 'DIN 3P', visualVariant: 'generic-din-3p',
  availablePoles: [3], availableVoltages: [220, 380, 400],
};

export const TECHNICAL_MODELS: readonly TechnicalModel[] = [GENERIC_DIN_1P, GENERIC_DIN_2P, GENERIC_DIN_3P];

export function breakerTechnicalModel(type: string): TechnicalModel | undefined {
  return TECHNICAL_MODELS.find(item => item.type === type);
}

export function technicalModel(id?: string): TechnicalModel | undefined {
  return TECHNICAL_MODELS.find(item => item.id === id);
}

export function breakerTerminals(poles: 1 | 2 | 3): Terminal[] {
  return Array.from({ length: poles }, (_, index) => [
    { id: `top-${index}`, label: String(2 * index + 1), side: 'top' as const, index, kind: 'L' as const, direction: 'input' as const, pole: index + 1, position: { x: (index + .5) / poles, y: 0 } },
    { id: `bottom-${index}`, label: String(2 * index + 2), side: 'bottom' as const, index, kind: 'L' as const, direction: 'output' as const, pole: index + 1, position: { x: (index + .5) / poles, y: 1 } },
  ]).flat();
}
