import type { Device, FishboneConfig, FishbonePhase, FishboneSide, FishboneSlot, Point, Project, Supply } from '../types';

export const FISHBONE_MODELS = [
  { id: 'alternating', name: 'Alternado', phaseOffset: (side: FishboneSide, position: number) => position + (side === 'right' ? 1 : 0) },
  { id: 'paired', name: 'Em pares', phaseOffset: (_side: FishboneSide, position: number) => position },
] as const;
export const FISHBONE_CAPACITIES = [12, 18, 24, 36] as const;
export const FISHBONE_WIDTH = 860;
export const FISHBONE_TOP = 365;
export const FISHBONE_ROW = 80;
export const FISHBONE_SPINE_X = FISHBONE_WIDTH / 2;

export function createFishboneConfig(capacity: number, supply: Supply, modelId: string): FishboneConfig {
  const model = FISHBONE_MODELS.find(item => item.id === modelId);
  if (!model || !FISHBONE_CAPACITIES.some(value => value === capacity)) throw new Error('Modelo de barramento espinha inválido.');
  const phases: FishbonePhase[] = supply === 'tri' ? ['R', 'S', 'T'] : supply === 'bi' ? ['R', 'S'] : ['R'];
  const slots: FishboneSlot[] = Array.from({ length: capacity / 2 }, (_, position) => (['left', 'right'] as const).map(side => ({
    id: `${side}-${position + 1}`, side, position, phase: phases[model.phaseOffset(side, position) % phases.length], enabled: true,
  }))).flat();
  return { modelId, slots };
}

export function isFishboneBreaker(device: Pick<Device, 'type'>): boolean {
  return device.type.startsWith('breaker-') || device.type.startsWith('motor-breaker-');
}

export function fishboneSlotsFor(project: Project, device: Device): FishboneSlot[] {
  if (project.boardType !== 'fishbone' || !project.fishbone || !device.fishboneSlotId) return [];
  const start = project.fishbone.slots.find(slot => slot.id === device.fishboneSlotId);
  if (!start) return [];
  return Array.from({ length: device.poles }, (_, index) => project.fishbone!.slots.find(slot => slot.side === start.side && slot.position === start.position + index)).filter((slot): slot is FishboneSlot => Boolean(slot));
}

export function fishbonePhase(project: Project, device: Device): string {
  const order = ['R', 'S', 'T'];
  return fishboneSlotsFor(project, device).map(slot => slot.phase).sort((a, b) => order.indexOf(a) - order.indexOf(b)).join('/');
}

export function fishboneSlotIssue(project: Project, device: Device, slotId: string): string | null {
  if (project.boardType !== 'fishbone' || !project.fishbone || !isFishboneBreaker(device)) return 'Este componente não usa os encaixes laterais.';
  const start = project.fishbone.slots.find(slot => slot.id === slotId);
  if (!start) return 'Posição da espinha inexistente.';
  const slots = Array.from({ length: device.poles }, (_, index) => project.fishbone!.slots.find(slot => slot.side === start.side && slot.position === start.position + index));
  if (slots.some(slot => !slot || !slot.enabled)) return 'Não há posições adjacentes habilitadas para todos os polos.';
  if (new Set(slots.map(slot => slot!.phase)).size !== device.poles) return 'Os polos precisam ocupar fases distintas na espinha.';
  const occupied = new Set(project.devices.filter(other => other.id !== device.id).flatMap(other => fishboneSlotsFor(project, other).map(slot => slot.id)));
  if (slots.some(slot => occupied.has(slot!.id))) return 'Uma das posições já está ocupada.';
  return null;
}

export function fishboneRect(project: Project, device: Device): { x: number; y: number; width: number; height: number } | null {
  const slot = project.fishbone?.slots.find(item => item.id === device.fishboneSlotId);
  if (!slot) return null;
  const width = Math.max(42, device.modules * 43);
  return { x: slot.side === 'left' ? 300 - width : 560, y: FISHBONE_TOP + slot.position * FISHBONE_ROW, width, height: 72 + (device.poles - 1) * FISHBONE_ROW };
}

export function fishboneSlotAt(project: Project, point: Point): FishboneSlot | null {
  if (project.boardType !== 'fishbone' || !project.fishbone) return null;
  const side: FishboneSide | null = point.x >= 130 && point.x <= 335 ? 'left' : point.x >= 535 && point.x <= 740 ? 'right' : null;
  if (!side) return null;
  const position = Math.round((point.y - FISHBONE_TOP - 36) / FISHBONE_ROW);
  const slot = project.fishbone.slots.find(item => item.side === side && item.position === position);
  return slot && Math.abs(point.y - (FISHBONE_TOP + position * FISHBONE_ROW + 36)) <= 42 ? slot : null;
}
