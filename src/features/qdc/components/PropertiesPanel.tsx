import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Cable, ChevronDown, Copy, Info, MousePointer2, Settings2, SlidersHorizontal, TriangleAlert, Trash2, X } from 'lucide-react';
import { CATALOG, DPS_MODELS } from '../electrical-components/catalog';
import { breakerTechnicalModel } from '../electrical-components/technicalCatalog';
import { combPhases } from '../electrical-components/combPhases';
import { deviceRect, isRailMounted } from '../wiring/routing';
import { ferruleColor, TERMINATION_OPTIONS, wireColorSwatch, WIRE_COLORS, WIRE_GAUGES } from '../wiring/options';
import type { Conductor, Device, DeviceVisualModel, EdgeSide, Project, Selection, Wire, WireTermination } from '../types';
import './panels.css';

export type PropertiesPanelProps = {
  project: Project; selection: Selection;
  onUpdateDevice(id: string, patch: Partial<Device>): void;
  onUpdateWire(id: string, patch: Partial<Wire>): void;
  onDelete(): void; onDuplicate(): void;
  onUpdateProject(patch: Partial<Project>): void;
  onClose?(): void;
};

const CURRENTS = [2, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
const VOLTAGES = [12, 24, 110, 127, 220, 230, 254, 380, 400, 440];
const SIDES: { value: EdgeSide; label: string }[] = [{ value: 'top', label: 'Borda superior' }, { value: 'bottom', label: 'Borda inferior' }, { value: 'left', label: 'Borda esquerda' }, { value: 'right', label: 'Borda direita' }];
const VISUAL_MODELS: { value: DeviceVisualModel; label: string; hint: string }[] = [
  { value: 'classic', label: 'Branco', hint: 'Modular clássico' },
  { value: 'graphite', label: 'Grafite', hint: 'Industrial robusto' },
  { value: 'two-tone', label: 'Bicolor', hint: 'Técnico moderno' },
];

function Field({ label, children, wide = false, help }: { label: string; children: ReactNode; wide?: boolean; help?: string }) {
  return <label className={`ewq-field${wide ? ' ewq-field-wide' : ''}`}><span>{label}</span>{children}{help && <small>{help}</small>}</label>;
}

function DraftInput({ value, onCommit, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'> & { value: string; onCommit(value: string): void }) {
  return <input key={value} defaultValue={value} {...props} onBlur={event => event.currentTarget.value !== value && onCommit(event.currentTarget.value)} onKeyDown={event => {
    if (event.key === 'Escape') { event.currentTarget.value = value; event.currentTarget.blur(); }
    else if (event.key === 'Enter') event.currentTarget.blur();
  }} />;
}

function DraftTextarea({ value, onCommit, ...props }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'defaultValue' | 'onChange'> & { value: string; onCommit(value: string): void }) {
  return <textarea key={value} defaultValue={value} {...props} onBlur={event => event.currentTarget.value !== value && onCommit(event.currentTarget.value)} onKeyDown={event => {
    if (event.key === 'Escape') { event.currentTarget.value = value; event.currentTarget.blur(); }
    else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) event.currentTarget.blur();
  }} />;
}

function Numeric({ value, onChange, options, min = 0, max, step = 'any', list }: { value: number | null; onChange(value: number | null): void; options?: readonly number[]; min?: number; max?: number; step?: number | string; list: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  function commit(input: HTMLInputElement) {
    const next = input.value === '' ? null : Number(input.value);
    const valid = next === null || (Number.isFinite(next) && next >= min && (max === undefined || next <= max));
    if (valid && next !== value) onChange(next);
    setDraft(null);
  }
  return <><input type="number" inputMode="decimal" min={min} max={max} step={step} value={draft ?? value ?? ''} placeholder="Não definido" list={options ? list : undefined} onFocus={() => setDraft(value === null ? '' : String(value))} onBlur={event => commit(event.currentTarget)} onChange={event => setDraft(event.target.value)} onKeyDown={event => {
    if (event.key === 'Escape') { event.currentTarget.value = value === null ? '' : String(value); event.currentTarget.blur(); }
    else if (event.key === 'Enter') event.currentTarget.blur();
  }} />{options && <datalist id={list}>{options.map(option => <option key={option} value={option} />)}</datalist>}</>;
}

function SelectedActions({ onDuplicate, onDelete, plural = false }: { onDuplicate?: () => void; onDelete(): void; plural?: boolean }) {
  return <div className="ewq-selection-actions">{onDuplicate && <button type="button" onClick={onDuplicate}><Copy size={14} />Duplicar</button>}<button type="button" className="ewq-danger-button" onClick={onDelete}><Trash2 size={14} />Excluir{plural ? ' seleção' : ''}</button></div>;
}

function AdvancedSection({ children, summary = 'Posição, aparência e detalhes técnicos', expanded = false }: { children: ReactNode; summary?: string; expanded?: boolean }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (expanded && detailsRef.current) detailsRef.current.open = true; }, [expanded]);
  return <details ref={detailsRef} className="ewq-advanced-settings">
    <summary><span><SlidersHorizontal size={15} aria-hidden="true" /><span><strong>Mais configurações</strong><small>{summary}</small></span></span><ChevronDown size={16} aria-hidden="true" /></summary>
    <div className="ewq-field-grid">{children}</div>
  </details>;
}

function VisualModelPicker({ value, onChange }: { value: DeviceVisualModel; onChange(value: DeviceVisualModel): void }) {
  return <div className="ewq-visual-model-field">
    <span>Acabamento de todos os componentes</span>
    <div className="ewq-visual-models" role="radiogroup" aria-label="Acabamento visual do projeto">
      {VISUAL_MODELS.map(model => <button key={model.value} type="button" role="radio" aria-checked={value === model.value} className={value === model.value ? 'is-active' : ''} onClick={() => onChange(model.value)}>
        <span className={`ewq-device-skin ewq-device-skin--${model.value}`} aria-hidden="true"><i /><b /><em /></span>
        <span><strong>{model.label}</strong><small>{model.hint}</small></span>
      </button>)}
    </div>
    <small>Aplicado ao projeto inteiro. Não altera corrente, polos, terminais ou ligações.</small>
  </div>;
}

function ColorPalette({ conductor, value, onChange }: { conductor: Conductor; value: string; onChange(value: string): void }) {
  return <div className="ewq-color-palette" role="radiogroup" aria-label="Cor do fio">{WIRE_COLORS[conductor].map(color => <button key={color.value} type="button" role="radio" aria-checked={value === color.value} className={value === color.value ? 'is-active' : ''} onClick={() => onChange(color.value)} title={color.label}><span style={{ background: wireColorSwatch(color.value) }} />{color.label}</button>)}</div>;
}

export function WireDetails({ project, wire, onUpdateWire, onDelete, expanded = false }: { project: Project; wire: Wire; onUpdateWire(id: string, patch: Partial<Wire>): void; onDelete?(): void; expanded?: boolean }) {
  return <>
    <h3 className="ewq-properties-title"><Cable size={17} aria-hidden="true" />{wire.label || 'Ligação elétrica'}</h3>
    <div className="ewq-wire-endpoints">{[wire.sourceComponent, wire.targetComponent].map((id, index) => { const component = project.devices.find(item => item.id === id); const terminal = component?.terminals.find(item => item.id === (index ? wire.targetTerminal : wire.sourceTerminal)); return <div key={`${id}-${index}`}><small>{index ? 'Destino' : 'Origem'}</small><strong>{component?.label ?? 'Componente removido'}</strong><span>{terminal?.label ?? 'Borne removido'}</span></div>; })}</div>
    <div className="ewq-field-grid">
      <Field label="Identificação" wide><DraftInput value={wire.label} maxLength={80} placeholder="Ex.: alimentação do disjuntor" onCommit={label => onUpdateWire(wire.id, { label })} /></Field>
      <Field label="Tipo de condutor" wide><select value={wire.conductorType} onChange={event => { const conductorType = event.target.value as Conductor; onUpdateWire(wire.id, { conductorType, color: WIRE_COLORS[conductorType][0].value }); }}><option value="phase">Fase</option><option value="neutral">Neutro (N)</option><option value="earth">Proteção (PE)</option><option value="return">Retorno</option></select></Field>
      <Field label="Bitola (mm²)"><select value={wire.gauge ?? ''} onChange={event => onUpdateWire(wire.id, { gauge: event.target.value ? Number(event.target.value) : null })}><option value="">A definir</option>{WIRE_GAUGES.map(gauge => <option key={gauge} value={gauge}>{gauge} mm²</option>)}</select></Field>
    </div>
    <AdvancedSection summary="Cor, terminais e comportamento do traçado" expanded={expanded}>
      <Field label="Cor" wide><ColorPalette conductor={wire.conductorType} value={wire.color} onChange={color => onUpdateWire(wire.id, { color })} /></Field>
      <Field label="Terminal na origem"><select value={wire.sourceTermination ?? 'tubular'} onChange={event => onUpdateWire(wire.id, { sourceTermination: event.target.value as WireTermination })}>{TERMINATION_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
      <Field label="Terminal no destino"><select value={wire.targetTermination ?? 'tubular'} onChange={event => onUpdateWire(wire.id, { targetTermination: event.target.value as WireTermination })}>{TERMINATION_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
      <div className="ewq-field ewq-field-wide"><span>Traçado do fio</span><div className="ewq-wire-route-actions"><span>{wire.manualPath ? 'Preservado · o roteamento automático não altera este caminho' : 'Automático · procura um caminho curto, livre e com menos cruzamentos'}</span><label className="ewq-wire-route-lock"><input type="checkbox" checked={!!wire.manualPath} onChange={event => onUpdateWire(wire.id, event.target.checked ? { manualPath: true, path: wire.path } : { manualPath: false, path: [] })} /><span>Preservar este traçado</span></label><button type="button" disabled={!wire.manualPath} onClick={() => onUpdateWire(wire.id, { manualPath: false, path: [] })}>Liberar e recalcular</button></div></div>
    </AdvancedSection>
    {(wire.sourceTermination ?? 'tubular') === 'tubular' || (wire.targetTermination ?? 'tubular') === 'tubular' ? <p className="ewq-field-note"><span className="ewq-ferrule-swatch" style={{ background: ferruleColor(wire.gauge).hex }} /><span>Colar do terminal tubular: {ferruleColor(wire.gauge).name}. A cor muda automaticamente conforme a bitola.</span></p> : null}
    {onDelete && <SelectedActions onDelete={onDelete} />}
  </>;
}

export function PropertiesPanel({ project, selection, onUpdateDevice, onUpdateWire, onDelete, onDuplicate, onUpdateProject, onClose }: PropertiesPanelProps) {
  const device = selection.devices.length === 1 ? project.devices.find(item => item.id === selection.devices[0]) : undefined;
  const mcbModel = device ? breakerTechnicalModel(device.type) : undefined;
  const wire = selection.wire ? project.wires.find(item => item.id === selection.wire) : undefined;
  const multiple = selection.devices.length > 1;
  const catalogItem = device ? CATALOG.find(item => item.type === device.type) : undefined;
  const update = (patch: Partial<Device>) => device && onUpdateDevice(device.id, patch);
  const isBreaker = !!device && (device.type.startsWith('breaker-') || device.type.startsWith('rcbo-') || device.type.startsWith('motor-breaker-'));
  const isRcd = !!device && (device.type.startsWith('rcd-') || device.type.startsWith('rcbo-'));
  const isBus = !!device && (device.type === 'neutral-bus' || device.type === 'earth-bus');
  const isComb = device?.type === 'comb-bus';
  const isEdgeEntry = device?.type === 'power-entry' || device?.type === 'conduit-entry';
  const isPlanePositioned = !!device && ['power-entry', 'conduit-entry'].includes(device.type) && !!device.canvasPosition;
  const connectedWireCount = device ? project.wires.filter(item => item.sourceComponent === device.id || item.targetComponent === device.id).length : 0;
  const linkedCircuit = device ? project.circuits.find(item => item.breakerId === device.id) : undefined;
  const pendingDeviceFields = device && isBreaker ? [device.amperage === null ? 'corrente nominal' : '', device.gauge === null ? 'seção associada' : ''].filter(Boolean) : [];
  const deviceSummary = device && <div className="ewq-property-summary" aria-label="Resumo do componente">
    <span>{device.modules} {device.modules === 1 ? 'módulo' : 'módulos'}</span>
    <span>{isPlanePositioned ? 'Posição livre' : (device.mount ?? 'rail') === 'edge' || isEdgeEntry && !isPlanePositioned ? 'Na borda' : `Trilho ${device.rail + 1}`}</span>
    <span>{connectedWireCount} {connectedWireCount === 1 ? 'ligação' : 'ligações'}</span>
    {linkedCircuit && <span>C{linkedCircuit.number} · {linkedCircuit.name}</span>}
  </div>;
  const pendingNotice = pendingDeviceFields.length > 0 && <p className="ewq-property-alert"><TriangleAlert size={15} aria-hidden="true" /><span>Complete {pendingDeviceFields.join(' e ')} para deixar o componente pronto para conferência.</span></p>;
  const heading = multiple ? 'Seleção múltipla' : wire ? 'Condutor' : device ? 'Componente' : 'Configuração do quadro';
  const railPlacement = device && <><Field label="Trilho"><select value={device.rail} onChange={event => update({ rail: Number(event.target.value) })}>{Array.from({ length: project.rails }, (_, index) => <option key={index} value={index}>Trilho {index + 1}</option>)}</select></Field><Field label="Módulo inicial"><select value={device.slot} onChange={event => update({ slot: Number(event.target.value) })}>{Array.from({ length: Math.max(1, project.modulesPerRail - device.modules + 1) }, (_, index) => <option key={index} value={index}>{index + 1}</option>)}</select></Field></>;
  const edgePlacement = device && <><Field label="Borda"><select value={device.edgeSide ?? 'top'} onChange={event => update({ edgeSide: event.target.value as EdgeSide })}>{SIDES.map(side => <option key={side.value} value={side.value}>{side.label}</option>)}</select></Field><Field label="Posição na borda (%)"><Numeric value={device.edgeOffset ?? 50} min={0} max={100} step={1} list="ewq-edge-offset" onChange={edgeOffset => update({ edgeOffset: edgeOffset ?? 50 })} /></Field></>;
  const edgeEntryPlacement = device && ['power-entry', 'conduit-entry'].includes(device.type) ? <><Field label="Posicionamento" wide><select value={isPlanePositioned ? 'plane' : 'edge'} onChange={event => update({ canvasPosition: event.target.value === 'plane' ? device.canvasPosition ?? (() => { const rect = deviceRect(device, project); return { x: rect.x, y: rect.y }; })() : undefined })}><option value="plane">Livre no plano</option><option value="edge">Borda do quadro</option></select></Field>{!isPlanePositioned && edgePlacement}</> : edgePlacement;
  return <aside className="ewq-panel ewq-properties" aria-label="Propriedades do quadro e da seleção">
    <header className="ewq-panel-heading"><div><Settings2 size={17} aria-hidden="true" /><h2>Propriedades</h2></div>{onClose && <button className="ewq-icon ewq-panel-close" type="button" aria-label="Fechar propriedades" onClick={onClose}><X size={16} aria-hidden="true" /></button>}</header>
    <div className="ewq-properties-body"><p className="ewq-eyebrow">{heading}</p>
      {multiple ? <>
        <h3 className="ewq-properties-title">{selection.devices.length} componentes</h3>
        <p className="ewq-panel-hint">Mova a seleção pelo quadro ou escolha um componente para editar.</p>
        <SelectedActions onDelete={onDelete} onDuplicate={onDuplicate} plural />
      </> : wire ? <WireDetails project={project} wire={wire} onUpdateWire={onUpdateWire} onDelete={onDelete} /> : device && mcbModel ? <>
        <h3 className="ewq-properties-title">Disjuntor DIN · {device.poles}P</h3>{deviceSummary}{pendingNotice}
        <p className="ewq-panel-hint">Modelo vetorial com {device.poles * 2} bornes conectáveis. Valores de seleção ilustrativos; confira a ficha técnica do produto real.</p>
        <div className="ewq-field-grid">
          <Field label="Marca"><input value={mcbModel.brand} readOnly /></Field>
          <Field label="Modelo"><input value={mcbModel.model} readOnly /></Field>
          <Field label="Polos" help={connectedWireCount ? 'Ao reduzir polos, as ligações dos bornes removidos serão excluídas.' : undefined}><select value={device.poles} onChange={event => update({ poles: Number(event.target.value) })}>{[1, 2, 3].map(poles => <option key={poles} value={poles}>{poles}P · {poles * 2} bornes</option>)}</select></Field>
          <Field label="Corrente nominal (A)"><select value={device.amperage ?? ''} onChange={event => update({ amperage: event.target.value ? Number(event.target.value) : null })}><option value="">A definir</option>{device.amperage != null && !mcbModel.availableCurrents.includes(device.amperage) && <option value={device.amperage}>{device.amperage} A · fora do preset</option>}{mcbModel.availableCurrents.map(value => <option key={value} value={value}>{value} A</option>)}</select></Field>
          <Field label="Curva de disparo"><select value={device.curve} onChange={event => update({ curve: event.target.value as Device['curve'] })}>{mcbModel.availableCurves.map(value => <option key={value} value={value}>{value}</option>)}</select></Field>
          <Field label="Capacidade de interrupção"><select value={device.breakingCapacityKa ?? ''} onChange={event => update({ breakingCapacityKa: event.target.value ? Number(event.target.value) : null })}><option value="">A definir</option>{device.breakingCapacityKa != null && !mcbModel.availableBreakingCapacitiesKa.includes(device.breakingCapacityKa) && <option value={device.breakingCapacityKa}>{device.breakingCapacityKa} kA · fora do preset</option>}{mcbModel.availableBreakingCapacitiesKa.map(value => <option key={value} value={value}>{value} kA</option>)}</select></Field>
          <Field label="Tensão nominal (V)"><select value={device.voltage || ''} onChange={event => update({ voltage: event.target.value ? Number(event.target.value) : 0 })}><option value="">A definir</option>{device.voltage > 0 && !mcbModel.availableVoltages.includes(device.voltage) && <option value={device.voltage}>{device.voltage} V · fora do preset</option>}{mcbModel.availableVoltages.map(value => <option key={value} value={value}>{value} V</option>)}</select></Field>
          <Field label="Tag"><input value={device.tag ?? ''} maxLength={32} placeholder="Ex.: QF01" onChange={event => update({ tag: event.target.value })} /></Field>
          <Field label="Nome do circuito" wide><input value={device.label} maxLength={80} onChange={event => update({ label: event.target.value })} /></Field>
        </div>
        <AdvancedSection summary="Seção, posição e observações">
          <Field label="Seção associada (mm²)"><Numeric value={device.gauge} options={WIRE_GAUGES} list="ewq-device-gauges" onChange={gauge => update({ gauge })} /></Field>
          {railPlacement}
          <Field label="Observações" wide><DraftTextarea rows={3} maxLength={600} value={device.description} onCommit={description => update({ description })} /></Field>
        </AdvancedSection><SelectedActions onDelete={onDelete} onDuplicate={onDuplicate} />
      </> : device?.type === 'spd' ? <>
        <h3 className="ewq-properties-title">DPS</h3>{deviceSummary}<p className="ewq-panel-hint">Escolha um modelo pré-configurado. Os valores técnicos permanecem protegidos contra alterações acidentais.</p>
        <div className="ewq-field-grid">
          <Field label="Condutor protegido" wide><select value={device.spdInput ?? 'phase'} onChange={event => update({ spdInput: event.target.value as Device['spdInput'] })}><option value="phase">Fase · borne superior L</option><option value="neutral">Neutro · borne superior N</option></select></Field>
          <Field label="Modelo do DPS" wide><select value={device.model ?? DPS_MODELS[0].id} onChange={event => { const model = DPS_MODELS.find(item => item.id === event.target.value) ?? DPS_MODELS[0]; update({ model: model.id, voltage: model.voltage, surgeCurrent: model.surgeCurrent, description: model.description }); }}>{DPS_MODELS.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select></Field>
        </div>
        <AdvancedSection summary="Valores do modelo e posição no trilho">
          <Field label="Tensão"><input value={`${device.voltage} V`} readOnly /></Field><Field label="Corrente de descarga"><input value={`${device.surgeCurrent} kA`} readOnly /></Field>
          {railPlacement}
        </AdvancedSection><SelectedActions onDelete={onDelete} onDuplicate={onDuplicate} />
      </> : isBus ? <>
        <h3 className="ewq-properties-title">{catalogItem?.name}</h3>{deviceSummary}<p className="ewq-panel-hint">Ajuste primeiro a quantidade de bornes e a orientação.</p>
        <div className="ewq-field-grid">
          <Field label="Quantidade de bornes" wide><select value={device.poles} onChange={event => update({ poles: Number(event.target.value) })}>{[4, 6, 8, 10, 12, 16, 20, 24].map(count => <option key={count} value={count}>{count} bornes</option>)}</select></Field>
          <Field label="Orientação" wide><select value={device.orientation ?? 'vertical'} onChange={event => { const orientation = event.target.value as Device['orientation']; update({ orientation, busTerminalSide: orientation === 'horizontal' ? 'bottom' : 'right' }); }}><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option></select></Field>
        </div>
        <AdvancedSection summary="Cor, fixação, bornes e posição">
          <Field label="Cor" wide><div className="ewq-fixed-color"><span style={{ background: device.color }} />{device.type === 'neutral-bus' ? 'Azul · neutro' : 'Verde · terra'}</div></Field>
          <Field label="Fixação" wide><select value={device.mount ?? 'rail'} onChange={event => update({ mount: event.target.value as Device['mount'] })}><option value="rail">Trilho DIN · ocupa 1 módulo</option><option value="edge">Borda do quadro</option></select></Field>
          <Field label="Lado dos bornes" wide><select value={device.busTerminalSide ?? (device.orientation === 'horizontal' ? 'bottom' : 'right')} onChange={event => update({ busTerminalSide: event.target.value as Device['busTerminalSide'] })}>{device.orientation === 'horizontal' ? <><option value="top">Para cima</option><option value="bottom">Para baixo</option></> : <><option value="left">Para a esquerda</option><option value="right">Para a direita</option></>}</select></Field>
          {(device.mount ?? 'rail') === 'edge' ? edgePlacement : railPlacement}
        </AdvancedSection><SelectedActions onDelete={onDelete} onDuplicate={onDuplicate} />
      </> : isComb ? <>
        <h3 className="ewq-properties-title">Barramento pente</h3>{deviceSummary}<p className="ewq-panel-hint">Os dentes repetem {combPhases(device).join(' · ')} ao longo dos bornes. Confira a alimentação de cada fase e a compatibilidade física do pente com os dispositivos.</p>
        <div className="ewq-field-grid">
          <Field label="Tipo"><select value={device.poles} onChange={event => update({ poles: Number(event.target.value), combPhaseStart: 0 })}><option value="1">Monofásico · R</option>{(project.supply !== 'mono' || device.poles === 2) && <option value="2">Bifásico · R/S{project.supply === 'mono' ? ' · revisar' : ''}</option>}{(project.supply === 'tri' || device.poles === 3) && <option value="3">Trifásico · R/S/T{project.supply !== 'tri' ? ' · revisar' : ''}</option>}{device.poles === 4 && <option value="4">Tetrapolar · legado</option>}</select></Field>
          <Field label="Amperagem (A)"><Numeric value={device.amperage} options={[40, 63, 80, 100, 125]} list="ewq-comb-current" onChange={amperage => update({ amperage })} /></Field>
          {device.poles < 3 && project.supply !== 'mono' && <Field label="Primeira fase"><select value={device.combPhaseStart ?? 0} onChange={event => update({ combPhaseStart: Number(event.target.value) as Device['combPhaseStart'] })}>{(device.poles === 1 ? ['R', 'S', ...(project.supply === 'tri' ? ['T'] : [])] : project.supply === 'tri' ? ['R/S', 'S/T', 'T/R'] : ['R/S']).map((label, index) => <option key={label} value={index}>{label}</option>)}</select></Field>}
          <Field label="Número de encaixes" wide><select value={device.modules} onChange={event => update({ modules: Number(event.target.value) })}>{Array.from({ length: 23 }, (_, index) => index + 2).map(count => <option key={count} value={count}>{count} encaixes</option>)}</select></Field>
        </div>
        <AdvancedSection summary="Encaixe nos bornes e posição no trilho">
          <Field label="Encaixe nos bornes" wide><select value={device.combSide ?? 'bottom'} onChange={event => update({ combSide: event.target.value as Device['combSide'] })}><option value="bottom">Bornes inferiores · por baixo</option><option value="top">Bornes superiores · por cima</option></select></Field>
          {railPlacement}
        </AdvancedSection><SelectedActions onDelete={onDelete} onDuplicate={onDuplicate} />
      </> : isEdgeEntry ? <>
        <h3 className="ewq-properties-title">{catalogItem?.name}</h3>{deviceSummary}<p className="ewq-panel-hint">Os fios podem começar ou terminar aqui para representar a passagem pela caixa.</p>
        <div className="ewq-field-grid">
          <Field label="Identificação" wide><DraftInput value={device.label} maxLength={80} onCommit={label => update({ label })} /></Field>
          {device.type === 'power-entry' ? <Field label="Tipo de alimentação" wide><select value={project.supply} onChange={event => onUpdateProject({ supply: event.target.value as Project['supply'] })}><option value="mono">Monofásica · R + N + PE</option><option value="bi">Bifásica · R + S + N + PE</option><option value="tri">Trifásica · R + S + T + N + PE</option></select><small>Atualiza os bornes das entradas do projeto. Revise disjuntor geral, DR, DPS e circuitos após a mudança.</small></Field> : device.terminals.some(term => term.id.startsWith('circuit-') || /^c\d+-(?:l|n|pe)$/.test(term.id)) ? <Field label="Fios dos circuitos" wide><input readOnly value={`${device.poles} fios · definidos pelos circuitos`} /></Field> : <Field label="Quantidade de fios" wide><select value={device.poles} onChange={event => update({ poles: Number(event.target.value) })}>{Array.from({ length: 12 }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count}</option>)}</select></Field>}
          <Field label="Orientação visual" wide><select value={device.visualRotation ?? 0} onChange={event => update({ visualRotation: Number(event.target.value) as 0 | 180 })}><option value={0}>Normal · 0°</option><option value={180}>De cabeça para baixo · 180°</option></select></Field>
        </div>
        <AdvancedSection summary="Posicionamento dentro ou na borda do quadro">{edgeEntryPlacement}</AdvancedSection>
        <SelectedActions onDelete={onDelete} onDuplicate={onDuplicate} />
      </> : device ? <>
        <h3 className="ewq-properties-title">{catalogItem?.name ?? device.type}</h3>{deviceSummary}{pendingNotice}
        <div className="ewq-field-grid">
          <Field label="Identificação" wide help={isBreaker ? 'Ao confirmar, o circuito é criado ou renomeado automaticamente.' : undefined}><DraftInput value={device.label} maxLength={80} list="ewq-device-labels" onCommit={label => update({ label })} /><datalist id="ewq-device-labels"><option value="Tomadas cozinha" /><option value="Iluminação" /><option value="Chuveiro" /><option value="Ar-condicionado" /></datalist></Field>
          <Field label="Corrente nominal (A)"><Numeric value={device.amperage} options={CURRENTS} list="ewq-device-currents" onChange={amperage => update({ amperage })} /></Field>
          <Field label="Polos"><select value={device.poles} onChange={event => update({ poles: Number(event.target.value) })}>{[1, 2, 3, 4].map(poles => <option key={poles} value={poles}>{poles}P</option>)}</select></Field>
          {isRcd && <Field label="Sensibilidade IΔn (mA)" wide><Numeric value={device.sensitivity || null} options={[10, 30, 100, 300, 500]} list="ewq-device-sensitivity" min={1} onChange={sensitivity => update({ sensitivity: sensitivity ?? 0 })} /></Field>}
        </div>
        <AdvancedSection summary="Curva, tensão, seção, posição e observações">
          {!isRcd && <Field label="Curva"><select value={device.curve} onChange={event => update({ curve: event.target.value as Device['curve'] })}><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></Field>}
          <Field label="Tensão nominal (V)"><Numeric value={device.voltage || null} options={VOLTAGES} list="ewq-device-voltages" min={1} onChange={voltage => update({ voltage: voltage ?? 0 })} /></Field>
          <Field label="Seção associada (mm²)"><Numeric value={device.gauge} options={WIRE_GAUGES} list="ewq-device-gauges" onChange={gauge => update({ gauge })} /></Field>
          {railPlacement}
          <Field label="Observações" wide><DraftTextarea rows={3} maxLength={600} value={device.description} onCommit={description => update({ description })} /></Field>
        </AdvancedSection><SelectedActions onDelete={onDelete} onDuplicate={onDuplicate} />
      </> : <>
        <div className="ewq-board-overview">
          <svg viewBox={`0 0 200 ${45 + project.rails * 22}`} aria-hidden="true"><rect x="1" y="1" width="198" height={43 + project.rails * 22} rx="8" fill="#f5f7f9" stroke="#c8d3dd" /><path d="M12 13h26" stroke="#93a6b6" strokeWidth="3" />{Array.from({ length: project.rails }, (_, rail) => <g key={rail}><rect x="14" y={25 + rail * 22} width="172" height="12" rx="2" fill="#dce4ea" />{project.devices.filter(device => isRailMounted(device) && device.rail === rail).map(device => <rect key={device.id} x={14 + device.slot * 172 / project.modulesPerRail} y={22 + rail * 22} width={Math.max(2, device.modules * 172 / project.modulesPerRail - 2)} height="18" rx="2" fill="#547386" />)}</g>)}</svg>
          <div><strong>{project.rails * project.modulesPerRail} módulos</strong><span>{project.rails} trilhos DIN</span><span>{project.widthMm} × {project.heightMm} mm</span></div>
        </div>
        <h3 className="ewq-properties-title">{project.name || 'Novo quadro'}</h3>
        <p className="ewq-selection-prompt"><MousePointer2 size={18} aria-hidden="true" /><span>Clique em um componente ou fio no quadro para ver suas propriedades.</span></p>
        <details className="ewq-project-settings ewq-appearance-settings" open><summary>Aparência do projeto <ChevronDown size={16} aria-hidden="true" /></summary>
          <VisualModelPicker value={project.visualModel ?? 'classic'} onChange={visualModel => onUpdateProject({ visualModel })} />
          <div className="ewq-dps-visual-field"><span>Acabamento dos DPS</span><div className="ewq-dps-visuals" role="radiogroup" aria-label="Acabamento visual dos DPS">
            <button type="button" role="radio" aria-checked={project.dpsVisual === 'standard'} className={project.dpsVisual === 'standard' ? 'is-active' : ''} onClick={() => onUpdateProject({ dpsVisual: 'standard' })}><i className="is-standard" aria-hidden="true" /><span><strong>Padrão</strong><small>Frente clara</small></span></button>
            <button type="button" role="radio" aria-checked={project.dpsVisual === 'red'} className={project.dpsVisual === 'red' ? 'is-active' : ''} onClick={() => onUpdateProject({ dpsVisual: 'red' })}><i className="is-red" aria-hidden="true" /><span><strong>Vermelho</strong><small>Frente destacada</small></span></button>
          </div><small>Aplica a escolha a todos os DPS deste projeto.</small></div>
        </details>
        {(() => { const used = project.devices.filter(isRailMounted).reduce((total, item) => total + item.modules, 0); const total = project.rails * project.modulesPerRail; return <div className="ewq-capacity-card"><span>Ocupação dos trilhos<strong>{Math.round(used / total * 100)}%</strong></span><progress value={used} max={total} aria-label="Módulos ocupados" /><span>{used} ocupados <span>{Math.max(0, total - used)} disponíveis</span></span></div>; })()}
        <details className="ewq-project-settings" open><summary>Dados e dimensões <ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="ewq-field-grid">
          <Field label="Nome do quadro" wide><DraftInput value={project.name} maxLength={100} onCommit={name => onUpdateProject({ name })} /></Field>
          <Field label="Cliente / obra" wide><DraftInput value={project.client} maxLength={160} onCommit={client => onUpdateProject({ client })} /></Field>
          <Field label="Alimentação" wide><select value={project.supply} onChange={event => onUpdateProject({ supply: event.target.value as Project['supply'] })}><option value="mono">Monofásica · 1 fase</option><option value="bi">Bifásica · 2 fases</option><option value="tri">Trifásica · 3 fases</option></select></Field>
          <Field label="Tensão de referência (V)" wide><Numeric value={project.voltage} options={[127, 220, 230, 254, 380, 400, 440]} list="ewq-project-voltage" min={1} onChange={voltage => voltage !== null && onUpdateProject({ voltage })} /></Field>
          <Field label="Trilhos"><select value={project.rails} onChange={event => onUpdateProject({ rails: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6, 8].map(rails => <option key={rails} value={rails}>{rails}</option>)}</select></Field>
          <Field label="Módulos por trilho"><select value={project.modulesPerRail} onChange={event => onUpdateProject({ modulesPerRail: Number(event.target.value) })}>{[8, 12, 16, 18, 24, 36, 48].map(modules => <option key={modules} value={modules}>{modules}</option>)}</select></Field>
          <Field label="Largura externa (mm)"><Numeric value={project.widthMm} min={100} max={3000} step={1} list="ewq-project-width" onChange={widthMm => widthMm !== null && onUpdateProject({ widthMm })} /></Field>
          <Field label="Altura externa (mm)"><Numeric value={project.heightMm} min={100} max={3000} step={1} list="ewq-project-height" onChange={heightMm => heightMm !== null && onUpdateProject({ heightMm })} /></Field>
        </div>
        </details>
        <p className="ewq-field-note"><Info size={14} />Confirme as dimensões e folgas do modelo real do quadro.</p>
      </>}
    </div>
  </aside>;
}

export default PropertiesPanel;
