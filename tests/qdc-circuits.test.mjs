import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticProject, emptyProject } from '../src/features/qdc/projects/factory.ts';
import { circuitFromDraft, newCircuitDraft } from '../src/features/qdc/circuits/circuitDraft.ts';
import { addDevice, circuitGauge, connect, connectionIssue, deleteSelection, prepareCircuitOutputs, updateCircuit, updateDevice, validateProject } from '../src/features/qdc/editor/operations.ts';
import { circuitCurrent, phaseBalance, protectionCheck } from '../src/features/qdc/circuits/analysis.ts';
import { circuitOverview } from '../src/features/qdc/circuits/overview.ts';

function board() {
  const draft = { ...newCircuitDraft('bi', 1, 220), name: 'Tomadas cozinha', phase: 'R/S', cableGauge: 2.5, neutralGauge: 4, earthGauge: 2.5, sameGauge: false };
  const circuit = circuitFromDraft(draft, 1);
  let project = prepareCircuitOutputs({ ...emptyProject({ supply: 'bi', voltage: 220 }), circuits: [circuit] });
  project = addDevice(project, 'breaker-1p');
  project = addDevice(project, 'breaker-2p');
  const output = project.devices.find(device => device.type === 'conduit-entry' && device.terminals.some(term => term.id.startsWith(`circuit-${circuit.id}-`)));
  const single = project.devices.find(device => device.type === 'breaker-1p');
  const double = project.devices.find(device => device.type === 'breaker-2p');
  const source = suffix => ({ componentId: output.id, terminalId: `circuit-${circuit.id}-${suffix}` });
  const target = (device, terminalId) => ({ componentId: device.id, terminalId });
  return { project, circuit, output, single, double, source, target };
}

const options = { conductorType: 'phase', color: '#20252b', gauge: 2.5, termination: 'tubular' };

test('circuito bifásico exige dois polos corretos e vínculo único', () => {
  const { project, circuit, single, double, source, target } = board();
  assert.match(connectionIssue(project, source('l'), target(single, 'bottom-0'), 'phase'), /2 fase/);
  assert.match(connectionIssue(project, source('l'), target(double, 'top-0'), 'phase'), /borne de saída/);
  assert.match(connectionIssue(project, source('l'), target(double, 'bottom-1'), 'phase'), /polo 1/);
  const first = connect(project, source('l'), target(double, 'bottom-0'), options);
  assert.equal(first.circuits[0].breakerId, double.id);
  assert.equal(first.devices.find(device => device.id === double.id).circuitId, circuit.id);
  assert.match(connectionIssue(first, source('l'), target(double, 'bottom-1'), 'phase'), /já está conectada/);
  const second = connect(first, source('l2'), target(double, 'bottom-1'), options);
  assert.equal(second.wires.length, 2);
  assert.equal(validateProject(second), true);
});

test('neutro e PE mantêm tipo e seção próprios; edição propaga à ligação', () => {
  const { project, circuit, output, double, source, target } = board();
  assert.match(connectionIssue(project, source('n'), target(double, 'bottom-0'), 'neutral'), /não é compatível/);
  assert.match(connectionIssue(project, source('pe'), target(double, 'bottom-0'), 'earth'), /não é compatível/);
  const withBus = addDevice(project, 'neutral-bus');
  const bus = withBus.devices.find(device => device.type === 'neutral-bus');
  const connected = connect(withBus, source('l'), target(double, 'bottom-0'), options);
  const withNeutral = connect(connected, source('n'), target(bus, bus.terminals[0].id), { ...options, conductorType: 'neutral', color: circuit.neutralColor, gauge: circuitGauge(circuit, output.terminals.find(term => term.id === source('n').terminalId).kind) });
  assert.equal(withNeutral.wires[1].gauge, 4);
  const revised = updateCircuit(withNeutral, circuit.id, { cableGauge: 6, neutralGauge: 6, earthGauge: 2.5, phaseColors: ['#453322', '#dc4037', '#9b6b30'] });
  assert.equal(revised.wires[0].gauge, 6);
  assert.equal(revised.wires[0].color, '#453322');
  assert.equal(revised.wires[1].gauge, 6);
  assert.equal(revised.devices.find(device => device.id === output.id)?.terminals.length, 4);
  assert.equal(validateProject(revised), true);
});

test('mudar a topologia remove fases incompatíveis e desvincula proteção multipolar', () => {
  const { project, circuit, double, source, target } = board();
  const wired = connect(project, source('l'), target(double, 'bottom-0'), options);
  const changed = updateCircuit(wired, circuit.id, { phase: 'R' });
  assert.equal(changed.circuits[0].breakerId, null);
  assert.equal(changed.wires.length, 0);
  assert.equal(changed.devices.find(device => device.id === double.id)?.circuitId, null);
  assert.equal(validateProject(changed), true);
});

test('quadro amplo prepara 60 circuitos com pontas independentes e persistíveis', () => {
  const circuits = Array.from({ length: 60 }, (_, index) => circuitFromDraft({ ...newCircuitDraft('tri', index + 1, 380), name: `Circuito ${index + 1}` }, index + 1));
  const project = prepareCircuitOutputs({ ...emptyProject({ supply: 'tri', voltage: 380, rails: 8, modulesPerRail: 48, widthMm: 1600, heightMm: 1200 }), circuits });
  assert.equal(project.devices.filter(device => device.type === 'conduit-entry').length, 60);
  assert.equal(project.devices.filter(device => device.type === 'conduit-entry').flatMap(device => device.terminals).length, 180);
  assert.equal(validateProject(JSON.parse(JSON.stringify(project))), true);
});

test('projetos automáticos anteriores continuam mostrando três ligações por circuito', () => {
  const project = automaticProject({ supply: 'mono', voltage: 127 }, ['Iluminação']);
  const circuit = project.circuits[0];
  const overview = circuitOverview(project, circuit);
  assert.equal(overview.terminals.length, 3);
  assert.equal(overview.connected.length, 3);
  assert.equal(overview.protectedPhases, 1);
  const changed = updateCircuit(project, circuit.id, { cableGauge: 2.5 });
  assert.equal(changed.wires.find(wire => wire.sourceTerminal === `c${circuit.number}-l` || wire.targetTerminal === `c${circuit.number}-l`)?.gauge, 2.5);
  assert.equal(validateProject(changed), true);
});

test('potência total de duas fases com neutro não é tratada como corrente de linha', () => {
  const { circuit } = board();
  const mixed = { ...circuit, load: 1000, loadUnit: 'W', voltage: 220, powerFactor: 1, ampacity: 10 };
  assert.equal(circuitCurrent(mixed), null);
  assert.equal(protectionCheck(mixed, { amperage: 6, poles: 2 }).ib, null);
  assert.equal(circuitCurrent({ ...mixed, load: 8, loadUnit: 'A' }), 8);
  assert.equal(circuitCurrent({ ...mixed, hasNeutral: false }), 1000 / 220);
  const balance = phaseBalance({ ...emptyProject({ supply: 'bi', voltage: 220 }), circuits: [{ ...mixed, load: 8, loadUnit: 'A' }] });
  assert.deepEqual(balance.map(phase => [phase.current, phase.missing]), [[0, 1], [0, 1]]);
});

test('excluir a última fase desenhada remove o vínculo automático do disjuntor', () => {
  const { project, circuit, double, source, target } = board();
  const linked = connect(project, source('l'), target(double, 'bottom-0'), options);
  const deleted = deleteSelection(linked, { devices: [], wire: linked.wires[0].id });
  assert.equal(deleted.circuits[0].breakerId, null);
  assert.equal(deleted.devices.find(device => device.id === double.id)?.circuitId, null);
  assert.equal(validateProject(deleted), true);
  assert.equal(circuitOverview(deleted, deleted.circuits.find(item => item.id === circuit.id)).status, 'unprotected');
});

test('alterar seção no disjuntor atualiza o fio de saída do circuito', () => {
  const { project, circuit, double, source, target } = board();
  const linked = connect(project, source('l'), target(double, 'bottom-0'), options);
  const revised = updateDevice(linked, double.id, { gauge: 6 });
  assert.equal(revised.circuits.find(item => item.id === circuit.id)?.cableGauge, 6);
  assert.equal(revised.wires[0].gauge, 6);
  assert.equal(validateProject(revised), true);
  assert.throws(() => updateDevice(linked, double.id, { poles: 1 }), /Desvincule o circuito/);
});

test('saídas conectadas sem alimentação não aparecem como prontas', () => {
  const circuit = circuitFromDraft({ ...newCircuitDraft('mono', 1, 127), name: 'Tomadas', cableGauge: 2.5 }, 1);
  let project = prepareCircuitOutputs({ ...emptyProject({ supply: 'mono', voltage: 127 }), circuits: [circuit] });
  project = addDevice(project, 'breaker-1p');
  project = addDevice(project, 'neutral-bus');
  project = addDevice(project, 'earth-bus');
  const output = project.devices.find(device => device.type === 'conduit-entry');
  const breaker = project.devices.find(device => device.type === 'breaker-1p');
  const neutral = project.devices.find(device => device.type === 'neutral-bus');
  const earth = project.devices.find(device => device.type === 'earth-bus');
  const source = suffix => ({ componentId: output.id, terminalId: `circuit-${circuit.id}-${suffix}` });
  const target = (device, terminalId) => ({ componentId: device.id, terminalId });
  project = connect(project, source('l'), target(breaker, 'bottom-0'), options);
  project = connect(project, source('n'), target(neutral, neutral.terminals[0].id), { ...options, conductorType: 'neutral', color: '#1686cf' });
  project = connect(project, source('pe'), target(earth, earth.terminals[0].id), { ...options, conductorType: 'earth', color: '#27854c' });
  project = updateCircuit(project, circuit.id, { load: 1000, ampacity: 25 });
  project = updateDevice(project, breaker.id, { amperage: 16 });
  const overview = circuitOverview(project, project.circuits[0]);
  assert.equal(overview.status, 'partial');
  assert.match(overview.problems.join(' '), /entrada de energia/);
  assert.equal(validateProject(project), true);
});
