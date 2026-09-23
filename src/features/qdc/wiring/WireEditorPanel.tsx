import { useState } from 'react';
import { Cable, CornerDownRight, Crosshair, Plus, Search, Trash2, X } from 'lucide-react';
import { WireDetails } from '../components/PropertiesPanel';
import { addWireDetour, deleteWireBend, moveWireBend } from './wireEditing';
import { boardSize } from './routing';
import type { Project, Wire } from '../types';

const CONDUCTORS = { phase: 'Fase', neutral: 'Neutro', earth: 'Terra / PE', return: 'Retorno' } as const;

export default function WireEditorPanel({ project, selectedWireId, editable, onSelectWire, onUpdateWire, onWirePath, onDelete, onClose }: {
  project: Project; selectedWireId: string | null; editable: boolean;
  onSelectWire(id: string): void; onUpdateWire(id: string, patch: Partial<Wire>): void;
  onWirePath(id: string, path: Wire['path']): void; onDelete(): void; onClose(): void;
}) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const selected = project.wires.find(wire => wire.id === selectedWireId);
  const filtered = project.wires.filter(wire => {
    const source = project.devices.find(device => device.id === wire.sourceComponent)?.label ?? '';
    const target = project.devices.find(device => device.id === wire.targetComponent)?.label ?? '';
    return `${wire.label} ${source} ${target} ${CONDUCTORS[wire.conductorType]}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'));
  });
  const bounds = boardSize(project);
  function pathAction(action: () => Wire['path']) {
    try { onWirePath(selected!.id, action()); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível editar o trajeto.'); }
  }
  function editCoordinate(index: number, axis: 'x' | 'y', input: HTMLInputElement) {
    if (!selected) return;
    const current = selected.path[index], value = Number(input.value);
    if (input.value.trim() === '' || !Number.isFinite(value)) { input.value = String(current[axis]); setError('Informe uma coordenada válida.'); return; }
    if (value === current[axis]) return;
    pathAction(() => moveWireBend(project, selected, index, { ...current, [axis]: value }));
    input.value = String(current[axis]);
  }
  return <aside className="ewq-panel ewq-wire-editor" aria-label="Editor de fios">
    <header className="ewq-panel-heading"><div><Cable size={17} aria-hidden="true" /><h2>Editor de fios</h2><span className="ewq-count">{project.wires.length}</span></div><button className="ewq-icon ewq-panel-close" type="button" aria-label="Fechar editor de fios" onClick={onClose}><X size={16} aria-hidden="true" /></button></header>
    <div className="ewq-wire-editor-body">
      <p className="ewq-panel-hint">Encontre um fio, ajuste suas propriedades e modele as dobras sem soltar as pontas dos bornes.</p>
      <label className="ewq-wire-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Buscar fios</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar fio ou componente" /></label>
      <div className="ewq-wire-list" role="group" aria-label="Fios do projeto">
        {filtered.length ? filtered.map(wire => <button key={wire.id} type="button" aria-pressed={selectedWireId === wire.id} onClick={() => { onSelectWire(wire.id); setError(''); }}><span className="ewq-wire-list-swatch" style={{ background: wire.color }} aria-hidden="true" /><span><strong>{wire.label || CONDUCTORS[wire.conductorType]}</strong><small>{CONDUCTORS[wire.conductorType]} · {wire.gauge === null ? 'bitola a definir' : `${wire.gauge} mm²`}{wire.manualPath ? ' · manual' : ''}</small></span><Crosshair size={15} aria-hidden="true" /></button>) : <p>{project.wires.length ? 'Nenhum fio corresponde à busca.' : 'Ainda não há fios no quadro. Use Passar fios para conectar os bornes.'}</p>}
      </div>
      {selected ? <fieldset className="ewq-wire-edit-fields" disabled={!editable}>
        {!editable && <legend>Camada de fios bloqueada ou oculta. Ajuste em Camadas para editar.</legend>}
        <WireDetails project={project} wire={selected} onUpdateWire={onUpdateWire} expanded />
        <section className="ewq-wire-points" aria-label="Pontos do trajeto"><header><div><CornerDownRight size={16} aria-hidden="true" /><strong>Pontos do trajeto</strong></div><span>{Math.max(0, selected.path.length - 2)} dobras</span></header>
          <p>As pontas permanecem nos bornes. Edite X/Y de cada dobra ou arraste as alças diretamente no quadro.</p>
          {selected.path.slice(1, -1).map((point, offset) => { const index = offset + 1; return <div className="ewq-wire-point-row" key={`${selected.id}-${index}-${point.x}-${point.y}`}><span>{String(index).padStart(2, '0')}</span><label>X<input type="number" step="any" min={0} max={bounds.width} defaultValue={point.x} aria-label={`Dobra ${index}, posição X`} onBlur={event => editCoordinate(index, 'x', event.currentTarget)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = String(point.x); event.currentTarget.blur(); } }} /></label><label>Y<input type="number" step="any" min={0} max={bounds.height} defaultValue={point.y} aria-label={`Dobra ${index}, posição Y`} onBlur={event => editCoordinate(index, 'y', event.currentTarget)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = String(point.y); event.currentTarget.blur(); } }} /></label><button type="button" aria-label={`Remover dobra ${index}`} title="Remover dobra" onClick={() => pathAction(() => deleteWireBend(project, selected, index))}><Trash2 size={14} aria-hidden="true" /></button></div>; })}
          <button type="button" className="ewq-wire-add-detour" disabled={selected.path.length >= 124} onClick={() => pathAction(() => addWireDetour(project, selected))}><Plus size={15} aria-hidden="true" /> Criar desvio</button>
        </section>
        {error && <p className="ewq-wire-edit-error" role="alert">{error}</p>}
        <button type="button" className="ewq-wire-delete" onClick={onDelete}><Trash2 size={15} aria-hidden="true" /> Excluir fio selecionado</button>
      </fieldset> : <div className="ewq-wire-pick-hint"><Cable size={20} aria-hidden="true" /><strong>Selecione um fio</strong><span>Clique na lista ou diretamente no quadro para abrir o traçado.</span></div>}
    </div>
  </aside>;
}
