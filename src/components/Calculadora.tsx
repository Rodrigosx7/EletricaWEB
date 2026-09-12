import { useState, type ReactNode } from 'react';
import { Zap, Cable, Activity, Gauge, CircuitBoard, Lightbulb, Receipt, Ruler, RotateCcw } from 'lucide-react';
import { corrente, bitola, queda, disjuntor, capacitor, iluminacao, consumo, converter, numero, formatar, requisitosConversao, UNIDADES, type Metodo, type Unidade, type Resultado } from '../utils/calculosEletricos';

type Aba = 'corrente' | 'bitola' | 'queda' | 'fator' | 'disjuntor' | 'iluminacao' | 'consumo' | 'conversor';
type Dados = Record<string, string>;
type Sugestao = readonly [valor: string, rotulo: string];

const PRESETS_CONSUMO = [
  { id: 'personalizado', nome: 'Preencher manualmente', potencia: '', horas: '', dias: '30', ciclo: '100', nota: 'Informe a potência elétrica ativa da etiqueta ou uma medição.' },
  { id: 'chuveiro', nome: 'Chuveiro elétrico', potencia: '5500', horas: '0.5', dias: '30', ciclo: '100', nota: 'Base inicial: 5.500 W por 30 minutos diários.' },
  { id: 'geladeira', nome: 'Geladeira / refrigerador', potencia: '150', horas: '24', dias: '30', ciclo: '30', nota: 'O ciclo do compressor varia bastante; prefira o consumo mensal informado na etiqueta.' },
  { id: 'ar', nome: 'Ar-condicionado 12.000 BTU/h', potencia: '1100', horas: '8', dias: '30', ciclo: '60', nota: 'BTU/h é capacidade térmica. Confira a potência elétrica de entrada e o consumo sazonal do modelo.' },
  { id: 'microondas', nome: 'Micro-ondas', potencia: '1400', horas: '0.25', dias: '30', ciclo: '100', nota: 'Base inicial: 1.400 W por 15 minutos diários.' },
  { id: 'lavadora', nome: 'Máquina de lavar roupas', potencia: '1000', horas: '1', dias: '12', ciclo: '100', nota: 'Base inicial: 12 ciclos mensais de uma hora.' },
  { id: 'tv', nome: 'Televisão LED', potencia: '100', horas: '5', dias: '30', ciclo: '100', nota: 'Base inicial: 100 W por 5 horas diárias.' },
  { id: 'ventilador', nome: 'Ventilador', potencia: '100', horas: '8', dias: '30', ciclo: '100', nota: 'Base inicial: 100 W por 8 horas diárias.' },
  { id: 'lampada', nome: 'Lâmpada LED', potencia: '10', horas: '5', dias: '30', ciclo: '100', nota: 'Resultado para uma lâmpada; multiplique a potência pela quantidade para analisar o conjunto.' },
  { id: 'computador', nome: 'Computador de mesa', potencia: '300', horas: '6', dias: '22', ciclo: '100', nota: 'A potência real depende da carga; medição é preferível à potência nominal da fonte.' },
] as const;

const INICIAIS: Record<Aba, Dados> = {
  corrente: { potencia: '', tensao: '127', fp: '', sistema: 'mono', tipo: 'eletrica', eta: '' },
  bitola: { ib: '', metodo: 'B1', carregados: '2', circuitos: '1', temperatura: '30', tipo: 'forca', agrupamento: 'feixe', fg: '' },
  queda: { corrente: '', tensao: '127', comprimento: '', resistencia: '', reatancia: '', fp: '', sistema: 'mono', trecho: 'terminal', limite: '4', origem: 'bt', total: '5', montante: '' },
  fator: { potencia: '', atual: '', alvo: '', senoidal: 'nao' },
  disjuntor: { ib: '', iz: '', nominal: '', i2: '', icc: '', interrupcao: '', energia: '', k: '', secao: '' },
  iluminacao: { area: '', lux: '', fluxo: '', potencia: '', fu: '', fm: '' },
  consumo: { equipamento: 'personalizado', potencia: '', horas: '', dias: '30', tarifa: '', ciclo: '100' },
  conversor: { valor: '', de: 'kW', para: 'W', tensao: '127', fp: '', sistema: 'mono', eta: '' },
};
const ABAS = [
  { id: 'corrente', nome: 'Corrente', Icone: Zap }, { id: 'bitola', nome: 'Bitola', Icone: Cable },
  { id: 'queda', nome: 'Queda de tensão', Icone: Activity }, { id: 'fator', nome: 'Fator de potência', Icone: Gauge },
  { id: 'disjuntor', nome: 'Disjuntor', Icone: CircuitBoard }, { id: 'iluminacao', nome: 'Iluminação', Icone: Lightbulb },
  { id: 'consumo', nome: 'Consumo', Icone: Receipt }, { id: 'conversor', nome: 'Conversor', Icone: Ruler },
] as const;
const METODOS: [string, string][] = [
  ['A1', 'A1 — isolados/unipolares em eletroduto, parede termicamente isolante'],
  ['A2', 'A2 — multipolar em eletroduto, parede termicamente isolante'],
  ['B1', 'B1 — isolados/unipolares em eletroduto aparente ou alvenaria'],
  ['B2', 'B2 — multipolar em eletroduto aparente ou alvenaria'],
  ['C', 'C — cabos fixados diretamente, conforme disposição de referência'],
  ['E', 'E — cabo multipolar ao ar livre'],
];

function calcular(aba: Aba, d: Dados): Resultado {
  const n = (key: string) => numero(d[key]);
  switch (aba) {
    case 'corrente': return corrente(n('potencia'), n('tensao'), n('fp'), d.sistema === 'tri', d.tipo === 'mecanica', d.tipo === 'mecanica' ? n('eta') : 1);
    case 'bitola': return bitola(n('ib'), d.metodo as Metodo, n('carregados'), d.agrupamento === 'manual' ? 1 : n('circuitos'), n('temperatura'), d.tipo === 'iluminacao', d.agrupamento, d.agrupamento === 'manual' ? n('fg') : undefined);
    case 'queda': return queda(n('corrente'), n('tensao'), n('comprimento'), n('resistencia'), n('reatancia'), n('fp'), d.sistema === 'tri', d.trecho === 'terminal' ? 4 : n('limite'), n('montante'), d.origem === 'bt' ? 5 : d.origem === 'transformador' ? 7 : n('total'));
    case 'fator':
      if (d.senoidal !== 'sim') throw new Error('Confirme carga indutiva senoidal. FP com harmônicos não pode ser tratado automaticamente como cos φ.');
      return capacitor(n('potencia'), n('atual'), n('alvo'));
    case 'disjuntor': return disjuntor(n('ib'), n('iz'), n('nominal'), n('i2'), n('icc'), n('interrupcao'), n('energia'), n('k'), n('secao'));
    case 'iluminacao': return iluminacao(n('area'), n('lux'), n('fluxo'), n('potencia'), n('fu'), n('fm'));
    case 'consumo': return consumo(n('potencia'), n('horas'), n('dias'), n('tarifa'), n('ciclo'));
    case 'conversor': {
      const req = requisitosConversao(d.de as Unidade, d.para as Unidade);
      return converter(n('valor'), d.de as Unidade, d.para as Unidade, req.tensao ? n('tensao') : 1, req.fp ? n('fp') : 1, d.sistema === 'tri', req.rendimento ? n('eta') : 1);
    }
  }
}

export default function Calculadora() {
  const [aba, setAba] = useState<Aba>('corrente');
  const [dados, setDados] = useState(INICIAIS);
  const [calculados, setCalculados] = useState<Partial<Record<Aba, Resultado>>>({});
  const [erro, setErro] = useState('');
  const d = dados[aba]; const res = calculados[aba];
  function alterar(key: string, value: string) {
    setDados(prev => ({ ...prev, [aba]: { ...prev[aba], [key]: value } }));
    setCalculados(prev => ({ ...prev, [aba]: undefined })); setErro('');
  }
  function campo(key: string, label: string, ajuda?: string, sugestoes?: readonly Sugestao[]) {
    const id = `calc-${aba}-${key}`;
    return <div><label className="field-label" htmlFor={id}>{label}</label><input id={id} className="input-base" inputMode="decimal" value={d[key]} onChange={e => alterar(key, e.target.value)} required aria-describedby={ajuda ? `${id}-ajuda` : undefined} />
      {sugestoes && <div className="field-suggestions" aria-label={`Preenchimento rápido para ${label}`}><span>Escolhas rápidas</span>{sugestoes.map(([valor, rotulo]) => <button key={valor} type="button" aria-pressed={d[key] === valor} onClick={() => alterar(key, valor)}>{rotulo}</button>)}</div>}
      {ajuda && <p id={`${id}-ajuda`} className="tool-note">{ajuda}</p>}</div>;
  }
  function select(key: string, label: string, options: readonly (readonly [string, string])[]) {
    const id = `calc-${aba}-${key}`;
    return <div><label className="field-label" htmlFor={id}>{label}</label><select id={id} className="input-base" value={d[key]} onChange={e => alterar(key, e.target.value)}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></div>;
  }
  function sistema() {
    const tensoes: readonly Sugestao[] = d.sistema === 'tri' ? [['220', '220 V'], ['380', '380 V'], ['440', '440 V']] : [['127', '127 V'], ['220', '220 V']];
    return <>{select('sistema', 'Ligação da carga', [['mono', 'Uma carga entre dois condutores (fase-neutro ou fase-fase)'], ['tri', 'Trifásico equilibrado']])}{campo('tensao', d.sistema === 'tri' ? 'Tensão entre fases (V)' : 'Tensão nos terminais da carga (V)', 'Padrão local monofásico: 127 V. Confira a tensão real; ela não define sozinha o número de fases.', tensoes)}</>;
  }
  function usarCorrenteCalculada(key: string) {
    const valor = calculados.corrente?.valor;
    if (valor === undefined) return null;
    const entrada = String(Math.round(valor * 10000) / 10000);
    return <button type="button" className="calculator-transfer" onClick={() => alterar(key, entrada)}>Usar {formatar(valor)} A calculados na aba Corrente</button>;
  }
  function usarBitolaCalculada() {
    const valores = calculados.bitola?.preenchimento;
    if (!valores) return null;
    return <button type="button" className="calculator-transfer" onClick={() => {
      setDados(prev => ({ ...prev, disjuntor: { ...prev.disjuntor, iz: String(Math.round(valores.iz * 10000) / 10000), secao: String(valores.secao) } }));
      setCalculados(prev => ({ ...prev, disjuntor: undefined }));
      setErro('');
    }}>Usar cabo de {formatar(valores.secao)} mm² e Iz {formatar(valores.iz)} A da aba Bitola</button>;
  }
  function aplicarPresetConsumo(id: string) {
    const preset = PRESETS_CONSUMO.find(item => item.id === id) ?? PRESETS_CONSUMO[0];
    setDados(prev => ({ ...prev, consumo: { ...prev.consumo, equipamento: preset.id, potencia: preset.potencia, horas: preset.horas, dias: preset.dias, ciclo: preset.ciclo } }));
    setCalculados(prev => ({ ...prev, consumo: undefined }));
    setErro('');
  }
  let campos: ReactNode;
  switch (aba) {
    case 'corrente': campos = <>{select('tipo', 'Potência informada', [['eletrica', 'Ativa elétrica de entrada (W)'], ['mecanica', 'Mecânica de saída do motor (W)']])}{campo('potencia', 'Potência total da carga (W)')}{sistema()}{campo('fp', 'Fator de potência FP (0 < FP ≤ 1)', 'Use placa ou medição. Carga puramente resistiva: FP = 1.', [['1', '1,00'], ['0.92', '0,92'], ['0.8', '0,80']])}{d.tipo === 'mecanica' && campo('eta', 'Rendimento do motor (0 < η ≤ 1)', 'São atalhos de preenchimento, não valores presumidos. Obtenha o rendimento da placa.', [['0.8', '80%'], ['0.9', '90%'], ['0.95', '95%']])}</>; break;
    case 'bitola': campos = <><p className="inline-alert">Cobre / PVC 70 °C. Pré-seleção por ampacidade; não é dimensionamento completo.</p>{usarCorrenteCalculada('ib')}{campo('ib', 'Corrente de projeto Ib (A)')}{select('metodo', 'Método de referência', METODOS)}{select('carregados', 'Condutores carregados por circuito', [['2', '2 condutores carregados'], ['3', '3 condutores carregados']])}{select('tipo', 'Aplicação em instalação fixa', [['forca', 'Força / tomadas — mínimo 2,5 mm²'], ['iluminacao', 'Iluminação — mínimo 1,5 mm²']])}{campo('temperatura', 'Temperatura ambiente (°C)', 'Faixa tabulada: 10 a 60 °C; temperatura do ar, não do condutor.', [['30', '30 °C'], ['35', '35 °C'], ['40', '40 °C'], ['45', '45 °C']])}{select('agrupamento', 'Disposição do agrupamento', [['feixe', 'Feixe homogêneo / mesmo conduto fechado'], ['manual', 'Outra disposição — fator verificado']])}{d.agrupamento === 'manual' ? campo('fg', 'Fator de agrupamento verificado (0 < Fg ≤ 1)', 'Consulte a tabela aplicável à disposição, espaçamento e camadas reais.') : campo('circuitos', 'Circuitos igualmente carregados no feixe (1 a 20)', undefined, [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']])}</>; break;
    case 'queda': campos = <>{sistema()}{usarCorrenteCalculada('corrente')}{campo('corrente', 'Corrente em regime (A)')}{campo('comprimento', 'Comprimento de ida do trecho (m)', undefined, [['10', '10 m'], ['20', '20 m'], ['30', '30 m'], ['50', '50 m']])}{campo('resistencia', 'Resistência CA na temperatura de serviço R (Ω/km)', 'Da ficha do cabo escolhido: material, seção e temperatura. Não usar resistência a 20 °C para condutor quente.')}{campo('reatancia', 'Reatância indutiva X (Ω/km)', 'Do fabricante conforme disposição. Digite zero apenas se a omissão for tecnicamente justificada.')}{campo('fp', 'cos φ da carga indutiva (0 < cos φ ≤ 1)', undefined, [['1', '1,00'], ['0.92', '0,92'], ['0.8', '0,80']])}{select('trecho', 'Trecho analisado', [['terminal', 'Circuito terminal — referência máxima 4%'], ['outro', 'Distribuição / critério mais restritivo']])}{d.trecho === 'outro' && campo('limite', 'Limite adotado para o trecho (%)', undefined, [['2', '2%'], ['3', '3%'], ['4', '4%']])}{select('origem', 'Referência para queda total acumulada', [['bt', 'Desde ponto de entrega em BT — 5%'], ['transformador', 'Desde secundário do transformador / saída do gerador — 7%'], ['manual', 'Limite de projeto / concessionária']])}{d.origem === 'manual' && campo('total', 'Limite total adotado (%)', undefined, [['4', '4%'], ['5', '5%'], ['7', '7%']])}{campo('montante', 'Queda já existente a montante (%)', 'Informe na mesma base de tensão; zero somente se não houver trecho a montante.', [['0', '0%'], ['1', '1%'], ['2', '2%']])}</>; break;
    case 'disjuntor': campos = <><p className="inline-alert">Confira um dispositivo da ficha do fabricante. A corrente nominal sozinha não define uma proteção adequada.</p>{usarCorrenteCalculada('ib')}{usarBitolaCalculada()}{campo('ib', 'Corrente de projeto Ib (A)')}{campo('iz', 'Ampacidade corrigida do condutor Iz (A)')}{campo('nominal', 'Corrente nominal do disjuntor In (A)', 'Escolhas rápidas são correntes nominais usuais; confirme série, curva, polos e aplicação do dispositivo.', [['6', '6 A'], ['10', '10 A'], ['16', '16 A'], ['20', '20 A'], ['25', '25 A'], ['32', '32 A'], ['40', '40 A'], ['50', '50 A'], ['63', '63 A']])}{campo('i2', 'Corrente convencional de atuação I₂ (A)')}{campo('icc', 'Curto-circuito presumido máximo no ponto (kA)')}{campo('interrupcao', 'Capacidade de interrupção na tensão real (kA)', undefined, [['3', '3 kA'], ['4.5', '4,5 kA'], ['6', '6 kA'], ['10', '10 kA']])}{campo('energia', 'Energia passante máxima I²t (A²s)')}{campo('k', 'Coeficiente térmico k (A·√s/mm²)', 'Da referência aplicável ao material, isolação e temperaturas inicial/final.')}{campo('secao', 'Seção do condutor protegido (mm²)', undefined, [['1.5', '1,5'], ['2.5', '2,5'], ['4', '4'], ['6', '6'], ['10', '10']])}</>; break;
    case 'fator': campos = <>{select('senoidal', 'Condição da carga', [['nao', 'Não confirmada / presença de harmônicos'], ['sim', 'Indutiva senoidal — FP equivale a cos φ']])}{campo('potencia', 'Potência ativa elétrica (kW)')}{campo('atual', 'cos φ atual', undefined, [['0.7', '0,70'], ['0.8', '0,80'], ['0.9', '0,90']])}{campo('alvo', 'cos φ desejado', 'Defina conforme projeto; o alvo não implica obrigação tarifária universal.', [['0.92', '0,92'], ['0.95', '0,95'], ['0.98', '0,98']])}</>; break;
    case 'iluminacao': campos = <>{campo('area', 'Área do plano de trabalho (m²)')}{campo('lux', 'Iluminância mantida desejada (lx)', 'Defina pela tarefa e pela norma aplicável ao ambiente.')}{campo('fluxo', 'Fluxo por luminária completa (lm)', 'Ficha fotométrica; não estimar lumens por uma eficiência genérica.')}{campo('potencia', 'Potência elétrica por luminária (W)')}{campo('fu', 'Fator de utilização Fu (0 < Fu ≤ 1)')}{campo('fm', 'Fator de manutenção Fm (0 < Fm ≤ 1)')}</>; break;
    case 'consumo': {
      const preset = PRESETS_CONSUMO.find(item => item.id === d.equipamento) ?? PRESETS_CONSUMO[0];
      campos = <><div className="appliance-picker"><label className="field-label" htmlFor="calc-consumo-equipamento">Equipamento para preenchimento inicial</label><select id="calc-consumo-equipamento" className="input-base" value={d.equipamento} onChange={e => aplicarPresetConsumo(e.target.value)}>{PRESETS_CONSUMO.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select><p className="tool-note">{preset.nota} Os valores carregados são editáveis e não substituem a etiqueta ou medição.</p></div>{campo('potencia', 'Potência ativa de entrada (W)')}{campo('horas', 'Horas de uso por dia (0 a 24)', undefined, [['0.25', '15 min'], ['0.5', '30 min'], ['1', '1 h'], ['4', '4 h'], ['8', '8 h'], ['24', '24 h']])}{campo('dias', 'Dias de uso no mês (1 a 31)', undefined, [['1', '1'], ['12', '12'], ['22', '22'], ['30', '30']])}{campo('ciclo', 'Fração do tempo funcionando nessa potência (%)', '100% = contínuo. Para potência média já medida, mantenha 100% para não descontar o ciclo duas vezes.', [['25', '25%'], ['50', '50%'], ['75', '75%'], ['100', '100%']])}{campo('tarifa', 'Tarifa variável (R$/kWh)')}</>; break;
    }
    case 'conversor': {
      const req = requisitosConversao(d.de as Unidade, d.para as Unidade);
      campos = <>{campo('valor', 'Valor')}{select('de', 'De', UNIDADES.map(u => [u,u]))}{select('para', 'Para', UNIDADES.map(u => [u,u]))}{req.tensao && sistema()}{req.fp && campo('fp', 'Fator de potência (0 < FP ≤ 1)', undefined, [['1', '1,00'], ['0.92', '0,92'], ['0.8', '0,80']])}{req.rendimento && campo('eta', 'Rendimento do motor (0 < η ≤ 1)', 'São atalhos de preenchimento; confirme o rendimento real.', [['0.8', '80%'], ['0.9', '90%'], ['0.95', '95%']])}</>; break;
    }
  }
  return <div className="product-page">
    <header className="page-header"><div><h1>Calculadora Elétrica</h1><p>Cálculos auxiliares com hipóteses explícitas e verificações por critério.</p></div></header>
    <div className="calculator-workspace">
      <nav className="calculator-nav" aria-label="Cálculos elétricos">{ABAS.map(({id,nome,Icone}) => <button key={id} type="button" aria-pressed={aba === id} onClick={() => { setAba(id); setErro(''); }}><Icone size={17} aria-hidden="true" />{nome}</button>)}</nav>
      <div>
        <div className="calculator-grid">
          <form className="data-panel calculator-form" onSubmit={e => { e.preventDefault(); try { const novo = calcular(aba,d); setCalculados(prev => ({...prev, [aba]: novo})); setErro(''); } catch (err) { setErro(err instanceof Error ? err.message : 'Revise as entradas.'); setCalculados(prev => ({...prev, [aba]: undefined})); } }}>
            <div className="flex items-center justify-between gap-3 mb-5"><h2 className="font-bold">{ABAS.find(a => a.id === aba)?.nome}</h2><button type="button" className="btn-secondary" onClick={() => { setDados(prev => ({...prev, [aba]: {...INICIAIS[aba]}})); setCalculados(prev => ({...prev, [aba]: undefined})); setErro(''); }}><RotateCcw size={15} />Limpar</button></div>
            <div className="space-y-5">{campos}</div>
            {erro && <p role="alert" className="inline-alert mt-5">{erro}</p>}
            <button type="submit" className="btn-primary w-full mt-6">Calcular</button>
          </form>
          <section className="calculator-result" aria-label="Resultado do cálculo" aria-live="polite">
            <h2>{res ? res.titulo : 'Preencha os dados para calcular'}</h2>
            {res ? <><p className="text-3xl font-bold break-words" style={{color: 'var(--color-primary)'}}>{formatar(res.valor)} <span className="text-base font-normal">{res.unidade}</span></p>
              {res.atende !== undefined && <p className="mt-3 text-sm">{res.atende ? 'Atende somente aos critérios e valores verificados abaixo.' : 'Não atende a um ou mais critérios verificados.'}</p>}
              <p className="mt-5 text-sm leading-relaxed break-words font-mono">{res.formula}</p>
              <dl className="mt-5 space-y-3">{res.detalhes.map(([label,value]) => <div key={label} className="border-t border-white/20 pt-3"><dt className="text-xs text-slate-300">{label}</dt><dd className="text-sm mt-1">{value}</dd></div>)}</dl>
              <h3 className="font-bold mt-6 text-sm">Hipóteses e limites</h3><ul className="list-disc pl-4 mt-3 space-y-3 text-xs text-slate-300">{res.notas.map(note => <li key={note}>{note}</li>)}</ul>
            </> : <p className="text-sm text-slate-300">Use dados de placa, projeto, medições e fichas do fabricante. Campos sem dados permanecem em branco. Alterar uma entrada invalida o resultado anterior.</p>}
          </section>
        </div>
        <details className="data-panel mt-6 p-5"><summary className="cursor-pointer font-semibold">O que falta para concluir um dimensionamento?</summary><p className="tool-note">Os cálculos acima verificam critérios separados. Para definir o circuito, reúna todos os resultados e adote a seção que atenda ao conjunto.</p><ul className="list-disc pl-5 text-sm mt-3 space-y-2"><li>Corrente de projeto, demanda justificada, partida de motores, simultaneidade e equilíbrio de fases.</li><li>Ampacidade corrigida, queda em todos os trechos, sobrecarga, curto-circuito máximo e mínimo e seletividade.</li><li>Neutro e PE, harmônicos, esquema TT/TN/IT, equipotencialização, impedância de laço e tempos de seccionamento.</li><li>Necessidade e seleção de DR e DPS: sensibilidade, tipo, corrente nominal, coordenação e condições da instalação. Aterramento não se aprova por um valor universal de resistência.</li><li>Exigências da concessionária e fabricantes; inspeção, medições e validação por profissional habilitado. Intervenções devem seguir a NR-10.</li></ul></details>
        <details className="mt-5 text-xs text-[var(--color-muted)]"><summary className="cursor-pointer font-semibold">Referências e versão da base técnica</summary><p className="mt-3">Tabelas de cobre/PVC e critérios de referência conferidos no guia Prysmian rev.10, baseado na NBR 5410:2004. Não foi possível confirmar nesta revisão o status completo da NBR 5410 no catálogo oficial. Confirme a edição aplicável antes do projeto definitivo. A NBR 5419 trata de proteção contra descargas atmosféricas; não é uma tabela genérica de aterramento.</p><ul className="list-disc pl-5 mt-3 space-y-2"><li><a className="underline" href="https://br.prysmian.com/sites/br.prysmian.com/files/media/documents/Guia_de_Dimensionamento-Baixa_Tensao_Rev10.pdf" target="_blank" rel="noreferrer">Prysmian — tabelas, queda e coordenação</a></li><li><a className="underline" href="https://www.electrical-installation.org/enwiki/Calculation_of_voltage_drop_in_steady_load_conditions" target="_blank" rel="noreferrer">Schneider Electric — queda em regime permanente</a></li><li><a className="underline" href="https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-10-nr-10" target="_blank" rel="noreferrer">Ministério do Trabalho — NR-10</a></li><li><a className="underline" href="https://www.abntcatalogo.com.br/" target="_blank" rel="noreferrer">ABNT — conferir versões aplicáveis (inclusive NBR 5419 e iluminação)</a></li></ul></details>
      </div>
    </div>
  </div>;
}
