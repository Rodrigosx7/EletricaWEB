import test from 'node:test';
import assert from 'node:assert/strict';
import { numero, corrente, queda, AMPACIDADE, fatorAgrupamento, fatorTemperatura, bitola, secaoPE, disjuntor, capacitor, iluminacao, consumo, converter } from '../src/utils/calculosEletricos.ts';

const perto = (a: number, b: number) => assert.ok(Math.abs(a-b) < 1e-7, `${a} ≠ ${b}`);
test('parser accepts decimals but rejects partial strings, grouping, blanks and infinities', () => {
  assert.equal(numero(' 12,5 '), 12.5); assert.equal(numero('0.92'), .92);
  for (const str of ['', ' ', '12A', '1.000,50', '1,000.50', 'Infinity', 'NaN', '1e309']) assert.throws(() => numero(str));
});
test('current: 127 V resistive, 220 V phase-phase and balanced 380 V motor', () => {
  perto(corrente(1270,127,1,false).valor,10);
  perto(corrente(1760,220,.8,false).valor,10);
  perto(corrente(Math.sqrt(3)*380*10*.8*.9,380,.8,true,true,.9).valor,10);
  for(const fp of [0,-1,1.1,NaN,Infinity]) assert.throws(() => corrente(1000,127,fp,false));
  assert.throws(() => corrente(Infinity,127,1,false));
});
test('voltage drop: √3 for balanced three-phase and factor 2 for two-wire', () => {
  const tri = queda(10,380,100,1,0,1,true,4,0,5);
  const mono = queda(10,127,100,1,0,1,false,4,0,5);
  perto(tri.valor, Math.sqrt(3)/380*100); perto(mono.valor,2/127*100);
});
test('voltage drop checks terminal AND cumulative limits, no 7% blanket approval', () => {
  assert.equal(queda(10,100,100,2.5,0,1,false,4,0,7).atende,false); // terminal 5%
  assert.equal(queda(10,100,100,1.5,0,1,false,4,3,5).atende,false); // total 6%
  assert.equal(queda(10,100,100,1.5,0,1,false,4,1,5).atende,true);
  assert.throws(() => queda(10000,127,100,20,0,1,false,4,0,5));
  assert.throws(() => queda(10,127,100,1,-1,1,false,4,0,5));
});
test('ampacity regression anchors: PVC tables, not XLPE or invented values', () => {
  assert.equal(AMPACIDADE.B1[0][10],232); assert.equal(AMPACIDADE.B1[1][8],134);
  assert.equal(AMPACIDADE.A1[0][0],14.5); assert.equal(AMPACIDADE.B2[1][0],15);
  assert.equal(AMPACIDADE.E[0][0],22); assert.equal(AMPACIDADE.E[1][14],430);
});
test('grouping: six circuits 0.57; temp >60°C and invalid counts rejected', () => {
  assert.equal(fatorAgrupamento(6),.57); assert.equal(fatorAgrupamento(7),.54); assert.equal(fatorAgrupamento(20),.38);
  assert.equal(fatorTemperatura(31),.94); assert.equal(fatorTemperatura(60),.50);
  for(const n of [0,-1,1.5,21,NaN]) assert.throws(() => fatorAgrupamento(n));
  for(const t of [-10,0,61,70,NaN]) assert.throws(() => fatorTemperatura(t));
});
test('conductor: corrected capacity selects larger cable and respects minimums', () => {
  assert.equal(bitola(20,'B1',2,1,30,false).valor,2.5);
  assert.equal(bitola(20,'B1',2,2,40,false).valor,4); // 32*.8*.87=22.272
  assert.equal(bitola(5,'B1',2,1,30,false).valor,2.5);
  assert.equal(bitola(5,'B1',2,1,30,true).valor,1.5);
  assert.equal(bitola(20,'B1',3,2,40,false).valor,6); // 4 mm²: 28*.8*.87 <20
  assert.throws(() => bitola(1000,'B1',2,1,30,false));
  assert.throws(() => bitola(20,'B1',2,1,30,false,'manual',0));
});
test('PE rounds upward to a commercial cross-section', () => {
  assert.equal(secaoPE(16),16); assert.equal(secaoPE(35),16); assert.equal(secaoPE(95),50);
  assert.equal(secaoPE(120),70); assert.equal(secaoPE(150),95); assert.equal(secaoPE(185),95);
});
test('breaker rejects I2 failure even when Ib ≤ In ≤ Iz holds', () => {
  assert.equal(disjuntor(20,25,25,36.25,3,6,10000,115,2.5).atende,true);
  assert.equal(disjuntor(20,25,25,40,3,6,10000,115,2.5).atende,false);
  assert.equal(disjuntor(20,25,25,36.25,10,6,10000,115,2.5).atende,false);
  assert.equal(disjuntor(20,25,25,36.25,3,6,100000,115,2.5).atende,false);
});
test('reactive compensation example and no-correction equality', () => {
  perto(capacitor(10,.8,1).valor,7.5); perto(capacitor(10,.8,.8).valor,0);
  assert.throws(() => capacitor(10,.9,.8)); assert.throws(() => capacitor(10,NaN,.92));
});
test('lighting uses supplied photometry, Fu and Fm', () => {
  assert.equal(iluminacao(20,300,2000,20,.6,.8).valor,7);
  assert.throws(() => iluminacao(20,300,0,20,.6,.8));
  assert.throws(() => iluminacao(20,300,2000,20,0,.8));
});
test('energy allows zero usage and free tariff but rejects impossible schedules', () => {
  perto(consumo(1000,2,30,1,50).valor,30);
  perto(consumo(1000,0,30,0,100).valor,0);
  for (const h of [-1,25,NaN]) assert.throws(() => consumo(1000,h,30,1,100));
  for (const days of [0,1.5,32]) assert.throws(() => consumo(1000,2,days,1,100));
});
test('converter applies monophase FP in both directions and motor efficiency', () => {
  perto(converter(10,'A','W',127,.8,false,1).valor,1016);
  perto(converter(1016,'W','A',127,.8,false,1).valor,10);
  perto(converter(1,'cv','W',127,1,false,.8).valor,735.49875/.8);
  perto(converter(735.49875/.8,'W','cv',127,1,false,.8).valor,1);
});
test('same physical quantity and VA ↔ A do not require irrelevant inputs', () => {
  perto(converter(1000,'mA','A',NaN,NaN,false,NaN).valor,1);
  perto(converter(1,'kW','W',NaN,NaN,false,NaN).valor,1000);
  perto(converter(1270,'VA','A',127,NaN,false,NaN).valor,10);
  perto(converter(10,'A','kVA',220,NaN,true,NaN).valor,Math.sqrt(3)*2.2);
  assert.throws(() => converter(10,'A','W',127,0,false,1));
  assert.throws(() => converter(1000,'W','A',0,1,false,1));
});
