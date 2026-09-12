// Base tabular: Prysmian, Guia de Dimensionamento BT rev.10, pp.9,11,14,15.
// NBR 5410:2004 citada pelo fabricante; não equivale a certificar a edição vigente.
export const SECOES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
export type Metodo = 'A1' | 'A2' | 'B1' | 'B2' | 'C' | 'E';
export const AMPACIDADE: Record<Metodo, [number[], number[]]> = {
  A1: [[14.5,19.5,26,34,46,61,80,99,119,151,182,210,240,273,321], [13.5,18,24,31,42,56,73,89,108,136,164,188,216,245,286]],
  A2: [[14,18.5,25,32,43,57,75,92,110,139,167,192,219,248,291], [13,17.5,23,29,39,52,68,83,99,125,150,172,196,223,261]],
  B1: [[17.5,24,32,41,57,76,101,125,151,192,232,269,309,353,415], [15.5,21,28,36,50,68,89,110,134,171,207,239,275,314,370]],
  B2: [[16.5,23,30,38,52,69,90,111,133,168,201,232,265,300,351], [15,20,27,34,46,62,80,99,118,149,179,206,236,268,313]],
  C: [[19.5,27,36,46,63,85,112,138,168,213,258,299,344,392,461], [17.5,24,32,41,57,76,96,119,144,184,223,259,299,341,403]],
  E: [[22,30,40,51,70,94,119,148,180,232,282,328,379,434,514], [18.5,25,34,43,60,80,101,126,153,196,238,276,319,364,430]],
};

export function numero(texto: string): number {
  const limpo = texto.trim();
  // Sem separadores de milhar: não aceitar prefixos parciais como 10abc ou 1.000,5.
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(limpo)) throw new Error('Informe números válidos, sem separador de milhar. Use ponto ou vírgula decimal.');
  const valor = Number(limpo.replace(',', '.'));
  if (!Number.isFinite(valor)) throw new Error('O número está fora do intervalo suportado.');
  return valor;
}
function faixa(valor: number, nome: string, min = 0, max = Number.MAX_VALUE, incluirMin = false) {
  if (!Number.isFinite(valor) || (incluirMin ? valor < min : valor <= min) || valor > max) {
    throw new Error(`${nome}: informe valor ${incluirMin ? 'a partir de' : 'maior que'} ${min}${max < Number.MAX_VALUE ? ` e até ${max}` : ''}.`);
  }
}
function inteiro(valor: number, nome: string, max: number) {
  faixa(valor, nome, 0, max);
  if (!Number.isInteger(valor)) throw new Error(`${nome}: use um número inteiro.`);
}
export const formatar = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
export type Resultado = { valor: number; unidade: string; titulo: string; formula: string; detalhes: [string, string][]; notas: string[]; atende?: boolean; preenchimento?: Record<string, number> };
const f = formatar;
function resultado(r: Resultado): Resultado {
  if (!Number.isFinite(r.valor) || r.detalhes.some(([, v]) => /NaN|Infinity/.test(v))) throw new Error('Resultado fora do intervalo numérico suportado. Revise as entradas.');
  return r;
}

export function corrente(p: number, v: number, fp: number, tri: boolean, mecanica = false, eta = 1): Resultado {
  faixa(p, 'Potência'); faixa(v, 'Tensão'); faixa(fp, 'FP', 0, 1);
  if (mecanica) faixa(eta, 'Rendimento', 0, 1);
  const ativa = p / (mecanica ? eta : 1);
  const aparente = ativa / fp;
  const i = aparente / ((tri ? Math.sqrt(3) : 1) * v);
  return resultado({ valor: i, unidade: 'A', titulo: 'Corrente em regime permanente',
    formula: `I = P / (${mecanica ? 'η × ' : ''}${tri ? '√3 × ' : ''}U × FP) = ${f(p)} W / (${mecanica ? `${f(eta)} × ` : ''}${tri ? '√3 × ' : ''}${f(v)} V × ${f(fp)}) = ${f(i)} A`,
    detalhes: [['Potência ativa de entrada P', `${f(ativa)} W`], ['Potência aparente S', `${f(aparente)} VA`]],
    notas: ['Use a tensão entre os dois terminais da carga; no trifásico equilibrado, use a tensão entre fases e a potência total das três fases.', 'O valor calculado não é corrente de partida. Corrente nominal deve ser conferida na placa; Ib depende do regime, da demanda justificada e das condições reais.', 'FP é P/S. Não se calcula potência reativa por arccos(FP) para cargas com distorção harmônica significativa.'] });
}

export function fatorTemperatura(t: number) {
  faixa(t, 'Temperatura ambiente para PVC', 10, 60, true);
  const pontos = [[10,1.22],[15,1.17],[20,1.12],[25,1.06],[30,1],[35,.94],[40,.87],[45,.79],[50,.71],[55,.61],[60,.50]];
  return pontos.find(([temp]) => temp >= t)![1]; // faixa superior: conservador, sem extrapolação
}
export function fatorAgrupamento(n: number) {
  inteiro(n, 'Número de circuitos', 20);
  return [1,.8,.7,.65,.6,.57,.54,.52,.5,.5,.5,.45,.45,.45,.45,.41,.41,.41,.41,.38][n - 1];
}
export function secaoPE(fase: number) {
  faixa(fase, 'Seção da fase');
  const minima = fase <= 16 ? fase : fase <= 35 ? 16 : fase / 2;
  const secao = SECOES.find(s => s >= minima);
  if (!secao) throw new Error('PE fora das seções disponíveis.');
  return secao;
}
export function bitola(ib: number, metodo: Metodo, carregados: number, n: number, t: number, iluminacao: boolean, agrupamento = 'feixe', fatorManual?: number): Resultado {
  faixa(ib, 'Corrente de projeto Ib');
  if (![2,3].includes(carregados) || !AMPACIDADE[metodo]) throw new Error('Método ou número de condutores não suportado.');
  const ft = fatorTemperatura(t);
  let fg: number;
  if (agrupamento === 'manual') { faixa(fatorManual!, 'Fator de agrupamento', 0, 1); fg = fatorManual!; }
  else fg = fatorAgrupamento(n);
  const idx = SECOES.findIndex((s, index) => s >= (iluminacao ? 1.5 : 2.5) && AMPACIDADE[metodo][carregados - 2][index] * ft * fg >= ib);
  if (idx < 0) throw new Error('Nenhuma seção até 240 mm² atende à ampacidade corrigida. Não há bitola recomendada neste intervalo.');
  const s = SECOES[idx]; const iz0 = AMPACIDADE[metodo][carregados - 2][idx]; const iz = iz0 * ft * fg;
  return resultado({ valor: s, unidade: 'mm²', titulo: 'Seção preliminar por ampacidade',
    formula: `Iz = Iz₀ × Ft × Fg = ${f(iz0)} × ${f(ft)} × ${f(fg)} = ${f(iz)} A ≥ Ib = ${f(ib)} A`,
    detalhes: [['Ampacidade de referência Iz₀', `${f(iz0)} A`], ['Ampacidade corrigida Iz', `${f(iz)} A`], ['Corrente equivalente para consulta', `${f(ib / (ft * fg))} A`], ['PE preliminar (mesmo material da fase)', `${f(secaoPE(s))} mm²`]],
    preenchimento: { iz, secao: s },
    notas: ['Escopo: cobre, PVC 70 °C, instalação fixa, 2 ou 3 condutores carregados. A tensão não determina o número de condutores carregados.', 'Ft usa o próximo patamar de temperatura da tabela. Fg automático: feixe homogêneo, circuitos igualmente carregados; outras disposições exigem fator verificado.', 'A seção atende somente à ampacidade e ao mínimo por uso. Ainda faltam queda de tensão, proteção, curto-circuito e condições de instalação.', 'PE: regra simplificada para mesmo material; verificar mínimos mecânicos quando separado e suportabilidade térmica. Neutro não é automaticamente reduzido: verificar desequilíbrio e harmônicos.'] });
}

export function queda(i: number, v: number, l: number, r: number, x: number, cos: number, tri: boolean, limite: number, montante: number, total: number): Resultado {
  faixa(i, 'Corrente'); faixa(v, 'Tensão'); faixa(l, 'Comprimento de ida'); faixa(r, 'Resistência em serviço'); faixa(x, 'Reatância', 0, Number.MAX_VALUE, true); faixa(cos, 'cos φ', 0, 1);
  faixa(limite, 'Limite do trecho', 0, 100); faixa(montante, 'Queda a montante', 0, 100, true); faixa(total, 'Limite total', 0, 100);
  const dv = (tri ? Math.sqrt(3) : 2) * i * (l / 1000) * (r * cos + x * Math.sqrt(1 - cos * cos));
  const percent = dv / v * 100; const acumulada = percent + montante;
  if (acumulada >= 100) throw new Error('Queda ≥ 100%: aproximação de regime permanente inválida para estas entradas.');
  return resultado({ valor: percent, unidade: '%', titulo: 'Queda no trecho', atende: percent <= limite && acumulada <= total,
    formula: `ΔU = ${tri ? '√3' : '2'} × ${f(i)} A × (${f(l)} / 1000) km × (${f(r)} Ω/km × ${f(cos)} + ${f(x)} Ω/km × √(1 − ${f(cos)}²)) = ${f(dv)} V`,
    detalhes: [['Queda no trecho', `${f(dv)} V`], ['Queda acumulada', `${f(acumulada)}%`], ['Limites trecho / total', `${f(limite)}% / ${f(total)}%`], ['Tensão final aproximada com montante', `${f(v * (1 - acumulada / 100))} V`]],
    notas: ['Modelo aproximado de carga senoidal indutiva em regime permanente; trifásico equilibrado. R e X são de um condutor, em Ω/km, obtidos do fabricante para material, seção, disposição e temperatura de serviço.', 'L é somente ida. Queda a montante e tensão devem usar a mesma base nominal. Não somar volts fase-neutro com volts fase-fase.', 'Referência do guia baseado em NBR 5410:2004: até 4% no circuito terminal; total usual 5% desde entrega em BT ou 7% desde transformador/gerador nas condições previstas. Um limite total de 7% não autoriza 7% no terminal. Exigências da concessionária e equipamento podem ser mais restritivas.', 'A comparação verifica apenas os limites informados; não certifica a instalação nem cobre partida de motores ou cargas capacitivas.'] });
}

export function disjuntor(ib: number, iz: number, nominal: number, i2: number, icc: number, interrupcao: number, energia: number, k: number, s: number): Resultado {
  for (const [n, v] of Object.entries({ Ib: ib, Iz: iz, In: nominal, I2: i2, 'Icc máximo (kA)': icc, 'Capacidade de interrupção (kA)': interrupcao, 'I²t (A²s)': energia, k, 'Seção (mm²)': s })) faixa(v, n);
  const termico = (k * s) ** 2;
  const coordenado = ib <= nominal && nominal <= iz && i2 <= 1.45 * iz;
  return resultado({ valor: nominal, unidade: 'A', titulo: 'Disjuntor informado — verificação parcial', atende: coordenado && interrupcao >= icc && energia <= termico,
    formula: `Ib ≤ In ≤ Iz: ${f(ib)} ≤ ${f(nominal)} ≤ ${f(iz)} A; I₂ ≤ 1,45 Iz: ${f(i2)} ≤ ${f(1.45 * iz)} A; I²t ≤ k²S²: ${f(energia)} ≤ ${f(termico)} A²s`,
    detalhes: [['Coordenação de sobrecarga', coordenado ? 'Atende às duas desigualdades' : 'Não atende'], ['Interrupção ≥ Icc máximo', interrupcao >= icc ? 'Atende aos valores informados' : 'Capacidade insuficiente'], ['Suportabilidade térmica do condutor', energia <= termico ? 'Atende aos valores informados' : 'Energia passante excessiva']],
    notas: ['Iz deve incluir todos os fatores de correção. I₂ é a corrente convencional de atuação do dispositivo, obtida na norma/ficha do fabricante; não é a corrente nominal.', 'Use Icn ou Icu conforme a norma do dispositivo, na tensão e configuração de polos reais; verifique Ics para continuidade de serviço.', 'I²t deve ser a energia passante máxima do dispositivo nas condições de falta; k depende do material, isolação e temperaturas. Relação adiabática limitada a tempos curtos (até 5 s), respeitando o fabricante.', 'Ainda faltam curva, partida, seletividade, Icc mínimo/impedância de laço e tempo de seccionamento conforme TT/TN/IT. Esta comparação não seleciona DR/DPS nem aprova proteção contra choques.'] });
}

export function capacitor(p: number, atual: number, alvo: number): Resultado {
  faixa(p, 'Potência ativa em kW'); faixa(atual, 'cos φ atual', 0, 1); faixa(alvo, 'cos φ desejado', 0, 1);
  if (alvo < atual) throw new Error('A correção capacitiva exige alvo igual ou superior ao cos φ atual.');
  const q1 = p * Math.tan(Math.acos(atual)); const q2 = p * Math.tan(Math.acos(alvo));
  return resultado({ valor: q1 - q2, unidade: 'kvar', titulo: 'Compensação reativa teórica',
    formula: `Qc = ${f(p)} kW × [tan(arccos ${f(atual)}) − tan(arccos ${f(alvo)})] = ${f(q1-q2)} kvar`,
    detalhes: [['Q antes', `${f(q1)} kvar`], ['Q após (alvo)', `${f(q2)} kvar`], ['S antes', `${f(p / atual)} kVA`]],
    notas: ['Apenas cargas indutivas senoidais: aqui FP = cos φ. Harmônicos exigem análise de ressonância, filtragem e eventual banco dessintonizado.', 'Não define capacitância, tensão nominal, ligação estrela/triângulo, estágios ou proteção. Evite sobrecompensação em baixa carga.', 'O alvo é uma entrada do projeto. Não se presume cobrança de reativos nem um limite tarifário universal para clientes residenciais.'] });
}

export function iluminacao(area: number, lux: number, fluxo: number, potencia: number, fu: number, fm: number): Resultado {
  faixa(area, 'Área'); faixa(lux, 'Iluminância alvo'); faixa(fluxo, 'Fluxo da luminária'); faixa(potencia, 'Potência da luminária'); faixa(fu, 'Fu', 0, 1); faixa(fm, 'Fm', 0, 1);
  const n = Math.ceil(lux * area / (fluxo * fu * fm));
  return resultado({ valor: n, unidade: 'luminárias', titulo: 'Quantidade estimada — método dos lúmens',
    formula: `N = teto[(${f(lux)} lx × ${f(area)} m²) / (${f(fluxo)} lm × ${f(fu)} × ${f(fm)})] = ${f(n)}`,
    detalhes: [['Potência instalada', `${f(n * potencia)} W`], ['Iluminância média estimada', `${f(n * fluxo * fu * fm / area)} lx`]],
    notas: ['Use o fluxo luminoso da luminária completa, dados fotométricos para Fu e plano de manutenção para Fm. Nenhum fator foi assumido automaticamente.', 'A iluminância requerida depende da tarefa e da norma aplicável. Este cálculo não verifica uniformidade, ofuscamento, reprodução de cor, disposição ou iluminação de emergência. Não equivale à previsão de carga mínima da NBR 5410.'] });
}
export function consumo(p: number, horas: number, dias: number, tarifa: number, ciclo: number): Resultado {
  faixa(p, 'Potência ativa', 0, Number.MAX_VALUE, true); faixa(horas, 'Horas/dia', 0, 24, true); inteiro(dias, 'Dias/mês', 31); faixa(tarifa, 'Tarifa', 0, Number.MAX_VALUE, true); faixa(ciclo, 'Ciclo de funcionamento (%)', 0, 100, true);
  const e = p / 1000 * horas * dias * ciclo / 100;
  return resultado({ valor: e, unidade: 'kWh/mês', titulo: 'Consumo estimado',
    formula: `E = (${f(p)} W / 1000) × ${f(horas)} h/dia × ${f(dias)} dias × (${f(ciclo)} / 100) = ${f(e)} kWh`,
    detalhes: [['Custo variável estimado', `${f(e * tarifa)} R$/mês`], ['Energia por dia de uso', `${f(p / 1000 * horas * ciclo / 100)} kWh`]],
    notas: ['Potência elétrica ativa, não capacidade térmica em BTU/h. Use ciclo de 100% para potência média medida ou funcionamento contínuo; termostatos e compressores exigem dados de uso/etiqueta.', 'A tarifa informada deve representar o custo variável desejado. Estimativa exclui cobrança mínima, disponibilidade, iluminação pública e outros itens não incluídos na tarifa.'] });
}
export const UNIDADES = ['W','kW','VA','kVA','A','mA','hp','cv'] as const;
export type Unidade = typeof UNIDADES[number];
const categoria = (u: Unidade) => ['A','mA'].includes(u) ? 'corrente' : ['VA','kVA'].includes(u) ? 'aparente' : ['hp','cv'].includes(u) ? 'mecanica' : 'ativa';
const escalaUnidade: Record<Unidade, number> = { W: 1, kW: 1000, VA: 1, kVA: 1000, A: 1, mA: .001, hp: 745.699872, cv: 735.49875 };
export function requisitosConversao(de: Unidade, para: Unidade) {
  const a = categoria(de); const b = categoria(para);
  return { tensao: a !== b && (a === 'corrente' || b === 'corrente'), fp: a !== b && ((['ativa','mecanica'].includes(a) && ['corrente','aparente'].includes(b)) || (['ativa','mecanica'].includes(b) && ['corrente','aparente'].includes(a))), rendimento: a !== b && (a === 'mecanica' || b === 'mecanica') };
}
export function converter(valor: number, de: Unidade, para: Unidade, v: number, fp: number, tri: boolean, eta: number): Resultado {
  faixa(valor, 'Valor', 0, Number.MAX_VALUE, true);
  if (!UNIDADES.includes(de) || !UNIDADES.includes(para)) throw new Error('Unidade inválida.');
  const req = requisitosConversao(de, para);
  if (req.tensao) faixa(v, 'Tensão'); if (req.fp) faixa(fp, 'FP', 0, 1); if (req.rendimento) faixa(eta, 'Rendimento', 0, 1);
  const u = req.tensao ? v * (tri ? Math.sqrt(3) : 1) : 1;
  const fator = req.fp ? fp : 1; const rend = req.rendimento ? eta : 1;
  const toBase: Record<string, number> = { corrente: u * fator, aparente: fator, ativa: 1, mecanica: 1 / rend };
  const a = categoria(de); const b = categoria(para);
  const res = a === b ? valor * escalaUnidade[de] / escalaUnidade[para] : valor * escalaUnidade[de] * toBase[a] / (toBase[b] * escalaUnidade[para]);
  return resultado({ valor: res, unidade: para, titulo: 'Conversão', formula: `${f(valor)} ${de} × ${f(escalaUnidade[de])}${a !== b ? ` × ${f(toBase[a])} / ${f(toBase[b])}` : ''} / ${f(escalaUnidade[para])} = ${f(res)} ${para}`,
    detalhes: [[ 'Relações utilizadas', 'P = S × FP; S = U × I (mono) ou √3 × U × I (tri); Pmec = η × Pentrada' ]],
    notas: ['hp e cv representam potência mecânica de saída do motor; o rendimento conecta essa saída à potência elétrica de entrada. W e kW nesta ferramenta representam potência ativa elétrica.', 'Conversões dentro da mesma grandeza não exigem tensão, FP ou rendimento. Trifásico considera carga equilibrada, tensão entre fases e potência total.'] });
}
