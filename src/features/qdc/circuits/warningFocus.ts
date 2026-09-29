import type { Point, Project, Warning } from '../types';
import type { CanvasFocus } from '../canvas/focus';
import { boardSize, deviceRect, terminalPoint } from '../wiring/routing.ts';

export type WarningLocation = { focus: CanvasFocus; point: Point; kind: 'wire' | 'device' | 'circuit' | 'board' };

/** Resolve a verification item to the part of the drawing that needs attention. */
export function warningLocation(project: Project, notice: Warning): WarningLocation {
  const wire = project.wires.find(item => item.id === notice.wireId);
  const circuit = project.circuits.find(item => item.id === notice.circuitId);
  const explicitDevice = project.devices.find(item => item.id === notice.deviceId);
  const terminalIds = new Set(notice.terminalIds ?? []);
  const wireIds = new Set<string>();
  const deviceIds = new Set<string>();
  if (wire) {
    wireIds.add(wire.id);
    deviceIds.add(wire.sourceComponent);
    deviceIds.add(wire.targetComponent);
    terminalIds.add(`${wire.sourceComponent}:${wire.sourceTerminal}`);
    terminalIds.add(`${wire.targetComponent}:${wire.targetTerminal}`);
  }
  if (explicitDevice) deviceIds.add(explicitDevice.id);
  if (circuit) {
    if (circuit.breakerId) deviceIds.add(circuit.breakerId);
    for (const device of project.devices.filter(item => item.type === 'conduit-entry')) {
      const outputs = device.terminals.filter(term => term.id.startsWith(`circuit-${circuit.id}-`) || [`c${circuit.number}-l`, `c${circuit.number}-n`, `c${circuit.number}-pe`].includes(term.id));
      if (outputs.length) deviceIds.add(device.id);
      for (const output of outputs) {
        const endpoint = `${device.id}:${output.id}`;
        if (!wire && !explicitDevice) terminalIds.add(endpoint);
        for (const related of project.wires.filter(item => `${item.sourceComponent}:${item.sourceTerminal}` === endpoint || `${item.targetComponent}:${item.targetTerminal}` === endpoint)) wireIds.add(related.id);
      }
    }
  }
  for (const endpoint of terminalIds) deviceIds.add(endpoint.slice(0, endpoint.indexOf(':')));

  const points: Point[] = [];
  if (wire) {
    if (wire.path.length) points.push(wire.path[Math.floor(wire.path.length / 2)]);
    else for (const endpoint of terminalIds) {
      const separator = endpoint.indexOf(':');
      const point = terminalPoint(project, endpoint.slice(0, separator), endpoint.slice(separator + 1));
      if (point) points.push(point);
    }
  } else if (notice.terminalIds?.length) {
    for (const endpoint of notice.terminalIds) {
      const separator = endpoint.indexOf(':');
      const point = terminalPoint(project, endpoint.slice(0, separator), endpoint.slice(separator + 1));
      if (point) points.push(point);
    }
  }
  if (!points.length && explicitDevice) {
    const rect = deviceRect(explicitDevice, project);
    points.push({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
  }
  if (!points.length && circuit) {
    const output = project.devices.find(device => device.type === 'conduit-entry' && deviceIds.has(device.id));
    const target = output ?? project.devices.find(device => device.id === circuit.breakerId);
    if (target) { const rect = deviceRect(target, project); points.push({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }); }
  }
  const size = boardSize(project);
  return {
    focus: { wireIds, deviceIds, terminalIds },
    point: points.length ? { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length } : { x: size.width / 2, y: size.height / 2 },
    kind: wire ? 'wire' : explicitDevice ? 'device' : circuit ? 'circuit' : 'board',
  };
}
