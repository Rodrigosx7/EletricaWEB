import { useState } from 'react';
import type { Supply } from '../types';
import { newCircuitDraft, phaseOptions, suggestedCircuitVoltage, type CircuitDraft } from './circuitDraft';

export default function CircuitComposer({ supply, number, referenceVoltage, onAdd }: { supply: Supply; number: number; referenceVoltage: number; onAdd(draft: CircuitDraft): boolean }) {
  const [draft, setDraft] = useState<CircuitDraft>(() => newCircuitDraft(supply, number, referenceVoltage));
  const [error, setError] = useState('');
  const options = phaseOptions(supply);
  const phase = options.includes(draft.phase) ? draft.phase : options[0];
  function add() {
    if (!draft.name.trim()) { setError('Dê um nome ao circuito.'); return; }
    if (!Number.isFinite(draft.voltage) || draft.voltage <= 0) { setError('Informe uma tensão de carga válida.'); return; }
    if (draft.cableGauge !== null && (!Number.isFinite(draft.cableGauge) || draft.cableGauge <= 0)) { setError('Informe uma bitola positiva ou deixe em branco.'); return; }
    if (!draft.sameGauge && [draft.neutralGauge, draft.earthGauge].some(gauge => gauge !== null && (!Number.isFinite(gauge) || gauge <= 0))) { setError('Informe bitolas positivas ou deixe em branco.'); return; }
    if (!onAdd({ ...draft, phase, name: draft.name.trim() })) return;
    setDraft(newCircuitDraft(supply, number + 1, referenceVoltage));
    setError('');
  }
  return <div className="ewq-circuit-composer">
    <div className="ewq-dialog-grid">
      <label>Nome do circuito<input value={draft.name} maxLength={100} onChange={event => { setDraft({ ...draft, name: event.target.value }); setError(''); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} /></label>
      <label>Descrição opcional<input value={draft.description} maxLength={600} placeholder="Ambiente, uso ou referência" onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
      <label>Fases<select value={phase} onChange={event => { const next = event.target.value; setDraft({ ...draft, phase: next, voltage: draft.voltage === suggestedCircuitVoltage(supply, phase, referenceVoltage) ? suggestedCircuitVoltage(supply, next, referenceVoltage) : draft.voltage }); }}>{options.map(option => <option key={option} value={option}>{option} · {option.split('/').length} {option.includes('/') ? 'fases' : 'fase'}</option>)}</select></label>
      <label>Tensão da carga (V)<input type="number" min="1" step="any" list="ewq-composer-voltages" value={draft.voltage} onChange={event => setDraft({ ...draft, voltage: Number(event.target.value) })} /></label>
      <label>Bitola das fases (mm²)<input type="number" min="0.01" step="any" list="ewq-composer-gauges" value={draft.cableGauge ?? ''} placeholder="A definir" onChange={event => setDraft({ ...draft, cableGauge: event.target.value === '' ? null : Number(event.target.value) })} /></label>
    </div>
    <label className="ewq-circuit-same-gauge"><input type="checkbox" checked={draft.sameGauge} onChange={event => setDraft({ ...draft, sameGauge: event.target.checked })} /> Usar a mesma bitola para fase, neutro e PE</label>
    {!draft.sameGauge && <div className="ewq-dialog-grid">
      {draft.hasNeutral && <label>Bitola do neutro (mm²)<input type="number" min="0.01" step="any" list="ewq-composer-gauges" value={draft.neutralGauge ?? ''} placeholder="A definir" onChange={event => setDraft({ ...draft, neutralGauge: event.target.value === '' ? null : Number(event.target.value) })} /></label>}
      {draft.hasEarth && <label>Bitola do PE (mm²)<input type="number" min="0.01" step="any" list="ewq-composer-gauges" value={draft.earthGauge ?? ''} placeholder="A definir" onChange={event => setDraft({ ...draft, earthGauge: event.target.value === '' ? null : Number(event.target.value) })} /></label>}
    </div>}
    <small>A tensão inicial é uma sugestão para a alimentação escolhida. Confirme a tensão real do circuito. A seção do PE e do neutro exige verificação própria antes da execução.</small>
    <div className="ewq-circuit-conductors" role="group" aria-label="Condutores adicionais"><label><input type="checkbox" checked={draft.hasNeutral} onChange={event => setDraft({ ...draft, hasNeutral: event.target.checked })} /> Neutro</label><label><input type="checkbox" checked={draft.hasEarth} onChange={event => setDraft({ ...draft, hasEarth: event.target.checked })} /> Proteção (PE)</label></div>
    <div className="ewq-circuit-composer-colors" role="group" aria-label="Cores de identificação dos condutores">{phase.split('/').map((_, index) => <label key={index}>L{index + 1}<input type="color" value={draft.phaseColors[index]} onChange={event => setDraft({ ...draft, phaseColors: draft.phaseColors.map((color, item) => item === index ? event.target.value : color) })} /></label>)}{draft.hasNeutral && <label>N<input type="color" value={draft.neutralColor} onChange={event => setDraft({ ...draft, neutralColor: event.target.value })} /></label>}{draft.hasEarth && <label>PE<input type="color" value={draft.earthColor} onChange={event => setDraft({ ...draft, earthColor: event.target.value })} /></label>}</div>
    <div className="ewq-circuit-composer-footer"><span>{phase.split('/').length + Number(draft.hasNeutral) + Number(draft.hasEarth)} pontas livres na saída</span><button type="button" className="btn-secondary" onClick={add}>+ Adicionar circuito</button></div>
    {error && <p role="alert" className="ewq-error">{error}</p>}
    <datalist id="ewq-composer-gauges">{[1.5, 2.5, 4, 6, 10, 16, 25, 35, 50].map(gauge => <option key={gauge} value={gauge} />)}</datalist>
    <datalist id="ewq-composer-voltages">{[127, 220, 254, 380, 440].map(voltage => <option key={voltage} value={voltage} />)}</datalist>
  </div>;
}
