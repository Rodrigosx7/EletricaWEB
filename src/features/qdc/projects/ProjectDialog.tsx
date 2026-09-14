import { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import { PRELIMINARY_NOTICE, type Project, type Supply } from '../types';
import { automaticProject, emptyProject } from './factory';

const layouts: Record<string, [number, number]> = { '8': [1, 8], '12': [1, 12], '16': [1, 16], '18': [1, 18], '24': [2, 12], '36': [3, 12], '48': [4, 12] };
export default function ProjectDialog({ automatic, onCreate, onClose }: { automatic: boolean; onCreate(project: Project): void; onClose(): void }) {
  const [name, setName] = useState(automatic ? 'QDC Residencial' : 'Novo quadro');
  const [supply, setSupply] = useState<Supply>('mono');
  const [voltage, setVoltage] = useState(127);
  const [capacity, setCapacity] = useState('24');
  const [rails, setRails] = useState(2);
  const [modules, setModules] = useState(12);
  const [count, setCount] = useState(5);
  const [width, setWidth] = useState(400);
  const [height, setHeight] = useState(500);
  const [kind, setKind] = useState('Residencial');
  const [names, setNames] = useState('Iluminação\nTomadas sala\nTomadas quartos\nCozinha\nChuveiro');
  const [error, setError] = useState('');
  function create() {
    if (!name.trim()) { setError('Informe um nome para o projeto.'); return; }
    try {
      const layout = layouts[capacity] ?? [rails, modules];
      const config: Partial<Project> = { name: name.trim(), supply, voltage, rails: layout[0], modulesPerRail: layout[1], widthMm: width, heightMm: height };
      if (automatic) {
        const list = names.split('\n').map(n => n.trim()).filter(Boolean);
        if (!list.length || list.length > 40) throw new Error('Informe de 1 a 40 circuitos, um nome por linha.');
        onCreate(automaticProject(config, list));
      } else {
        const project = emptyProject(config);
        project.circuits = Array.from({ length: count }, (_, i) => ({ id: crypto.randomUUID(), number: i + 1, name: `Circuito ${i + 1}`, phase: 'R', breakerId: null, cableGauge: null, load: null, loadUnit: 'W', voltage, powerFactor: 1, drId: null, notes: '', color: '#e9b949' }));
        onCreate(project);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível criar o quadro.'); }
  }
  return <Modal title={automatic ? 'Montar QDC automaticamente' : 'Criar projeto'} onClose={onClose} description={automatic ? 'Uma proposta de disposição para você desenvolver.' : 'Escolha a caixa. O quadro começa vazio, pronto para receber os dispositivos.'} footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={create}>{automatic ? 'Gerar proposta visual' : 'Criar quadro vazio'}</button></>}>
    <div className="ewq-dialog-form">
      <label>Nome do projeto<input maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
      {automatic && <label>Tipo<select value={kind} onChange={e => { setKind(e.target.value); setName(`QDC ${e.target.value}`); setNames(e.target.value === 'Comercial' ? 'Iluminação\nTomadas atendimento\nTomadas escritório\nAr-condicionado\nCopa' : 'Iluminação\nTomadas sala\nTomadas quartos\nCozinha\nChuveiro'); }}><option>Residencial</option><option>Comercial</option></select></label>}
      <div className="ewq-dialog-grid">
        <label>Alimentação<select value={supply} onChange={e => { setSupply(e.target.value as Supply); setVoltage(e.target.value === 'mono' ? 127 : 220); }}><option value="mono">Monofásica · 1 fase</option><option value="bi">Bifásica · 2 fases</option><option value="tri">Trifásica · 3 fases</option></select></label>
        <label>Tensão {supply === 'mono' ? 'fase–neutro' : 'entre fases'}<select value={voltage} onChange={e => setVoltage(Number(e.target.value))}>{[127, 220, 380, 440].map(v => <option key={v} value={v}>{v} V</option>)}</select></label>
        <label>Capacidade do quadro<select value={capacity} onChange={e => setCapacity(e.target.value)}>{Object.keys(layouts).map(v => <option key={v} value={v}>{v} módulos DIN</option>)}<option value="custom">Personalizado</option></select></label>
        {!automatic && <label>Quantidade de circuitos<input type="number" min={0} max={40} value={count} onChange={e => setCount(Math.min(40, Math.max(0, Math.trunc(Number(e.target.value)))))} /></label>}
        {capacity === 'custom' && <><label>Trilhos<input type="number" min={1} max={6} value={rails} onChange={e => setRails(Math.min(6, Math.max(1, Math.trunc(Number(e.target.value)))))} /></label><label>Módulos por trilho<input type="number" min={4} max={36} value={modules} onChange={e => setModules(Math.min(36, Math.max(4, Math.trunc(Number(e.target.value)))))} /></label></>}
        <label>Largura da caixa (mm)<input type="number" min={100} max={3000} value={width} onChange={e => setWidth(Math.min(3000, Math.max(100, Number(e.target.value))))} /></label>
        <label>Altura da caixa (mm)<input type="number" min={100} max={3000} value={height} onChange={e => setHeight(Math.min(3000, Math.max(100, Number(e.target.value))))} /></label>
      </div>
      <small>Dimensões da caixa são informativas. Confira o espaço útil, trilhos e acessórios no fabricante.</small>
      {automatic && <><label>Circuitos · um por linha<textarea rows={7} maxLength={2000} value={names} onChange={e => setNames(e.target.value)} /></label><p className="ewq-notice">{PRELIMINARY_NOTICE}</p></>}
      {error && <p role="alert" className="ewq-error">{error}</p>}
    </div>
  </Modal>;
}
