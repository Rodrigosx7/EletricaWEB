import { validateProject } from '../editor/operations.ts';
import { routeWires } from '../wiring/routing.ts';
import { migrateLegacy } from './factory.ts';
import type { Project } from '../types.ts';

type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export type ProjectLibrary = { projects: Project[]; activeId: string | null; error: string; migrated: boolean };
const key = (userId: string) => `eletricaweb-qdc-v2:${userId}`;

/** Versioned adapter. Legacy data is read only and remains available for recovery. */
export function loadProjects(storage: StoragePort, userId: string): ProjectLibrary {
  try {
    const raw = storage.getItem(key(userId));
    if (raw !== null) {
      const value = JSON.parse(raw);
      if (value?.version !== 2 || !Array.isArray(value.projects) || !value.projects.every(validateProject) || new Set(value.projects.map((p: Project) => p.id)).size !== value.projects.length) throw new Error('Invalid storage');
      return { projects: value.projects.map(routeWires), activeId: typeof value.activeId === 'string' ? value.activeId : null, error: '', migrated: false };
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
  if (validateProject(value)) return routeWires(value);
  const migrated = migrateLegacy(value);
  if (migrated) return migrated;
  throw new Error('O arquivo não é um projeto QDC válido ou usa uma versão incompatível.');
}
