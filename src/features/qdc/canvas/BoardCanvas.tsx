import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent, SyntheticEvent as ReactSyntheticEvent } from 'react';
import { Crosshair, Hand, MousePointer2, Move, X, ZoomIn, ZoomOut } from 'lucide-react';
import DeviceDrawing from '../electrical-components/DeviceDrawing';
import FishboneArtwork from '../fishbone/FishboneArtwork';
import { fishboneSlotAt, fishboneSlotIssue, isFishboneBreaker } from '../fishbone/model';
import { CATALOG } from '../electrical-components/catalog';
import { bendWirePoint, flexWireSegment, removeWireBend, roundedWirePath, snapWirePoint } from '../wiring/geometry';
import { boardSize, deviceMount, deviceRect, isRailMounted, terminalPoint, terminalSide, MODULE, RAIL, LEFT, TOP, DEVICE_HEIGHT } from '../wiring/routing';
import { ferruleColor, isGreenYellowWire } from '../wiring/options';
import { circuitForOutputTerminal, circuitWireColor, connectionIssue, type Endpoint } from '../editor/operations';
import { canvasFocus, type CanvasFocus } from './focus';
import { canEditLayer, type EditorLayers } from '../editor/layers';
import type { Device, Point, Project, Selection, Tool, ViewMode, Viewport, Wire, WireOptions, WireTermination } from '../types';
import './canvas.css';

export type BoardCanvasProps = {
  project: Project; selection: Selection; layers: EditorLayers; tool: Tool; mode: ViewMode; viewport: Viewport; highlightedConnections?: CanvasFocus | null;
  movePreview?: { candidate: Project; deviceIds: string[]; wireIds: string[] } | null;
  onViewport(v: Viewport): void; onSelect(s: Selection): void;
  onMove(ids: string[], railDelta: number, slotDelta: number, preview?: boolean): void;
  onMoveFishbone(id: string, slotId: string, preview?: boolean): void;
  onMovePlane(id: string, position: Point, preview?: boolean): void;
  onAdd(type: string, position: { rail: number; slot: number; fishboneSlotId?: string }): void;
  onTerminal(componentId: string, terminalId: string): void;
  onConnect(source: Endpoint, target: Endpoint): void;
  onWirePath(wireId: string, path: Point[]): void;
  wireStart: { componentId: string; terminalId: string } | null;
  wireOptions: WireOptions;
  onContextMenu(x: number, y: number, deviceId?: string): void;
  onMessage(message: string): void;
};

type Gesture = { kind: 'move' | 'pan' | 'marquee'; origin: Point; rootOrigin: Point; initialViewport: Viewport; ids: string[]; additive: boolean; pointerId: number; moved: boolean; free: boolean };
type MovePreview = { ids: string[]; rail: number; slot: number; valid: boolean; plane?: Point; fishboneSlotId?: string };
type DropPreview = { type: string; rail: number; slot: number; modules: number; valid: boolean; fishboneSlotId?: string };
type WirePointGesture = { pointerId: number; wireId: string; kind: 'point' | 'segment'; index: number; origin: Point; anchor: Point; basePath: Point[]; path: Point[]; moved: boolean };
type SnapTarget = Endpoint & { point: Point; label: string; issue: string | null };
type LeadGesture = { pointerId: number; source: Endpoint; tip: Point; clientX: number; clientY: number; moved: boolean };
const clampZoom = (value: number) => Math.max(0.3, Math.min(3, value));
const pathData = (points: Point[]) => points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
const EDGE_LABELS = { top: 'superior', bottom: 'inferior', left: 'esquerda', right: 'direita' } as const;

function validPositions(project: Project, devices: Device[], rail: number, slot: number) {
  const moving = new Set(devices.map(device => device.id));
  return devices.every(device => {
    if (deviceMount(device) === 'edge') return false;
    const nextRail = device.rail + rail, nextSlot = device.slot + slot;
    const mount = deviceMount(device);
    return nextRail >= 0 && nextRail < project.rails && nextSlot >= 0 && nextSlot + device.modules <= project.modulesPerRail && !project.devices.some(other => !moving.has(other.id) && !other.fishboneSlotId && deviceMount(other) === mount && other.rail === nextRail && nextSlot < other.slot + other.modules && nextSlot + device.modules > other.slot);
  });
}

function Screw({ x, y, size = 5.5 }: { x: number; y: number; size?: number }) {
  return <g aria-hidden="true"><circle cx={x + .8} cy={y + 1.2} r={size + 2} fill="#24343a" opacity=".17" /><circle cx={x} cy={y} r={size + 1.8} fill="#aab4b4" stroke="#7f8d8f" strokeWidth="0.8" /><circle cx={x} cy={y} r={size} fill="url(#qdc-fastener-metal)" stroke="#748286" strokeWidth="0.8" /><path d={`M${x - size * .62} ${y} h${size * 1.24} M${x} ${y - size * .62} v${size * 1.24}`} stroke="#59696e" strokeWidth="1.1" /></g>;
}

function WireDuct({ x, y, width, height, vertical = false }: { x: number; y: number; width: number; height: number; vertical?: boolean }) {
  const count = Math.max(3, Math.floor((vertical ? height : width) / 14));
  return <g aria-hidden="true" className="qdc-wire-duct">
    <rect x={x + 2.2} y={y + 3.2} width={width} height={height} rx="3.5" fill="#26363d" opacity=".18" />
    <rect x={x} y={y} width={width} height={height} rx="3.5" fill="url(#qdc-duct-plastic)" stroke="#aab6b5" />
    <rect x={vertical ? x + 5 : x + 3} y={vertical ? y + 3 : y + 5} width={vertical ? width - 10 : width - 6} height={vertical ? height - 6 : height - 10} rx="2.5" fill="#d5ddda" stroke="#c3cdca" strokeWidth=".8" />
    <path d={vertical ? `M${x + 4} ${y + 3} V${y + height - 3} M${x + width - 4} ${y + 3} V${y + height - 3}` : `M${x + 3} ${y + 4} H${x + width - 3} M${x + 3} ${y + height - 4} H${x + width - 3}`} fill="none" stroke="#fff" strokeOpacity=".86" strokeWidth="1.2" />
    {Array.from({ length: count }, (_, index) => vertical
      ? <g key={index}><rect x={x + 3} y={y + 7 + index * (height - 14) / Math.max(count - 1, 1) - 2.2} width={width - 6} height="4.4" rx="2.2" fill="#879595" /><path d={`M${x + 5} ${y + 6 + index * (height - 14) / Math.max(count - 1, 1)} H${x + width - 5}`} stroke="#f8faf7" strokeOpacity=".7" /></g>
      : <g key={index}><rect x={x + 7 + index * (width - 14) / Math.max(count - 1, 1) - 2.2} y={y + 3} width="4.4" height={height - 6} rx="2.2" fill="#879595" /><path d={`M${x + 6 + index * (width - 14) / Math.max(count - 1, 1)} ${y + 5} V${y + height - 5}`} stroke="#f8faf7" strokeOpacity=".7" /></g>)}
    <path d={vertical ? `M${x + width / 2 - 2} ${y + 5} V${y + height - 5}` : `M${x + 5} ${y + height / 2 - 2} H${x + width - 5}`} stroke="#fff" strokeOpacity=".72" strokeWidth="2" />
  </g>;
}

const Cabinet = memo(function Cabinet({ project, mode }: { project: Project; mode: ViewMode }) {
  const size = boardSize(project), railWidth = project.modulesPerRail * MODULE;
  const technical = mode === 'schematic' || mode === 'labels';
  return <g aria-hidden="true" pointerEvents="none">
    <defs>
      <linearGradient id="qdc-cabinet-shell" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbfcfa" /><stop offset=".48" stopColor="#e9eeec" /><stop offset="1" stopColor="#cbd4d4" /></linearGradient>
      <linearGradient id="qdc-backplate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbfcfb" /><stop offset=".55" stopColor="#f0f3f1" /><stop offset="1" stopColor="#e3e8e6" /></linearGradient>
      <linearGradient id="qdc-rail-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8f9b9d" /><stop offset=".16" stopColor="#f4f6f5" /><stop offset=".38" stopColor="#b8c2c2" /><stop offset=".62" stopColor="#eef1ef" /><stop offset="1" stopColor="#879598" /></linearGradient>
      <linearGradient id="qdc-fastener-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f7f8f6" /><stop offset=".5" stopColor="#c9cfcd" /><stop offset="1" stopColor="#8e9a9c" /></linearGradient>
      <linearGradient id="qdc-duct-plastic" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f7f9f6" /><stop offset=".58" stopColor="#e3e8e4" /><stop offset="1" stopColor="#cbd3d0" /></linearGradient>
      <linearGradient id="qdc-cabinet-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".18" stopColor="#e7ece9" /><stop offset=".84" stopColor="#bac5c4" /><stop offset="1" stopColor="#93a1a3" /></linearGradient>
      <pattern id="qdc-backplate-grain" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".55" fill="#77898d" opacity=".18" /><circle cx="8" cy="7" r=".38" fill="#fff" opacity=".8" /></pattern>
    </defs>
    {!technical && <><rect x="19" y="24" width={size.width - 24} height={size.height - 24} rx="14" fill="#132a34" opacity=".2" /><path d={`M25 20 H${size.width - 22} Q${size.width - 8} 20 ${size.width - 8} 35 V${size.height - 20}`} fill="none" stroke="#162b33" strokeOpacity=".12" strokeWidth="6" /></>}
    <rect x="12" y="12" width={size.width - 24} height={size.height - 24} rx={technical ? 3 : 13} fill={technical ? '#fff' : 'url(#qdc-cabinet-shell)'} stroke={technical ? '#a7b3b9' : '#8f9d9f'} strokeWidth="1.5" />
    {!technical && <><rect x="18" y="18" width={size.width - 36} height={size.height - 36} rx="10" fill="none" stroke="url(#qdc-cabinet-rim)" strokeWidth="6" /><rect x="22" y="22" width={size.width - 44} height={size.height - 44} rx="8" fill="none" stroke="#4b5f65" strokeOpacity=".38" strokeWidth="1.2" /></>}
    <rect x="27" y="27" width={size.width - 54} height={size.height - 54} rx={technical ? 1 : 5} fill={technical ? '#fff' : 'url(#qdc-backplate)'} stroke={technical ? '#e4e9eb' : '#c3cdcb'} />
    {!technical && <>
      <rect x="29" y="29" width={size.width - 58} height={size.height - 58} rx="4" fill="url(#qdc-backplate-grain)" opacity=".48" />
      <path d={`M29 29 H${size.width - 29} M29 29 V${size.height - 29}`} fill="none" stroke="#fff" strokeOpacity=".82" strokeWidth="2.5" />
      <path d={`M${size.width - 29} 31 V${size.height - 29} H31`} fill="none" stroke="#aeb9b8" strokeOpacity=".5" strokeWidth="2" />
      {[42, size.width - 42].flatMap(x => [42, size.height - 42].map(y => <Screw key={`${x}-${y}`} x={x} y={y} size={6} />))}
      <WireDuct x={48} y={76} width={22} height={size.height - 152} vertical />
      <WireDuct x={size.width - 70} y={76} width={22} height={size.height - 152} vertical />
      <WireDuct x={76} y={78} width={size.width - 152} height={20} />
      {project.rails > 1 && Array.from({ length: project.rails - 1 }, (_, index) => <WireDuct key={index} x={76} y={TOP + index * RAIL + DEVICE_HEIGHT + 51} width={size.width - 152} height={20} />)}
      <g transform={`translate(${size.width - 37} ${size.height / 2})`}><rect x="-6" y="-22" width="12" height="44" rx="4" fill="#a8b3b3" stroke="#7f8f91" /><path d="M-2 -14 H3 M-2 0 H3 M-2 14 H3" fill="none" stroke="#e8ece9" strokeWidth="2" /></g>
      <g transform={`translate(36 ${size.height / 2})`}><rect x="-4" y="-20" width="8" height="40" rx="3" fill="#a9b4b4" stroke="#7f8f91" /><circle cy="-11" r="2.2" fill="#66777b" /><circle cy="11" r="2.2" fill="#66777b" /></g>
    </>}
    <text x={LEFT} y="58" fill="#43565f" fontSize="11" fontWeight="750" letterSpacing="1.25">{mode === 'schematic' ? 'DIAGRAMA DE CONEXÕES' : mode === 'labels' ? 'IDENTIFICAÇÃO DOS CIRCUITOS' : 'QUADRO DE DISTRIBUIÇÃO'}</text>
    <g transform={`translate(${size.width - LEFT - 42} 43)`}><rect width="42" height="22" rx="3" fill={technical ? '#fff' : '#f7f9f6'} stroke="#bac4c4" /><text x="21" y="14.5" textAnchor="middle" fill="#53666e" fontSize="9" fontWeight="700">{project.boardType === 'fishbone' ? `${project.fishbone?.slots.length ?? 0} P` : `${project.modulesPerRail * project.rails} M`}</text></g>
    {Array.from({ length: project.rails }, (_, rail) => {
      const y = TOP + rail * RAIL;
      return <g key={rail}>
        {mode !== 'realistic' && <g transform={`translate(${LEFT - 31} ${y + 41})`}><rect width="18" height="44" rx="3" fill={technical ? '#fff' : '#e9edeb'} stroke="#b9c3c2" /><text x="9" y="22" transform="rotate(-90 9 22)" textAnchor="middle" fill="#6c7c81" fontSize="7" fontWeight="700" letterSpacing="1">T{String(rail + 1).padStart(2, '0')}</text></g>}
        {!technical && <rect x={LEFT - 7} y={y + 52} width={railWidth + 18} height="36" rx="2" fill="#20323a" opacity=".2" />}
        <path d={`M${LEFT - 9} ${y + 48} H${LEFT + railWidth + 9} V${y + 55} H${LEFT + railWidth + 4} V${y + 76} H${LEFT + railWidth + 9} V${y + 83} H${LEFT - 9} V${y + 76} H${LEFT - 4} V${y + 55} H${LEFT - 9} Z`} fill={technical ? '#f5f7f8' : 'url(#qdc-rail-metal)'} stroke="#758487" strokeWidth="1.1" />
        <path d={`M${LEFT - 7} ${y + 51} H${LEFT + railWidth + 7} M${LEFT - 2} ${y + 57} H${LEFT + railWidth + 2} M${LEFT - 2} ${y + 74} H${LEFT + railWidth + 2} M${LEFT - 7} ${y + 80} H${LEFT + railWidth + 7}`} fill="none" stroke={technical ? '#bdc7cb' : '#f7f9f7'} strokeOpacity={technical ? 1 : .82} strokeWidth="1.2" />
        {Array.from({ length: project.modulesPerRail }, (_, slot) => <g key={slot}>
          <rect x={LEFT + slot * MODULE + 16} y={y + 61} width="12" height="7" rx="3.5" fill={technical ? '#dce3e6' : '#6f7e82'} stroke="#e3e8e6" strokeWidth=".7" />
          {!technical && <path d={`M${LEFT + slot * MODULE + 19} ${y + 63} H${LEFT + slot * MODULE + 25}`} stroke="#4e5e63" strokeWidth=".8" />}
        </g>)}
        {!technical && <><Screw x={LEFT - 2} y={y + 65} size={3.5} /><Screw x={LEFT + railWidth + 2} y={y + 65} size={3.5} /></>}
        <rect x={LEFT - 2} y={y + DEVICE_HEIGHT + 24} width={railWidth + 4} height="25" rx="2" fill={technical ? '#fff' : '#f7f8f4'} stroke="#bec8c6" />
        <path d={`M${LEFT + 2} ${y + DEVICE_HEIGHT + 29} H${LEFT + railWidth - 2}`} fill="none" stroke="#fff" strokeWidth="1.5" />
        {mode !== 'realistic' && Array.from({ length: project.modulesPerRail }, (_, slot) => <text key={slot} x={LEFT + (slot + .5) * MODULE} y={y + DEVICE_HEIGHT + 41} textAnchor="middle" fill="#7b888b" fontSize="7" fontFamily="monospace">{String(slot + 1).padStart(2, '0')}</text>)}
      </g>;
    })}
    {!technical && <g transform={`translate(${LEFT - 34} ${size.height - 63})`}><circle r="9" fill="#d9b83f" stroke="#92791f" /><path d="M0 -5 V2 M-6 2 H6 M-4 5 H4 M-2 8 H2" fill="none" stroke="#294149" strokeWidth="1.4" /></g>}
    <text x={LEFT} y={size.height - 43} fill="#576b73" fontSize="9" fontWeight="650">ELETRICAWEB · {project.widthMm} × {project.heightMm} mm</text>
    <text x={size.width - LEFT} y={size.height - 43} textAnchor="end" fill="#788589" fontSize="7.5">REPRESENTAÇÃO VISUAL · SEM ESCALA</text>
  </g>;
});

const WireDrawing = memo(function WireDrawing({ wire, selected, dimmed, editable, mode, onSelect }: { wire: Wire; selected: boolean; dimmed: boolean; editable: boolean; mode: ViewMode; onSelect(): void }) {
  const d = mode === 'schematic' ? pathData(wire.path) : roundedWirePath(wire.path), earth = wire.conductorType === 'earth';
  const greenYellow = earth && isGreenYellowWire(wire.color);
  const light = ['#f4f4ef', '#ffffff'].includes(wire.color.toLowerCase());
  const strokeWidth = mode === 'schematic' ? 1.7 : 2.6 + Math.sqrt(wire.gauge ?? 1.5) * .65;
  const segments = wire.path.slice(1).map((end, i) => ({ start: wire.path[i], end, length: Math.abs(end.x - wire.path[i].x) + Math.abs(end.y - wire.path[i].y) }));
  const longest = segments.filter(segment => segment.start.y === segment.end.y).sort((a, b) => b.length - a.length)[0];
  const labelPoint = longest ? { x: (longest.start.x + longest.end.x) / 2, y: longest.start.y } : wire.path[Math.floor(wire.path.length / 2)];
  const opacity = mode === 'labels' ? dimmed ? .12 : .45 : dimmed ? .32 : 1;
  return <g className={`qdc-wire${dimmed ? ' is-dimmed' : ''}`} opacity={opacity} data-wire={wire.id} pointerEvents={editable ? undefined : 'none'} role="button" tabIndex={editable ? 0 : -1} aria-disabled={!editable} aria-label={`Selecionar fio ${wire.label || wire.conductorType}, ${wire.gauge ?? 'sem'} milímetros quadrados`} aria-pressed={selected} onPointerDown={event => { if (!editable) return; event.stopPropagation(); if (event.button === 0) onSelect(); }} onKeyDown={event => { if (editable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); onSelect(); } }}>
    <title>{wire.label || 'Condutor'} · {wire.gauge === null ? 'Bitola não informada' : `${wire.gauge} mm²`}</title>
    <path d={d} fill="none" stroke="transparent" strokeWidth="18" strokeLinejoin="round" />
    {selected && <path data-qdc-editor-only="true" d={d} fill="none" stroke="#f3c519" strokeWidth={strokeWidth + 7} strokeLinejoin="round" strokeLinecap="round" opacity=".9" />}
    {mode === 'realistic' && <path d={d} transform="translate(0 2.2)" fill="none" stroke="#14262d" strokeOpacity=".25" strokeWidth={strokeWidth + 3.2} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />}
    {mode === 'realistic' && <path d={d} fill="none" stroke="#18282f" strokeOpacity=".36" strokeWidth={strokeWidth + 1.6} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />}
    {light && <path d={d} fill="none" stroke="#66757c" strokeWidth={strokeWidth + 1.8} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />}
    <path d={d} fill="none" stroke={earth ? wire.color : wire.color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />
    {greenYellow && <path d={d} fill="none" stroke="#edda40" strokeWidth={Math.max(1.3, strokeWidth * .42)} strokeDasharray="8 8" strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />}
    {mode === 'realistic' && <path d={d} transform="translate(-.45 -.65)" fill="none" stroke="#fff" strokeOpacity={light ? .35 : .22} strokeWidth={Math.max(.7, strokeWidth * .18)} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />}
    {labelPoint && (selected || mode === 'installation') && <g pointerEvents="none" transform={selected ? 'translate(0 -22)' : undefined}>
      <rect x={labelPoint.x - 29} y={labelPoint.y - 10} width="58" height="18" rx="4" fill="#fff" stroke={selected ? '#bd9a14' : '#a7b6be'} />
      <text x={labelPoint.x} y={labelPoint.y + 2} textAnchor="middle" fill="#283a44" fontSize="9" fontWeight="600">{wire.gauge === null ? '? mm²' : `${wire.gauge} mm²`}</text>
    </g>}
  </g>;
});

function WireEndpoint({ point, toward, wire, count, termination }: { point: Point; toward: Point; wire: Wire; count: number; termination: WireTermination }) {
  const earth = wire.conductorType === 'earth';
  const greenYellow = earth && isGreenYellowWire(wire.color);
  const ferrule = ferruleColor(wire.gauge);
  const angle = Math.atan2(toward.y - point.y, toward.x - point.x) * 180 / Math.PI;
  const conductorColor = wire.color;
  return <g className="qdc-wire-endpoint" pointerEvents="none" aria-hidden="true">
    {termination === 'sem-terminal' ? <circle cx={point.x} cy={point.y} r="3.7" fill={wire.color} stroke={greenYellow ? '#f0d53a' : '#fff'} strokeWidth={greenYellow ? 1.5 : .9} /> :
      termination === 'tubular' ? <g transform={`translate(${point.x} ${point.y}) rotate(${angle})`}>
        <rect x="1" y="-3.4" width="11" height="6.8" rx="3.2" fill={conductorColor} stroke="#34464d" strokeWidth=".8" />
        {greenYellow && <path d="M4 -3.2 V3.2 M9 -3.2 V3.2" stroke="#ecd83c" strokeWidth="1.6" />}
        <rect x="-5.2" y="-4.4" width="9" height="8.8" rx="2.8" fill={ferrule.hex} stroke="#3e4d54" strokeWidth="1" />
        <rect x="-2.2" y="-2.35" width="6.4" height="4.7" rx="1.4" fill="url(#qdc-fastener-metal)" stroke="#66767b" strokeWidth=".7" />
        <path d="M-1.2 -1.2 H2.9" stroke="#fff" strokeOpacity=".8" strokeWidth=".8" />
      </g> :
      termination === 'generico' ? <><rect x={point.x - 7} y={point.y - 5} width="14" height="10" rx="2" fill="#d4d8d6" stroke="#46565c" strokeWidth="1.1" /><circle cx={point.x - 3.5} cy={point.y} r="2.1" fill="#6b777b" /><path d={`M${point.x + 1} ${point.y} H${point.x + 7}`} stroke="#9a6a30" strokeWidth="2.5" /></> :
      termination === 'olhal' ? <><circle cx={point.x} cy={point.y} r="7" fill="#c4cbcb" stroke="#46565c" /><circle cx={point.x} cy={point.y} r="3" fill="#fff" stroke="#46565c" /></> :
      termination === 'garfo' ? <path d={`M${point.x - 7} ${point.y - 6} L${point.x} ${point.y} L${point.x + 7} ${point.y - 6} M${point.x} ${point.y} V${point.y + 5}`} fill="none" stroke="#9c6b2d" strokeWidth="3" /> :
      termination === 'pente' ? <path d={`M${point.x - 7} ${point.y + 4} H${point.x + 7} M${point.x - 5} ${point.y + 4} V${point.y - 5} M${point.x} ${point.y + 4} V${point.y - 5} M${point.x + 5} ${point.y + 4} V${point.y - 5}`} stroke="#a8732e" strokeWidth="2.5" /> :
      <><circle cx={point.x} cy={point.y} r="5.4" fill="#c7cecf" stroke="#43545c" /><circle cx={point.x} cy={point.y} r="2.3" fill={wire.color} /></>}
    {count > 1 && <g transform={`translate(${point.x + 7} ${point.y - 8})`}><circle r="5.5" fill="#f3c729" stroke="#6d5b13" strokeWidth=".8" /><text y="2.4" textAnchor="middle" fill="#263840" fontSize="6.5" fontWeight="800">{count}</text></g>}
  </g>;
}

function BoardCanvas({ project, selection, layers, tool, mode, viewport, highlightedConnections, movePreview, onViewport, onSelect, onMove, onMoveFishbone, onMovePlane, onAdd, onTerminal, onConnect, onWirePath, wireStart, wireOptions, onContextMenu, onMessage }: BoardCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null), cameraRef = useRef<SVGGElement>(null);
  const gesture = useRef<Gesture | null>(null), spaceDown = useRef(false);
  const wirePointGesture = useRef<WirePointGesture | null>(null);
  const leadGesture = useRef<LeadGesture | null>(null);
  const [moving, setMoving] = useState<MovePreview | null>(null);
  const [drop, setDrop] = useState<DropPreview | null>(null);
  const [marquee, setMarquee] = useState<{ start: Point; end: Point } | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [leadTip, setLeadTip] = useState<Point | null>(null);
  const [leadSource, setLeadSource] = useState<Endpoint | null>(null);
  const [hoveredExit, setHoveredExit] = useState<string | null>(null);
  const [snapTarget, setSnapTarget] = useState<SnapTarget | null>(null);
  const [panning, setPanning] = useState(false);
  const [wirePreview, setWirePreview] = useState<{ wireId: string; path: Point[] } | null>(null);
  const [wireGuide, setWireGuide] = useState<{ x: number | null; y: number | null } | null>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const [hintDismissed, setHintDismissed] = useState(false);
  const size = boardSize(project);
  const snapPoints = useMemo(() => project.devices.flatMap(device => device.terminals.flatMap(terminal => {
    const point = terminalPoint(project, device.id, terminal.id);
    return point ? [{ device, terminal, point }] : [];
  })), [project]);
  const canEditComponents = canEditLayer(layers, 'components');
  const canEditWires = canEditLayer(layers, 'wires');
  const handleScale = 1 / Math.max(.2, canvasScale * viewport.zoom);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const matrix = svg.getScreenCTM();
      if (matrix) setCanvasScale(Math.hypot(matrix.a, matrix.b));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(svg); measure();
    return () => observer.disconnect();
  }, [size.width, size.height]);

  function clientPoint(clientX: number, clientY: number, world = true): Point {
    const svg = svgRef.current, matrix = (world ? cameraRef.current : svg)?.getScreenCTM();
    if (!svg || !matrix) return { x: 0, y: 0 };
    const point = svg.createSVGPoint(); point.x = clientX; point.y = clientY;
    const result = point.matrixTransform(matrix.inverse());
    return { x: result.x, y: result.y };
  }

  function cancelGesture() {
    const active = gesture.current;
    const wireActive = wirePointGesture.current;
    const leadActive = leadGesture.current;
    gesture.current = null; wirePointGesture.current = null;
    if (active && svgRef.current?.hasPointerCapture(active.pointerId)) svgRef.current.releasePointerCapture(active.pointerId);
    if (wireActive && svgRef.current?.hasPointerCapture(wireActive.pointerId)) svgRef.current.releasePointerCapture(wireActive.pointerId);
    if (leadActive && svgRef.current?.hasPointerCapture(leadActive.pointerId)) svgRef.current.releasePointerCapture(leadActive.pointerId);
    leadGesture.current = null; setCursor(null); setLeadTip(null); setLeadSource(null);
    gesture.current = null; setMoving(null); setMarquee(null); setPanning(false); setDrop(null);
    wirePointGesture.current = null; setWirePreview(null); setWireGuide(null); setSnapTarget(null);
  }

  function updateWireSnap(point: Point, source: Endpoint | null = wireStart, conductor: WireOptions['conductorType'] = wireOptions.conductorType): SnapTarget | null {
    if (!source) { setSnapTarget(null); return null; }
    const radius = 26 * handleScale;
    let nearest: SnapTarget | null = null;
    let nearestDistance = radius;
    for (const { device, terminal, point: terminalPosition } of snapPoints) {
      const distance = Math.hypot(terminalPosition.x - point.x, terminalPosition.y - point.y);
      if (distance > nearestDistance) continue;
      const endpoint = { componentId: device.id, terminalId: terminal.id };
      if (endpoint.componentId === source.componentId && endpoint.terminalId === source.terminalId) continue;
      nearestDistance = distance;
      nearest = { ...endpoint, point: terminalPosition, label: `${device.label} · ${terminal.label}`, issue: connectionIssue(project, source, endpoint, conductor) };
    }
    setSnapTarget(current => current?.componentId === nearest?.componentId && current?.terminalId === nearest?.terminalId && current?.issue === nearest?.issue ? current : nearest);
    return nearest;
  }

  function beginWireEdit(event: ReactPointerEvent<SVGGElement>, wire: Wire, kind: WirePointGesture['kind'], index: number) {
    if (event.button !== 0 || tool !== 'select') return;
    event.preventDefault(); event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    const path = wire.path.map(point => ({ ...point }));
    const anchor = kind === 'point' ? path[index] : { x: (path[index].x + path[index + 1].x) / 2, y: (path[index].y + path[index + 1].y) / 2 };
    wirePointGesture.current = { pointerId: event.pointerId, wireId: wire.id, kind, index, origin: clientPoint(event.clientX, event.clientY), anchor, basePath: path, path, moved: false };
    setWirePreview({ wireId: wire.id, path: wire.path.map(point => ({ ...point })) });
  }

  function nudgeWire(event: ReactKeyboardEvent<SVGGElement>, wire: Wire, kind: WirePointGesture['kind'], index: number, origin: Point) {
    const amount = event.shiftKey ? 2 : 8;
    const target = { ...origin };
    if (kind === 'segment') {
      const start = wire.path[index], end = wire.path[index + 1];
      const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
      if (horizontal && event.key === 'ArrowUp') target.y -= amount;
      else if (horizontal && event.key === 'ArrowDown') target.y += amount;
      else if (!horizontal && event.key === 'ArrowLeft') target.x -= amount;
      else if (!horizontal && event.key === 'ArrowRight') target.x += amount;
      else return;
    } else {
      if (event.key === 'ArrowUp') target.y -= amount;
      else if (event.key === 'ArrowDown') target.y += amount;
      else if (event.key === 'ArrowLeft') target.x -= amount;
      else if (event.key === 'ArrowRight') target.x += amount;
      else return;
    }
    event.preventDefault(); event.stopPropagation();
    onWirePath(wire.id, kind === 'point' ? bendWirePoint(wire.path, index, target) : flexWireSegment(wire.path, index, target));
  }

  function deleteWireBend(event: ReactSyntheticEvent<SVGGElement>, wire: Wire, index: number) {
    event.preventDefault(); event.stopPropagation();
    const path = removeWireBend(wire.path, index);
    if (path === wire.path) { onMessage('Essa dobra é necessária para manter o caminho ortogonal do fio.'); return; }
    onWirePath(wire.id, path);
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

  function begin(event: ReactPointerEvent<SVGElement>, kind: Gesture['kind'], ids: string[] = [], free = false) {
    if (event.button !== 0 && event.button !== 1) return;
    event.preventDefault();
    svgRef.current?.setPointerCapture(event.pointerId);
    gesture.current = { kind, origin: clientPoint(event.clientX, event.clientY), rootOrigin: clientPoint(event.clientX, event.clientY, false), initialViewport: viewport, ids, additive: event.shiftKey, pointerId: event.pointerId, moved: false, free };
    if (kind === 'pan') setPanning(true);
  }

  function onDeviceDown(event: ReactPointerEvent<SVGGElement>, device: Device) {
    if (!canEditComponents) return;
    event.stopPropagation();
    if (event.button === 1 || tool === 'pan' || spaceDown.current) { begin(event, 'pan'); return; }
    if (event.button !== 0) return;
    if (tool === 'wire') { onMessage('Clique no terminal de entrada ou saída para conectar o fio.'); return; }
    const included = selection.devices.includes(device.id);
    const ids = event.shiftKey ? included ? selection.devices.filter(id => id !== device.id) : [...selection.devices, device.id] : included ? selection.devices : [device.id];
    onSelect({ devices: ids, wire: null });
    const selectedDevices = project.devices.filter(item => ids.includes(item.id));
    const hasEdgeDevice = selectedDevices.some(item => deviceMount(item) === 'edge');
    const freeDevice = selectedDevices.length === 1 && ['power-entry', 'conduit-entry'].includes(selectedDevices[0].type);
    const canMove = !hasEdgeDevice || freeDevice;
    if (ids.includes(device.id) && canMove) begin(event, 'move', ids, freeDevice);
  }

  function nudgeDevice(event: ReactKeyboardEvent<SVGGElement>, device: Device) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) || tool !== 'select') return;
    event.preventDefault(); event.stopPropagation();
    const ids = selection.devices.includes(device.id) ? selection.devices : [device.id];
    if (!selection.devices.includes(device.id)) onSelect({ devices: ids, wire: null });
    if (device.fishboneSlotId && project.fishbone) {
      const current = project.fishbone.slots.find(slot => slot.id === device.fishboneSlotId);
      const side = event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : current?.side;
      const position = (current?.position ?? 0) + (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0);
      const target = project.fishbone.slots.find(slot => slot.side === side && slot.position === position);
      if (!target || fishboneSlotIssue(project, device, target.id)) { onMessage('Não há encaixe lateral compatível nessa posição.'); return; }
      onMoveFishbone(device.id, target.id); return;
    }
    const devices = project.devices.filter(item => ids.includes(item.id));
    const freeDevice = devices.length === 1 && ['power-entry', 'conduit-entry'].includes(device.type) && !!device.canvasPosition;
    if (freeDevice) {
      const amount = event.shiftKey ? 2 : 8;
      const rect = deviceRect(device, project);
      const position = {
        x: rect.x + (event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0),
        y: rect.y + (event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0),
      };
      const preview = deviceRect({ ...device, canvasPosition: position }, project), bounds = boardSize(project);
      if (preview.x < 0 || preview.y < 0 || preview.x + preview.width > bounds.width || preview.y + preview.height > bounds.height) {
        onMessage('Movimento cancelado: a entrada precisa ficar dentro do quadro.');
        return;
      }
      onMovePlane(device.id, position);
      return;
    }
    if (devices.some(item => deviceMount(item) === 'edge')) {
      onMessage('Para mover esta entrada com as setas, altere o posicionamento para “Livre no plano” nas propriedades.');
      return;
    }
    const rail = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    const slot = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (!validPositions(project, devices, rail, slot)) {
      onMessage('Movimento cancelado: posição ocupada ou fora do quadro.');
      return;
    }
    onMove(ids, rail, slot);
  }

  function openDeviceMenu(event: ReactKeyboardEvent<SVGGElement>, device: Device) {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return false;
    event.preventDefault(); event.stopPropagation();
    if (!selection.devices.includes(device.id)) onSelect({ devices: [device.id], wire: null });
    const bounds = event.currentTarget.getBoundingClientRect();
    onContextMenu(bounds.left + Math.min(bounds.width, 28), bounds.top + Math.min(bounds.height, 28), device.id);
    return true;
  }

  function movePointer(event: ReactPointerEvent<SVGSVGElement>) {
    const point = clientPoint(event.clientX, event.clientY), active = gesture.current;
    const lead = leadGesture.current;
    if (lead && lead.pointerId === event.pointerId) {
      lead.moved ||= Math.hypot(event.clientX - lead.clientX, event.clientY - lead.clientY) > 4;
      setCursor(point);
      const terminal = project.devices.find(device => device.id === lead.source.componentId)?.terminals.find(item => item.id === lead.source.terminalId);
      updateWireSnap(point, lead.source, terminal?.kind === 'N' ? 'neutral' : terminal?.kind === 'PE' ? 'earth' : 'phase');
      return;
    }
    if (tool === 'wire' && wireStart) { setCursor(point); updateWireSnap(point); }
    const wireActive = wirePointGesture.current;
    if (wireActive && wireActive.pointerId === event.pointerId) {
      const delta = { x: point.x - wireActive.origin.x, y: point.y - wireActive.origin.y };
      if (!wireActive.moved && Math.hypot(delta.x, delta.y) / handleScale < 3) return;
      const grid = event.shiftKey ? .5 : 2;
      let snapped = {
        x: Math.max(0, Math.min(size.width, Math.round((wireActive.anchor.x + delta.x) / grid) * grid)),
        y: Math.max(0, Math.min(size.height, Math.round((wireActive.anchor.y + delta.y) / grid) * grid)),
      };
      let guide: { x: number | null; y: number | null } = { x: null, y: null };
      if (!event.altKey) {
        const otherPoints = project.wires.filter(wire => wire.id !== wireActive.wireId).flatMap(wire => wire.path);
        const xGuides = [48, 59, 70, LEFT, size.width / 2, size.width - LEFT, size.width - 70, size.width - 59, size.width - 48, ...otherPoints.map(item => item.x)];
        const ductY = Array.from({ length: Math.max(0, project.rails - 1) }, (_, index) => TOP + index * RAIL + DEVICE_HEIGHT + 61);
        const yGuides = [58, 76, 88, size.height / 2, size.height - 76, ...ductY, ...otherPoints.map(item => item.y)];
        const result = snapWirePoint(snapped, xGuides, yGuides, 6 * handleScale);
        snapped = result.point; guide = result.guide;
        if (wireActive.kind === 'segment') {
          const start = wireActive.basePath[wireActive.index], end = wireActive.basePath[wireActive.index + 1];
          const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
          guide = horizontal ? { x: null, y: guide.y } : { x: guide.x, y: null };
        }
      }
      setWireGuide(guide.x === null && guide.y === null ? null : guide);
      const path = wireActive.kind === 'point'
        ? bendWirePoint(wireActive.basePath, wireActive.index, snapped)
        : flexWireSegment(wireActive.basePath, wireActive.index, snapped);
      wireActive.path = path; wireActive.moved = true; setWirePreview({ wireId: wireActive.wireId, path }); return;
    }
    if (!active) return;
    const rootPoint = clientPoint(event.clientX, event.clientY, false);
    if (Math.hypot(rootPoint.x - active.rootOrigin.x, rootPoint.y - active.rootOrigin.y) > 4 / viewport.zoom) active.moved = true;
    if (active.kind === 'pan') onViewport({ ...active.initialViewport, x: active.initialViewport.x + rootPoint.x - active.rootOrigin.x, y: active.initialViewport.y + rootPoint.y - active.rootOrigin.y });
    if (active.kind === 'move' && active.moved) {
      const devices = project.devices.filter(device => active.ids.includes(device.id));
      if (project.boardType === 'fishbone' && devices.length === 1 && devices[0].fishboneSlotId) {
        const target = fishboneSlotAt(project, point);
        setMoving({ ids: active.ids, rail: 0, slot: 0, fishboneSlotId: target?.id, valid: Boolean(target && !fishboneSlotIssue(project, devices[0], target.id)) });
        return;
      }
      if (active.free && devices.length === 1) {
        const device = devices[0], rect = deviceRect(device, project);
        const plane = { x: Math.round((rect.x + point.x - active.origin.x) / 2) * 2, y: Math.round((rect.y + point.y - active.origin.y) / 2) * 2 };
        const probe = deviceRect({ ...device, canvasPosition: plane }, project), bounds = boardSize(project);
        setMoving({ ids: active.ids, rail: 0, slot: 0, plane, valid: probe.x >= 0 && probe.y >= 0 && probe.x + probe.width <= bounds.width && probe.y + probe.height <= bounds.height });
        return;
      }
      const rail = Math.round((point.y - active.origin.y) / RAIL), slot = Math.round((point.x - active.origin.x) / MODULE);
      setMoving({ ids: active.ids, rail, slot, valid: validPositions(project, devices, rail, slot) });
    }
    if (active.kind === 'marquee' && active.moved) setMarquee({ start: active.origin, end: point });
  }

  function clickDestination(point: Point) {
    if (!canEditComponents) return false;
    if (project.boardType === 'fishbone' && selection.devices.length === 1) {
      const selected = project.devices.find(device => device.id === selection.devices[0]);
      const target = fishboneSlotAt(project, point);
      if (selected?.fishboneSlotId && target) {
        const issue = fishboneSlotIssue(project, selected, target.id);
        if (issue) onMessage(issue); else onMoveFishbone(selected.id, target.id);
        return true;
      }
    }
    const rail = Math.round((point.y - TOP - DEVICE_HEIGHT / 2) / RAIL), slot = Math.floor((point.x - LEFT) / MODULE);
    if (rail < 0 || rail >= project.rails || slot < 0 || slot >= project.modulesPerRail || Math.abs(point.y - (TOP + rail * RAIL + DEVICE_HEIGHT / 2)) > DEVICE_HEIGHT / 2 + 12) return false;
    const anchor = project.devices.find(device => device.id === selection.devices[0]);
    if (!anchor) return false;
    const devices = project.devices.filter(device => selection.devices.includes(device.id));
    if (!validPositions(project, devices, rail - anchor.rail, slot - anchor.slot)) { onMessage('Essa posição está ocupada ou ultrapassa o trilho.'); return true; }
    onMove(selection.devices, rail - anchor.rail, slot - anchor.slot); return true;
  }

  function endPointer(event: ReactPointerEvent<SVGSVGElement>) {
    const lead = leadGesture.current;
    if (lead && lead.pointerId === event.pointerId) {
      const terminal = project.devices.find(device => device.id === lead.source.componentId)?.terminals.find(item => item.id === lead.source.terminalId);
      const target = lead.moved ? updateWireSnap(clientPoint(event.clientX, event.clientY), lead.source, terminal?.kind === 'N' ? 'neutral' : terminal?.kind === 'PE' ? 'earth' : 'phase') : null;
      if (target?.issue) onMessage(`${target.label}: ${target.issue}`);
      else if (target) onConnect(lead.source, { componentId: target.componentId, terminalId: target.terminalId });
      else if (!lead.moved) onTerminal(lead.source.componentId, lead.source.terminalId);
      else if (lead.moved) onMessage('Solte a ponta sobre um borne compatível. Nenhuma ligação foi criada.');
      cancelGesture(); return;
    }
    const wireActive = wirePointGesture.current;
    if (wireActive && wireActive.pointerId === event.pointerId) {
      if (wireActive.moved) onWirePath(wireActive.wireId, wireActive.path);
      cancelGesture(); return;
    }
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const point = clientPoint(event.clientX, event.clientY);
    if (active.kind === 'move' && active.moved) {
      const devices = project.devices.filter(device => active.ids.includes(device.id));
      if (project.boardType === 'fishbone' && devices.length === 1 && devices[0].fishboneSlotId) {
        const target = fishboneSlotAt(project, point);
        const issue = target ? fishboneSlotIssue(project, devices[0], target.id) : 'Solte sobre uma posição lateral da espinha.';
        if (issue) onMessage(issue); else onMoveFishbone(devices[0].id, target!.id, true);
        cancelGesture(); return;
      }
      if (active.free && devices.length === 1) {
        const device = devices[0], rect = deviceRect(device, project), plane = { x: Math.round((rect.x + point.x - active.origin.x) / 2) * 2, y: Math.round((rect.y + point.y - active.origin.y) / 2) * 2 };
        const preview = deviceRect({ ...device, canvasPosition: plane }, project), bounds = boardSize(project);
        if (preview.x >= 0 && preview.y >= 0 && preview.x + preview.width <= bounds.width && preview.y + preview.height <= bounds.height) onMovePlane(device.id, plane, true);
        else onMessage('Movimento cancelado: a entrada precisa ficar dentro do quadro.');
      } else {
      const rail = Math.round((point.y - active.origin.y) / RAIL), slot = Math.round((point.x - active.origin.x) / MODULE);
      if (validPositions(project, devices, rail, slot)) { if (rail || slot) onMove(active.ids, rail, slot, true); }
      else onMessage('Movimento cancelado: posição ocupada ou fora do quadro.');
      }
    }
    if (active.kind === 'marquee') {
      if (active.moved) {
        const box = { x: Math.min(active.origin.x, point.x), y: Math.min(active.origin.y, point.y), width: Math.abs(active.origin.x - point.x), height: Math.abs(active.origin.y - point.y) };
        const ids = canEditComponents ? project.devices.filter(device => { const r = deviceRect(device, project); return r.x < box.x + box.width && r.x + r.width > box.x && r.y < box.y + box.height && r.y + r.height > box.y; }).map(device => device.id) : [];
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
    if (project.boardType === 'fishbone' && item && isFishboneBreaker(item)) {
      const target = fishboneSlotAt(project, point);
      const probe = { id: '__drop__', type: item.type, poles: item.poles } as Device;
      return { type: item.type, rail: 0, slot: 0, modules: item.modules, fishboneSlotId: target?.id, valid: Boolean(target && !fishboneSlotIssue(project, probe, target.id)) };
    }
    const rail = Math.round((point.y - TOP - DEVICE_HEIGHT / 2) / RAIL), slot = Math.floor((point.x - LEFT) / MODULE);
    const modules = item?.modules ?? 1;
    const probe = item ? { ...project.devices[0], id: '__drop__', type: item.type, mount: item.mount, rail, slot, modules } as Device : null;
    return { type: item?.type || '', rail, slot, modules, valid: !!probe && (item?.mount === 'edge' || validPositions(project, [probe], 0, 0)) };
  }

  function zoomBy(factor: number) {
    const zoom = clampZoom(viewport.zoom * factor), center = { x: size.width / 2, y: size.height / 2 };
    onViewport({ zoom, x: center.x - (center.x - viewport.x) * zoom / viewport.zoom, y: center.y - (center.y - viewport.y) * zoom / viewport.zoom });
  }

  const startPoint = leadTip ?? (wireStart ? terminalPoint(project, wireStart.componentId, wireStart.terminalId) : null);
  const previewTarget = snapTarget?.point ?? cursor;
  const previewPath = startPoint && previewTarget ? roundedWirePath(startPoint.x === previewTarget.x || startPoint.y === previewTarget.y ? [startPoint, previewTarget] : [startPoint, { x: startPoint.x, y: previewTarget.y }, previewTarget], 9) : '';
  const activeDevices = new Set(selection.devices);
  const visibleWires = useMemo(() => project.wires.map(wire => wirePreview?.wireId === wire.id ? { ...wire, path: wirePreview.path } : wire), [project.wires, wirePreview]);
  const selectedWire = visibleWires.find(wire => wire.id === selection.wire);
  const focus = useMemo(() => highlightedConnections ?? canvasFocus(project, selection), [highlightedConnections, project, selection]);
  const endpointMarkers = useMemo(() => {
    const markers = new Map<string, { point: Point; toward: Point; wire: Wire; wireIds: string[]; count: number; termination: WireTermination }>();
    for (const wire of project.wires) {
    const endpoints = [
      { componentId: wire.sourceComponent, terminalId: wire.sourceTerminal, termination: wire.sourceTermination ?? 'tubular' as const, toward: wire.path[1] },
      { componentId: wire.targetComponent, terminalId: wire.targetTerminal, termination: wire.targetTermination ?? 'tubular' as const, toward: wire.path.at(-2) },
    ];
    for (const { componentId, terminalId, termination, toward } of endpoints) {
      const key = `${componentId}:${terminalId}`, point = terminalPoint(project, componentId, terminalId);
      if (!point) continue;
      const current = markers.get(key);
      if (current) { current.count++; current.wireIds.push(wire.id); }
      else markers.set(key, { point, toward: toward ?? point, wire, wireIds: [wire.id], count: 1, termination });
    }
    }
    return markers;
  }, [project]);
  const sourceEndpoint = leadTip ? leadSource : wireStart;
  const sourceTerminal = sourceEndpoint && project.devices.find(device => device.id === sourceEndpoint.componentId)?.terminals.find(terminal => terminal.id === sourceEndpoint.terminalId);
  const sourceConductor = sourceTerminal?.kind === 'N' ? 'neutral' : sourceTerminal?.kind === 'PE' ? 'earth' : sourceTerminal?.kind === 'L' ? 'phase' : wireOptions.conductorType;
  const focusText = focus && focus.wireIds.size > 1 ? `${focus.wireIds.size} conexões relacionadas em destaque · ` : '';
  const hint = leadTip ? snapTarget ? snapTarget.issue ? `${snapTarget.label}: ${snapTarget.issue}` : `${snapTarget.label}: solte para conectar` : 'Arraste a ponta até um borne compatível · Esc cancela' : tool === 'wire' ? wireStart ? snapTarget ? snapTarget.issue ? `${snapTarget.label}: ${snapTarget.issue}` : `${snapTarget.label}: clique para conectar` : 'Aproxime o ponteiro de um terminal · Esc cancela' : 'Clique em um terminal para começar a conexão' : tool === 'pan' ? 'Arraste a área de trabalho para navegar' : selectedWire ? `${focusText}Arraste as alças · Shift ajusta fino · Alt ignora o ímã · Duplo clique remove uma dobra` : selection.devices.length ? `${focusText}Arraste, use as setas ou escolha um espaço livre · Shift adiciona à seleção` : layers.focus === 'wires' ? 'Camada de fios ativa · selecione um fio ou use Passar fios' : !canEditComponents ? 'Camada de componentes bloqueada ou oculta · ajuste em Camadas' : 'Arraste a ponta livre do circuito até um borne · ou selecione um componente';

  return <section className={`qdc-canvas-shell qdc-canvas-${tool} qdc-mode-${mode}${panning ? ' is-panning' : ''}`} aria-label="Editor visual do quadro de distribuição" inert={Boolean(movePreview)}>
    <div className="qdc-canvas-stage">
      <svg ref={svgRef} data-qdc-export="true" xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${size.width} ${size.height}`} role="group" aria-label={`${project.name}. ${project.devices.length} dispositivos, ${project.wires.length} fios.`} tabIndex={0} className="qdc-board-svg" style={{ fontFamily: 'Arial, Helvetica, sans-serif', userSelect: 'none', touchAction: 'none' }}
        onPointerDown={event => { if (event.button === 1 || tool === 'pan' || spaceDown.current) begin(event, 'pan'); else if (tool === 'wire' && canEditWires && wireStart && snapTarget && event.button === 0) { event.preventDefault(); onTerminal(snapTarget.componentId, snapTarget.terminalId); setSnapTarget(null); } else if (tool === 'select' && canEditComponents && event.button === 0) begin(event, 'marquee'); }}
        onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={cancelGesture} onLostPointerCapture={() => { if (gesture.current || wirePointGesture.current || leadGesture.current) cancelGesture(); }} onPointerLeave={() => { if (!gesture.current && !leadGesture.current) { setCursor(null); setSnapTarget(null); } }}
        onContextMenu={event => { event.preventDefault(); if (!canEditComponents) return; const target = (event.target as Element).closest('[data-device]'); const id = target?.getAttribute('data-device') || undefined; if (id && !selection.devices.includes(id)) onSelect({ devices: [id], wire: null }); onContextMenu(event.clientX, event.clientY, id); }}
        onDragOver={event => { if (!canEditComponents || !event.dataTransfer.types.includes('application/qdc-device')) return; event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDrop(dropPreview(event)); }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null); }}
        onDrop={event => { event.preventDefault(); const preview = dropPreview(event); setDrop(null); if (!canEditComponents || !preview?.type) return; if (preview.valid) onAdd(preview.type, { rail: preview.rail, slot: preview.slot, fishboneSlotId: preview.fishboneSlotId }); else onMessage(project.boardType === 'fishbone' ? 'Escolha um encaixe lateral compatível e livre ou um espaço na área superior.' : 'Escolha um espaço livre com módulos suficientes no trilho.'); }}>
        <title>{project.name} — montagem visual do QDC</title>
        <g ref={cameraRef} data-qdc-viewport="true" transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          <Cabinet project={project} mode={mode} />
          {project.boardType === 'fishbone' && <FishboneArtwork project={project} mode={mode} highlightSlotId={moving?.fishboneSlotId ?? drop?.fishboneSlotId} highlightValid={moving?.valid ?? drop?.valid} />}
          {Array.from({ length: project.rails }, (_, rail) => Array.from({ length: project.modulesPerRail }, (_, slot) => {
            const x = LEFT + slot * MODULE, y = TOP + rail * RAIL;
            const occupied = project.devices.some(device => isRailMounted(device) && !device.fishboneSlotId && device.rail === rail && slot >= device.slot && slot < device.slot + device.modules);
            return !occupied && canEditComponents && <rect key={`${rail}-${slot}`} data-qdc-editor-only="true" className="qdc-empty-slot" x={x + 3} y={y + 5} width={MODULE - 6} height={DEVICE_HEIGHT - 10} rx="3" fill="transparent" stroke="transparent" strokeDasharray="3 3" role="button" aria-label={`Espaço livre, trilho ${rail + 1}, módulo ${slot + 1}${selection.devices.length ? '. Mover seleção para este espaço.' : ''}`} tabIndex={selection.devices.length && tool === 'select' ? 0 : -1} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); clickDestination({ x: x + 3, y: y + DEVICE_HEIGHT / 2 }); } }} />;
          }))}
          <g data-qdc-layer="wires" style={{ display: layers.wires.visible ? undefined : 'none' }}>{visibleWires.filter(wire => wire.id !== selection.wire).sort((a, b) => Number(focus?.wireIds.has(a.id)) - Number(focus?.wireIds.has(b.id))).concat(visibleWires.filter(wire => wire.id === selection.wire)).map(wire => <WireDrawing key={wire.id} wire={wire} selected={selection.wire === wire.id} dimmed={Boolean(movePreview?.wireIds.includes(wire.id) || focus && !focus.wireIds.has(wire.id))} editable={canEditWires} mode={mode} onSelect={() => onSelect({ devices: [], wire: wire.id })} />)}</g>
          <g data-qdc-layer="components" style={{ display: layers.components.visible ? undefined : 'none' }}>{[...project.devices].sort((a, b) => {
            const layer = (device: Device) => deviceMount(device) === 'edge' ? 0 : deviceMount(device) === 'rail' ? 1 : 2;
            return layer(a) - layer(b) || Number(activeDevices.has(a.id)) - Number(activeDevices.has(b.id));
          }).map(device => {
            const rect = deviceRect(device, project), selected = activeDevices.has(device.id), circuit = project.circuits.find(item => item.id === device.circuitId);
            const conduitConductors = device.type === 'conduit-entry' ? device.terminals.map(terminal => {
              const owner = circuitForOutputTerminal(project, terminal.id);
              return { id: terminal.id, color: owner ? circuitWireColor(owner, terminal) : terminal.kind === 'N' ? '#1686cf' : terminal.kind === 'PE' ? '#27854c' : '#20252b', kind: terminal.kind, circuit: owner ? owner.name.trim() || `C${owner.number}` : '' };
            }) : [];
            const identification = circuit?.name || device.label;
            const identificationLength = Math.max(5, Math.floor((rect.width - 14) / 5.3));
            const identificationLines = [identification.slice(0, identificationLength), identification.slice(identificationLength, identificationLength * 2)].filter(Boolean);
            const fishboneSlot = project.fishbone?.slots.find(slot => slot.id === device.fishboneSlotId);
            const positionLabel = fishboneSlot ? `espinha, lado ${fishboneSlot.side === 'left' ? 'esquerdo' : 'direito'}, posição ${fishboneSlot.position + 1}, fase ${fishboneSlot.phase}` : deviceMount(device) === 'edge' ? device.canvasPosition ? 'posicionamento livre no quadro' : `borda ${EDGE_LABELS[device.edgeSide ?? 'top']}` : `trilho ${device.rail + 1}, posição ${device.slot + 1}`;
            const dimmed = Boolean(focus && !focus.deviceIds.has(device.id));
            return <g key={device.id} data-device={device.id} className={`qdc-device${selected ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`} transform={`translate(${rect.x} ${rect.y})`} pointerEvents={!canEditComponents && !(device.type === 'conduit-entry' && canEditWires) && !(tool === 'wire' && canEditWires) || tool === 'wire' && deviceMount(device) === 'overlay' ? 'none' : undefined} role="button" tabIndex={!canEditComponents || tool === 'wire' && deviceMount(device) === 'overlay' ? -1 : 0} aria-disabled={!canEditComponents} aria-label={`${device.label}, ${device.poles} ${device.poles === 1 ? 'polo' : 'polos'}, ${device.amperage ?? 'corrente não definida'} amperes. ${positionLabel}. Use Enter para selecionar, as setas para mover e Shift mais F10 para abrir as ações.`} aria-pressed={selected} onPointerDown={event => onDeviceDown(event, device)} onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => { if (!canEditComponents) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); const ids = event.shiftKey ? selection.devices.includes(device.id) ? selection.devices.filter(id => id !== device.id) : [...selection.devices, device.id] : [device.id]; onSelect({ devices: ids, wire: null }); return; } if (!openDeviceMenu(event, device)) nudgeDevice(event, device); }} opacity={moving?.ids.includes(device.id) && (moving.rail || moving.slot) ? .4 : dimmed ? .62 : 1}>
              <title>{device.label}{circuit ? ` · C${circuit.number} ${circuit.name}` : ''} · {positionLabel} · Setas movem</title>
              <g className="qdc-device-body" transform={device.fishboneSlotId ? `scale(${rect.width / (device.modules * MODULE - 4)} ${rect.height / DEVICE_HEIGHT})` : device.visualRotation === 180 ? `rotate(180 ${rect.width / 2} ${rect.height / 2})` : undefined}><DeviceDrawing device={device} width={device.fishboneSlotId ? device.modules * MODULE - 4 : rect.width} height={device.fishboneSlotId ? DEVICE_HEIGHT : rect.height} mode={mode} visualModel={project.visualModel ?? 'classic'} dpsVisual={project.dpsVisual ?? 'red'} conduitConductors={conduitConductors} activeConduitTerminalId={device.terminals.some(terminal => terminal.id === hoveredExit) ? hoveredExit ?? undefined : sourceEndpoint?.componentId === device.id ? sourceEndpoint.terminalId : undefined} /></g>
              {mode === 'labels' && isRailMounted(device) && <g className="qdc-identification-card" pointerEvents="none">
                <rect x="5" y="32" width={rect.width - 10} height="65" rx="4" fill="#263940" fillOpacity=".12" transform="translate(0 2)" />
                <rect x="4" y="30" width={rect.width - 8} height="65" rx="4" fill="#fffef9" stroke={circuit?.color ?? '#9ba8ad'} strokeWidth="1.5" />
                <rect x="4" y="30" width={rect.width - 8} height="8" rx="4" fill={circuit?.color ?? '#9ba8ad'} />
                <text x={rect.width / 2} y="54" textAnchor="middle" fill="#263940" fontSize={rect.width < 58 ? 10 : 12} fontWeight="800">{circuit ? `C${circuit.number}` : 'S/C'}</text>
                {identificationLines.map((line, index) => <text key={line} x={rect.width / 2} y={70 + index * 11} textAnchor="middle" fill="#4b5d64" fontSize={rect.width < 58 ? 6.5 : 7.5} fontWeight="650">{line}</text>)}
              </g>}
              {selected && <g data-qdc-editor-only="true" className="qdc-device-selection" pointerEvents="none">
                <rect x="-5" y="-7" width={rect.width + 10} height={rect.height + 14} rx="6" fill="#f3cd24" fillOpacity=".06" stroke="#fff" strokeWidth="5" strokeOpacity=".92" />
                <rect x="-4" y="-6" width={rect.width + 8} height={rect.height + 12} rx="5" fill="none" stroke="#c89f12" strokeWidth="2.4" />
                <path d={`M${rect.width / 2 - 5} -9 H${rect.width / 2 + 5}`} stroke="#c89f12" strokeWidth="3.5" strokeLinecap="round" />
                {[[-6, -8], [rect.width + 1, -8], [-6, rect.height + 3], [rect.width + 1, rect.height + 3]].map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="5" height="5" rx="1.5" fill="#fffdf3" stroke="#a9840d" strokeWidth="1" />)}
              </g>}
              {device.terminals.map(terminal => {
                const terminalPosition = terminalPoint(project, device.id, terminal.id);
                if (!terminalPosition) return null;
                const x = terminalPosition.x - rect.x, y = terminalPosition.y - rect.y;
                const side = terminalSide(device, terminal.side);
                const screwX = side === 'left' ? Math.min(rect.width - 6, 12) : side === 'right' ? Math.max(6, rect.width - 12) : x;
                const screwY = side === 'top' ? 17 : side === 'bottom' ? rect.height - 17 : y;
                const active = wireStart?.componentId === device.id && wireStart.terminalId === terminal.id;
                const outputCircuit = device.type === 'conduit-entry' ? circuitForOutputTerminal(project, terminal.id) : undefined;
                const color = outputCircuit ? circuitWireColor(outputCircuit, terminal) : terminal.kind === 'N' ? '#2580b4' : terminal.kind === 'PE' ? '#408148' : terminal.kind === 'control' ? '#876691' : '#4a5b63';
                const magnetic = snapTarget?.componentId === device.id && snapTarget.terminalId === terminal.id;
                const connected = endpointMarkers.has(`${device.id}:${terminal.id}`);
                const candidate = sourceEndpoint && connectionIssue(project, sourceEndpoint, { componentId: device.id, terminalId: terminal.id }, sourceConductor);
                const compatible = Boolean(sourceEndpoint && !candidate && !(sourceEndpoint.componentId === device.id && sourceEndpoint.terminalId === terminal.id));
                const exit = device.type === 'conduit-entry';
                return <g key={terminal.id} data-terminal={`${device.id}:${terminal.id}`} className={`qdc-terminal${exit ? ' is-wire-exit' : ''}${tool === 'wire' || exit && !connected ? ' is-connectable' : ''}${sourceEndpoint ? sourceEndpoint.componentId === device.id && sourceEndpoint.terminalId === terminal.id ? ' is-source' : compatible ? ' is-compatible' : ' is-unavailable' : ''}${magnetic ? snapTarget.issue ? ' is-magnetic is-invalid' : ' is-magnetic is-valid' : ''}`} pointerEvents={canEditWires && (tool === 'wire' || exit && !connected) ? 'all' : undefined} role="button" tabIndex={canEditWires && (tool === 'wire' || exit && !connected) ? 0 : -1} aria-label={`${connected ? 'Conectado' : 'Ponta livre'} · ${terminal.label}${outputCircuit ? ` · ${outputCircuit.name}` : ''}`} onPointerEnter={() => exit && setHoveredExit(terminal.id)} onPointerLeave={() => exit && setHoveredExit(current => current === terminal.id ? null : current)} onFocus={() => exit && setHoveredExit(terminal.id)} onBlur={() => exit && setHoveredExit(current => current === terminal.id ? null : current)} onPointerDown={event => { if (!canEditWires && !canEditComponents) return; event.stopPropagation(); if (event.button === 1 || tool === 'pan' || spaceDown.current) { begin(event, 'pan'); return; } if (exit && !connected && canEditWires && layers.wires.visible && !wireStart && event.button === 0) { event.preventDefault(); svgRef.current?.setPointerCapture(event.pointerId); const source = { componentId: device.id, terminalId: terminal.id }; leadGesture.current = { pointerId: event.pointerId, source, tip: terminalPosition, clientX: event.clientX, clientY: event.clientY, moved: false }; setLeadSource(source); setLeadTip(terminalPosition); setCursor(terminalPosition); setSnapTarget(null); } else if (tool === 'wire' && canEditWires && event.button === 0) { event.preventDefault(); setCursor(null); setSnapTarget(null); onTerminal(device.id, terminal.id); } else onDeviceDown(event, device); }} onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && canEditWires && (tool === 'wire' || exit && !connected)) { event.preventDefault(); event.stopPropagation(); setCursor(null); setSnapTarget(null); onTerminal(device.id, terminal.id); } }}>
                  <title>{outputCircuit ? `C${outputCircuit.number} ${outputCircuit.name} · ` : ''}${terminal.label} · ${connected ? 'conectado; selecione o fio para remover ou use Ctrl+Z' : 'clique ou arraste até um destino compatível'}</title>
                  {!exit && <path d={side === 'left' || side === 'right' ? `M${x} ${y} H${screwX}` : `M${x} ${y} V${screwY}`} stroke={mode === 'installation' ? color : '#859594'} strokeWidth={mode === 'realistic' ? 3 : 1.3} />}
                  {!exit && mode === 'realistic' && <Screw x={screwX} y={screwY} size={device.terminals.filter(item => terminalSide(device, item.side) === side).length > 4 ? 3.2 : 5} />}
                  <circle cx={x} cy={y} r={exit ? 6.4 : tool === 'wire' ? 6 : 3.2} fill={active ? '#f4cf29' : connected && exit ? color : '#fff'} stroke={active ? '#a3830e' : color} strokeWidth={exit || tool === 'wire' ? 2 : 1.3} />
                  {canEditWires && (tool === 'wire' || exit && !connected) && <circle data-qdc-editor-only="true" className="qdc-terminal-target" cx={x} cy={y} r={exit ? 10 : 12} fill="transparent" stroke={active ? '#ecc635' : 'transparent'} strokeWidth="1" />}
                  {exit ? <text x={x} y={side === 'top' ? y + 19 : side === 'bottom' ? y - 11 : y + 2} textAnchor="middle" fill="#344b55" stroke="#fff" paintOrder="stroke" strokeWidth="2.3" fontSize="7" fontWeight="800" pointerEvents="none">{terminal.kind === 'L' ? `L${terminal.pole ?? 1}` : terminal.kind}</text> : (side === 'top' || side === 'bottom') && (tool === 'wire' || mode === 'installation' || mode === 'schematic') && <text x={x} y={side === 'top' ? 11 : rect.height - 6} textAnchor="middle" fill={color} stroke="#fff" paintOrder="stroke" strokeWidth="2.5" fontSize="7" fontWeight="700" pointerEvents="none">{terminal.label}</text>}
                </g>;
              })}
            </g>;
          })}</g>
          <g data-qdc-layer="wires" data-qdc-wire-endpoints="true" style={{ display: layers.wires.visible ? undefined : 'none' }}>{[...endpointMarkers.entries()].map(([key, marker]) => <g key={key} opacity={focus && !marker.wireIds.some(id => focus.wireIds.has(id)) ? .42 : 1}><WireEndpoint {...marker} /></g>)}</g>
          {wireGuide && <g data-qdc-editor-only="true" className="qdc-wire-guides" pointerEvents="none" aria-hidden="true">
            {wireGuide.x !== null && <line x1={wireGuide.x} y1="34" x2={wireGuide.x} y2={size.height - 34} strokeWidth={1.2 * handleScale} strokeDasharray={`${5 * handleScale} ${5 * handleScale}`} />}
            {wireGuide.y !== null && <line x1="34" y1={wireGuide.y} x2={size.width - 34} y2={wireGuide.y} strokeWidth={1.2 * handleScale} strokeDasharray={`${5 * handleScale} ${5 * handleScale}`} />}
          </g>}
          {selectedWire && tool === 'select' && canEditWires && <g data-qdc-editor-only="true" className="qdc-wire-edit-points">
            {selectedWire.path.slice(1).map((end, index) => {
              const start = selectedWire.path[index];
              const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
              const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
              if (length < 32 * handleScale) return null;
              const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
              return <g key={`segment-${index}`} className={`qdc-wire-flex-handle is-${horizontal ? 'horizontal' : 'vertical'}`} transform={`translate(${middle.x} ${middle.y}) scale(${handleScale})`} role="button" tabIndex={0} aria-label={`Flexionar trecho ${index + 1} do fio`} onPointerDown={event => beginWireEdit(event, selectedWire, 'segment', index)} onKeyDown={event => nudgeWire(event, selectedWire, 'segment', index, middle)}>
                <title>Arraste para flexionar · Shift ajusta fino · Alt desativa o ímã · Setas ajustam</title>
                <circle r="14" fill="transparent" />
                <rect x="-8" y="-8" width="16" height="16" rx="5" />
                <path d={horizontal ? 'M-4 -2 L0 -5 L4 -2 M-4 2 L0 5 L4 2' : 'M-2 -4 L-5 0 L-2 4 M2 -4 L5 0 L2 4'} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
              </g>;
            })}
            {selectedWire.path.slice(1, -1).map((point, index) => <g key={`point-${index}`} className="qdc-wire-point-handle" transform={`translate(${point.x} ${point.y}) scale(${handleScale})`} role="button" tabIndex={0} aria-label={`Mover dobra ${index + 1} do fio. Duplo clique ou Delete remove quando possível.`} onPointerDown={event => beginWireEdit(event, selectedWire, 'point', index + 1)} onDoubleClick={event => deleteWireBend(event, selectedWire, index + 1)} onKeyDown={event => { if (event.key === 'Delete' || event.key === 'Backspace') deleteWireBend(event, selectedWire, index + 1); else nudgeWire(event, selectedWire, 'point', index + 1, point); }}>
              <title>Arraste a dobra · Shift ajusta fino · Alt desativa o ímã · Duplo clique remove</title>
              <circle r="12" fill="transparent" /><circle r="4.2" />
            </g>)}
          </g>}
          {moving && <g data-qdc-editor-only="true" pointerEvents="none">{project.devices.filter(device => moving.ids.includes(device.id)).map(device => { const previewDevice = moving.fishboneSlotId ? { ...device, fishboneSlotId: moving.fishboneSlotId } : moving.plane ? { ...device, canvasPosition: moving.plane } : { ...device, rail: device.rail + moving.rail, slot: device.slot + moving.slot }; const rect = deviceRect(previewDevice, project); return <g key={device.id}><rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx="4" fill={moving.valid ? '#eed03a' : '#e16b59'} fillOpacity=".3" stroke={moving.valid ? '#b49313' : '#b83e34'} strokeWidth="2" strokeDasharray="6 3" /></g>; })}</g>}
          {movePreview && <g data-qdc-editor-only="true" className="qdc-move-wire-preview" pointerEvents="none" aria-hidden="true">
            {movePreview.candidate.wires.filter(wire => movePreview.wireIds.includes(wire.id)).map(wire => <path key={wire.id} d={pathData(wire.path)} fill="none" stroke="#096ea3" strokeWidth="4" strokeDasharray="8 5" strokeLinecap="round" strokeLinejoin="round" />)}
            {movePreview.candidate.devices.filter(device => movePreview.deviceIds.includes(device.id)).map(device => { const rect = deviceRect(device, movePreview.candidate); return <rect key={device.id} x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx="5" fill="#e8c94a" fillOpacity=".16" stroke="#9b771b" strokeWidth="2" strokeDasharray="6 4" />; })}
          </g>}
          {drop && !drop.fishboneSlotId && <g data-qdc-editor-only="true" pointerEvents="none"><rect x={LEFT + drop.slot * MODULE + 2} y={TOP + drop.rail * RAIL} width={drop.modules * MODULE - 4} height={DEVICE_HEIGHT} rx="4" fill={drop.valid ? '#e9c631' : '#e17a68'} fillOpacity=".25" stroke={drop.valid ? '#b39722' : '#b85142'} strokeWidth="2" strokeDasharray="6 4" /><text x={LEFT + (drop.slot + drop.modules / 2) * MODULE} y={TOP + drop.rail * RAIL + DEVICE_HEIGHT / 2} textAnchor="middle" fill={drop.valid ? '#806510' : '#932f20'} fontSize="11" fontWeight="700">{drop.valid ? '+' : '×'}</text></g>}
          {marquee && <rect data-qdc-editor-only="true" x={Math.min(marquee.start.x, marquee.end.x)} y={Math.min(marquee.start.y, marquee.end.y)} width={Math.abs(marquee.start.x - marquee.end.x)} height={Math.abs(marquee.start.y - marquee.end.y)} fill="#e7c624" fillOpacity=".15" stroke="#a78f1e" strokeWidth="1" pointerEvents="none" />}
          {startPoint && <g data-qdc-editor-only="true" pointerEvents="none"><circle cx={startPoint.x} cy={startPoint.y} r="10" fill="none" stroke="#dcb72c" strokeWidth="2" />{previewPath && <path className={`qdc-wire-preview${snapTarget ? snapTarget.issue ? ' is-invalid' : ' is-valid' : ''}`} d={previewPath} fill="none" />}{snapTarget && <g className={`qdc-wire-snap${snapTarget.issue ? ' is-invalid' : ' is-valid'}`} transform={`translate(${snapTarget.point.x} ${snapTarget.point.y})`}><circle r="13" /><circle r="7" />{snapTarget.issue ? <path d="M-3.5 -3.5 L3.5 3.5 M3.5 -3.5 L-3.5 3.5" /> : <path d="M-4 0 L-1 3 L5 -4" />}</g>}</g>}
        </g>
      </svg>
      {!project.devices.length && <div className="qdc-canvas-empty"><Move size={26} /><strong>Seu quadro começa aqui</strong><span>Arraste os dispositivos da biblioteca<br />ou clique em um componente para adicioná-lo.</span></div>}
    </div>
    {!hintDismissed && <div className="qdc-canvas-hint" aria-live="polite">{tool === 'pan' ? <Hand size={13} /> : tool === 'wire' ? <Crosshair size={13} /> : <MousePointer2 size={13} />}<span>{hint}</span><button type="button" className="qdc-canvas-hint-close" aria-label="Fechar dica do quadro" title="Fechar dica" onClick={() => setHintDismissed(true)}><X size={14} aria-hidden="true" /></button></div>}
    <div className="qdc-canvas-navigation">
      <div className="qdc-zoom-controls"><button type="button" title="Diminuir zoom" aria-label="Diminuir zoom do quadro" onClick={() => zoomBy(1 / 1.2)} disabled={viewport.zoom <= .3}><ZoomOut size={15} /></button><button type="button" title="Ajustar quadro à área" onClick={() => onViewport({ x: 0, y: 0, zoom: 1 })}>{Math.round(viewport.zoom * 100)}%</button><button type="button" title="Aumentar zoom" aria-label="Aumentar zoom do quadro" onClick={() => zoomBy(1.2)} disabled={viewport.zoom >= 3}><ZoomIn size={15} /></button></div>
      <svg className="qdc-minimap" viewBox={`0 0 ${size.width} ${size.height}`} role="button" tabIndex={0} aria-label="Minimapa. Clique para centralizar uma região; Enter ajusta o quadro inteiro." onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onViewport({ x: 0, y: 0, zoom: 1 }); } }} onPointerDown={event => { const svg = event.currentTarget, matrix = svg.getScreenCTM(); if (!matrix) return; const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY; const center = p.matrixTransform(matrix.inverse()); onViewport({ ...viewport, x: size.width / 2 - center.x * viewport.zoom, y: size.height / 2 - center.y * viewport.zoom }); }}>
        <rect x="12" y="12" width={size.width - 24} height={size.height - 24} rx="8" fill="#e5eae7" stroke="#aebbbf" strokeWidth="4" />
        {project.devices.map(device => { const r = deviceRect(device, project); return <rect key={device.id} x={r.x} y={r.y} width={r.width} height={r.height} rx="3" fill={activeDevices.has(device.id) ? '#d6b627' : '#73848b'} />; })}
        {visibleWires.map(wire => <path key={wire.id} d={pathData(wire.path)} fill="none" stroke={wire.color} strokeWidth="3" opacity=".65" />)}
        <rect x={-viewport.x / viewport.zoom} y={-viewport.y / viewport.zoom} width={size.width / viewport.zoom} height={size.height / viewport.zoom} fill="#e2be1e" fillOpacity=".06" stroke="#ae941d" strokeWidth="7" />
      </svg>
    </div>
  </section>;
}

export default BoardCanvas;
