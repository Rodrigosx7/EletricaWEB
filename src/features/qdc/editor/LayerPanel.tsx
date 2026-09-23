import { Cable, CircuitBoard, Eye, EyeOff, Layers3, LockKeyhole, LockKeyholeOpen } from 'lucide-react';
import { canEditLayer, type EditorLayers, type LayerFocus, type LayerId } from './layers';

export default function LayerPanel({ layers, counts, onFocus, onToggle, onClose }: {
  layers: EditorLayers;
  counts: Record<LayerId, number>;
  onFocus(focus: LayerFocus): void;
  onToggle(layer: LayerId, setting: 'visible' | 'locked'): void;
  onClose(): void;
}) {
  return <div className="ewq-layer-panel" role="dialog" aria-label="Camadas da montagem">
    <div className="ewq-layer-heading"><span><Layers3 size={16} aria-hidden="true" /> Camadas</span><button type="button" onClick={onClose} aria-label="Fechar camadas">Fechar</button></div>
    <p>Escolha o que editar. O olho oculta apenas na tela; o cadeado impede alterações diretas.</p>
    <button type="button" className="ewq-layer-all" aria-pressed={layers.focus === 'all'} onClick={() => onFocus('all')}>Editar todas as camadas</button>
    {([['components', 'Componentes', CircuitBoard], ['wires', 'Fios', Cable]] as const).map(([id, label, Icon]) => <div className={`ewq-layer-row${layers.focus === id ? ' is-active' : ''}`} key={id}>
      <button type="button" className="ewq-layer-select" aria-pressed={layers.focus === id} onClick={() => onFocus(id)}><Icon size={17} aria-hidden="true" /><span><strong>{label}</strong><small>{counts[id]} {id === 'wires' ? 'conexões' : 'itens'}{canEditLayer(layers, id) ? ' · editável' : ''}</small></span></button>
      <button type="button" className="ewq-layer-toggle" aria-label={`${layers[id].visible ? 'Ocultar' : 'Mostrar'} camada de ${label.toLowerCase()}`} aria-pressed={layers[id].visible} title={layers[id].visible ? 'Ocultar na tela' : 'Mostrar na tela'} onClick={() => onToggle(id, 'visible')}>{layers[id].visible ? <Eye size={17} aria-hidden="true" /> : <EyeOff size={17} aria-hidden="true" />}</button>
      <button type="button" className="ewq-layer-toggle" aria-label={`${layers[id].locked ? 'Desbloquear' : 'Bloquear'} camada de ${label.toLowerCase()}`} aria-pressed={layers[id].locked} title={layers[id].locked ? 'Desbloquear edição' : 'Bloquear edição'} onClick={() => onToggle(id, 'locked')}>{layers[id].locked ? <LockKeyhole size={16} aria-hidden="true" /> : <LockKeyholeOpen size={16} aria-hidden="true" />}</button>
    </div>)}
  </div>;
}
