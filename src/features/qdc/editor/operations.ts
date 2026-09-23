import { CATALOG, DPS_MODELS, buildSpdTerminals, buildTerminals, createDevice } from '../electrical-components/catalog.ts';
import { GENERIC_DIN_2P, technicalModel } from '../electrical-components/technicalCatalog.ts';
import { boardSize, deviceMount, deviceRect, isRailMounted, pathAvoidsDevices, routeWires } from '../wiring/routing.ts';
import type { Circuit, Conductor, Device, Project, Selection, Terminal, WireOptions, WireTermination } from '../types.ts';

export type Endpoint = { componentId: string; terminalId: string };
export type ConnectionRequest = { source: Endpoint; target: Endpoint; options: WireOptions; label?: string };
const isBreaker = (type: string) => type.startsWith('breaker-') || type === 'main-breaker' || type.startsWith('rcbo-') || type.startsWith('motor-breaker-');
const isRcd = (type: string) => type.startsWith('rcd-') || type.startsWith('rcbo-');
const isCircuitBreaker = (type: string) => isBreaker(type) && type !== 'main-breaker';
const stamp = (project: Project) => routeWires({ ...project, updatedAt: new Date().toISOString() });
const terminations: WireTermination[] = ['tubular', 'generico', 'pente', 'olhal', 'garfo', 'pino', 'sem-terminal'];

function endpointTerminal(project: Project, endpoint: Endpoint): Terminal | undefined {
  return project.devices.find(device => device.id === endpoint.componentId)?.terminals.find(terminal => terminal.id === endpoint.terminalId);
}

export function conductorFitsTerminal(conductor: Conductor, terminal: Terminal): boolean {
  if (terminal.kind === 'N') return conductor === 'neutral';
  if (terminal.kind === 'PE') return conductor === 'earth';
  if (terminal.kind === 'L') return conductor === 'phase' || conductor === 'return';
  return true;
}

function compatibleEndpoints(project: Project, source: Endpoint, target: Endpoint, conductor: Conductor): boolean {
  const terminals = [endpointTerminal(project, source), endpointTerminal(project, target)];
  return terminals.every(terminal => terminal && conductorFitsTerminal(conductor, terminal));
}

export function connectionIssue(project: Project, source: Endpoint, target: Endpoint, conductor: Conductor): string | null {
  if (!validEndpoint(project, source) || !validEndpoint(project, target)) return 'Escolha terminais existentes para conectar.';
  if (source.componentId === target.componentId && source.terminalId === target.terminalId) return 'Escolha outro terminal para concluir o fio.';
  if (!compatibleEndpoints(project, source, target, conductor)) return 'O tipo de condutor não é compatível com este terminal. Use fase/retorno em L, neutro em N e proteção em PE.';
  const duplicate = project.wires.some(wire =>
    (wire.sourceComponent === source.componentId && wire.sourceTerminal === source.terminalId && wire.targetComponent === target.componentId && wire.targetTerminal === target.terminalId)
    || (wire.sourceComponent === target.componentId && wire.sourceTerminal === target.terminalId && wire.targetComponent === source.componentId && wire.targetTerminal === source.terminalId));
  return duplicate ? 'Esses terminais já estão conectados.' : null;
}

export function fits(project: Project, device: Device): boolean {
  if (!Number.isInteger(device.modules) || device.modules < 1) return false;
  const mount = deviceMount(device);
  if (mount === 'edge') {
    if (!device.canvasPosition) return ['top', 'bottom', 'left', 'right'].includes(device.edgeSide ?? 'top') && Number.isFinite(device.edgeOffset ?? 50) && (device.edgeOffset ?? 50) >= 0 && (device.edgeOffset ?? 50) <= 100;
    const size = boardSize(project), rect = deviceRect(device, project);
    return (device.type === 'power-entry' || device.type === 'conduit-entry') && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= size.width && rect.y + rect.height <= size.height &&
      !project.devices.some(other => other.id !== device.id && deviceMount(other) !== 'overlay' && (() => { const otherRect = deviceRect(other, project); return rect.x < otherRect.x + otherRect.width && rect.x + rect.width > otherRect.x && rect.y < otherRect.y + otherRect.height && rect.y + rect.height > otherRect.y; })());
  }
  if (mount === 'overlay') return Number.isInteger(device.rail) && device.rail >= 0 && device.rail < project.rails &&
    Number.isInteger(device.slot) && device.slot >= 0 && device.slot + device.modules <= project.modulesPerRail &&
    !project.devices.some(other => other.id !== device.id && deviceMount(other) === 'overlay' && other.rail === device.rail && other.slot < device.slot + device.modules && device.slot < other.slot + other.modules);
  return Number.isInteger(device.modules) && device.modules >= 1 &&
    Number.isInteger(device.rail) && device.rail >= 0 && device.rail < project.rails &&
    Number.isInteger(device.slot) && device.slot >= 0 && device.slot + device.modules <= project.modulesPerRail &&
    !project.devices.some(other => other.id !== device.id && isRailMounted(other) && other.rail === device.rail &&
      other.slot < device.slot + device.modules && device.slot < other.slot + other.modules);
}

export function firstSpace(project: Project, modules: number): { rail: number; slot: number } | null {
  if (!Number.isInteger(modules) || modules < 1) return null;
  for (let rail = 0; rail < project.rails; rail++) {
    for (let slot = 0; slot <= project.modulesPerRail - modules; slot++) {
      if (fits(project, { id: '', modules, rail, slot, mount: 'rail' } as Device)) return { rail, slot };
    }
  }
  return null;
}

function firstOverlaySpace(project: Project, modules: number): { rail: number; slot: number } | null {
  for (let rail = 0; rail < project.rails; rail++) for (let slot = 0; slot <= project.modulesPerRail - modules; slot++) {
    const probe = { id: '__overlay__', type: 'comb-bus', mount: 'overlay', modules, rail, slot } as Device;
    if (fits(project, probe)) return { rail, slot };
  }
  return null;
}

export function addDevice(project: Project, type: string, position?: { rail: number; slot: number }): Project {
  const device = createDevice(type);
  if (deviceMount(device) === 'edge') {
    const count = project.devices.filter(item => deviceMount(item) === 'edge' && (item.edgeSide ?? 'top') === (device.edgeSide ?? 'top')).length;
    const placed = { ...device, ...(position ?? {}), edgeOffset: type === 'power-entry' ? 88 : Math.min(90, 15 + count * 15) };
    return stamp({ ...project, devices: [...project.devices, placed] });
  }
  const firstBreaker = project.devices.filter(isRailMounted).find(item => isCircuitBreaker(item.type));
  const preferredOverlay = firstBreaker ? { rail: firstBreaker.rail, slot: firstBreaker.slot } : null;
  const overlayPlace = deviceMount(device) === 'overlay'
    ? position ?? (preferredOverlay && fits(project, { ...device, ...preferredOverlay }) ? preferredOverlay : firstOverlaySpace(project, device.modules))
    : null;
  const place = deviceMount(device) === 'overlay' ? overlayPlace : position ?? firstSpace(project, device.modules);
  if (!place) throw new Error('Não há módulos livres suficientes. Amplie o quadro ou reorganize os componentes.');
  const placed = { ...device, ...place };
  if (!fits(project, placed)) throw new Error('Posição ocupada ou fora do trilho DIN.');
  return stamp({ ...project, devices: [...project.devices, placed] });
}

/** Validate the complete proposed placement before committing any selected device. */
export function moveDevices(project: Project, ids: string[], railDelta: number, slotDelta: number): Project {
  const selected = new Set(ids);
  if (!Number.isInteger(railDelta) || !Number.isInteger(slotDelta)) throw new Error('Use posições inteiras de trilho e módulo.');
  const next = { ...project, devices: project.devices.map(device => selected.has(device.id) ? { ...device, rail: device.rail + railDelta, slot: device.slot + slotDelta } : device) };
  if (!next.devices.every(device => fits(next, device))) throw new Error('O movimento sobrepõe componentes ou ultrapassa o quadro.');
  return stamp(next);
}

export function moveDeviceOnPlane(project: Project, id: string, position: { x: number; y: number }): Project {
  const original = project.devices.find(device => device.id === id);
  if (!original || (original.type !== 'power-entry' && original.type !== 'conduit-entry')) throw new Error('Somente entradas e eletrodutos podem ser movidos livremente pelo plano.');
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new Error('A posição da entrada de energia é inválida.');
  const next = { ...project, devices: project.devices.map(device => device.id === id ? { ...device, canvasPosition: { x: position.x, y: position.y } } : device) };
  if (!next.devices.every(device => fits(next, device))) throw new Error('A entrada de energia precisa ficar dentro do quadro e sem sobrepor componentes.');
  return stamp(next);
}

function validEndpoint(project: Project, endpoint: Endpoint): Terminal | undefined {
  return project.devices.find(device => device.id === endpoint.componentId)?.terminals.find(terminal => terminal.id === endpoint.terminalId);
}

function cleanWires(project: Project): Project {
  return { ...project, wires: project.wires.filter(wire => validEndpoint(project, { componentId: wire.sourceComponent, terminalId: wire.sourceTerminal }) && validEndpoint(project, { componentId: wire.targetComponent, terminalId: wire.targetTerminal })) };
}

export function updateDevice(project: Project, id: string, patch: Partial<Device>): Project {
  const original = project.devices.find(device => device.id === id);
  if (!original) throw new Error('Componente não encontrado.');
  let device = { ...original, ...patch, id: original.id };
  if (!CATALOG.some(item => item.type === device.type)) throw new Error('Tipo de componente desconhecido.');
  if (device.type === 'spd') {
    const model = DPS_MODELS.find(item => item.id === device.model) ?? DPS_MODELS[0];
    const spdInput = device.spdInput ?? 'phase';
    device = { ...device, spdInput, label: 'DPS', model: model.id, amperage: null, poles: 1, modules: 1, voltage: model.voltage, surgeCurrent: model.surgeCurrent, description: model.description, circuitId: null, color: '#20252b', terminals: buildSpdTerminals(spdInput), mount: 'rail' };
  }
  if (device.type === 'neutral-bus' || device.type === 'earth-bus') {
    if (!Number.isInteger(device.poles) || device.poles < 2 || device.poles > 24) throw new Error('Escolha entre 2 e 24 bornes.');
    if (!['vertical', 'horizontal'].includes(device.orientation ?? 'vertical')) throw new Error('Escolha a orientação vertical ou horizontal.');
    const allowedSides = device.orientation === 'horizontal' ? ['top', 'bottom'] : ['left', 'right'];
    const busTerminalSide = allowedSides.includes(device.busTerminalSide ?? '') ? device.busTerminalSide : device.orientation === 'horizontal' ? 'bottom' : 'right';
    device = { ...device, modules: 1, orientation: device.orientation ?? 'vertical', busTerminalSide, amperage: null, gauge: null, voltage: 0, surgeCurrent: 0, circuitId: null, description: '', color: device.type === 'neutral-bus' ? '#1686cf' : '#27854c', terminals: buildTerminals(device.type, device.poles) };
  }
  if (device.type === 'comb-bus') {
    if (![1, 2, 4].includes(device.poles)) throw new Error('Escolha pente unipolar, bipolar ou tetrapolar.');
    if (!Number.isInteger(device.modules) || device.modules < 2 || device.modules > 24) throw new Error('Escolha entre 2 e 24 encaixes para o pente.');
    if (!['top', 'bottom'].includes(device.combSide ?? 'bottom')) throw new Error('Escolha os bornes superiores ou inferiores.');
    device = { ...device, mount: 'overlay', combSide: device.combSide ?? 'bottom', terminals: [], circuitId: null, gauge: null, voltage: 0, surgeCurrent: 0 };
  }
  if (device.type === 'power-entry' || device.type === 'conduit-entry') {
    const minimum = device.type === 'power-entry' ? 3 : 1;
    const maximum = device.type === 'power-entry' ? 5 : 12;
    if (!Number.isInteger(device.poles) || device.poles < minimum || device.poles > maximum) throw new Error(device.type === 'power-entry' ? 'Escolha uma entrada com 1, 2 ou 3 fases, além de neutro e terra.' : 'Escolha entre 1 e 12 fios.');
    const circuitTerminals = device.type === 'conduit-entry' && original.terminals.some(term => term.id.startsWith('circuit-') || /^c\d+-(?:l|n|pe)$/.test(term.id));
    if (circuitTerminals && device.poles !== original.poles) throw new Error('Os fios desta saída são definidos pelos circuitos. Ajuste os circuitos em vez da quantidade de fios.');
    device = { ...device, mount: 'edge', modules: 1, terminals: circuitTerminals ? original.terminals : buildTerminals(device.type, device.poles), circuitId: null, gauge: null, voltage: 0, surgeCurrent: 0 };
  }
  if (device.poles !== original.poles || device.type !== original.type) {
    if (!Number.isInteger(device.poles) || device.poles < 1 || device.poles > 24) throw new Error('Quantidade de polos inválida.');
    if ((isBreaker(device.type) || isRcd(device.type)) && device.poles > 4) throw new Error('Disjuntores e DR aceitam até quatro polos neste editor.');
    if (device.type.startsWith('rcd-') && ![2, 4].includes(device.poles)) throw new Error('Selecione DR bipolar ou tetrapolar.');
    if (device.type.startsWith('rcbo-') && device.poles !== 2) throw new Error('O dispositivo combinado disponível usa dois polos neste editor.');
    if (device.type === 'motor-breaker-3p' && device.poles !== 3) throw new Error('O disjuntor-motor disponível usa três polos neste editor.');
    if (device.type === 'switch-disconnector-2p' && device.poles !== 2) throw new Error('O seccionador disponível usa dois polos neste editor.');
    if (isBreaker(device.type) || isRcd(device.type)) {
      device = { ...device, modules: device.poles };
      if (device.type.startsWith('breaker-') && device.poles <= 3) device.type = `breaker-${device.poles}p`;
      if (device.type.startsWith('rcd-')) device.type = `rcd-${device.poles}p`;
    }
    if (device.type !== 'comb-bus') device.terminals = buildTerminals(device.type, device.poles);
  }
  if (device.type === 'breaker-2p') {
    device = { ...device, technicalModelId: GENERIC_DIN_2P.id, visualVariant: GENERIC_DIN_2P.visualVariant, terminals: buildTerminals('breaker-2p', 2) };
  } else if (original.type === 'breaker-2p') {
    device = { ...device, technicalModelId: undefined, visualVariant: undefined, breakingCapacityKa: undefined, tag: undefined };
  }
  if (!fits(project, device)) throw new Error('A alteração não cabe neste espaço do trilho.');
  if (!deviceShape(device)) throw new Error('Revise as características do componente: valores numéricos e identificação.');
  if (device.circuitId && (!isBreaker(device.type) || !project.circuits.some(circuit => circuit.id === device.circuitId))) throw new Error('Vincule um circuito existente a um disjuntor.');
  let circuits = [...project.circuits];
  if (isCircuitBreaker(device.type) && patch.label !== undefined && device.label.trim()) {
    let linked = circuits.find(circuit => circuit.id === device.circuitId);
    if (!linked) {
      const nextNumber = Math.max(0, ...circuits.map(circuit => circuit.number)) + 1;
      linked = { id: crypto.randomUUID(), number: nextNumber, name: device.label.trim(), phase: project.supply === 'tri' ? 'R' : 'R', breakerId: id, cableGauge: device.gauge, load: null, loadUnit: 'W', voltage: project.voltage, powerFactor: 1, drId: null, notes: '', color: device.color };
      circuits = [...circuits, linked];
      device = { ...device, circuitId: linked.id };
    }
  }
  let devices = project.devices.map(entry => entry.id === id ? device : entry);
  if (device.circuitId) devices = devices.map(entry => entry.id !== id && entry.circuitId === device.circuitId ? { ...entry, circuitId: null } : entry);
  circuits = circuits.map(circuit => {
    if (circuit.id === device.circuitId) return {
      ...circuit, breakerId: id, cableGauge: device.gauge,
      name: patch.label !== undefined ? device.label.replace(/^C\d+\s*[·–—-]?\s*/, '') : circuit.name,
      color: patch.color !== undefined ? device.color : circuit.color,
    };
    return circuit.breakerId === id ? { ...circuit, breakerId: null } : circuit;
  });
  const changedKinds = new Set(original.terminals.filter(term => device.terminals.find(next => next.id === term.id)?.kind !== term.kind).map(term => term.id));
  const wires = project.wires.filter(wire => !(wire.sourceComponent === id && changedKinds.has(wire.sourceTerminal)) && !(wire.targetComponent === id && changedKinds.has(wire.targetTerminal)));
  const updated = cleanWires({ ...project, devices, circuits, wires });
  return stamp(circuits.length > project.circuits.length ? prepareCircuitOutputs(updated) : updated);
}

export function deleteSelection(project: Project, selection: Selection): Project {
  const removed = new Set(selection.devices);
  return stamp({ ...project,
    devices: project.devices.filter(device => !removed.has(device.id)),
    wires: project.wires.filter(wire => wire.id !== selection.wire && !removed.has(wire.sourceComponent) && !removed.has(wire.targetComponent)),
    circuits: project.circuits.map(circuit => ({ ...circuit,
      breakerId: circuit.breakerId && removed.has(circuit.breakerId) ? null : circuit.breakerId,
      drId: circuit.drId && removed.has(circuit.drId) ? null : circuit.drId,
    })),
  });
}

export function duplicateSelection(project: Project, ids: string[]): Project {
  const selected = project.devices.filter(device => ids.includes(device.id));
  if (!selected.length) return project;
  const minRail = Math.min(...selected.map(device => device.rail));
  const minSlot = Math.min(...selected.map(device => device.slot));
  const mapping = new Map(selected.map(device => [device.id, crypto.randomUUID()]));
  let copies: Device[] | null = null;
  outer: for (let rail = 0; rail < project.rails; rail++) {
    for (let slot = 0; slot < project.modulesPerRail; slot++) {
      const proposal = selected.map(device => ({ ...device, id: mapping.get(device.id)!, rail: device.rail - minRail + rail, slot: device.slot - minSlot + slot, circuitId: null, label: `${device.label} (cópia)`, terminals: device.terminals.map(terminal => ({ ...terminal })) }));
      const candidate = { ...project, devices: [...project.devices, ...proposal] };
      if (proposal.every(device => fits(candidate, device))) { copies = proposal; break outer; }
    }
  }
  if (!copies) throw new Error('Não há espaço para duplicar a seleção mantendo a disposição.');
  const wires = project.wires.filter(wire => mapping.has(wire.sourceComponent) && mapping.has(wire.targetComponent)).map(wire => ({
    ...wire, id: crypto.randomUUID(), sourceComponent: mapping.get(wire.sourceComponent)!, targetComponent: mapping.get(wire.targetComponent)!, path: [],
  }));
  return stamp({ ...project, devices: [...project.devices, ...copies], wires: [...project.wires, ...wires] });
}

export function connectMany(project: Project, requests: ConnectionRequest[]): Project {
  let next = project;
  for (const { source, target, options, label = '' } of requests) {
    if (!['phase', 'neutral', 'earth', 'return'].includes(options.conductorType) || !color(options.color) || !nullablePositive(options.gauge) || !terminations.includes(options.termination) || !text(label)) throw new Error('Revise a cor, a seção e o terminal do condutor.');
    const issue = connectionIssue(next, source, target, options.conductorType);
    if (issue) throw new Error(issue);
    next = { ...next, wires: [...next.wires, {
      id: crypto.randomUUID(), sourceComponent: source.componentId, sourceTerminal: source.terminalId,
      targetComponent: target.componentId, targetTerminal: target.terminalId,
      conductorType: options.conductorType, color: options.color, gauge: options.gauge, label, path: [],
      sourceTermination: options.termination, targetTermination: options.termination,
    }] };
  }
  return stamp(next);
}

export function connect(project: Project, source: Endpoint, target: Endpoint, options: WireOptions): Project {
  return connectMany(project, [{ source, target, options }]);
}

export function organize(project: Project): Project {
  const edges = project.devices.filter(device => deviceMount(device) === 'edge');
  const overlays = project.devices.filter(device => deviceMount(device) === 'overlay');
  const railDevices = project.devices.filter(isRailMounted);
  const peripheralBuses = railDevices.filter(device => device.type === 'neutral-bus' || device.type === 'earth-bus');
  const originalIndex = new Map(project.devices.map((device, index) => [device.id, index]));
  const circuitNumber = new Map(project.circuits.map(circuit => [circuit.id, circuit.number]));
  const category = new Map(CATALOG.map(item => [item.type, item.category]));
  const rank = (device: Device) => {
    if (device.type === 'main-breaker' || device.type.startsWith('switch-disconnector')) return 0;
    if (device.type === 'spd' || device.type === 'fuse-holder') return 1;
    if (isRcd(device.type) && !device.circuitId) return 2;
    if (['neutral-bus', 'earth-bus', 'distribution-block'].includes(device.type)) return 3;
    if (isCircuitBreaker(device.type)) return 4;
    if (category.get(device.type) === 'Automação') return 5;
    if (category.get(device.type) === 'Distribuição') return 6;
    return 7;
  };
  const ordered = railDevices.filter(device => !peripheralBuses.includes(device)).sort((a, b) => rank(a) - rank(b)
    || (circuitNumber.get(a.circuitId ?? '') ?? Number.MAX_SAFE_INTEGER) - (circuitNumber.get(b.circuitId ?? '') ?? Number.MAX_SAFE_INTEGER)
    || (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0));
  const overlayLinks = new Map(overlays.map(overlay => [overlay.id, railDevices.filter(device => isCircuitBreaker(device.type) && device.rail === overlay.rail && device.slot < overlay.slot + overlay.modules && overlay.slot < device.slot + device.modules).map(device => device.id)]));
  let result = { ...project, devices: edges };
  for (let index = 0; index < ordered.length;) {
    const groupRank = rank(ordered[index]);
    const group: Device[] = [];
    while (index < ordered.length && rank(ordered[index]) === groupRank) group.push(ordered[index++]);
    const groupModules = group.reduce((total, device) => total + device.modules, 0);
    const first = firstSpace(result, group[0].modules);
    const keepTogether = groupModules <= project.modulesPerRail && first && first.slot + groupModules > project.modulesPerRail && first.rail + 1 < project.rails;
    let cursor = keepTogether ? { rail: first.rail + 1, slot: 0 } : null;
    for (const device of group) {
      const place = cursor && fits(result, { ...device, ...cursor }) ? cursor : firstSpace(result, device.modules);
      if (!place) throw new Error('Não há espaço suficiente para organizar o quadro.');
      result = { ...result, devices: [...result.devices, { ...device, ...place }] };
      cursor = { rail: place.rail, slot: place.slot + device.modules };
    }
  }
  for (const bus of peripheralBuses) {
    const railLoads = Array.from({ length: project.rails }, (_, rail) => ({
      rail,
      modules: result.devices.filter(device => isRailMounted(device) && device.rail === rail).reduce((total, device) => total + device.modules, 0),
    })).sort((a, b) => a.modules - b.modules || b.rail - a.rail);
    const sides = bus.type === 'neutral-bus' ? (['left', 'right'] as const) : (['right', 'left'] as const);
    const candidates = railLoads.flatMap(({ rail }) => sides.map(side => ({
      ...bus,
      rail,
      slot: side === 'left' ? 0 : project.modulesPerRail - bus.modules,
      ...(bus.orientation === 'horizontal' ? {} : { busTerminalSide: side }),
    })));
    const peripheral = candidates.find(candidate => fits(result, candidate));
    const open = firstSpace(result, bus.modules);
    const fallback = open ? {
      ...bus,
      ...open,
      ...(bus.orientation === 'horizontal' ? {} : { busTerminalSide: open.slot < project.modulesPerRail / 2 ? 'left' as const : 'right' as const }),
    } : null;
    const place = peripheral ?? fallback;
    if (!place) throw new Error('Não há espaço suficiente para posicionar os barramentos de neutro e terra.');
    result = { ...result, devices: [...result.devices, place] };
  }
  for (const overlay of overlays) {
    const linked = (overlayLinks.get(overlay.id) ?? []).map(id => result.devices.find(device => device.id === id)).filter((device): device is Device => !!device);
    const sameRail = linked.length > 0 && linked.every(device => device.rail === linked[0].rail);
    const slot = sameRail ? Math.min(...linked.map(device => device.slot)) : overlay.slot;
    const modules = sameRail ? Math.max(...linked.map(device => device.slot + device.modules)) - slot : overlay.modules;
    const aligned = { ...overlay, rail: sameRail ? linked[0].rail : overlay.rail, slot, modules: Math.max(2, modules) };
    const fallback = fits(result, aligned) ? aligned : fits(result, overlay) ? overlay : (() => { const place = firstOverlaySpace(result, overlay.modules); return place ? { ...overlay, ...place } : null; })();
    if (!fallback) throw new Error('Não há espaço suficiente para reposicionar os barramentos sobrepostos.');
    result = { ...result, devices: [...result.devices, fallback] };
  }
  const withManualPaths = routeWires(result);
  const organized = stamp({ ...withManualPaths, wires: withManualPaths.wires.map(wire =>
    wire.manualPath && wire.path.length > 1 && pathAvoidsDevices(wire.path, result.devices, result)
      ? wire : { ...wire, manualPath: false }) });
  const previousPaths = new Map(project.wires.map(wire => [wire.id, wire.path.length]));
  if (organized.wires.some(wire => !wire.path.length && (previousPaths.get(wire.id) ?? 0) > 0)) {
    throw new Error('A organização criaria um fio sem rota livre. O quadro anterior foi preservado.');
  }
  const totalLength = (wires: Project['wires']) => wires.reduce((total, wire) => total + wire.path.slice(1).reduce((length, point, index) =>
    length + Math.abs(point.x - wire.path[index].x) + Math.abs(point.y - wire.path[index].y), 0), 0);
  const beforeLength = totalLength(project.wires);
  if (beforeLength > 0 && totalLength(organized.wires) > beforeLength * 1.2) {
    throw new Error('Essa organização alongaria demais os fios. O quadro anterior foi preservado.');
  }
  return organized;
}

export function rerouteWires(project: Project): Project {
  return stamp({ ...project, wires: project.wires.map(wire => ({ ...wire, manualPath: false })) });
}

const circuitOutputPrefix = (id: string) => `circuit-${id}-`;

export function circuitForOutputTerminal(project: Project, terminalId: string): Circuit | undefined {
  return project.circuits.find(circuit => terminalId.startsWith(circuitOutputPrefix(circuit.id))
    || [`c${circuit.number}-l`, `c${circuit.number}-n`, `c${circuit.number}-pe`].includes(terminalId));
}

/** Prepare external circuit conductors without connecting them to a breaker or bus. */
export function prepareCircuitOutputs(project: Project): Project {
  let devices = project.devices;
  const hasOutput = (circuit: Circuit) => devices.some(device => device.type === 'conduit-entry' && device.terminals.some(term =>
    term.id.startsWith(circuitOutputPrefix(circuit.id)) || term.id === `c${circuit.number}-l`));
  const outputTerminals = (circuit: Circuit, index: number): Terminal[] => [
    { id: `${circuitOutputPrefix(circuit.id)}l`, label: `C${circuit.number} L`, side: 'bottom', index, kind: 'L' },
    { id: `${circuitOutputPrefix(circuit.id)}n`, label: `C${circuit.number} N`, side: 'bottom', index: index + 1, kind: 'N' },
    { id: `${circuitOutputPrefix(circuit.id)}pe`, label: `C${circuit.number} PE`, side: 'bottom', index: index + 2, kind: 'PE' },
  ];
  const clearPosition = (candidate: Device, exceptId?: string) => {
    const rect = deviceRect(candidate, project);
    const size = boardSize(project);
    if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > size.width || rect.y + rect.height > size.height) return false;
    return devices.filter(other => other.id !== exceptId && deviceMount(other) !== 'overlay').every(other => {
      const occupied = deviceRect(other, project);
      return rect.x >= occupied.x + occupied.width + 3 || rect.x + rect.width + 3 <= occupied.x
        || rect.y >= occupied.y + occupied.height + 3 || rect.y + rect.height + 3 <= occupied.y;
    });
  };
  for (const circuit of [...project.circuits].sort((a, b) => a.number - b.number)) {
    if (hasOutput(circuit)) continue;
    const base: Device = { ...createDevice('conduit-entry'), label: `Saída C${circuit.number}`, poles: 3,
      terminals: outputTerminals(circuit, 0), edgeSide: 'bottom', edgeOffset: 50 };
    const breaker = devices.find(device => device.id === circuit.breakerId);
    const breakerCenter = breaker ? (() => { const rect = deviceRect(breaker, project); return rect.x + rect.width / 2; })() : boardSize(project).width / 2;
    const desiredOffset = Math.max(6, Math.min(94, (breakerCenter - 42) / (boardSize(project).width - 84) * 100));
    const offsets = Array.from({ length: 45 }, (_, index) => 6 + index * 2).sort((a, b) => Math.abs(a - desiredOffset) - Math.abs(b - desiredOffset) || a - b);
    const placement = (['bottom', 'top', 'left', 'right'] as const).flatMap(edgeSide => offsets.map(edgeOffset => ({ ...base, edgeSide, edgeOffset })))
      .find(candidate => clearPosition(candidate));
    if (!placement) throw new Error('Não há espaço livre na borda para a saída deste circuito. Mova um eletroduto ou amplie o quadro.');
    devices = [...devices, placement];
  }
  return routeWires({ ...project, devices });
}

export function removeCircuitOutput(project: Project, circuitId: string): Project {
  const prefix = circuitOutputPrefix(circuitId);
  const removedTerminals = new Set(project.devices.flatMap(device => device.type === 'conduit-entry'
    ? device.terminals.filter(term => term.id.startsWith(prefix)).map(term => `${device.id}:${term.id}`) : []));
  const devices = project.devices.flatMap(device => {
    if (device.type !== 'conduit-entry' || !device.terminals.some(term => term.id.startsWith(prefix))) return [device];
    const terminals = device.terminals.filter(term => !term.id.startsWith(prefix)).map((term, index) => ({ ...term, index }));
    return terminals.length ? [{ ...device, poles: terminals.length, terminals }] : [];
  });
  const wires = project.wires.filter(wire => !removedTerminals.has(`${wire.sourceComponent}:${wire.sourceTerminal}`)
    && !removedTerminals.has(`${wire.targetComponent}:${wire.targetTerminal}`));
  return routeWires({ ...project, devices, wires });
}

export function updateCircuit(project: Project, id: string, patch: Partial<Circuit>): Project {
  const original = project.circuits.find(circuit => circuit.id === id);
  if (!original) throw new Error('Circuito não encontrado.');
  const circuit = { ...original, ...patch, id: original.id };
  if (!circuitShape(circuit)) throw new Error('Revise os dados do circuito. Tensão e fator de potência devem ser válidos.');
  if (circuit.breakerId && !project.devices.some(device => device.id === circuit.breakerId && isBreaker(device.type))) throw new Error('Selecione um disjuntor existente.');
  if (circuit.drId && !project.devices.some(device => device.id === circuit.drId && isRcd(device.type))) throw new Error('Selecione um DR existente.');
  if (project.circuits.some(other => other.id !== id && other.number === circuit.number)) throw new Error('Já existe um circuito com esse número.');
  const circuits = project.circuits.map(entry => entry.id === id ? circuit : entry.breakerId && entry.breakerId === circuit.breakerId ? { ...entry, breakerId: null } : entry);
  const devices = project.devices.map(device => {
    if (device.id === circuit.breakerId) return { ...device, circuitId: id, label: circuit.name, gauge: circuit.cableGauge, color: circuit.color };
    return device.circuitId === id ? { ...device, circuitId: null } : device;
  });
  return stamp(prepareCircuitOutputs({ ...project, circuits, devices }));
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length <= 10000;
const identifier = (value: unknown): value is string => text(value) && value.length > 0 && value.length <= 160;
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const nullablePositive = (value: unknown) => value === null || positive(value);
const nullableId = (value: unknown) => value === null || identifier(value);
const color = (value: unknown) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

function deviceShape(value: unknown): value is Device {
  if (!record(value) || !identifier(value.id) || !CATALOG.some(item => item.type === value.type) ||
    !text(value.label) || !integer(value.rail, 0, 11) || !integer(value.slot, 0, 71) || !integer(value.modules, 1, 72) ||
    !integer(value.poles, 1, 24) || !nullablePositive(value.amperage) || !['B', 'C', 'D'].includes(value.curve as string) ||
    !nullablePositive(value.gauge) || !nonnegative(value.sensitivity) || !nonnegative(value.voltage) || !nonnegative(value.surgeCurrent) ||
    !text(value.description) || !nullableId(value.circuitId) || !color(value.color) || !Array.isArray(value.terminals) || value.terminals.length > 32 ||
    (value.mount !== undefined && !['rail', 'edge', 'overlay'].includes(value.mount as string)) ||
    (value.edgeSide !== undefined && !['top', 'bottom', 'left', 'right'].includes(value.edgeSide as string)) ||
    (value.edgeOffset !== undefined && (!nonnegative(value.edgeOffset) || value.edgeOffset > 100)) ||
    (value.canvasPosition !== undefined && (!record(value.canvasPosition) || !nonnegative(value.canvasPosition.x) || !nonnegative(value.canvasPosition.y))) ||
    (value.model !== undefined && !text(value.model)) ||
    (value.technicalModelId !== undefined && (!text(value.technicalModelId) || !technicalModel(value.technicalModelId))) ||
    (value.visualVariant !== undefined && value.visualVariant !== GENERIC_DIN_2P.visualVariant) ||
    (value.breakingCapacityKa !== undefined && !nullablePositive(value.breakingCapacityKa)) ||
    (value.tag !== undefined && (!text(value.tag) || value.tag.length > 32)) ||
    (value.visualModel !== undefined && !['classic', 'graphite', 'two-tone'].includes(value.visualModel as string)) ||
    (value.spdInput !== undefined && !['phase', 'neutral'].includes(value.spdInput as string)) ||
    (value.visualRotation !== undefined && ![0, 180].includes(value.visualRotation as number)) ||
    (value.orientation !== undefined && !['vertical', 'horizontal'].includes(value.orientation as string)) ||
    (value.busTerminalSide !== undefined && !['top', 'bottom', 'left', 'right'].includes(value.busTerminalSide as string)) ||
    (value.combSide !== undefined && !['top', 'bottom'].includes(value.combSide as string))) return false;
  const ids = new Set<string>();
  const indices = new Set<string>();
  if (!value.terminals.length) return value.type === 'comb-bus';
  return value.terminals.every(term => {
    if (!record(term) || !identifier(term.id) || ids.has(term.id) || !text(term.label) || !['top', 'bottom', 'left', 'right'].includes(term.side as string) || !integer(term.index, 0, 31) || !['L', 'N', 'PE', 'control'].includes(term.kind as string) ||
      (term.pole !== undefined && !integer(term.pole, 1, 24)) ||
      (term.position !== undefined && (!record(term.position) || !nonnegative(term.position.x) || term.position.x > 1 || !nonnegative(term.position.y) || term.position.y > 1))) return false;
    const location = `${term.side}-${term.index}`;
    if (indices.has(location)) return false;
    ids.add(term.id); indices.add(location); return true;
  });
}

function circuitShape(value: unknown): value is Circuit {
  return record(value) && identifier(value.id) && integer(value.number, 1, 9999) && text(value.name) &&
    text(value.phase) && ['', 'R', 'S', 'T', 'R/S', 'R/T', 'S/T', 'R/S/T'].includes(value.phase) &&
    nullableId(value.breakerId) && nullablePositive(value.cableGauge) && (value.load === null || nonnegative(value.load)) &&
    ['W', 'A'].includes(value.loadUnit as string) && positive(value.voltage) && positive(value.powerFactor) && value.powerFactor <= 1 &&
    nullableId(value.drId) && text(value.notes) && color(value.color);
}

/** JSON import is untrusted. Validate every nested collection before exposing it to the editor. */
export function validateProject(value: unknown): value is Project {
  if (!record(value) || value.version !== 2 || !identifier(value.id) || !text(value.name) || !text(value.client) ||
    !['mono', 'bi', 'tri'].includes(value.supply as string) || !positive(value.voltage) ||
    (value.visualModel !== undefined && !['classic', 'graphite', 'two-tone'].includes(value.visualModel as string)) ||
    (value.dpsVisual !== undefined && !['standard', 'red'].includes(value.dpsVisual as string)) ||
    !integer(value.rails, 1, 12) || !integer(value.modulesPerRail, 4, 72) || !positive(value.widthMm) || !positive(value.heightMm) ||
    !text(value.createdAt) || !Number.isFinite(Date.parse(value.createdAt)) || !text(value.updatedAt) || !Number.isFinite(Date.parse(value.updatedAt)) ||
    !Array.isArray(value.devices) || value.devices.length > 864 || !Array.isArray(value.wires) || value.wires.length > 10000 ||
    !Array.isArray(value.circuits) || value.circuits.length > 1000 || !Array.isArray(value.materials) || value.materials.length > 1000) return false;
  if (!value.devices.every(deviceShape) || !value.circuits.every(circuitShape)) return false;
  const project = value as unknown as Project;
  const deviceIds = new Set(project.devices.map(device => device.id));
  const circuitIds = new Set(project.circuits.map(circuit => circuit.id));
  if (deviceIds.size !== project.devices.length || circuitIds.size !== project.circuits.length || new Set(project.circuits.map(circuit => circuit.number)).size !== project.circuits.length || !project.devices.every(device => fits(project, device))) return false;
  if (project.devices.some(device => device.circuitId !== null && !project.circuits.some(circuit => circuit.id === device.circuitId && circuit.breakerId === device.id && circuit.cableGauge === device.gauge))) return false;
  if (project.circuits.some(circuit => (circuit.breakerId !== null && !project.devices.some(device => device.id === circuit.breakerId && isBreaker(device.type) && device.circuitId === circuit.id)) || (circuit.drId !== null && !project.devices.some(device => device.id === circuit.drId && isRcd(device.type))))) return false;
  const wireIds = new Set<string>();
  const connections = new Set<string>();
  for (const wire of value.wires) {
    if (!record(wire) || !identifier(wire.id) || wireIds.has(wire.id) || !identifier(wire.sourceComponent) || !identifier(wire.sourceTerminal) || !identifier(wire.targetComponent) || !identifier(wire.targetTerminal) ||
      !['phase', 'neutral', 'earth', 'return'].includes(wire.conductorType as string) || !color(wire.color) || !nullablePositive(wire.gauge) || !text(wire.label) || !Array.isArray(wire.path) || wire.path.length > 128 ||
      (wire.sourceTermination !== undefined && !terminations.includes(wire.sourceTermination as WireTermination)) ||
      (wire.targetTermination !== undefined && !terminations.includes(wire.targetTermination as WireTermination)) ||
      (wire.manualPath !== undefined && typeof wire.manualPath !== 'boolean') ||
      !wire.path.every(point => record(point) && typeof point.x === 'number' && Number.isFinite(point.x) && typeof point.y === 'number' && Number.isFinite(point.y)) ||
      !validEndpoint(project, { componentId: wire.sourceComponent, terminalId: wire.sourceTerminal }) || !validEndpoint(project, { componentId: wire.targetComponent, terminalId: wire.targetTerminal }) ||
      !compatibleEndpoints(project, { componentId: wire.sourceComponent, terminalId: wire.sourceTerminal }, { componentId: wire.targetComponent, terminalId: wire.targetTerminal }, wire.conductorType as Conductor)) return false;
    const endpoints = [`${wire.sourceComponent}\0${wire.sourceTerminal}`, `${wire.targetComponent}\0${wire.targetTerminal}`];
    if (endpoints[0] === endpoints[1]) return false;
    const key = endpoints.sort().join('\u0001');
    if (connections.has(key)) return false;
    connections.add(key); wireIds.add(wire.id);
  }
  const materialIds = new Set<string>();
  return value.materials.every(material => {
    if (!record(material) || !identifier(material.id) || materialIds.has(material.id) || !text(material.name) || !text(material.specification) || !nonnegative(material.quantity) || !text(material.unit)) return false;
    materialIds.add(material.id); return true;
  });
}
