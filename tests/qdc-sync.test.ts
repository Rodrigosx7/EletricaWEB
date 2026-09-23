import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProject } from '../src/features/qdc/projects/factory.ts';
import { reconcileProjects } from '../src/features/qdc/projects/sync.ts';

test('first cloud sync uploads local-only projects and keeps the active one', () => {
  const local = emptyProject({ name: 'Quadro local' });
  const result = reconcileProjects([local], [], local.id);
  assert.deepEqual(result.projects, [local]);
  assert.deepEqual(result.uploads, [local]);
  assert.equal(result.activeId, local.id);
  assert.equal(result.conflicts, 0);
});

test('an identical project is not uploaded twice', () => {
  const project = emptyProject();
  const result = reconcileProjects([project], [project], project.id);
  assert.equal(result.projects.length, 1);
  assert.equal(result.uploads.length, 0);
  assert.equal(result.conflicts, 0);
});

test('divergent edits preserve both the server project and a local copy', () => {
  const server = emptyProject({ name: 'Versão da nuvem' });
  const local = { ...server, name: 'Meu trabalho local', updatedAt: '2026-09-23T01:00:00.000Z' };
  const result = reconcileProjects([local], [server], local.id, () => 'copy-id', () => '2026-09-23T00:00:00.000Z');
  assert.deepEqual(result.projects[0], server);
  assert.equal(result.projects[1].id, 'copy-id');
  assert.equal(result.projects[1].name, 'Meu trabalho local — cópia local');
  assert.deepEqual(result.uploads, [result.projects[1]]);
  assert.equal(result.activeId, 'copy-id');
  assert.equal(result.conflicts, 1);
  const retry = reconcileProjects(result.projects, [server], result.activeId);
  assert.equal(retry.conflicts, 0);
  assert.deepEqual(retry.uploads, [result.projects[1]]);
});

test('derived layout differences with the same edit timestamp do not multiply copies', () => {
  const server = emptyProject();
  const locallyNormalized = { ...server, visualModel: 'graphite' as const };
  const result = reconcileProjects([locallyNormalized], [server], server.id);
  assert.equal(result.conflicts, 0);
  assert.equal(result.projects.length, 1);
  assert.deepEqual(result.uploads, []);
});

test('cloud-only projects become available when the browser has no copy', () => {
  const server = emptyProject({ name: 'Outro dispositivo' });
  const result = reconcileProjects([], [server], null);
  assert.equal(result.activeId, server.id);
  assert.deepEqual(result.projects, [server]);
  assert.deepEqual(result.uploads, []);
});
