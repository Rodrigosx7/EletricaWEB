import type { Point } from '../types.ts';

const round = (value: number) => Math.round(value * 100) / 100;
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

export function compactWirePath(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    if (result.length && same(point, result.at(-1)!)) continue;
    while (result.length >= 2) {
      const previous = result.at(-2)!, middle = result.at(-1)!;
      const straight = (previous.x === middle.x && middle.x === point.x)
        || (previous.y === middle.y && middle.y === point.y);
      const between = (middle.x - previous.x) * (point.x - middle.x) >= 0
        && (middle.y - previous.y) * (point.y - middle.y) >= 0;
      if (!straight || !between) break;
      result.pop();
    }
    result.push(point);
  }
  return result;
}

/** Keeps the route orthogonal while drawing each hard corner as a small, cable-like bend. */
export function roundedWirePath(points: Point[], radius = 11): string {
  const path = compactWirePath(points);
  if (!path.length) return '';
  if (path.length === 1) return `M ${round(path[0].x)} ${round(path[0].y)}`;

  let data = `M ${round(path[0].x)} ${round(path[0].y)}`;
  for (let index = 1; index < path.length - 1; index++) {
    const previous = path[index - 1], corner = path[index], next = path[index + 1];
    const incoming = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outgoing = Math.hypot(next.x - corner.x, next.y - corner.y);
    if (!incoming || !outgoing) continue;
    const curve = Math.min(radius, incoming * .42, outgoing * .42);
    const enter = {
      x: corner.x - (corner.x - previous.x) / incoming * curve,
      y: corner.y - (corner.y - previous.y) / incoming * curve,
    };
    const leave = {
      x: corner.x + (next.x - corner.x) / outgoing * curve,
      y: corner.y + (next.y - corner.y) / outgoing * curve,
    };
    data += ` L ${round(enter.x)} ${round(enter.y)} Q ${round(corner.x)} ${round(corner.y)} ${round(leave.x)} ${round(leave.y)}`;
  }
  const last = path.at(-1)!;
  return `${data} L ${round(last.x)} ${round(last.y)}`;
}

/** Pulls a bend while adding the short orthogonal transitions needed around it. */
export function bendWirePoint(path: Point[], pointIndex: number, target: Point): Point[] {
  const previous = path[pointIndex - 1], current = path[pointIndex], next = path[pointIndex + 1];
  if (!previous || !current || !next) return path;
  if (same(current, target)) return path;
  const incomingVertical = Math.abs(previous.x - current.x) <= Math.abs(previous.y - current.y);
  const outgoingVertical = Math.abs(next.x - current.x) <= Math.abs(next.y - current.y);
  const movedPrevious = incomingVertical ? { x: target.x, y: previous.y } : { x: previous.x, y: target.y };
  const movedNext = outgoingVertical ? { x: target.x, y: next.y } : { x: next.x, y: target.y };
  return compactWirePath([
    ...path.slice(0, pointIndex - 1),
    ...(pointIndex === 1 ? [previous] : []), movedPrevious, target, movedNext,
    ...(pointIndex === path.length - 2 ? [next] : []),
    ...path.slice(pointIndex + 2),
  ]);
}

/** Pulls an entire run sideways, like flexing a loose cable, without detaching its endpoints. */
export function flexWireSegment(path: Point[], segmentIndex: number, target: Point): Point[] {
  const start = path[segmentIndex], end = path[segmentIndex + 1];
  if (!start || !end || same(start, end)) return path;
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  const movedStart = horizontal ? { x: start.x, y: target.y } : { x: target.x, y: start.y };
  const movedEnd = horizontal ? { x: end.x, y: target.y } : { x: target.x, y: end.y };
  const replacement: Point[] = [];
  if (segmentIndex === 0) replacement.push(start);
  replacement.push(movedStart, movedEnd);
  if (segmentIndex + 1 === path.length - 1) replacement.push(end);
  return compactWirePath([...path.slice(0, segmentIndex), ...replacement, ...path.slice(segmentIndex + 2)]);
}

/** Snaps an editing anchor independently on each axis and reports the visible guides. */
export function snapWirePoint(point: Point, xGuides: number[], yGuides: number[], threshold: number) {
  const nearest = (value: number, guides: number[]) => {
    let match: number | null = null, distance = threshold;
    for (const guide of guides) {
      const candidate = Math.abs(guide - value);
      if (candidate <= distance) { match = guide; distance = candidate; }
    }
    return match;
  };
  const x = nearest(point.x, xGuides), y = nearest(point.y, yGuides);
  return { point: { x: x ?? point.x, y: y ?? point.y }, guide: { x, y } };
}

/** Removes a redundant dogleg when the neighboring run can reconnect orthogonally. */
export function removeWireBend(path: Point[], pointIndex: number): Point[] {
  if (pointIndex <= 0 || pointIndex >= path.length - 1) return path;
  const previous = path[pointIndex - 1], next = path[pointIndex + 1];
  if (previous.x === next.x || previous.y === next.y) return compactWirePath([...path.slice(0, pointIndex), ...path.slice(pointIndex + 1)]);

  const afterNext = path[pointIndex + 2];
  if (afterNext && (previous.x === afterNext.x || previous.y === afterNext.y)) {
    return compactWirePath([...path.slice(0, pointIndex), ...path.slice(pointIndex + 2)]);
  }
  const beforePrevious = path[pointIndex - 2];
  if (beforePrevious && (beforePrevious.x === next.x || beforePrevious.y === next.y)) {
    return compactWirePath([...path.slice(0, pointIndex - 1), ...path.slice(pointIndex + 1)]);
  }
  return path;
}

/** Reconnects a hand-shaped route after either attached component moves. */
export function reattachManualWirePath(path: Point[], source: Point, target: Point): Point[] {
  if (path.length >= 2 && same(path[0], source) && same(path.at(-1)!, target)) return path;
  if (path.length < 3) {
    if (source.x === target.x || source.y === target.y) return [source, target];
    return compactWirePath([source, { x: source.x, y: target.y }, target]);
  }

  const internal = path.slice(1, -1).map(point => ({ ...point }));
  const oldSource = path[0], oldTarget = path.at(-1)!;
  const startVertical = Math.abs(path[1].x - oldSource.x) <= Math.abs(path[1].y - oldSource.y);
  const endVertical = Math.abs(oldTarget.x - path.at(-2)!.x) <= Math.abs(oldTarget.y - path.at(-2)!.y);

  if (internal.length === 1) {
    const corner = startVertical && !endVertical
      ? { x: source.x, y: target.y }
      : !startVertical && endVertical
        ? { x: target.x, y: source.y }
        : startVertical
          ? { x: source.x, y: internal[0].y }
          : { x: internal[0].x, y: source.y };
    const points = startVertical === endVertical
      ? startVertical
        ? [source, corner, { x: target.x, y: corner.y }, target]
        : [source, corner, { x: corner.x, y: target.y }, target]
      : [source, corner, target];
    return compactWirePath(points);
  }

  internal[0] = startVertical ? { ...internal[0], x: source.x } : { ...internal[0], y: source.y };
  const last = internal.length - 1;
  internal[last] = endVertical ? { ...internal[last], x: target.x } : { ...internal[last], y: target.y };
  const connected = [source, ...internal, target];
  const repaired: Point[] = [source];
  for (let index = 1; index < connected.length; index++) {
    const previous = connected[index - 1], next = connected[index];
    if (previous.x !== next.x && previous.y !== next.y) {
      const wasHorizontal = path[index - 1].y === path[index].y;
      repaired.push(wasHorizontal ? { x: next.x, y: previous.y } : { x: previous.x, y: next.y });
    }
    repaired.push(next);
  }
  return compactWirePath(repaired);
}
