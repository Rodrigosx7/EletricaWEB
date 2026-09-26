import { CircuitBoard, Plus } from 'lucide-react';
import CircuitInspector from './CircuitInspector';
import type { Circuit, Device, Project } from '../types';

type Props = {
  project: Project;
  selectedCircuitId: string | null;
  onSelect(id: string): void;
  onOverview(): void;
  onAdd(): void;
  onUpdate(id: string, patch: Partial<Circuit>): void;
  onUpdateDevice(id: string, patch: Partial<Device>): void;
  onConduit(circuitId: string, conduitId: string): void;
  onMap(id: string): void;
  onDelete(id: string): void;
};

export default function CircuitSidebar({ project, selectedCircuitId, onSelect, onOverview, onAdd, onUpdate, onUpdateDevice, onConduit, onMap, onDelete }: Props) {
  const selected = project.circuits.find(circuit => circuit.id === selectedCircuitId);
  const circuits = [...project.circuits].sort((a, b) => a.number - b.number);

  return <section className="ewq-circuit-sidebar" aria-label="Circuitos do quadro">
    <header className="ewq-circuit-sidebar-header">
      <div><strong>Circuitos</strong><span>{circuits.length} no quadro</span></div>
      <button type="button" onClick={onAdd}><Plus size={15} aria-hidden="true" /> Adicionar</button>
    </header>
    {selected ? <CircuitInspector project={project} circuit={selected} onUpdate={patch => onUpdate(selected.id, patch)} onUpdateDevice={onUpdateDevice} onConduit={conduitId => onConduit(selected.id, conduitId)} onMap={() => onMap(selected.id)} onDelete={() => onDelete(selected.id)} onClose={onOverview} />
      : <div className="ewq-circuit-sidebar-list">
        {circuits.length ? circuits.map(circuit => <button type="button" key={circuit.id} onClick={() => onSelect(circuit.id)}>
          <span>C{circuit.number}</span><strong>{circuit.name || 'Sem nome'}</strong><small>{circuit.phase} · {[...(circuit.hasNeutral !== false ? ['N'] : []), ...(circuit.hasEarth !== false ? ['PE'] : [])].join(' · ') || 'sem N/PE'}</small>
        </button>) : <div className="ewq-circuit-sidebar-empty"><CircuitBoard size={26} aria-hidden="true" /><strong>Nenhum circuito ainda</strong><p>Adicione o primeiro circuito e suas pontas aparecerão na entrada do quadro.</p></div>}
      </div>}
  </section>;
}
