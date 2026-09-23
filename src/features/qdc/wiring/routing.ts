import type { Device, DeviceMount, Point, Project, TerminalSide, Wire } from '../types.ts';
import { reattachManualWirePath } from './geometry.ts';

export const MODULE = 44;
export const RAIL = 210;
export const LEFT = 90;
export const TOP = 110;
export const DEVICE_HEIGHT = 126;

export function deviceMount(device: Device): DeviceMount {
  if (device.mount) return device.mount;
  if (device.type === 'comb-bus') return 'overlay';
  if (device.type === 'power-entry' || device.type === 'conduit-entry') return 'edge';
  return 'rail';
}

export const isRailMounted = (device: Device) => deviceMount(device) === 'rail';

export function boardSize(project: Project): { width: number; height: number } {
  return { width: LEFT * 2 + project.modulesPerRail * MODULE, height: TOP * 2 + (project.rails - 1) * RAIL + DEVICE_HEIGHT };
}

export function deviceRect(device: Device, project?: Project) {
  const mount = deviceMount(device);
  if (mount === 'overlay') return {
    x: LEFT + device.slot * MODULE + 2,
    y: (device.combSide ?? 'bottom') === 'bottom' ? TOP + device.rail * RAIL + DEVICE_HEIGHT - 8 : TOP + device.rail * RAIL - 8,
    width: Math.max(MODULE - 4, device.modules * MODULE - 4),
    height: 16,
  };
  if (mount === 'edge') {
    const size = project ? boardSize(project) : { width: LEFT * 2 + 12 * MODULE, height: TOP * 2 + DEVICE_HEIGHT };
    const isBus = device.type === 'neutral-bus' || device.type === 'earth-bus';
    const horizontal = isBus && device.orientation === 'horizontal';
    const width = isBus ? horizontal ? 92 : 30 : device.type === 'power-entry' ? Math.max(58, device.poles * 18) : Math.max(48, Math.min(104, device.poles * 8 + 8));
    const height = isBus ? horizontal ? 30 : 92 : 48;
    if (device.canvasPosition) return { x: device.canvasPosition.x, y: device.canvasPosition.y, width, height };
    const offset = Math.max(5, Math.min(95, device.edgeOffset ?? 50)) / 100;
    const side = device.edgeSide ?? 'top';
    if (side === 'top' || side === 'bottom') {
      const x = 42 + (size.width - 84) * offset - width / 2;
      return { x, y: side === 'top' ? 8 : size.height - height - 8, width, height };
    }
    const y = 42 + (size.height - 84) * offset - height / 2;
    return { x: side === 'left' ? 8 : size.width - width - 8, y, width, height };
  }
  if (device.type === 'neutral-bus' || device.type === 'earth-bus') {
    const horizontal = device.orientation === 'horizontal';
    return horizontal ? {
      x: LEFT + device.slot * MODULE + MODULE / 2 - 46,
      y: TOP + device.rail * RAIL + 48,
      width: 92,
      height: 30,
    } : {
      x: LEFT + device.slot * MODULE + 8,
      y: TOP + device.rail * RAIL + 18,
      width: MODULE - 16,
      height: 90,
    };
  }
  return { x: LEFT + device.slot * MODULE + 2, y: TOP + device.rail * RAIL, width: device.modules * MODULE - 4, height: DEVICE_HEIGHT };
}

export function terminalSide(device: Device, side: TerminalSide): TerminalSide {
  if (device.type === 'neutral-bus' || device.type === 'earth-bus') {
    const allowed = device.orientation === 'horizontal' ? ['top', 'bottom'] : ['left', 'right'];
    return allowed.includes(device.busTerminalSide ?? '') ? device.busTerminalSide! : device.orientation === 'horizontal' ? 'bottom' : 'right';
  }
  if (deviceMount(device) !== 'edge') {
    return side;
  }
  return ({ top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const)[device.edgeSide ?? 'top'];
}

export function terminalPoint(project: Project, componentId: string, terminalId: string): Point | null {
  const device = project.devices.find(d => d.id === componentId);
  const terminal = device?.terminals.find(t => t.id === terminalId);
  if (!device || !terminal) return null;
  const side = terminalSide(device, terminal.side);
  const peers = device.terminals.filter(t => terminalSide(device, t.side) === side).sort((a, b) => a.index - b.index);
  const index = peers.findIndex(t => t.id === terminal.id);
  const rect = deviceRect(device, project);
  if (terminal.position && deviceMount(device) === 'rail') return {
    x: rect.x + rect.width * terminal.position.x,
    y: rect.y + rect.height * terminal.position.y,
  };
  if (side === 'left' || side === 'right') return { x: rect.x + (side === 'right' ? rect.width : 0), y: rect.y + rect.height * (index + .5) / peers.length };
  return { x: rect.x + rect.width * (index + .5) / peers.length, y: rect.y + (side === 'bottom' ? rect.height : 0) };
}

function compact(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (previous?.x === point.x && previous.y === point.y) continue;
    const before = result.at(-2);
    if (before && previous && ((before.x === previous.x && previous.x === point.x) || (before.y === previous.y && previous.y === point.y))) result.pop();
    result.push(point);
  }
  return result;
}

/** Boundary contact is allowed; passing through any device body is not. */
export function pathAvoidsDevices(points: Point[], devices: Device[], project?: Project): boolean {
  return points.slice(1).every((end, i) => {
    const start = points[i];
    if (start.x !== end.x && start.y !== end.y) return false;
    return devices.filter(device => deviceMount(device) !== 'overlay').every(device => {
      const rect = deviceRect(device, project);
      if (start.x === end.x) return !(start.x > rect.x && start.x < rect.x + rect.width && Math.max(start.y, end.y) > rect.y && Math.min(start.y, end.y) < rect.y + rect.height);
      return !(start.y > rect.y && start.y < rect.y + rect.height && Math.max(start.x, end.x) > rect.x && Math.min(start.x, end.x) < rect.x + rect.width);
    });
  });
}

type Segment = { a: Point; b: Point; horizontal: boolean };
const segments = (points: Point[]): Segment[] => points.slice(1).map((b, index) => ({ a: points[index], b, horizontal: points[index].y === b.y }));

/** Length shared by collinear wire segments. Endpoint contact is not overlap. */
export function pathOverlapLength(a: Point[], b: Point[]): number {
  let length = 0;
  for (const first of segments(a)) for (const second of segments(b)) {
    if (first.horizontal !== second.horizontal) continue;
    if (first.horizontal) {
      if (first.a.y !== second.a.y) continue;
      length += Math.max(0, Math.min(Math.max(first.a.x, first.b.x), Math.max(second.a.x, second.b.x)) - Math.max(Math.min(first.a.x, first.b.x), Math.min(second.a.x, second.b.x)));
    } else {
      if (first.a.x !== second.a.x) continue;
      length += Math.max(0, Math.min(Math.max(first.a.y, first.b.y), Math.max(second.a.y, second.b.y)) - Math.max(Math.min(first.a.y, first.b.y), Math.min(second.a.y, second.b.y)));
    }
  }
  return length;
}

function crossings(a: Point[], b: Point[]): number {
  let count = 0;
  for (const first of segments(a)) for (const second of segments(b)) {
    if (first.horizontal === second.horizontal) continue;
    const horizontal = first.horizontal ? first : second;
    const vertical = first.horizontal ? second : first;
    const x = vertical.a.x, y = horizontal.a.y;
    if (x > Math.min(horizontal.a.x, horizontal.b.x) && x < Math.max(horizontal.a.x, horizontal.b.x) && y > Math.min(vertical.a.y, vertical.b.y) && y < Math.max(vertical.a.y, vertical.b.y)) count++;
  }
  return count;
}

function terminalExit(point: Point, side: TerminalSide, fanLane: number, depthLane: number, size: { width: number; height: number }, device: Device, project: Project): Point[] {
  const localLane = fanLane % 12;
  const localDepth = depthLane % 12;
  const vertical = side === 'top' || side === 'bottom';
  const direction = side === 'top' || side === 'left' ? -1 : 1;
  const axisSize = vertical ? size.height : size.width;
  const coordinate = vertical ? point.y : point.x;
  const desiredDepth = coordinate + direction * (18 + localDepth * 4.5);
  // Vertical fans share the shallow top/bottom corridors; lateral buses may use the full side corridors.
  const perimeterMargin = vertical ? 72 : 8;
  let depth = Math.max(perimeterMargin, Math.min(axisSize - perimeterMargin, desiredDepth));
  depth = direction < 0 ? Math.min(depth, coordinate - 8) : Math.max(depth, coordinate + 8);
  depth = Math.max(8, Math.min(axisSize - 8, depth));
  if (deviceMount(device) === 'edge' && !device.canvasPosition) {
    if (side === 'top') depth = Math.max(depth, TOP + (project.rails - 1) * RAIL + DEVICE_HEIGHT + 8);
    if (side === 'bottom') depth = Math.min(depth, TOP - 8);
    if (side === 'left') depth = Math.max(depth, LEFT + project.modulesPerRail * MODULE + 8);
    if (side === 'right') depth = Math.min(depth, LEFT - 8);
  }
  if (fanLane === 0) return vertical ? [point, { x: point.x, y: depth }] : [point, { x: depth, y: point.y }];
  const fan = (localLane % 2 ? 1 : -1) * (3 + Math.floor(localLane / 2) * 2.5);
  if (vertical) {
    const stub = { x: point.x, y: point.y + direction * 8 };
    const shifted = { x: point.x + fan, y: stub.y };
    return [point, stub, shifted, { x: shifted.x, y: depth }];
  }
  const stub = { x: point.x + direction * 8, y: point.y };
  const shifted = { x: stub.x, y: point.y + fan };
  return [point, stub, shifted, { x: depth, y: shifted.y }];
}

function route(project: Project, wire: Wire, sourceLane: number, targetLane: number, globalLane: number, occupied: Point[][]): Point[] {
  const source = terminalPoint(project, wire.sourceComponent, wire.sourceTerminal);
  const target = terminalPoint(project, wire.targetComponent, wire.targetTerminal);
  const sourceDevice = project.devices.find(d => d.id === wire.sourceComponent);
  const targetDevice = project.devices.find(d => d.id === wire.targetComponent);
  const a = sourceDevice?.terminals.find(t => t.id === wire.sourceTerminal);
  const b = targetDevice?.terminals.find(t => t.id === wire.targetTerminal);
  if (!source || !target || !a || !b || !sourceDevice || !targetDevice) return [];
  if (wire.manualPath && wire.path.length >= 2) return reattachManualWirePath(wire.path, source, target);
  const size = boardSize(project);
  const lane = globalLane % 12;
  const family = { phase: 0, neutral: 1, earth: 2, return: 3 }[wire.conductorType];
  const sourceExit = terminalExit(source, terminalSide(sourceDevice, a.side), sourceLane, lane, size, sourceDevice, project);
  const targetExit = terminalExit(target, terminalSide(targetDevice, b.side), targetLane, lane + 1, size, targetDevice, project).reverse();
  const from = sourceExit.at(-1)!;
  const to = targetExit[0];
  const sideOffset = 20 + family * 7 + lane * 3.5;
  const left = Math.max(8, LEFT - sideOffset);
  const right = Math.min(size.width - 8, LEFT + project.modulesPerRail * MODULE + sideOffset);
  const topLane = Math.max(8, TOP - 28 - lane * 4);
  const bottomLane = Math.min(size.height - 8, TOP + (project.rails - 1) * RAIL + DEVICE_HEIGHT + 28 + lane * 4);
  const middleX = Math.round((from.x + to.x) / 2 + (lane % 2 ? 1 : -1) * (12 + lane * 2));
  const xLanes = [middleX, left, right, ...Array.from({ length: 6 }, (_, index) => {
    const distance = 16 + Math.floor(index / 2) * 18;
    return Math.max(8, Math.min(size.width - 8, middleX + (index % 2 ? distance : -distance)));
  })];
  const yLanes = [topLane, bottomLane, ...Array.from({ length: project.rails + 1 }, (_, index) => Math.max(8, Math.min(size.height - 8, TOP - 18 + index * RAIL)) )];
  const joins: Point[][] = [
    [from, { x: to.x, y: from.y }, to],
    [from, { x: from.x, y: to.y }, to],
    ...[...new Set(xLanes)].map(x => [from, { x, y: from.y }, { x, y: to.y }, to]),
    ...[...new Set(yLanes)].map(y => [from, { x: from.x, y }, { x: to.x, y }, to]),
  ];
  const candidates = joins.map(join => compact([...sourceExit, ...join.slice(1), ...targetExit.slice(1)])).filter(points => pathAvoidsDevices(points, project.devices, project));
  const distance = (points: Point[]) => points.slice(1).reduce((sum, p, i) => sum + Math.abs(p.x - points[i].x) + Math.abs(p.y - points[i].y), 0);
  // Avoid visually absurd detours around the whole cabinet just to save a
  // crossing. First keep routes near the shortest valid path, then separate
  // overlapping conductors within that useful range.
  const shortest = Math.min(...candidates.map(distance));
  const useful = candidates.filter(points => distance(points) <= shortest * 1.35 + 48);
  const cost = (points: Point[]) => distance(points) + points.length * 6 + occupied.reduce((sum, path) => sum + pathOverlapLength(points, path) * 2500 + crossings(points, path) * 420, 0);
  useful.sort((aPath, bPath) => cost(aPath) - cost(bPath));
  return useful[0] ?? [];
}

/** Stable ordering keeps conductor families grouped while occupied-path scoring separates parallel runs. */
export function routeWires(project: Project): Project {
  const position = (wire: Wire) => {
    const source = project.devices.find(device => device.id === wire.sourceComponent);
    const target = project.devices.find(device => device.id === wire.targetComponent);
    return [source?.rail ?? 99, source?.slot ?? 99, target?.rail ?? 99, target?.slot ?? 99, wire.sourceTerminal, wire.targetTerminal].join(':');
  };
  const ordered = [...project.wires].sort((a, b) => a.conductorType.localeCompare(b.conductorType) || position(a).localeCompare(position(b)) || a.id.localeCompare(b.id));
  const paths = new Map<string, Point[]>();
  const occupied: Point[][] = [];
  const terminalUses = new Map<string, number>();
  const takeTerminalLane = (componentId: string, terminalId: string) => {
    const key = `${componentId}:${terminalId}`;
    const lane = terminalUses.get(key) ?? 0;
    terminalUses.set(key, lane + 1);
    return lane;
  };
  ordered.forEach((wire, index) => {
    const path = route(project, wire, takeTerminalLane(wire.sourceComponent, wire.sourceTerminal), takeTerminalLane(wire.targetComponent, wire.targetTerminal), index, occupied);
    paths.set(wire.id, path);
    if (path.length) occupied.push(path);
  });
  return { ...project, wires: project.wires.map(wire => ({ ...wire, path: paths.get(wire.id) ?? [] })) };
}
