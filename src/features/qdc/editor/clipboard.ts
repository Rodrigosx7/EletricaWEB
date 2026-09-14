import type { Project } from '../types.ts';
import { firstSpace } from './operations.ts';
import { routeWires } from '../wiring/routing.ts';
export type QdcClipboard = Pick<Project, 'devices' | 'circuits' | 'wires'>;
export function copyDevices(project: Project, ids: string[]): QdcClipboard {
  return structuredClone({ devices: project.devices.filter(d => ids.includes(d.id)), circuits: project.circuits.filter(c => c.breakerId && ids.includes(c.breakerId)), wires: project.wires.filter(w => ids.includes(w.sourceComponent) && ids.includes(w.targetComponent)) });
}
export function pasteDevices(project: Project, clipboard: QdcClipboard): { project: Project; ids: string[] } {
  let next = { ...project, devices: [...project.devices], circuits: [...project.circuits], wires: [...project.wires] };
  const ids = new Map(clipboard.devices.map(d => [d.id, crypto.randomUUID()]));
  const circuits = new Map(clipboard.circuits.map(c => [c.id, crypto.randomUUID()]));
  for (const d of clipboard.devices) {
    const position = firstSpace(next, d.modules);
    if (!position) throw new Error('Não há espaço para colar todos os componentes. A montagem foi preservada.');
    next.devices.push({ ...structuredClone(d), ...position, id: ids.get(d.id)!, circuitId: d.circuitId ? circuits.get(d.circuitId) ?? null : null });
  }
  let number = Math.max(0, ...project.circuits.map(c => c.number));
  next.circuits.push(...clipboard.circuits.map(c => ({ ...structuredClone(c), id: circuits.get(c.id)!, number: ++number, name: `${c.name} — cópia`, breakerId: c.breakerId ? ids.get(c.breakerId) ?? null : null, drId: c.drId ? ids.get(c.drId) ?? null : null })));
  next.wires.push(...clipboard.wires.map(w => ({ ...structuredClone(w), id: crypto.randomUUID(), sourceComponent: ids.get(w.sourceComponent)!, targetComponent: ids.get(w.targetComponent)!, path: [] })));
  next = routeWires(next);
  return { project: next, ids: [...ids.values()] };
}
