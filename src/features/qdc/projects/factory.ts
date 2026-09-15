import { quadroValido } from '../../../utils/quadros.ts';
import { buildTerminals, createDevice } from '../electrical-components/catalog.ts';
import { connect, firstSpace, validateProject } from '../editor/operations.ts';
import { routeWires } from '../wiring/routing.ts';
import type { Circuit, Device, Project, Wire } from '../types.ts';

export function emptyProject(config: Partial<Project> = {}): Project {
  const now = new Date().toISOString();
  const project: Project = { version: 2, id: crypto.randomUUID(), name: 'Novo QDC', client: '', supply: 'mono', voltage: 127,
    rails: 2, modulesPerRail: 12, widthMm: 360, heightMm: 420,
    devices: [], wires: [], circuits: [], materials: [], createdAt: now, updatedAt: now, ...config };
  if (!validateProject(project)) throw new Error('Configuração de quadro inválida. Revise alimentação, dimensões e módulos.');
  return structuredClone(project);
}

function place(project: Project, device: Device): Project {
  const position = firstSpace(project, device.modules);
  if (!position) throw new Error('O quadro escolhido não comporta todos os componentes. Selecione mais módulos ou trilhos.');
  return { ...project, devices: [...project.devices, { ...device, ...position }] };
}

function circuit(number: number, name: string, project: Project, breaker: Device, dr: Device, phase: string): Circuit {
  return { id: crypto.randomUUID(), number, name, phase, breakerId: breaker.id, cableGauge: null,
    load: null, loadUnit: 'W', voltage: project.voltage, powerFactor: 1, drId: dr.id,
    notes: 'Proposta visual. Carga, fator de potência, condutores e proteção a verificar.', color: '#20252b' };
}

export function automaticProject(config: Partial<Project>, names: string[]): Project {
  if (names.length > 100) throw new Error('Use até 100 circuitos por proposta.');
  let project = emptyProject({ ...config, devices: [], wires: [], circuits: [], materials: [] });
  const count = project.supply === 'tri' ? 3 : project.supply === 'bi' ? 2 : 1;
  let general = createDevice('main-breaker');
  general = { ...general, poles: count, modules: count, terminals: buildTerminals(general.type, count), label: 'Geral' };
  const dr = { ...createDevice(count > 1 ? 'rcd-4p' : 'rcd-2p'), label: 'DR · seleção a definir' };
  const neutral = { ...createDevice('neutral-bus'), label: 'Neutro após DR' };
  const earth = { ...createDevice('earth-bus'), label: 'Proteção PE' };
  const powerEntry = { ...createDevice('power-entry'), label: 'Entrada da rede', poles: count + 2, terminals: buildTerminals('power-entry', count + 2), edgeSide: 'top' as const, edgeOffset: 88 };
  project.devices = [...project.devices, powerEntry];
  project = place(project, general);
  const spds: Device[] = [];
  for (let i = 0; i < count; i++) {
    const spd = { ...createDevice('spd'), label: `DPS ${['R', 'S', 'T'][i]}` };
    spds.push(spd); project = place(project, spd);
  }
  for (const device of [dr, neutral, earth]) project = place(project, device);
  for (const [index, name] of names.entries()) {
    const breaker = { ...createDevice('breaker-1p'), label: name.trim() || 'Novo circuito' };
    const phase = ['R', 'S', 'T'][index % count];
    const entry = circuit(index + 1, name.trim(), project, breaker, dr, phase);
    project = place(project, { ...breaker, circuitId: entry.id });
    project.circuits = [...project.circuits, entry];
  }
  let phaseComb: Device | null = null;
  if (count === 1 && names.length > 1) {
    const breakers = project.devices.filter(device => device.type === 'breaker-1p' && device.circuitId);
    const comb = createDevice('comb-bus');
    phaseComb = { ...comb, label: 'Barramento pente', poles: 1, amperage: 63, rail: breakers[0].rail, slot: breakers[0].slot, modules: breakers.length, terminals: [] };
    project.devices = [...project.devices, phaseComb];
  }
  const phaseOptions = { conductorType: 'phase' as const, color: '#20252b', gauge: null, termination: 'tubular' as const };
  const neutralOptions = { conductorType: 'neutral' as const, color: '#1686cf', gauge: null, termination: 'tubular' as const };
  const earthOptions = { conductorType: 'earth' as const, color: '#27854c', gauge: null, termination: 'tubular' as const };
  const endpoint = (device: Device, terminalId: string) => ({ componentId: device.id, terminalId });
  for (let i = 0; i < count; i++) {
    project = connect(project, endpoint(powerEntry, `edge-${i}`), endpoint(general, `top-${i}`), phaseOptions);
    project = connect(project, endpoint(general, `bottom-${i}`), endpoint(dr, `top-${i}`), phaseOptions);
    project = connect(project, endpoint(general, `bottom-${i}`), endpoint(spds[i], 'top-0'), phaseOptions);
    project = connect(project, endpoint(spds[i], 'bottom-0'), endpoint(earth, `side-${i}`), earthOptions);
  }
  const neutralIndex = dr.poles - 1;
  project = connect(project, endpoint(powerEntry, `edge-${count}`), endpoint(dr, `top-${neutralIndex}`), neutralOptions);
  project = connect(project, endpoint(powerEntry, `edge-${count + 1}`), endpoint(earth, `side-${count}`), earthOptions);
  project = connect(project, endpoint(dr, `bottom-${neutralIndex}`), endpoint(neutral, 'side-0'), neutralOptions);
  for (const [index, entry] of project.circuits.entries()) {
    const device = project.devices.find(item => item.id === entry.breakerId)!;
    const phaseIndex = ['R', 'S', 'T'].indexOf(entry.phase);
    if (!phaseComb || index === 0) project = connect(project, endpoint(dr, `bottom-${phaseIndex}`), endpoint(device, 'top-0'), phaseOptions);
  }
  return routeWires(project);
}

export function demoProject(): Project {
  // The requested 220 V single-phase scene assumes phase-neutral 220 V supply.
  // Device ratings intentionally remain unknown: the demo is not a sizing example.
  const project = automaticProject({ name: 'QDC Residencial — Monofásico 220 V · Demonstração', supply: 'mono', voltage: 220, rails: 2, modulesPerRail: 12 }, ['Iluminação', 'Tomadas', 'Cozinha', 'Chuveiro', 'Ar-condicionado']);
  return { ...project, circuits: project.circuits.map(entry => ({ ...entry, notes: 'Cenário fictício fase-neutro 220 V. Valores elétricos a definir; não dimensionado.' })) };
}

/** Keep the original legacy snapshot untouched; migrate only structurally valid input. */
export function migrateLegacy(value: unknown): Project | null {
  if (!quadroValido(value)) return null;
  const mapping: Record<string, string> = { 'Disjuntor 1P': 'breaker-1p', 'Disjuntor 2P': 'breaker-2p', 'Disjuntor 3P': 'breaker-3p', 'DR 2P': 'rcd-2p', 'DR 4P': 'rcd-4p', DPS: 'spd', Contator: 'contactor', 'Outro componente': 'terminal' };
  let project = emptyProject({ id: value.id, name: value.nome, client: value.cliente, rails: value.trilhos, modulesPerRail: value.modulosPorTrilho });
  const circuits: Circuit[] = [];
  const devices = value.componentes.map(old => {
    const type = mapping[old.tipo] ?? 'terminal';
    const item = createDevice(type);
    const poles = old.bornes ?? Number(old.tipo.match(/(\d)P/)?.[1] ?? item.poles);
    const device = { ...item, id: old.id, label: old.circuito || old.tipo, description: old.descricao, rail: old.trilho, slot: old.inicio, modules: old.modulos, poles, terminals: buildTerminals(type, poles) };
    if (old.circuito && type.startsWith('breaker-')) {
      const id = crypto.randomUUID();
      device.circuitId = id;
      circuits.push({ id, number: circuits.length + 1, name: old.circuito, phase: '', breakerId: device.id, cableGauge: null, load: null, loadUnit: 'W', voltage: project.voltage, powerFactor: 1, drId: null, notes: 'Importado do montador anterior; alimentação e características a confirmar.', color: device.color });
    }
    return device;
  });
  project = { ...project, devices, circuits };
  for (const [flag, id, type] of [[value.barramentoN, '@N', 'neutral-bus'], [value.barramentoPE, '@PE', 'earth-bus']] as const) {
    if (!flag) continue;
    let bus = { ...createDevice(type), id, poles: 10, terminals: buildTerminals(type, 10) };
    let position = firstSpace(project, bus.modules);
    if (!position && project.rails < 12) { project = { ...project, rails: project.rails + 1 }; position = firstSpace(project, bus.modules); }
    if (!position) return null;
    bus = { ...bus, ...position }; project.devices = [...project.devices, bus];
  }
  const wires: Wire[] = (value.fios ?? []).map(old => ({
    id: old.id, sourceComponent: old.origem.componente, sourceTerminal: `${old.origem.lado === 'superior' ? 'top' : 'bottom'}-${old.origem.numero}`,
    targetComponent: old.destino.componente, targetTerminal: `${old.destino.lado === 'superior' ? 'top' : 'bottom'}-${old.destino.numero}`,
    conductorType: old.cor === '#1686cf' ? 'neutral' : old.cor === '#27854c' ? 'earth' : 'phase',
    color: old.cor, gauge: null, label: old.identificacao, path: [], sourceTermination: 'tubular', targetTermination: 'tubular',
  }));
  for (const wire of wires) {
    if ((wire.targetComponent === '@N' || wire.targetComponent === '@PE') && wire.targetTerminal.startsWith('top-')) wire.targetTerminal = wire.targetTerminal.replace('top-', 'side-');
    if ((wire.sourceComponent === '@N' || wire.sourceComponent === '@PE') && wire.sourceTerminal.startsWith('top-')) wire.sourceTerminal = wire.sourceTerminal.replace('top-', 'side-');
  }
  project = routeWires({ ...project, wires });
  return validateProject(project) ? project : null;
}
