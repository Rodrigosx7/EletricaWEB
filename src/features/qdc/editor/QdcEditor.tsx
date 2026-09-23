import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDownToLine, Boxes, Cable, Check, ChevronDown, CircleAlert, CircuitBoard, Copy, Eye, FolderOpen, Hand, HelpCircle, History, Info, Keyboard, Maximize2, Minimize2, MousePointer2, Plus, Presentation, Redo2, Save, Settings2, ShieldAlert, Sparkles, Tags, Trash2, TriangleAlert, Undo2, X } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import BoardCanvas from '../canvas/BoardCanvas';
import ComponentLibrary from '../components/ComponentLibrary';
import PropertiesPanel from '../components/PropertiesPanel';
import MaterialsPanel from '../components/MaterialsPanel';
import CircuitsPanel from '../circuits/CircuitsPanel';
import ProjectDialog from '../projects/ProjectDialog';
import { initialHistory, historyReducer } from './history';
import { copyDevices, pasteDevices, type QdcClipboard } from './clipboard';
import { addDevice, connect, deleteSelection, fits, moveDeviceOnPlane, moveDevices, organize, rerouteWires, updateCircuit, updateDevice, validateProject } from './operations';
import { demoProject, emptyProject } from '../projects/factory';
import { loadProjects, parseProjectFile, saveProjects } from '../projects/storage';
import { warnings } from '../circuits/analysis';
import { isRailMounted, routeWires } from '../wiring/routing';
import { TERMINATION_OPTIONS, WIRE_COLORS, WIRE_GAUGES } from '../wiring/options';
import { exportMaterials, exportPDF, exportPNG, exportPresentationPNG, exportProject } from '../export/documents';
import { PRELIMINARY_NOTICE, type Circuit, type Device, type Project, type Selection, type Tool, type ViewMode, type Viewport, type Wire, type WireOptions } from '../types';
import '../editor.css';

const NO_SELECTION: Selection = { devices: [], wire: null };
const VIEW_LABELS: Record<ViewMode, string> = { realistic: 'Realista', schematic: 'Esquemático', installation: 'Instalação', labels: 'Identificação' };
type ResizeTarget = 'library' | 'properties' | 'height';
type EditorLayout = { libraryWidth: number; propertiesWidth: number; height: number | null };
type ResizeGesture = { target: ResizeTarget; pointerId: number; origin: number; initial: number };
type ToolShortcuts = Record<Tool, string>;
const DEFAULT_EDITOR_LAYOUT: EditorLayout = { libraryWidth: 240, propertiesWidth: 268, height: null };
const DEFAULT_TOOL_SHORTCUTS: ToolShortcuts = { select: 'V', wire: 'W', pan: 'H' };
const SHORTCUT_MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const;
const SHORTCUT_KEYS = new Set([
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''),
  ...Array.from({ length: 12 }, (_, index) => `F${index + 1}`),
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Tab', 'Home', 'End', 'PageUp', 'PageDown', 'Insert',
]);
const RESERVED_SHORTCUTS = new Set(['Ctrl+Z', 'Ctrl+Shift+Z', 'Ctrl+Y', 'Ctrl+C', 'Ctrl+V', 'Ctrl+S', 'Ctrl+A', 'Delete', 'Backspace', 'Escape']);
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function keyLabel(key: string): string | null {
  if (key === 'Control') return 'Ctrl';
  if (key === ' ') return 'Space';
  if (key.length === 1) {
    const value = key.toUpperCase();
    return SHORTCUT_KEYS.has(value) ? value : null;
  }
  return SHORTCUT_KEYS.has(key) || ['Alt', 'Shift', 'Meta'].includes(key) ? key : null;
}

function shortcutFromEvent(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): string | null {
  const key = keyLabel(event.key);
  if (!key) return null;
  if (SHORTCUT_MODIFIERS.includes(key as typeof SHORTCUT_MODIFIERS[number])) return key;
  const modifiers = [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta'].filter(Boolean) as string[];
  return [...modifiers, key].join('+');
}

function isValidShortcut(value: string): boolean {
  if (!value || value.length > 40) return false;
  const parts = value.split('+');
  if (parts.length === 1 && SHORTCUT_MODIFIERS.includes(parts[0] as typeof SHORTCUT_MODIFIERS[number])) return true;
  const key = parts.at(-1)!;
  const modifiers = parts.slice(0, -1);
  return SHORTCUT_KEYS.has(key) && modifiers.every((part, index) => SHORTCUT_MODIFIERS.includes(part as typeof SHORTCUT_MODIFIERS[number]) && modifiers.indexOf(part) === index);
}

function loadEditorLayout(usuarioId: string): EditorLayout {
  try {
    const saved = JSON.parse(localStorage.getItem(`qdc-editor-layout:${usuarioId}`) || 'null') as Partial<EditorLayout> | null;
    if (!saved) return DEFAULT_EDITOR_LAYOUT;
    return {
      libraryWidth: typeof saved.libraryWidth === 'number' ? clamp(saved.libraryWidth, 190, 420) : DEFAULT_EDITOR_LAYOUT.libraryWidth,
      propertiesWidth: typeof saved.propertiesWidth === 'number' ? clamp(saved.propertiesWidth, 220, 420) : DEFAULT_EDITOR_LAYOUT.propertiesWidth,
      height: typeof saved.height === 'number' ? clamp(saved.height, 420, 1200) : null,
    };
  } catch { return DEFAULT_EDITOR_LAYOUT; }
}

function loadToolShortcuts(usuarioId: string): ToolShortcuts {
  try {
    const saved = JSON.parse(localStorage.getItem(`qdc-tool-shortcuts:${usuarioId}`) || 'null') as Partial<ToolShortcuts> | null;
    const values = (['select', 'wire', 'pan'] as Tool[]).map(tool => typeof saved?.[tool] === 'string' ? saved[tool]! : DEFAULT_TOOL_SHORTCUTS[tool]);
    if (values.some(value => !isValidShortcut(value)) || new Set(values).size !== values.length) return DEFAULT_TOOL_SHORTCUTS;
    return { select: values[0], wire: values[1], pan: values[2] };
  } catch { return DEFAULT_TOOL_SHORTCUTS; }
}

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
  const [wireOptions, setWireOptions] = useState<WireOptions>({ conductorType: 'phase', color: WIRE_COLORS.phase[0].value, gauge: 2.5, termination: 'tubular' });
  const [dialog, setDialog] = useState<'new' | 'auto' | 'projects' | 'saveAs' | 'help' | null>(null);
  const [copyName, setCopyName] = useState('');
  const [bottom, setBottom] = useState<'circuits' | 'materials' | 'warnings' | 'history'>('circuits');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [panel, setPanel] = useState<'library' | 'properties' | null>(null);
  const [focused, setFocused] = useState(false);
  const [editorLayout, setEditorLayout] = useState<EditorLayout>(() => loadEditorLayout(usuarioId));
  const [shortcuts, setShortcuts] = useState<ToolShortcuts>(() => loadToolShortcuts(usuarioId));
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [recordingShortcut, setRecordingShortcut] = useState<Tool | null>(null);
  const [shortcutDraft, setShortcutDraft] = useState<string | null>(null);
  const [shortcutError, setShortcutError] = useState('');
  const [exportMenu, setExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [context, setContext] = useState<{ x: number; y: number } | null>(null);
  const [welcome, setWelcome] = useState(() => { try { return !localStorage.getItem(`qdc-tutorial:${usuarioId}`); } catch { return true; } });
  const clipboard = useRef<QdcClipboard | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const shortcutsRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const workbenchRef = useRef<HTMLDivElement>(null);
  const resizeGesture = useRef<ResizeGesture | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);
  const notices = useMemo(() => warnings(project), [project]);
  const noticeCounts = useMemo(() => ({
    error: notices.filter(notice => notice.severity === 'error').length,
    warning: notices.filter(notice => notice.severity === 'warning').length,
    info: notices.filter(notice => notice.severity === 'info').length,
  }), [notices]);
  const orderedNotices = useMemo(() => [...notices].sort((a, b) => ({ error: 0, warning: 1, info: 2 })[a.severity] - ({ error: 0, warning: 1, info: 2 })[b.severity]), [notices]);
  const used = project.devices.filter(isRailMounted).reduce((n, d) => n + d.modules, 0), total = project.rails * project.modulesPerRail;
  const dirty = fingerprint !== savedFingerprint;
  const selectionLabel = selection.devices.length > 1 ? `${selection.devices.length} componentes` : selection.devices.length === 1 ? project.devices.find(device => device.id === selection.devices[0])?.label : selection.wire ? 'Fio selecionado' : null;

  function closeShortcutMenu() {
    setShortcutsOpen(false); setRecordingShortcut(null); setShortcutDraft(null); setShortcutError('');
  }

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
  useEffect(() => {
    if (!exportMenu) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !exportRef.current?.contains(event.target)) setExportMenu(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [exportMenu]);
  useEffect(() => {
    if (!shortcutsOpen) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !shortcutsRef.current?.contains(event.target)) closeShortcutMenu();
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [shortcutsOpen]);
  useEffect(() => {
    if (!context) return;
    const frame = window.requestAnimationFrame(() => contextRef.current?.querySelector<HTMLButtonElement>('button')?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [context]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(`qdc-editor-layout:${usuarioId}`, JSON.stringify(editorLayout)); } catch { /* Layout persistence is optional. */ }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [editorLayout, usuarioId]);
  useEffect(() => {
    try { localStorage.setItem(`qdc-tool-shortcuts:${usuarioId}`, JSON.stringify(shortcuts)); } catch { /* Shortcut persistence is optional. */ }
  }, [shortcuts, usuarioId]);
  useEffect(() => () => document.body.classList.remove('ewq-resizing-row', 'ewq-resizing-column'), []);

  function saveShortcut(target: Tool, shortcut: string) {
    const duplicate = (Object.entries(shortcuts) as [Tool, string][]).find(([toolId, value]) => toolId !== target && value === shortcut);
    if (duplicate) {
      const label = { select: 'Selecionar', wire: 'Passar fios', pan: 'Mover vista' }[duplicate[0]];
      setShortcutError(`${shortcut} já está sendo usado em “${label}”.`);
      setRecordingShortcut(null); setShortcutDraft(null);
      return;
    }
    if (RESERVED_SHORTCUTS.has(shortcut)) {
      setShortcutError(`${shortcut} já é usado por uma ação do editor.`);
      setRecordingShortcut(null); setShortcutDraft(null);
      return;
    }
    setShortcuts(current => ({ ...current, [target]: shortcut }));
    setShortcutError(''); setRecordingShortcut(null); setShortcutDraft(null);
  }

  function recordShortcut(target: Tool, event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      setRecordingShortcut(null); setShortcutDraft(null); setShortcutError('');
      return;
    }
    const shortcut = shortcutFromEvent(event.nativeEvent);
    event.preventDefault(); event.stopPropagation();
    if (!shortcut) {
      setShortcutError('Essa tecla não pode ser usada como atalho.');
      return;
    }
    if (SHORTCUT_MODIFIERS.includes(shortcut as typeof SHORTCUT_MODIFIERS[number])) {
      setShortcutDraft(shortcut);
      return;
    }
    saveShortcut(target, shortcut);
  }

  function finishModifierShortcut(target: Tool, event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (recordingShortcut !== target || !shortcutDraft || keyLabel(event.key) !== shortcutDraft) return;
    event.preventDefault(); event.stopPropagation();
    saveShortcut(target, shortcutDraft);
  }

  function resizeLimit(target: ResizeTarget, value: number) {
    const width = workbenchRef.current?.getBoundingClientRect().width ?? 1200;
    if (target === 'height') return clamp(value, 420, 1200);
    if (target === 'library') {
      const propertiesSpace = width > 1080 ? editorLayout.propertiesWidth + 20 : 10;
      return clamp(value, 190, Math.max(190, Math.min(420, width - propertiesSpace - 380)));
    }
    return clamp(value, 220, Math.max(220, Math.min(420, width - editorLayout.libraryWidth - 400)));
  }

  function setResizeValue(target: ResizeTarget, value: number) {
    const next = resizeLimit(target, value);
    setEditorLayout(current => target === 'library' ? { ...current, libraryWidth: next } : target === 'properties' ? { ...current, propertiesWidth: next } : { ...current, height: next });
  }

  function resetResize(target: ResizeTarget) {
    setEditorLayout(current => target === 'library' ? { ...current, libraryWidth: DEFAULT_EDITOR_LAYOUT.libraryWidth } : target === 'properties' ? { ...current, propertiesWidth: DEFAULT_EDITOR_LAYOUT.propertiesWidth } : { ...current, height: null });
  }

  function beginResize(target: ResizeTarget, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const rect = workbenchRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const current = target === 'library' ? editorLayout.libraryWidth : target === 'properties' ? editorLayout.propertiesWidth : rect.height;
    resizeGesture.current = { target, pointerId: event.pointerId, origin: target === 'height' ? event.clientY : event.clientX, initial: current };
    document.body.classList.add(target === 'height' ? 'ewq-resizing-row' : 'ewq-resizing-column');
  }

  function moveResize(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = resizeGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const coordinate = gesture.target === 'height' ? event.clientY : event.clientX;
    const direction = gesture.target === 'properties' ? -1 : 1;
    setResizeValue(gesture.target, gesture.initial + (coordinate - gesture.origin) * direction);
  }

  function endResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (resizeGesture.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    resizeGesture.current = null;
    document.body.classList.remove('ewq-resizing-row', 'ewq-resizing-column');
  }

  function resizeWithKeyboard(target: ResizeTarget, event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Home') { event.preventDefault(); resetResize(target); return; }
    const horizontal = target !== 'height';
    if (!(horizontal ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown']).includes(event.key)) return;
    event.preventDefault();
    const current = target === 'library' ? editorLayout.libraryWidth : target === 'properties' ? editorLayout.propertiesWidth : editorLayout.height ?? workbenchRef.current?.getBoundingClientRect().height ?? 520;
    const positive = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const direction = target === 'properties' ? -1 : 1;
    setResizeValue(target, current + (positive ? 16 : -16) * direction);
  }

  const workbenchStyle = {
    '--ewq-library-width': `${editorLayout.libraryWidth}px`,
    '--ewq-properties-width': `${editorLayout.propertiesWidth}px`,
    ...(editorLayout.height === null ? {} : { '--ewq-workbench-height': `${editorLayout.height}px` }),
  } as CSSProperties;

  function showDetails(tab: typeof bottom) {
    setBottom(tab); setDetailsOpen(true);
    window.requestAnimationFrame(() => detailsRef.current?.scrollIntoView({ block: 'nearest' }));
  }
  function showCircuit(id: string) {
    showDetails('circuits');
    window.requestAnimationFrame(() => {
      const row = document.getElementById(`ewq-circuit-${id}`);
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      row?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
      row?.focus({ preventScroll: true });
    });
  }

  function commit(next: Project, label: string): boolean {
    if (!validateProject(next)) { setMessage('A alteração gerou dados inválidos. O quadro anterior foi preservado.'); return false; }
    dispatch({ type: 'commit', project: next, label }); setMessage('');
    return true;
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
      else if (key === 'escape') { setWireStart(null); setSelection(NO_SELECTION); setContext(null); setExportMenu(false); setPanel(null); }
      else {
        const pressedShortcut = shortcutFromEvent(e);
        if (pressedShortcut === shortcuts.select) { e.preventDefault(); setTool('select'); setWireStart(null); }
        else if (pressedShortcut === shortcuts.wire) { e.preventDefault(); setTool('wire'); }
        else if (pressedShortcut === shortcuts.pan) { e.preventDefault(); setTool('pan'); setWireStart(null); }
      }
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
  function organizeCurrentProject() {
    if (!project.devices.some(isRailMounted)) { setMessage('Adicione componentes ao trilho antes de organizar o quadro.'); return; }
    try {
      if (!commit(organize(project), 'Organização inteligente')) return;
      setSelection(NO_SELECTION); setWireStart(null); setContext(null);
      setMessage('Quadro organizado por função: proteção, distribuição, circuitos e automação. Os fios foram recalculados.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível organizar o quadro.'); }
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
      else if (format === 'presentation') await exportPresentationPNG(project);
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
      <div className="ewq-brand"><div><h1>Montagem de quadros</h1><p>Do primeiro componente à apresentação do seu projeto.</p></div></div>
      <div className="ewq-heading-actions"><button className="ewq-button ewq-quiet" onClick={() => setDialog('help')}><HelpCircle size={17} aria-hidden="true" /> Como montar</button><button className="ewq-button ewq-quiet" aria-label={focused ? 'Sair do modo foco' : 'Expandir editor'} onClick={() => setFocused(!focused)}>{focused ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}<span>{focused ? 'Sair do foco' : 'Modo foco'}</span></button></div>
    </header>
    <div className="ewq-studio">
    <div className="ewq-project-bar">
      <span className="ewq-project-symbol" aria-hidden="true"><CircuitBoard size={25} /></span>
      <div className="ewq-project-info"><button className="ewq-project-name" onClick={() => setDialog('projects')} title="Abrir meus projetos"><span>{project.name}</span><ChevronDown size={16} aria-hidden="true" /></button>
        <div className="ewq-project-meta"><span>{project.supply === 'mono' ? 'Monofásico' : project.supply === 'bi' ? 'Bifásico' : 'Trifásico'} · {project.voltage} V · {project.rails} trilhos</span><span className={`ewq-save-state${dirty || initial.error ? ' is-pending' : ''}`}>{initial.error ? <CircleAlert size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}{initial.error ? 'Armazenamento indisponível' : dirty ? 'Salvando…' : 'Salvo neste navegador'}</span></div>
      </div>
      <div className="ewq-bar-actions"><button className="ewq-button" onClick={() => setDialog('new')}><Plus size={16} aria-hidden="true" /> Novo</button><button className="ewq-button ewq-save-button" onClick={() => persist(project, true)}><Save size={16} aria-hidden="true" /> Salvar</button>
        <div className="ewq-export" ref={exportRef}><button className="ewq-button ewq-primary" disabled={exporting} onClick={() => setExportMenu(!exportMenu)} aria-expanded={exportMenu} aria-controls="ewq-export-options"><ArrowDownToLine size={16} aria-hidden="true" /> {exporting ? 'Gerando…' : 'Exportar'}<ChevronDown size={14} aria-hidden="true" /></button>
          {exportMenu && <div className="ewq-menu ewq-export-menu" id="ewq-export-options"><p className="ewq-menu-label">Leve seu projeto com você</p><button className="ewq-export-featured" onClick={() => void exportFile('presentation')}><span><Presentation size={18} aria-hidden="true" /><span><strong>Apresentação final</strong><small>PNG diagramado para o cliente</small></span></span><ArrowDownToLine size={14} aria-hidden="true" /></button>{[['png', 'Imagem simples PNG'], ['pdf', 'Projeto PDF completo'], ['json', 'Projeto editável JSON'], ['csv', 'Lista de materiais CSV'], ['labels', 'Etiquetas PDF'], ['print', 'Imprimir quadro']].map(([id, label]) => <button key={id} onClick={() => void exportFile(id)}>{label}<ArrowDownToLine size={14} aria-hidden="true" /></button>)}</div>}
        </div>
      </div>
    </div>
    {welcome && <div className="ewq-onboarding"><span className="ewq-onboarding-title">Comece por aqui</span><div className="ewq-steps"><button onClick={() => { setSelection(NO_SELECTION); setPanel('properties'); }}><span>1</span>Configure o quadro</button><button onClick={() => { setTool('select'); setWireStart(null); setPanel('library'); }}><span>2</span>Adicione componentes</button><button onClick={() => { setTool('wire'); setWireStart(null); setPanel(null); }}><span>3</span>Conecte os fios</button></div><button className="ewq-icon" aria-label="Dispensar introdução" onClick={dismissWelcome}><X size={16} /></button></div>}
    <div className="ewq-toolbar" aria-label="Ferramentas do editor">
      <div className="ewq-tool-group ewq-mode-tools">{([['select', MousePointer2, 'Selecionar'], ['wire', Cable, 'Passar fios'], ['pan', Hand, 'Mover vista']] as const).map(([id, Icon, label]) => <button key={id} className="ewq-tool" title={`${label} (${shortcuts[id]})`} aria-pressed={tool === id} onClick={() => { setTool(id); setWireStart(null); setPanel(null); }}><Icon size={17} aria-hidden="true" /><span>{label}</span><kbd>{shortcuts[id]}</kbd></button>)}<div className="ewq-shortcuts" ref={shortcutsRef}><button className="ewq-icon ewq-shortcuts-toggle" aria-label="Configurar atalhos das ferramentas" title="Configurar atalhos" aria-expanded={shortcutsOpen} aria-controls="ewq-shortcut-menu" onClick={() => shortcutsOpen ? closeShortcutMenu() : setShortcutsOpen(true)}><Keyboard size={17} /></button>{shortcutsOpen && <div id="ewq-shortcut-menu" className="ewq-shortcut-menu" role="dialog" aria-label="Configurar atalhos" onKeyDown={event => { if (event.key === 'Escape' && !recordingShortcut) { event.stopPropagation(); closeShortcutMenu(); } }}><header><div><strong>Atalhos das ferramentas</strong><span>Clique em um campo e pressione a tecla ou combinação desejada.</span></div><button className="ewq-icon" aria-label="Fechar atalhos" onClick={closeShortcutMenu}><X size={14} /></button></header>{([['select', 'Selecionar'], ['wire', 'Passar fios'], ['pan', 'Mover vista']] as const).map(([id, label]) => <div className="ewq-shortcut-row" key={id}><span>{label}</span><button type="button" className={`ewq-shortcut-capture${recordingShortcut === id ? ' is-recording' : ''}`} aria-label={`Definir atalho para ${label}. Atual: ${shortcuts[id]}`} aria-pressed={recordingShortcut === id} onClick={() => { setRecordingShortcut(id); setShortcutDraft(null); setShortcutError(''); }} onKeyDown={event => recordingShortcut === id && recordShortcut(id, event)} onKeyUp={event => finishModifierShortcut(id, event)}>{recordingShortcut === id ? shortcutDraft ? `${shortcutDraft} + …` : 'Pressione…' : shortcuts[id]}</button></div>)}{shortcutError && <p className="ewq-shortcut-error" role="alert">{shortcutError}</p>}<p className="ewq-shortcut-tip">Esc cancela a gravação. Atalhos do editor, como Ctrl+S, permanecem reservados.</p><button className="ewq-shortcuts-reset" onClick={() => { setShortcuts(DEFAULT_TOOL_SHORTCUTS); setRecordingShortcut(null); setShortcutDraft(null); setShortcutError(''); }}>Restaurar V, W e H</button></div>}</div></div>
      <div className="ewq-tool-group"><button className="ewq-icon" aria-label="Desfazer (Ctrl+Z)" disabled={!history.past.length} onClick={undo}><Undo2 size={17} /></button><button className="ewq-icon" aria-label="Refazer (Ctrl+Y)" disabled={!history.future.length} onClick={redo}><Redo2 size={17} /></button></div>
      <button className="ewq-button ewq-organize" title="Recalcular os trajetos sem mover os componentes" onClick={() => run(() => rerouteWires(project), 'Recalcular trajetos')}><Cable size={16} aria-hidden="true" /> Recalcular fios</button>
      <button className="ewq-button ewq-smart-organize" aria-label="Organizar quadro atual de forma inteligente" title="Agrupa proteção, distribuição, circuitos e automação; depois recalcula os fios" onClick={organizeCurrentProject}><Boxes size={16} aria-hidden="true" /><span className="ewq-organize-long">Organizar quadro</span><span className="ewq-organize-short">Organizar</span></button>
      <button className="ewq-button ewq-auto" aria-label="Montagem automática" onClick={() => setDialog('auto')}><Sparkles size={16} aria-hidden="true" /><span className="ewq-auto-long">Montagem automática</span><span className="ewq-auto-short">Automático</span></button>
      <div className="ewq-responsive-tools"><button className="ewq-button ewq-library-toggle" aria-label="Abrir biblioteca de componentes" aria-expanded={panel === 'library'} onClick={() => setPanel(panel === 'library' ? null : 'library')}><Boxes size={17} aria-hidden="true" /> Componentes</button><button className="ewq-button ewq-properties-toggle" aria-label="Abrir propriedades" aria-expanded={panel === 'properties'} onClick={() => setPanel(panel === 'properties' ? null : 'properties')}><Settings2 size={17} aria-hidden="true" /> Propriedades</button></div>
    </div>
    {tool === 'wire' && <div className="ewq-wire-controls"><strong>{wireStart ? '2. Escolha o terminal de destino' : '1. Escolha o terminal de origem'}</strong><label>Condutor<select value={wireOptions.conductorType} onChange={e => { const conductorType = e.target.value as WireOptions['conductorType']; setWireOptions({ ...wireOptions, conductorType, color: WIRE_COLORS[conductorType][0].value }); }}><option value="phase">Fase</option><option value="neutral">Neutro</option><option value="earth">Terra / PE</option><option value="return">Retorno</option></select></label><label>Bitola<select value={wireOptions.gauge ?? ''} onChange={e => setWireOptions({ ...wireOptions, gauge: e.target.value ? Number(e.target.value) : null })}><option value="">A definir</option>{WIRE_GAUGES.map(gauge => <option key={gauge} value={gauge}>{gauge} mm²</option>)}</select></label><fieldset className="ewq-wire-color-picker"><legend>Cor</legend>{WIRE_COLORS[wireOptions.conductorType].map(color => <button key={color.value} type="button" className={wireOptions.color === color.value ? 'is-active' : ''} aria-label={color.label} aria-pressed={wireOptions.color === color.value} title={color.label} onClick={() => setWireOptions({ ...wireOptions, color: color.value })}><span style={{ background: color.value }} /></button>)}</fieldset><label>Terminal<select value={wireOptions.termination} onChange={e => setWireOptions({ ...wireOptions, termination: e.target.value as WireOptions['termination'] })}>{TERMINATION_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button className="ewq-button" onClick={() => { setTool('select'); setWireStart(null); }}>Concluir</button></div>}
    {message && <div className="ewq-feedback" role="status"><span>{message}</span><button className="ewq-icon" aria-label="Fechar mensagem" onClick={() => setMessage('')}><X size={14} /></button></div>}
    <div ref={workbenchRef} className={`ewq-workbench ewq-show-${panel ?? 'canvas'}`} style={workbenchStyle}>
      <div className="ewq-library-slot"><ComponentLibrary storageKey={`qdc-component-library:${usuarioId}`} onAdd={type => { add(type); setPanel(null); }} onClose={() => setPanel(null)} /></div>
      <div className="ewq-resize-handle is-vertical is-library" role="separator" tabIndex={0} aria-label="Redimensionar biblioteca e área de montagem" aria-orientation="vertical" aria-valuemin={190} aria-valuemax={420} aria-valuenow={Math.round(editorLayout.libraryWidth)} title="Arraste para ajustar a largura · Duplo clique restaura" onPointerDown={event => beginResize('library', event)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} onDoubleClick={() => resetResize('library')} onKeyDown={event => resizeWithKeyboard('library', event)}><span /></div>
      <section className="ewq-canvas-panel" aria-label="Área de desenho do quadro"><div className="ewq-canvas-meta"><span><CircuitBoard size={16} aria-hidden="true" /> Área de montagem</span><div className="ewq-view-switch" role="group" aria-label="Modo de visualização"><Eye size={15} aria-hidden="true" />{Object.entries(VIEW_LABELS).map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id as ViewMode)}>{label}</button>)}</div><label className="ewq-view-label ewq-view-label-compact"><Eye size={15} aria-hidden="true" /><span className="sr-only">Modo de visualização</span><select aria-label="Modo de visualização" value={mode} onChange={e => setMode(e.target.value as ViewMode)}>{Object.entries(VIEW_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
        {selectionLabel && <button className="ewq-selection-chip" onClick={() => setPanel('properties')}><Settings2 size={15} aria-hidden="true" /><span>Editar: {selectionLabel}</span></button>}
        <BoardCanvas project={project} selection={selection} tool={tool} mode={mode} viewport={viewport} onViewport={setViewport} onSelect={setSelection} onMove={(ids, r, s) => run(() => moveDevices(project, ids, r, s), 'Mover dispositivos')} onMovePlane={(id, position) => run(() => moveDeviceOnPlane(project, id, position), 'Mover entrada de energia')} onAdd={add} onTerminal={terminal} onWirePath={(id, path) => editWire(id, { path, manualPath: true })} wireStart={wireStart} wireOptions={wireOptions} onContextMenu={(x, y, id) => { if (id && !selection.devices.includes(id)) setSelection({ devices: [id], wire: null }); setContext({ x, y }); }} onMessage={setMessage} />
        <div className="ewq-canvas-footer"><span>{project.widthMm} × {project.heightMm} mm <span className="ewq-canvas-scale">· sem escala</span></span><span className="ewq-wire-legend" aria-label="Legenda dos condutores"><i className="is-phase" />Fase<i className="is-neutral" />Neutro<i className="is-earth" />PE</span></div>
      </section>
      <div className="ewq-resize-handle is-vertical is-properties" role="separator" tabIndex={0} aria-label="Redimensionar área de montagem e propriedades" aria-orientation="vertical" aria-valuemin={220} aria-valuemax={420} aria-valuenow={Math.round(editorLayout.propertiesWidth)} title="Arraste para ajustar a largura · Duplo clique restaura" onPointerDown={event => beginResize('properties', event)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} onDoubleClick={() => resetResize('properties')} onKeyDown={event => resizeWithKeyboard('properties', event)}><span /></div>
      <div className="ewq-properties-slot"><PropertiesPanel project={project} selection={selection} onUpdateDevice={editDevice} onUpdateWire={editWire} onDelete={remove} onDuplicate={duplicate} onUpdateProject={editProject} onClose={() => setPanel(null)} /></div>
    </div>
    <div className="ewq-resize-handle is-horizontal" role="separator" tabIndex={0} aria-label="Redimensionar altura da área de montagem" aria-orientation="horizontal" aria-valuemin={420} aria-valuemax={1200} aria-valuenow={Math.round(editorLayout.height ?? 520)} title="Arraste para ajustar a altura · Duplo clique restaura" onPointerDown={event => beginResize('height', event)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} onDoubleClick={() => resetResize('height')} onKeyDown={event => resizeWithKeyboard('height', event)}><span /></div>
    <div className="ewq-occupation"><span className="ewq-capacity-label"><CircuitBoard size={15} aria-hidden="true" /><span><strong>{used}</strong> de {total} módulos</span></span><progress max={total} value={used} aria-label="Ocupação do quadro" /><span className="ewq-free-modules">{total - used} livres</span><span className="ewq-device-count">{project.devices.length} componentes · {project.wires.length} fios</span><button className={noticeCounts.error ? 'has-errors' : noticeCounts.warning ? 'has-warnings' : ''} onClick={() => showDetails('warnings')} aria-label={`${noticeCounts.error} erros, ${noticeCounts.warning} alertas e ${noticeCounts.info} pendências`}><ShieldAlert size={15} aria-hidden="true" /> {noticeCounts.error ? `${noticeCounts.error} erro${noticeCounts.error === 1 ? '' : 's'}` : noticeCounts.warning ? `${noticeCounts.warning} alerta${noticeCounts.warning === 1 ? '' : 's'}` : `${noticeCounts.info} pendência${noticeCounts.info === 1 ? '' : 's'}`}</button></div>
    <div className="ewq-details" ref={detailsRef}>
    <div className="ewq-details-bar"><div className="ewq-bottom-tabs" role="tablist" aria-label="Informações do projeto" onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')); const current = tabs.indexOf(document.activeElement as HTMLButtonElement); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; tabs[next].focus(); tabs[next].click(); }}>{([['circuits', 'Circuitos', Cable], ['materials', 'Materiais', Boxes], ['warnings', 'Verificações', ShieldAlert], ['history', 'Histórico', History]] as const).map(([id, label, Icon]) => <button key={id} role="tab" id={`ewq-tab-${id}`} tabIndex={bottom === id ? 0 : -1} aria-selected={bottom === id} aria-controls="ewq-tabpanel" onClick={() => { setBottom(id); setDetailsOpen(true); }}><Icon size={16} aria-hidden="true" /> {label}{id === 'circuits' && <span>{project.circuits.length}</span>}</button>)}</div><button className="ewq-icon ewq-details-toggle" aria-label={detailsOpen ? 'Recolher detalhes do projeto' : 'Expandir detalhes do projeto'} aria-expanded={detailsOpen} aria-controls="ewq-tabpanel" onClick={() => setDetailsOpen(!detailsOpen)}><ChevronDown size={18} /></button></div>
    <div id="ewq-tabpanel" role="tabpanel" aria-labelledby={`ewq-tab-${bottom}`} hidden={!detailsOpen}>
      {bottom === 'circuits' && <CircuitsPanel project={project} onUpdateCircuit={editCircuit} onAddCircuit={addCircuit} onDeleteCircuit={id => commit({ ...project, circuits: project.circuits.filter(c => c.id !== id), devices: project.devices.map(d => d.circuitId === id ? { ...d, circuitId: null } : d) }, 'Excluir circuito')} onSelectDevice={id => { setSelection({ devices: [id], wire: null }); setPanel('properties'); }} onUpdateDevice={editDevice} />}
      {bottom === 'materials' && <MaterialsPanel project={project} onChange={materials => commit({ ...project, materials }, 'Editar materiais')} onExport={() => void exportFile('csv')} />}
      {bottom === 'warnings' && <section className="ewq-bottom-panel"><header className="ewq-verification-header"><div><h3>Verificações da montagem visual</h3><p>Erros impedem uma representação confiável; alertas pedem revisão; pendências são dados que ainda podem ser preenchidos. Não verifica conformidade elétrica.</p></div><div className="ewq-verification-summary" aria-live="polite" aria-atomic="true"><span className="is-error"><strong>{noticeCounts.error}</strong> Erros</span><span className="is-warning"><strong>{noticeCounts.warning}</strong> Alertas</span><span className="is-info"><strong>{noticeCounts.info}</strong> Pendências</span></div></header><ul className="ewq-warnings">{orderedNotices.length ? orderedNotices.map(w => <li key={w.id} className={`is-${w.severity}`}>{w.severity === 'error' ? <CircleAlert size={16} aria-hidden="true" /> : w.severity === 'warning' ? <TriangleAlert size={16} aria-hidden="true" /> : <Info size={16} aria-hidden="true" />}<div><span className="ewq-warning-level">{w.severity === 'error' ? 'Erro' : w.severity === 'warning' ? 'Alerta' : 'Pendente'}</span><button onClick={() => { if (w.circuitId) { showCircuit(w.circuitId); return; } setSelection({ devices: w.deviceId ? [w.deviceId] : [], wire: w.wireId ?? null }); setPanel('properties'); }}>{w.message}</button></div></li>) : <li className="is-clear"><Check size={16} aria-hidden="true" /> Nenhuma pendência gráfica encontrada.</li>}</ul></section>}
      {bottom === 'history' && <section className="ewq-bottom-panel"><header><div><h3>Histórico desta sessão</h3><p>Até 80 etapas. Desfazer e refazer restauram componentes, circuitos e conexões juntos.</p></div></header><ol className="ewq-history">{[...history.past, history.present].map((step, i) => <li key={i}><span>{String(i + 1).padStart(2, '0')}</span>{step.label}{i === history.past.length && <strong>Atual</strong>}</li>)}</ol></section>}
    </div>
    </div>
    </div>
    <footer className="ewq-technical-note"><ShieldAlert size={17} /><p>{PRELIMINARY_NOTICE}</p><button className="ewq-button" disabled={exporting || !project.circuits.length} onClick={() => void exportFile('labels')}><Tags size={15} /> Etiquetas</button></footer>
    {context && <><div className="ewq-context-dismiss" onClick={() => setContext(null)} /><div ref={contextRef} className="ewq-menu ewq-context" role="menu" aria-label="Ações da seleção" style={{ left: Math.max(8, Math.min(context.x, window.innerWidth - 200)), top: Math.max(8, Math.min(context.y, window.innerHeight - 160)) }} onKeyDown={event => { if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')); const current = items.indexOf(document.activeElement as HTMLButtonElement); const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items[next]?.focus(); }}><button role="menuitem" onClick={() => { copy(); setContext(null); }}>Copiar <small>Ctrl+C</small></button><button role="menuitem" onClick={() => { duplicate(); setContext(null); }}>Duplicar</button><button role="menuitem" onClick={() => { paste(); setContext(null); }}>Colar <small>Ctrl+V</small></button><button role="menuitem" onClick={remove}>Excluir <small>Delete</small></button></div></>}
    {(dialog === 'new' || dialog === 'auto') && <ProjectDialog automatic={dialog === 'auto'} onCreate={open} onClose={() => setDialog(null)} />}
    {dialog === 'projects' && <Modal title="Seus projetos" description="Salvos neste navegador e nesta conta. Exporte o JSON para mover um projeto entre dispositivos." onClose={() => setDialog(null)} footer={<><button className="btn-secondary" onClick={() => importInput.current?.click()}>Importar JSON</button><button className="btn-secondary" onClick={() => { setCopyName(`${project.name} — cópia`); setDialog('saveAs'); }}><Copy size={15} /> Salvar como</button><button className="btn-primary" onClick={() => setDialog('new')}>Novo projeto</button></>}><div className="ewq-project-list">{library.length ? library.map(p => <div key={p.id}><button onClick={() => open(p)}><FolderOpen size={20} /><span><strong>{p.name}</strong><small>{p.devices.length} dispositivos · {p.rails * p.modulesPerRail} módulos</small></span></button><button className="ewq-icon" aria-label={`Excluir projeto ${p.name}`} onClick={() => { if (!window.confirm(`Excluir “${p.name}” deste navegador?`)) return; const remaining = libraryRef.current.filter(q => q.id !== p.id); const next = p.id === project.id ? remaining[0] ?? emptyProject() : project; try { saveProjects(localStorage, usuarioId, remaining, next.id); libraryRef.current = remaining; setLibrary(remaining); if (p.id === project.id) { dispatch({ type: 'reset', project: next }); setSelection(NO_SELECTION); setWireStart(null); } } catch { setMessage('Não foi possível excluir o projeto.'); } }}><Trash2 size={16} /></button></div>) : <p>O projeto atual será salvo automaticamente. Você também pode importar um JSON.</p>}</div></Modal>}
    {dialog === 'saveAs' && <Modal title="Salvar projeto como" onClose={() => setDialog(null)} footer={<><button className="btn-secondary" onClick={() => setDialog(null)}>Cancelar</button><button className="btn-primary" disabled={!copyName.trim()} onClick={() => open({ ...structuredClone(project), id: crypto.randomUUID(), name: copyName.trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })}>Salvar cópia</button></>}><label className="ewq-dialog-form">Nome da cópia<input value={copyName} maxLength={100} onChange={e => setCopyName(e.target.value)} /></label></Modal>}
    {dialog === 'help' && <Modal title="Do quadro vazio à apresentação" onClose={() => setDialog(null)} footer={<button className="btn-primary" onClick={() => { dismissWelcome(); setDialog(null); }}>Começar a montar</button>}><ol className="ewq-tutorial"><li><strong>1. Escolha seu quadro</strong><p>Use Novo para definir alimentação, módulos DIN e tamanho da caixa.</p></li><li><strong>2. Adicione os dispositivos</strong><p>Arraste da biblioteca ou clique no item. Arraste ou use as setas para mover; Shift seleciona vários. As propriedades também permitem informar a posição.</p></li><li><strong>3. Crie os circuitos</strong><p>Associe disjuntor e DR pela tabela. Informe a carga separadamente para explorar a distribuição entre fases.</p></li><li><strong>4. Faça e modele as conexões</strong><p>Ative Passar fios ({shortcuts.wire}), escolha condutor/bitola e clique nos terminais. Depois selecione um fio para arrastar segmentos e dobras; Shift ajusta fino, Alt ignora o encaixe magnético e duplo clique remove uma dobra.</p></li><li><strong>5. Organize e apresente</strong><p>Recalcular fios refaz os trajetos automáticos. Em Exportar, use Apresentação final para gerar uma prancha diagramada ou PDF completo para documentação.</p></li></ol><p className="ewq-notice">Setas movem a seleção · Shift+F10 abre as ações · Ctrl+Z desfaz · Ctrl+Y refaz · Ctrl+C/Ctrl+V copia e cola · Delete exclui · Ctrl+roda ajusta zoom · {shortcuts.pan} move a vista. A demonstração contém valores ilustrativos; não os use como dimensionamento.</p></Modal>}
    <input ref={importInput} type="file" accept=".json" hidden onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { if (file.size > 5_000_000) throw new Error('O limite é 5 MB.'); const imported = parseProjectFile(await file.text()); open({ ...imported, id: crypto.randomUUID(), name: `${imported.name} — importado` }); } catch (err) { setMessage(err instanceof Error ? err.message : 'Falha ao importar.'); setDialog(null); } finally { e.target.value = ''; } }} />
  </div>;
}
