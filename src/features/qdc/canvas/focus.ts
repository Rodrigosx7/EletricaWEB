import type { Project, Selection } from '../types';

export type CanvasFocus = { wireIds: Set<string>; deviceIds: Set<string> };

function circuitNumber(label: string): number | null {
  const match = label.match(/^C(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

/** Builds the smallest useful electrical context for the current canvas selection. */
export function canvasFocus(project: Project, selection: Selection): CanvasFocus | null {
  if (!selection.devices.length && !selection.wire) return null;
  const selectedDevices = new Set(selection.devices);
  const circuitNumbers = new Set<number>();
  for (const deviceId of selectedDevices) {
    const circuitId = project.devices.find(device => device.id === deviceId)?.circuitId;
    const circuit = circuitId ? project.circuits.find(item => item.id === circuitId) : null;
    if (circuit) circuitNumbers.add(circuit.number);
  }
  const selectedWire = selection.wire ? project.wires.find(wire => wire.id === selection.wire) : null;
  const selectedWireCircuit = selectedWire ? circuitNumber(selectedWire.label) : null;
  if (selectedWireCircuit !== null) circuitNumbers.add(selectedWireCircuit);

  const circuitBreakers = new Set(project.circuits.filter(circuit => circuitNumbers.has(circuit.number) && circuit.breakerId).map(circuit => circuit.breakerId!));
  const wireIds = new Set<string>();
  for (const wire of project.wires) {
    const wireCircuit = circuitNumber(wire.label);
    const directlySelected = wire.id === selection.wire || selectedDevices.has(wire.sourceComponent) || selectedDevices.has(wire.targetComponent);
    const belongsToCircuit = wireCircuit !== null && circuitNumbers.has(wireCircuit);
    const feedsCircuitBreaker = circuitBreakers.has(wire.sourceComponent) || circuitBreakers.has(wire.targetComponent);
    if (directlySelected || belongsToCircuit || feedsCircuitBreaker) wireIds.add(wire.id);
  }

  const deviceIds = new Set(selectedDevices);
  for (const wire of project.wires) if (wireIds.has(wire.id)) {
    deviceIds.add(wire.sourceComponent);
    deviceIds.add(wire.targetComponent);
  }
  return { wireIds, deviceIds };
}
