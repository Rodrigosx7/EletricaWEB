import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cabeNoQuadro, primeiroEspaco, quadroValido, materiaisQuadro, type Quadro } from '../src/utils/quadros.ts';

const base: Quadro = { id: 'q1', nome: 'Teste', cliente: '', trilhos: 2, modulosPorTrilho: 6, componentes: [
  { id: 'a', tipo: 'DR', descricao: 'Modelo A', circuito: 'C1', trilho: 0, inicio: 1, modulos: 2 },
] };

test('impede sobreposição, frações e posições fora do quadro', () => {
  const c = { ...base.componentes[0], id: 'b' };
  assert.equal(cabeNoQuadro(base, c), false);
  assert.equal(cabeNoQuadro(base, { ...c, inicio: 3 }), true);
  assert.equal(cabeNoQuadro(base, { ...c, inicio: 5 }), false);
  assert.equal(cabeNoQuadro(base, { ...c, trilho: 2 }), false);
  assert.equal(cabeNoQuadro(base, { ...c, inicio: -1 }), false);
  assert.equal(cabeNoQuadro(base, { ...c, modulos: 1.5 }), false);
  assert.equal(cabeNoQuadro(base, { ...c, modulos: 0 }), false);
  assert.equal(cabeNoQuadro(base, base.componentes[0]), true);
});

test('busca espaço contíguo e passa ao trilho seguinte', () => {
  assert.deepEqual(primeiroEspaco(base, 3), { trilho: 0, inicio: 3 });
  assert.deepEqual(primeiroEspaco(base, 4), { trilho: 1, inicio: 0 });
  assert.equal(primeiroEspaco(base, 7), null);
  assert.equal(primeiroEspaco({ ...base, trilhos: 1 }, 4), null);
});

test('valida armazenamento e rejeita redução que corta componentes', () => {
  assert.equal(quadroValido(JSON.parse(JSON.stringify(base))), true);
  assert.equal(quadroValido({ ...base, modulosPorTrilho: 2 }), false);
  assert.equal(quadroValido({ ...base, componentes: [null] }), false);
  assert.equal(quadroValido({ ...base, componentes: [...base.componentes, base.componentes[0]] }), false);
  assert.equal(quadroValido({ ...base, componentes: [...base.componentes, { ...base.componentes[0], id: 'b' }] }), false);
});

test('lista agrupa peças equivalentes sem misturar larguras ou modelos', () => {
  const c = base.componentes[0];
  const q = { ...base, componentes: [c, { ...c, id: 'b', circuito: 'C2', inicio: 3 }, { ...c, id: 'c', descricao: 'Modelo B', trilho: 1 }] };
  assert.equal(materiaisQuadro(q).length, 2);
  assert.equal(materiaisQuadro(q)[0].quantidade, 2);
});
