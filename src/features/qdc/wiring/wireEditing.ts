import { bendWirePoint, flexWireSegment, removeWireBend } from './geometry.ts';
import { boardSize, pathAvoidsDevices } from './routing.ts';
import type { Point, Project, Wire } from '../types.ts';

function validPath(project: Project, path: Point[]): boolean {
  const bounds = boardSize(project);
  return path.length >= 2 && path.length <= 128 && path.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)
    && point.x >= 0 && point.y >= 0 && point.x <= bounds.width && point.y <= bounds.height)
    && pathAvoidsDevices(path, project.devices, project);
}

export function moveWireBend(project: Project, wire: Wire, index: number, point: Point): Point[] {
  if (!Number.isInteger(index) || index <= 0 || index >= wire.path.length - 1) throw new Error('Selecione uma dobra interna do fio.');
  const next = bendWirePoint(wire.path, index, point);
  if (!validPath(project, next)) throw new Error('A dobra não pode atravessar um componente nem sair do quadro.');
  return next;
}

export function deleteWireBend(project: Project, wire: Wire, index: number): Point[] {
  const next = removeWireBend(wire.path, index);
  if (next === wire.path || !validPath(project, next)) throw new Error('Esta dobra é necessária para manter o caminho do fio.');
  return next;
}

export function addWireDetour(project: Project, wire: Wire): Point[] {
  const segments = wire.path.slice(1).map((end, index) => ({ index, start: wire.path[index], end,
    length: Math.abs(end.x - wire.path[index].x) + Math.abs(end.y - wire.path[index].y) }))
    .sort((a, b) => b.length - a.length);
  for (const segment of segments) {
    if (segment.length < 16) continue;
    const middle = { x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 };
    const horizontal = segment.start.y === segment.end.y;
    for (const offset of [18, -18, 32, -32]) {
      const point = horizontal ? { x: middle.x, y: middle.y + offset } : { x: middle.x + offset, y: middle.y };
      const next = flexWireSegment(wire.path, segment.index, point);
      if (next.length > wire.path.length && validPath(project, next)) return next;
    }
  }
  throw new Error('Não há espaço livre para criar um desvio neste fio. Ajuste o trajeto diretamente no quadro.');
}

export function changedWiresAfterMove(project: Project, candidate: Project): string[] {
  const before = new Map(project.wires.map(wire => [wire.id, wire.path]));
  return candidate.wires.filter(wire => JSON.stringify(wire.path) !== JSON.stringify(before.get(wire.id))).map(wire => wire.id);
}
