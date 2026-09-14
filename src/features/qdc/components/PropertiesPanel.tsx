import { useState, type ReactNode } from 'react';
import { Cable, Copy, Info, Settings2, Trash2 } from 'lucide-react';
import { CATALOG, DPS_MODELS } from '../electrical-components/catalog';
import { isRailMounted } from '../wiring/routing';
import { ferruleColor, TERMINATION_OPTIONS, WIRE_COLORS, WIRE_GAUGES } from '../wiring/options';
import type { Conductor, Device, EdgeSide, Project, Selection, Wire, WireTermination } from '../types';
import './panels.css';

export type PropertiesPanelProps = {
  project: Project; selection: Selection;
  onUpdateDevice(id: string, patch: Partial<Device>): void;
  onUpdateWire(id: string, patch: Partial<Wire>): void;
  onDelete(): void; onDuplicate(): void;
  onUpdateProject(patch: Partial<Project>): void;
};

const CURRENTS = [2, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
const VOLTAGES = [12, 24, 110, 127, 220, 230, 254, 380, 400, 440];
const SIDES: { value: EdgeSide; label: string }[] = [{ value: 'top', label: 'Borda superior' }, { value: 'bottom', label: 'Borda inferior' }, { value: 'left', label: 'Borda esquerda' }, { value: 'right', label: 'Borda direita' }];

function Field({ label, children, wide = false, help }: { label: string; children: ReactNode; wide?: boolean; help?: string }) {
  return <label className={`ewq-field${wide ? ' ewq-field-wide' : ''}`}><span>{label}</span>{children}{help && <small>{help}</small>}</label>;
}

function Numeric({ value, onChange, options, min = 0, max, step = 'any', list }: { value: number | null; onChange(value: number | null): void; options?: readonly number[]; min?: number; max?: number; step?: number | string; list: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return <><input type="number" inputMode="decimal" min={min} max={max} step={step} value={draft ?? value ?? ''} placeholder="Não definido" list={options ? list : undefined} onFocus={() => setDraft(value === null ? '' : String(value))} onBlur={() => setDraft(null)} onChange={event => { setDraft(event.target.value); const next = event.target.value === '' ? null : Number(event.target.value); if (next === null || (Number.isFinite(next) && next >= min && (max === undefined || next <= max))) onChange(next); }} />{options && <datalist id={list}>{options.map(option => <option key={option} value={option} />)}</datalist>}</>;
}

function SelectedActions({ onDuplicate, onDelete, plural = false }: { onDuplicate?: () => void; onDelete(): void; plural?: boolean }) {
  return <div className="ewq-selection-actions">{onDuplicate && <button type="button" onClick={onDuplicate}><Copy size={14} />Duplicar</button>}<button type="button" className="ewq-danger-button" onClick={onDelete}><Trash2 size={14} />Excluir{plural ? ' seleção' : ''}</button></div>;
}

function ColorPalette({ conductor, value, onChange }: { conductor: Conductor; value: string; onChange(value: string): void }) {
  return <div className="ewq-color-palette" role="radiogroup" aria-label="Cor do fio">{WIRE_COLORS[conductor].map(color => <button key={color.value} type="button" role="radio" aria-checked={value === color.value} className={value === color.value ? 'is-active' : ''} onClick={() => onChange(color.value)} title={color.label}><span style={{ background: color.value }} />{color.label}</button>)}</div>;
}

export function PropertiesPanel({ project, selection, onUpdateDevice, onUpdateWire, onDelete, onDuplicate, onUpdateProject }: PropertiesPanelProps) {
  const device = selection.devices.length === 1 ? project.devices.find(item => item.id === selection.devices[0]) : undefined;
  const wire = selection.wire ? project.wires.find(item => item.id === selection.wire) : undefined;
  const multiple = selection.devices.length > 1;
  const catalogItem = device ? CATALOG.find(item => item.type === device.type) : undefined;
  const update = (patch: Partial<Device>) => device && onUpdateDevice(device.id, patch);
  const isBreaker = !!device && (device.type.startsWith('breaker-') || device.type.startsWith('rcbo-') || device.type.startsWith('motor-breaker-'));
  const isRcd = !!device && (device.type.startsWith('rcd-') || device.type.startsWith('rcbo-'));
  const isBus = !!device && (device.type === 'neutral-bus' || device.type === 'earth-bus');
  const isComb = device?.type === 'comb-bus';
  const isEdgeEntry = device?.type === 'power-entry' || device?.type === 'conduit-entry';
  const heading = multiple ? 'Seleção múltipla' : wire ? 'Condutor' : device ? 'Componente' : 'Configuração do quadro';
  const railPlacement = device && <><Field label="Trilho"><select value={device.rail} onChange={event => update({ rail: Number(event.target.value) })}>{Array.from({ length: project.rails }, (_, index) => <option key={index} value={index}>Trilho {index + 1}</option>)}</select></Field><Field label="Módulo inicial"><select value={device.slot} onChange={event => update({ slot: Number(event.target.value) })}>{Array.from({ length: Math.max(1, project.modulesPerRail - device.modules + 1) }, (_, index) => <option key={index} value={index}>{index + 1}</option>)}</select></Field></>;
  const edgePlacement = device && <><Field label="Borda"><select value={device.edgeSide ?? 'top'} onChange={event => update({ edgeSide: event.target.value as EdgeSide })}>{SIDES.map(side => <option key={side.value} value={side.value}>{side.label}</option>)}</select></Field><Field label="Posição na borda (%)"><Numeric value={device.edgeOffset ?? 50} min={0} max={100} step={1} list="ewq-edge-offset" onChange={edgeOffset => update({ edgeOffset: edgeOffset ?? 50 })} /></Field></>;
  return <aside className="ewq-panel ewq-properties" aria-label="Propriedades do quadro e da seleção">
    <header className="ewq-panel-heading"><div><Settings2 size={17} /><h2>Propriedades</h2></div></header>
    <div className="ewq-properties-body"><p className="ewq-eyebrow">{heading}</p>
      {multiple ? <>
        <h3 className="ewq-properties-title">{selection.devices.length} componentes</h3>
        <p className="ewq-panel-hint">Mova a seleção pelo quadro ou escolha um componente para editar.</p>
        <SelectedActions onDelete={onDelete} onDuplicate={onDuplicate} plural />
      </> : wire ? <>
        <h3 className="ewq-properties-title"><Cable size={17} />{wire.label || 'Ligação elétrica'}</h3>
        <div className="ewq-wire-endpoints">{[wire.sourceComponent, wire.targetComponent].map((id, index) => { const component = project.devices.find(item => item.id === id); return <div key={`${id}-${index}`}><small>{index ? 'Destino' : 'Origem'}</small><strong>{component?.label ?? 'Componente removido'}</strong></div>; })}</div>
        <div className="ewq-field-grid">
          <Field label="Identificação" wide><input value={wire.label} maxLength={80} placeholder="Ex.: alimentação do disjuntor" onChange={event => onUpdateWire(wire.id, { label: event.target.value })} /></Field>
          <Field label="Tipo de condutor" wide><select value={wire.conductorType} onChange={event => { const conductorType = event.target.value as Conductor; onUpdateWire(wire.id, { conductorType, color: WIRE_COLORS[conductorType][0].value }); }}><option value="phase">Fase</option><option value="neutral">Neutro (N)</option><option value="earth">Proteção (PE)</option><option value="return">Retorno</option></select></Field>
          <Field label="Cor" wide><ColorPalette conductor={wire.conductorType} value={wire.color} onChange={color => onUpdateWire(wire.id, { color })} /></Field>
          <Field label="Bitola (mm²)"><select value={wire.gauge ?? ''} onChange={event => onUpdateWire(wire.id, { gauge: event.target.value ? Number(event.target.value) : null })}><option value="">A definir</option>{WIRE_GAUGES.map(gauge => <option key={gauge} value={gauge}>{gauge} mm²</option>)}</select></Field>
          <Field label="Terminal na origem"><select value={wire.sourceTermination ?? 'tubular'} onChange={event => onUpdateWire(wire.id, { sourceTermination: event.target.value as WireTermination })}>{TERMINATION_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
          <Field label="Terminal no destino"><select value={wire.targetTermination ?? 'tubular'} onChange={event => onUpdateWire(wire.id, { targetTermination: event.target.value as WireTermination })}>{TERMINATION_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
        </div>
        {(wire.sourceTermination ?? 'tubular') === 'tubular' || (wire.targetTermination ?? 'tubular') === 'tubular' ? <p className="ewq-field-note"><span className="ewq-ferrule-swatch" style={{ background: ferruleColor(wire.gauge).hex }} /><span>Colar do terminal tubular: {ferruleColor(wire.gauge).name}. A cor muda automaticamente conforme a bitola.</span></p> : null}
        <SelectedActions onDelete={onDelete} />
      </> : device?.type === 'spd' ? <>
        <h3 className="ewq-properties-title">DPS</h3><p className="ewq-panel-hint">Escolha um modelo pré-configurado. Os valores não são personalizáveis.</p>
        <div className="ewq-field-grid">
          <Field label="Modelo do DPS" wide><select value={device.model ?? DPS_MODELS[0].id} onChange={event => { const model = DPS_MODELS.find(item => item.id === event.target.value) ?? DPS_MODELS[0]; update({ model: model.id, voltage: model.voltage, surgeCurrent: model.surgeCurrent, description: model.description }); }}>{DPS_MODELS.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select></Field>
          <Field label="Tensão"><input value={`${device.voltage} V`} readOnly /></Field><Field label="Corrente de descarga"><input value={`${device.surgeCurrent} kA`} readOnly /></Field>
          {railPlacement}
        </div><SelectedActions onDelete={onDelete} onDuplicate={onDuplicate} />
      </> : isBus ? <>
        <h3 className="ewq-properties-title">{catalogItem?.name}</h3><p className="ewq-panel-hint">Vertical e compacto. A cor é fixa: {device.type === 'neutral-bus' ? 'azul para neutro' : 'verde para terra'}.</p>
        <div className="ewq-field-grid">
          <Field label="Quantidade de bornes" wide><select value={device.poles} onChange={event => update({ poles: Number(event.target.value) })}>{[4, 6, 8, 10, 12, 16, 20, 24].map(count => <option key={count} value={count}>{count} bornes</option>)}</select></Field>
          <Field label="Cor" wide><div className="ewq-fixed-color"><span style={{ background: device.color }} />{device.type === 'neutral-bus' ? 'Azul · neutro' : 'Verde · terra'}</div></Field>
          <Field label="Fixação" wide><select value={device.mount ?? 'rail'} onChange={event => update({ mount: event.target.value as Device['mount'] })}><option value="rail">Trilho DIN · ocupa 1 módulo</option><option value="edge">Borda do quadro</option></select></Field>
          {(device.mount ?? 'rail') === 'edge' ? edgePlacement : railPlacement}
        </div><SelectedActions onDelete={onDelete} onDuplicate={onDuplicate} />
      </> : isComb ? <>
        <h3 className="ewq-properties-title">Barramento pente</h3><p className="ewq-panel-hint">Fica sobre os bornes dos disjuntores e não aceita fios diretamente.</p>
        <div className="ewq-field-grid">
          <Field label="Tipo"><select value={device.poles} onChange={event => update({ poles: Number(event.target.value) })}><option value="1">Unipolar</option><option value="2">Bipolar</option><option value="4">Tetrapolar</option></select></Field>
          <Field label="Amperagem (A)"><Numeric value={device.amperage} options={[40, 63, 80, 100, 125]} list="ewq-comb-current" onChange={amperage => update({ amperage })} /></Field>
          <Field label="Número de encaixes" wide><select value={device.modules} onChange={event => update({ modules: Number(event.target.value) })}>{Array.from({ length: 23 }, (_, index) => index + 2).map(count => <option key={count} value={count}>{count} encaixes</option>)}</select></Field>
          {railPlacement}
        </div><SelectedActions onDelete={onDelete} onDuplicate={onDuplicate} />
      </> : isEdgeEntry ? <>
        <h3 className="ewq-properties-title">{catalogItem?.name}</h3><p className="ewq-panel-hint">Os fios podem começar ou terminar aqui para representar a passagem pela caixa.</p>
        <div className="ewq-field-grid">
          <Field label="Identificação" wide><input value={device.label} maxLength={80} onChange={event => update({ label: event.target.value })} /></Field>
          <Field label={device.type === 'power-entry' ? 'Quantidade de condutores' : 'Quantidade de fios'} wide><select value={device.poles} onChange={event => update({ poles: Number(event.target.value) })}>{Array.from({ length: 12 }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count}</option>)}</select></Field>
          {edgePlacement}
        </div><SelectedActions onDelete={onDelete} onDuplicate={onDuplicate} />
      </> : device ? <>
        <h3 className="ewq-properties-title">{catalogItem?.name ?? device.type}</h3><p className="ewq-panel-hint">{device.modules} {device.modules === 1 ? 'módulo DIN' : 'módulos DIN'} · trilho {device.rail + 1}</p>
        <div className="ewq-field-grid">
          <Field label="Identificação" wide help={isBreaker ? 'Ao digitar, o circuito é criado ou renomeado automaticamente.' : undefined}><input value={device.label} maxLength={80} list="ewq-device-labels" onChange={event => update({ label: event.target.value })} /><datalist id="ewq-device-labels"><option value="Tomadas cozinha" /><option value="Iluminação" /><option value="Chuveiro" /><option value="Ar-condicionado" /></datalist></Field>
          <Field label="Corrente nominal (A)"><Numeric value={device.amperage} options={CURRENTS} list="ewq-device-currents" onChange={amperage => update({ amperage })} /></Field>
          <Field label="Polos"><select value={device.poles} onChange={event => update({ poles: Number(event.target.value) })}>{[1, 2, 3, 4].map(poles => <option key={poles} value={poles}>{poles}P</option>)}</select></Field>
          {!isRcd && <Field label="Curva"><select value={device.curve} onChange={event => update({ curve: event.target.value as Device['curve'] })}><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></Field>}
          <Field label="Tensão nominal (V)"><Numeric value={device.voltage || null} options={VOLTAGES} list="ewq-device-voltages" min={1} onChange={voltage => update({ voltage: voltage ?? 0 })} /></Field>
          <Field label="Seção associada (mm²)"><Numeric value={device.gauge} options={WIRE_GAUGES} list="ewq-device-gauges" onChange={gauge => update({ gauge })} /></Field>
          {isRcd && <Field label="Sensibilidade IΔn (mA)"><Numeric value={device.sensitivity || null} options={[10, 30, 100, 300, 500]} list="ewq-device-sensitivity" min={1} onChange={sensitivity => update({ sensitivity: sensitivity ?? 0 })} /></Field>}
          {railPlacement}
          <Field label="Observações" wide><textarea rows={3} maxLength={600} value={device.description} onChange={event => update({ description: event.target.value })} /></Field>
        </div><SelectedActions onDelete={onDelete} onDuplicate={onDuplicate} />
      </> : <>
        <h3 className="ewq-properties-title">{project.name || 'Novo quadro'}</h3><p className="ewq-panel-hint">Selecione um componente ou fio para editar.</p>
        <div className="ewq-field-grid">
          <Field label="Nome do quadro" wide><input value={project.name} maxLength={100} onChange={event => onUpdateProject({ name: event.target.value })} /></Field>
          <Field label="Cliente / obra" wide><input value={project.client} maxLength={160} onChange={event => onUpdateProject({ client: event.target.value })} /></Field>
          <Field label="Alimentação" wide><select value={project.supply} onChange={event => onUpdateProject({ supply: event.target.value as Project['supply'] })}><option value="mono">Monofásica · 1 fase</option><option value="bi">Bifásica · 2 fases</option><option value="tri">Trifásica · 3 fases</option></select></Field>
          <Field label="Tensão de referência (V)" wide><Numeric value={project.voltage} options={[127, 220, 230, 254, 380, 400, 440]} list="ewq-project-voltage" min={1} onChange={voltage => voltage !== null && onUpdateProject({ voltage })} /></Field>
          <Field label="Trilhos"><select value={project.rails} onChange={event => onUpdateProject({ rails: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6, 8].map(rails => <option key={rails} value={rails}>{rails}</option>)}</select></Field>
          <Field label="Módulos por trilho"><select value={project.modulesPerRail} onChange={event => onUpdateProject({ modulesPerRail: Number(event.target.value) })}>{[8, 12, 16, 18, 24, 36, 48].map(modules => <option key={modules} value={modules}>{modules}</option>)}</select></Field>
          <Field label="Largura externa (mm)"><Numeric value={project.widthMm} min={100} max={3000} step={1} list="ewq-project-width" onChange={widthMm => widthMm !== null && onUpdateProject({ widthMm })} /></Field>
          <Field label="Altura externa (mm)"><Numeric value={project.heightMm} min={100} max={3000} step={1} list="ewq-project-height" onChange={heightMm => heightMm !== null && onUpdateProject({ heightMm })} /></Field>
        </div>
        {(() => { const used = project.devices.filter(isRailMounted).reduce((total, item) => total + item.modules, 0); return <div className="ewq-capacity-card"><span>Capacidade do quadro</span><strong>{project.rails * project.modulesPerRail} <small>módulos</small></strong><span>{used} ocupados · {Math.max(0, project.rails * project.modulesPerRail - used)} livres</span></div>; })()}
        <p className="ewq-field-note"><Info size={14} />Confirme as dimensões e folgas do modelo real do quadro.</p>
      </>}
    </div>
  </aside>;
}

export default PropertiesPanel;
