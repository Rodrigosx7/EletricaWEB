import test from 'node:test';
import assert from 'node:assert/strict';
import { addWireDetour, changedWiresAfterMove, deleteWireBend, moveWireBend } from '../src/features/qdc/wiring/wireEditing.ts';
import { addDevice, connect, moveDevices } from '../src/features/qdc/editor/operations.ts';
import { emptyProject } from '../src/features/qdc/projects/factory.ts';
import { pathAvoidsDevices } from '../src/features/qdc/wiring/routing.ts';
import type { Wire } from '../src/features/qdc/types.ts';

const sampleWire: Wire = { id: 'w1', sourceComponent: 'a', sourceTerminal: 'top-0', targetComponent: 'b', targetTerminal: 'top-0',
  conductorType: 'phase', color: '#20252b', gauge: 2.5, label: 'Fase', path: [{ x: 10, y: 10 }, { x: 10, y: 50 }, { x: 100, y: 50 }, { x: 100, y: 100 }], manualPath: true };

test('wire point controls keep the endpoints fixed, orthogonal and inside the board', () => {
  const project = emptyProject();
  const path = moveWireBend(project, sampleWire, 1, { x: 20, y: 60 });
  assert.deepEqual(path[0], sampleWire.path[0]);
  assert.deepEqual(path.at(-1), sampleWire.path.at(-1));
  assert.ok(pathAvoidsDevices(path, [], project));
  assert.throws(() => moveWireBend(project, sampleWire, 1, { x: -1, y: 60 }), /não pode/);
  assert.throws(() => moveWireBend(project, sampleWire, 0, { x: 20, y: 60 }), /dobra interna/);
  assert.throws(() => deleteWireBend(project, sampleWire, 1), /necessária/);
});

test('add detour creates editable bends without disconnecting wire ends', () => {
  const project = emptyProject();
  const wire = { ...sampleWire, path: [{ x: 10, y: 10 }, { x: 110, y: 10 }] };
  const path = addWireDetour(project, wire);
  assert.ok(path.length > wire.path.length);
  assert.deepEqual(path[0], wire.path[0]);
  assert.deepEqual(path.at(-1), wire.path.at(-1));
  assert.ok(pathAvoidsDevices(path, [], project));
});

test('move preview counts only wires whose geometry actually changes', () => {
  let project = addDevice(emptyProject(), 'breaker-1p', { rail: 0, slot: 0 });
  project = addDevice(project, 'breaker-1p', { rail: 0, slot: 3 });
  project = connect(project, { componentId: project.devices[0].id, terminalId: 'bottom-0' },
    { componentId: project.devices[1].id, terminalId: 'top-0' },
    { conductorType: 'phase', color: '#20252b', gauge: 2.5, termination: 'tubular' });
  const candidate = moveDevices(project, [project.devices[1].id], 0, 1);
  assert.deepEqual(changedWiresAfterMove(project, candidate), [project.wires[0].id]);
  assert.deepEqual(changedWiresAfterMove(project, project), []);
  assert.equal(project.devices[1].slot, 3, 'preview computation leaves the original project untouched');
});
