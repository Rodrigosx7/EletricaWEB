import { quadroValido } from '../../../utils/quadros.ts';
import { buildTerminals, createDevice } from '../electrical-components/catalog.ts';
import { connectMany, firstSpace, fits, validateProject, type ConnectionRequest } from '../editor/operations.ts';
import { boardSize, deviceRect, routeWires } from '../wiring/routing.ts';
import type { Circuit, Device, Project, Supply, Wire } from '../types.ts';

const BUS_TERMINALS = 24;
const MIN_CIRCUITS_PER_OUTPUT = 4;
const OUTPUT_GAP = 8;

function busCount(fixedConnections: number, circuitCount: number): number {
  let count = 1;
  while (fixedConnections + circuitCount + 2 * (count - 1) > BUS_TERMINALS * count) count++;
  return count;
}

function automaticBusCounts(supply: Supply, circuitCount: number) {
  const phases = supply === 'tri' ? 3 : supply === 'bi' ? 2 : 1;
  return { neutral: busCount(1, circuitCount), earth: busCount(phases + 1, circuitCount) };
}

export function emptyProject(config: Partial<Project> = {}): Project {
  const now = new Date().toISOString();
  const project: Project = { version: 2, id: crypto.randomUUID(), name: 'Novo QDC', client: '', supply: 'mono', voltage: 127,
    rails: 2, modulesPerRail: 12, widthMm: 360, heightMm: 420,
    visualModel: 'classic', dpsVisual: 'standard',
    devices: [], wires: [], circuits: [], materials: [], createdAt: now, updatedAt: now, ...config };
  if (!validateProject(project)) throw new Error('Configuração de quadro inválida. Revise alimentação, dimensões e módulos.');
  return structuredClone(project);
}

export function automaticRequiredModules(supply: Supply, circuitCount: number): number {
  const phases = supply === 'tri' ? 3 : supply === 'bi' ? 2 : 1;
  const residualCurrentModules = phases > 1 ? 4 : 2;
  const circuits = Math.max(0, circuitCount);
  const buses = automaticBusCounts(supply, circuits);
  return phases + phases + residualCurrentModules + buses.neutral + buses.earth + circuits;
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
  const requiredModules = automaticRequiredModules(project.supply, names.length);
  const availableModules = project.rails * project.modulesPerRail;
  if (requiredModules > availableModules) throw new Error(`O quadro escolhido não comporta a proposta: são necessários ${requiredModules} módulos DIN e há ${availableModules}.`);
  const count = project.supply === 'tri' ? 3 : project.supply === 'bi' ? 2 : 1;
  let general = createDevice('main-breaker');
  general = { ...general, poles: count, modules: count, terminals: buildTerminals(general.type, count), label: 'Geral' };
  const dr = { ...createDevice(count > 1 ? 'rcd-4p' : 'rcd-2p'), label: 'DR · seleção a definir' };
  const powerEntry = { ...createDevice('power-entry'), label: 'Entrada da rede', poles: count + 2, terminals: buildTerminals('power-entry', count + 2), edgeSide: 'top' as const, edgeOffset: 88 };
  const busCounts = automaticBusCounts(project.supply, names.length);
  if (project.rails < Math.max(busCounts.neutral, busCounts.earth)) throw new Error(`Esta proposta precisa de pelo menos ${Math.max(busCounts.neutral, busCounts.earth)} trilhos para distribuir os barramentos laterais.`);
  const makeBuses = (type: 'neutral-bus' | 'earth-bus', amount: number) => Array.from({ length: amount }, (_, index) => {
    const poles = amount === 1 ? Math.max(8, names.length + (type === 'neutral-bus' ? 1 : count + 1)) : BUS_TERMINALS;
    const base = createDevice(type);
    return {
      ...base,
      label: type === 'neutral-bus' ? amount === 1 ? 'Neutro após DR' : `Neutro ${index + 1}` : amount === 1 ? 'Proteção PE' : `Proteção PE ${index + 1}`,
      poles,
      terminals: buildTerminals(type, poles),
      rail: project.rails - 1 - index,
      slot: type === 'neutral-bus' ? 0 : project.modulesPerRail - base.modules,
      busTerminalSide: type === 'neutral-bus' ? 'left' as const : 'right' as const,
    };
  });
  const neutralBuses = makeBuses('neutral-bus', busCounts.neutral);
  const earthBuses = makeBuses('earth-bus', busCounts.earth);
  project.devices = [...project.devices, powerEntry, ...neutralBuses, ...earthBuses];
  if (![...neutralBuses, ...earthBuses].every(device => fits(project, device))) throw new Error('O quadro escolhido não comporta os barramentos de neutro e terra nas laterais dos trilhos.');
  project = place(project, general);
  const spds: Device[] = [];
  for (let i = 0; i < count; i++) {
    const spd = { ...createDevice('spd'), label: `DPS ${['R', 'S', 'T'][i]}` };
    spds.push(spd); project = place(project, spd);
  }
  project = place(project, dr);
  for (const [index, name] of names.entries()) {
    const breaker = { ...createDevice('breaker-1p'), label: name.trim() || 'Novo circuito' };
    const phase = ['R', 'S', 'T'][index % count];
    const entry = circuit(index + 1, name.trim(), project, breaker, dr, phase);
    project = place(project, { ...breaker, circuitId: entry.id });
    project.circuits = [...project.circuits, entry];
  }
  const size = boardSize(project);
  const outputWidth = deviceRect({ ...createDevice('conduit-entry'), poles: 12 }, project).width;
  const maxOutputGroups = Math.max(1, Math.floor((size.width - 84 + OUTPUT_GAP) / (outputWidth + OUTPUT_GAP)));
  const circuitsPerOutput = Math.max(MIN_CIRCUITS_PER_OUTPUT, Math.ceil(project.circuits.length / maxOutputGroups));
  const outputGroups = Array.from({ length: Math.ceil(project.circuits.length / circuitsPerOutput) }, (_, index) => project.circuits.slice(index * circuitsPerOutput, (index + 1) * circuitsPerOutput));
  const circuitOutputs = new Map<string, { device: Device; phase: string; neutral: string; earth: string }>();
  const outputDrafts = outputGroups.map(group => {
    const terminals: Device['terminals'] = group.flatMap((entry, index) => [
      { id: `c${entry.number}-l`, label: `C${entry.number} L`, side: 'bottom' as const, index: index * 3, kind: 'L' as const },
      { id: `c${entry.number}-n`, label: `C${entry.number} N`, side: 'bottom' as const, index: index * 3 + 1, kind: 'N' as const },
      { id: `c${entry.number}-pe`, label: `C${entry.number} PE`, side: 'bottom' as const, index: index * 3 + 2, kind: 'PE' as const },
    ]);
    const first = group[0].number, last = group.at(-1)!.number;
    const breakerCenters = group.map(entry => {
      const breaker = project.devices.find(device => device.id === entry.breakerId)!;
      const rect = deviceRect(breaker, project);
      return rect.x + rect.width / 2;
    });
    const groupCenter = breakerCenters.reduce((sum, value) => sum + value, 0) / breakerCenters.length;
    const output: Device = {
      ...createDevice('conduit-entry'),
      label: first === last ? `Saída C${first}` : `Saída C${first}–C${last}`,
      poles: terminals.length,
      terminals,
      edgeSide: 'bottom',
      edgeOffset: 50,
    };
    return { group, output, desiredCenter: groupCenter, width: deviceRect(output, project).width, center: groupCenter };
  });
  const positionedOutputs = [...outputDrafts].sort((a, b) => a.desiredCenter - b.desiredCenter);
  const minCenter = 42 + (size.width - 84) * .05;
  const maxCenter = 42 + (size.width - 84) * .95;
  positionedOutputs.forEach((draft, index) => {
    const previous = positionedOutputs[index - 1];
    const leftLimit = previous ? previous.center + previous.width / 2 + OUTPUT_GAP + draft.width / 2 : minCenter;
    draft.center = Math.max(leftLimit, Math.min(maxCenter, draft.desiredCenter));
  });
  for (let index = positionedOutputs.length - 1; index >= 0; index--) {
    const draft = positionedOutputs[index], next = positionedOutputs[index + 1];
    const rightLimit = next ? next.center - next.width / 2 - OUTPUT_GAP - draft.width / 2 : maxCenter;
    draft.center = Math.min(draft.center, rightLimit);
  }
  for (const draft of outputDrafts) {
    const output = { ...draft.output, edgeOffset: (draft.center - 42) / (size.width - 84) * 100 };
    project.devices = [...project.devices, output];
    for (const entry of draft.group) circuitOutputs.set(entry.id, { device: output, phase: `c${entry.number}-l`, neutral: `c${entry.number}-n`, earth: `c${entry.number}-pe` });
  }
  const breakerRuns: Device[][] = [];
  const breakers = project.devices.filter(device => device.type === 'breaker-1p' && device.circuitId).sort((a, b) => a.rail - b.rail || a.slot - b.slot);
  for (const breaker of breakers) {
    const run = breakerRuns.at(-1), previous = run?.at(-1);
    if (run && previous && previous.rail === breaker.rail && previous.slot + previous.modules === breaker.slot) run.push(breaker);
    else breakerRuns.push([breaker]);
  }
  if (count === 1) for (const run of breakerRuns.filter(group => group.length > 1)) {
    const comb = createDevice('comb-bus');
    const last = run.at(-1)!;
    const phaseComb = { ...comb, label: 'Barramento pente', poles: 1, amperage: 63, rail: run[0].rail, slot: run[0].slot, modules: last.slot + last.modules - run[0].slot, combSide: 'bottom' as const, terminals: [] };
    if (!fits(project, phaseComb)) throw new Error('Não foi possível posicionar o barramento pente dentro do trilho.');
    project.devices = [...project.devices, phaseComb];
  }
  const phaseOptions = { conductorType: 'phase' as const, color: '#20252b', gauge: null, termination: 'tubular' as const };
  const neutralOptions = { conductorType: 'neutral' as const, color: '#1686cf', gauge: null, termination: 'tubular' as const };
  const earthOptions = { conductorType: 'earth' as const, color: '#27854c', gauge: null, termination: 'tubular' as const };
  const endpoint = (device: Device, terminalId: string) => ({ componentId: device.id, terminalId });
  const connections: ConnectionRequest[] = [];
  const neutralCursors = neutralBuses.map(() => 0), earthCursors = earthBuses.map(() => 0);
  const takeOnBus = (buses: Device[], cursors: number[], index: number) => {
    const terminal = buses[index]?.terminals[cursors[index]++];
    if (!terminal) throw new Error('Não há bornes suficientes para completar a proposta automática.');
    return endpoint(buses[index], terminal.id);
  };
  const takeAvailable = (buses: Device[], cursors: number[]) => {
    const index = cursors.findIndex((cursor, busIndex) => cursor < buses[busIndex].terminals.length);
    if (index < 0) throw new Error('Não há bornes suficientes para completar as saídas dos circuitos.');
    return takeOnBus(buses, cursors, index);
  };
  for (let i = 0; i < count; i++) {
    connections.push(
      { source: endpoint(powerEntry, `edge-${i}`), target: endpoint(general, `top-${i}`), options: phaseOptions },
      { source: endpoint(general, `bottom-${i}`), target: endpoint(dr, `top-${i}`), options: phaseOptions },
      { source: endpoint(general, `bottom-${i}`), target: endpoint(spds[i], 'top-0'), options: phaseOptions },
      { source: endpoint(spds[i], 'bottom-0'), target: takeOnBus(earthBuses, earthCursors, 0), options: earthOptions },
    );
  }
  const neutralIndex = dr.poles - 1;
  connections.push(
    { source: endpoint(powerEntry, `edge-${count}`), target: endpoint(dr, `top-${neutralIndex}`), options: neutralOptions },
    { source: endpoint(powerEntry, `edge-${count + 1}`), target: takeOnBus(earthBuses, earthCursors, 0), options: earthOptions },
    { source: endpoint(dr, `bottom-${neutralIndex}`), target: takeOnBus(neutralBuses, neutralCursors, 0), options: neutralOptions },
  );
  for (let index = 0; index < neutralBuses.length - 1; index++) connections.push({ source: takeOnBus(neutralBuses, neutralCursors, index), target: takeOnBus(neutralBuses, neutralCursors, index + 1), options: neutralOptions, label: 'Interligação N' });
  for (let index = 0; index < earthBuses.length - 1; index++) connections.push({ source: takeOnBus(earthBuses, earthCursors, index), target: takeOnBus(earthBuses, earthCursors, index + 1), options: earthOptions, label: 'Interligação PE' });
  const combStarts = new Set(breakerRuns.filter(run => count === 1 && run.length > 1).map(run => run[0].id));
  const combCovered = new Set(breakerRuns.filter(run => count === 1 && run.length > 1).flatMap(run => run.map(device => device.id)));
  for (const entry of project.circuits) {
    const device = project.devices.find(item => item.id === entry.breakerId)!;
    const phaseIndex = ['R', 'S', 'T'].indexOf(entry.phase);
    if (!combCovered.has(device.id) || combStarts.has(device.id)) connections.push({ source: endpoint(dr, `bottom-${phaseIndex}`), target: endpoint(device, 'top-0'), options: phaseOptions });
    const output = circuitOutputs.get(entry.id)!;
    const circuitPhase = { ...phaseOptions, color: entry.color, gauge: entry.cableGauge };
    const circuitNeutral = { ...neutralOptions, gauge: entry.cableGauge };
    const circuitEarth = { ...earthOptions, gauge: entry.cableGauge };
    connections.push(
      { source: endpoint(device, 'bottom-0'), target: endpoint(output.device, output.phase), options: circuitPhase, label: `C${entry.number} fase` },
      { source: takeAvailable(neutralBuses, neutralCursors), target: endpoint(output.device, output.neutral), options: circuitNeutral, label: `C${entry.number} neutro` },
      { source: takeAvailable(earthBuses, earthCursors), target: endpoint(output.device, output.earth), options: circuitEarth, label: `C${entry.number} PE` },
    );
  }
  return connectMany(project, connections);
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
