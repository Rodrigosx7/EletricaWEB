import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, buildSpdTerminals, buildTerminals, createDevice } from '../src/features/qdc/electrical-components/catalog.ts';
import { addDevice, connect, connectionIssue, deleteSelection, duplicateSelection, firstSpace, fits, moveCircuitToConduit, moveDeviceOnPlane, moveDevices, moveFishboneBreaker, organize, prepareCircuitOutputs, removeCircuitOutput, rerouteWires, updateCircuit, updateDevice, updateWire, validateProject } from '../src/features/qdc/editor/operations.ts';
import { createFishboneConfig, fishbonePhase, fishboneSlotIssue, fishboneSlotsFor } from '../src/features/qdc/fishbone/model.ts';
import { circuitCurrent, materialList, phaseBalance, warnings } from '../src/features/qdc/circuits/analysis.ts';
import { automaticProject, automaticRequiredModules, demoProject, emptyProject, migrateLegacy } from '../src/features/qdc/projects/factory.ts';
import { loadProjects, parseProjectFile, saveProjects } from '../src/features/qdc/projects/storage.ts';
import { boardSize, deviceRect, isRailMounted, pathAvoidsDevices, pathOverlapLength, routeWires, terminalPoint } from '../src/features/qdc/wiring/routing.ts';
import { bendWirePoint, flexWireSegment, reattachManualWirePath, removeWireBend, roundedWirePath, snapWirePoint } from '../src/features/qdc/wiring/geometry.ts';
import { ferruleColor, TERMINATION_OPTIONS, WIRE_COLORS } from '../src/features/qdc/wiring/options.ts';
import { canvasFocus } from '../src/features/qdc/canvas/focus.ts';
import type { Circuit, Project } from '../src/features/qdc/types.ts';

const options = { conductorType: 'phase' as const, color: '#20252b', gauge: 2.5, termination: 'tubular' as const };
const endpoint = (componentId: string, terminalId = 'top-0') => ({ componentId, terminalId });
const loadCircuit = (patch: Partial<Circuit> = {}): Circuit => ({ id: 'c1', number: 1, name: 'Carga de teste', phase: 'R', breakerId: null, cableGauge: null, load: 1000, loadUnit: 'W', voltage: 127, powerFactor: 1, drId: null, notes: '', color: '#20252b', ...patch });

test('fishbone keeps real phase slots, supports multipole snap, removal and storage beside DIN projects', () => {
  let fishbone = emptyProject({ boardType: 'fishbone', fishbone: createFishboneConfig(12, 'bi', 'alternating'), supply: 'bi', voltage: 220, rails: 1, modulesPerRail: 16 });
  assert.equal(fishbone.devices.filter(device => device.type === 'fishbone-bus').length, 1);
  fishbone = addDevice(fishbone, 'breaker-2p', { rail: 0, slot: 0, fishboneSlotId: 'left-1' });
  const breaker = fishbone.devices.at(-1)!;
  assert.equal(fishbonePhase(fishbone, breaker), 'R/S');
  assert.deepEqual(fishboneSlotsFor(fishbone, breaker).map(slot => slot.id), ['left-1', 'left-2']);
  assert.throws(() => addDevice(fishbone, 'breaker-1p', { rail: 0, slot: 0, fishboneSlotId: 'left-2' }), /ocupada/);
  fishbone = prepareCircuitOutputs({ ...fishbone, circuits: [loadCircuit({ phase: 'R/S', voltage: 220, hasNeutral: false })] });
  const output = fishbone.devices.find(device => device.type === 'conduit-entry')!;
  const phases = output.terminals.filter(term => term.kind === 'L');
  fishbone = connect(fishbone, endpoint(output.id, phases[0].id), endpoint(breaker.id, 'bottom-0'), options);
  fishbone = connect(fishbone, endpoint(output.id, phases[1].id), endpoint(breaker.id, 'bottom-1'), options);
  assert.equal(fishbone.circuits[0].breakerId, breaker.id);
  assert.equal(fishbone.circuits[0].phase, 'R/S');
  assert.equal(fishbone.devices.find(device => device.id === breaker.id)?.circuitId, 'c1');
  fishbone = moveFishboneBreaker(fishbone, breaker.id, 'right-2');
  assert.equal(fishbonePhase(fishbone, fishbone.devices.find(device => device.id === breaker.id)!), 'R/S');
  assert.ok(validateProject(fishbone));
  const din = addDevice(emptyProject(), 'breaker-1p');
  assert.ok(validateProject(din));
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  saveProjects(storage, 'user', [din, fishbone], fishbone.id);
  const loaded = loadProjects(storage, 'user');
  assert.equal(loaded.error, '');
  assert.deepEqual(loaded.projects[1].fishbone, fishbone.fishbone);
  assert.equal(loaded.projects[1].devices.find(device => device.id === breaker.id)?.fishboneSlotId, 'right-2');
  const removed = deleteSelection(fishbone, { devices: [breaker.id], wire: null });
  assert.equal(fishboneSlotIssue(removed, createDevice('breaker-1p'), 'right-2'), null);
  assert.ok(validateProject(removed));
});

test('fishbone respects disabled and occupied slots and requires drawn feed per phase', () => {
  let project = emptyProject({ boardType: 'fishbone', fishbone: createFishboneConfig(18, 'tri', 'paired'), supply: 'tri', voltage: 380, rails: 1, modulesPerRail: 16 });
  project = addDevice(project, 'breaker-3p', { rail: 0, slot: 0, fishboneSlotId: 'left-1' });
  const breaker = project.devices.at(-1)!;
  assert.equal(fishbonePhase(project, breaker), 'R/S/T');
  assert.equal(fishboneSlotIssue(project, createDevice('breaker-1p'), 'left-2'), 'Uma das posições já está ocupada.');
  assert.equal(warnings(project).filter(warning => warning.id.startsWith('fishbone-feed-')).length, 3);
  assert.equal(warnings(project).some(warning => warning.id === `terminal-${breaker.id}`), true);
  project = addDevice(project, 'main-breaker', { rail: 0, slot: 0 });
  const general = project.devices.at(-1)!;
  project = connect(project, endpoint(general.id, 'bottom-0'), endpoint(project.devices[0].id, 'feed-0'), options);
  assert.equal(warnings(project).filter(warning => warning.id.startsWith('fishbone-feed-')).length, 2);
  assert.ok(validateProject(project));
  const disabled = { ...project, fishbone: { ...project.fishbone!, slots: project.fishbone!.slots.map(slot => slot.id === 'right-1' ? { ...slot, enabled: false } : slot) } };
  assert.ok(validateProject(disabled));
  assert.match(fishboneSlotIssue(disabled, createDevice('breaker-1p'), 'right-1') ?? '', /habilitadas/);
  const invalid = { ...project, fishbone: { ...project.fishbone!, slots: project.fishbone!.slots.map(slot => slot.id === 'left-2' ? { ...slot, enabled: false } : slot) } };
  assert.equal(validateProject(invalid), false);
  assert.throws(() => deleteSelection(project, { devices: [project.devices[0].id], wire: null }), /não pode ser removido/);
});

test('fishbone accepts the physical phase order on both sides while keeping circuit labels canonical', () => {
  let twoPhase = emptyProject({ boardType: 'fishbone', fishbone: createFishboneConfig(12, 'bi', 'alternating'), supply: 'bi', voltage: 220, rails: 1, modulesPerRail: 16 });
  twoPhase = addDevice(twoPhase, 'breaker-2p', { rail: 0, slot: 0, fishboneSlotId: 'right-1' });
  assert.deepEqual(fishboneSlotsFor(twoPhase, twoPhase.devices.at(-1)!).map(slot => slot.phase), ['S', 'R']);
  assert.equal(fishbonePhase(twoPhase, twoPhase.devices.at(-1)!), 'R/S');
  assert.ok(validateProject(twoPhase));

  let threePhase = emptyProject({ boardType: 'fishbone', fishbone: createFishboneConfig(18, 'tri', 'alternating'), supply: 'tri', voltage: 380, rails: 1, modulesPerRail: 16 });
  threePhase = addDevice(threePhase, 'breaker-3p', { rail: 0, slot: 0, fishboneSlotId: 'right-1' });
  assert.deepEqual(fishboneSlotsFor(threePhase, threePhase.devices.at(-1)!).map(slot => slot.phase), ['S', 'T', 'R']);
  assert.equal(fishbonePhase(threePhase, threePhase.devices.at(-1)!), 'R/S/T');
  assert.ok(validateProject(threePhase));

  let singlePhase = emptyProject({ boardType: 'fishbone', fishbone: createFishboneConfig(12, 'mono', 'paired'), supply: 'mono', voltage: 127, rails: 1, modulesPerRail: 16 });
  singlePhase = addDevice(singlePhase, 'breaker-1p', { rail: 0, slot: 0, fishboneSlotId: 'left-1' });
  assert.equal(fishbonePhase(singlePhase, singlePhase.devices.at(-1)!), 'R');
  assert.ok(validateProject(singlePhase));
});

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

test('visual device models change only appearance and reject unknown imported values', () => {
  let project = addDevice(emptyProject(), 'breaker-2p');
  const original = structuredClone(project.devices[0]);
  project = updateDevice(project, original.id, { visualModel: 'graphite' });
  const changed = project.devices[0];
  assert.equal(changed.visualModel, 'graphite');
  assert.equal(changed.type, original.type);
  assert.equal(changed.modules, original.modules);
  assert.deepEqual(changed.terminals, original.terminals);
  assert.ok(validateProject(project));
  assert.equal(validateProject({ ...project, devices: [{ ...changed, visualModel: 'fabricante-inventado' }] }), false);
});

test('project appearance, supply phase labels and neutral DPS are persisted and validated', () => {
  const project = emptyProject({ visualModel: 'graphite', dpsVisual: 'red' });
  assert.equal(project.visualModel, 'graphite');
  assert.equal(project.dpsVisual, 'red');
  assert.deepEqual(buildTerminals('power-entry', 3).map(terminal => terminal.label), ['R', 'N', 'PE']);
  assert.deepEqual(buildTerminals('power-entry', 4).map(terminal => terminal.label), ['R', 'S', 'N', 'PE']);
  assert.deepEqual(buildTerminals('power-entry', 5).map(terminal => terminal.label), ['R', 'S', 'T', 'N', 'PE']);
  assert.equal(buildSpdTerminals('neutral')[0].kind, 'N');
  let withDps = addDevice(project, 'spd');
  withDps = updateDevice(withDps, withDps.devices[0].id, { spdInput: 'neutral', visualRotation: 180 });
  assert.equal(withDps.devices[0].terminals[0].label, 'N');
  assert.equal(withDps.devices[0].visualRotation, 180);
  assert.ok(validateProject(withDps));
  assert.equal(validateProject({ ...withDps, dpsVisual: 'fluorescent' }), false);
});

test('stored v2 projects are normalized before strict validation', () => {
  let project = addDevice(emptyProject(), 'power-entry');
  project = addDevice(project, 'spd', { rail: 0, slot: 0 });
  project = {
    ...project,
    wires: [{
      id: 'legacy-neutral-dps', sourceComponent: project.devices[0].id, sourceTerminal: 'edge-1',
      targetComponent: project.devices[1].id, targetTerminal: 'top-0', conductorType: 'neutral',
      color: '#1686cf', gauge: 2.5, label: 'N', path: [],
    }, {
      id: 'legacy-invalid-dps', sourceComponent: project.devices[0].id, sourceTerminal: 'edge-2',
      targetComponent: project.devices[1].id, targetTerminal: 'top-0', conductorType: 'earth',
      color: '#24a15c', gauge: 2.5, label: 'PE inválido', path: [],
    }],
  };
  const legacy = {
    ...project,
    visualModel: undefined,
    dpsVisual: undefined,
    devices: project.devices.map(device => device.type === 'power-entry'
      ? { ...device, label: 'Entrada da rede', edgeOffset: 16, canvasPosition: undefined, terminals: device.terminals.map(terminal => ({ ...terminal, label: terminal.kind === 'L' ? 'L1' : terminal.label })) }
      : device.type === 'spd' ? { ...device, spdInput: undefined } : device),
  };
  const storage = {
    getItem: (key: string) => key.startsWith('eletricaweb-qdc-v2:') ? JSON.stringify({ version: 2, activeId: project.id, projects: [legacy] }) : null,
    setItem: () => undefined,
  };
  const loaded = loadProjects(storage, 'user');
  assert.equal(loaded.error, '');
  assert.equal(loaded.migrated, true);
  assert.deepEqual(loaded.projects[0].wires.map(wire => wire.id), ['legacy-neutral-dps']);
  assert.equal(loaded.projects[0].visualModel, 'classic');
  assert.equal(loaded.projects[0].dpsVisual, 'red');
  assert.equal(loaded.projects[0].devices[0].edgeOffset, 88);
  assert.deepEqual(loaded.projects[0].devices[0].terminals.map(terminal => terminal.label), ['R', 'N', 'PE']);
  assert.equal(loaded.projects[0].devices[1].spdInput, 'neutral');
  assert.equal(loaded.projects[0].devices[1].terminals[0].kind, 'N');
});

test('spare bus and conduit terminals stay quiet while a fed comb covers matching terminals', () => {
  let project = emptyProject({ rails: 2, modulesPerRail: 8 });
  project = addDevice(project, 'spd', { rail: 0, slot: 0 });
  project = addDevice(project, 'spd', { rail: 0, slot: 1 });
  project = addDevice(project, 'comb-bus', { rail: 0, slot: 0 });
  project = updateDevice(project, project.devices.at(-1)!.id, { modules: 2, poles: 1, combSide: 'bottom' });
  project = addDevice(project, 'earth-bus', { rail: 1, slot: 0 });
  project = addDevice(project, 'conduit-entry');
  project = connect(project, endpoint(project.devices[0].id, 'bottom-0'), endpoint(project.devices[3].id, 'side-0'), { ...options, conductorType: 'earth', color: '#24a15c' });
  const notices = warnings(project);
  assert.equal(notices.some(notice => notice.id === `terminal-${project.devices[3].id}`), false);
  assert.equal(notices.some(notice => notice.id === `terminal-${project.devices[4].id}`), false);
  assert.match(notices.find(notice => notice.id === `terminal-${project.devices[1].id}`)?.message ?? '', /2 terminal/);
});

test('comb electrical coverage does not turn a phase terminal into PE', () => {
  let project = emptyProject({ rails: 2, modulesPerRail: 8 });
  project = addDevice(project, 'spd', { rail: 0, slot: 0 });
  project = addDevice(project, 'breaker-1p', { rail: 0, slot: 1 });
  project = addDevice(project, 'comb-bus', { rail: 0, slot: 0 });
  project = updateDevice(project, project.devices[2].id, { poles: 1, modules: 2, combSide: 'bottom' });
  project = addDevice(project, 'earth-bus', { rail: 1, slot: 0 });
  project = connect(project, endpoint(project.devices[0].id, 'bottom-0'), endpoint(project.devices[3].id, 'side-0'), { ...options, conductorType: 'earth', color: '#24a15c' });
  assert.match(warnings(project).find(notice => notice.id === `terminal-${project.devices[1].id}`)?.message ?? '', /2 terminal/);
});

test('manual circuits prepare separate conduit leads without inventing electrical connections', () => {
  const circuits = Array.from({ length: 5 }, (_, index) => loadCircuit({ id: `manual-${index}`, number: index + 1, name: `Circuito ${index + 1}` }));
  const base = emptyProject({ circuits });
  const prepared = prepareCircuitOutputs(base);
  const outputs = prepared.devices.filter(device => device.type === 'conduit-entry');
  assert.equal(outputs.length, 5);
  assert.deepEqual(outputs.map(device => device.terminals.length), [3, 3, 3, 3, 3]);
  assert.equal(prepared.wires.length, 0);
  for (const circuit of circuits) assert.ok(outputs.some(device => device.terminals.some(term => term.id === `circuit-${circuit.id}-l`)));
  assert.ok(validateProject(prepared));
  const rotated = updateDevice(prepared, outputs[0].id, { visualRotation: 180, label: 'Saída pela lateral' });
  assert.deepEqual(rotated.devices.find(device => device.id === outputs[0].id)?.terminals, outputs[0].terminals);
  assert.throws(() => updateDevice(prepared, outputs[0].id, { poles: 4 }), /definidos pelos circuitos/);
  const again = prepareCircuitOutputs(prepared);
  assert.equal(again.devices.length, prepared.devices.length);
  const removed = removeCircuitOutput({ ...prepared, circuits: circuits.slice(1) }, circuits[0].id);
  assert.ok(removed.devices.every(device => device.terminals.every(term => !term.id.startsWith(`circuit-${circuits[0].id}-`))));
  assert.ok(validateProject(removed));
});

test('two circuits can share one conduit without merging conductors or losing breaker links', () => {
  const first = loadCircuit({ id: 'entry-first', number: 1, name: 'Iluminação' });
  const second = loadCircuit({ id: 'entry-second', number: 2, name: 'Tomadas' });
  let project = prepareCircuitOutputs(emptyProject({ circuits: [first] }));
  const conduitId = project.devices[0].id;
  project = prepareCircuitOutputs({ ...project, circuits: [first, second] }, { [second.id]: conduitId });
  assert.equal(project.devices.filter(device => device.type === 'conduit-entry').length, 1);
  assert.equal(project.devices[0].terminals.length, 6);
  assert.equal(new Set(project.devices[0].terminals.map(term => term.id)).size, 6);
  const tip = terminalPoint(project, conduitId, `circuit-${second.id}-l`)!;
  assert.ok(tip.y < deviceRect(project.devices[0], project).y);
  project = addDevice(project, 'breaker-1p', { rail: 0, slot: 0 });
  const breaker = project.devices.at(-1)!;
  assert.match(connectionIssue(project, endpoint(conduitId, `circuit-${first.id}-n`), endpoint(breaker.id, 'bottom-0'), 'neutral') ?? '', /não é compatível/);
  project = connect(project, endpoint(conduitId, `circuit-${first.id}-l`), endpoint(breaker.id, 'bottom-0'), options);
  assert.equal(project.circuits[0].breakerId, breaker.id);
  project = updateCircuit(project, second.id, { name: 'Tomadas gerais' });
  assert.equal(project.devices[0].terminals.length, 6);
  assert.equal(project.wires.length, 1);
  assert.ok(validateProject(project));
});

test('moving a circuit into another conduit preserves its existing wire', () => {
  const first = loadCircuit({ id: 'move-first', number: 1 });
  const second = loadCircuit({ id: 'move-second', number: 2 });
  let project = prepareCircuitOutputs(emptyProject({ circuits: [first, second] }));
  const outputs = project.devices.filter(device => device.type === 'conduit-entry');
  project = addDevice(project, 'breaker-1p', { rail: 0, slot: 0 });
  const breaker = project.devices.at(-1)!;
  project = connect(project, endpoint(outputs[1].id, `circuit-${second.id}-l`), endpoint(breaker.id, 'bottom-0'), options);
  project = moveCircuitToConduit(project, second.id, outputs[0].id);
  assert.equal(project.devices.filter(device => device.type === 'conduit-entry').length, 1);
  assert.equal(project.wires[0].sourceComponent, outputs[0].id);
  assert.equal(project.wires[0].sourceTerminal, `circuit-${second.id}-l`);
  assert.ok(validateProject(project));
  const disconnected = deleteSelection(project, { devices: [], wire: project.wires[0].id });
  assert.equal(disconnected.wires.length, 0);
  assert.equal(disconnected.circuits.length, 2);
  assert.equal(disconnected.devices.find(device => device.id === outputs[0].id)?.terminals.length, 6);
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
  assert.throws(() => updateCircuit(initial, first.id, { breakerId: second.breakerId }), /já está vinculado/);
  const changed = updateCircuit(initial, first.id, { name: 'Oficina', cableGauge: 4, color: '#ff0000' });
  assert.equal(changed.circuits[0].breakerId, first.breakerId);
  assert.equal(changed.circuits[1].breakerId, second.breakerId);
  const changedAgain = updateDevice(changed, first.breakerId!, { gauge: 6, label: 'Ar condicionado' });
  assert.equal(changedAgain.circuits[0].cableGauge, 6);
  assert.equal(changedAgain.circuits[0].name, 'Ar condicionado');
  assert.equal(changedAgain.wires.find(wire => wire.label === 'C1 fase')?.gauge, 6);
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

test('editing an existing wire preserves its connection and saves color and gauge', () => {
  let project = addDevice(emptyProject(), 'breaker-1p');
  project = addDevice(project, 'breaker-1p');
  project = connect(project, endpoint(project.devices[0].id), endpoint(project.devices[1].id), options);
  const before = project.wires[0];
  project = updateWire(project, before.id, { color: '#e03131', gauge: 6 });
  const edited = project.wires[0];
  assert.equal(edited.id, before.id);
  assert.equal(edited.sourceComponent, before.sourceComponent);
  assert.equal(edited.targetComponent, before.targetComponent);
  assert.equal(edited.color, '#e03131');
  assert.equal(edited.gauge, 6);
  assert.ok(validateProject(project));
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  saveProjects(storage, 'user', [project], project.id);
  const loaded = loadProjects(storage, 'user');
  assert.equal(loaded.error, '');
  assert.equal(loaded.projects[0].wires[0].color, '#e03131');
  assert.equal(loaded.projects[0].wires[0].gauge, 6);
});

test('wire operations enforce conductor compatibility with L, N and PE terminals', () => {
  let project = emptyProject({ rails: 2, modulesPerRail: 12 });
  project = addDevice(project, 'breaker-1p', { rail: 0, slot: 0 });
  project = addDevice(project, 'neutral-bus', { rail: 0, slot: 1 });
  project = addDevice(project, 'earth-bus', { rail: 0, slot: 2 });
  const [breaker, neutral, earth] = project.devices;
  assert.match(connectionIssue(project, endpoint(breaker.id), endpoint(neutral.id, 'side-0'), 'phase') ?? '', /não é compatível/);
  assert.equal(connectionIssue(project, endpoint(neutral.id, 'side-0'), endpoint(neutral.id, 'side-1'), 'neutral'), null);
  assert.throws(() => connect(project, endpoint(breaker.id), endpoint(neutral.id, 'side-0'), options), /não é compatível/);
  assert.throws(() => connect(project, endpoint(breaker.id), endpoint(earth.id, 'side-0'), { ...options, conductorType: 'neutral', color: '#1686cf' }), /não é compatível/);
  const validNeutral = connect(project, endpoint(neutral.id, 'side-0'), endpoint(neutral.id, 'side-1'), { ...options, conductorType: 'neutral', color: '#1686cf' });
  assert.ok(validateProject(validNeutral));
  const invalidImported = { ...validNeutral, wires: validNeutral.wires.map(wire => ({ ...wire, conductorType: 'phase' as const })) };
  assert.equal(validateProject(invalidImported), false);
});

test('a free DPS input accepts neutral, changes to N, and keeps PE separate', () => {
  let project = emptyProject({ modulesPerRail: 8 });
  project = addDevice(project, 'neutral-bus', { rail: 0, slot: 0 });
  project = addDevice(project, 'earth-bus', { rail: 0, slot: 1 });
  project = addDevice(project, 'spd', { rail: 0, slot: 2 });
  const [neutral, earth, dps] = project.devices;
  const neutralOptions = { ...options, conductorType: 'neutral' as const, color: '#1686cf' };
  assert.equal(connectionIssue(project, endpoint(neutral.id, 'side-0'), endpoint(dps.id, 'top-0'), 'neutral'), null);
  project = connect(project, endpoint(neutral.id, 'side-0'), endpoint(dps.id, 'top-0'), neutralOptions);
  assert.equal(project.devices.find(device => device.id === dps.id)?.spdInput, 'neutral');
  assert.equal(project.devices.find(device => device.id === dps.id)?.terminals[0].kind, 'N');
  assert.equal(project.wires[0].conductorType, 'neutral');
  assert.match(connectionIssue(project, endpoint(neutral.id, 'side-1'), endpoint(dps.id, 'bottom-0'), 'neutral') ?? '', /não é compatível/);
  project = connect(project, endpoint(earth.id, 'side-0'), endpoint(dps.id, 'bottom-0'), { ...options, conductorType: 'earth', color: '#27854c' });
  assert.ok(validateProject(project));
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  saveProjects(storage, 'user', [project], project.id);
  const loaded = loadProjects(storage, 'user');
  assert.equal(loaded.error, '');
  assert.equal(loaded.projects[0].devices.find(device => device.id === dps.id)?.spdInput, 'neutral');
  assert.deepEqual(loaded.projects[0].wires.map(wire => wire.conductorType), ['neutral', 'earth']);

  let fed = addDevice(emptyProject({ modulesPerRail: 8 }), 'breaker-1p', { rail: 0, slot: 0 });
  fed = addDevice(fed, 'neutral-bus', { rail: 0, slot: 1 });
  fed = addDevice(fed, 'spd', { rail: 0, slot: 2 });
  fed = connect(fed, endpoint(fed.devices[0].id), endpoint(fed.devices[2].id), options);
  assert.match(connectionIssue(fed, endpoint(fed.devices[1].id, 'side-0'), endpoint(fed.devices[2].id), 'neutral') ?? '', /não é compatível/);
});

test('RCBO can be linked as combined breaker and residual-current protection', () => {
  let project = addDevice(emptyProject(), 'rcbo-2p');
  const rcbo = project.devices[0];
  const circuit = loadCircuit({ breakerId: rcbo.id, drId: rcbo.id });
  project = { ...project, circuits: [circuit], devices: [{ ...rcbo, circuitId: circuit.id }] };
  const changed = updateCircuit(project, circuit.id, { drId: rcbo.id });
  assert.equal(changed.circuits[0].drId, rcbo.id);
  assert.ok(validateProject(changed));
});

test('recalculating wires preserves component placement and discards manual paths', () => {
  let project = emptyProject({ rails: 1, modulesPerRail: 6 });
  project = addDevice(project, 'breaker-1p', { rail: 0, slot: 0 });
  project = addDevice(project, 'breaker-1p', { rail: 0, slot: 4 });
  project = connect(project, endpoint(project.devices[0].id, 'bottom-0'), endpoint(project.devices[1].id), options);
  project = { ...project, wires: project.wires.map(wire => ({ ...wire, manualPath: true })) };
  const positions = project.devices.map(device => ({ id: device.id, rail: device.rail, slot: device.slot }));
  const rerouted = rerouteWires(project);
  assert.deepEqual(rerouted.devices.map(device => ({ id: device.id, rail: device.rail, slot: device.slot })), positions);
  assert.ok(rerouted.wires.every(wire => wire.manualPath === false));
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

test('smart organization groups devices by function, keeps circuit rows together and realigns comb buses', () => {
  let mixed = emptyProject({ rails: 2, modulesPerRail: 12 });
  for (const type of ['contactor', 'breaker-1p', 'neutral-bus', 'rcd-2p', 'spd', 'main-breaker']) mixed = addDevice(mixed, type);
  const organized = organize(mixed);
  const orderedTypes = organized.devices.filter(isRailMounted).sort((a, b) => a.rail - b.rail || a.slot - b.slot).map(device => device.type);
  assert.deepEqual(orderedTypes, ['main-breaker', 'spd', 'rcd-2p', 'breaker-1p', 'contactor', 'neutral-bus']);
  assert.ok(organized.devices.every(device => fits(organized, device)));

  const compact = organize(automaticProject({ supply: 'mono', rails: 2, modulesPerRail: 8 }, ['Luz', 'Tomadas', 'Cozinha']));
  const breakers = compact.devices.filter(device => device.type === 'breaker-1p' && device.circuitId).sort((a, b) => a.slot - b.slot);
  assert.equal(new Set(breakers.map(device => device.rail)).size, 1, 'a circuit group that fits one rail should not be split');
  const comb = compact.devices.find(device => device.type === 'comb-bus')!;
  assert.equal(comb.rail, breakers[0].rail);
  assert.equal(comb.slot, breakers[0].slot);
  assert.equal(comb.modules, breakers.reduce((total, device) => total + device.modules, 0));
  assert.ok(compact.wires.every(wire => pathAvoidsDevices(wire.path, compact.devices, compact)));
  assert.ok(validateProject(compact));

  const demo = organize(demoProject());
  const neutral = demo.devices.find(device => device.type === 'neutral-bus')!;
  const earth = demo.devices.find(device => device.type === 'earth-bus')!;
  assert.equal(neutral.rail, 1);
  assert.equal(neutral.slot, 0);
  assert.equal(neutral.busTerminalSide, 'left');
  assert.equal(earth.rail, 1);
  assert.equal(earth.slot, demo.modulesPerRail - earth.modules);
  assert.equal(earth.busTerminalSide, 'right');
  assert.ok(demo.wires.every(wire => wire.path.length > 0), 'organizing must not introduce unroutable wires');
  const manuallyRouted = demoProject();
  manuallyRouted.wires[0].manualPath = true;
  const preserved = organize(manuallyRouted);
  assert.equal(preserved.wires[0].manualPath, true, 'an unobstructed manual route should survive organization');
});

test('automatic proposal and demo preserve unknown electrical settings and valid links', () => {
  assert.equal(automaticRequiredModules('mono', 10), 16);
  assert.equal(automaticRequiredModules('bi', 10), 20);
  assert.equal(automaticRequiredModules('tri', 10), 22);
  const demo = demoProject();
  const notices = warnings(demo);
  assert.equal(demo.supply, 'mono');
  assert.equal(demo.voltage, 220);
  assert.equal(demo.circuits.length, 5);
  assert.equal(demo.devices.filter(device => device.type === 'comb-bus').length, 1);
  assert.ok(demo.devices.some(device => device.type === 'neutral-bus'));
  assert.ok(demo.devices.some(device => device.type === 'earth-bus'));
  assert.equal(demo.devices.filter(device => device.type === 'conduit-entry').length, 2);
  for (const circuit of demo.circuits) {
    const outputWires = demo.wires.filter(wire => wire.label.startsWith(`C${circuit.number} `));
    assert.deepEqual(outputWires.map(wire => wire.conductorType).sort(), ['earth', 'neutral', 'phase']);
    assert.ok(outputWires.every(wire => demo.devices.find(device => device.id === wire.targetComponent)?.type === 'conduit-entry'));
    assert.ok(outputWires.every(wire => wire.gauge === null), 'automatic outputs must not invent a conductor section');
  }
  assert.ok(demo.wires.length > 5);
  assert.ok(demo.wires.every(wire => wire.path.length > 0), 'automatic proposals must not contain unroutable wires');
  assert.equal(notices.filter(notice => notice.severity === 'error').length, 0);
  assert.equal(notices.filter(notice => notice.severity === 'warning').length, 0);
  assert.ok(notices.every(notice => notice.severity === 'info'));
  assert.ok(notices.filter(notice => notice.id.startsWith('load-') || notice.id.startsWith('cable-')).every(notice => notice.circuitId));
  for (let i = 0; i < demo.wires.length; i++) for (let j = i + 1; j < demo.wires.length; j++) {
    if (pathOverlapLength(demo.wires[i].path, demo.wires[j].path) === 0) continue;
    const sharedSource = demo.wires[i].sourceComponent === demo.wires[j].sourceComponent && demo.wires[i].sourceTerminal === demo.wires[j].sourceTerminal;
    const sharedTarget = demo.wires[i].targetComponent === demo.wires[j].targetComponent && demo.wires[i].targetTerminal === demo.wires[j].targetTerminal;
    assert.ok(sharedSource || sharedTarget, 'only the short exit of a genuinely shared terminal may overlap');
  }
  assert.ok(validateProject(demo));
  const crowded = automaticProject({ supply: 'mono', voltage: 220, rails: 2, modulesPerRail: 12 }, Array.from({ length: 10 }, (_, index) => `Circuito ${index + 1}`));
  const crowdedCombs = crowded.devices.filter(device => device.type === 'comb-bus').sort((a, b) => a.rail - b.rail);
  assert.equal(crowdedCombs.length, 2, 'each contiguous breaker row needs its own comb bus');
  for (const comb of crowdedCombs) {
    const covered = crowded.devices.filter(device => device.type === 'breaker-1p' && device.rail === comb.rail && device.slot >= comb.slot && device.slot + device.modules <= comb.slot + comb.modules);
    assert.ok(covered.length > 1);
    assert.equal(comb.slot, Math.min(...covered.map(device => device.slot)));
    assert.equal(comb.slot + comb.modules, Math.max(...covered.map(device => device.slot + device.modules)));
    assert.ok(fits(crowded, comb));
  }
  const crowdedBreakerIds = new Set(crowded.circuits.map(circuit => circuit.breakerId));
  const crowdedFeeds = crowded.wires.filter(wire => wire.conductorType === 'phase' && crowdedBreakerIds.has(wire.targetComponent));
  assert.equal(crowdedFeeds.length, crowdedCombs.length, 'each comb bus group needs one phase feed');
  assert.ok(crowded.wires.every(wire => wire.path.length > 0));
  assert.ok(validateProject(crowded));
  const tri = automaticProject({ supply: 'tri', voltage: 220, rails: 3, modulesPerRail: 12 }, ['Luz', 'Tomadas', 'Motor']);
  assert.deepEqual(tri.circuits.map(circuit => circuit.phase), ['R', 'S', 'T']);
  assert.ok(tri.circuits.every(circuit => circuit.load === null && circuit.cableGauge === null));
  const triDense = automaticProject({ supply: 'tri', voltage: 220, rails: 2, modulesPerRail: 12 }, ['Luz', 'Tomadas', 'Motor', 'Copa', 'Ar-condicionado']);
  const triNeutral = triDense.devices.find(device => device.type === 'neutral-bus')!;
  const triEarth = triDense.devices.find(device => device.type === 'earth-bus')!;
  assert.deepEqual([triNeutral.rail, triNeutral.slot, triNeutral.busTerminalSide], [1, 0, 'left']);
  assert.deepEqual([triEarth.rail, triEarth.slot, triEarth.busTerminalSide], [1, 11, 'right']);
  assert.ok(triDense.wires.every(wire => wire.path.length > 0), 'dense three-phase proposals must preserve every routed wire');
  assert.ok(tri.devices.every(device => device.amperage === null && device.gauge === null));
  assert.ok(validateProject(tri));
  const maximumPreset = automaticProject({ supply: 'mono', voltage: 220, rails: 4, modulesPerRail: 12 }, Array.from({ length: 40 }, (_, index) => `Circuito ${index + 1}`));
  const maximumOutputs = maximumPreset.devices.filter(device => device.type === 'conduit-entry');
  assert.equal(maximumOutputs.length, 5);
  assert.equal(maximumPreset.devices.filter(device => device.type === 'neutral-bus').length, 2);
  assert.equal(maximumPreset.devices.filter(device => device.type === 'earth-bus').length, 2);
  assert.ok(maximumPreset.wires.every(wire => wire.path.length > 0));
  for (let i = 0; i < maximumOutputs.length; i++) for (let j = i + 1; j < maximumOutputs.length; j++) {
    const first = deviceRect(maximumOutputs[i], maximumPreset), second = deviceRect(maximumOutputs[j], maximumPreset);
    assert.ok(first.x + first.width <= second.x || second.x + second.width <= first.x, 'automatic circuit outputs must not overlap');
  }
  assert.ok(validateProject(maximumPreset));
  assert.throws(() => automaticProject({ rails: 1, modulesPerRail: 8 }, ['Luz', 'Tomadas', 'Cozinha', 'Chuveiro']), /não comporta/);
});

test('canvas focus isolates the selected circuit without hiding shared infrastructure', () => {
  const project = demoProject();
  const circuit = project.circuits[0];
  const breakerFocus = canvasFocus(project, { devices: [circuit.breakerId!], wire: null })!;
  assert.ok(breakerFocus.deviceIds.has(circuit.breakerId!));
  assert.deepEqual([...breakerFocus.wireIds].map(id => project.wires.find(wire => wire.id === id)!.label).filter(Boolean).sort(), ['C1 PE', 'C1 fase', 'C1 neutro']);
  assert.equal([...breakerFocus.wireIds].filter(id => !project.wires.find(wire => wire.id === id)!.label).length, 1, 'the breaker feed remains in context');
  const neutralWire = project.wires.find(wire => wire.label === 'C1 neutro')!;
  assert.deepEqual(canvasFocus(project, { devices: [], wire: neutralWire.id })!.wireIds, breakerFocus.wireIds);
  const output = project.devices.find(device => device.type === 'conduit-entry' && device.label.includes('C1'))!;
  assert.equal(canvasFocus(project, { devices: [output.id], wire: null })!.wireIds.size, 12);
  assert.equal(canvasFocus(project, { devices: [], wire: null }), null);
});

test('breaker identification creates and keeps a circuit without adding layout prefixes', () => {
  let project = addDevice(emptyProject(), 'breaker-1p');
  const breaker = project.devices[0];
  project = updateDevice(project, breaker.id, { label: 'Tomadas cozinha' });
  assert.equal(project.circuits.length, 1);
  assert.equal(project.circuits[0].name, 'Tomadas cozinha');
  assert.equal(project.circuits[0].breakerId, breaker.id);
  assert.equal(project.devices[0].label, 'Tomadas cozinha');
  assert.ok(project.devices.some(device => device.terminals.some(term => term.id === `circuit-${project.circuits[0].id}-l`)));
  assert.equal(project.wires.length, 0, 'the outgoing conductors remain available for manual connection');
  project = updateDevice(project, breaker.id, { label: 'Forno elétrico' });
  assert.equal(project.circuits.length, 1);
  assert.equal(project.circuits[0].name, 'Forno elétrico');
  assert.equal(project.devices.filter(device => device.terminals.some(term => term.id === `circuit-${project.circuits[0].id}-l`)).length, 1);
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
  assert.equal(entry.edgeOffset, 88);
  assert.deepEqual(entry.terminals.map(terminal => terminal.kind), ['L', 'N', 'PE']);
  assert.throws(() => connect(project, endpoint(comb.id), endpoint(breaker.id), options), /existentes/);
  project = connect(project, endpoint(entry.id, 'edge-0'), endpoint(breaker.id), options);
  assert.equal(project.wires[0].sourceTermination, 'tubular');
  assert.ok(project.wires[0].path.length);
  assert.ok(validateProject(project));
});

test('edge entries can move freely inside the plan and keep their wire endpoints aligned', () => {
  let project = emptyProject({ rails: 1, modulesPerRail: 8 });
  project = addDevice(project, 'power-entry');
  project = addDevice(project, 'conduit-entry');
  project = addDevice(project, 'breaker-1p', { rail: 0, slot: 0 });
  const entry = project.devices[0], breaker = project.devices[2];
  project = connect(project, endpoint(entry.id, 'edge-0'), endpoint(breaker.id, 'top-0'), options);
  project = moveDeviceOnPlane(project, entry.id, { x: 220, y: 270 });
  const moved = project.devices.find(device => device.id === entry.id)!;
  assert.deepEqual(moved.canvasPosition, { x: 220, y: 270 });
  assert.deepEqual(project.wires[0].path[0], terminalPoint(project, entry.id, 'edge-0'));
  assert.throws(() => moveDeviceOnPlane(project, entry.id, { x: 700, y: 400 }), /dentro do quadro/);
  assert.ok(validateProject(project));
});

test('buses rotate, comb bars can use either terminal side and new overlays find another space', () => {
  let project = emptyProject({ rails: 2, modulesPerRail: 12 });
  project = addDevice(project, 'neutral-bus', { rail: 0, slot: 5 });
  const neutral = project.devices[0];
  const vertical = deviceRect(neutral, project);
  project = updateDevice(project, neutral.id, { orientation: 'horizontal' });
  const horizontal = deviceRect(project.devices[0], project);
  assert.ok(vertical.height > vertical.width);
  assert.ok(horizontal.width > horizontal.height);
  assert.equal(terminalPoint(project, neutral.id, 'side-0')?.y, horizontal.y + horizontal.height);
  project = updateDevice(project, neutral.id, { orientation: 'vertical', busTerminalSide: 'left' });
  const leftFacing = deviceRect(project.devices[0], project);
  assert.equal(terminalPoint(project, neutral.id, 'side-0')?.x, leftFacing.x);
  project = addDevice(project, 'comb-bus');
  project = addDevice(project, 'comb-bus');
  const combs = project.devices.filter(device => device.type === 'comb-bus');
  assert.equal(combs.length, 2);
  assert.notDeepEqual([combs[0].rail, combs[0].slot], [combs[1].rail, combs[1].slot]);
  assert.equal(combs[0].combSide, 'bottom');
  project = updateDevice(project, combs[0].id, { combSide: 'top' });
  const top = deviceRect(project.devices.find(device => device.id === combs[0].id)!, project);
  project = updateDevice(project, combs[0].id, { combSide: 'bottom' });
  const bottom = deviceRect(project.devices.find(device => device.id === combs[0].id)!, project);
  assert.ok(bottom.y > top.y);
  assert.ok(validateProject(project));
});

test('manual wire paths survive routing and generic connectors and added colors are available', () => {
  let project = emptyProject({ rails: 1, modulesPerRail: 8 });
  project = addDevice(project, 'breaker-1p', { rail: 0, slot: 0 });
  project = addDevice(project, 'breaker-1p', { rail: 0, slot: 5 });
  project = connect(project, endpoint(project.devices[0].id), endpoint(project.devices[1].id), { ...options, termination: 'generico' });
  const wire = project.wires[0];
  const manualPath = [wire.path[0], { x: wire.path[0].x, y: 40 }, { x: wire.path.at(-1)!.x, y: 40 }, wire.path.at(-1)!];
  project = routeWires({ ...project, wires: [{ ...wire, manualPath: true, path: manualPath }] });
  assert.deepEqual(project.wires[0].path.slice(1, -1), manualPath.slice(1, -1));
  assert.equal(project.wires[0].sourceTermination, 'generico');
  assert.ok(TERMINATION_OPTIONS.some(option => option.value === 'generico'));
  for (const color of ['Azul', 'Verde', 'Branco', 'Amarelo']) assert.ok(WIRE_COLORS.phase.some(option => option.label === color));
  assert.ok(validateProject(project));
});

test('wire shaping flexes segments, rounds bends and stays attached orthogonally', () => {
  const path = [{ x: 0, y: 0 }, { x: 0, y: 40 }, { x: 80, y: 40 }, { x: 80, y: 100 }];
  const orthogonal = (candidate: typeof path) => candidate.slice(1).every((point, index) => point.x === candidate[index].x || point.y === candidate[index].y);

  const drawing = roundedWirePath(path);
  assert.match(drawing, /^M 0 0/);
  assert.match(drawing, / Q /);
  assert.match(drawing, /L 80 100$/);

  const flexed = flexWireSegment(path, 1, { x: 40, y: 64 });
  assert.deepEqual(flexed[0], path[0]);
  assert.deepEqual(flexed.at(-1), path.at(-1));
  assert.ok(flexed.some(point => point.y === 64));
  assert.ok(orthogonal(flexed));

  const bent = bendWirePoint(path, 1, { x: 20, y: 28 });
  assert.deepEqual(bent[0], path[0]);
  assert.deepEqual(bent.at(-1), path.at(-1));
  assert.ok(orthogonal(bent));
  assert.ok(bent.some(point => point.x === 20 && point.y === 28), 'the bend must follow both axes of the pointer');

  const snapped = snapWirePoint({ x: 37, y: 62 }, [10, 40, 90], [18, 64], 4);
  assert.deepEqual(snapped, { point: { x: 40, y: 64 }, guide: { x: 40, y: 64 } });
  const free = snapWirePoint({ x: 30, y: 50 }, [40], [64], 4);
  assert.deepEqual(free, { point: { x: 30, y: 50 }, guide: { x: null, y: null } });

  const dogleg = [{ x: 0, y: 0 }, { x: 0, y: 30 }, { x: 20, y: 30 }, { x: 20, y: 70 }, { x: 0, y: 70 }, { x: 0, y: 100 }];
  const simplified = removeWireBend(dogleg, 2);
  assert.deepEqual(simplified, [{ x: 0, y: 0 }, { x: 0, y: 100 }]);
  assert.ok(orthogonal(simplified));

  const reattached = reattachManualWirePath(path, { x: 10, y: 10 }, { x: 90, y: 110 });
  assert.deepEqual(reattached[0], { x: 10, y: 10 });
  assert.deepEqual(reattached.at(-1), { x: 90, y: 110 });
  assert.ok(orthogonal(reattached));
});

test('manual routes keep their bends across repeated endpoint moves and endpoint segment edits', () => {
  const paths = [
    [{ x: 0, y: 0 }, { x: 0, y: 40 }, { x: 80, y: 40 }, { x: 80, y: 100 }],
    [{ x: 0, y: 0 }, { x: 0, y: 40 }, { x: 80, y: 40 }, { x: 80, y: 100 }, { x: 140, y: 100 }],
    [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 100 }],
    [{ x: 0, y: 0 }, { x: 0, y: 100 }],
  ];
  for (const path of paths) {
    const original = structuredClone(path);
    for (let index = 0; index < path.length - 1; index++) {
      const flexed = flexWireSegment(path, index, { x: 25, y: 65 });
      assert.deepEqual(flexed[0], path[0]);
      assert.deepEqual(flexed.at(-1), path.at(-1));
      assert.ok(flexed.slice(1).every((p, i) => p.x === flexed[i].x || p.y === flexed[i].y));
    }
    let moved = path;
    for (let step = 1; step <= 4; step++) {
      const source = { x: 10 * step, y: 5 * step }, target = { x: 160 - step * 8, y: 130 + step * 6 };
      moved = reattachManualWirePath(moved, source, target);
      assert.deepEqual(moved[0], source);
      assert.deepEqual(moved.at(-1), target);
      assert.ok(moved.slice(1).every((p, i) => p.x === moved[i].x || p.y === moved[i].y));
      assert.deepEqual(reattachManualWirePath(moved, source, target), moved);
    }
    assert.deepEqual(path, original);
  }
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
  const oldEntry = oldStyle.devices.find(device => device.type === 'power-entry')!;
  oldEntry.edgeOffset = 16;
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
  assert.equal(normalized.devices.find(device => device.type === 'power-entry')?.edgeOffset, 88);
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
  const two = loadCircuit({ id: 'c2', number: 2, phase: 'R/S', hasNeutral: false, load: 2200, voltage: 220 });
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
