import { circuitCurrent, needsLineCurrent, protectionCheck } from './analysis.ts';
import { circuitConnectionMap } from './connectionMap.ts';
import { circuitGauge } from '../editor/operations.ts';
import type { Circuit, Project, Terminal } from '../types';

export function circuitOverview(project: Project, circuit: Circuit) {
  const prefix = `circuit-${circuit.id}-`;
  const legacy = [`c${circuit.number}-l`, `c${circuit.number}-n`, `c${circuit.number}-pe`];
  const belongs = (id: string) => id.startsWith(prefix) || legacy.includes(id);
  const output = project.devices.find(device => device.type === 'conduit-entry' && device.terminals.some(term => belongs(term.id)));
  const terminals = output?.terminals.filter(term => belongs(term.id)) ?? [];
  const connected = terminals.filter(term => project.wires.some(wire => wire.sourceComponent === output?.id && wire.sourceTerminal === term.id || wire.targetComponent === output?.id && wire.targetTerminal === term.id));
  const breaker = project.devices.find(device => device.id === circuit.breakerId);
  const protection = protectionCheck(circuit, breaker);
  const phaseCount = circuit.phase.split('/').filter(Boolean).length;
  const phaseConnected = connected.filter(term => term.kind === 'L').length;
  const protectedPhases = connected.filter(term => term.kind === 'L' && project.wires.some(wire => wire.sourceComponent === output?.id && wire.sourceTerminal === term.id && wire.targetComponent === breaker?.id || wire.targetComponent === output?.id && wire.targetTerminal === term.id && wire.sourceComponent === breaker?.id)).length;
  const problems = [...protection.issues];
  const feedRoutes = circuitConnectionMap(project, circuit).routes.filter(route => terminals.some(term => term.kind === (route.kind === 'phase' ? 'L' : route.kind === 'neutral' ? 'N' : 'PE')));
  const incompleteFeed = feedRoutes.some(route => !route.complete);
  if (breaker && phaseCount > 0 && protectedPhases < phaseCount) problems.push(`${phaseCount - protectedPhases} fase(s) ainda sem ligação ao disjuntor vinculado.`);
  if (terminals.some(term => term.kind === 'N') && !connected.some(term => term.kind === 'N')) problems.push('Neutro ainda sem ligação.');
  if (terminals.some(term => term.kind === 'PE') && !connected.some(term => term.kind === 'PE')) problems.push('PE ainda sem ligação.');
  if (breaker && connected.length === terminals.length && incompleteFeed) problems.push('Falta continuidade desenhada entre a entrada de energia e uma ou mais pontas do circuito.');
  if (circuit.load !== null && needsLineCurrent(circuit)) problems.push('Em duas fases com neutro, a potência total em W não define a corrente da fase mais carregada. Informe a corrente em A ou separe as cargas por fase.');
  const missing = [
    ...(!output ? ['saída do circuito'] : []),
    ...(!breaker ? ['disjuntor'] : []),
    ...(circuit.load === null ? ['carga'] : []),
    ...(needsLineCurrent(circuit) ? ['corrente da fase mais carregada em A'] : []),
    ...(circuit.cableGauge === null ? ['seção da fase'] : []),
    ...(breaker?.amperage == null ? ['In do disjuntor'] : []),
    ...(circuit.ampacity == null ? ['Iz corrigida'] : []),
  ];
  const status = protection.issues.length ? 'error' : !breaker ? 'unprotected' : terminals.length && (connected.length < terminals.length || protectedPhases < phaseCount || incompleteFeed) ? 'partial' : missing.length ? 'pending' : 'ready';
  const label = status === 'error' ? 'Revisar proteção' : status === 'unprotected' ? 'Sem disjuntor' : status === 'partial' ? 'Ligações parciais' : status === 'pending' ? terminals.length && connected.length === terminals.length ? 'Conectado · análise pendente' : 'Análise pendente' : 'Ib ≤ In ≤ Iz: preliminar';
  return { output, terminals, connected, phaseConnected, protectedPhases, breaker, protection, problems, missing, status, label, current: circuitCurrent(circuit),
    conductors: terminals.map((terminal: Terminal) => ({ terminal, connected: connected.includes(terminal), gauge: circuitGauge(circuit, terminal.kind) })) };
}
