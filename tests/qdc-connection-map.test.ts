import test from 'node:test';
import assert from 'node:assert/strict';
import { circuitConnectionMap, connectionEndpointLabel } from '../src/features/qdc/circuits/connectionMap.ts';
import { demoProject } from '../src/features/qdc/projects/factory.ts';

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
