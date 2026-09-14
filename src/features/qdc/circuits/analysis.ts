import { CATALOG } from '../electrical-components/catalog.ts';
import { fits } from '../editor/operations.ts';
import { isRailMounted } from '../wiring/routing.ts';
import type { Circuit, Material, Project, Supply, Warning } from '../types.ts';

export function availablePhases(supply: Supply): string[] {
  return supply === 'tri' ? ['R', 'S', 'T'] : supply === 'bi' ? ['R', 'S'] : ['R'];
}

/** W is total active input power; V is circuit voltage (line-line for 2/3 phases).
 * Three-phase input assumes a balanced load. A is already line current.
 * Neither breaker rating nor installed protective-device settings are load inputs. */
export function circuitCurrent(circuit: Circuit): number | null {
  if (circuit.load === null || !Number.isFinite(circuit.load) || circuit.load < 0) return null;
  if (circuit.loadUnit === 'A') return circuit.load;
  if (!Number.isFinite(circuit.voltage) || circuit.voltage <= 0 || !Number.isFinite(circuit.powerFactor) || circuit.powerFactor <= 0 || circuit.powerFactor > 1) return null;
  const phases = circuit.phase.split('/').filter(Boolean);
  if (!phases.length || new Set(phases).size !== phases.length || phases.some(phase => !['R', 'S', 'T'].includes(phase))) return null;
  return circuit.load / (circuit.voltage * circuit.powerFactor * (phases.length === 3 ? Math.sqrt(3) : 1));
}

/** Scalar sum of circuit line-current magnitudes: preliminary loading indicator.
 * Mixed phase-neutral/phase-phase loads require phasor analysis for actual totals.
 * This deliberately does not calculate neutral current, demand or protection. */
export function phaseBalance(project: Project): { phase: string; current: number; count: number; missing: number }[] {
  return availablePhases(project.supply).map(phase => {
    const circuits = project.circuits.filter(circuit => circuit.phase.split('/').includes(phase));
    return {
      phase,
      current: circuits.reduce((sum, circuit) => sum + (circuitCurrent(circuit) ?? 0), 0),
      count: circuits.length,
      missing: circuits.filter(circuit => circuitCurrent(circuit) === null).length,
    };
  });
}

export function warnings(project: Project): Warning[] {
  const result: Warning[] = [];
  const available = availablePhases(project.supply);
  const connections = new Set(project.wires.flatMap(wire => [`${wire.sourceComponent}:${wire.sourceTerminal}`, `${wire.targetComponent}:${wire.targetTerminal}`]));
  if (project.devices.filter(isRailMounted).reduce((sum, device) => sum + device.modules, 0) > project.rails * project.modulesPerRail) result.push({ id: 'capacity', message: 'Há mais módulos utilizados que disponíveis.' });
  for (const device of project.devices) {
    if (!fits(project, device)) result.push({ id: `position-${device.id}`, deviceId: device.id, message: `${device.label || 'Componente'}: fora do trilho ou sobreposto.` });
    if (!device.label.trim()) result.push({ id: `label-${device.id}`, deviceId: device.id, message: 'Componente sem identificação.' });
    const disconnected = device.type === 'comb-bus' ? [] : device.terminals.filter(term => !connections.has(`${device.id}:${term.id}`));
    if (disconnected.length) result.push({ id: `terminal-${device.id}`, deviceId: device.id, message: `${device.label}: ${disconnected.length} terminal(is) sem conexão no desenho. Entradas e saídas externas podem ficar abertas.` });
  }
  for (const wire of project.wires) {
    if (wire.gauge === null) result.push({ id: `gauge-${wire.id}`, wireId: wire.id, message: 'Fio sem seção informada.' });
    if (!wire.path.length) result.push({ id: `route-${wire.id}`, wireId: wire.id, message: 'Não foi possível traçar este fio. Confira os terminais e a disposição.' });
    const endpoints = [project.devices.find(device => device.id === wire.sourceComponent)?.terminals.find(term => term.id === wire.sourceTerminal), project.devices.find(device => device.id === wire.targetComponent)?.terminals.find(term => term.id === wire.targetTerminal)];
    if (endpoints.some(term => !term)) result.push({ id: `endpoint-${wire.id}`, wireId: wire.id, message: 'Fio vinculado a um terminal inexistente.' });
    else if (endpoints.some(term => term?.kind === 'PE') && wire.conductorType !== 'earth') result.push({ id: `pe-${wire.id}`, wireId: wire.id, message: 'Conexão em terminal PE identificada como outro tipo de condutor. Revise a ligação.' });
    else if (endpoints.some(term => term?.kind === 'N') && wire.conductorType !== 'neutral') result.push({ id: `neutral-${wire.id}`, wireId: wire.id, message: 'Conexão em terminal N identificada como outro tipo de condutor. Revise a ligação.' });
    if (endpoints.some(term => term?.kind === 'N') && endpoints.some(term => term?.kind === 'PE')) result.push({ id: `npe-${wire.id}`, wireId: wire.id, message: 'Ligação entre neutro e proteção no desenho. Não execute sem verificar o esquema de aterramento e o ponto de separação.' });
    if (wire.sourceComponent === wire.targetComponent) result.push({ id: `bypass-${wire.id}`, wireId: wire.id, message: 'Fio interliga terminais do mesmo dispositivo. Confira se há desvio de proteção.' });
  }
  for (const circuit of project.circuits) {
    if (!circuit.name.trim()) result.push({ id: `circuit-name-${circuit.id}`, message: `C${circuit.number}: circuito sem identificação.` });
    if (!circuit.breakerId) result.push({ id: `breaker-${circuit.id}`, message: `C${circuit.number}: sem disjuntor vinculado.` });
    if (!circuit.phase || circuit.phase.split('/').some(phase => !available.includes(phase))) result.push({ id: `phase-${circuit.id}`, message: `C${circuit.number}: fase não definida ou indisponível nesta alimentação.` });
    if (circuit.load === null) result.push({ id: `load-${circuit.id}`, message: `C${circuit.number}: informe carga para estimar corrente. O disjuntor não representa a carga.` });
    if (circuit.cableGauge === null) result.push({ id: `cable-${circuit.id}`, message: `C${circuit.number}: seção do cabo não informada.` });
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
      device.type === 'comb-bus' ? ({ 1: 'unipolar', 2: 'bipolar', 4: 'tetrapolar' } as Record<number, string>)[device.poles] : device.type === 'neutral-bus' || device.type === 'earth-bus' ? '' : `${device.poles} polos/pontos`,
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
