import { memo, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Crosshair, Hand, MousePointer2, Move, ZoomIn, ZoomOut } from 'lucide-react';
import DeviceDrawing from '../electrical-components/DeviceDrawing';
import { CATALOG } from '../electrical-components/catalog';
import { boardSize, deviceRect, terminalPoint, MODULE, RAIL, LEFT, TOP, DEVICE_HEIGHT } from '../wiring/routing';
import type { Device, Point, Project, Selection, Tool, ViewMode, Viewport, Wire } from '../types';
import './canvas.css';

export type BoardCanvasProps = {
  project: Project; selection: Selection; tool: Tool; mode: ViewMode; viewport: Viewport;
  onViewport(v: Viewport): void; onSelect(s: Selection): void;
  onMove(ids: string[], railDelta: number, slotDelta: number): void;
  onAdd(type: string, position: { rail: number; slot: number }): void;
  onTerminal(componentId: string, terminalId: string): void;
  wireStart: { componentId: string; terminalId: string } | null;
  onContextMenu(x: number, y: number, deviceId?: string): void;
  onMessage(message: string): void;
};

type Gesture = { kind: 'move' | 'pan' | 'marquee'; origin: Point; rootOrigin: Point; initialViewport: Viewport; ids: string[]; additive: boolean; pointerId: number; moved: boolean };
type MovePreview = { ids: string[]; rail: number; slot: number; valid: boolean };
type DropPreview = { type: string; rail: number; slot: number; modules: number; valid: boolean };
const clampZoom = (value: number) => Math.max(0.3, Math.min(3, value));
const pathData = (points: Point[]) => points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');

function validPositions(project: Project, devices: Pick<Device, 'id' | 'rail' | 'slot' | 'modules'>[], rail: number, slot: number) {
  const moving = new Set(devices.map(device => device.id));
  return devices.every(device => {
    const nextRail = device.rail + rail, nextSlot = device.slot + slot;
    return nextRail >= 0 && nextRail < project.rails && nextSlot >= 0 && nextSlot + device.modules <= project.modulesPerRail && !project.devices.some(other => !moving.has(other.id) && other.rail === nextRail && nextSlot < other.slot + other.modules && nextSlot + device.modules > other.slot);
  });
}

function Screw({ x, y, size = 5.5 }: { x: number; y: number; size?: number }) {
  return <g aria-hidden="true"><circle cx={x} cy={y} r={size + 1.8} fill="#b4bebd" stroke="#909f9f" strokeWidth="0.8" /><circle cx={x} cy={y} r={size} fill="#d7dcda" stroke="#829092" strokeWidth="0.8" /><path d={`M${x - size * .62} ${y} h${size * 1.24} M${x} ${y - size * .62} v${size * 1.24}`} stroke="#657579" strokeWidth="1.1" /></g>;
}

const Cabinet = memo(function Cabinet({ project, mode }: { project: Project; mode: ViewMode }) {
  const size = boardSize(project), railWidth = project.modulesPerRail * MODULE;
  const technical = mode === 'schematic' || mode === 'labels';
  return <g aria-hidden="true" pointerEvents="none">
    <rect x="16" y="18" width={size.width - 28} height={size.height - 27} rx="15" fill="#1e2d34" opacity={technical ? 0 : 0.1} />
    <rect x="12" y="12" width={size.width - 24} height={size.height - 24} rx={technical ? 3 : 12} fill={technical ? '#fff' : '#d8dfde'} stroke={technical ? '#a7b3b9' : '#a7b4b6'} strokeWidth="1.5" />
    <rect x="26" y="26" width={size.width - 52} height={size.height - 52} rx={technical ? 1 : 6} fill={technical ? '#fff' : '#e9ece8'} stroke={technical ? '#e4e9eb' : '#c2cbca'} />
    {!technical && <>
      <path d={`M28 28 H${size.width - 28} M28 28 V${size.height - 28}`} stroke="#fafcf9" strokeWidth="3" />
      {[42, size.width - 42].flatMap(x => [42, size.height - 42].map(y => <Screw key={`${x}-${y}`} x={x} y={y} size={6} />))}
      {[48, size.width - 66].map(x => <g key={x}>
        <rect x={x} y="78" width="18" height={size.height - 154} rx="2" fill="#d0d8d5" stroke="#bec9c7" />
        {Array.from({ length: Math.floor((size.height - 168) / 11) }, (_, i) => <path key={i} d={`M${x + 2} ${87 + i * 11} h14`} stroke="#eaf0eb" strokeWidth="3" />)}
      </g>)}
    </>}
    <text x={LEFT} y="61" fill="#485b65" fontSize="12" fontWeight="700" letterSpacing="1.8">{mode === 'schematic' ? 'DIAGRAMA DE CONEXÕES' : mode === 'labels' ? 'IDENTIFICAÇÃO DOS CIRCUITOS' : 'QUADRO DE DISTRIBUIÇÃO'}</text>
    <text x={size.width - LEFT} y="61" textAnchor="end" fill="#62747d" fontSize="10">{project.modulesPerRail * project.rails} M · {project.voltage} V</text>
    {Array.from({ length: project.rails }, (_, rail) => {
      const y = TOP + rail * RAIL;
      return <g key={rail}>
        <text x={LEFT - 15} y={y + 68} transform={`rotate(-90 ${LEFT - 15} ${y + 68})`} textAnchor="middle" fill="#7b8b90" fontSize="8" letterSpacing="1.5">TRILHO {String(rail + 1).padStart(2, '0')}</text>
        <rect x={LEFT - 8} y={y + 47} width={railWidth + 16} height="35" rx="1" fill={technical ? '#f5f7f8' : '#b6c1c3'} stroke="#96a4a9" />
        <rect x={LEFT - 8} y={y + 51} width={railWidth + 16} height="27" fill={technical ? '#f5f7f8' : '#d6dddd'} stroke="#edf1ed" />
        <path d={`M${LEFT - 8} ${y + 56} H${LEFT + railWidth + 8} M${LEFT - 8} ${y + 75} H${LEFT + railWidth + 8}`} stroke="#9cabaf" strokeWidth="1" />
        {Array.from({ length: project.modulesPerRail }, (_, slot) => <g key={slot}>
          <text x={LEFT + (slot + .5) * MODULE} y={y - 28} textAnchor="middle" fill="#87969b" fontSize="8" fontFamily="monospace">{String(slot + 1).padStart(2, '0')}</text>
          <rect x={LEFT + slot * MODULE + 16} y={y + 61} width="12" height="6" rx="3" fill={technical ? '#dce3e6' : '#a1afb4'} />
        </g>)}
        <rect x={LEFT - 2} y={y + DEVICE_HEIGHT + 23} width={railWidth + 4} height="27" rx="2" fill={technical ? '#fff' : '#f3f5f1'} stroke="#c7d0ce" />
      </g>;
    })}
    <text x={LEFT} y={size.height - 43} fill="#62747d" fontSize="10">ELETRICAWEB / {project.widthMm} × {project.heightMm} mm</text>
    <text x={size.width - LEFT} y={size.height - 43} textAnchor="end" fill="#7d898e" fontSize="8">REPRESENTAÇÃO VISUAL · SEM ESCALA</text>
  </g>;
});

const WireDrawing = memo(function WireDrawing({ wire, selected, mode, onSelect }: { wire: Wire; selected: boolean; mode: ViewMode; onSelect(): void }) {
  const d = pathData(wire.path), earth = wire.conductorType === 'earth';
  const strokeWidth = mode === 'schematic' ? 1.7 : 2.6 + Math.sqrt(wire.gauge ?? 1.5) * .65;
  const segments = wire.path.slice(1).map((end, i) => ({ start: wire.path[i], end, length: Math.abs(end.x - wire.path[i].x) + Math.abs(end.y - wire.path[i].y) }));
  const longest = segments.filter(segment => segment.start.y === segment.end.y).sort((a, b) => b.length - a.length)[0];
  const labelPoint = longest ? { x: (longest.start.x + longest.end.x) / 2, y: longest.start.y } : wire.path[Math.floor(wire.path.length / 2)];
  return <g className="qdc-wire" data-wire={wire.id} role="button" tabIndex={0} aria-label={`Selecionar fio ${wire.label || wire.conductorType}, ${wire.gauge ?? 'sem'} milímetros quadrados`} aria-pressed={selected} onPointerDown={event => { event.stopPropagation(); if (event.button === 0) onSelect(); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onSelect(); } }}>
    <title>{wire.label || 'Condutor'} · {wire.gauge === null ? 'Bitola não informada' : `${wire.gauge} mm²`}</title>
    <path d={d} fill="none" stroke="transparent" strokeWidth="18" strokeLinejoin="round" />
    {selected && <path data-qdc-editor-only="true" d={d} fill="none" stroke="#f3c519" strokeWidth={strokeWidth + 7} strokeLinejoin="round" strokeLinecap="round" opacity=".9" />}
    {mode === 'realistic' && <path d={d} transform="translate(0 1.5)" fill="none" stroke="#1f2a31" strokeOpacity=".18" strokeWidth={strokeWidth + 2} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />}
    <path d={d} fill="none" stroke={earth ? '#338449' : wire.color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />
    {earth && <path d={d} fill="none" stroke="#edda40" strokeWidth={Math.max(1.3, strokeWidth * .42)} strokeDasharray="8 8" strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />}
    {labelPoint && (selected || mode === 'installation') && <g pointerEvents="none">
      <rect x={labelPoint.x - 29} y={labelPoint.y - 10} width="58" height="18" rx="4" fill="#fff" stroke={selected ? '#bd9a14' : '#a7b6be'} />
      <text x={labelPoint.x} y={labelPoint.y + 2} textAnchor="middle" fill="#283a44" fontSize="9" fontWeight="600">{wire.gauge === null ? '? mm²' : `${wire.gauge} mm²`}</text>
    </g>}
  </g>;
});

function WireEndpoint({ point, wire, count }: { point: Point; wire: Wire; count: number }) {
  const earth = wire.conductorType === 'earth';
  return <g className="qdc-wire-endpoint" pointerEvents="none" aria-hidden="true">
    <circle cx={point.x} cy={point.y} r="6.2" fill="#f8faf8" stroke="#43545c" strokeWidth="1.2" />
    <circle cx={point.x} cy={point.y} r="3.7" fill={earth ? '#2d8a4b' : wire.color} stroke={earth ? '#f0d53a' : '#fff'} strokeWidth={earth ? 1.5 : .9} />
    {count > 1 && <g transform={`translate(${point.x + 7} ${point.y - 8})`}><circle r="5.5" fill="#f3c729" stroke="#6d5b13" strokeWidth=".8" /><text y="2.4" textAnchor="middle" fill="#263840" fontSize="6.5" fontWeight="800">{count}</text></g>}
  </g>;
}

function BoardCanvas({ project, selection, tool, mode, viewport, onViewport, onSelect, onMove, onAdd, onTerminal, wireStart, onContextMenu, onMessage }: BoardCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null), cameraRef = useRef<SVGGElement>(null);
  const gesture = useRef<Gesture | null>(null), spaceDown = useRef(false);
  const [moving, setMoving] = useState<MovePreview | null>(null);
  const [drop, setDrop] = useState<DropPreview | null>(null);
  const [marquee, setMarquee] = useState<{ start: Point; end: Point } | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [panning, setPanning] = useState(false);
  const size = boardSize(project);

  function clientPoint(clientX: number, clientY: number, world = true): Point {
    const svg = svgRef.current, matrix = (world ? cameraRef.current : svg)?.getScreenCTM();
    if (!svg || !matrix) return { x: 0, y: 0 };
    const point = svg.createSVGPoint(); point.x = clientX; point.y = clientY;
    const result = point.matrixTransform(matrix.inverse());
    return { x: result.x, y: result.y };
  }

  function cancelGesture() {
    const active = gesture.current;
    if (active && svgRef.current?.hasPointerCapture(active.pointerId)) svgRef.current.releasePointerCapture(active.pointerId);
    gesture.current = null; setMoving(null); setMarquee(null); setPanning(false); setDrop(null);
  }

  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest('input,select,textarea,[contenteditable="true"]')) return;
      if (event.code === 'Space' && (event.target === document.body || svgRef.current?.contains(target))) spaceDown.current = true;
      if (event.key === 'Escape') cancelGesture();
    }
    function keyUp(event: KeyboardEvent) { if (event.code === 'Space') spaceDown.current = false; }
    function blur() { spaceDown.current = false; cancelGesture(); }
    window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur); };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    function wheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const matrix = svg?.getScreenCTM();
      if (!svg || !matrix) return;
      const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
      const center = point.matrixTransform(matrix.inverse());
      const zoom = clampZoom(viewport.zoom * Math.exp(-event.deltaY * .002));
      onViewport({ zoom, x: center.x - (center.x - viewport.x) * zoom / viewport.zoom, y: center.y - (center.y - viewport.y) * zoom / viewport.zoom });
    }
    svg?.addEventListener('wheel', wheel, { passive: false });
    return () => svg?.removeEventListener('wheel', wheel);
  }, [viewport, onViewport]);

  function begin(event: ReactPointerEvent<SVGElement>, kind: Gesture['kind'], ids: string[] = []) {
    if (event.button !== 0 && event.button !== 1) return;
    event.preventDefault();
    svgRef.current?.setPointerCapture(event.pointerId);
    gesture.current = { kind, origin: clientPoint(event.clientX, event.clientY), rootOrigin: clientPoint(event.clientX, event.clientY, false), initialViewport: viewport, ids, additive: event.shiftKey, pointerId: event.pointerId, moved: false };
    if (kind === 'pan') setPanning(true);
  }

  function onDeviceDown(event: ReactPointerEvent<SVGGElement>, device: Device) {
    event.stopPropagation();
    if (event.button === 1 || tool === 'pan' || spaceDown.current) { begin(event, 'pan'); return; }
    if (event.button !== 0) return;
    if (tool === 'wire') { onMessage('Clique no terminal de entrada ou saída para conectar o fio.'); return; }
    const included = selection.devices.includes(device.id);
    const ids = event.shiftKey ? included ? selection.devices.filter(id => id !== device.id) : [...selection.devices, device.id] : included ? selection.devices : [device.id];
    onSelect({ devices: ids, wire: null });
    if (ids.includes(device.id)) begin(event, 'move', ids);
  }

  function movePointer(event: ReactPointerEvent<SVGSVGElement>) {
    const point = clientPoint(event.clientX, event.clientY), active = gesture.current;
    if (tool === 'wire' && wireStart) setCursor(point);
    if (!active) return;
    const rootPoint = clientPoint(event.clientX, event.clientY, false);
    if (Math.hypot(rootPoint.x - active.rootOrigin.x, rootPoint.y - active.rootOrigin.y) > 4 / viewport.zoom) active.moved = true;
    if (active.kind === 'pan') onViewport({ ...active.initialViewport, x: active.initialViewport.x + rootPoint.x - active.rootOrigin.x, y: active.initialViewport.y + rootPoint.y - active.rootOrigin.y });
    if (active.kind === 'move' && active.moved) {
      const rail = Math.round((point.y - active.origin.y) / RAIL), slot = Math.round((point.x - active.origin.x) / MODULE);
      const devices = project.devices.filter(device => active.ids.includes(device.id));
      setMoving({ ids: active.ids, rail, slot, valid: validPositions(project, devices, rail, slot) });
    }
    if (active.kind === 'marquee' && active.moved) setMarquee({ start: active.origin, end: point });
  }

  function clickDestination(point: Point) {
    const rail = Math.round((point.y - TOP - DEVICE_HEIGHT / 2) / RAIL), slot = Math.floor((point.x - LEFT) / MODULE);
    if (rail < 0 || rail >= project.rails || slot < 0 || slot >= project.modulesPerRail || Math.abs(point.y - (TOP + rail * RAIL + DEVICE_HEIGHT / 2)) > DEVICE_HEIGHT / 2 + 12) return false;
    const anchor = project.devices.find(device => device.id === selection.devices[0]);
    if (!anchor) return false;
    const devices = project.devices.filter(device => selection.devices.includes(device.id));
    if (!validPositions(project, devices, rail - anchor.rail, slot - anchor.slot)) { onMessage('Essa posição está ocupada ou ultrapassa o trilho.'); return true; }
    onMove(selection.devices, rail - anchor.rail, slot - anchor.slot); return true;
  }

  function endPointer(event: ReactPointerEvent<SVGSVGElement>) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const point = clientPoint(event.clientX, event.clientY);
    if (active.kind === 'move' && active.moved) {
      const rail = Math.round((point.y - active.origin.y) / RAIL), slot = Math.round((point.x - active.origin.x) / MODULE);
      const devices = project.devices.filter(device => active.ids.includes(device.id));
      if (validPositions(project, devices, rail, slot)) { if (rail || slot) onMove(active.ids, rail, slot); }
      else onMessage('Movimento cancelado: posição ocupada ou fora do quadro.');
    }
    if (active.kind === 'marquee') {
      if (active.moved) {
        const box = { x: Math.min(active.origin.x, point.x), y: Math.min(active.origin.y, point.y), width: Math.abs(active.origin.x - point.x), height: Math.abs(active.origin.y - point.y) };
        const ids = project.devices.filter(device => { const r = deviceRect(device); return r.x < box.x + box.width && r.x + r.width > box.x && r.y < box.y + box.height && r.y + r.height > box.y; }).map(device => device.id);
        onSelect({ devices: active.additive ? [...new Set([...selection.devices, ...ids])] : ids, wire: null });
      } else if (!active.additive && !clickDestination(point)) onSelect({ devices: [], wire: null });
    }
    cancelGesture();
  }

  function dropPreview(event: ReactDragEvent<SVGSVGElement>): DropPreview | null {
    const payload = event.dataTransfer.getData('application/qdc-device') || event.dataTransfer.getData('text/plain');
    let type = payload;
    if (payload.startsWith('{')) { try { type = JSON.parse(payload).type; } catch { return null; } }
    const item = CATALOG.find(entry => entry.type === type) || (drop ? CATALOG.find(entry => entry.type === drop.type) : undefined);
    const point = clientPoint(event.clientX, event.clientY);
    const rail = Math.round((point.y - TOP - DEVICE_HEIGHT / 2) / RAIL), slot = Math.floor((point.x - LEFT) / MODULE);
    const modules = item?.modules ?? 1;
    return { type: item?.type || '', rail, slot, modules, valid: validPositions(project, [{ id: '__drop__', rail, slot, modules }], 0, 0) };
  }

  function zoomBy(factor: number) {
    const zoom = clampZoom(viewport.zoom * factor), center = { x: size.width / 2, y: size.height / 2 };
    onViewport({ zoom, x: center.x - (center.x - viewport.x) * zoom / viewport.zoom, y: center.y - (center.y - viewport.y) * zoom / viewport.zoom });
  }

  const startPoint = wireStart ? terminalPoint(project, wireStart.componentId, wireStart.terminalId) : null;
  const activeDevices = new Set(selection.devices);
  const endpointMarkers = new Map<string, { point: Point; wire: Wire; count: number }>();
  for (const wire of project.wires) {
    for (const [componentId, terminalId] of [[wire.sourceComponent, wire.sourceTerminal], [wire.targetComponent, wire.targetTerminal]] as const) {
      const key = `${componentId}:${terminalId}`, point = terminalPoint(project, componentId, terminalId);
      if (!point) continue;
      const current = endpointMarkers.get(key);
      if (current) current.count++;
      else endpointMarkers.set(key, { point, wire, count: 1 });
    }
  }
  const used = project.devices.reduce((count, device) => count + device.modules, 0);
  const modeName = { realistic: 'Realista', schematic: 'Esquemático', installation: 'Instalação', labels: 'Identificação' }[mode];
  const hint = tool === 'wire' ? wireStart ? 'Escolha o terminal de destino · Esc cancela' : 'Clique em um terminal para começar a conexão' : tool === 'pan' ? 'Arraste a área de trabalho para navegar' : selection.devices.length ? 'Arraste ou clique em um espaço livre para mover · Shift adiciona à seleção' : 'Arraste um componente para o trilho · Shift para seleção múltipla';

  return <section className={`qdc-canvas-shell qdc-canvas-${tool}${panning ? ' is-panning' : ''}`} aria-label="Editor visual do quadro de distribuição">
    <div className="qdc-canvas-caption"><span className="qdc-canvas-view"><i />{modeName}</span><span>{project.rails} trilhos <b>·</b> {used}/{project.rails * project.modulesPerRail} módulos</span></div>
    <div className="qdc-canvas-stage">
      <svg ref={svgRef} data-qdc-export="true" xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${size.width} ${size.height}`} role="group" aria-label={`${project.name}. ${project.devices.length} dispositivos, ${project.wires.length} fios.`} tabIndex={0} className="qdc-board-svg" style={{ fontFamily: 'Arial, Helvetica, sans-serif', userSelect: 'none', touchAction: 'none' }}
        onPointerDown={event => { if (event.button === 1 || tool === 'pan' || spaceDown.current) begin(event, 'pan'); else if (tool === 'select' && event.button === 0) begin(event, 'marquee'); }}
        onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={cancelGesture} onLostPointerCapture={() => { if (gesture.current) cancelGesture(); }} onPointerLeave={() => { if (!gesture.current) setCursor(null); }}
        onContextMenu={event => { event.preventDefault(); const target = (event.target as Element).closest('[data-device]'); const id = target?.getAttribute('data-device') || undefined; if (id && !selection.devices.includes(id)) onSelect({ devices: [id], wire: null }); onContextMenu(event.clientX, event.clientY, id); }}
        onDragOver={event => { if (!event.dataTransfer.types.includes('application/qdc-device')) return; event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDrop(dropPreview(event)); }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null); }}
        onDrop={event => { event.preventDefault(); const preview = dropPreview(event); setDrop(null); if (!preview?.type) return; if (preview.valid) onAdd(preview.type, { rail: preview.rail, slot: preview.slot }); else onMessage('Escolha um espaço livre com módulos suficientes no trilho.'); }}>
        <title>{project.name} — montagem visual do QDC</title>
        <g ref={cameraRef} data-qdc-viewport="true" transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          <Cabinet project={project} mode={mode} />
          {Array.from({ length: project.rails }, (_, rail) => Array.from({ length: project.modulesPerRail }, (_, slot) => {
            const x = LEFT + slot * MODULE, y = TOP + rail * RAIL;
            const occupied = project.devices.some(device => device.rail === rail && slot >= device.slot && slot < device.slot + device.modules);
            return !occupied && <rect key={`${rail}-${slot}`} data-qdc-editor-only="true" className="qdc-empty-slot" x={x + 3} y={y + 5} width={MODULE - 6} height={DEVICE_HEIGHT - 10} rx="3" fill="transparent" stroke="transparent" strokeDasharray="3 3" role="button" aria-label={`Espaço livre, trilho ${rail + 1}, módulo ${slot + 1}${selection.devices.length ? '. Mover seleção para este espaço.' : ''}`} tabIndex={selection.devices.length && tool === 'select' ? 0 : -1} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); clickDestination({ x: x + 3, y: y + DEVICE_HEIGHT / 2 }); } }} />;
          }))}
          <g opacity={mode === 'labels' ? .16 : 1}>{project.wires.filter(wire => wire.id !== selection.wire).concat(project.wires.filter(wire => wire.id === selection.wire)).map(wire => <WireDrawing key={wire.id} wire={wire} selected={selection.wire === wire.id} mode={mode} onSelect={() => onSelect({ devices: [], wire: wire.id })} />)}</g>
          {project.devices.map(device => {
            const rect = deviceRect(device), selected = activeDevices.has(device.id), circuit = project.circuits.find(item => item.id === device.circuitId);
            return <g key={device.id} data-device={device.id} className={`qdc-device${selected ? ' is-selected' : ''}`} transform={`translate(${rect.x} ${rect.y})`} role="button" tabIndex={0} aria-label={`${device.label}, ${device.poles} ${device.poles === 1 ? 'polo' : 'polos'}, ${device.amperage ?? 'corrente não definida'} amperes. Trilho ${device.rail + 1}, posição ${device.slot + 1}.`} aria-pressed={selected} onPointerDown={event => onDeviceDown(event, device)} onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onSelect({ devices: event.shiftKey ? [...new Set([...selection.devices, device.id])] : [device.id], wire: null }); } }} opacity={moving?.ids.includes(device.id) && (moving.rail || moving.slot) ? .4 : 1}>
              <title>{device.label}{circuit ? ` · C${circuit.number} ${circuit.name}` : ''} · {device.modules} módulos DIN</title>
              <DeviceDrawing device={device} width={rect.width} height={rect.height} mode={mode} />
              {selected && <g data-qdc-editor-only="true" pointerEvents="none"><rect x="-3" y="-5" width={rect.width + 6} height={rect.height + 10} rx="4" fill="none" stroke="#dbb521" strokeWidth="2.3" />{[[-5, -7], [rect.width, -7], [-5, rect.height + 2], [rect.width, rect.height + 2]].map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="5" height="5" rx="1" fill="#fff9d8" stroke="#b99718" />)}</g>}
              {device.terminals.map(terminal => {
                const terminalPosition = terminalPoint(project, device.id, terminal.id);
                if (!terminalPosition) return null;
                const x = terminalPosition.x - rect.x, y = terminalPosition.y - rect.y;
                const screwY = terminal.side === 'top' ? device.type.endsWith('-bus') ? 44 : 17 : rect.height - 17;
                const active = wireStart?.componentId === device.id && wireStart.terminalId === terminal.id;
                const color = terminal.kind === 'N' ? '#2580b4' : terminal.kind === 'PE' ? '#408148' : terminal.kind === 'control' ? '#876691' : '#4a5b63';
                return <g key={terminal.id} data-terminal={`${device.id}:${terminal.id}`} className={`qdc-terminal${tool === 'wire' ? ' is-connectable' : ''}`} role="button" tabIndex={tool === 'wire' ? 0 : -1} aria-label={`Conectar ${device.label}: ${terminal.label}, ${terminal.side === 'top' ? 'entrada' : 'saída'}`} onPointerDown={event => { event.stopPropagation(); if (event.button === 1 || tool === 'pan' || spaceDown.current) { begin(event, 'pan'); return; } if (tool === 'wire' && event.button === 0) { event.preventDefault(); onTerminal(device.id, terminal.id); } else onDeviceDown(event, device); }} onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && tool === 'wire') { event.preventDefault(); event.stopPropagation(); onTerminal(device.id, terminal.id); } }}>
                  <title>{terminal.label} · {terminal.side === 'top' ? 'Entrada' : 'Saída'}{tool === 'wire' ? ' — clique para conectar' : ' — ative a ferramenta Fio para conectar'}</title>
                  <path d={`M${x} ${y} V${screwY}`} stroke={mode === 'installation' ? color : '#859594'} strokeWidth={mode === 'realistic' ? 3 : 1.3} />
                  {mode === 'realistic' && <Screw x={x} y={screwY} size={device.terminals.filter(item => item.side === terminal.side).length > 4 ? 4 : 5} />}
                  <circle cx={x} cy={y} r={tool === 'wire' ? 6 : 3.2} fill={active ? '#f4cf29' : '#fff'} stroke={active ? '#a3830e' : color} strokeWidth={tool === 'wire' ? 2 : 1.3} />
                  {tool === 'wire' && <circle data-qdc-editor-only="true" className="qdc-terminal-target" cx={x} cy={y} r="12" fill="transparent" stroke={active ? '#ecc635' : 'transparent'} strokeWidth="1" />}
                  {(tool === 'wire' || mode === 'installation' || mode === 'schematic') && <text x={x} y={terminal.side === 'top' ? 11 : rect.height - 6} textAnchor="middle" fill={color} stroke="#fff" paintOrder="stroke" strokeWidth="2.5" fontSize="7" fontWeight="700" pointerEvents="none">{terminal.label}</text>}
                </g>;
              })}
              <g pointerEvents="none"><rect x="1" y={DEVICE_HEIGHT + 24} width={rect.width - 2} height="25" rx="1" fill={mode === 'labels' ? '#fff' : '#f9faf6'} />
                <rect x="1" y={DEVICE_HEIGHT + 24} width="3" height="25" fill={circuit?.color || device.color || '#bdc8c7'} />
                <text x={rect.width / 2 + 1} y={DEVICE_HEIGHT + 35} textAnchor="middle" fill="#273b44" fontSize={mode === 'labels' ? 10 : 8} fontWeight="700">{circuit ? `C${circuit.number}` : device.label.slice(0, Math.max(3, Math.floor(rect.width / 6)))}</text>
                <text x={rect.width / 2 + 1} y={DEVICE_HEIGHT + 44} textAnchor="middle" fill="#5a6c74" fontSize="6.5">{(circuit?.name || (device.amperage !== null ? `${device.amperage} A` : 'A DEFINIR')).slice(0, Math.floor(rect.width / 3.6))}</text>
              </g>
            </g>;
          })}
          <g data-qdc-wire-endpoints="true">{[...endpointMarkers.entries()].map(([key, marker]) => <WireEndpoint key={key} {...marker} />)}</g>
          {moving && <g data-qdc-editor-only="true" pointerEvents="none">{project.devices.filter(device => moving.ids.includes(device.id)).map(device => { const rect = deviceRect({ ...device, rail: device.rail + moving.rail, slot: device.slot + moving.slot }); return <g key={device.id}><rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx="4" fill={moving.valid ? '#eed03a' : '#e16b59'} fillOpacity=".3" stroke={moving.valid ? '#b49313' : '#b83e34'} strokeWidth="2" strokeDasharray="6 3" /><path d={`M${LEFT - 12} ${rect.y + rect.height / 2} H${size.width - LEFT + 12} M${rect.x} ${TOP - 40} V${size.height - 70}`} stroke={moving.valid ? '#b49313' : '#b83e34'} strokeDasharray="4 4" strokeWidth=".9" /></g>; })}</g>}
          {drop && <g data-qdc-editor-only="true" pointerEvents="none"><rect x={LEFT + drop.slot * MODULE + 2} y={TOP + drop.rail * RAIL} width={drop.modules * MODULE - 4} height={DEVICE_HEIGHT} rx="4" fill={drop.valid ? '#e9c631' : '#e17a68'} fillOpacity=".25" stroke={drop.valid ? '#b39722' : '#b85142'} strokeWidth="2" strokeDasharray="6 4" /><text x={LEFT + (drop.slot + drop.modules / 2) * MODULE} y={TOP + drop.rail * RAIL + DEVICE_HEIGHT / 2} textAnchor="middle" fill={drop.valid ? '#806510' : '#932f20'} fontSize="11" fontWeight="700">{drop.valid ? '+' : '×'}</text></g>}
          {marquee && <rect data-qdc-editor-only="true" x={Math.min(marquee.start.x, marquee.end.x)} y={Math.min(marquee.start.y, marquee.end.y)} width={Math.abs(marquee.start.x - marquee.end.x)} height={Math.abs(marquee.start.y - marquee.end.y)} fill="#e7c624" fillOpacity=".15" stroke="#a78f1e" strokeWidth="1" pointerEvents="none" />}
          {startPoint && <g data-qdc-editor-only="true" pointerEvents="none"><circle cx={startPoint.x} cy={startPoint.y} r="10" fill="none" stroke="#dcb72c" strokeWidth="2" />{cursor && <path d={`M${startPoint.x} ${startPoint.y} V${startPoint.y - 25} H${cursor.x} V${cursor.y}`} fill="none" stroke="#bb9824" strokeWidth="2.5" strokeDasharray="5 5" />}</g>}
        </g>
      </svg>
      {!project.devices.length && <div className="qdc-canvas-empty"><Move size={26} /><strong>Seu quadro começa aqui</strong><span>Arraste os dispositivos da biblioteca<br />ou clique em um componente para adicioná-lo.</span></div>}
    </div>
    <div className="qdc-canvas-hint" aria-live="polite">{tool === 'pan' ? <Hand size={13} /> : tool === 'wire' ? <Crosshair size={13} /> : <MousePointer2 size={13} />}<span>{hint}</span></div>
    <div className="qdc-canvas-navigation">
      <div className="qdc-zoom-controls"><button type="button" title="Diminuir zoom" aria-label="Diminuir zoom do quadro" onClick={() => zoomBy(1 / 1.2)} disabled={viewport.zoom <= .3}><ZoomOut size={15} /></button><button type="button" title="Ajustar quadro à área" onClick={() => onViewport({ x: 0, y: 0, zoom: 1 })}>{Math.round(viewport.zoom * 100)}%</button><button type="button" title="Aumentar zoom" aria-label="Aumentar zoom do quadro" onClick={() => zoomBy(1.2)} disabled={viewport.zoom >= 3}><ZoomIn size={15} /></button></div>
      <svg className="qdc-minimap" viewBox={`0 0 ${size.width} ${size.height}`} role="button" tabIndex={0} aria-label="Minimapa. Clique para centralizar uma região; Enter ajusta o quadro inteiro." onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onViewport({ x: 0, y: 0, zoom: 1 }); } }} onPointerDown={event => { const svg = event.currentTarget, matrix = svg.getScreenCTM(); if (!matrix) return; const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY; const center = p.matrixTransform(matrix.inverse()); onViewport({ ...viewport, x: size.width / 2 - center.x * viewport.zoom, y: size.height / 2 - center.y * viewport.zoom }); }}>
        <rect x="12" y="12" width={size.width - 24} height={size.height - 24} rx="8" fill="#e5eae7" stroke="#aebbbf" strokeWidth="4" />
        {project.devices.map(device => { const r = deviceRect(device); return <rect key={device.id} x={r.x} y={r.y} width={r.width} height={r.height} rx="3" fill={activeDevices.has(device.id) ? '#d6b627' : '#73848b'} />; })}
        {project.wires.map(wire => <path key={wire.id} d={pathData(wire.path)} fill="none" stroke={wire.color} strokeWidth="3" opacity=".65" />)}
        <rect x={-viewport.x / viewport.zoom} y={-viewport.y / viewport.zoom} width={size.width / viewport.zoom} height={size.height / viewport.zoom} fill="#e2be1e" fillOpacity=".06" stroke="#ae941d" strokeWidth="7" />
      </svg>
    </div>
  </section>;
}

export default BoardCanvas;
