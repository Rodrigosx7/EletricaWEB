import { CircuitBoard, Route, Trash2, X } from 'lucide-react';
import { circuitOverview } from './overview';
import { phaseOptions } from './circuitDraft';
import type { Circuit, Device, Project } from '../types';

type Props = { project: Project; circuit: Circuit; onUpdate(patch: Partial<Circuit>): void; onUpdateDevice(id: string, patch: Partial<Device>): void; onConduit(id: string): void; onMap(): void; onDelete(): void; onClose(): void };

function NumberField({ label, value, unit, min = 0.01, max, nullable = true, onCommit }: { label: string; value: number | null; unit?: string; min?: number; max?: number; nullable?: boolean; onCommit(value: number | null): void }) {
  return <label className="ewq-circuit-inspector-field"><span>{label}</span><span className="ewq-circuit-inspector-number"><input key={`${label}-${value ?? ''}`} type="number" min={min} max={max} step="any" defaultValue={value ?? ''} placeholder={nullable ? 'A definir' : undefined} onBlur={event => {
    const input = event.currentTarget, raw = input.value.trim(), next = raw === '' && nullable ? null : Number(raw);
    if ((next === null || Number.isFinite(next) && next >= min && (max === undefined || next <= max)) && (raw !== '' || nullable)) { if (next !== value) onCommit(next); }
    else input.value = value === null ? '' : String(value);
  }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = value === null ? '' : String(value); event.currentTarget.blur(); } }} />{unit && <em>{unit}</em>}</span></label>;
}

export default function CircuitInspector({ project, circuit, onUpdate, onUpdateDevice, onConduit, onMap, onDelete, onClose }: Props) {
  const overview = circuitOverview(project, circuit);
  const sameGauge = circuit.neutralGauge === undefined && circuit.earthGauge === undefined;
  const phases = phaseOptions(project.supply);
  const phaseCount = circuit.phase.split('/').filter(Boolean).length;
  const breakers = project.devices.filter(device => (device.type.startsWith('breaker-') || device.type.startsWith('rcbo-') || device.type.startsWith('motor-breaker-')) && (device.id === circuit.breakerId || device.terminals.filter(term => term.side === 'bottom' && term.kind === 'L').length === phaseCount));
  const rcds = project.devices.filter(device => device.type.startsWith('rcd-') || device.type.startsWith('rcbo-'));
  const conduits = project.devices.filter(device => device.type === 'conduit-entry');
  const currentConduit = conduits.find(device => device.terminals.some(terminal => terminal.id.startsWith(`circuit-${circuit.id}-`) || [`c${circuit.number}-l`, `c${circuit.number}-n`, `c${circuit.number}-pe`].includes(terminal.id)));
  const conductorCount = circuit.phase.split('/').length + Number(circuit.hasNeutral !== false) + Number(circuit.hasEarth !== false);
  return <section className="ewq-circuit-inspector" aria-label={`Editar circuito C${circuit.number}`}>
    <header><div><small>CIRCUITO C{String(circuit.number).padStart(2, '0')}</small><h3>{circuit.name || 'Sem nome'}</h3></div><button type="button" aria-label="Fechar circuito" onClick={onClose}><X size={16} /></button></header>
    <div className={`ewq-circuit-inspector-state is-${overview.status}`}><CircuitBoard size={17} /><span><strong>{overview.label}</strong><small>{overview.connected.length} de {overview.terminals.length} condutores conectados</small></span></div>
    <div className="ewq-circuit-inspector-fields">
      <label className="ewq-circuit-inspector-field"><span>Nome</span><input key={circuit.name} defaultValue={circuit.name} maxLength={100} onBlur={event => { const name = event.currentTarget.value.trim(); if (name !== circuit.name) onUpdate({ name }); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
      <label className="ewq-circuit-inspector-field"><span>Fases</span><select value={circuit.phase} onChange={event => onUpdate({ phase: event.target.value })}>{!phases.includes(circuit.phase) && <option value={circuit.phase}>{circuit.phase || 'Definir'}</option>}{phases.map(phase => <option key={phase} value={phase}>{phase} · {phase.split('/').length} {phase.includes('/') ? 'fases' : 'fase'}</option>)}</select></label>
      <div className="ewq-circuit-inspector-switches"><label><input type="checkbox" checked={circuit.hasNeutral !== false} onChange={event => onUpdate({ hasNeutral: event.target.checked })} /> Neutro</label><label><input type="checkbox" checked={circuit.hasEarth !== false} onChange={event => onUpdate({ hasEarth: event.target.checked })} /> Proteção PE</label></div>
      {currentConduit && <label className="ewq-circuit-inspector-field"><span>Conduíte de entrada</span><select value={currentConduit.id} onChange={event => onConduit(event.target.value)}>{conduits.map(device => <option key={device.id} value={device.id} disabled={device.id !== currentConduit.id && device.terminals.length + conductorCount > 16}>{device.label} · {device.terminals.length} pontas</option>)}</select></label>}
      <h4>Condutores</h4>
      <label className="ewq-circuit-inspector-check"><input type="checkbox" checked={sameGauge} onChange={event => onUpdate(event.target.checked ? { neutralGauge: undefined, earthGauge: undefined } : { neutralGauge: circuit.cableGauge, earthGauge: circuit.cableGauge })} /> Mesma bitola para todos</label>
      <NumberField label="Fases" value={circuit.cableGauge} unit="mm²" onCommit={cableGauge => onUpdate({ cableGauge })} />
      {!sameGauge && circuit.hasNeutral !== false && <NumberField label="Neutro" value={circuit.neutralGauge ?? null} unit="mm²" onCommit={neutralGauge => onUpdate({ neutralGauge })} />}
      {!sameGauge && circuit.hasEarth !== false && <NumberField label="PE" value={circuit.earthGauge ?? null} unit="mm²" onCommit={earthGauge => onUpdate({ earthGauge })} />}
      <div className="ewq-circuit-inspector-colors" role="group" aria-label="Cores dos condutores">{circuit.phase.split('/').filter(Boolean).map((_, index) => <label key={index}>L{index + 1}<input type="color" value={circuit.phaseColors?.[index] ?? (index === 0 ? circuit.color : ['#20252b', '#dc4037', '#9b6b30'][index])} onChange={event => { const phaseColors = [...(circuit.phaseColors ?? [circuit.color, '#dc4037', '#9b6b30'])]; phaseColors[index] = event.target.value; onUpdate({ phaseColors }); }} /></label>)}{circuit.hasNeutral !== false && <label>N<input type="color" value={circuit.neutralColor ?? '#1686cf'} onChange={event => onUpdate({ neutralColor: event.target.value })} /></label>}{circuit.hasEarth !== false && <label>PE<input type="color" value={circuit.earthColor ?? '#27854c'} onChange={event => onUpdate({ earthColor: event.target.value })} /></label>}</div>
      <h4>Carga e proteção</h4>
      <NumberField label="Tensão da carga" value={circuit.voltage} unit="V" min={1} nullable={false} onCommit={voltage => voltage !== null && onUpdate({ voltage })} />
      <div className="ewq-circuit-inspector-load"><NumberField label={phaseCount === 2 && circuit.hasNeutral !== false && circuit.loadUnit === 'A' ? 'Corrente da fase mais carregada' : 'Carga'} value={circuit.load} unit={circuit.loadUnit} min={0} onCommit={load => onUpdate({ load })} /><label className="ewq-circuit-inspector-field"><span>Unidade</span><select value={circuit.loadUnit} onChange={event => onUpdate({ loadUnit: event.target.value as Circuit['loadUnit'], load: null })}><option value="W">W</option><option value="A">A</option></select></label></div>
      {phaseCount === 2 && circuit.hasNeutral !== false && <p className="ewq-field-note">Com duas fases e neutro, informe em A a corrente da fase mais carregada. A potência total em W não permite calcular as duas correntes. Para uma carga apenas entre fases, retire o neutro deste circuito.</p>}
      {circuit.loadUnit === 'W' && <NumberField label="Fator de potência" value={circuit.powerFactor} min={0.01} max={1} nullable={false} onCommit={powerFactor => powerFactor !== null && onUpdate({ powerFactor })} />}
      <label className="ewq-circuit-inspector-field"><span>Disjuntor</span><select value={circuit.breakerId ?? ''} onChange={event => onUpdate({ breakerId: event.target.value || null })}><option value="">Vincular ao puxar a fase</option>{breakers.map(device => <option key={device.id} value={device.id} disabled={project.circuits.some(other => other.id !== circuit.id && other.breakerId === device.id)}>{device.label} · {device.poles}P · T{device.rail + 1}/{device.slot + 1}{project.circuits.some(other => other.id !== circuit.id && other.breakerId === device.id) ? ' · em uso' : ''}</option>)}</select></label>
      {overview.breaker && <NumberField label="In do disjuntor" value={overview.breaker.amperage} unit="A" min={1} onCommit={amperage => onUpdateDevice(overview.breaker!.id, { amperage })} />}
      <NumberField label="Iz corrigida informada" value={circuit.ampacity ?? null} unit="A" min={0.01} onCommit={ampacity => onUpdate({ ampacity })} />
      <label className="ewq-circuit-inspector-field"><span>DR vinculado</span><select value={circuit.drId ?? ''} onChange={event => onUpdate({ drId: event.target.value || null })}><option value="">Não definido</option>{rcds.map(device => <option key={device.id} value={device.id}>{device.label} · T{device.rail + 1}/{device.slot + 1}</option>)}</select></label>
      <label className="ewq-circuit-inspector-field"><span>Descrição / observações</span><textarea key={circuit.notes} defaultValue={circuit.notes} rows={3} maxLength={600} onBlur={event => event.currentTarget.value !== circuit.notes && onUpdate({ notes: event.currentTarget.value })} /></label>
    </div>
    <div className="ewq-circuit-inspector-conductors"><strong>Pontas do circuito</strong>{overview.conductors.map(({ terminal, connected, gauge }) => <div key={terminal.id}><span className={`ewq-circuit-inspector-dot is-${terminal.kind.toLowerCase()}`} /> <span>{terminal.kind === 'L' ? `L${terminal.pole ?? 1}` : terminal.kind} · {gauge === null ? 'bitola a definir' : `${gauge} mm²`}</span><small>{connected ? 'Conectado' : 'Arraste no quadro'}</small></div>)}</div>
    {overview.problems.length > 0 && <div className="ewq-circuit-inspector-alert" role="status">{overview.problems.map(problem => <p key={problem}>{problem}</p>)}</div>}
    {overview.missing.length > 0 && <p className="ewq-circuit-inspector-missing">Para avaliar Ib ≤ In ≤ Iz, faltam: {overview.missing.join(', ')}.</p>}
    <p className="ewq-circuit-inspector-caveat">Análise preliminar dos valores informados. Confira método de instalação, correções, queda de tensão, curto-circuito, DR/DPS e demais critérios antes da execução.</p>
    <footer><button type="button" onClick={onMap}><Route size={15} /> Ver ligações</button><button type="button" className="is-danger" onClick={onDelete}><Trash2 size={15} /> Excluir</button></footer>
  </section>;
}
