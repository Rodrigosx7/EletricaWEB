import { ChevronDown, CircuitBoard, Crosshair, Plus, Route, Trash2 } from 'lucide-react';
import { circuitCurrent, needsLineCurrent, phaseBalance, protectionCheck } from './analysis';
import { circuitWireColor } from '../editor/operations';
import { circuitOverview } from './overview';
import type { Circuit, Device, Project } from '../types';
import '../components/panels.css';

export type CircuitsPanelProps = {
  project: Project;
  onUpdateCircuit(id: string, patch: Partial<Circuit>): void;
  onAddCircuit(): void; onPrepareOutputs(): void; onDeleteCircuit(id: string): void;
  onSelectDevice(id: string): void;
  onMapCircuit(id: string): void;
  onInspectCircuit(id: string): void;
  selectedCircuitId?: string | null;
  onUpdateDevice(id: string, patch: Partial<Device>): void;
};

const GAUGES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];
const CURRENTS = [2, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
const formatCurrent = (current: number) => current.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

type NumberDraftOptions = { min?: number; max?: number; integer?: boolean; nullable?: boolean };

function commitNumberDraft(input: HTMLInputElement, current: number | null, options: NumberDraftOptions, commit: (value: number | null) => void) {
  const raw = input.value.trim();
  if (raw === '' && options.nullable) {
    if (current !== null) commit(null);
    return;
  }
  const value = Number(raw);
  const valid = raw !== '' && Number.isFinite(value) && (!options.integer || Number.isInteger(value)) && (options.min === undefined || value >= options.min) && (options.max === undefined || value <= options.max);
  if (!valid) { input.value = current === null ? '' : String(current); return; }
  if (value !== current) commit(value);
}

function draftKey(input: HTMLInputElement | HTMLTextAreaElement, key: string, current: string | number | null, multiline = false, modified = false) {
  if (key === 'Escape') { input.value = current === null ? '' : String(current); input.blur(); }
  else if (key === 'Enter' && (!multiline || modified)) input.blur();
}

export function CircuitsPanel({ project, onUpdateCircuit, onAddCircuit, onPrepareOutputs, onDeleteCircuit, onSelectDevice, onMapCircuit, onInspectCircuit, selectedCircuitId, onUpdateDevice }: CircuitsPanelProps) {
  const breakers = project.devices.filter(device => device.type.startsWith('breaker-') || device.type === 'main-breaker' || device.type.startsWith('rcbo-') || device.type.startsWith('motor-breaker-'));
  const rcds = project.devices.filter(device => device.type.startsWith('rcd-') || device.type.startsWith('rcbo-'));
  const phases = project.supply === 'mono' ? ['R'] : project.supply === 'bi' ? ['R', 'S', 'R/S'] : ['R', 'S', 'T', 'R/S', 'S/T', 'R/T', 'R/S/T'];
  const balance = phaseBalance(project);
  const largestPhase = Math.max(1, ...balance.map(item => item.current));
  const missingOutputs = project.circuits.filter(circuit => !project.devices.some(device => device.type === 'conduit-entry' && device.terminals.some(term =>
    term.id.startsWith(`circuit-${circuit.id}-`) || term.id === `c${circuit.number}-l`))).length;
  return <section className="ewq-circuits" aria-label="Circuitos e distribuição de cargas">
    <details open className="ewq-circuits-disclosure">
      <summary className="ewq-circuits-heading"><span><CircuitBoard size={17} aria-hidden="true" /><strong>Circuitos</strong><span className="ewq-count">{project.circuits.length}</span></span><span className="ewq-circuits-disclosure-hint">Cargas e proteção <ChevronDown size={16} aria-hidden="true" /></span></summary>
      <div className="ewq-circuit-toolbar"><p>Crie o circuito, puxe a fase da saída até o disjuntor e ele será vinculado e identificado. Neutro e PE ficam livres para os barramentos.</p>{missingOutputs > 0 && <button type="button" onClick={onPrepareOutputs}>Preparar {missingOutputs} saída{missingOutputs === 1 ? '' : 's'}</button>}<button type="button" onClick={onAddCircuit}><Plus size={14} aria-hidden="true" />Adicionar circuito</button></div>
      {!project.circuits.length ? <div className="ewq-circuits-empty"><CircuitBoard size={25} aria-hidden="true" /><div><strong>Organize os circuitos da instalação</strong><p>Adicione iluminação, tomadas e cargas específicas para identificá-las no quadro.</p></div><button type="button" onClick={onAddCircuit}><Plus size={15} aria-hidden="true" />Primeiro circuito</button></div> : <>
        <div className="ewq-circuit-cards" aria-label="Circuitos do quadro">{project.circuits.map(circuit => {
          const overview = circuitOverview(project, circuit);
          return <article key={circuit.id} id={`ewq-circuit-${circuit.id}`} tabIndex={-1} className={`ewq-circuit-card is-${overview.status}${selectedCircuitId === circuit.id ? ' is-selected' : ''}`}>
            <button type="button" className="ewq-circuit-card-main" onClick={() => onInspectCircuit(circuit.id)} aria-label={`Editar circuito C${circuit.number}, ${circuit.name}`}>
              <span className="ewq-circuit-card-number">C{String(circuit.number).padStart(2, '0')}</span>
              <span className="ewq-circuit-card-copy"><strong>{circuit.name || 'Sem nome'}</strong><small>{circuit.phase || 'Fases a definir'} · {circuit.voltage} V · {overview.connected.length}/{overview.terminals.length} fios conectados</small></span>
              <span className={`ewq-circuit-card-status is-${overview.status}`}>{overview.label}</span>
            </button>
            <div className="ewq-circuit-card-foot"><span>{overview.conductors.map(({ terminal, connected, gauge }) => <span key={terminal.id} className={`ewq-circuit-chip${connected ? ' is-connected' : ''}`} title={`${terminal.label}: ${connected ? 'ligado' : 'ponta livre'}`}><i style={{ background: circuitWireColor(circuit, terminal) }} />{terminal.kind === 'L' ? `L${terminal.pole ?? 1}` : terminal.kind} · {gauge === null ? '? mm²' : `${gauge} mm²`}</span>)}</span><span className="ewq-circuit-card-actions"><button type="button" onClick={() => onMapCircuit(circuit.id)}>Mapa</button><button type="button" onClick={() => onDeleteCircuit(circuit.id)} aria-label={`Excluir circuito C${circuit.number}`}>Excluir</button></span></div>
          </article>;
        })}</div>
        <details className="ewq-circuit-advanced"><summary>Edição avançada em tabela <ChevronDown size={15} aria-hidden="true" /></summary>
        <div className="ewq-circuit-table-scroll" tabIndex={0} role="region" aria-label="Lista de circuitos; role verticalmente para ver todos os circuitos">
          <table className="ewq-circuit-table"><thead><tr><th scope="col">Circuito</th><th scope="col">Fases</th><th scope="col">Tensão</th><th scope="col">Carga / FP</th><th scope="col">Corrente da carga</th><th scope="col">Disjuntor / nominal / polos</th><th scope="col">Condutor</th><th scope="col">DR vinculado</th><th scope="col">Observações</th><th scope="col"><span className="ewq-visually-hidden">Ações</span></th></tr></thead>
            <tbody>{project.circuits.map(circuit => {
              const breaker = breakers.find(device => device.id === circuit.breakerId);
              const current = circuitCurrent(circuit);
              const protection = protectionCheck(circuit, breaker);
              const label = `Circuito ${circuit.number}`;
              const update = (patch: Partial<Circuit>) => onUpdateCircuit(circuit.id, patch);
              return <tr key={circuit.id} id={`ewq-circuit-${circuit.id}`} tabIndex={-1}>
                <td data-label="Circuito"><div className="ewq-circuit-name"><span className="ewq-circuit-number"><span>C</span><input key={`number-${circuit.number}`} type="number" min={1} step={1} defaultValue={circuit.number} aria-label={`${label}: número`} onBlur={event => commitNumberDraft(event.currentTarget, circuit.number, { min: 1, integer: true }, number => number !== null && update({ number }))} onKeyDown={event => draftKey(event.currentTarget, event.key, circuit.number)} /></span><input key={`name-${circuit.name}`} defaultValue={circuit.name} maxLength={100} list="ewq-circuit-names" aria-label={`${label}: nome`} placeholder="Nome do circuito" onBlur={event => event.currentTarget.value !== circuit.name && update({ name: event.currentTarget.value })} onKeyDown={event => draftKey(event.currentTarget, event.key, circuit.name)} /></div></td>
                <td data-label="Fases"><select value={circuit.phase} aria-label={`${label}: fases`} onChange={event => update({ phase: event.target.value })}>{!phases.includes(circuit.phase) && <option value={circuit.phase}>{circuit.phase || 'Definir'}{circuit.phase ? ' (revisar)' : ''}</option>}{phases.map(phase => <option key={phase} value={phase}>{phase}</option>)}</select><div className="ewq-circuit-flags"><label><input type="checkbox" checked={circuit.hasNeutral !== false} onChange={event => update({ hasNeutral: event.target.checked })} /> N</label><label><input type="checkbox" checked={circuit.hasEarth !== false} onChange={event => update({ hasEarth: event.target.checked })} /> PE</label></div></td>
                <td data-label="Tensão"><div className="ewq-input-unit"><input key={`voltage-${circuit.voltage}`} type="number" min={1} step="any" defaultValue={circuit.voltage} list="ewq-circuit-voltages" aria-label={`${label}: tensão da carga em volts`} onBlur={event => commitNumberDraft(event.currentTarget, circuit.voltage, { min: 1 }, voltage => voltage !== null && update({ voltage }))} onKeyDown={event => draftKey(event.currentTarget, event.key, circuit.voltage)} /><span>V</span></div></td>
                <td data-label="Carga / FP"><div className="ewq-circuit-load"><input key={`load-${circuit.load ?? 'empty'}`} type="number" min={0} step="any" defaultValue={circuit.load ?? ''} placeholder="Carga" aria-label={`${label}: carga em ${circuit.loadUnit}`} onBlur={event => commitNumberDraft(event.currentTarget, circuit.load, { min: 0, nullable: true }, load => update({ load }))} onKeyDown={event => draftKey(event.currentTarget, event.key, circuit.load)} /><select value={circuit.loadUnit} aria-label={`${label}: unidade da carga`} onChange={event => update({ loadUnit: event.target.value as Circuit['loadUnit'], load: null })}><option value="W">W</option><option value="A">A</option></select></div><label className="ewq-circuit-pf"><span>FP</span><input key={`pf-${circuit.powerFactor}`} type="number" min={0.01} max={1} step={0.01} defaultValue={circuit.powerFactor} disabled={circuit.loadUnit === 'A'} aria-label={`${label}: fator de potência`} title="Informe o fator de potência da carga. Não equivale ao rendimento." onBlur={event => commitNumberDraft(event.currentTarget, circuit.powerFactor, { min: 0.01, max: 1 }, powerFactor => powerFactor !== null && update({ powerFactor }))} onKeyDown={event => draftKey(event.currentTarget, event.key, circuit.powerFactor)} /></label></td>
                <td data-label="Corrente"><output className="ewq-current-value" aria-label={`${label}: corrente da carga`}>{current === null ? '—' : `${formatCurrent(current)} A`}</output><small className="ewq-table-help">{needsLineCurrent(circuit) ? 'Informe A da fase mais carregada' : circuit.loadUnit === 'A' ? 'Informada' : current === null ? 'Dados pendentes' : circuit.phase === 'R/S/T' ? '3φ equilibrada' : 'Calculada'}</small></td>
                <td data-label="Disjuntor"><select value={circuit.breakerId ?? ''} aria-label={`${label}: disjuntor vinculado`} onChange={event => update({ breakerId: event.target.value || null })}><option value="">Selecionar disjuntor</option>{breakers.map(device => <option key={device.id} value={device.id}>{device.label} · T{device.rail + 1}/{device.slot + 1}</option>)}</select><div className="ewq-circuit-protection"><label className="ewq-input-unit"><input key={`breaker-current-${breaker?.amperage ?? 'empty'}`} type="number" min={1} step="any" list="ewq-circuit-ratings" defaultValue={breaker?.amperage ?? ''} disabled={!breaker} aria-label={`${label}: corrente nominal do disjuntor em amperes`} onBlur={event => breaker && commitNumberDraft(event.currentTarget, breaker.amperage, { min: 1, nullable: true }, amperage => onUpdateDevice(breaker.id, { amperage }))} onKeyDown={event => draftKey(event.currentTarget, event.key, breaker?.amperage ?? null)} /><span>A</span></label><select value={breaker?.poles ?? ''} disabled={!breaker} aria-label={`${label}: polos do disjuntor`} onChange={event => breaker && onUpdateDevice(breaker.id, { poles: Number(event.target.value) })}>{!breaker && <option value="">Polos</option>}{[1, 2, 3, 4].map(poles => <option key={poles} value={poles}>{poles}P</option>)}</select></div>{protection.issues.length > 0 ? <small className="ewq-protection-alert">{protection.issues.join(' ')}{protection.candidate ? ` Exemplo na faixa Ib–Iz: ${protection.candidate} A.` : ''}</small> : breaker?.amperage != null && protection.ib !== null && protection.iz !== null ? <small className="ewq-protection-ok">Ib ≤ In ≤ Iz pelos valores informados. Verifique os demais critérios.</small> : breaker?.amperage != null && protection.ib !== null ? <small className="ewq-protection-pending">Informe Iz corrigida para avaliar se In excede a capacidade do condutor.</small> : null}</td>
                <td data-label="Condutor"><div className="ewq-input-unit"><input key={`gauge-${circuit.cableGauge ?? 'empty'}`} type="number" min={0.01} step="any" list="ewq-circuit-gauges" defaultValue={circuit.cableGauge ?? ''} placeholder="Definir" aria-label={`${label}: seção do condutor em milímetros quadrados`} onBlur={event => commitNumberDraft(event.currentTarget, circuit.cableGauge, { min: 0.01, nullable: true }, cableGauge => update({ cableGauge }))} onKeyDown={event => draftKey(event.currentTarget, event.key, circuit.cableGauge)} /><span>mm²</span></div><label className="ewq-circuit-ampacity"><span>Iz corrigida</span><span className="ewq-input-unit"><input key={`ampacity-${circuit.ampacity ?? 'empty'}`} type="number" min={0.01} step="any" defaultValue={circuit.ampacity ?? ''} placeholder="Opcional" aria-label={`${label}: capacidade de condução corrigida em amperes`} onBlur={event => commitNumberDraft(event.currentTarget, circuit.ampacity ?? null, { min: 0.01, nullable: true }, ampacity => update({ ampacity }))} onKeyDown={event => draftKey(event.currentTarget, event.key, circuit.ampacity ?? null)} /><span>A</span></span></label></td>
                <td data-label="DR"><select value={circuit.drId ?? ''} aria-label={`${label}: DR vinculado`} onChange={event => update({ drId: event.target.value || null })}><option value="">Não definido</option>{rcds.map(device => <option key={device.id} value={device.id}>{device.label} · T{device.rail + 1}/{device.slot + 1}</option>)}</select></td>
                <td data-label="Observações"><textarea key={`notes-${circuit.notes}`} rows={2} maxLength={600} defaultValue={circuit.notes} aria-label={`${label}: observações`} placeholder="Ambiente, carga, referência…" onBlur={event => event.currentTarget.value !== circuit.notes && update({ notes: event.currentTarget.value })} onKeyDown={event => draftKey(event.currentTarget, event.key, circuit.notes, true, event.ctrlKey || event.metaKey)} /></td>
                <td data-label="Ações"><div className="ewq-row-actions"><button type="button" onClick={() => onMapCircuit(circuit.id)} aria-label={`Ver mapa de conexões do ${label.toLowerCase()}`} title="Destacar trajeto desenhado"><Route size={15} aria-hidden="true" /></button><button type="button" disabled={!breaker} onClick={() => breaker && onSelectDevice(breaker.id)} aria-label={`Localizar disjuntor do ${label.toLowerCase()}`} title="Selecionar disjuntor no quadro"><Crosshair size={15} aria-hidden="true" /></button><button type="button" className="ewq-danger-button" onClick={() => onDeleteCircuit(circuit.id)} aria-label={`Excluir ${label.toLowerCase()}`} title="Excluir circuito"><Trash2 size={14} aria-hidden="true" /></button></div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        </details>
        <div className="ewq-phase-analysis"><div className="ewq-phase-analysis-label"><strong>Distribuição das cargas</strong><p>Soma das correntes conhecidas por fase. Circuitos com duas fases e neutro ficam fora da soma sem cargas separadas por fase. Não considera demanda nem soma fasorial.</p></div><div className="ewq-phase-balances">{balance.map(item => <div className="ewq-phase-balance" key={item.phase}><div><strong>Fase {item.phase}</strong><span>{formatCurrent(item.current)} A</span></div><div className="ewq-phase-track"><span style={{ width: `${Math.max(0, (item.current / largestPhase) * 100)}%` }} /></div><small>{item.count} {item.count === 1 ? 'circuito' : 'circuitos'}{item.missing ? ` · ${item.missing} sem distribuição por fase` : ''}</small></div>)}</div></div>
        <p className="ewq-circuit-disclaimer">Carga em W: I = P / (V × FP); em três fases equilibradas: I = P / (√3 × V × FP), com tensão entre fases. Em duas fases com neutro, informe a corrente da fase mais carregada em A: a potência total não determina as correntes individuais. Use potência elétrica de entrada. A comparação Ib–In–Iz é preliminar: informe Iz já corrigida para temperatura, agrupamento e instalação; curto-circuito, queda de tensão, partida e demais critérios ainda exigem verificação. Ao mudar fases ou retirar N/PE, as ligações afetadas são removidas para evitar identificações enganosas.</p>
      </>}
      <datalist id="ewq-circuit-names">{['Iluminação', 'Tomadas de uso geral', 'Chuveiro', 'Ar-condicionado', 'Cozinha', 'Lavanderia', 'Forno elétrico', 'Bomba'].map(name => <option key={name} value={name} />)}</datalist>
      <datalist id="ewq-circuit-voltages">{[12, 24, 127, 220, 230, 254, 380, 400, 440].map(voltage => <option key={voltage} value={voltage} />)}</datalist>
      <datalist id="ewq-circuit-ratings">{CURRENTS.map(current => <option key={current} value={current} />)}</datalist>
      <datalist id="ewq-circuit-gauges">{GAUGES.map(gauge => <option key={gauge} value={gauge} />)}</datalist>
    </details>
  </section>;
}

export default CircuitsPanel;
