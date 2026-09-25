import type { Device, Terminal } from '../types';

const PHASES = ['R', 'S', 'T'] as const;

/** Each physical tooth advances one pole; repeated teeth share the same phase lane. */
export function combPhaseAt(comb: Pick<Device, 'poles' | 'combPhaseStart'>, tooth: number): string {
  const lane = ((tooth % comb.poles) + comb.poles) % comb.poles;
  if (comb.poles === 4 && lane === 3) return 'N'; // Preserve legacy four-pole projects.
  return PHASES[((comb.combPhaseStart ?? 0) + lane) % PHASES.length];
}

export function combPhases(comb: Pick<Device, 'poles' | 'combPhaseStart'>): string[] {
  return Array.from({ length: comb.poles }, (_, index) => combPhaseAt(comb, index));
}

export function combCoveredTerminals(comb: Device, device: Device): Terminal[] {
  if (!(device.type.startsWith('breaker-') || device.type === 'main-breaker')) return [];
  if (device.rail !== comb.rail) return [];
  return device.terminals.filter(terminal => terminal.kind === 'L' && terminal.side === (comb.combSide ?? 'bottom')
    && device.slot + terminal.index >= comb.slot && device.slot + terminal.index < comb.slot + comb.modules);
}
