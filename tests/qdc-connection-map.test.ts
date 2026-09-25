import test from 'node:test';
import assert from 'node:assert/strict';
import { circuitConnectionMap, connectionEndpointLabel } from '../src/features/qdc/circuits/connectionMap.ts';
import { demoProject, emptyProject } from '../src/features/qdc/projects/factory.ts';
import { circuitFromDraft, newCircuitDraft } from '../src/features/qdc/circuits/circuitDraft.ts';
import { addDevice, connect, prepareCircuitOutputs } from '../src/features/qdc/editor/operations.ts';

test('connection map traces the three drawn conductor paths without other circuit outputs', () => {
  const project = demoProject();
  const circuit = project.circuits[0];
  const map = circuitConnectionMap(project, circuit);
  assert.ok(map.routes.every(route => route.complete));
  assert.ok(map.deviceIds.has(circuit.breakerId!));
  assert.ok([...map.deviceIds].some(id => project.devices.find(device => device.id === id)?.type === 'power-entry'));
  assert.ok([...map.deviceIds].some(id => project.devices.find(device => device.id === id)?.type === 'conduit-entry'));
  assert.ok([...map.wireIds].some(id => project.wires.find(wire => wire.id === id)?.label === 'C1 fase'));
  assert.ok(![...map.wireIds].some(id => /^C[2-9] (?:fase|neutro|PE)/.test(project.wires.find(wire => wire.id === id)?.label ?? '')));
  const first = map.routes[0].steps[0];
  assert.match(connectionEndpointLabel(project, first.from), /·/);
  const secondCircuit = circuitConnectionMap(project, project.circuits[1]);
  const comb = project.devices.find(device => device.type === 'comb-bus');
  if (comb) assert.ok(secondCircuit.deviceIds.has(comb.id), 'the comb used by the traced path is highlighted');
});

test('connection map reports a partial path instead of crossing a missing wire', () => {
  const project = demoProject();
  const circuit = project.circuits[0];
  const phaseOutput = project.wires.find(wire => wire.label === 'C1 fase')!;
  const broken = { ...project, wires: project.wires.filter(wire => wire.id !== phaseOutput.id) };
  const map = circuitConnectionMap(broken, circuit);
  const phase = map.routes.find(route => route.kind === 'phase')!;
  assert.equal(phase.complete, false);
  assert.ok(phase.steps.length > 0, 'the breaker-side partial segment remains visible');
  assert.equal(map.wireIds.has(phaseOutput.id), false);
  assert.ok(map.routes.filter(route => route.kind !== 'phase').every(route => route.complete));
});

test('unconnected circuit is not presented as a complete route', () => {
  const project = demoProject();
  const empty = { ...project, wires: [] };
  const map = circuitConnectionMap(empty, empty.circuits[0]);
  assert.ok(map.routes.every(route => !route.complete && route.steps.length === 0));
  assert.equal(map.wireIds.size, 0);
});

test('two-phase route stays partial while one incoming phase is missing', () => {
  const circuit = circuitFromDraft({ ...newCircuitDraft('bi', 1, 220), name: 'Carga entre fases', hasNeutral: false, hasEarth: false }, 1);
  let project = prepareCircuitOutputs({ ...emptyProject({ supply: 'bi', voltage: 220 }), circuits: [circuit] });
  project = addDevice(project, 'power-entry');
  project = addDevice(project, 'breaker-2p');
  const output = project.devices.find(device => device.type === 'conduit-entry')!;
  const entry = project.devices.find(device => device.type === 'power-entry')!;
  const breaker = project.devices.find(device => device.type === 'breaker-2p')!;
  const options = { conductorType: 'phase' as const, color: '#20252b', gauge: 2.5, termination: 'tubular' as const };
  project = connect(project, { componentId: entry.id, terminalId: 'edge-0' }, { componentId: breaker.id, terminalId: 'top-0' }, options);
  project = connect(project, { componentId: output.id, terminalId: `circuit-${circuit.id}-l` }, { componentId: breaker.id, terminalId: 'bottom-0' }, options);
  project = connect(project, { componentId: output.id, terminalId: `circuit-${circuit.id}-l2` }, { componentId: breaker.id, terminalId: 'bottom-1' }, options);
  assert.equal(circuitConnectionMap(project, project.circuits[0]).routes.find(route => route.kind === 'phase')?.complete, false);
});
