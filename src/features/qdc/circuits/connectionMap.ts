import type { Circuit, Project, Terminal, Wire } from '../types';
import { combCoveredTerminals } from '../electrical-components/combPhases.ts';

type Kind = 'phase' | 'neutral' | 'earth';
type Link = { to: string; wireId: string | null; viaDeviceId?: string };
export type ConnectionStep = { wire: Wire; from: string; to: string };
export type ConnectionRoute = { kind: Kind; complete: boolean; steps: ConnectionStep[]; deviceIds: Set<string> };
export type CircuitConnectionMap = { routes: ConnectionRoute[]; wireIds: Set<string>; deviceIds: Set<string> };

const key = (deviceId: string, terminalId: string) => `${deviceId}:${terminalId}`;
const kindFor = (terminal: Terminal): Kind | null => terminal.kind === 'L' ? 'phase' : terminal.kind === 'N' ? 'neutral' : terminal.kind === 'PE' ? 'earth' : null;
const wireKind = (wire: Wire): Kind | null => wire.conductorType === 'return' ? 'phase' : wire.conductorType;

function outputBelongsToCircuit(terminal: Terminal, circuit: Circuit): boolean {
  return terminal.id.startsWith(`circuit-${circuit.id}-`) || [`c${circuit.number}-l`, `c${circuit.number}-n`, `c${circuit.number}-pe`].includes(terminal.id);
}

function graphFor(project: Project, kind: Kind): Map<string, Link[]> {
  const graph = new Map<string, Link[]>();
  const add = (from: string, to: string, wireId: string | null, viaDeviceId?: string) => {
    graph.set(from, [...(graph.get(from) ?? []), { to, wireId, viaDeviceId }]);
    graph.set(to, [...(graph.get(to) ?? []), { to: from, wireId, viaDeviceId }]);
  };
  const devices = new Map(project.devices.map(device => [device.id, device]));
  for (const wire of project.wires) {
    if (wireKind(wire) !== kind) continue;
    const source = devices.get(wire.sourceComponent)?.terminals.find(term => term.id === wire.sourceTerminal);
    const target = devices.get(wire.targetComponent)?.terminals.find(term => term.id === wire.targetTerminal);
    if (!source || !target || kindFor(source) !== kind || kindFor(target) !== kind) continue;
    add(key(wire.sourceComponent, source.id), key(wire.targetComponent, target.id), wire.id);
  }
  for (const device of project.devices) {
    const terminals = device.terminals.filter(term => kindFor(term) === kind);
    if (['neutral-bus', 'earth-bus', 'terminal-n', 'terminal-pe'].includes(device.type)) {
      for (const terminal of terminals.slice(1)) add(key(device.id, terminals[0].id), key(device.id, terminal.id), null);
    } else if (device.type === 'main-breaker' || device.type.startsWith('breaker-') || device.type.startsWith('motor-breaker-') || device.type.startsWith('rcd-') || device.type.startsWith('rcbo-')) {
      for (const top of terminals.filter(term => term.side === 'top')) {
        const bottom = terminals.find(term => term.side === 'bottom' && term.index === top.index);
        if (bottom) add(key(device.id, top.id), key(device.id, bottom.id), null);
      }
    }
  }
  // A comb has no terminals of its own. Join only terminals on the same physical lane.
  for (const comb of project.devices.filter(device => device.type === 'comb-bus')) {
    const groups = new Map<number, string[]>();
    for (const device of project.devices) {
      for (const terminal of combCoveredTerminals(comb, device).filter(term => kindFor(term) === kind)) {
        const lane = (device.slot - comb.slot + terminal.index) % comb.poles;
        groups.set(lane, [...(groups.get(lane) ?? []), key(device.id, terminal.id)]);
      }
    }
    for (const group of groups.values()) for (const node of group.slice(1)) add(group[0], node, null, comb.id);
  }
  return graph;
}

function trace(graph: Map<string, Link[]>, starts: string[], goals: Set<string>, breakerId: string | null): { nodes: string[]; links: Link[] } | null {
  const queue = starts.map(node => ({ node, breakerSeen: !breakerId || node.startsWith(`${breakerId}:`) }));
  const stateKey = (node: string, seen: boolean) => `${node}|${seen ? 1 : 0}`;
  const previous = new Map<string, { from: string; link: Link } | null>();
  for (const state of queue) previous.set(stateKey(state.node, state.breakerSeen), null);
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index], currentKey = stateKey(current.node, current.breakerSeen);
    if (goals.has(current.node) && current.breakerSeen) {
      const nodes = [current.node], links: Link[] = [];
      let cursor = currentKey;
      while (previous.get(cursor)) {
        const step = previous.get(cursor)!;
        links.push(step.link); cursor = step.from;
        nodes.push(cursor.slice(0, cursor.lastIndexOf('|')));
      }
      return { nodes: nodes.reverse(), links: links.reverse() };
    }
    for (const link of graph.get(current.node) ?? []) {
      const seen = current.breakerSeen || !!breakerId && link.to.startsWith(`${breakerId}:`);
      const nextKey = stateKey(link.to, seen);
      if (previous.has(nextKey)) continue;
      previous.set(nextKey, { from: currentKey, link });
      queue.push({ node: link.to, breakerSeen: seen });
    }
  }
  return null;
}

/** Graphical route only: device bridges model drawing continuity, not electrical compliance. */
export function circuitConnectionMap(project: Project, circuit: Circuit): CircuitConnectionMap {
  const wires = new Map(project.wires.map(wire => [wire.id, wire]));
  const routes: ConnectionRoute[] = (['phase', 'neutral', 'earth'] as const).map(kind => {
    const graph = graphFor(project, kind);
    const outputs = project.devices.filter(device => device.type === 'conduit-entry').flatMap(device => device.terminals
      .filter(term => outputBelongsToCircuit(term, circuit) && kindFor(term) === kind)
      .map(term => ({ node: key(device.id, term.id), phase: circuit.phase.split('/')[(term.pole ?? 1) - 1] })));
    const outputKeys = new Set(outputs.map(output => output.node));
    const phaseLabels = circuit.phase.split('/');
    const paths = outputs.map(output => {
      const entryKeys = project.devices.filter(device => device.type === 'power-entry').flatMap(device => device.terminals
        .filter(term => kindFor(term) === kind && (kind !== 'phase' || term.label === output.phase || !output.phase && phaseLabels.includes(term.label)))
        .map(term => key(device.id, term.id)));
      return trace(graph, entryKeys, new Set([output.node]), kind === 'phase' ? circuit.breakerId : null);
    });
    const tracedSteps: ConnectionStep[] = paths.flatMap(path => path ? path.links.flatMap((link, index) => {
      const wire = link.wireId ? wires.get(link.wireId) : null;
      return wire ? [{ wire, from: path.nodes[index], to: path.nodes[index + 1] }] : [];
    }) : []);
    const partialSteps: ConnectionStep[] = paths.every(Boolean) ? [] : project.wires.filter(wire => wireKind(wire) === kind && (
      outputKeys.has(key(wire.sourceComponent, wire.sourceTerminal)) || outputKeys.has(key(wire.targetComponent, wire.targetTerminal)) ||
      kind === 'phase' && circuit.breakerId !== null && (wire.sourceComponent === circuit.breakerId || wire.targetComponent === circuit.breakerId)
    )).map(wire => ({ wire, from: key(wire.sourceComponent, wire.sourceTerminal), to: key(wire.targetComponent, wire.targetTerminal) }));
    const steps = [...new Map([...tracedSteps, ...partialSteps].map(step => [step.wire.id, step])).values()];
    const tracedDevices = paths.flatMap(path => path ? [...path.nodes.map(node => node.slice(0, node.indexOf(':'))), ...path.links.flatMap(link => link.viaDeviceId ? [link.viaDeviceId] : [])] : []);
    return { kind, complete: outputs.length > 0 && paths.every(path => path && path.links.some(link => link.wireId)), steps, deviceIds: new Set([...tracedDevices, ...steps.flatMap(step => [step.wire.sourceComponent, step.wire.targetComponent])]) };
  });
  return { routes, wireIds: new Set(routes.flatMap(route => route.steps.map(step => step.wire.id))), deviceIds: new Set(routes.flatMap(route => [...route.deviceIds])) };
}

export function connectionEndpointLabel(project: Project, endpoint: string): string {
  const separator = endpoint.indexOf(':');
  const device = project.devices.find(item => item.id === endpoint.slice(0, separator));
  const terminal = device?.terminals.find(item => item.id === endpoint.slice(separator + 1));
  return `${device?.label || 'Componente removido'} · ${terminal?.label || 'borne removido'}`;
}
