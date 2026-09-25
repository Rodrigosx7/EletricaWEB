import test from 'node:test';
import assert from 'node:assert/strict';
import { addDevice, connect, moveDevices, updateDevice, validateProject } from '../src/features/qdc/editor/operations.ts';
import { emptyProject } from '../src/features/qdc/projects/factory.ts';
import { createDevice } from '../src/features/qdc/electrical-components/catalog.ts';
import { breakerTerminals, GENERIC_DIN_2P } from '../src/features/qdc/electrical-components/technicalCatalog.ts';
import { deviceRect, terminalPoint } from '../src/features/qdc/wiring/routing.ts';

test('2P prototype separates catalog preset, project instance and stable functional terminals', () => {
  const first = createDevice('breaker-2p');
  const second = createDevice('breaker-2p');
  assert.notEqual(first.id, second.id);
  assert.equal(first.technicalModelId, GENERIC_DIN_2P.id);
  assert.equal(first.visualVariant, GENERIC_DIN_2P.visualVariant);
  assert.equal(first.amperage, null);
  assert.deepEqual(first.terminals, breakerTerminals(2));
  assert.deepEqual(first.terminals.map(term => [term.id, term.label, term.pole, term.position?.x, term.position?.y]), [
    ['top-0', '1', 1, .25, 0], ['bottom-0', '2', 1, .25, 1],
    ['top-1', '3', 2, .75, 0], ['bottom-1', '4', 2, .75, 1],
  ]);
});

test('technical edits preserve the 2P electrical topology and connected wire IDs while moving', () => {
  let project = addDevice(emptyProject(), 'breaker-2p', { rail: 0, slot: 0 });
  project = addDevice(project, 'breaker-2p', { rail: 0, slot: 4 });
  const [source, target] = project.devices;
  project = connect(project, { componentId: source.id, terminalId: 'bottom-0' }, { componentId: target.id, terminalId: 'top-0' }, { conductorType: 'phase', color: '#20252b', gauge: 2.5, termination: 'tubular' });
  const wireId = project.wires[0].id;
  project = updateDevice(project, source.id, { amperage: 32, curve: 'C', breakingCapacityKa: 6, voltage: 400, tag: 'QF01', label: 'Alimentação' });
  assert.equal(project.wires[0].id, wireId);
  assert.equal(project.wires[0].sourceTerminal, 'bottom-0');
  assert.equal(project.devices[0].amperage, 32);
  assert.equal(project.devices[0].tag, 'QF01');
  assert.ok(validateProject(project));
  const before = terminalPoint(project, source.id, 'bottom-0');
  project = moveDevices(project, [source.id], 1, 0);
  const after = terminalPoint(project, source.id, 'bottom-0');
  assert.ok(before && after && after.y > before.y);
  assert.equal(project.wires[0].id, wireId);
  const rect = deviceRect(project.devices[0], project);
  assert.deepEqual(after, { x: rect.x + rect.width * .25, y: rect.y + rect.height });
});

test('legacy breaker remains readable and invalid normalized terminal positions are rejected', () => {
  const project = addDevice(emptyProject(), 'breaker-2p');
  const legacy = structuredClone(project);
  for (const device of legacy.devices) {
    delete device.technicalModelId;
    delete device.visualVariant;
    delete device.breakingCapacityKa;
    delete device.tag;
    for (const terminal of device.terminals) {
      delete terminal.pole;
      delete terminal.position;
    }
  }
  assert.ok(validateProject(legacy));
  const invalid = { ...project, devices: [{ ...project.devices[0], terminals: project.devices[0].terminals.map((terminal, index) => index === 0 ? { ...terminal, position: { x: 1.5, y: 0 } } : terminal) }] };
  assert.equal(validateProject(invalid), false);
});
