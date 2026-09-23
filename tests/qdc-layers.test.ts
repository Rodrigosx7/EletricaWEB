import assert from 'node:assert/strict';
import test from 'node:test';
import { canEditLayer, DEFAULT_EDITOR_LAYERS } from '../src/features/qdc/editor/layers.ts';

test('ambas as camadas começam visíveis e editáveis', () => {
  assert.equal(canEditLayer(DEFAULT_EDITOR_LAYERS, 'components'), true);
  assert.equal(canEditLayer(DEFAULT_EDITOR_LAYERS, 'wires'), true);
});

test('foco em fios impede editar componentes sem escondê-los', () => {
  const layers = { ...DEFAULT_EDITOR_LAYERS, focus: 'wires' as const };
  assert.equal(layers.components.visible, true);
  assert.equal(canEditLayer(layers, 'components'), false);
  assert.equal(canEditLayer(layers, 'wires'), true);
});

test('camada oculta ou bloqueada não pode ser editada', () => {
  assert.equal(canEditLayer({ ...DEFAULT_EDITOR_LAYERS, wires: { visible: false, locked: false } }, 'wires'), false);
  assert.equal(canEditLayer({ ...DEFAULT_EDITOR_LAYERS, components: { visible: true, locked: true } }, 'components'), false);
});
