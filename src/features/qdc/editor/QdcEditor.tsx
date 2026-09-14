import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ArrowDownToLine, Boxes, Cable, Check, ChevronDown, Copy, FolderOpen, Hand, HelpCircle, History, Maximize2, Minimize2, MousePointer2, Plus, Redo2, Save, Scan, Settings2, ShieldAlert, Sparkles, Tags, Trash2, Undo2, X, Zap } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import BoardCanvas from '../canvas/BoardCanvas';
import ComponentLibrary from '../components/ComponentLibrary';
import PropertiesPanel from '../components/PropertiesPanel';
import MaterialsPanel from '../components/MaterialsPanel';
import CircuitsPanel from '../circuits/CircuitsPanel';
import ProjectDialog from '../projects/ProjectDialog';
import { initialHistory, historyReducer } from './history';
import { copyDevices, pasteDevices, type QdcClipboard } from './clipboard';
import { addDevice, connect, deleteSelection, fits, moveDevices, organize, updateCircuit, updateDevice, validateProject } from './operations';
import { demoProject, emptyProject } from '../projects/factory';
import { loadProjects, parseProjectFile, saveProjects } from '../projects/storage';
import { warnings } from '../circuits/analysis';
import { routeWires } from '../wiring/routing';
import { exportMaterials, exportPDF, exportPNG, exportProject } from '../export/documents';
import { PRELIMINARY_NOTICE, type Circuit, type Device, type Project, type Selection, type Tool, type ViewMode, type Viewport, type Wire, type WireOptions } from '../types';
import '../editor.css';

const NO_SELECTION: Selection = { devices: [], wire: null };
const VIEW_LABELS: Record<ViewMode, string> = { realistic: 'Realista', schematic: 'Esquemático', installation: 'Instalação', labels: 'Identificação' };
const COLORS = { phase: '#242932', neutral: '#1686cf', earth: '#238747', return: '#8055b5' };

export default function QdcEditor({ usuarioId, aoAlterar }: { usuarioId: string; aoAlterar(alterado: boolean): void }) {
  const [initial] = useState(() => loadProjects(localStorage, usuarioId));
  const [library, setLibrary] = useState(initial.projects);
  const libraryRef = useRef(initial.projects);
  const [history, dispatch] = useReducer(historyReducer, initial.projects.find(p => p.id === initial.activeId) ?? initial.projects[0] ?? demoProject(), initialHistory);
  const project = history.present.project;
  const fingerprint = useMemo(() => JSON.stringify(project), [project]);
  const [savedFingerprint, setSavedFingerprint] = useState(() => JSON.stringify(history.present.project));
  const [message, setMessage] = useState(initial.error || (initial.migrated ? 'Montagens anteriores carregadas. O original foi preservado.' : ''));
  const [selection, setSelection] = useState<Selection>(NO_SELECTION);
  const [tool, setTool] = useState<Tool>('select');
  const [mode, setMode] = useState<ViewMode>('realistic');
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [wireStart, setWireStart] = useState<{ componentId: string; terminalId: string } | null>(null);
  const [wireOptions, setWireOptions] = useState<WireOptions>({ conductorType: 'phase', color: COLORS.phase, gauge: null });
  const [dialog, setDialog] = useState<'new' | 'auto' | 'projects' | 'saveAs' | 'help' | null>(null);
  const [copyName, setCopyName] = useState('');
  const [bottom, setBottom] = useState<'circuits' | 'materials' | 'warnings' | 'history'>('circuits');
  const [panel, setPanel] = useState<'library' | 'properties' | null>(null);
  const [focused, setFocused] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [context, setContext] = useState<{ x: number; y: number } | null>(null);
  const [welcome, setWelcome] = useState(() => { try { return !localStorage.getItem(`qdc-tutorial:${usuarioId}`); } catch { return true; } });
  const clipboard = useRef<QdcClipboard | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const notices = useMemo(() => warnings(project), [project]);
  const used = project.devices.reduce((n, d) => n + d.modules, 0), total = project.rails * project.modulesPerRail;
  const dirty = fingerprint !== savedFingerprint;

  function persist(next: Project, announce = false): boolean {
    if (initial.error) { setMessage(initial.error); return false; }
    const projects = [next, ...libraryRef.current.filter(p => p.id !== next.id)];
    try {
      saveProjects(localStorage, usuarioId, projects, next.id);
      libraryRef.current = projects; setLibrary(projects); setSavedFingerprint(JSON.stringify(next));
      if (announce) setMessage('Projeto salvo neste navegador. Exporte o JSON para guardar uma cópia editável.');
      return true;
    } catch { setMessage('Não foi possível salvar. Verifique o espaço do navegador e exporte o projeto em JSON.'); return false; }
  }
  useEffect(() => {
    if (!dirty || initial.error) return;
    const timer = window.setTimeout(() => persist(project), 750);
    return () => window.clearTimeout(timer);
    // persist intentionally captures only this project snapshot; libraryRef holds the latest library.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, initial.error, usuarioId]);
  useEffect(() => { aoAlterar(dirty); }, [dirty, aoAlterar]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  useEffect(() => {
    if (!focused) return;
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [focused]);

  function commit(next: Project, label: string) {
    if (!validateProject(next)) { setMessage('A alteração gerou dados inválidos. O quadro anterior foi preservado.'); return; }
    dispatch({ type: 'commit', project: next, label }); setMessage('');
  }
  function run(operation: () => Project, label: string) {
    try { commit(operation(), label); } catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível concluir a alteração.'); }
  }
  function remove() {
    if (!selection.devices.length && !selection.wire) return;
    run(() => deleteSelection(project, selection), 'Excluir seleção'); setSelection(NO_SELECTION); setWireStart(null); setContext(null);
  }
  function copy() { if (!selection.devices.length) return; clipboard.current = copyDevices(project, selection.devices); setMessage(`${selection.devices.length} componente(s) copiado(s). Use Ctrl+V para colar.`); }
  function paste() {
    if (!clipboard.current?.devices.length) { setMessage('Selecione e copie um componente primeiro.'); return; }
    try { const result = pasteDevices(project, clipboard.current); commit(result.project, 'Colar componentes'); setSelection({ devices: result.ids, wire: null }); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível colar.'); }
  }
  function duplicate() { clipboard.current = copyDevices(project, selection.devices); paste(); }
  function undo() { dispatch({ type: 'undo' }); setSelection(NO_SELECTION); setWireStart(null); }
  function redo() { dispatch({ type: 'redo' }); setSelection(NO_SELECTION); setWireStart(null); }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')) return;
      const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
      if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (mod && key === 'y') { e.preventDefault(); redo(); }
      else if (mod && key === 'c') { e.preventDefault(); copy(); }
      else if (mod && key === 'v') { e.preventDefault(); paste(); }
      else if (mod && key === 's') { e.preventDefault(); persist(project, true); }
      else if (mod && key === 'a') { e.preventDefault(); setSelection({ devices: project.devices.map(d => d.id), wire: null }); }
      else if (key === 'delete' || key === 'backspace') { e.preventDefault(); remove(); }
      else if (key === 'escape') { setWireStart(null); setSelection(NO_SELECTION); setContext(null); setExportMenu(false); }
      else if (key === 'v' && !mod) { setTool('select'); setWireStart(null); }
      else if (key === 'w' && !mod) setTool('wire');
      else if (key === 'h' && !mod) { setTool('pan'); setWireStart(null); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  function open(next: Project) {
    if (dirty && !persist(project) && !window.confirm('O projeto atual não foi salvo. Abrir outro e descartar as alterações?')) return;
    dispatch({ type: 'reset', project: next }); setSelection(NO_SELECTION); setWireStart(null); setDialog(null); setViewport({ x: 0, y: 0, zoom: 1 }); setMessage('');
  }
  function add(type: string, position?: { rail: number; slot: number }) {
    try { const next = addDevice(project, type, position); commit(next, 'Adicionar dispositivo'); setSelection({ devices: [next.devices.at(-1)!.id], wire: null }); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível adicionar.'); }
  }
  function terminal(componentId: string, terminalId: string) {
    if (tool !== 'wire') return;
    if (!wireStart) { setWireStart({ componentId, terminalId }); return; }
    try { commit(connect(project, wireStart, { componentId, terminalId }, wireOptions), 'Conectar terminais'); setWireStart(null); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível conectar.'); }
  }
  function editDevice(id: string, patch: Partial<Device>) { run(() => updateDevice(project, id, patch), 'Editar componente'); }
  function editCircuit(id: string, patch: Partial<Circuit>) { run(() => updateCircuit(project, id, patch), 'Editar circuito'); }
  function editProject(patch: Partial<Project>) {
    run(() => { const next = { ...project, ...patch }; if (!next.devices.every(d => fits(next, d))) throw new Error('O tamanho escolhido não acomoda os dispositivos atuais. Mova-os antes de reduzir a caixa.'); return routeWires(next); }, 'Configurar quadro');
  }
  function editWire(id: string, patch: Partial<Wire>) {
    run(() => routeWires({ ...project, wires: project.wires.map(w => w.id === id ? { ...w, ...patch } : w) }), 'Editar fio');
  }
  function addCircuit() {
    const circuit: Circuit = { id: crypto.randomUUID(), number: Math.max(0, ...project.circuits.map(c => c.number)) + 1, name: 'Novo circuito', phase: 'R', breakerId: null, cableGauge: null, load: null, loadUnit: 'W', voltage: project.voltage, powerFactor: 1, drId: null, notes: '', color: '#e9b949' };
    commit({ ...project, circuits: [...project.circuits, circuit] }, 'Adicionar circuito');
  }
  async function exportFile(format: string) {
    setExportMenu(false); setExporting(true);
    try {
      if (format === 'json') exportProject(project);
      else if (format === 'csv') exportMaterials(project);
      else if (format === 'png') await exportPNG(project);
      else if (format === 'print') window.print();
      else await exportPDF(project, format === 'labels');
      setMessage(format === 'print' ? 'Visualização de impressão aberta.' : 'Arquivo gerado com a montagem atual.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível exportar.'); }
    finally { setExporting(false); }
  }
  function dismissWelcome() { setWelcome(false); try { localStorage.setItem(`qdc-tutorial:${usuarioId}`, '1'); } catch { /* tutorial persistence is optional */ } }

  return <div className={`ewq-editor${focused ? ' ewq-focused' : ''}`}>
    <header className="ewq-heading">
      <div className="ewq-brand"><span className="ewq-brand-mark"><Zap size={23} /></span><div><span>ELETRICAWEB <small>/ WORKSPACE</small></span><h1>Montador de QDC</h1></div><span className="ewq-preliminary">Proposta visual</span></div>
      <div className="ewq-heading-actions"><button className="ewq-button" onClick={() => setDialog('auto')}><Sparkles size={16} /> Montar automaticamente</button><button className="ewq-icon" aria-label="Tutorial do editor" onClick={() => setDialog('help')}><HelpCircle size={18} /></button><button className="ewq-icon" aria-label={focused ? 'Sair do modo foco' : 'Expandir editor'} onClick={() => setFocused(!focused)}>{focused ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button></div>
    </header>
    <div className="ewq-project-bar">
      <button className="ewq-project-name" onClick={() => setDialog('projects')}><FolderOpen size={18} /><span>{project.name}<small>{project.supply === 'mono' ? 'Monofásico' : project.supply === 'bi' ? 'Bifásico' : 'Trifásico'} · {project.voltage} V · {project.rails} trilhos</small></span><ChevronDown size={15} /></button>
      <span className={`ewq-save-state${dirty ? ' is-pending' : ''}`}><Check size={13} />{initial.error ? 'Armazenamento indisponível' : dirty ? 'Salvando…' : 'Salvo neste navegador'}</span>
      <div className="ewq-bar-actions"><button className="ewq-button" onClick={() => setDialog('new')}><Plus size={15} /> Novo</button><button className="ewq-button" onClick={() => persist(project, true)}><Save size={15} /> Salvar</button>
        <div className="ewq-export"><button className="ewq-button ewq-primary" disabled={exporting} onClick={() => setExportMenu(!exportMenu)} aria-expanded={exportMenu}><ArrowDownToLine size={15} /> {exporting ? 'Gerando…' : 'Exportar'}<ChevronDown size={13} /></button>
          {exportMenu && <div className="ewq-menu">{[['png', 'Imagem PNG'], ['pdf', 'Projeto PDF'], ['json', 'Projeto editável JSON'], ['csv', 'Lista de materiais CSV'], ['labels', 'Etiquetas PDF'], ['print', 'Imprimir quadro']].map(([id, label]) => <button key={id} onClick={() => void exportFile(id)}>{label}</button>)}</div>}
        </div>
      </div>
    </div>
    {welcome && <div className="ewq-onboarding"><span><strong>Seu primeiro quadro, passo a passo.</strong> Escolha a caixa → adicione dispositivos → crie circuitos → conecte terminais → organize e exporte.</span><button className="ewq-button" onClick={() => setDialog('help')}>Ver tutorial</button><button className="ewq-icon" aria-label="Dispensar introdução" onClick={dismissWelcome}><X size={16} /></button></div>}
    <div className="ewq-toolbar" aria-label="Ferramentas do editor">
      <div className="ewq-tool-group">{([['select', MousePointer2, 'Selecionar (V)'], ['wire', Cable, 'Passar fios (W)'], ['pan', Hand, 'Mover vista (H)']] as const).map(([id, Icon, label]) => <button key={id} className="ewq-icon" aria-label={label} title={label} aria-pressed={tool === id} onClick={() => { setTool(id); setWireStart(null); }}><Icon size={18} /></button>)}</div>
      <div className="ewq-tool-group"><button className="ewq-icon" aria-label="Desfazer (Ctrl+Z)" disabled={!history.past.length} onClick={undo}><Undo2 size={17} /></button><button className="ewq-icon" aria-label="Refazer (Ctrl+Y)" disabled={!history.future.length} onClick={redo}><Redo2 size={17} /></button></div>
      <div className="ewq-tool-group"><button className="ewq-button" onClick={() => run(() => organize(project), 'Organizar fiação')}><Cable size={15} /> Organizar fiação</button></div>
      <label className="ewq-view-label"><span className="sr-only">Modo de visualização</span><select value={mode} onChange={e => setMode(e.target.value as ViewMode)}>{Object.entries(VIEW_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <div className="ewq-tool-group ewq-zoom"><button className="ewq-icon" aria-label="Diminuir zoom" onClick={() => setViewport(v => ({ ...v, zoom: Math.max(.25, v.zoom - .1) }))}>−</button><output aria-label="Zoom atual">{Math.round(viewport.zoom * 100)}%</output><button className="ewq-icon" aria-label="Aumentar zoom" onClick={() => setViewport(v => ({ ...v, zoom: Math.min(3, v.zoom + .1) }))}>+</button><button className="ewq-icon" aria-label="Ajustar quadro à tela" onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}><Scan size={16} /></button></div>
      <button className="ewq-icon ewq-panel-toggle" aria-label="Abrir biblioteca de componentes" aria-pressed={panel === 'library'} onClick={() => setPanel(panel === 'library' ? null : 'library')}><Boxes size={18} /></button>
      <button className="ewq-icon ewq-panel-toggle" aria-label="Abrir propriedades" aria-pressed={panel === 'properties'} onClick={() => setPanel(panel === 'properties' ? null : 'properties')}><Settings2 size={18} /></button>
    </div>
    {tool === 'wire' && <div className="ewq-wire-controls"><strong>{wireStart ? '2. Escolha o terminal de destino' : '1. Escolha o terminal de origem'}</strong><label>Condutor<select value={wireOptions.conductorType} onChange={e => { const type = e.target.value as WireOptions['conductorType']; setWireOptions({ ...wireOptions, conductorType: type, color: COLORS[type] }); }}><option value="phase">Fase</option><option value="neutral">Neutro</option><option value="earth">Terra / PE</option><option value="return">Retorno</option></select></label><label>Cor<select value={wireOptions.color} onChange={e => setWireOptions({ ...wireOptions, color: e.target.value })}>{(wireOptions.conductorType === 'phase' ? [['#242932', 'Preto'], ['#c73535', 'Vermelho'], ['#805334', 'Marrom']] : wireOptions.conductorType === 'return' ? [['#8055b5', 'Violeta'], ['#e67e22', 'Laranja']] : [[COLORS[wireOptions.conductorType], wireOptions.conductorType === 'earth' ? 'Verde/amarelo' : 'Azul']]).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label><label>Bitola<select value={wireOptions.gauge ?? ''} onChange={e => setWireOptions({ ...wireOptions, gauge: e.target.value ? Number(e.target.value) : null })}><option value="">A definir</option>{[1.5, 2.5, 4, 6, 10, 16, 25, 35].map(g => <option key={g} value={g}>{g} mm²</option>)}</select></label><button className="ewq-button" onClick={() => { setTool('select'); setWireStart(null); }}>Concluir</button></div>}
    {message && <div className="ewq-feedback" role="status"><span>{message}</span><button className="ewq-icon" aria-label="Fechar mensagem" onClick={() => setMessage('')}><X size={14} /></button></div>}
    <div className={`ewq-workbench ewq-show-${panel ?? 'canvas'}`}>
      <aside className="ewq-library"><ComponentLibrary onAdd={type => add(type)} /></aside>
      <section className="ewq-canvas-panel" aria-label="Área de desenho do quadro"><div className="ewq-canvas-meta"><span><span className="ewq-live-dot" /> VISTA FRONTAL / {VIEW_LABELS[mode].toUpperCase()}</span><span>{project.widthMm} × {project.heightMm} mm</span></div>
        <BoardCanvas project={project} selection={selection} tool={tool} mode={mode} viewport={viewport} onViewport={setViewport} onSelect={setSelection} onMove={(ids, r, s) => run(() => moveDevices(project, ids, r, s), 'Mover dispositivos')} onAdd={add} onTerminal={terminal} wireStart={wireStart} onContextMenu={(x, y, id) => { if (id && !selection.devices.includes(id)) setSelection({ devices: [id], wire: null }); setContext({ x, y }); }} onMessage={setMessage} />
        <div className="ewq-canvas-footer"><span>{tool === 'wire' ? 'Conecte exclusivamente pelos terminais.' : tool === 'pan' ? 'Arraste para mover a vista.' : 'Arraste para encaixar · Shift para seleção múltipla'}</span><span className="ewq-wire-legend" aria-label="Legenda dos condutores"><i className="is-phase" />Fase<i className="is-neutral" />Neutro<i className="is-earth" />PE <b>{project.devices.length} disp. · {project.wires.length} fios</b></span></div>
      </section>
      <aside className="ewq-properties"><PropertiesPanel project={project} selection={selection} onUpdateDevice={editDevice} onUpdateWire={editWire} onDelete={remove} onDuplicate={duplicate} onUpdateProject={editProject} /></aside>
    </div>
    <div className="ewq-occupation"><span><strong>{used}</strong> / {total} módulos DIN</span><progress max={total} value={used} aria-label="Ocupação do quadro" /><span>{total - used} livres</span><button onClick={() => setBottom('warnings')}><ShieldAlert size={14} /> {notices.length} itens a revisar</button></div>
    <div className="ewq-bottom-tabs" role="tablist" aria-label="Informações do projeto">{([['circuits', 'Circuitos', Cable], ['materials', 'Materiais', Boxes], ['warnings', 'Verificações', ShieldAlert], ['history', 'Histórico', History]] as const).map(([id, label, Icon]) => <button key={id} role="tab" id={`ewq-tab-${id}`} aria-selected={bottom === id} aria-controls="ewq-tabpanel" onClick={() => setBottom(id)}><Icon size={15} /> {label}{id === 'circuits' && <span>{project.circuits.length}</span>}</button>)}</div>
    <div id="ewq-tabpanel" role="tabpanel" aria-labelledby={`ewq-tab-${bottom}`}>
      {bottom === 'circuits' && <CircuitsPanel project={project} onUpdateCircuit={editCircuit} onAddCircuit={addCircuit} onDeleteCircuit={id => commit({ ...project, circuits: project.circuits.filter(c => c.id !== id), devices: project.devices.map(d => d.circuitId === id ? { ...d, circuitId: null } : d) }, 'Excluir circuito')} onSelectDevice={id => { setSelection({ devices: [id], wire: null }); setPanel('properties'); }} onUpdateDevice={editDevice} />}
      {bottom === 'materials' && <MaterialsPanel project={project} onChange={materials => commit({ ...project, materials }, 'Editar materiais')} onExport={() => void exportFile('csv')} />}
      {bottom === 'warnings' && <section className="ewq-bottom-panel"><header><div><h3>Verificações da montagem visual</h3><p>Conectividade gráfica, identificação e ocupação. Não verifica conformidade elétrica.</p></div></header><ul className="ewq-warnings">{notices.length ? notices.map(w => <li key={w.id}><ShieldAlert size={15} /><button onClick={() => { setSelection({ devices: w.deviceId ? [w.deviceId] : [], wire: w.wireId ?? null }); setPanel('properties'); }}>{w.message}</button></li>) : <li><Check size={15} /> Nenhuma pendência gráfica encontrada.</li>}</ul></section>}
      {bottom === 'history' && <section className="ewq-bottom-panel"><header><div><h3>Histórico desta sessão</h3><p>Até 80 etapas. Desfazer e refazer restauram componentes, circuitos e conexões juntos.</p></div></header><ol className="ewq-history">{[...history.past, history.present].map((step, i) => <li key={i}><span>{String(i + 1).padStart(2, '0')}</span>{step.label}{i === history.past.length && <strong>Atual</strong>}</li>)}</ol></section>}
    </div>
    <footer className="ewq-technical-note"><ShieldAlert size={17} /><p>{PRELIMINARY_NOTICE}</p><button className="ewq-button" disabled={exporting || !project.circuits.length} onClick={() => void exportFile('labels')}><Tags size={15} /> Etiquetas</button></footer>
    {context && <><div className="ewq-context-dismiss" onClick={() => setContext(null)} /><div className="ewq-menu ewq-context" style={{ left: Math.max(8, Math.min(context.x, window.innerWidth - 200)), top: Math.max(8, Math.min(context.y, window.innerHeight - 160)) }}><button onClick={() => { copy(); setContext(null); }}>Copiar <small>Ctrl+C</small></button><button onClick={() => { duplicate(); setContext(null); }}>Duplicar</button><button onClick={() => { paste(); setContext(null); }}>Colar <small>Ctrl+V</small></button><button onClick={remove}>Excluir <small>Delete</small></button></div></>}
    {(dialog === 'new' || dialog === 'auto') && <ProjectDialog automatic={dialog === 'auto'} onCreate={open} onClose={() => setDialog(null)} />}
    {dialog === 'projects' && <Modal title="Seus projetos" description="Salvos neste navegador e nesta conta. Exporte o JSON para mover um projeto entre dispositivos." onClose={() => setDialog(null)} footer={<><button className="btn-secondary" onClick={() => importInput.current?.click()}>Importar JSON</button><button className="btn-secondary" onClick={() => { setCopyName(`${project.name} — cópia`); setDialog('saveAs'); }}><Copy size={15} /> Salvar como</button><button className="btn-primary" onClick={() => setDialog('new')}>Novo projeto</button></>}><div className="ewq-project-list">{library.length ? library.map(p => <div key={p.id}><button onClick={() => open(p)}><FolderOpen size={20} /><span><strong>{p.name}</strong><small>{p.devices.length} dispositivos · {p.rails * p.modulesPerRail} módulos</small></span></button><button className="ewq-icon" aria-label={`Excluir projeto ${p.name}`} onClick={() => { if (!window.confirm(`Excluir “${p.name}” deste navegador?`)) return; const remaining = libraryRef.current.filter(q => q.id !== p.id); const next = p.id === project.id ? remaining[0] ?? emptyProject() : project; try { saveProjects(localStorage, usuarioId, remaining, next.id); libraryRef.current = remaining; setLibrary(remaining); if (p.id === project.id) { dispatch({ type: 'reset', project: next }); setSelection(NO_SELECTION); setWireStart(null); } } catch { setMessage('Não foi possível excluir o projeto.'); } }}><Trash2 size={16} /></button></div>) : <p>O projeto atual será salvo automaticamente. Você também pode importar um JSON.</p>}</div></Modal>}
    {dialog === 'saveAs' && <Modal title="Salvar projeto como" onClose={() => setDialog(null)} footer={<><button className="btn-secondary" onClick={() => setDialog(null)}>Cancelar</button><button className="btn-primary" disabled={!copyName.trim()} onClick={() => open({ ...structuredClone(project), id: crypto.randomUUID(), name: copyName.trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })}>Salvar cópia</button></>}><label className="ewq-dialog-form">Nome da cópia<input value={copyName} maxLength={100} onChange={e => setCopyName(e.target.value)} /></label></Modal>}
    {dialog === 'help' && <Modal title="Do quadro vazio à apresentação" onClose={() => setDialog(null)} footer={<button className="btn-primary" onClick={() => { dismissWelcome(); setDialog(null); }}>Começar a montar</button>}><ol className="ewq-tutorial"><li><strong>1. Escolha seu quadro</strong><p>Use Novo para definir alimentação, módulos DIN e tamanho da caixa.</p></li><li><strong>2. Adicione os dispositivos</strong><p>Arraste da biblioteca ou clique no item. Arraste no trilho para mover; Shift seleciona vários. As propriedades também permitem mover por posição.</p></li><li><strong>3. Crie os circuitos</strong><p>Associe disjuntor e DR pela tabela. Informe a carga separadamente para explorar a distribuição entre fases.</p></li><li><strong>4. Faça as conexões</strong><p>Ative Passar fios (W), escolha condutor/bitola e clique nos terminais de origem e destino. Escape cancela a conexão.</p></li><li><strong>5. Organize e exporte</strong><p>Organizar fiação recalcula trajetos. Exporte PNG, PDF, etiquetas, materiais e JSON editável.</p></li></ol><p className="ewq-notice">Ctrl+Z desfaz · Ctrl+Y refaz · Ctrl+C/Ctrl+V copia e cola · Delete exclui · Ctrl+roda ajusta zoom · H move a vista. A demonstração contém valores ilustrativos; não os use como dimensionamento.</p></Modal>}
    <input ref={importInput} type="file" accept=".json" hidden onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { if (file.size > 5_000_000) throw new Error('O limite é 5 MB.'); const imported = parseProjectFile(await file.text()); open({ ...imported, id: crypto.randomUUID(), name: `${imported.name} — importado` }); } catch (err) { setMessage(err instanceof Error ? err.message : 'Falha ao importar.'); setDialog(null); } finally { e.target.value = ''; } }} />
  </div>;
}
