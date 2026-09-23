import assert from 'node:assert/strict';
import test from 'node:test';
import { searchCommands, type EditorCommand } from '../src/features/qdc/editor/commandSearch.ts';

const noop = () => {};
const commands: EditorCommand[] = [
  { id: 'wire', label: 'Passar fios', group: 'Ferramentas', featured: true, run: noop },
  { id: 'breaker', label: 'Adicionar Disjuntor bipolar', group: 'Componentes', description: 'Proteção', keywords: 'dois polos', run: noop },
  { id: 'spd', label: 'Adicionar DPS', group: 'Componentes', featured: true, run: noop },
];

test('busca inicial mostra somente comandos em destaque', () => {
  assert.deepEqual(searchCommands(commands, '').map(item => item.id), ['wire', 'spd']);
});

test('busca ignora acentos e aceita palavras em ordem livre', () => {
  assert.deepEqual(searchCommands(commands, 'bipolar protecao').map(item => item.id), ['breaker']);
  assert.deepEqual(searchCommands(commands, 'PolOs disjuntor').map(item => item.id), ['breaker']);
});

test('prioriza início do nome e respeita limite', () => {
  assert.deepEqual(searchCommands(commands, 'passar', 1).map(item => item.id), ['wire']);
  assert.deepEqual(searchCommands(commands, 'dps').map(item => item.id), ['spd']);
});
