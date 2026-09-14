import { ChevronDown, CircuitBoard, Crosshair, Plus, Trash2 } from 'lucide-react';
import { circuitCurrent, phaseBalance } from './analysis';
import type { Circuit, Device, Project } from '../types';
import '../components/panels.css';

export type CircuitsPanelProps = {
  project: Project;
  onUpdateCircuit(id: string, patch: Partial<Circuit>): void;
  onAddCircuit(): void; onDeleteCircuit(id: string): void;
  onSelectDevice(id: string): void;
  onUpdateDevice(id: string, patch: Partial<Device>): void;
};

const GAUGES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];
const CURRENTS = [2, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
const formatCurrent = (current: number) => current.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export function CircuitsPanel({ project, onUpdateCircuit, onAddCircuit, onDeleteCircuit, onSelectDevice, onUpdateDevice }: CircuitsPanelProps) {
  const breakers = project.devices.filter(device => device.type.startsWith('breaker-') || device.type === 'main-breaker' || device.type.startsWith('rcbo-') || device.type.startsWith('motor-breaker-'));
  const rcds = project.devices.filter(device => device.type.startsWith('rcd-') || device.type.startsWith('rcbo-'));
  const phases = project.supply === 'mono' ? ['R'] : project.supply === 'bi' ? ['R', 'S', 'R/S'] : ['R', 'S', 'T', 'R/S', 'S/T', 'R/T', 'R/S/T'];
  const balance = phaseBalance(project);
  const largestPhase = Math.max(1, ...balance.map(item => item.current));
  return <section className="ewq-circuits" aria-label="Circuitos e distribuição de cargas">
    <details open className="ewq-circuits-disclosure">
      <summary className="ewq-circuits-heading"><span><CircuitBoard size={17} aria-hidden="true" /><strong>Circuitos</strong><span className="ewq-count">{project.circuits.length}</span></span><span className="ewq-circuits-disclosure-hint">Cargas e proteção <ChevronDown size={16} aria-hidden="true" /></span></summary>
      <div className="ewq-circuit-toolbar"><p>Vincule cada circuito ao disjuntor do quadro.</p><button type="button" onClick={onAddCircuit}><Plus size={14} aria-hidden="true" />Adicionar circuito</button></div>
      {!project.circuits.length ? <div className="ewq-circuits-empty"><CircuitBoard size={25} aria-hidden="true" /><div><strong>Organize os circuitos da instalação</strong><p>Adicione iluminação, tomadas e cargas específicas para identificá-las no quadro.</p></div><button type="button" onClick={onAddCircuit}><Plus size={15} aria-hidden="true" />Primeiro circuito</button></div> : <>
        <div className="ewq-circuit-table-scroll" tabIndex={0} role="region" aria-label="Tabela de circuitos, role horizontalmente para ver todos os campos">
          <table className="ewq-circuit-table"><thead><tr><th scope="col">Circuito</th><th scope="col">Fases</th><th scope="col">Tensão</th><th scope="col">Carga / FP</th><th scope="col">Corrente da carga</th><th scope="col">Disjuntor / nominal / polos</th><th scope="col">Condutor</th><th scope="col">DR vinculado</th><th scope="col">Observações</th><th scope="col"><span className="ewq-visually-hidden">Ações</span></th></tr></thead>
            <tbody>{project.circuits.map(circuit => {
              const breaker = breakers.find(device => device.id === circuit.breakerId);
              const current = circuitCurrent(circuit);
              const label = `Circuito ${circuit.number}`;
              const update = (patch: Partial<Circuit>) => onUpdateCircuit(circuit.id, patch);
              return <tr key={circuit.id}>
                <td><div className="ewq-circuit-name"><span className="ewq-circuit-number"><span>C</span><input type="number" min={1} step={1} value={circuit.number} aria-label={`${label}: número`} onChange={event => { const number = Number(event.target.value); if (Number.isInteger(number) && number > 0) update({ number }); }} /></span><input value={circuit.name} maxLength={100} list="ewq-circuit-names" aria-label={`${label}: nome`} placeholder="Nome do circuito" onChange={event => update({ name: event.target.value })} /></div></td>
                <td><select value={circuit.phase} aria-label={`${label}: fases`} onChange={event => update({ phase: event.target.value })}>{!phases.includes(circuit.phase) && <option value={circuit.phase}>{circuit.phase || 'Definir'}{circuit.phase ? ' (revisar)' : ''}</option>}{phases.map(phase => <option key={phase} value={phase}>{phase}</option>)}</select></td>
                <td><div className="ewq-input-unit"><input type="number" min={1} step="any" value={circuit.voltage || ''} list="ewq-circuit-voltages" aria-label={`${label}: tensão da carga em volts`} onChange={event => update({ voltage: event.target.value === '' ? 0 : Math.max(0, Number(event.target.value)) })} /><span>V</span></div></td>
                <td><div className="ewq-circuit-load"><input type="number" min={0} step="any" value={circuit.load ?? ''} placeholder="Carga" aria-label={`${label}: carga em ${circuit.loadUnit}`} onChange={event => update({ load: event.target.value === '' ? null : Math.max(0, Number(event.target.value)) })} /><select value={circuit.loadUnit} aria-label={`${label}: unidade da carga`} onChange={event => update({ loadUnit: event.target.value as Circuit['loadUnit'] })}><option value="W">W</option><option value="A">A</option></select></div><label className="ewq-circuit-pf"><span>FP</span><input type="number" min={0.01} max={1} step={0.01} value={circuit.powerFactor || ''} disabled={circuit.loadUnit === 'A'} aria-label={`${label}: fator de potência`} title="Informe o fator de potência da carga. Não equivale ao rendimento." onChange={event => { const powerFactor = Number(event.target.value); if (Number.isFinite(powerFactor) && powerFactor >= 0 && powerFactor <= 1) update({ powerFactor }); }} /></label></td>
                <td><output className="ewq-current-value" aria-label={`${label}: corrente da carga`}>{current === null ? '—' : `${formatCurrent(current)} A`}</output><small className="ewq-table-help">{circuit.loadUnit === 'A' ? 'Informada' : current === null ? 'Dados pendentes' : circuit.phase === 'R/S/T' ? '3φ equilibrada' : 'Calculada'}</small></td>
                <td><select value={circuit.breakerId ?? ''} aria-label={`${label}: disjuntor vinculado`} onChange={event => update({ breakerId: event.target.value || null })}><option value="">Selecionar disjuntor</option>{breakers.map(device => <option key={device.id} value={device.id}>{device.label} · T{device.rail + 1}/{device.slot + 1}</option>)}</select><div className="ewq-circuit-protection"><label className="ewq-input-unit"><input type="number" min={1} step="any" list="ewq-circuit-ratings" value={breaker?.amperage ?? ''} disabled={!breaker} aria-label={`${label}: corrente nominal do disjuntor em amperes`} onChange={event => breaker && onUpdateDevice(breaker.id, { amperage: event.target.value === '' ? null : Math.max(0, Number(event.target.value)) })} /><span>A</span></label><select value={breaker?.poles ?? ''} disabled={!breaker} aria-label={`${label}: polos do disjuntor`} onChange={event => breaker && onUpdateDevice(breaker.id, { poles: Number(event.target.value) })}>{!breaker && <option value="">Polos</option>}{[1, 2, 3, 4].map(poles => <option key={poles} value={poles}>{poles}P</option>)}</select></div></td>
                <td><div className="ewq-input-unit"><input type="number" min={0} step="any" list="ewq-circuit-gauges" value={circuit.cableGauge ?? ''} placeholder="Definir" aria-label={`${label}: seção do condutor em milímetros quadrados`} onChange={event => update({ cableGauge: event.target.value === '' ? null : Math.max(0, Number(event.target.value)) })} /><span>mm²</span></div></td>
                <td><select value={circuit.drId ?? ''} aria-label={`${label}: DR vinculado`} onChange={event => update({ drId: event.target.value || null })}><option value="">Não definido</option>{rcds.map(device => <option key={device.id} value={device.id}>{device.label} · T{device.rail + 1}/{device.slot + 1}</option>)}</select></td>
                <td><textarea rows={2} maxLength={600} value={circuit.notes} aria-label={`${label}: observações`} placeholder="Ambiente, carga, referência…" onChange={event => update({ notes: event.target.value })} /></td>
                <td><div className="ewq-row-actions"><button type="button" disabled={!breaker} onClick={() => breaker && onSelectDevice(breaker.id)} aria-label={`Localizar disjuntor do ${label.toLowerCase()}`} title="Selecionar disjuntor no quadro"><Crosshair size={15} aria-hidden="true" /></button><button type="button" className="ewq-danger-button" onClick={() => onDeleteCircuit(circuit.id)} aria-label={`Excluir ${label.toLowerCase()}`} title="Excluir circuito"><Trash2 size={14} aria-hidden="true" /></button></div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <div className="ewq-phase-analysis"><div className="ewq-phase-analysis-label"><strong>Distribuição das cargas</strong><p>Soma das magnitudes das correntes por fase. Não considera demanda nem soma fasorial.</p></div><div className="ewq-phase-balances">{balance.map(item => <div className="ewq-phase-balance" key={item.phase}><div><strong>Fase {item.phase}</strong><span>{formatCurrent(item.current)} A</span></div><div className="ewq-phase-track"><span style={{ width: `${Math.max(0, (item.current / largestPhase) * 100)}%` }} /></div><small>{item.count} {item.count === 1 ? 'circuito' : 'circuitos'}{item.missing ? ` · ${item.missing} sem corrente calculável` : ''}</small></div>)}</div></div>
        <p className="ewq-circuit-disclaimer">Carga em W: I = P / (V × FP); em três fases equilibradas: I = P / (√3 × V × FP), com tensão entre fases. Use potência elétrica de entrada. A corrente nominal do disjuntor é uma especificação separada.</p>
      </>}
      <datalist id="ewq-circuit-names">{['Iluminação', 'Tomadas de uso geral', 'Chuveiro', 'Ar-condicionado', 'Cozinha', 'Lavanderia', 'Forno elétrico', 'Bomba'].map(name => <option key={name} value={name} />)}</datalist>
      <datalist id="ewq-circuit-voltages">{[12, 24, 127, 220, 230, 254, 380, 400, 440].map(voltage => <option key={voltage} value={voltage} />)}</datalist>
      <datalist id="ewq-circuit-ratings">{CURRENTS.map(current => <option key={current} value={current} />)}</datalist>
      <datalist id="ewq-circuit-gauges">{GAUGES.map(gauge => <option key={gauge} value={gauge} />)}</datalist>
    </details>
  </section>;
}

export default CircuitsPanel;
