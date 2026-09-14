import type { Device, Point, Project, Wire } from '../types.ts';

export const MODULE = 44;
export const RAIL = 210;
export const LEFT = 90;
export const TOP = 110;
export const DEVICE_HEIGHT = 126;

export function boardSize(project: Project): { width: number; height: number } {
  return { width: LEFT * 2 + project.modulesPerRail * MODULE, height: TOP * 2 + (project.rails - 1) * RAIL + DEVICE_HEIGHT };
}

export function deviceRect(device: Device) {
  return { x: LEFT + device.slot * MODULE + 2, y: TOP + device.rail * RAIL, width: device.modules * MODULE - 4, height: DEVICE_HEIGHT };
}

export function terminalPoint(project: Project, componentId: string, terminalId: string): Point | null {
  const device = project.devices.find(d => d.id === componentId);
  const terminal = device?.terminals.find(t => t.id === terminalId);
  if (!device || !terminal) return null;
  const peers = device.terminals.filter(t => t.side === terminal.side).sort((a, b) => a.index - b.index);
  const index = peers.findIndex(t => t.id === terminal.id);
  const rect = deviceRect(device);
  return { x: rect.x + rect.width * (index + 0.5) / peers.length, y: rect.y + (terminal.side === 'bottom' ? rect.height : 0) };
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
export function pathAvoidsDevices(points: Point[], devices: Device[]): boolean {
  return points.slice(1).every((end, i) => {
    const start = points[i];
    if (start.x !== end.x && start.y !== end.y) return false;
    return devices.every(device => {
      const rect = deviceRect(device);
      if (start.x === end.x) return !(start.x > rect.x && start.x < rect.x + rect.width && Math.max(start.y, end.y) > rect.y && Math.min(start.y, end.y) < rect.y + rect.height);
      return !(start.y > rect.y && start.y < rect.y + rect.height && Math.max(start.x, end.x) > rect.x && Math.min(start.x, end.x) < rect.x + rect.width);
    });
  });
}

type Segment = { a: Point; b: Point; horizontal: boolean };

function segments(points: Point[]): Segment[] {
  return points.slice(1).map((b, index) => ({ a: points[index], b, horizontal: points[index].y === b.y }));
}

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
    const insideHorizontal = x > Math.min(horizontal.a.x, horizontal.b.x) && x < Math.max(horizontal.a.x, horizontal.b.x);
    const insideVertical = y > Math.min(vertical.a.y, vertical.b.y) && y < Math.max(vertical.a.y, vertical.b.y);
    if (insideHorizontal && insideVertical) count++;
  }
  return count;
}

function terminalExit(point: Point, side: 'top' | 'bottom', fanLane: number, depthLane: number): Point[] {
  const localLane = fanLane % 12;
  const localDepth = depthLane % 12;
  const direction = side === 'top' ? -1 : 1;
  const depth = point.y + direction * (18 + localDepth * 4.5);
  if (fanLane === 0) return [point, { x: point.x, y: depth }];
  const fan = (localLane % 2 ? 1 : -1) * (3 + Math.floor(localLane / 2) * 2.5);
  const stub = { x: point.x, y: point.y + direction * 8 };
  const shifted = { x: point.x + fan, y: stub.y };
  return [point, stub, shifted, { x: shifted.x, y: depth }];
}

function route(project: Project, wire: Wire, sourceLane: number, targetLane: number, globalLane: number, occupied: Point[][]): Point[] {
  const source = terminalPoint(project, wire.sourceComponent, wire.sourceTerminal);
  const target = terminalPoint(project, wire.targetComponent, wire.targetTerminal);
  const a = project.devices.find(d => d.id === wire.sourceComponent)?.terminals.find(t => t.id === wire.sourceTerminal);
  const b = project.devices.find(d => d.id === wire.targetComponent)?.terminals.find(t => t.id === wire.targetTerminal);
  if (!source || !target || !a || !b) return [];
  const family = { phase: 0, neutral: 1, earth: 2, return: 3 }[wire.conductorType];
  const sourceExit = terminalExit(source, a.side, sourceLane, globalLane);
  const targetExit = terminalExit(target, b.side, targetLane, globalLane + 1).reverse();
  const from = sourceExit.at(-1)!;
  const to = targetExit[0];
  const size = boardSize(project);
  const sideOffset = 20 + family * 7 + globalLane * 3.5;
  const left = Math.max(8, LEFT - sideOffset);
  const right = Math.min(size.width - 8, LEFT + project.modulesPerRail * MODULE + sideOffset);
  const topLane = Math.max(8, TOP - 28 - globalLane * 4);
  const bottomLane = Math.min(size.height - 8, TOP + (project.rails - 1) * RAIL + DEVICE_HEIGHT + 28 + globalLane * 4);
  const middleX = Math.round((from.x + to.x) / 2 + (globalLane % 2 ? 1 : -1) * (12 + globalLane * 2));
  const joins: Point[][] = [
    [from, { x: to.x, y: from.y }, to],
    [from, { x: from.x, y: to.y }, to],
    [from, { x: middleX, y: from.y }, { x: middleX, y: to.y }, to],
    ...[left, right].map(x => [from, { x, y: from.y }, { x, y: to.y }, to]),
    ...[topLane, bottomLane].map(y => [from, { x: from.x, y }, { x: to.x, y }, to]),
  ];
  const candidates = joins.map(join => compact([...sourceExit, ...join.slice(1), ...targetExit.slice(1)])).filter(points => pathAvoidsDevices(points, project.devices));
  const distance = (points: Point[]) => points.slice(1).reduce((sum, p, i) => sum + Math.abs(p.x - points[i].x) + Math.abs(p.y - points[i].y), 0);
  const cost = (points: Point[]) => distance(points) + points.length * 5 + occupied.reduce((sum, path) => sum + pathOverlapLength(points, path) * 2500 + crossings(points, path) * 90, 0);
  candidates.sort((aPath, bPath) => cost(aPath) - cost(bPath));
  return candidates[0] ?? [];
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
  ordered.forEach((wire, globalLane) => {
    const sourceLane = takeTerminalLane(wire.sourceComponent, wire.sourceTerminal);
    const targetLane = takeTerminalLane(wire.targetComponent, wire.targetTerminal);
    const path = route(project, wire, sourceLane, targetLane, globalLane, occupied);
    paths.set(wire.id, path);
    if (path.length) occupied.push(path);
  });
  return { ...project, wires: project.wires.map(wire => ({ ...wire, path: paths.get(wire.id) ?? [] })) };
}
