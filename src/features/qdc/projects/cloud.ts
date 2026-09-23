import { supabase } from '../../../supabase';
import { parseProjectFile } from './storage';
import type { Project } from '../types';

export type CloudProject = { project: Project; updatedAt: string };

export class CloudConflictError extends Error {
  constructor() { super('Este quadro mudou em outro dispositivo. A versão local foi preservada.'); }
}

const table = () => supabase.from('qdc_projetos');

export async function loadCloudProjects(userId: string, signal: AbortSignal): Promise<CloudProject[]> {
  const projects: CloudProject[] = [];
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await table()
      .select('project_id,dados,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
      .abortSignal(signal);
    if (error) throw error;
    for (const row of data ?? []) {
      if (typeof row.project_id !== 'string' || typeof row.updated_at !== 'string') throw new Error('Projeto da nuvem inválido.');
      const project = parseProjectFile(JSON.stringify(row.dados));
      if (project.id !== row.project_id) throw new Error('Projeto da nuvem com ID divergente.');
      projects.push({ project, updatedAt: row.updated_at });
    }
    if (!data || data.length < pageSize) break;
  }
  return projects;
}

export async function insertCloudProject(userId: string, project: Project): Promise<string> {
  const { data, error } = await table()
    .insert({ user_id: userId, project_id: project.id, dados: project })
    .select('updated_at')
    .single();
  if (error?.code === '23505') throw new CloudConflictError();
  if (error) throw error;
  if (!data?.updated_at) throw new Error('A nuvem não confirmou o salvamento.');
  return data.updated_at as string;
}

export async function updateCloudProject(userId: string, project: Project, expectedUpdatedAt: string): Promise<string> {
  const { data, error } = await table()
    .update({ dados: project })
    .eq('user_id', userId)
    .eq('project_id', project.id)
    .eq('updated_at', expectedUpdatedAt)
    .select('updated_at')
    .maybeSingle();
  if (error) throw error;
  if (!data?.updated_at) throw new CloudConflictError();
  return data.updated_at as string;
}

export async function deleteCloudProject(userId: string, projectId: string, expectedUpdatedAt: string): Promise<void> {
  const { data, error } = await table()
    .delete()
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .eq('updated_at', expectedUpdatedAt)
    .select('project_id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CloudConflictError();
}
