import { validateProject } from '../editor/operations.ts';
import { routeWires } from '../wiring/routing.ts';
import { migrateLegacy } from './factory.ts';
import { DPS_MODELS, buildSpdTerminals, buildTerminals } from '../electrical-components/catalog.ts';
import type { Project } from '../types.ts';

type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export type ProjectLibrary = { projects: Project[]; activeId: string | null; error: string; migrated: boolean };
const key = (userId: string) => `eletricaweb-qdc-v2:${userId}`;

function normalizeProject(project: Project): Project {
  const neutralDpsIds = new Set(project.wires
    .filter(wire => wire.conductorType === 'neutral')
    .flatMap(wire => [
      wire.sourceTerminal === 'top-0' ? wire.sourceComponent : '',
      wire.targetTerminal === 'top-0' ? wire.targetComponent : '',
    ])
    .filter(Boolean));
  const devices = project.devices.map(device => {
    if (device.type === 'neutral-bus' || device.type === 'earth-bus') {
      const orientation = device.orientation ?? 'vertical';
      const allowedSides = orientation === 'horizontal' ? ['top', 'bottom'] : ['left', 'right'];
      const busTerminalSide = allowedSides.includes(device.busTerminalSide ?? '') ? device.busTerminalSide : orientation === 'horizontal' ? 'bottom' : 'right';
      return { ...device, modules: 1, mount: device.mount ?? 'rail', orientation, busTerminalSide, color: device.type === 'neutral-bus' ? '#1686cf' : '#27854c', terminals: buildTerminals(device.type, device.poles) };
    }
    if (device.type === 'comb-bus') return { ...device, mount: 'overlay' as const, combSide: device.combSide ?? 'bottom' as const, combPhaseStart: device.combPhaseStart ?? 0 as const, poles: [1, 2, 3, 4].includes(device.poles) ? device.poles : 1, terminals: [] };
    if (device.type === 'power-entry') {
      const phases = device.poles >= 3 ? Math.min(3, device.poles - 2) : Math.max(1, device.poles);
      const poles = phases + 2;
      const legacyAutomaticPosition = device.label === 'Entrada da rede' && device.edgeSide === 'top' && device.edgeOffset === 16;
      return { ...device, mount: 'edge' as const, poles, edgeOffset: legacyAutomaticPosition ? 88 : device.edgeOffset ?? 88, terminals: buildTerminals('power-entry', poles) };
    }
    if (device.type === 'spd') {
      const model = DPS_MODELS.find(item => item.id === device.model) ?? DPS_MODELS[0];
      // Older editor builds allowed a neutral conductor on the generic top DPS
      // terminal. Preserve that intent by migrating that DPS to its explicit N
      // configuration instead of rejecting the whole saved project.
      const spdInput = device.spdInput ?? (neutralDpsIds.has(device.id) ? 'neutral' : 'phase');
      return { ...device, spdInput, model: model.id, label: 'DPS', voltage: model.voltage, surgeCurrent: model.surgeCurrent, description: model.description, poles: 1, modules: 1, terminals: buildSpdTerminals(spdInput) };
    }
    return { ...device, mount: device.mount ?? 'rail' as const };
  });
  const byId = new Map(devices.map(device => [device.id, device]));
  const wires = project.wires.filter(wire => byId.get(wire.sourceComponent)?.type !== 'comb-bus' && byId.get(wire.targetComponent)?.type !== 'comb-bus').map(wire => {
    const sourceIsBus = ['neutral-bus', 'earth-bus'].includes(byId.get(wire.sourceComponent)?.type ?? '');
    const targetIsBus = ['neutral-bus', 'earth-bus'].includes(byId.get(wire.targetComponent)?.type ?? '');
    return {
      ...wire,
      sourceTerminal: sourceIsBus ? wire.sourceTerminal.replace(/^top-/, 'side-') : wire.sourceTerminal,
      targetTerminal: targetIsBus ? wire.targetTerminal.replace(/^top-/, 'side-') : wire.targetTerminal,
      sourceTermination: wire.sourceTermination ?? 'tubular' as const,
      targetTermination: wire.targetTermination ?? 'tubular' as const,
    };
  }).filter(wire => {
    const source = byId.get(wire.sourceComponent)?.terminals.find(terminal => terminal.id === wire.sourceTerminal);
    const target = byId.get(wire.targetComponent)?.terminals.find(terminal => terminal.id === wire.targetTerminal);
    const accepts = (kind: 'L' | 'N' | 'PE' | 'control') => kind === 'control'
      || (kind === 'N' && wire.conductorType === 'neutral')
      || (kind === 'PE' && wire.conductorType === 'earth')
      || (kind === 'L' && (wire.conductorType === 'phase' || wire.conductorType === 'return'));
    return !!source && !!target && accepts(source.kind) && accepts(target.kind);
  });
  return routeWires({ ...project, visualModel: project.visualModel ?? 'classic', dpsVisual: project.dpsVisual ?? 'red', devices, wires });
}

/** Versioned adapter. Legacy data is read only and remains available for recovery. */
export function loadProjects(storage: StoragePort, userId: string): ProjectLibrary {
  try {
    const raw = storage.getItem(key(userId));
    if (raw !== null) {
      const value = JSON.parse(raw);
      if (value?.version !== 2 || !Array.isArray(value.projects)) throw new Error('Invalid storage');
      // The v2 format has evolved while the editor was being developed. Normalize
      // each saved project before strict validation so older, valid snapshots do
      // not become inaccessible merely because a derived field or terminal layout
      // changed. The original localStorage value is never overwritten here.
      const projects: Project[] = (value.projects as unknown[]).map((project: unknown) => normalizeProject(project as Project));
      if (!projects.every(validateProject) || new Set(projects.map(project => project.id)).size !== projects.length) throw new Error('Invalid storage');
      const requestedActiveId = typeof value.activeId === 'string' ? value.activeId : null;
      const activeId = projects.some(project => project.id === requestedActiveId) ? requestedActiveId : projects[0]?.id ?? null;
      const repairedConnections = projects.some((project, index) => project.wires.length !== value.projects[index]?.wires?.length);
      return { projects, activeId, error: '', migrated: repairedConnections };
    }
    const legacy = storage.getItem(`portal-quadros-v1:${userId}`);
    if (!legacy) return { projects: [], activeId: null, error: '', migrated: false };
    const parsed: unknown = JSON.parse(legacy);
    if (!Array.isArray(parsed)) throw new Error('Invalid legacy');
    const projects = parsed.map(migrateLegacy);
    if (projects.some(p => p === null)) throw new Error('Invalid legacy project');
    return { projects: projects as Project[], activeId: projects[0]?.id ?? null, error: '', migrated: true };
  } catch {
    return { projects: [], activeId: null, migrated: false, error: 'Não foi possível ler os projetos locais. O arquivo original foi preservado. Exporte seu trabalho em JSON antes de sair; o salvamento automático está suspenso.' };
  }
}

export function saveProjects(storage: StoragePort, userId: string, projects: Project[], activeId: string) {
  if (!projects.every(validateProject)) throw new Error('Projeto inválido; salvamento cancelado.');
  storage.setItem(key(userId), JSON.stringify({ version: 2, activeId, projects }));
}

export function parseProjectFile(raw: string): Project {
  if (raw.length > 5_000_000) throw new Error('Arquivo muito grande. O limite é 5 MB.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('O arquivo não contém JSON válido.'); }
  if (validateProject(value)) return normalizeProject(value);
  const migrated = migrateLegacy(value);
  if (migrated) return migrated;
  throw new Error('O arquivo não é um projeto QDC válido ou usa uma versão incompatível.');
}
