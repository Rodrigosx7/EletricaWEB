import { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import { PRELIMINARY_NOTICE, type Project, type Supply } from '../types';
import { automaticProject, automaticRequiredModules, emptyProject } from './factory';
import { prepareCircuitOutputs } from '../editor/operations';
import CircuitComposer from '../circuits/CircuitComposer';
import { circuitFromDraft, phaseOptions, suggestedCircuitVoltage, type CircuitDraft } from '../circuits/circuitDraft';

const layouts: Record<string, [number, number]> = { '8': [1, 8], '12': [1, 12], '16': [1, 16], '18': [1, 18], '24': [2, 12], '36': [3, 12], '48': [4, 12] };
export default function ProjectDialog({ automatic, onCreate, onClose }: { automatic: boolean; onCreate(project: Project): void; onClose(): void }) {
  const [name, setName] = useState(automatic ? 'QDC Residencial' : 'Novo quadro');
  const [supply, setSupply] = useState<Supply>('mono');
  const [voltage, setVoltage] = useState(127);
  const [capacity, setCapacity] = useState('24');
  const [rails, setRails] = useState(2);
  const [modules, setModules] = useState(12);
  const [circuits, setCircuits] = useState<CircuitDraft[]>([]);
  const [width, setWidth] = useState(400);
  const [height, setHeight] = useState(500);
  const [kind, setKind] = useState('Residencial');
  const [names, setNames] = useState('Iluminação\nTomadas sala\nTomadas quartos\nCozinha\nChuveiro');
  const [error, setError] = useState('');
  const circuitNames = names.split('\n').map(value => value.trim()).filter(Boolean);
  const selectedLayout = layouts[capacity] ?? [rails, modules];
  const availableModules = selectedLayout[0] * selectedLayout[1];
  const requiredModules = automaticRequiredModules(supply, circuitNames.length);
  const freeModules = availableModules - requiredModules;
  const recommendedCapacity = Object.entries(layouts).find(([, layout]) => layout[0] * layout[1] >= requiredModules)?.[0];
  function create() {
    if (!name.trim()) { setError('Informe um nome para o projeto.'); return; }
    try {
      const layout = layouts[capacity] ?? [rails, modules];
      const config: Partial<Project> = { name: name.trim(), supply, voltage, rails: layout[0], modulesPerRail: layout[1], widthMm: width, heightMm: height };
      if (automatic) {
        const list = circuitNames;
        if (!list.length || list.length > 60) throw new Error('Informe de 1 a 60 circuitos, um nome por linha.');
        onCreate(automaticProject(config, list));
      } else {
        const project = emptyProject(config);
        onCreate(prepareCircuitOutputs({ ...project, circuits: circuits.map((draft, index) => circuitFromDraft(draft, index + 1)) }));
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível criar o quadro.'); }
  }
  return <Modal title={automatic ? 'Montar QDC automaticamente' : 'Criar projeto'} onClose={onClose} description={automatic ? 'Uma proposta de disposição para você desenvolver.' : 'Configure os circuitos antes de montar. As saídas ficam prontas para puxar os fios até os dispositivos.'} footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={create}>{automatic ? 'Gerar proposta visual' : 'Criar quadro'}</button></>}>
    <div className="ewq-dialog-form">
      <label>Nome do projeto<input maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
      {automatic && <label>Tipo<select value={kind} onChange={e => { setKind(e.target.value); setName(`QDC ${e.target.value}`); setNames(e.target.value === 'Comercial' ? 'Iluminação\nTomadas atendimento\nTomadas escritório\nAr-condicionado\nCopa' : 'Iluminação\nTomadas sala\nTomadas quartos\nCozinha\nChuveiro'); }}><option>Residencial</option><option>Comercial</option></select></label>}
      <div className="ewq-dialog-grid">
        <label>Alimentação<select value={supply} onChange={e => { const next = e.target.value as Supply, nextVoltage = next === 'mono' ? 127 : 220; setCircuits(circuits.map(draft => { const phase = phaseOptions(next).includes(draft.phase) ? draft.phase : 'R'; return { ...draft, phase, voltage: draft.voltage === suggestedCircuitVoltage(supply, draft.phase, voltage) ? suggestedCircuitVoltage(next, phase, nextVoltage) : draft.voltage }; })); setSupply(next); setVoltage(nextVoltage); }}><option value="mono">Monofásica · 1 fase</option><option value="bi">Bifásica · 2 fases</option><option value="tri">Trifásica · 3 fases</option></select></label>
        <label>Tensão {supply === 'mono' ? 'fase–neutro' : 'entre fases'}<select value={voltage} onChange={e => { const next = Number(e.target.value); setCircuits(circuits.map(draft => ({ ...draft, voltage: draft.voltage === suggestedCircuitVoltage(supply, draft.phase, voltage) ? suggestedCircuitVoltage(supply, draft.phase, next) : draft.voltage }))); setVoltage(next); }}>{[127, 220, 380, 440].map(v => <option key={v} value={v}>{v} V</option>)}</select></label>
        <label>Capacidade do quadro<select value={capacity} onChange={e => setCapacity(e.target.value)}>{Object.keys(layouts).map(v => <option key={v} value={v}>{v} módulos DIN</option>)}<option value="custom">Personalizado</option></select></label>
        {capacity === 'custom' && <><label>Trilhos<input type="number" min={1} max={6} value={rails} onChange={e => setRails(Math.min(6, Math.max(1, Math.trunc(Number(e.target.value)))))} /></label><label>Módulos por trilho<input type="number" min={4} max={36} value={modules} onChange={e => setModules(Math.min(36, Math.max(4, Math.trunc(Number(e.target.value)))))} /></label></>}
        <label>Largura da caixa (mm)<input type="number" min={100} max={3000} value={width} onChange={e => setWidth(Math.min(3000, Math.max(100, Number(e.target.value))))} /></label>
        <label>Altura da caixa (mm)<input type="number" min={100} max={3000} value={height} onChange={e => setHeight(Math.min(3000, Math.max(100, Number(e.target.value))))} /></label>
      </div>
      <small>Dimensões da caixa são informativas. Confira o espaço útil, trilhos e acessórios no fabricante.</small>
      {!automatic && <section className="ewq-dialog-circuits" aria-label="Circuitos do novo quadro"><div className="ewq-dialog-circuits-heading"><strong>Circuitos configurados</strong><span>{circuits.length}/60</span></div><p>Adicione um por vez. Cada circuito terá suas próprias pontas livres na saída do quadro.</p>{circuits.length > 0 && <ol>{circuits.map((draft, index) => <li key={index}><span className="ewq-dialog-circuit-index">C{index + 1}</span><span><strong>{draft.name}</strong><small>{draft.phase} · {draft.voltage} V · {draft.cableGauge ? `${draft.cableGauge} mm²` : 'bitola a definir'} · {[...draft.phase.split('/'), ...(draft.hasNeutral ? ['N'] : []), ...(draft.hasEarth ? ['PE'] : [])].join(' / ')}</small></span><button type="button" aria-label={`Remover ${draft.name}`} onClick={() => setCircuits(circuits.filter((_, item) => item !== index))}>Remover</button></li>)}</ol>}{circuits.length < 60 && <CircuitComposer key={`${supply}-${voltage}-${circuits.length}`} supply={supply} number={circuits.length + 1} referenceVoltage={voltage} onAdd={draft => { setCircuits([...circuits, draft]); setError(''); return true; }} />}</section>}
      {automatic && <>
        <label>Circuitos · um por linha<textarea rows={7} maxLength={2000} value={names} onChange={e => { setNames(e.target.value); setError(''); }} /></label>
        <div className={`ewq-capacity-preview ${freeModules < 0 ? 'is-insufficient' : freeModules <= 2 ? 'is-tight' : 'is-comfortable'}`}>
          <div className="ewq-capacity-heading"><span>Ocupação estimada</span><strong>{requiredModules} de {availableModules} módulos</strong></div>
          <div className="ewq-capacity-track" aria-label={`${Math.min(requiredModules, availableModules)} de ${availableModules} módulos estimados`}><span style={{ width: `${Math.min(100, requiredModules / Math.max(1, availableModules) * 100)}%` }} /></div>
          <div className="ewq-capacity-detail">
            <span>{circuitNames.length} circuito{circuitNames.length === 1 ? '' : 's'} · {selectedLayout[0]} trilho{selectedLayout[0] === 1 ? '' : 's'}</span>
            {freeModules >= 0 ? <span>{freeModules} módulo{freeModules === 1 ? '' : 's'} livre{freeModules === 1 ? '' : 's'}</span> : <span>Faltam {Math.abs(freeModules)} módulos</span>}
          </div>
          {freeModules < 0 && recommendedCapacity && <button type="button" className="ewq-capacity-action" onClick={() => { setCapacity(recommendedCapacity); setError(''); }}>Usar quadro de {recommendedCapacity} módulos</button>}
          <small>Estimativa física dos dispositivos da proposta; barramentos pente ficam sobrepostos e não consomem módulos DIN.</small>
        </div>
        <p className="ewq-notice">{PRELIMINARY_NOTICE}</p>
      </>}
      {error && <p role="alert" className="ewq-error">{error}</p>}
    </div>
  </Modal>;
}
