import type { Circuit, Supply } from '../types';

export type CircuitDraft = { name: string; description: string; phase: string; voltage: number; cableGauge: number | null; neutralGauge: number | null; earthGauge: number | null; phaseColors: string[]; neutralColor: string; earthColor: string; sameGauge: boolean; hasNeutral: boolean; hasEarth: boolean; outputGroup?: string };

export const phaseOptions = (supply: Supply): string[] => supply === 'mono' ? ['R'] : supply === 'bi' ? ['R', 'S', 'R/S'] : ['R', 'S', 'T', 'R/S', 'S/T', 'R/T', 'R/S/T'];

export function suggestedCircuitVoltage(supply: Supply, phase: string, referenceVoltage: number): number {
  if (supply === 'mono' || phase.includes('/')) return referenceVoltage;
  return ({ 220: 127, 380: 220, 440: 254 } as Record<number, number>)[referenceVoltage] ?? referenceVoltage;
}

export function newCircuitDraft(supply: Supply, index: number, referenceVoltage: number): CircuitDraft {
  const phase = supply === 'mono' ? 'R' : supply === 'bi' ? 'R/S' : 'R';
  return { name: `Circuito ${index}`, description: '', phase, voltage: suggestedCircuitVoltage(supply, phase, referenceVoltage), cableGauge: null, neutralGauge: null, earthGauge: null, phaseColors: ['#20252b', '#dc4037', '#9b6b30'], neutralColor: '#1686cf', earthColor: '#27854c', sameGauge: true, hasNeutral: true, hasEarth: true };
}

export function circuitFromDraft(draft: CircuitDraft, number: number): Circuit {
  return { id: crypto.randomUUID(), number, name: draft.name.trim(), phase: draft.phase, breakerId: null,
    cableGauge: draft.cableGauge, neutralGauge: draft.sameGauge ? undefined : draft.neutralGauge, earthGauge: draft.sameGauge ? undefined : draft.earthGauge, phaseColors: draft.phaseColors, neutralColor: draft.neutralColor, earthColor: draft.earthColor, hasNeutral: draft.hasNeutral, hasEarth: draft.hasEarth, ampacity: null,
    load: null, loadUnit: 'W', voltage: draft.voltage, powerFactor: 1, drId: null, notes: draft.description.trim(), color: '#e9b949' };
}
