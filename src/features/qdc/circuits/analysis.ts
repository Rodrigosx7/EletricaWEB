import { CATALOG } from '../electrical-components/catalog.ts';
import { combCoveredTerminals, combPhaseAt, combPhases } from '../electrical-components/combPhases.ts';
import { circuitForOutputTerminal, fits } from '../editor/operations.ts';
import { isRailMounted } from '../wiring/routing.ts';
import type { Circuit, Material, Project, Supply, Warning } from '../types.ts';

export function availablePhases(supply: Supply): string[] {
  return supply === 'tri' ? ['R', 'S', 'T'] : supply === 'bi' ? ['R', 'S'] : ['R'];
}

/** Total watts do not identify the most heavily loaded line of a two-phase circuit with neutral. */
const hasUnknownPhaseDistribution = (circuit: Circuit): boolean => circuit.phase.split('/').filter(Boolean).length === 2 && circuit.hasNeutral !== false;
export function needsLineCurrent(circuit: Circuit): boolean {
  return hasUnknownPhaseDistribution(circuit) && circuit.loadUnit === 'W';
}

/** W is total active input power; V is circuit voltage (line-line for 2/3 phases).
 * Three-phase input assumes a balanced load. A is already line current.
 * Neither breaker rating nor installed protective-device settings are load inputs. */
export function circuitCurrent(circuit: Circuit): number | null {
  if (circuit.load === null || !Number.isFinite(circuit.load) || circuit.load < 0) return null;
  if (circuit.loadUnit === 'A') return circuit.load;
  if (needsLineCurrent(circuit)) return null;
  if (!Number.isFinite(circuit.voltage) || circuit.voltage <= 0 || !Number.isFinite(circuit.powerFactor) || circuit.powerFactor <= 0 || circuit.powerFactor > 1) return null;
  const phases = circuit.phase.split('/').filter(Boolean);
  if (!phases.length || new Set(phases).size !== phases.length || phases.some(phase => !['R', 'S', 'T'].includes(phase))) return null;
  return circuit.load / (circuit.voltage * circuit.powerFactor * (phases.length === 3 ? Math.sqrt(3) : 1));
}

const SAMPLE_BREAKER_RATINGS = [2, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];

/** Preliminary load/conductor coordination only; no short-circuit or installation checks. */
export function protectionCheck(circuit: Circuit, breaker: { amperage: number | null; poles: number; terminals?: { side: string; kind: string }[] } | undefined) {
  const ib = circuitCurrent(circuit);
  const iz = circuit.ampacity ?? null;
  const poleCount = circuit.phase.split('/').filter(Boolean).length;
  const issues: string[] = [];
  const phasePoles = breaker?.terminals ? breaker.terminals.filter(term => term.side === 'bottom' && term.kind === 'L').length : breaker?.poles;
  if (phasePoles !== undefined && phasePoles !== poleCount) issues.push(`${poleCount} fases declaradas, mas o disjuntor tem ${phasePoles} polo(s) de fase.`);
  if (breaker?.amperage != null && ib !== null && breaker.amperage < ib) issues.push(`In ${breaker.amperage} A abaixo da corrente estimada ${ib.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} A.`);
  if (breaker?.amperage != null && iz !== null && breaker.amperage > iz) issues.push(`In ${breaker.amperage} A acima da capacidade corrigida informada (${iz} A).`);
  if (ib !== null && iz !== null && ib > iz) issues.push(`Ib ${ib.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} A excede Iz ${iz} A; reveja carga, condutor e condições de instalação.`);
  const candidate = ib !== null && iz !== null ? SAMPLE_BREAKER_RATINGS.find(rating => rating >= ib && rating <= iz) ?? null : null;
  return { ib, iz, candidate, issues };
}

/** Scalar sum of known circuit line-current magnitudes: preliminary loading indicator.
 * Two-phase circuits with neutral have no per-phase split, so they are omitted.
 * This deliberately does not calculate neutral current, demand or protection. */
export function phaseBalance(project: Project): { phase: string; current: number; count: number; missing: number }[] {
  return availablePhases(project.supply).map(phase => {
    const circuits = project.circuits.filter(circuit => circuit.phase.split('/').includes(phase));
    const known = circuits.filter(circuit => !hasUnknownPhaseDistribution(circuit));
    return {
      phase,
      current: known.reduce((sum, circuit) => sum + (circuitCurrent(circuit) ?? 0), 0),
      count: circuits.length,
      missing: circuits.length - known.length + known.filter(circuit => circuitCurrent(circuit) === null).length,
    };
  });
}

export function warnings(project: Project): Warning[] {
  const result: Warning[] = [];
  const available = availablePhases(project.supply);
  const connections = new Set(project.wires.flatMap(wire => [`${wire.sourceComponent}:${wire.sourceTerminal}`, `${wire.targetComponent}:${wire.targetTerminal}`]));
  const effectiveConnections = new Set(connections);
  for (const comb of project.devices.filter(device => device.type === 'comb-bus')) {
    const phases = combPhases(comb);
    if (phases.some(phase => phase !== 'N' && !available.includes(phase))) result.push({ id: `comb-supply-${comb.id}`, severity: 'error', deviceId: comb.id, message: `${comb.label}: sequência ${phases.join('/')} usa fase indisponível na alimentação do quadro.` });
    const groups = new Map<string, string[]>();
    for (const device of project.devices) {
      for (const terminal of combCoveredTerminals(comb, device)) {
        const lane = (device.slot - comb.slot + terminal.index) % comb.poles;
        const group = `${terminal.kind}:${lane}`;
        groups.set(group, [...(groups.get(group) ?? []), `${device.id}:${terminal.id}`]);
      }
    }
    for (const covered of groups.values()) if (covered.some(endpoint => connections.has(endpoint))) covered.forEach(endpoint => effectiveConnections.add(endpoint));
    for (const breaker of project.devices.filter(device => device.circuitId && combCoveredTerminals(comb, device).length)) {
      const circuit = project.circuits.find(entry => entry.id === breaker.circuitId);
      if (!circuit) continue;
      const actual = combCoveredTerminals(comb, breaker).map(term => combPhaseAt(comb, breaker.slot - comb.slot + term.index));
      const expected = circuit.phase.split('/').filter(Boolean);
      if (actual.length && (actual.length !== expected.length || actual.some(phase => !expected.includes(phase)))) result.push({ id: `comb-phase-${comb.id}-${circuit.id}`, severity: 'warning', circuitId: circuit.id, deviceId: breaker.id, message: `${comb.label}: os dentes no disjuntor de C${circuit.number} correspondem a ${actual.join('/')} e o circuito está identificado como ${circuit.phase}. Revise posição ou fases.` });
    }
  }
  const allowsUnusedTerminals = new Set(['comb-bus', 'neutral-bus', 'earth-bus', 'power-entry', 'conduit-entry', 'distribution-block']);
  if (project.devices.filter(isRailMounted).reduce((sum, device) => sum + device.modules, 0) > project.rails * project.modulesPerRail) result.push({ id: 'capacity', severity: 'error', message: 'Há mais módulos utilizados que disponíveis.' });
  for (const device of project.devices) {
    if (!fits(project, device)) result.push({ id: `position-${device.id}`, severity: 'error', deviceId: device.id, message: `${device.label || 'Componente'}: fora do trilho ou sobreposto.` });
    if (!device.label.trim()) result.push({ id: `label-${device.id}`, severity: 'warning', deviceId: device.id, message: 'Componente sem identificação.' });
    const disconnected = allowsUnusedTerminals.has(device.type) ? [] : device.terminals.filter(term => !effectiveConnections.has(`${device.id}:${term.id}`));
    if (disconnected.length) result.push({ id: `terminal-${device.id}`, severity: 'info', deviceId: device.id, message: `${device.label}: ${disconnected.length} terminal(is) sem conexão no desenho. Entradas e saídas externas podem ficar abertas.` });
  }
  for (const wire of project.wires) {
    if (wire.gauge === null) result.push({ id: `gauge-${wire.id}`, severity: 'info', wireId: wire.id, message: 'Fio sem seção informada.' });
    if (!wire.path.length) result.push({ id: `route-${wire.id}`, severity: 'error', wireId: wire.id, message: 'Não foi possível traçar este fio. Confira os terminais e a disposição.' });
    const endpoints = [project.devices.find(device => device.id === wire.sourceComponent)?.terminals.find(term => term.id === wire.sourceTerminal), project.devices.find(device => device.id === wire.targetComponent)?.terminals.find(term => term.id === wire.targetTerminal)];
    if (endpoints.some(term => !term)) result.push({ id: `endpoint-${wire.id}`, severity: 'error', wireId: wire.id, message: 'Fio vinculado a um terminal inexistente.' });
    else if (endpoints.some(term => term?.kind === 'PE') && wire.conductorType !== 'earth') result.push({ id: `pe-${wire.id}`, severity: 'error', wireId: wire.id, message: 'Conexão em terminal PE identificada como outro tipo de condutor. Revise a ligação.' });
    else if (endpoints.some(term => term?.kind === 'N') && wire.conductorType !== 'neutral') result.push({ id: `neutral-${wire.id}`, severity: 'error', wireId: wire.id, message: 'Conexão em terminal N identificada como outro tipo de condutor. Revise a ligação.' });
    if (endpoints.some(term => term?.kind === 'N') && endpoints.some(term => term?.kind === 'PE')) result.push({ id: `npe-${wire.id}`, severity: 'error', wireId: wire.id, message: 'Ligação entre neutro e proteção no desenho. Não execute sem verificar o esquema de aterramento e o ponto de separação.' });
    if (wire.sourceComponent === wire.targetComponent) result.push({ id: `bypass-${wire.id}`, severity: 'warning', wireId: wire.id, message: 'Fio interliga terminais do mesmo dispositivo. Confira se há desvio de proteção.' });
  }
  const deviceById = new Map(project.devices.map(device => [device.id, device]));
  const linkedPhaseCounts = new Map<string, number>();
  for (const wire of project.wires) {
    const source = deviceById.get(wire.sourceComponent), target = deviceById.get(wire.targetComponent);
    const output = source?.type === 'conduit-entry' ? { device: source, terminalId: wire.sourceTerminal, other: target } : target?.type === 'conduit-entry' ? { device: target, terminalId: wire.targetTerminal, other: source } : null;
    if (!output || output.device.terminals.find(term => term.id === output.terminalId)?.kind !== 'L') continue;
    const circuit = circuitForOutputTerminal(project, output.terminalId);
    if (circuit && output.other?.id === circuit.breakerId) linkedPhaseCounts.set(circuit.id, (linkedPhaseCounts.get(circuit.id) ?? 0) + 1);
  }
  for (const circuit of project.circuits) {
    if (!circuit.name.trim()) result.push({ id: `circuit-name-${circuit.id}`, severity: 'warning', circuitId: circuit.id, message: `C${circuit.number}: circuito sem identificação.` });
    if (!circuit.breakerId) result.push({ id: `breaker-${circuit.id}`, severity: 'warning', circuitId: circuit.id, message: `C${circuit.number}: sem disjuntor vinculado.` });
    if (!circuit.phase || circuit.phase.split('/').some(phase => !available.includes(phase))) result.push({ id: `phase-${circuit.id}`, severity: 'warning', circuitId: circuit.id, message: `C${circuit.number}: fase não definida ou indisponível nesta alimentação.` });
    if (circuit.load === null) result.push({ id: `load-${circuit.id}`, severity: 'info', circuitId: circuit.id, message: `C${circuit.number}: informe carga para estimar corrente. O disjuntor não representa a carga.` });
    if (circuit.load !== null && needsLineCurrent(circuit)) result.push({ id: `load-basis-${circuit.id}`, severity: 'warning', circuitId: circuit.id, message: `C${circuit.number}: a potência total em W não determina a corrente de cada fase com neutro. Informe em A a corrente da fase mais carregada ou separe as cargas por fase.` });
    if (circuit.cableGauge === null) result.push({ id: `cable-${circuit.id}`, severity: 'info', circuitId: circuit.id, message: `C${circuit.number}: seção do cabo não informada.` });
    const breaker = deviceById.get(circuit.breakerId ?? '');
    if (breaker) {
      const phases = circuit.phase.split('/').filter(Boolean).length;
      const phasePoles = breaker.terminals.filter(term => term.side === 'bottom' && term.kind === 'L').length;
      if (phasePoles !== phases) result.push({ id: `breaker-phase-${circuit.id}`, severity: 'warning', circuitId: circuit.id, deviceId: breaker.id, message: `C${circuit.number}: o disjuntor vinculado dispõe de ${phasePoles} polo(s) de fase para ${phases} fase(s). Revise a proteção multipolar.` });
      const linkedPhases = linkedPhaseCounts.get(circuit.id) ?? 0;
      if (linkedPhases < phases) result.push({ id: `breaker-wires-${circuit.id}`, severity: 'warning', circuitId: circuit.id, deviceId: breaker.id, message: `C${circuit.number}: ${phases - linkedPhases} fase(s) ainda sem ligação desenhada ao disjuntor vinculado.` });
    }
    const protection = protectionCheck(circuit, breaker);
    for (const [index, message] of protection.issues.entries()) result.push({ id: `protection-${circuit.id}-${index}`, severity: 'warning', circuitId: circuit.id, deviceId: breaker?.id, message: `C${circuit.number}: ${message} ${protection.candidate ? `Exemplo preliminar na faixa Ib–Iz: ${protection.candidate} A; confirme os demais critérios.` : 'Revise os dados e a proteção.'}` });
  }
  return result;
}

export function materialList(project: Project): Material[] {
  const generated: Material[] = [{ id: 'generated-enclosure', name: 'Quadro de distribuição', specification: `${project.rails * project.modulesPerRail} módulos · ${project.rails} trilhos · ${project.widthMm} × ${project.heightMm} mm`, quantity: 1, unit: 'un' }];
  const groups = new Map<string, Material>();
  for (const device of project.devices) {
    const catalog = CATALOG.find(item => item.type === device.type);
    const characteristics = [
      device.type === 'comb-bus' ? `${device.modules} encaixes` : device.type === 'neutral-bus' || device.type === 'earth-bus' ? `${device.poles} bornes` : `${device.modules} módulos`,
      device.type === 'comb-bus' ? ({ 1: 'monofásico', 2: 'bifásico', 3: 'trifásico', 4: 'tetrapolar' } as Record<number, string>)[device.poles] : device.type === 'neutral-bus' || device.type === 'earth-bus' ? '' : `${device.poles} polos/pontos`,
      device.amperage === null ? 'corrente a definir' : `${device.amperage} A`,
      device.type.includes('breaker') ? `curva ${device.curve}` : '',
      device.type.startsWith('rcd-') ? device.sensitivity > 0 ? `${device.sensitivity} mA` : 'sensibilidade a definir' : '',
      device.voltage > 0 ? `${device.voltage} V` : '',
      device.type === 'spd' ? device.surgeCurrent > 0 ? `${device.surgeCurrent} kA` : 'corrente de surto a definir' : '',
      device.description,
    ].filter(Boolean).join(' · ');
    const key = JSON.stringify([device.type, characteristics]);
    const group = groups.get(key);
    if (group) group.quantity++;
    else groups.set(key, { id: `generated-${device.id}`, name: catalog?.name ?? device.label, specification: characteristics, quantity: 1, unit: 'un' });
  }
  generated.push(...groups.values());
  // Canvas units are not cable lengths. Count connections and leave meters for manual entry.
  const conductors = new Map<string, Material>();
  for (const wire of project.wires) {
    const key = `${wire.conductorType}-${wire.color}-${wire.gauge ?? '?'}`;
    const existing = conductors.get(key);
    if (existing) existing.quantity++;
    else conductors.set(key, { id: `generated-wire-${wire.id}`, name: `Condutor ${({ phase: 'de fase', neutral: 'neutro', earth: 'PE', return: 'de retorno' })[wire.conductorType]}`, specification: `${wire.gauge === null ? 'Seção a definir' : `${wire.gauge} mm²`} · ${wire.color} · comprimento a medir`, quantity: 1, unit: 'ligação' });
  }
  return [...generated, ...conductors.values(), ...project.materials.map(material => ({ ...material }))];
}
