import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, createDevice } from '../src/features/qdc/electrical-components/catalog.ts';
import { addDevice, connect, deleteSelection, duplicateSelection, firstSpace, fits, moveDevices, organize, updateCircuit, updateDevice, validateProject } from '../src/features/qdc/editor/operations.ts';
import { circuitCurrent, materialList, phaseBalance, warnings } from '../src/features/qdc/circuits/analysis.ts';
import { automaticProject, demoProject, emptyProject, migrateLegacy } from '../src/features/qdc/projects/factory.ts';
import { parseProjectFile } from '../src/features/qdc/projects/storage.ts';
import { boardSize, pathAvoidsDevices, pathOverlapLength, routeWires, terminalPoint } from '../src/features/qdc/wiring/routing.ts';
import { ferruleColor } from '../src/features/qdc/wiring/options.ts';
import type { Circuit, Project } from '../src/features/qdc/types.ts';

const options = { conductorType: 'phase' as const, color: '#20252b', gauge: 2.5, termination: 'tubular' as const };
const endpoint = (componentId: string, terminalId = 'top-0') => ({ componentId, terminalId });
const loadCircuit = (patch: Partial<Circuit> = {}): Circuit => ({ id: 'c1', number: 1, name: 'Carga de teste', phase: 'R', breakerId: null, cableGauge: null, load: 1000, loadUnit: 'W', voltage: 127, powerFactor: 1, drId: null, notes: '', color: '#20252b', ...patch });

test('catalog contains the complete QDC families with usable terminal identities and no invented sizing', () => {
  assert.ok(CATALOG.length >= 34);
  assert.equal(new Set(CATALOG.map(item => item.type)).size, CATALOG.length);
  for (const required of ['comb-bus', 'terminal', 'terminal-n', 'terminal-pe', 'rcbo-2p', 'motor-breaker-3p', 'phase-monitor', 'voltmeter', 'ammeter']) assert.ok(CATALOG.some(item => item.type === required), required);
  for (const item of CATALOG) {
    const device = createDevice(item.type);
    if (item.type === 'comb-bus') assert.equal(device.terminals.length, 0);
    else assert.ok(device.terminals.length);
    assert.equal(new Set(device.terminals.map(term => term.id)).size, device.terminals.length);
    assert.equal(device.amperage, null);
    assert.equal(device.gauge, null);
  }
  assert.throws(() => createDevice('unknown'), /não encontrado/);
});

test('collision rejection preserves input and checks board bounds', () => {
  const empty = emptyProject({ rails: 1, modulesPerRail: 4 });
  const project = addDevice(empty, 'breaker-2p', { rail: 0, slot: 1 });
  const snapshot = JSON.stringify(project);
  assert.throws(() => addDevice(project, 'breaker-2p', { rail: 0, slot: 2 }), /ocupada/);
  assert.throws(() => addDevice(project, 'breaker-1p', { rail: -1, slot: 0 }), /fora/);
  assert.equal(JSON.stringify(project), snapshot);
  assert.equal(firstSpace(project, 2), null);
  assert.deepEqual(firstSpace(project, 1), { rail: 0, slot: 0 });
});

test('multi-device movement is atomic and allows moving through old selection positions', () => {
  let project = emptyProject({ rails: 1, modulesPerRail: 8 });
  project = addDevice(project, 'breaker-1p', { rail: 0, slot: 0 });
  project = addDevice(project, 'breaker-1p', { rail: 0, slot: 1 });
  project = addDevice(project, 'breaker-1p', { rail: 0, slot: 4 });
  const selected = project.devices.slice(0, 2).map(device => device.id);
  const moved = moveDevices(project, selected, 0, 1);
  assert.deepEqual(moved.devices.map(device => device.slot), [1, 2, 4]);
  assert.deepEqual(project.devices.map(device => device.slot), [0, 1, 4]);
  assert.throws(() => moveDevices(project, selected, 0, 3), /sobrepõe/);
  assert.throws(() => moveDevices(project, selected, 0, -1), /ultrapassa/);
});

test('duplicate selection copies internal connections, creates IDs and clears circuit assignment', () => {
  let project = emptyProject({ rails: 2, modulesPerRail: 12 });
  project = addDevice(project, 'breaker-1p', { rail: 0, slot: 0 });
  project = addDevice(project, 'breaker-1p', { rail: 0, slot: 1 });
  const ids = project.devices.map(device => device.id);
  project = connect(project, endpoint(ids[0], 'bottom-0'), endpoint(ids[1]), options);
  project = { ...project, circuits: [loadCircuit({ breakerId: ids[0] })], devices: project.devices.map((device, i) => i === 0 ? { ...device, circuitId: 'c1' } : device) };
  const copy = duplicateSelection(project, ids);
  assert.equal(copy.devices.length, 4);
  assert.equal(copy.wires.length, 2);
  assert.equal(new Set(copy.devices.map(device => device.id)).size, 4);
  assert.ok(copy.devices.slice(2).every(device => device.circuitId === null));
  assert.ok(copy.wires[1].sourceComponent !== project.wires[0].sourceComponent);
  assert.ok(validateProject(copy));
});

test('delete removes touching wires and reciprocal breaker / DR references', () => {
  const project = demoProject();
  const circuit = project.circuits[0];
  const deleted = deleteSelection(project, { devices: [circuit.breakerId!, circuit.drId!], wire: null });
  assert.equal(deleted.circuits[0].breakerId, null);
  assert.ok(deleted.circuits.every(entry => entry.drId === null));
  assert.ok(deleted.wires.every(wire => wire.sourceComponent !== circuit.breakerId && wire.targetComponent !== circuit.breakerId && wire.sourceComponent !== circuit.drId && wire.targetComponent !== circuit.drId));
  assert.ok(validateProject(deleted));
});

test('pole changes rebuild terminals, clean removed and relabeled-neutral endpoints, and check size', () => {
  let project = emptyProject({ rails: 2, modulesPerRail: 12 });
  project = addDevice(project, 'rcd-2p', { rail: 0, slot: 0 });
  project = addDevice(project, 'neutral-bus', { rail: 1, slot: 0 });
  const dr = project.devices[0];
  project = connect(project, endpoint(dr.id, 'bottom-1'), endpoint(project.devices[1].id, 'side-0'), { ...options, conductorType: 'neutral', color: '#1686cf' });
  const changed = updateDevice(project, dr.id, { poles: 4 });
  assert.equal(changed.devices[0].modules, 4);
  assert.equal(changed.devices[0].type, 'rcd-4p');
  assert.equal(changed.wires.length, 0, 'a neutral terminal that becomes a phase must not keep the old wire');
  assert.equal(changed.devices[0].terminals.find(term => term.id === 'bottom-3')?.kind, 'N');
  const occupied = addDevice(project, 'breaker-1p', { rail: 0, slot: 2 });
  assert.throws(() => updateDevice(occupied, dr.id, { poles: 4 }), /não cabe/);
  assert.ok(validateProject(changed));
});

test('circuit and device edits maintain one reciprocal breaker assignment and cable section', () => {
  const initial = demoProject();
  const [first, second] = initial.circuits;
  const changed = updateCircuit(initial, first.id, { name: 'Oficina', cableGauge: 4, color: '#ff0000', breakerId: second.breakerId });
  assert.equal(changed.circuits[1].breakerId, null);
  assert.equal(changed.devices.find(device => device.id === first.breakerId)?.circuitId, null);
  assert.equal(changed.devices.find(device => device.id === second.breakerId)?.label, 'Oficina');
  const changedAgain = updateDevice(changed, second.breakerId!, { circuitId: second.id, gauge: 6, label: 'Ar condicionado' });
  assert.equal(changedAgain.circuits[0].breakerId, null);
  assert.equal(changedAgain.circuits[1].cableGauge, 6);
  assert.equal(changedAgain.circuits[1].name, 'Ar condicionado');
  assert.ok(validateProject(changedAgain));
});

test('wire operations reject missing endpoints, loops and duplicate reversed connections', () => {
  let project = addDevice(emptyProject(), 'breaker-1p');
  project = addDevice(project, 'breaker-1p');
  const [a, b] = project.devices;
  assert.throws(() => connect(project, endpoint(a.id), endpoint(a.id), options), /outro terminal/);
  assert.throws(() => connect(project, endpoint(a.id, 'missing'), endpoint(b.id), options), /existentes/);
  project = connect(project, endpoint(a.id), endpoint(b.id), options);
  assert.throws(() => connect(project, endpoint(b.id), endpoint(a.id), options), /já estão conectados/);
  assert.throws(() => connect(project, endpoint(a.id, 'bottom-0'), endpoint(b.id), { ...options, gauge: Number.NaN }), /seção/);
});

test('routing across full rails avoids all component interiors, stays on board and is deterministic', () => {
  let project = emptyProject({ rails: 4, modulesPerRail: 12 });
  for (let rail = 0; rail < 4; rail++) {
    for (let slot = 0; slot < 12; slot++) project = addDevice(project, 'breaker-1p', { rail, slot });
  }
  const first = project.devices[3];
  const last = project.devices.at(-3)!;
  project = connect(project, endpoint(first.id, 'top-0'), endpoint(last.id, 'bottom-0'), options);
  const { width, height } = boardSize(project);
  const points = project.wires[0].path;
  assert.ok(points.length >= 4);
  assert.ok(pathAvoidsDevices(points, project.devices));
  assert.ok(points.every(point => point.x >= 0 && point.y >= 0 && point.x <= width && point.y <= height));
  assert.deepEqual(points[0], terminalPoint(project, first.id, 'top-0'));
  assert.deepEqual(points.at(-1), terminalPoint(project, last.id, 'bottom-0'));
  assert.deepEqual(routeWires(project).wires, project.wires);
  assert.ok(points.slice(1).every((point, i) => point.x !== points[i].x || point.y !== points[i].y));
  const moved = deleteSelection(project, { devices: [project.devices[0].id], wire: null });
  const organized = organize(moved);
  assert.ok(organized.devices.every(device => fits(organized, device)));
  assert.ok(pathAvoidsDevices(organized.wires[0].path, organized.devices));
});

test('parallel routes use separate corridors instead of stacking entire segments', () => {
  let project = emptyProject({ rails: 2, modulesPerRail: 12 });
  for (const slot of [0, 2, 7, 9]) project = addDevice(project, 'breaker-1p', { rail: slot < 5 ? 0 : 1, slot: slot < 5 ? slot : slot - 7 });
  const [a, b, c, d] = project.devices;
  project = connect(project, endpoint(a.id, 'bottom-0'), endpoint(c.id, 'top-0'), options);
  project = connect(project, endpoint(b.id, 'bottom-0'), endpoint(d.id, 'top-0'), options);
  assert.ok(project.wires.every(wire => pathAvoidsDevices(wire.path, project.devices)));
  assert.equal(pathOverlapLength(project.wires[0].path, project.wires[1].path), 0);
});

test('automatic proposal and demo preserve unknown electrical settings and valid links', () => {
  const demo = demoProject();
  assert.equal(demo.supply, 'mono');
  assert.equal(demo.voltage, 220);
  assert.equal(demo.circuits.length, 5);
  assert.equal(demo.devices.filter(device => device.type === 'comb-bus').length, 1);
  assert.ok(demo.devices.some(device => device.type === 'neutral-bus'));
  assert.ok(demo.devices.some(device => device.type === 'earth-bus'));
  assert.ok(demo.wires.length > 5);
  for (let i = 0; i < demo.wires.length; i++) for (let j = i + 1; j < demo.wires.length; j++) {
    if (pathOverlapLength(demo.wires[i].path, demo.wires[j].path) === 0) continue;
    const sharedSource = demo.wires[i].sourceComponent === demo.wires[j].sourceComponent && demo.wires[i].sourceTerminal === demo.wires[j].sourceTerminal;
    const sharedTarget = demo.wires[i].targetComponent === demo.wires[j].targetComponent && demo.wires[i].targetTerminal === demo.wires[j].targetTerminal;
    assert.ok(sharedSource || sharedTarget, 'only the short exit of a genuinely shared terminal may overlap');
  }
  assert.ok(validateProject(demo));
  const tri = automaticProject({ supply: 'tri', voltage: 220, rails: 3, modulesPerRail: 12 }, ['Luz', 'Tomadas', 'Motor']);
  assert.deepEqual(tri.circuits.map(circuit => circuit.phase), ['R', 'S', 'T']);
  assert.ok(tri.circuits.every(circuit => circuit.load === null && circuit.cableGauge === null));
  assert.ok(tri.devices.every(device => device.amperage === null && device.gauge === null));
  assert.ok(validateProject(tri));
  assert.throws(() => automaticProject({ rails: 1, modulesPerRail: 8 }, ['Luz', 'Tomadas', 'Cozinha', 'Chuveiro']), /não comporta/);
});

test('breaker identification creates and keeps a circuit without adding layout prefixes', () => {
  let project = addDevice(emptyProject(), 'breaker-1p');
  const breaker = project.devices[0];
  project = updateDevice(project, breaker.id, { label: 'Tomadas cozinha' });
  assert.equal(project.circuits.length, 1);
  assert.equal(project.circuits[0].name, 'Tomadas cozinha');
  assert.equal(project.circuits[0].breakerId, breaker.id);
  assert.equal(project.devices[0].label, 'Tomadas cozinha');
  project = updateDevice(project, breaker.id, { label: 'Forno elétrico' });
  assert.equal(project.circuits.length, 1);
  assert.equal(project.circuits[0].name, 'Forno elétrico');
  assert.ok(validateProject(project));
});

test('special components use their requested mounting and connection rules', () => {
  let project = emptyProject({ rails: 1, modulesPerRail: 12 });
  project = addDevice(project, 'neutral-bus', { rail: 0, slot: 0 });
  project = addDevice(project, 'earth-bus', { rail: 0, slot: 1 });
  project = addDevice(project, 'comb-bus', { rail: 0, slot: 2 });
  project = addDevice(project, 'power-entry');
  project = addDevice(project, 'breaker-1p', { rail: 0, slot: 2 });
  const [neutral, earth, comb, entry, breaker] = project.devices;
  assert.equal(neutral.modules, 1);
  assert.equal(neutral.color, '#1686cf');
  assert.equal(earth.color, '#27854c');
  assert.equal(comb.mount, 'overlay');
  assert.equal(comb.terminals.length, 0);
  assert.equal(entry.mount, 'edge');
  assert.throws(() => connect(project, endpoint(comb.id), endpoint(breaker.id), options), /existentes/);
  project = connect(project, endpoint(entry.id, 'edge-0'), endpoint(breaker.id), options);
  assert.equal(project.wires[0].sourceTermination, 'tubular');
  assert.ok(project.wires[0].path.length);
  assert.ok(validateProject(project));
});

test('DPS values are model controlled and tubular colors follow conductor section', () => {
  let project = addDevice(emptyProject(), 'spd');
  const dps = project.devices[0];
  project = updateDevice(project, dps.id, { voltage: 999, surgeCurrent: 999, label: 'personalizado' });
  assert.equal(project.devices[0].label, 'DPS');
  assert.notEqual(project.devices[0].voltage, 999);
  assert.notEqual(project.devices[0].surgeCurrent, 999);
  assert.equal(ferruleColor(1.5).name, 'preto');
  assert.equal(ferruleColor(2.5).name, 'azul');
  assert.equal(ferruleColor(6).name, 'amarelo');
});

test('import validation rejects malformed nested data, nonfinite numbers and dangling references', () => {
  const valid = demoProject();
  const clone = () => structuredClone(valid);
  const cases: unknown[] = [null, {}, [], { ...valid, devices: [null] }, { ...valid, circuits: [null] }, { ...valid, wires: [null] }, { ...valid, materials: [null] }, { ...valid, voltage: Infinity }, { ...valid, modulesPerRail: 0 }];
  const brokenGauge = clone(); brokenGauge.devices[0].gauge = Number.NaN; cases.push(brokenGauge);
  const brokenPath = clone(); brokenPath.wires[0].path = [{ x: Number.NaN, y: 5 }]; cases.push(brokenPath);
  const brokenTerminal = clone(); brokenTerminal.wires[0].sourceTerminal = 'unknown'; cases.push(brokenTerminal);
  const brokenRef = clone(); brokenRef.circuits[0].breakerId = 'unknown'; cases.push(brokenRef);
  const duplicateId = clone(); duplicateId.devices[1].id = duplicateId.devices[0].id; cases.push(duplicateId);
  for (const candidate of cases) assert.equal(validateProject(candidate), false);
  assert.ok(validateProject(JSON.parse(JSON.stringify(valid))));
});

test('legacy migration preserves device positions, wire labels and neutral bus references', () => {
  const old = { id: 'old', nome: 'Quadro antigo', cliente: '', trilhos: 1, modulosPorTrilho: 8, barramentoN: true, barramentoPE: true,
    componentes: [{ id: 'old-dr', tipo: 'DR 2P', descricao: 'DR existente', circuito: '', modulos: 2, trilho: 0, inicio: 0 }],
    fios: [{ id: 'old-wire', origem: { componente: 'old-dr', lado: 'inferior', numero: 1 }, destino: { componente: '@N', lado: 'superior', numero: 0 }, cor: '#1686cf', identificacao: 'N após DR' }] };
  const migrated = migrateLegacy(old);
  assert.ok(migrated);
  assert.equal(migrated.id, 'old');
  assert.equal(migrated.devices[0].slot, 0);
  assert.equal(migrated.devices[0].description, 'DR existente');
  assert.equal(migrated.wires[0].label, 'N após DR');
  assert.equal(migrated.wires[0].targetComponent, '@N');
  assert.equal(migrated.rails, old.trilhos);
  assert.ok(validateProject(migrated));
  assert.equal(old.trilhos, 1);
  assert.equal(migrateLegacy({ ...old, componentes: [null] }), null);
});

test('saved projects normalize old horizontal bus endpoints and missing wire terminals', () => {
  const oldStyle = structuredClone(demoProject());
  const neutral = oldStyle.devices.find(device => device.type === 'neutral-bus')!;
  neutral.terminals = neutral.terminals.map(term => ({ ...term, id: term.id.replace('side-', 'top-'), side: 'top' as const }));
  for (const wire of oldStyle.wires) {
    if (wire.sourceComponent === neutral.id) wire.sourceTerminal = wire.sourceTerminal.replace('side-', 'top-');
    if (wire.targetComponent === neutral.id) wire.targetTerminal = wire.targetTerminal.replace('side-', 'top-');
    delete wire.sourceTermination;
    delete wire.targetTermination;
  }
  assert.ok(validateProject(oldStyle));
  const normalized = parseProjectFile(JSON.stringify(oldStyle));
  const normalizedNeutral = normalized.devices.find(device => device.id === neutral.id)!;
  assert.equal(normalizedNeutral.modules, 1);
  assert.ok(normalizedNeutral.terminals.every(term => term.side === 'right'));
  assert.ok(normalized.wires.every(wire => wire.sourceTermination === 'tubular' && wire.targetTermination === 'tubular'));
  assert.ok(validateProject(normalized));
});

test('phase indicators use active input power and per-line current, never breaker ratings', () => {
  const single = loadCircuit({ load: 1270, voltage: 127 });
  assert.equal(circuitCurrent(single), 10);
  assert.equal(circuitCurrent({ ...single, powerFactor: 0.5 }), 20);
  const two = loadCircuit({ id: 'c2', number: 2, phase: 'R/S', load: 2200, voltage: 220 });
  assert.equal(circuitCurrent(two), 10);
  const three = loadCircuit({ id: 'c3', number: 3, phase: 'R/S/T', load: Math.sqrt(3) * 380 * 10 * 0.8, voltage: 380, powerFactor: 0.8 });
  assert.ok(Math.abs(circuitCurrent(three)! - 10) < 1e-9);
  const amperes = loadCircuit({ id: 'c4', number: 4, phase: 'S', load: 7, loadUnit: 'A' });
  const missing = loadCircuit({ id: 'c5', number: 5, phase: 'T', load: null });
  const project: Project = { ...emptyProject({ supply: 'tri' }), circuits: [single, two, three, amperes, missing] };
  const balance = phaseBalance(project);
  assert.deepEqual(balance.map(row => Math.round(row.current)), [30, 27, 10]);
  assert.deepEqual(balance.map(row => row.missing), [0, 0, 1]);
  assert.deepEqual(balance.map(row => row.count), [3, 3, 2]);
  assert.equal(circuitCurrent({ ...single, load: -1 }), null);
  assert.equal(circuitCurrent({ ...single, phase: '' }), null);
});

test('materials group ratings and include manual rows without inventing cable length', () => {
  let project = addDevice(emptyProject(), 'breaker-1p');
  project = addDevice(project, 'breaker-1p');
  project = connect(project, endpoint(project.devices[0].id), endpoint(project.devices[1].id), options);
  project.materials = [{ id: 'manual', name: 'Condutor medido', specification: '2,5 mm²', quantity: 4, unit: 'm' }];
  const list = materialList(project);
  assert.equal(list.find(item => item.name === 'Disjuntor monopolar')?.quantity, 2);
  assert.equal(list.find(item => item.unit === 'ligação')?.quantity, 1);
  assert.equal(list.at(-1)?.quantity, 4);
  assert.ok(warnings(project).some(warning => warning.id.startsWith('terminal-')));
});
