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
  return device.terminals.filter(terminal => combToothAt(comb, device, terminal) !== null);
}

/** Only a terminal centered under a tooth is a physical contact. */
export function combToothAt(comb: Device, device: Device, terminal: Terminal): number | null {
  if (comb.type !== 'comb-bus' || device.rail !== comb.rail || device.fishboneSlotId ||
    device.mount === 'edge' || device.mount === 'overlay' || ['power-entry', 'conduit-entry', 'fishbone-bus'].includes(device.type) ||
    ['L', 'N', 'PE'].includes(terminal.kind) === false ||
    terminal.side !== (comb.combSide ?? 'bottom')) return null;
  const peers = device.terminals.filter(other => other.side === terminal.side).sort((a, b) => a.index - b.index);
  const index = peers.findIndex(other => other.id === terminal.id);
  if (index < 0 || !peers.length) return null;
  const position = (terminal.position?.x ?? (index + .5) / peers.length) * device.modules;
  const moduleIndex = Math.round(position - .5);
  if (moduleIndex < 0 || moduleIndex >= device.modules || Math.abs(position - moduleIndex - .5) > .12) return null;
  const tooth = device.slot + moduleIndex - comb.slot;
  return tooth >= 0 && tooth < comb.modules ? tooth : null;
}

export function combContacts(comb: Device, devices: Device[]) {
  return devices.flatMap(device => combCoveredTerminals(comb, device).map(terminal => {
    const tooth = combToothAt(comb, device, terminal)!;
    return { device, terminal, tooth, lane: tooth % comb.poles };
  }));
}

/** A conductive lane touching unlike terminal kinds is a short-circuit risk, not a valid feed. */
export function combMixedLanes(contacts: ReturnType<typeof combContacts>): Set<number> {
  const kinds = new Map<number, Set<Terminal['kind']>>();
  for (const contact of contacts) {
    if (!kinds.has(contact.lane)) kinds.set(contact.lane, new Set());
    kinds.get(contact.lane)!.add(contact.terminal.kind);
  }
  return new Set([...kinds].filter(([, values]) => values.size > 1).map(([lane]) => lane));
}
