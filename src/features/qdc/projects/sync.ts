import type { Project } from '../types';

/** Keep both edits when a local snapshot differs from the server copy. */
export function reconcileProjects(
  local: Project[], remote: Project[], activeId: string | null,
  createId: () => string = () => crypto.randomUUID(),
  now: () => string = () => new Date().toISOString(),
) {
  const projects = [...remote];
  const uploads: Project[] = [];
  const ids = new Set(remote.map(project => project.id));
  const remoteById = new Map(remote.map(project => [project.id, project]));
  let resolvedActiveId = activeId;
  let conflicts = 0;
  for (const project of local) {
    const server = remoteById.get(project.id);
    if (!server) {
      projects.push(project);
      uploads.push(project);
      ids.add(project.id);
      continue;
    }
    // The editor stamps updatedAt on real edits. Normalizing older saved
    // layouts can change derived wire geometry without creating a new edit.
    if (server.updatedAt === project.updatedAt || JSON.stringify(server) === JSON.stringify(project)) continue;
    let id = createId();
    while (ids.has(id)) id = createId();
    ids.add(id);
    const timestamp = now();
    const copy: Project = { ...project, id, name: `${project.name} — cópia local`, createdAt: timestamp, updatedAt: timestamp };
    projects.push(copy);
    uploads.push(copy);
    if (activeId === project.id) resolvedActiveId = id;
    conflicts++;
  }
  if (!projects.some(project => project.id === resolvedActiveId)) resolvedActiveId = projects[0]?.id ?? null;
  return { projects, uploads, activeId: resolvedActiveId, conflicts };
}
