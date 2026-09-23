import { Cable, CircleHelp, Crosshair, Route, X } from 'lucide-react';
import { circuitConnectionMap, connectionEndpointLabel } from './connectionMap';
import type { Project } from '../types';

const KIND_LABELS = { phase: 'Fase', neutral: 'Neutro', earth: 'Terra / PE' } as const;

export default function ConnectionMapPanel({ project, circuitId, onCircuit, onSelectWire, onClear, onClose }: {
  project: Project; circuitId: string | null; onCircuit(id: string): void; onSelectWire(id: string): void; onClear(): void; onClose(): void;
}) {
  const circuit = project.circuits.find(item => item.id === circuitId);
  const map = circuit ? circuitConnectionMap(project, circuit) : null;
  return <aside className="ewq-panel ewq-connection-map" aria-label="Mapa de conexões do quadro">
    <header className="ewq-panel-heading"><div><Route size={17} aria-hidden="true" /><h2>Mapa de conexões</h2></div><button className="ewq-icon ewq-panel-close" type="button" aria-label="Fechar mapa de conexões" onClick={onClose}><X size={16} aria-hidden="true" /></button></header>
    <div className="ewq-connection-body">
      <p className="ewq-panel-hint">Selecione um circuito para iluminar os fios e componentes do trajeto desenhado.</p>
      {!project.circuits.length ? <div className="ewq-panel-empty"><CircleHelp size={22} aria-hidden="true" /><strong>Nenhum circuito cadastrado</strong><span>Crie um circuito na aba Circuitos para explorar as conexões.</span></div> : <>
        <label className="ewq-connection-picker">Circuito<select value={circuitId ?? ''} onChange={event => event.target.value ? onCircuit(event.target.value) : onClear()}><option value="">Escolha um circuito</option>{project.circuits.map(item => <option key={item.id} value={item.id}>C{item.number} · {item.name || 'Sem nome'}</option>)}</select></label>
        {circuit && map && <>
          <div className="ewq-connection-summary"><span>C{circuit.number}</span><div><strong>{circuit.name || 'Circuito sem nome'}</strong><small>{map.wireIds.size} {map.wireIds.size === 1 ? 'fio relacionado' : 'fios relacionados'} no desenho</small></div><button type="button" onClick={onClear}>Limpar</button></div>
          {map.routes.map(route => <section className="ewq-connection-route" key={route.kind} aria-label={`Trajeto de ${KIND_LABELS[route.kind]}`}>
            <header><span className={`ewq-connection-dot is-${route.kind}`} aria-hidden="true" /><h3>{KIND_LABELS[route.kind]}</h3><span className={`ewq-connection-status${route.complete ? ' is-complete' : ''}`}>{route.complete ? 'Trajeto encontrado' : route.steps.length ? 'Trecho parcial' : 'Sem ligação'}</span></header>
            {route.steps.length ? <ol>{route.steps.map(step => <li key={step.wire.id}><button type="button" onClick={() => onSelectWire(step.wire.id)} aria-label={`Localizar fio entre ${connectionEndpointLabel(project, step.from)} e ${connectionEndpointLabel(project, step.to)}`}><Cable size={15} aria-hidden="true" /><span><strong>{connectionEndpointLabel(project, step.from)}</strong><small>↓</small><strong>{connectionEndpointLabel(project, step.to)}</strong></span><Crosshair size={15} aria-hidden="true" /></button></li>)}</ol> : <p>Nenhum fio deste condutor foi identificado na saída do circuito.</p>}
          </section>)}
          <p className="ewq-connection-disclaimer">O mapa mostra apenas ligações representadas no desenho. Um trajeto encontrado não confirma dimensionamento, funcionamento nem conformidade elétrica.</p>
        </>}
      </>}
    </div>
  </aside>;
}
