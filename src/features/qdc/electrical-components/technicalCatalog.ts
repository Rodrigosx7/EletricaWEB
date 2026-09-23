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

export const GENERIC_DIN_2P: TechnicalModel = {
  id: 'generic-din-2p', type: 'breaker-2p', brand: 'Genérico', model: 'DIN 2P', visualVariant: 'generic-din-2p',
  availablePoles: [2], availableCurrents: [6, 10, 16, 20, 25, 32, 40, 50, 63],
  availableCurves: ['B', 'C', 'D'], availableBreakingCapacitiesKa: [3, 4.5, 6],
  availableVoltages: [220, 230, 380, 400],
};

export const TECHNICAL_MODELS: readonly TechnicalModel[] = [GENERIC_DIN_2P];

export function technicalModel(id?: string): TechnicalModel | undefined {
  return TECHNICAL_MODELS.find(item => item.id === id);
}

export function breaker2pTerminals(): Terminal[] {
  return [
    { id: 'top-0', label: '1', side: 'top', index: 0, kind: 'L', pole: 1, position: { x: .25, y: 0 } },
    { id: 'top-1', label: '3', side: 'top', index: 1, kind: 'L', pole: 2, position: { x: .75, y: 0 } },
    { id: 'bottom-0', label: '2', side: 'bottom', index: 0, kind: 'L', pole: 1, position: { x: .25, y: 1 } },
    { id: 'bottom-1', label: '4', side: 'bottom', index: 1, kind: 'L', pole: 2, position: { x: .75, y: 1 } },
  ];
}
