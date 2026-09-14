import { useState, type ReactNode } from 'react';
import { Cable, Copy, Info, Settings2, Trash2 } from 'lucide-react';
import { CATALOG } from '../electrical-components/catalog';
import type { Conductor, Device, Project, Selection, Wire } from '../types';
import './panels.css';

export type PropertiesPanelProps = {
  project: Project; selection: Selection;
  onUpdateDevice(id: string, patch: Partial<Device>): void;
  onUpdateWire(id: string, patch: Partial<Wire>): void;
  onDelete(): void; onDuplicate(): void;
  onUpdateProject(patch: Partial<Project>): void;
};

const GAUGES = [.5, .75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
const CURRENTS = [2, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
const VOLTAGES = [12, 24, 110, 127, 220, 230, 254, 380, 400, 440];
const COLORS: Record<Conductor, { value: string; label: string }[]> = {
  phase: [{ value: '#252d36', label: 'Preto' }, { value: '#8b5a32', label: 'Marrom' }, { value: '#777e87', label: 'Cinza' }, { value: '#dc4037', label: 'Vermelho' }],
  neutral: [{ value: '#38a8e8', label: 'Azul-claro' }],
  earth: [{ value: '#24a15c', label: 'Verde / verde-amarelo' }],
  return: [{ value: '#dc4037', label: 'Vermelho' }, { value: '#e98a28', label: 'Laranja' }, { value: '#925bc9', label: 'Violeta' }, { value: '#8b5a32', label: 'Marrom' }],
};

function Field({ label, children, wide = false, help }: { label: string; children: ReactNode; wide?: boolean; help?: string }) {
  return <label className={`ewq-field${wide ? ' ewq-field-wide' : ''}`}><span>{label}</span>{children}{help && <small>{help}</small>}</label>;
}

function Numeric({ value, onChange, options, min = 0, max, step = 'any', list }: { value: number | null; onChange(value: number | null): void; options?: number[]; min?: number; max?: number; step?: number | string; list: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return <><input type="number" inputMode="decimal" min={min} max={max} step={step} value={draft ?? value ?? ''} placeholder="Não definido" list={options ? list : undefined} onFocus={() => setDraft(value === null ? '' : String(value))} onBlur={() => setDraft(null)} onChange={event => { setDraft(event.target.value); const next = event.target.value === '' ? null : Number(event.target.value); if (next === null || (Number.isFinite(next) && next >= min && (max === undefined || next <= max))) onChange(next); }} />{options && <datalist id={list}>{options.map(option => <option key={option} value={option} />)}</datalist>}</>;
}

function SelectedActions({ onDuplicate, onDelete, plural = false }: { onDuplicate?: () => void; onDelete(): void; plural?: boolean }) {
  return <div className="ewq-selection-actions">{onDuplicate && <button type="button" onClick={onDuplicate}><Copy size={14} aria-hidden="true" />Duplicar</button>}<button type="button" className="ewq-danger-button" onClick={onDelete}><Trash2 size={14} aria-hidden="true" />Excluir{plural ? ' seleção' : ''}</button></div>;
}

export function PropertiesPanel({ project, selection, onUpdateDevice, onUpdateWire, onDelete, onDuplicate, onUpdateProject }: PropertiesPanelProps) {
  const device = selection.devices.length === 1 ? project.devices.find(item => item.id === selection.devices[0]) : undefined;
  const wire = selection.wire ? project.wires.find(item => item.id === selection.wire) : undefined;
  const multiple = selection.devices.length > 1;
  const catalogItem = device ? CATALOG.find(item => item.type === device.type) : undefined;
  const descriptor = `${device?.type ?? ''} ${catalogItem?.name ?? ''}`.toLowerCase();
  const isSurge = /dps|surge/.test(descriptor);
  const isRcd = /\bdr\b|idr|rcd|rcbo/.test(descriptor);
  const update = (patch: Partial<Device>) => device && onUpdateDevice(device.id, patch);
  const wireColors = wire ? COLORS[wire.conductorType] : [];
  const heading = multiple ? 'Seleção múltipla' : wire ? 'Condutor' : device ? 'Componente' : 'Configuração do quadro';
  return <aside className="ewq-panel ewq-properties" aria-label="Propriedades do quadro e da seleção">
    <header className="ewq-panel-heading"><div><Settings2 size={17} aria-hidden="true" /><h2>Propriedades</h2></div></header>
    <div className="ewq-properties-body"><p className="ewq-eyebrow">{heading}</p>
      {multiple ? <>
        <h3 className="ewq-properties-title">{selection.devices.length} componentes</h3>
        <p className="ewq-panel-hint">Mova a seleção pelo quadro. Selecione um componente para editar suas características.</p>
        <ul className="ewq-selection-list">{project.devices.filter(item => selection.devices.includes(item.id)).map(item => <li key={item.id}><span>{item.label}</span><small>Trilho {item.rail + 1}</small></li>)}</ul>
        <SelectedActions onDelete={onDelete} onDuplicate={onDuplicate} plural />
      </> : wire ? <>
        <h3 className="ewq-properties-title"><Cable size={17} aria-hidden="true" />{wire.label || 'Ligação elétrica'}</h3>
        <div className="ewq-wire-endpoints">{[wire.sourceComponent, wire.targetComponent].map((id, index) => { const component = project.devices.find(item => item.id === id); const terminalId = index ? wire.targetTerminal : wire.sourceTerminal; return <div key={`${id}-${index}`}><small>{index ? 'Destino' : 'Origem'}</small><strong>{component?.label ?? 'Componente removido'}</strong><span>{component?.terminals.find(item => item.id === terminalId)?.label ?? terminalId}</span></div>; })}</div>
        <div className="ewq-field-grid">
          <Field label="Identificação" wide><input value={wire.label} maxLength={80} placeholder="Ex.: alimentação do DR" onChange={event => onUpdateWire(wire.id, { label: event.target.value })} /></Field>
          <Field label="Tipo de condutor" wide><select value={wire.conductorType} onChange={event => { const conductorType = event.target.value as Conductor; onUpdateWire(wire.id, { conductorType, color: COLORS[conductorType][0].value }); }}><option value="phase">Fase</option><option value="neutral">Neutro (N)</option><option value="earth">Proteção (PE)</option><option value="return">Retorno</option></select></Field>
          <Field label="Cor"><select value={wire.color} onChange={event => onUpdateWire(wire.id, { color: event.target.value })}>{!wireColors.some(color => color.value === wire.color) && <option value={wire.color}>Cor atual</option>}{wireColors.map(color => <option key={color.value} value={color.value}>{color.label}</option>)}</select></Field>
          <Field label="Seção (mm²)"><Numeric value={wire.gauge} options={GAUGES} list="ewq-wire-gauges" onChange={gauge => onUpdateWire(wire.id, { gauge })} /></Field>
        </div>
        <p className="ewq-field-note"><Info size={14} aria-hidden="true" />A seção informada não é um dimensionamento automático.</p>
        <SelectedActions onDelete={onDelete} />
      </> : device ? <>
        <h3 className="ewq-properties-title">{catalogItem?.name ?? device.type}</h3><p className="ewq-panel-hint">{device.modules} {device.modules === 1 ? 'módulo DIN' : 'módulos DIN'} · posição no trilho {device.rail + 1}</p>
        <div className="ewq-field-grid">
          <Field label="Identificação" wide><input value={device.label} maxLength={80} list="ewq-device-labels" onChange={event => update({ label: event.target.value })} /><datalist id="ewq-device-labels"><option value="Disjuntor geral" /><option value="Iluminação" /><option value="Tomadas" /><option value="Chuveiro" /><option value="Ar-condicionado" /><option value="DR geral" /><option value="Proteção contra surtos" /></datalist></Field>
          <Field label="Circuito vinculado" wide><select value={device.circuitId ?? ''} onChange={event => update({ circuitId: event.target.value || null })}><option value="">Sem circuito</option>{project.circuits.map(circuit => <option key={circuit.id} value={circuit.id}>C{circuit.number} · {circuit.name}</option>)}</select></Field>
          <Field label="Corrente nominal (A)"><Numeric value={device.amperage} options={CURRENTS} list="ewq-device-currents" onChange={amperage => update({ amperage })} /></Field>
          <Field label="Polos"><select value={device.poles} onChange={event => update({ poles: Number(event.target.value) })}>{![1, 2, 3, 4].includes(device.poles) && <option value={device.poles}>{device.poles}</option>}{[1, 2, 3, 4].map(poles => <option key={poles} value={poles}>{poles}P</option>)}</select></Field>
          {!isSurge && !isRcd && <Field label="Curva"><select value={device.curve} onChange={event => update({ curve: event.target.value as Device['curve'] })}><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></Field>}
          <Field label="Tensão nominal (V)"><Numeric value={device.voltage || null} options={VOLTAGES} list="ewq-device-voltages" min={1} onChange={voltage => update({ voltage: voltage ?? 0 })} /></Field>
          <Field label="Seção associada (mm²)"><Numeric value={device.gauge} options={GAUGES} list="ewq-device-gauges" onChange={gauge => update({ gauge })} /></Field>
          {isRcd && <Field label="Sensibilidade IΔn (mA)"><Numeric value={device.sensitivity || null} options={[10, 30, 100, 300, 500]} list="ewq-device-sensitivity" min={1} onChange={sensitivity => update({ sensitivity: sensitivity ?? 0 })} /></Field>}
          {isSurge && <Field label="Corrente de surto (kA)"><Numeric value={device.surgeCurrent || null} options={[5, 10, 12.5, 20, 40, 50, 60, 80]} list="ewq-device-surge" onChange={surgeCurrent => update({ surgeCurrent: surgeCurrent ?? 0 })} /></Field>}
          <Field label="Trilho"><select value={device.rail} onChange={event => update({ rail: Number(event.target.value) })}>{Array.from({ length: project.rails }, (_, index) => <option key={index} value={index}>Trilho {index + 1}</option>)}</select></Field>
          <Field label="Módulo inicial"><select value={device.slot} onChange={event => update({ slot: Number(event.target.value) })}>{Array.from({ length: Math.max(1, project.modulesPerRail - device.modules + 1) }, (_, index) => <option key={index} value={index}>{index + 1}</option>)}</select></Field>
          <Field label="Observações" wide><textarea rows={3} maxLength={600} value={device.description} placeholder="Modelo, fabricante ou especificação…" onChange={event => update({ description: event.target.value })} /></Field>
        </div><p className="ewq-field-note">Confira polos, largura e características no catálogo do fabricante.</p><SelectedActions onDelete={onDelete} onDuplicate={onDuplicate} />
      </> : <>
        <h3 className="ewq-properties-title">{project.name || 'Novo quadro'}</h3><p className="ewq-panel-hint">Selecione um componente ou fio para editar. Os dados abaixo definem o quadro.</p>
        <div className="ewq-field-grid">
          <Field label="Nome do quadro" wide><input value={project.name} maxLength={100} onChange={event => onUpdateProject({ name: event.target.value })} placeholder="Ex.: QDC principal" /></Field>
          <Field label="Cliente / obra" wide><input value={project.client} maxLength={160} onChange={event => onUpdateProject({ client: event.target.value })} placeholder="Identifique o projeto" /></Field>
          <Field label="Alimentação" wide><select value={project.supply} onChange={event => onUpdateProject({ supply: event.target.value as Project['supply'] })}><option value="mono">Monofásica · 1 fase</option><option value="bi">Bifásica · 2 fases</option><option value="tri">Trifásica · 3 fases</option></select></Field>
          <Field label="Tensão de referência (V)" wide help="Informe a tensão real de cada carga na tabela de circuitos."><Numeric value={project.voltage} options={[127, 220, 230, 254, 380, 400, 440]} list="ewq-project-voltage" min={1} onChange={voltage => voltage !== null && onUpdateProject({ voltage })} /></Field>
          <Field label="Trilhos"><select value={project.rails} onChange={event => onUpdateProject({ rails: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6, 8].map(rails => <option key={rails} value={rails}>{rails}</option>)}{![1, 2, 3, 4, 5, 6, 8].includes(project.rails) && <option value={project.rails}>{project.rails}</option>}</select></Field>
          <Field label="Módulos por trilho"><select value={project.modulesPerRail} onChange={event => onUpdateProject({ modulesPerRail: Number(event.target.value) })}>{[8, 12, 16, 18, 24, 36, 48].map(modules => <option key={modules} value={modules}>{modules}</option>)}{![8, 12, 16, 18, 24, 36, 48].includes(project.modulesPerRail) && <option value={project.modulesPerRail}>{project.modulesPerRail}</option>}</select></Field>
          <Field label="Largura externa (mm)"><Numeric value={project.widthMm} min={100} max={3000} step={1} options={[250, 300, 400, 500, 600, 800, 1000]} list="ewq-project-width" onChange={widthMm => widthMm !== null && onUpdateProject({ widthMm })} /></Field>
          <Field label="Altura externa (mm)"><Numeric value={project.heightMm} min={100} max={3000} step={1} options={[300, 400, 500, 600, 800, 1000, 1200]} list="ewq-project-height" onChange={heightMm => heightMm !== null && onUpdateProject({ heightMm })} /></Field>
        </div>
        <div className="ewq-capacity-card"><span>Capacidade do quadro</span><strong>{project.rails * project.modulesPerRail} <small>módulos</small></strong><span>{project.devices.reduce((total, item) => total + item.modules, 0)} ocupados · {Math.max(0, project.rails * project.modulesPerRail - project.devices.reduce((total, item) => total + item.modules, 0))} livres</span></div>
        <p className="ewq-field-note"><Info size={14} aria-hidden="true" />As dimensões externas são referenciais; confirme a área útil, as canaletas e as folgas de montagem.</p>
      </>}
    </div>
  </aside>;
}

export default PropertiesPanel;
