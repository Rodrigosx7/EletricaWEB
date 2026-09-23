import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDownToLine, ArrowLeft, Boxes, Cable, Check, ChevronDown, CircleAlert, CircuitBoard, Copy, Eye, FolderOpen, Hand, HelpCircle, History, Info, Keyboard, Layers3, MousePointer2, Plus, Presentation, Redo2, Route, Save, Search, Settings2, ShieldAlert, Sparkles, Tags, Trash2, TriangleAlert, Undo2, X } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import BoardCanvas from '../canvas/BoardCanvas';
import ComponentLibrary from '../components/ComponentLibrary';
import PropertiesPanel from '../components/PropertiesPanel';
import MaterialsPanel from '../components/MaterialsPanel';
import CircuitsPanel from '../circuits/CircuitsPanel';
import ConnectionMapPanel from '../circuits/ConnectionMapPanel';
import { circuitConnectionMap } from '../circuits/connectionMap';
import ProjectDialog from '../projects/ProjectDialog';
import { initialHistory, historyReducer } from './history';
import { copyDevices, pasteDevices, type QdcClipboard } from './clipboard';
import CommandPalette from './CommandPalette';
import type { EditorCommand } from './commandSearch';
import LayerPanel from './LayerPanel';
import { canEditLayer, DEFAULT_EDITOR_LAYERS, type EditorLayers, type LayerFocus, type LayerId } from './layers';
import { addDevice, circuitForOutputTerminal, connect, deleteSelection, fits, moveDeviceOnPlane, moveDevices, organize, prepareCircuitOutputs, removeCircuitOutput, rerouteWires, updateCircuit, updateDevice, validateProject } from './operations';
import { demoProject, emptyProject } from '../projects/factory';
import { loadProjects, parseProjectFile, saveProjects } from '../projects/storage';
import { CloudConflictError, deleteCloudProject, insertCloudProject, loadCloudProjects, updateCloudProject } from '../projects/cloud';
import { reconcileProjects } from '../projects/sync';
import { warnings } from '../circuits/analysis';
import { buildTerminals, CATALOG } from '../electrical-components/catalog';
import { boardSize, isRailMounted, routeWires } from '../wiring/routing';
import WireEditorPanel from '../wiring/WireEditorPanel';
import { changedWiresAfterMove } from '../wiring/wireEditing';
import { TERMINATION_OPTIONS, wireColorSwatch, WIRE_COLORS, WIRE_GAUGES } from '../wiring/options';
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
const RESERVED_SHORTCUTS = new Set(['Ctrl+Z', 'Ctrl+Shift+Z', 'Ctrl+Y', 'Ctrl+C', 'Ctrl+V', 'Ctrl+S', 'Ctrl+A', 'Ctrl+K', 'Ctrl+D', 'Meta+K', 'Meta+D', 'Delete', 'Backspace', 'Escape']);
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

export default function QdcEditor({ usuarioId, aoAlterar, aoSair }: { usuarioId: string; aoAlterar(alterado: boolean): void; aoSair(): void }) {
  const [initial] = useState(() => loadProjects(localStorage, usuarioId));
  const [library, setLibrary] = useState(initial.projects);
  const libraryRef = useRef(initial.projects);
  const [history, dispatch] = useReducer(historyReducer, initial.projects.find(p => p.id === initial.activeId) ?? initial.projects[0] ?? demoProject(), initialHistory);
  const project = history.present.project;
  const fingerprint = useMemo(() => JSON.stringify(project), [project]);
  const [savedFingerprint, setSavedFingerprint] = useState(() => JSON.stringify(history.present.project));
  const [cloudStatus, setCloudStatus] = useState<'loading' | 'ready' | 'saving' | 'offline' | 'conflict'>(initial.error ? 'offline' : 'loading');
  const cloudReady = useRef(false);
  const cloudVersions = useRef(new Map<string, string>());
  const cloudQueue = useRef(Promise.resolve());
  const pendingCloud = useRef(0);
  const cloudFailed = useRef(false);
  const [message, setMessage] = useState(initial.error || (initial.migrated ? 'Montagens anteriores carregadas. O original foi preservado.' : ''));
  const [selection, setSelection] = useState<Selection>(NO_SELECTION);
  const [tool, setTool] = useState<Tool>('select');
  const [mode, setMode] = useState<ViewMode>('realistic');
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [wireStart, setWireStart] = useState<{ componentId: string; terminalId: string } | null>(null);
  const [wireOptions, setWireOptions] = useState<WireOptions>({ conductorType: 'phase', color: WIRE_COLORS.phase[0].value, gauge: 2.5, termination: 'tubular' });
  const [dialog, setDialog] = useState<'new' | 'auto' | 'projects' | 'saveAs' | 'help' | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [layers, setLayers] = useState<EditorLayers>(DEFAULT_EDITOR_LAYERS);
  const [layersOpen, setLayersOpen] = useState(false);
  const [copyName, setCopyName] = useState('');
  const [bottom, setBottom] = useState<'circuits' | 'materials' | 'warnings' | 'history'>('circuits');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [panel, setPanel] = useState<'library' | 'properties' | null>(null);
  const [sideMode, setSideMode] = useState<'properties' | 'map' | 'wires'>('properties');
  const [mappedCircuitId, setMappedCircuitId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ candidate: Project; deviceIds: string[]; wireIds: string[]; baseFingerprint: string } | null>(null);
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
  const layersRef = useRef<HTMLDivElement>(null);
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
  const canEditComponents = canEditLayer(layers, 'components');
  const canEditWires = canEditLayer(layers, 'wires');
  const mappedCircuit = project.circuits.find(circuit => circuit.id === mappedCircuitId);
  const connectionMap = useMemo(() => sideMode === 'map' && mappedCircuit ? circuitConnectionMap(project, mappedCircuit) : null, [project, mappedCircuit, sideMode]);

  function changeLayers(next: EditorLayers) {
    setLayers(next);
    if ((selection.devices.length && !canEditLayer(next, 'components')) || (selection.wire && !canEditLayer(next, 'wires'))) setSelection(NO_SELECTION);
    if (!canEditLayer(next, 'wires') || !next.components.visible) { setWireStart(null); if (tool === 'wire') setTool('select'); }
    setContext(null);
  }
  function focusLayer(focus: LayerFocus) { changeLayers({ ...layers, focus }); }
  function toggleLayer(layer: LayerId, setting: 'visible' | 'locked') {
    changeLayers({ ...layers, [layer]: { ...layers[layer], [setting]: !layers[layer][setting] } });
  }
  function closeLayers() { layersRef.current?.querySelector<HTMLButtonElement>('.ewq-layer-trigger')?.focus(); setLayersOpen(false); }

  function closeShortcutMenu() {
    setShortcutsOpen(false); setRecordingShortcut(null); setShortcutDraft(null); setShortcutError('');
  }

  function enqueueCloud(operation: () => Promise<void>) {
    if (!cloudReady.current) return;
    pendingCloud.current++;
    setCloudStatus('saving');
    cloudQueue.current = cloudQueue.current.then(operation).catch(error => {
      cloudFailed.current = true;
      setCloudStatus(error instanceof CloudConflictError ? 'conflict' : 'offline');
      setMessage(error instanceof CloudConflictError ? error.message : 'Salvo neste navegador, mas a nuvem não confirmou. Reabra o montador para tentar sincronizar.');
    }).then(() => {
      pendingCloud.current--;
      if (!pendingCloud.current && !cloudFailed.current) setCloudStatus('ready');
    });
  }

  function uploadProject(next: Project) {
    enqueueCloud(async () => {
      const version = cloudVersions.current.get(next.id);
      const updatedAt = version
        ? await updateCloudProject(usuarioId, next, version)
        : await insertCloudProject(usuarioId, next);
      cloudVersions.current.set(next.id, updatedAt);
    });
  }

  useEffect(() => {
    if (initial.error) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let cancelled = false;
    (async () => {
      try {
        const remote = await loadCloudProjects(usuarioId, controller.signal);
        if (cancelled) return;
        const merged = reconcileProjects(initial.projects, remote.map(item => item.project), initial.activeId);
        // The complete merged library is stored locally before any cloud write.
        // A failed upload can therefore be retried on the next open without losing edits.
        if (merged.projects.length) saveProjects(localStorage, usuarioId, merged.projects, merged.activeId!);
        if (cancelled) return;
        libraryRef.current = merged.projects;
        setLibrary(merged.projects);
        cloudVersions.current = new Map(remote.map(item => [item.project.id, item.updatedAt]));
        const active = merged.projects.find(item => item.id === merged.activeId);
        if (active) {
          dispatch({ type: 'reset', project: active });
          setSavedFingerprint(JSON.stringify(active));
        }
        cloudReady.current = true;
        setCloudStatus('ready');
        if (merged.conflicts) setMessage(`${merged.conflicts} projeto(s) com versões diferentes: ambas foram preservadas como cópia local.`);
        for (const item of merged.uploads) uploadProject(item);
      } catch {
        if (!cancelled) {
          cloudReady.current = false;
          setCloudStatus('offline');
          setMessage('Não foi possível sincronizar com a nuvem. Seus projetos locais permanecem disponíveis.');
        }
      } finally { window.clearTimeout(timeout); }
    })();
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timeout); };
    // Bootstrapping reads the initial local snapshot exactly once for this editor mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId]);

  function persist(next: Project, announce = false): boolean {
    if (initial.error) { setMessage(initial.error); return false; }
    const projects = [next, ...libraryRef.current.filter(p => p.id !== next.id)];
    try {
      saveProjects(localStorage, usuarioId, projects, next.id);
      libraryRef.current = projects; setLibrary(projects); setSavedFingerprint(JSON.stringify(next));
      uploadProject(next);
      if (announce) setMessage(cloudReady.current ? 'Projeto salvo neste navegador. Sincronização com a nuvem em andamento.' : 'Projeto salvo neste navegador. Exporte o JSON para guardar uma cópia editável.');
      return true;
    } catch { setMessage('Não foi possível salvar. Verifique o espaço do navegador e exporte o projeto em JSON.'); return false; }
  }
  useEffect(() => {
    if (!dirty || initial.error) return;
    const timer = window.setTimeout(() => persist(project), 750);
    return () => window.clearTimeout(timer);
    // persist intentionally captures only this project snapshot; libraryRef holds the latest library.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, dirty, initial.error, usuarioId]);
  useEffect(() => { aoAlterar(dirty || cloudStatus === 'saving'); }, [dirty, cloudStatus, aoAlterar]);
  useEffect(() => {
    if (!dirty && cloudStatus !== 'saving') return;
    const prevent = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty, cloudStatus]);
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
    if (!layersOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !layersRef.current?.contains(event.target)) setLayersOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); closeLayers(); }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown, true); };
  }, [layersOpen]);
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
  function mapCircuit(id: string) {
    setPendingMove(null);
    setMappedCircuitId(id);
    setSideMode('map');
    setPanel('properties');
  }
  function openProperties() {
    setPendingMove(null);
    setSideMode('properties');
    setMappedCircuitId(null);
    setPanel('properties');
  }
  function openWireEditor() {
    setSideMode('wires');
    setPanel('properties');
    setTool('select');
    setWireStart(null);
  }
  function selectMappedWire(id: string) {
    const wire = project.wires.find(item => item.id === id);
    if (!wire) return;
    setSelection({ devices: [], wire: id });
    const middle = wire.path[Math.floor(wire.path.length / 2)];
    if (middle) {
      const { width, height } = boardSize(project);
      setViewport(current => ({ ...current, x: width / 2 - middle.x * current.zoom, y: height / 2 - middle.y * current.zoom }));
    }
  }

  function commit(next: Project, label: string): boolean {
    if (!validateProject(next)) { setMessage('A alteração gerou dados inválidos. O quadro anterior foi preservado.'); return false; }
    dispatch({ type: 'commit', project: next, label }); setPendingMove(null); setMessage('');
    return true;
  }
  function moveWithWirePreview(operation: () => Project, ids: string[], preview: boolean, label: string) {
    try {
      const next = operation();
      if (next.wires.some(wire => !wire.path.length && project.wires.some(previous => previous.id === wire.id && previous.path.length))) {
        throw new Error('O movimento deixaria um fio sem trajeto. Ajuste a posição ou o caminho antes de aplicar.');
      }
      const wireIds = changedWiresAfterMove(project, next);
      if (preview && sideMode === 'wires' && wireIds.length) {
        setPendingMove({ candidate: next, deviceIds: ids, wireIds, baseFingerprint: fingerprint });
        setMessage('');
      } else commit(next, label);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Não foi possível mover o componente.'); }
  }
  function run(operation: () => Project, label: string) {
    try { commit(operation(), label); } catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível concluir a alteração.'); }
  }
  function remove() {
    if (!selection.devices.length && !selection.wire) return;
    if ((selection.devices.length && !canEditComponents) || (selection.wire && !canEditWires)) { setMessage('Desbloqueie a camada selecionada antes de excluir.'); return; }
    run(() => deleteSelection(project, selection), 'Excluir seleção'); setSelection(NO_SELECTION); setWireStart(null); setContext(null);
  }
  function copy() { if (!selection.devices.length) return; clipboard.current = copyDevices(project, selection.devices); setMessage(`${selection.devices.length} componente(s) copiado(s). Use Ctrl+V para colar.`); }
  function paste() {
    if (!canEditComponents) { setMessage('Desbloqueie e mostre a camada de componentes para colar.'); return; }
    if (!clipboard.current?.devices.length) { setMessage('Selecione e copie um componente primeiro.'); return; }
    try { const result = pasteDevices(project, clipboard.current); commit(result.project, 'Colar componentes'); setSelection({ devices: result.ids, wire: null }); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível colar.'); }
  }
  function duplicate() { if (!selection.devices.length || !canEditComponents) return; clipboard.current = copyDevices(project, selection.devices); paste(); }
  function undo() { setPendingMove(null); dispatch({ type: 'undo' }); setSelection(NO_SELECTION); setWireStart(null); }
  function redo() { setPendingMove(null); dispatch({ type: 'redo' }); setSelection(NO_SELECTION); setWireStart(null); }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]') || paletteOpen || dialog || shortcutsOpen) return;
      const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
      if (mod && key === 'k') { e.preventDefault(); setPaletteOpen(true); setExportMenu(false); setContext(null); }
      else if (mod && key === 'd') { e.preventDefault(); if (selection.devices.length) duplicate(); }
      else if (mod && key === 'z') { e.preventDefault(); if (pendingMove) setPendingMove(null); else if (e.shiftKey) redo(); else undo(); }
      else if (mod && key === 'y') { e.preventDefault(); redo(); }
      else if (mod && key === 'c') { e.preventDefault(); copy(); }
      else if (mod && key === 'v') { e.preventDefault(); paste(); }
      else if (mod && key === 's') { e.preventDefault(); if (pendingMove) setMessage('Aplique ou cancele a prévia antes de salvar.'); else persist(project, true); }
      else if (mod && key === 'a' && canEditComponents) { e.preventDefault(); setSelection({ devices: project.devices.map(d => d.id), wire: null }); }
      else if (key === 'delete' || key === 'backspace') { e.preventDefault(); remove(); }
      else if (key === 'escape') { if (pendingMove) { e.preventDefault(); setPendingMove(null); return; } setWireStart(null); setSelection(NO_SELECTION); setContext(null); setExportMenu(false); setPanel(null); }
      else {
        const pressedShortcut = shortcutFromEvent(e);
        if (pressedShortcut === shortcuts.select) { e.preventDefault(); setTool('select'); setWireStart(null); }
        else if (pressedShortcut === shortcuts.wire) { e.preventDefault(); if (canEditWires && layers.components.visible) setTool('wire'); }
        else if (pressedShortcut === shortcuts.pan) { e.preventDefault(); setTool('pan'); setWireStart(null); }
      }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  function open(next: Project) {
    if (dirty && !persist(project) && !window.confirm('O projeto atual não foi salvo. Abrir outro e descartar as alterações?')) return;
    dispatch({ type: 'reset', project: next }); setPendingMove(null); setSelection(NO_SELECTION); setWireStart(null); setLayers(DEFAULT_EDITOR_LAYERS); setLayersOpen(false); setDialog(null); setViewport({ x: 0, y: 0, zoom: 1 }); setMessage('');
  }
  function deleteSavedProject(target: Project) {
    if (!cloudReady.current) { setMessage('Conecte-se à nuvem antes de excluir. Assim o projeto não reaparecerá no próximo acesso.'); return; }
    if (!window.confirm(`Excluir “${target.name}” deste navegador e da nuvem?`)) return;
    if (target.id === project.id && dirty && !persist(project)) return;
    enqueueCloud(async () => {
      const version = cloudVersions.current.get(target.id);
      if (version) await deleteCloudProject(usuarioId, target.id, version);
      cloudVersions.current.delete(target.id);
      const remaining = libraryRef.current.filter(item => item.id !== target.id);
      const next = target.id === project.id ? remaining[0] ?? emptyProject() : project;
      saveProjects(localStorage, usuarioId, remaining, next.id);
      libraryRef.current = remaining;
      setLibrary(remaining);
      if (target.id === project.id) {
        dispatch({ type: 'reset', project: next });
        setSavedFingerprint(JSON.stringify(next));
        setSelection(NO_SELECTION); setWireStart(null);
      }
    });
  }
  function add(type: string, position?: { rail: number; slot: number }) {
    if (!canEditComponents) { setMessage('Desbloqueie e mostre a camada de componentes para adicionar.'); return; }
    try { const next = addDevice(project, type, position); commit(next, 'Adicionar dispositivo'); setSelection({ devices: [next.devices.at(-1)!.id], wire: null }); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível adicionar.'); }
  }
  function terminal(componentId: string, terminalId: string) {
    if (tool !== 'wire' || !canEditWires || !layers.components.visible) return;
    if (!wireStart) {
      const device = project.devices.find(item => item.id === componentId);
      const terminal = device?.terminals.find(item => item.id === terminalId);
      if (device?.type === 'conduit-entry' && terminal && terminal.kind !== 'control') {
        const conductorType = terminal.kind === 'N' ? 'neutral' : terminal.kind === 'PE' ? 'earth' : 'phase';
        const circuit = circuitForOutputTerminal(project, terminalId);
        setWireOptions(current => ({ ...current, conductorType,
          color: conductorType === 'phase' ? circuit?.color ?? WIRE_COLORS.phase[0].value : WIRE_COLORS[conductorType][0].value,
          gauge: circuit?.cableGauge ?? null }));
      }
      setWireStart({ componentId, terminalId }); return;
    }
    try { commit(connect(project, wireStart, { componentId, terminalId }, wireOptions), 'Conectar terminais'); setWireStart(null); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível conectar.'); }
  }
  function editDevice(id: string, patch: Partial<Device>) { if (canEditComponents) run(() => updateDevice(project, id, patch), 'Editar componente'); else setMessage('Desbloqueie a camada de componentes para editar.'); }
  function editCircuit(id: string, patch: Partial<Circuit>) { run(() => updateCircuit(project, id, patch), 'Editar circuito'); }
  function editProject(patch: Partial<Project>) {
    run(() => {
      let devices = project.devices;
      let wires = project.wires;
      if (patch.supply && patch.supply !== project.supply) {
        const phases = patch.supply === 'tri' ? 3 : patch.supply === 'bi' ? 2 : 1;
        const entries = new Map(project.devices.filter(device => device.type === 'power-entry').map(device => [device.id, device]));
        const terminalMaps = new Map<string, Map<string, string>>();
        devices = project.devices.map(device => {
          if (device.type !== 'power-entry') return device;
          const terminals = buildTerminals('power-entry', phases + 2);
          const mapping = new Map<string, string>();
          for (const oldTerminal of device.terminals) {
            const nextTerminal = oldTerminal.kind === 'N' || oldTerminal.kind === 'PE'
              ? terminals.find(terminal => terminal.kind === oldTerminal.kind)
              : oldTerminal.index < phases ? terminals.find(terminal => terminal.index === oldTerminal.index) : undefined;
            if (nextTerminal) mapping.set(oldTerminal.id, nextTerminal.id);
          }
          terminalMaps.set(device.id, mapping);
          return { ...device, poles: phases + 2, terminals };
        });
        wires = project.wires.flatMap(wire => {
          const sourceMap = terminalMaps.get(wire.sourceComponent), targetMap = terminalMaps.get(wire.targetComponent);
          const sourceTerminal = sourceMap ? sourceMap.get(wire.sourceTerminal) : wire.sourceTerminal;
          const targetTerminal = targetMap ? targetMap.get(wire.targetTerminal) : wire.targetTerminal;
          if ((entries.has(wire.sourceComponent) && !sourceTerminal) || (entries.has(wire.targetComponent) && !targetTerminal)) return [];
          return [{ ...wire, sourceTerminal: sourceTerminal!, targetTerminal: targetTerminal! }];
        });
      }
      const next = { ...project, ...patch, devices, wires };
      if (!next.devices.every(d => fits(next, d))) throw new Error('O tamanho escolhido não acomoda os dispositivos atuais. Mova-os antes de reduzir a caixa.');
      return routeWires(next);
    }, 'Configurar quadro');
  }
  function editWire(id: string, patch: Partial<Wire>) {
    if (canEditWires) run(() => routeWires({ ...project, wires: project.wires.map(w => w.id === id ? { ...w, ...patch } : w) }), 'Editar fio');
    else setMessage('Desbloqueie a camada de fios para editar.');
  }
  function organizeCurrentProject() {
    if (!canEditComponents || !canEditWires) { setMessage('Mostre e desbloqueie as duas camadas para organizar o quadro.'); return; }
    if (!project.devices.some(isRailMounted)) { setMessage('Adicione componentes ao trilho antes de organizar o quadro.'); return; }
    try {
      if (!commit(organize(project), 'Organização inteligente')) return;
      setSelection(NO_SELECTION); setWireStart(null); setContext(null);
      setMessage('Quadro organizado por função: proteção, distribuição, circuitos e automação. Os fios foram recalculados.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível organizar o quadro.'); }
  }
  function addCircuit() {
    if (!canEditComponents) { setMessage('Desbloqueie a camada de componentes para adicionar circuitos e saídas.'); return; }
    const circuit: Circuit = { id: crypto.randomUUID(), number: Math.max(0, ...project.circuits.map(c => c.number)) + 1, name: 'Novo circuito', phase: 'R', breakerId: null, cableGauge: null, load: null, loadUnit: 'W', voltage: project.voltage, powerFactor: 1, drId: null, notes: '', color: '#e9b949' };
    run(() => prepareCircuitOutputs({ ...project, circuits: [...project.circuits, circuit] }), 'Adicionar circuito e saída');
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

  const commands: EditorCommand[] = [
    { id: 'tool-select', label: 'Selecionar componentes', group: 'Ferramentas', shortcut: shortcuts.select, featured: true, run: () => { setTool('select'); setWireStart(null); } },
    { id: 'tool-wire', label: 'Passar fios', group: 'Ferramentas', shortcut: shortcuts.wire, featured: true, disabled: !canEditWires || !layers.components.visible, run: () => { setTool('wire'); setWireStart(null); } },
    { id: 'tool-pan', label: 'Mover vista', group: 'Ferramentas', shortcut: shortcuts.pan, run: () => { setTool('pan'); setWireStart(null); } },
    { id: 'undo', label: 'Desfazer', group: 'Edição', shortcut: 'Ctrl+Z', featured: true, disabled: !history.past.length, run: undo },
    { id: 'redo', label: 'Refazer', group: 'Edição', shortcut: 'Ctrl+Y', disabled: !history.future.length, run: redo },
    { id: 'duplicate', label: 'Duplicar seleção', group: 'Edição', shortcut: 'Ctrl+D', featured: true, disabled: !selection.devices.length || !canEditComponents, run: duplicate },
    { id: 'copy', label: 'Copiar seleção', group: 'Edição', shortcut: 'Ctrl+C', disabled: !selection.devices.length, run: copy },
    { id: 'paste', label: 'Colar componentes', group: 'Edição', shortcut: 'Ctrl+V', disabled: !canEditComponents, run: paste },
    { id: 'delete', label: 'Excluir seleção', group: 'Edição', shortcut: 'Delete', disabled: !selection.devices.length && !selection.wire, run: remove },
    { id: 'organize', label: 'Organizar quadro', group: 'Montagem', description: 'Agrupar componentes por função', disabled: !canEditComponents || !canEditWires, run: organizeCurrentProject },
    { id: 'reroute', label: 'Recalcular fios', group: 'Montagem', description: 'Refazer os trajetos automáticos', disabled: !canEditWires, run: () => run(() => rerouteWires(project), 'Recalcular trajetos') },
    { id: 'add-circuit', label: 'Adicionar circuito', group: 'Montagem', featured: true, run: () => { addCircuit(); showDetails('circuits'); } },
    { id: 'prepare-outputs', label: 'Preparar saídas dos circuitos', group: 'Montagem', run: () => run(() => prepareCircuitOutputs(project), 'Preparar saídas dos circuitos') },
    { id: 'new', label: 'Novo projeto', group: 'Projeto', run: () => setDialog('new') },
    { id: 'open', label: 'Abrir meus projetos', group: 'Projeto', featured: true, run: () => setDialog('projects') },
    { id: 'save', label: 'Salvar projeto', group: 'Projeto', shortcut: 'Ctrl+S', featured: true, disabled: !!pendingMove, run: () => { persist(project, true); } },
    { id: 'export', label: 'Exportar projeto', group: 'Projeto', run: () => setExportMenu(true) },
    { id: 'circuits', label: 'Ver circuitos', group: 'Painéis', run: () => showDetails('circuits') },
    { id: 'materials', label: 'Ver materiais', group: 'Painéis', run: () => showDetails('materials') },
    { id: 'warnings', label: 'Ver verificações', group: 'Painéis', featured: true, run: () => showDetails('warnings') },
    { id: 'history', label: 'Ver histórico', group: 'Painéis', run: () => showDetails('history') },
    { id: 'properties', label: 'Abrir propriedades', group: 'Painéis', run: () => setPanel('properties') },
    { id: 'library', label: 'Abrir biblioteca', group: 'Painéis', run: () => setPanel('library') },
    { id: 'layers', label: 'Abrir camadas', group: 'Painéis', featured: true, run: () => setLayersOpen(true) },
    ...Object.entries(VIEW_LABELS).map(([id, label]) => ({ id: `view-${id}`, label: `Vista ${label}`, group: 'Visualização', run: () => setMode(id as ViewMode) })),
    ...CATALOG.map(item => ({ id: `add-${item.type}`, label: `Adicionar ${item.name}`, group: 'Componentes', description: item.category, keywords: item.description, featured: ['breaker-1p', 'rcd-2p', 'spd'].includes(item.type), disabled: !canEditComponents, run: () => add(item.type) })),
  ];

  if (cloudStatus === 'loading') return <div className="ewq-editor" role="status" aria-live="polite" style={{ padding: '2rem' }}>Carregando seus projetos e sincronizando a montagem…</div>;

  return <div className="ewq-editor ewq-dedicated">
    <header className="ewq-heading">
      <div className="ewq-brand"><button className="ewq-button ewq-exit" onClick={aoSair} title="Voltar ao painel"><ArrowLeft size={17} aria-hidden="true" /><span>Voltar ao painel</span></button><div className="ewq-heading-divider" aria-hidden="true" /><div><h1>Montagem de quadros</h1><p>Estúdio de projeto</p></div></div>
      <div className="ewq-heading-actions"><button className="ewq-button ewq-command-trigger" onClick={() => setPaletteOpen(true)} aria-keyshortcuts="Control+K Meta+K" title="Buscar ações e componentes (Ctrl+K)"><Search size={17} aria-hidden="true" /><span>Buscar ações</span><kbd>Ctrl K</kbd></button><button className="ewq-button ewq-quiet" onClick={() => setDialog('help')}><HelpCircle size={17} aria-hidden="true" /> Como montar</button></div>
    </header>
    <div className="ewq-studio">
    <div className="ewq-project-bar">
      <span className="ewq-project-symbol" aria-hidden="true"><CircuitBoard size={25} /></span>
      <div className="ewq-project-info"><button className="ewq-project-name" onClick={() => setDialog('projects')} title="Abrir meus projetos"><span>{project.name}</span><ChevronDown size={16} aria-hidden="true" /></button>
        <div className="ewq-project-meta"><span>{project.supply === 'mono' ? 'Monofásico' : project.supply === 'bi' ? 'Bifásico' : 'Trifásico'} · {project.voltage} V · {project.rails} trilhos</span><span className={`ewq-save-state${dirty || cloudStatus !== 'ready' ? ' is-pending' : ''}`}>{cloudStatus === 'offline' || cloudStatus === 'conflict' || initial.error ? <CircleAlert size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}{initial.error ? 'Armazenamento indisponível' : dirty ? 'Salvando…' : cloudStatus === 'saving' ? 'Sincronizando…' : cloudStatus === 'ready' ? library.some(item => item.id === project.id) ? 'Salvo neste navegador e na nuvem' : 'Novo projeto ainda não salvo' : cloudStatus === 'conflict' ? 'Conflito — salvo localmente' : 'Salvo apenas neste navegador'}</span></div>
      </div>
      <div className="ewq-bar-actions"><button className="ewq-button" onClick={() => setDialog('new')}><Plus size={16} aria-hidden="true" /> Novo</button><button className="ewq-button ewq-save-button" disabled={!!pendingMove} title={pendingMove ? 'Aplique ou cancele a prévia antes de salvar' : undefined} onClick={() => persist(project, true)}><Save size={16} aria-hidden="true" /> Salvar</button>
        <div className="ewq-export" ref={exportRef}><button className="ewq-button ewq-primary" disabled={exporting} onClick={() => setExportMenu(!exportMenu)} aria-expanded={exportMenu} aria-controls="ewq-export-options"><ArrowDownToLine size={16} aria-hidden="true" /> {exporting ? 'Gerando…' : 'Exportar'}<ChevronDown size={14} aria-hidden="true" /></button>
          {exportMenu && <div className="ewq-menu ewq-export-menu" id="ewq-export-options"><p className="ewq-menu-label">Leve seu projeto com você</p><button className="ewq-export-featured" onClick={() => void exportFile('presentation')}><span><Presentation size={18} aria-hidden="true" /><span><strong>Apresentação final</strong><small>PNG diagramado para o cliente</small></span></span><ArrowDownToLine size={14} aria-hidden="true" /></button>{[['png', 'Imagem simples PNG'], ['pdf', 'Projeto PDF completo'], ['json', 'Projeto editável JSON'], ['csv', 'Lista de materiais CSV'], ['labels', 'Etiquetas PDF'], ['print', 'Imprimir quadro']].map(([id, label]) => <button key={id} onClick={() => void exportFile(id)}>{label}<ArrowDownToLine size={14} aria-hidden="true" /></button>)}</div>}
        </div>
      </div>
    </div>
    {welcome && <div className="ewq-onboarding"><span className="ewq-onboarding-title">Comece por aqui</span><div className="ewq-steps"><button onClick={() => { setSelection(NO_SELECTION); setPanel('properties'); }}><span>1</span>Configure o quadro</button><button onClick={() => { setTool('select'); setWireStart(null); setPanel('library'); }}><span>2</span>Adicione componentes</button><button onClick={() => { setTool('wire'); setWireStart(null); setPanel(null); }}><span>3</span>Conecte os fios</button></div><button className="ewq-icon" aria-label="Dispensar introdução" onClick={dismissWelcome}><X size={16} /></button></div>}
    <div className="ewq-toolbar" aria-label="Ferramentas do editor">
      <div className="ewq-tool-group ewq-mode-tools">{([['select', MousePointer2, 'Selecionar'], ['wire', Cable, 'Passar fios'], ['pan', Hand, 'Mover vista']] as const).map(([id, Icon, label]) => <button key={id} className="ewq-tool" title={`${label} (${shortcuts[id]})`} aria-pressed={tool === id} disabled={id === 'wire' && (!canEditWires || !layers.components.visible)} onClick={() => { setTool(id); setWireStart(null); setPanel(null); }}><Icon size={17} aria-hidden="true" /><span>{label}</span><kbd>{shortcuts[id]}</kbd></button>)}<div className="ewq-shortcuts" ref={shortcutsRef}><button className="ewq-icon ewq-shortcuts-toggle" aria-label="Configurar atalhos das ferramentas" title="Configurar atalhos" aria-expanded={shortcutsOpen} aria-controls="ewq-shortcut-menu" onClick={() => shortcutsOpen ? closeShortcutMenu() : setShortcutsOpen(true)}><Keyboard size={17} /></button>{shortcutsOpen && <div id="ewq-shortcut-menu" className="ewq-shortcut-menu" role="dialog" aria-label="Configurar atalhos" onKeyDown={event => { if (event.key === 'Escape' && !recordingShortcut) { event.stopPropagation(); closeShortcutMenu(); } }}><header><div><strong>Atalhos das ferramentas</strong><span>Clique em um campo e pressione a tecla ou combinação desejada.</span></div><button className="ewq-icon" aria-label="Fechar atalhos" onClick={closeShortcutMenu}><X size={14} /></button></header>{([['select', 'Selecionar'], ['wire', 'Passar fios'], ['pan', 'Mover vista']] as const).map(([id, label]) => <div className="ewq-shortcut-row" key={id}><span>{label}</span><button type="button" className={`ewq-shortcut-capture${recordingShortcut === id ? ' is-recording' : ''}`} aria-label={`Definir atalho para ${label}. Atual: ${shortcuts[id]}`} aria-pressed={recordingShortcut === id} onClick={() => { setRecordingShortcut(id); setShortcutDraft(null); setShortcutError(''); }} onKeyDown={event => recordingShortcut === id && recordShortcut(id, event)} onKeyUp={event => finishModifierShortcut(id, event)}>{recordingShortcut === id ? shortcutDraft ? `${shortcutDraft} + …` : 'Pressione…' : shortcuts[id]}</button></div>)}{shortcutError && <p className="ewq-shortcut-error" role="alert">{shortcutError}</p>}<p className="ewq-shortcut-tip">Esc cancela a gravação. Atalhos do editor, como Ctrl+S, permanecem reservados.</p><button className="ewq-shortcuts-reset" onClick={() => { setShortcuts(DEFAULT_TOOL_SHORTCUTS); setRecordingShortcut(null); setShortcutDraft(null); setShortcutError(''); }}>Restaurar V, W e H</button></div>}</div></div>
      <div className="ewq-layer-anchor" ref={layersRef}><button className="ewq-button ewq-layer-trigger" type="button" aria-expanded={layersOpen} aria-controls="ewq-layer-controls" onClick={() => setLayersOpen(value => !value)}><Layers3 size={17} aria-hidden="true" /> Camadas</button>{layersOpen && <div id="ewq-layer-controls"><LayerPanel layers={layers} counts={{ components: project.devices.length, wires: project.wires.length }} onFocus={focusLayer} onToggle={toggleLayer} onClose={closeLayers} /></div>}</div>
      <button className="ewq-button ewq-map-trigger" type="button" aria-label="Abrir mapa de conexões" aria-pressed={sideMode === 'map'} onClick={() => { setPendingMove(null); setSideMode('map'); setPanel('properties'); }}><Route size={17} aria-hidden="true" /> Mapa</button>
      <button className="ewq-button ewq-wires-trigger" type="button" aria-label="Abrir editor de fios" aria-pressed={sideMode === 'wires'} onClick={openWireEditor}><Cable size={17} aria-hidden="true" /> Fios</button>
      <div className="ewq-tool-group"><button className="ewq-icon" aria-label="Desfazer (Ctrl+Z)" disabled={!history.past.length} onClick={undo}><Undo2 size={17} /></button><button className="ewq-icon" aria-label="Refazer (Ctrl+Y)" disabled={!history.future.length} onClick={redo}><Redo2 size={17} /></button></div>
      <button className="ewq-button ewq-organize" title="Recalcular os trajetos sem mover os componentes" disabled={!canEditWires} onClick={() => run(() => rerouteWires(project), 'Recalcular trajetos')}><Cable size={16} aria-hidden="true" /> Recalcular fios</button>
      <button className="ewq-button ewq-smart-organize" aria-label="Organizar quadro atual de forma inteligente" title="Agrupa componentes por função e preserva trajetos manuais quando ainda couberem" disabled={!canEditComponents || !canEditWires} onClick={organizeCurrentProject}><Boxes size={16} aria-hidden="true" /><span className="ewq-organize-long">Organizar quadro</span><span className="ewq-organize-short">Organizar</span></button>
      <button className="ewq-button ewq-auto" aria-label="Montagem automática" onClick={() => setDialog('auto')}><Sparkles size={16} aria-hidden="true" /><span className="ewq-auto-long">Montagem automática</span><span className="ewq-auto-short">Automático</span></button>
      <div className="ewq-responsive-tools"><button className="ewq-button ewq-library-toggle" aria-label="Abrir biblioteca de componentes" aria-expanded={panel === 'library'} onClick={() => setPanel(panel === 'library' ? null : 'library')}><Boxes size={17} aria-hidden="true" /> Componentes</button><button className="ewq-button ewq-properties-toggle" aria-label="Abrir propriedades" aria-expanded={panel === 'properties' && sideMode === 'properties'} onClick={() => panel === 'properties' && sideMode === 'properties' ? setPanel(null) : openProperties()}><Settings2 size={17} aria-hidden="true" /> Propriedades</button></div>
    </div>
    {tool === 'wire' && <div className="ewq-wire-controls"><strong>{wireStart ? '2. Escolha o terminal de destino' : '1. Escolha o terminal de origem'}</strong><label>Condutor<select value={wireOptions.conductorType} onChange={e => { const conductorType = e.target.value as WireOptions['conductorType']; setWireOptions({ ...wireOptions, conductorType, color: WIRE_COLORS[conductorType][0].value }); }}><option value="phase">Fase</option><option value="neutral">Neutro</option><option value="earth">Terra / PE</option><option value="return">Retorno</option></select></label><label>Bitola<select value={wireOptions.gauge ?? ''} onChange={e => setWireOptions({ ...wireOptions, gauge: e.target.value ? Number(e.target.value) : null })}><option value="">A definir</option>{WIRE_GAUGES.map(gauge => <option key={gauge} value={gauge}>{gauge} mm²</option>)}</select></label><fieldset className="ewq-wire-color-picker"><legend>Cor</legend>{WIRE_COLORS[wireOptions.conductorType].map(color => <button key={color.value} type="button" className={wireOptions.color === color.value ? 'is-active' : ''} aria-label={color.label} aria-pressed={wireOptions.color === color.value} title={color.label} onClick={() => setWireOptions({ ...wireOptions, color: color.value })}><span style={{ background: wireColorSwatch(color.value) }} /></button>)}</fieldset><label>Terminal<select value={wireOptions.termination} onChange={e => setWireOptions({ ...wireOptions, termination: e.target.value as WireOptions['termination'] })}>{TERMINATION_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button className="ewq-button" onClick={() => { setTool('select'); setWireStart(null); }}>Concluir</button></div>}
    {message && <div className="ewq-feedback" role="status"><span>{message}</span><button className="ewq-icon" aria-label="Fechar mensagem" onClick={() => setMessage('')}><X size={14} /></button></div>}
    <div ref={workbenchRef} className={`ewq-workbench ewq-show-${panel ?? 'canvas'}${editorLayout.height !== null ? ' ewq-height-custom' : ''}`} style={workbenchStyle}>
      <div className="ewq-library-slot"><ComponentLibrary storageKey={`qdc-component-library:${usuarioId}`} onAdd={type => { add(type); setPanel(null); }} onClose={() => setPanel(null)} /></div>
      <div className="ewq-resize-handle is-vertical is-library" role="separator" tabIndex={0} aria-label="Redimensionar biblioteca e área de montagem" aria-orientation="vertical" aria-valuemin={190} aria-valuemax={420} aria-valuenow={Math.round(editorLayout.libraryWidth)} title="Arraste para ajustar a largura · Duplo clique restaura" onPointerDown={event => beginResize('library', event)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} onDoubleClick={() => resetResize('library')} onKeyDown={event => resizeWithKeyboard('library', event)}><span /></div>
      <section className="ewq-canvas-panel" aria-label="Área de desenho do quadro"><div className="ewq-canvas-meta"><span><CircuitBoard size={16} aria-hidden="true" /> Área de montagem</span><div className="ewq-view-switch" role="group" aria-label="Modo de visualização"><Eye size={15} aria-hidden="true" />{Object.entries(VIEW_LABELS).map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id as ViewMode)}>{label}</button>)}</div><label className="ewq-view-label ewq-view-label-compact"><Eye size={15} aria-hidden="true" /><span className="sr-only">Modo de visualização</span><select aria-label="Modo de visualização" value={mode} onChange={e => setMode(e.target.value as ViewMode)}>{Object.entries(VIEW_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
        {selectionLabel && <button className="ewq-selection-chip" onClick={openProperties}><Settings2 size={15} aria-hidden="true" /><span>Editar: {selectionLabel}</span></button>}
        <BoardCanvas project={project} selection={selection} layers={layers} tool={tool} mode={mode} viewport={viewport} highlightedConnections={connectionMap} movePreview={pendingMove} onViewport={setViewport} onSelect={setSelection} onMove={(ids, r, s, preview) => { if (canEditComponents) moveWithWirePreview(() => moveDevices(project, ids, r, s), ids, !!preview, 'Mover dispositivos'); }} onMovePlane={(id, position, preview) => { if (canEditComponents) moveWithWirePreview(() => moveDeviceOnPlane(project, id, position), [id], !!preview, 'Mover entrada de energia'); }} onAdd={add} onTerminal={terminal} onWirePath={(id, path) => editWire(id, { path, manualPath: true })} wireStart={wireStart} wireOptions={wireOptions} onContextMenu={(x, y, id) => { if (!canEditComponents) return; if (id && !selection.devices.includes(id)) setSelection({ devices: [id], wire: null }); setContext({ x, y }); }} onMessage={setMessage} />
        {pendingMove && <div className="ewq-move-review" role="region" aria-label="Prévia dos fios após mover componentes"><div><strong>Prévia antes de mover</strong><span>{pendingMove.wireIds.length} {pendingMove.wireIds.length === 1 ? 'fio será ajustado' : 'fios serão ajustados'}. Linha azul tracejada: novo trajeto.</span></div><button type="button" onClick={() => setPendingMove(null)}>Cancelar</button><button type="button" className="is-primary" onClick={() => { if (pendingMove.baseFingerprint !== fingerprint) { setPendingMove(null); setMessage('O quadro mudou durante a prévia. Mova o componente novamente.'); return; } commit(pendingMove.candidate, 'Mover componentes e ajustar fios'); }}>Aplicar movimento</button></div>}
        <div className="ewq-canvas-footer"><span>{project.widthMm} × {project.heightMm} mm <span className="ewq-canvas-scale">· sem escala</span></span><span className="ewq-wire-legend" aria-label="Legenda dos condutores"><i className="is-phase" />Fase<i className="is-neutral" />Neutro<i className="is-earth" />PE</span></div>
      </section>
      <div className="ewq-resize-handle is-vertical is-properties" role="separator" tabIndex={0} aria-label="Redimensionar área de montagem e propriedades" aria-orientation="vertical" aria-valuemin={220} aria-valuemax={420} aria-valuenow={Math.round(editorLayout.propertiesWidth)} title="Arraste para ajustar a largura · Duplo clique restaura" onPointerDown={event => beginResize('properties', event)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} onDoubleClick={() => resetResize('properties')} onKeyDown={event => resizeWithKeyboard('properties', event)}><span /></div>
      <div className="ewq-properties-slot"><div className="ewq-side-tabs" role="group" aria-label="Painel lateral"><button type="button" aria-pressed={sideMode === 'properties'} onClick={() => { setSideMode('properties'); setMappedCircuitId(null); setPendingMove(null); }}><Settings2 size={15} aria-hidden="true" /> Propriedades</button><button type="button" aria-pressed={sideMode === 'map'} onClick={() => { setSideMode('map'); setPendingMove(null); }}><Route size={15} aria-hidden="true" /> Mapa</button><button type="button" aria-pressed={sideMode === 'wires'} onClick={openWireEditor}><Cable size={15} aria-hidden="true" /> Fios</button></div>{sideMode === 'map' ? <ConnectionMapPanel project={project} circuitId={mappedCircuitId} onCircuit={mapCircuit} onSelectWire={selectMappedWire} onClear={() => setMappedCircuitId(null)} onClose={() => { setPanel(null); setMappedCircuitId(null); }} /> : sideMode === 'wires' ? <WireEditorPanel project={project} selectedWireId={selection.wire} editable={canEditWires} onSelectWire={selectMappedWire} onUpdateWire={editWire} onWirePath={(id, path) => editWire(id, { path, manualPath: true })} onDelete={remove} onClose={() => { setPanel(null); setPendingMove(null); }} /> : <PropertiesPanel project={project} selection={selection} onUpdateDevice={editDevice} onUpdateWire={editWire} onDelete={remove} onDuplicate={duplicate} onUpdateProject={editProject} onClose={() => setPanel(null)} />}</div>
    </div>
    <div className="ewq-resize-handle is-horizontal" role="separator" tabIndex={0} aria-label="Redimensionar altura da área de montagem" aria-orientation="horizontal" aria-valuemin={420} aria-valuemax={1200} aria-valuenow={Math.round(editorLayout.height ?? 520)} title="Arraste para ajustar a altura · Duplo clique restaura" onPointerDown={event => beginResize('height', event)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} onDoubleClick={() => resetResize('height')} onKeyDown={event => resizeWithKeyboard('height', event)}><span /></div>
    <div className="ewq-occupation"><span className="ewq-capacity-label"><CircuitBoard size={15} aria-hidden="true" /><span><strong>{used}</strong> de {total} módulos</span></span><progress max={total} value={used} aria-label="Ocupação do quadro" /><span className="ewq-free-modules">{total - used} livres</span><span className="ewq-device-count">{project.devices.length} componentes · {project.wires.length} fios</span><button className={noticeCounts.error ? 'has-errors' : noticeCounts.warning ? 'has-warnings' : ''} onClick={() => showDetails('warnings')} aria-label={`${noticeCounts.error} erros, ${noticeCounts.warning} alertas e ${noticeCounts.info} pendências`}><ShieldAlert size={15} aria-hidden="true" /> {noticeCounts.error ? `${noticeCounts.error} erro${noticeCounts.error === 1 ? '' : 's'}` : noticeCounts.warning ? `${noticeCounts.warning} alerta${noticeCounts.warning === 1 ? '' : 's'}` : `${noticeCounts.info} pendência${noticeCounts.info === 1 ? '' : 's'}`}</button></div>
    <div className="ewq-details" ref={detailsRef}>
    <div className="ewq-details-bar"><div className="ewq-bottom-tabs" role="tablist" aria-label="Informações do projeto" onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')); const current = tabs.indexOf(document.activeElement as HTMLButtonElement); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; tabs[next].focus(); tabs[next].click(); }}>{([['circuits', 'Circuitos', Cable], ['materials', 'Materiais', Boxes], ['warnings', 'Verificações', ShieldAlert], ['history', 'Histórico', History]] as const).map(([id, label, Icon]) => <button key={id} role="tab" id={`ewq-tab-${id}`} tabIndex={bottom === id ? 0 : -1} aria-selected={bottom === id} aria-controls="ewq-tabpanel" onClick={() => { setBottom(id); setDetailsOpen(true); }}><Icon size={16} aria-hidden="true" /> {label}{id === 'circuits' && <span>{project.circuits.length}</span>}</button>)}</div><button className="ewq-icon ewq-details-toggle" aria-label={detailsOpen ? 'Recolher detalhes do projeto' : 'Expandir detalhes do projeto'} aria-expanded={detailsOpen} aria-controls="ewq-tabpanel" onClick={() => setDetailsOpen(!detailsOpen)}><ChevronDown size={18} /></button></div>
    <div id="ewq-tabpanel" role="tabpanel" aria-labelledby={`ewq-tab-${bottom}`} hidden={!detailsOpen}>
      {bottom === 'circuits' && <CircuitsPanel project={project} onUpdateCircuit={editCircuit} onAddCircuit={addCircuit} onPrepareOutputs={() => run(() => prepareCircuitOutputs(project), 'Preparar saídas dos circuitos')} onDeleteCircuit={id => run(() => removeCircuitOutput({ ...project, circuits: project.circuits.filter(c => c.id !== id), devices: project.devices.map(d => d.circuitId === id ? { ...d, circuitId: null } : d) }, id), 'Excluir circuito')} onSelectDevice={id => { setSelection({ devices: [id], wire: null }); setPanel('properties'); }} onMapCircuit={mapCircuit} onUpdateDevice={editDevice} />}
      {bottom === 'materials' && <MaterialsPanel project={project} onChange={materials => commit({ ...project, materials }, 'Editar materiais')} onExport={() => void exportFile('csv')} />}
      {bottom === 'warnings' && <section className="ewq-bottom-panel"><header className="ewq-verification-header"><div><h3>Verificações da montagem visual</h3><p>Erros impedem uma representação confiável; alertas pedem revisão; pendências são dados que ainda podem ser preenchidos. Não verifica conformidade elétrica.</p></div><div className="ewq-verification-summary" aria-live="polite" aria-atomic="true"><span className="is-error"><strong>{noticeCounts.error}</strong> Erros</span><span className="is-warning"><strong>{noticeCounts.warning}</strong> Alertas</span><span className="is-info"><strong>{noticeCounts.info}</strong> Pendências</span></div></header><ul className="ewq-warnings">{orderedNotices.length ? orderedNotices.map(w => <li key={w.id} className={`is-${w.severity}`}>{w.severity === 'error' ? <CircleAlert size={16} aria-hidden="true" /> : w.severity === 'warning' ? <TriangleAlert size={16} aria-hidden="true" /> : <Info size={16} aria-hidden="true" />}<div><span className="ewq-warning-level">{w.severity === 'error' ? 'Erro' : w.severity === 'warning' ? 'Alerta' : 'Pendente'}</span><button onClick={() => { if (w.circuitId) { showCircuit(w.circuitId); return; } setSelection({ devices: w.deviceId ? [w.deviceId] : [], wire: w.wireId ?? null }); setPanel('properties'); }}>{w.message}</button></div></li>) : <li className="is-clear"><Check size={16} aria-hidden="true" /> Nenhuma pendência gráfica encontrada.</li>}</ul></section>}
      {bottom === 'history' && <section className="ewq-bottom-panel"><header><div><h3>Histórico desta sessão</h3><p>Até 80 etapas. Desfazer e refazer restauram componentes, circuitos e conexões juntos.</p></div></header><ol className="ewq-history">{[...history.past, history.present].map((step, i) => <li key={i}><span>{String(i + 1).padStart(2, '0')}</span>{step.label}{i === history.past.length && <strong>Atual</strong>}</li>)}</ol></section>}
    </div>
    </div>
    </div>
    <footer className="ewq-technical-note"><ShieldAlert size={17} /><p>{PRELIMINARY_NOTICE}</p><button className="ewq-button" disabled={exporting || !project.circuits.length} onClick={() => void exportFile('labels')}><Tags size={15} /> Etiquetas</button></footer>
    {context && <><div className="ewq-context-dismiss" onClick={() => setContext(null)} /><div ref={contextRef} className="ewq-menu ewq-context" role="menu" aria-label="Ações da seleção" style={{ left: Math.max(8, Math.min(context.x, window.innerWidth - 200)), top: Math.max(8, Math.min(context.y, window.innerHeight - 160)) }} onKeyDown={event => { if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')); const current = items.indexOf(document.activeElement as HTMLButtonElement); const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items[next]?.focus(); }}><button role="menuitem" onClick={() => { copy(); setContext(null); }}>Copiar <small>Ctrl+C</small></button><button role="menuitem" onClick={() => { duplicate(); setContext(null); }}>Duplicar</button><button role="menuitem" onClick={() => { paste(); setContext(null); }}>Colar <small>Ctrl+V</small></button><button role="menuitem" onClick={remove}>Excluir <small>Delete</small></button></div></>}
    {(dialog === 'new' || dialog === 'auto') && <ProjectDialog automatic={dialog === 'auto'} onCreate={open} onClose={() => setDialog(null)} />}
    {dialog === 'projects' && <Modal title="Seus projetos" description={cloudStatus === 'offline' || cloudStatus === 'conflict' ? 'Nuvem indisponível. Os projetos deste navegador permanecem acessíveis; exporte JSON para um backup independente.' : 'Projetos desta conta sincronizados com a nuvem, com cópia neste navegador. Exporte JSON para ter um backup independente.'} onClose={() => setDialog(null)} footer={<><button className="btn-secondary" onClick={() => importInput.current?.click()}>Importar JSON</button><button className="btn-secondary" onClick={() => { setCopyName(`${project.name} — cópia`); setDialog('saveAs'); }}><Copy size={15} /> Salvar como</button><button className="btn-primary" onClick={() => setDialog('new')}>Novo projeto</button></>}><div className="ewq-project-list">{library.length ? library.map(p => <div key={p.id}><button onClick={() => open(p)}><FolderOpen size={20} /><span><strong>{p.name}</strong><small>{p.devices.length} dispositivos · {p.rails * p.modulesPerRail} módulos</small></span></button><button className="ewq-icon" aria-label={`Excluir projeto ${p.name}`} onClick={() => deleteSavedProject(p)}><Trash2 size={16} /></button></div>) : <p>O projeto atual será salvo automaticamente. Você também pode importar um JSON.</p>}</div></Modal>}
    {dialog === 'saveAs' && <Modal title="Salvar projeto como" onClose={() => setDialog(null)} footer={<><button className="btn-secondary" onClick={() => setDialog(null)}>Cancelar</button><button className="btn-primary" disabled={!copyName.trim()} onClick={() => open({ ...structuredClone(project), id: crypto.randomUUID(), name: copyName.trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })}>Salvar cópia</button></>}><label className="ewq-dialog-form">Nome da cópia<input value={copyName} maxLength={100} onChange={e => setCopyName(e.target.value)} /></label></Modal>}
    {dialog === 'help' && <Modal title="Do quadro vazio à apresentação" onClose={() => setDialog(null)} footer={<button className="btn-primary" onClick={() => { dismissWelcome(); setDialog(null); }}>Começar a montar</button>}><ol className="ewq-tutorial"><li><strong>1. Escolha seu quadro</strong><p>Use Novo para definir alimentação, módulos DIN e tamanho da caixa.</p></li><li><strong>2. Adicione os dispositivos</strong><p>Arraste da biblioteca ou clique no item. Arraste ou use as setas para mover; Shift seleciona vários. As propriedades também permitem informar a posição.</p></li><li><strong>3. Crie os circuitos</strong><p>Associe disjuntor e DR pela tabela. Informe a carga separadamente para explorar a distribuição entre fases.</p></li><li><strong>4. Faça e modele as conexões</strong><p>Ative Passar fios ({shortcuts.wire}), escolha condutor/bitola e clique nos terminais. Depois selecione um fio para arrastar segmentos e dobras; Shift ajusta fino, Alt ignora o encaixe magnético e duplo clique remove uma dobra.</p></li><li><strong>5. Organize e apresente</strong><p>Recalcular fios refaz os trajetos automáticos. Em Exportar, use Apresentação final para gerar uma prancha diagramada ou PDF completo para documentação.</p></li></ol><p className="ewq-notice">Ctrl+K busca ações e componentes · Ctrl+D duplica a seleção · Setas movem a seleção · Shift+F10 abre as ações · Ctrl+Z desfaz · Ctrl+Y refaz · Ctrl+C/Ctrl+V copia e cola · Delete exclui · Ctrl+roda ajusta zoom · {shortcuts.pan} move a vista. A demonstração contém valores ilustrativos; não os use como dimensionamento.</p></Modal>}
    {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
    <input ref={importInput} type="file" accept=".json" hidden onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { if (file.size > 5_000_000) throw new Error('O limite é 5 MB.'); const imported = parseProjectFile(await file.text()); open({ ...imported, id: crypto.randomUUID(), name: `${imported.name} — importado` }); } catch (err) { setMessage(err instanceof Error ? err.message : 'Falha ao importar.'); setDialog(null); } finally { e.target.value = ''; } }} />
  </div>;
}
