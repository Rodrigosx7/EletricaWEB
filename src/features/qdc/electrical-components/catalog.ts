import type { CatalogItem, Device, DpsInput, Terminal } from '../types.ts';
import { breaker2pTerminals, GENERIC_DIN_2P } from './technicalCatalog.ts';

export const DPS_MODELS = [
  { id: 'classe-ii-20ka-275v', name: 'Classe II · 20 kA · 275 V', surgeCurrent: 20, voltage: 275, description: 'DPS Classe II, corrente máxima de descarga de 20 kA e tensão máxima de operação contínua de 275 V.' },
  { id: 'classe-ii-40ka-275v', name: 'Classe II · 40 kA · 275 V', surgeCurrent: 40, voltage: 275, description: 'DPS Classe II, corrente máxima de descarga de 40 kA e tensão máxima de operação contínua de 275 V.' },
  { id: 'classe-ii-20ka-320v', name: 'Classe II · 20 kA · 320 V', surgeCurrent: 20, voltage: 320, description: 'DPS Classe II, corrente máxima de descarga de 20 kA e tensão máxima de operação contínua de 320 V.' },
  { id: 'classe-ii-40ka-320v', name: 'Classe II · 40 kA · 320 V', surgeCurrent: 40, voltage: 320, description: 'DPS Classe II, corrente máxima de descarga de 40 kA e tensão máxima de operação contínua de 320 V.' },
  { id: 'classe-i-ii-12-5ka-275v', name: 'Classe I+II · 12,5 kA · 275 V', surgeCurrent: 12.5, voltage: 275, description: 'DPS combinado Classe I+II, corrente de impulso de 12,5 kA e tensão máxima de operação contínua de 275 V.' },
] as const;

export const CATALOG: CatalogItem[] = [
  { type: 'breaker-1p', name: 'Disjuntor monopolar', category: 'Proteção', modules: 1, poles: 1, description: 'Proteção de um polo; corrente e curva a definir.' },
  { type: 'breaker-2p', name: 'Disjuntor bipolar', category: 'Proteção', modules: 2, poles: 2, description: 'Dois polos com acionamento conjunto.' },
  { type: 'breaker-3p', name: 'Disjuntor tripolar', category: 'Proteção', modules: 3, poles: 3, description: 'Três polos com acionamento conjunto.' },
  { type: 'main-breaker', name: 'Disjuntor geral', category: 'Proteção', modules: 2, poles: 2, description: 'Dispositivo geral; seleção depende da alimentação.' },
  { type: 'rcd-2p', name: 'DR bipolar', category: 'Proteção', modules: 2, poles: 2, description: 'Terminais de fase e neutro; não substitui proteção de sobrecorrente.' },
  { type: 'rcd-4p', name: 'DR tetrapolar', category: 'Proteção', modules: 4, poles: 4, description: 'Terminais de três fases e neutro.' },
  { type: 'spd', name: 'DPS', category: 'Proteção', modules: 1, poles: 1, description: 'DPS pré-configurado; selecione uma combinação existente de classe, tensão e corrente de descarga.' },
  { type: 'rcbo-2p', name: 'Disjuntor com DR', category: 'Proteção', modules: 2, poles: 2, description: 'Proteção diferencial e sobrecorrente combinadas.' },
  { type: 'switch-disconnector-2p', name: 'Interruptor-seccionador', category: 'Proteção', modules: 2, poles: 2, description: 'Seccionamento bipolar; categoria e corrente a definir conforme o fabricante.' },
  { type: 'fuse-holder', name: 'Porta-fusível', category: 'Proteção', modules: 1, poles: 1, description: 'Porta-fusível modular; fusível e capacidade de interrupção a definir.' },
  { type: 'motor-breaker-3p', name: 'Disjuntor-motor', category: 'Proteção', modules: 3, poles: 3, description: 'Proteção de motor em três polos; faixa de ajuste e coordenação a definir.' },
  { type: 'comb-bus', name: 'Barramento pente', category: 'Distribuição', modules: 3, poles: 2, description: 'Pente fino sobre os bornes dos disjuntores; não recebe fios diretamente.', mount: 'overlay' },
  { type: 'neutral-bus', name: 'Barramento de neutro', category: 'Distribuição', modules: 1, poles: 8, description: 'Barramento vertical azul com quantidade de bornes configurável.' },
  { type: 'earth-bus', name: 'Barramento de terra', category: 'Distribuição', modules: 1, poles: 8, description: 'Barramento vertical verde com quantidade de bornes configurável.' },
  { type: 'terminal', name: 'Borne', category: 'Distribuição', modules: 1, poles: 1, description: 'Ponto de conexão modular.' },
  { type: 'through-terminal', name: 'Borne de passagem', category: 'Distribuição', modules: 1, poles: 1, description: 'Conexão de passagem no trilho DIN.' },
  { type: 'terminal-n', name: 'Borne de neutro', category: 'Distribuição', modules: 1, poles: 1, description: 'Borne genérico identificado para neutro.' },
  { type: 'terminal-pe', name: 'Borne de proteção PE', category: 'Distribuição', modules: 1, poles: 1, description: 'Borne genérico identificado para condutor de proteção.' },
  { type: 'distribution-block', name: 'Bloco distribuidor', category: 'Distribuição', modules: 3, poles: 4, description: 'Distribuição visual; capacidade a definir.' },
  { type: 'power-entry', name: 'Entrada de energia', category: 'Infraestrutura', modules: 1, poles: 3, description: 'Representação visual do padrão de entrada e medição. Conecta a alimentação externa ao quadro por fase, neutro e PE.', mount: 'edge' },
  { type: 'conduit-entry', name: 'Eletroduto de entrada/saída', category: 'Infraestrutura', modules: 1, poles: 4, description: 'Passagem pela borda do quadro para indicar a entrada ou saída dos fios de um circuito.', mount: 'edge' },
  { type: 'contactor', name: 'Contator', category: 'Automação', modules: 3, poles: 3, description: 'Contatos de potência e terminais A1/A2 da bobina.' },
  { type: 'relay', name: 'Relé', category: 'Automação', modules: 2, poles: 1, description: 'Bobina A1/A2 e contato reversível 11/12/14.' },
  { type: 'timer', name: 'Temporizador', category: 'Automação', modules: 2, poles: 1, description: 'Alimentação e saída de comando; pinagem genérica.' },
  { type: 'level-relay', name: 'Relé de nível', category: 'Automação', modules: 2, poles: 1, description: 'Comando de nível com terminais de sensor ilustrativos.' },
  { type: 'power-supply', name: 'Fonte DIN', category: 'Automação', modules: 3, poles: 2, description: 'Entrada L/N e saída +/−; tensão de saída a definir.' },
  { type: 'smart-relay', name: 'Relé inteligente', category: 'Automação', modules: 4, poles: 2, description: 'Entradas e saídas de comando ilustrativas.' },
  { type: 'impulse-relay', name: 'Relé de impulso', category: 'Automação', modules: 1, poles: 1, description: 'Relé modular de comando por impulso; terminais genéricos.' },
  { type: 'overload-relay', name: 'Relé de sobrecarga', category: 'Automação', modules: 3, poles: 3, description: 'Representação genérica; ajuste e associação ao contator a definir.' },
  { type: 'phase-monitor', name: 'Monitor de fases', category: 'Automação', modules: 2, poles: 3, description: 'Monitor trifásico genérico; funções e contatos dependem do modelo.' },
  { type: 'din-socket', name: 'Tomada DIN', category: 'Outros', modules: 3, poles: 2, description: 'Terminais L, N e PE.' },
  { type: 'bell', name: 'Campainha', category: 'Outros', modules: 1, poles: 1, description: 'Sinalização sonora com dois terminais.' },
  { type: 'indicator', name: 'Sinalizador', category: 'Outros', modules: 1, poles: 1, description: 'Sinalização luminosa com dois terminais.' },
  { type: 'meter', name: 'Medidor de energia', category: 'Outros', modules: 4, poles: 2, description: 'Medidor ilustrativo L/N; confira o diagrama do fabricante.' },
  { type: 'voltmeter', name: 'Voltímetro DIN', category: 'Outros', modules: 2, poles: 2, description: 'Indicação de tensão; faixa e ligação dependem do modelo.' },
  { type: 'ammeter', name: 'Amperímetro DIN', category: 'Outros', modules: 2, poles: 2, description: 'Indicação de corrente; entrada direta ou TC depende do modelo.' },
];

const terminal = (id: string, label: string, side: Terminal['side'], index: number, kind: Terminal['kind'] = 'L'): Terminal => ({ id, label, side, index, kind });

/** Pinagens genéricas editáveis pelo projeto; não representam um modelo de fabricante. */
export function buildTerminals(type: string, poles: number): Terminal[] {
  if (type === 'breaker-2p' && poles === 2) return breaker2pTerminals();
  if (type === 'comb-bus') return [];
  if (type === 'neutral-bus' || type === 'earth-bus') {
    const kind = type === 'neutral-bus' ? 'N' : 'PE';
    return Array.from({ length: poles }, (_, i) => terminal(`side-${i}`, `${kind}${i + 1}`, 'right', i, kind));
  }
  if (type === 'power-entry') {
    const count = Math.max(3, poles), phases = count - 2;
    return Array.from({ length: count }, (_, i) => i < phases
      ? terminal(`edge-${i}`, ['R', 'S', 'T'][i], 'bottom', i)
      : i === phases ? terminal(`edge-${i}`, 'N', 'bottom', i, 'N') : terminal(`edge-${i}`, 'PE', 'bottom', i, 'PE'));
  }
  if (type === 'conduit-entry') return Array.from({ length: poles }, (_, i) => terminal(`edge-${i}`, `Fio ${i + 1}`, 'bottom', i, 'control'));
  if (type === 'spd') return [terminal('top-0', 'L', 'top', 0), terminal('bottom-0', 'PE', 'bottom', 0, 'PE')];
  if (type === 'power-supply') return [terminal('top-0', 'L', 'top', 0), terminal('top-1', 'N', 'top', 1, 'N'), terminal('bottom-0', '+', 'bottom', 0, 'control'), terminal('bottom-1', '−', 'bottom', 1, 'control')];
  if (type === 'din-socket') return [terminal('top-0', 'L', 'top', 0), terminal('top-1', 'N', 'top', 1, 'N'), terminal('top-2', 'PE', 'top', 2, 'PE')];
  if (type === 'terminal-n' || type === 'terminal-pe') {
    const kind = type === 'terminal-n' ? 'N' : 'PE';
    return [terminal('top-0', kind, 'top', 0, kind), terminal('bottom-0', kind, 'bottom', 0, kind)];
  }
  if (['relay', 'timer', 'level-relay'].includes(type)) {
    const terms = [terminal('top-0', 'A1', 'top', 0, 'control'), terminal('top-1', 'A2', 'top', 1, 'control'), terminal('bottom-0', '11', 'bottom', 0, 'control'), terminal('bottom-1', '12', 'bottom', 1, 'control'), terminal('bottom-2', '14', 'bottom', 2, 'control')];
    if (type === 'level-relay') terms.push(terminal('top-2', 'S', 'top', 2, 'control'));
    return terms;
  }
  if (type === 'smart-relay') return ['L', 'N', 'I1', 'I2'].map((name, i) => terminal(`top-${i}`, name, 'top', i, i === 1 ? 'N' : i > 1 ? 'control' : 'L')).concat(['Q1', 'Q2', 'Q3', 'Q4'].map((name, i) => terminal(`bottom-${i}`, name, 'bottom', i, 'control')));
  const terms: Terminal[] = [];
  for (const side of ['top', 'bottom'] as const) {
    for (let i = 0; i < poles; i++) {
      const neutral = (type.startsWith('rcd-') || type.startsWith('rcbo-') || type === 'meter') && i === poles - 1;
      terms.push(terminal(`${side}-${i}`, neutral ? 'N' : poles === 1 ? 'L' : `L${i + 1}`, side, i, neutral ? 'N' : 'L'));
    }
  }
  if (type === 'contactor') terms.push(terminal('coil-a1', 'A1', 'top', poles, 'control'), terminal('coil-a2', 'A2', 'bottom', poles, 'control'));
  return terms;
}

export function buildSpdTerminals(input: DpsInput = 'phase'): Terminal[] {
  return [
    terminal('top-0', input === 'neutral' ? 'N' : 'L', 'top', 0, input === 'neutral' ? 'N' : 'L'),
    terminal('bottom-0', 'PE', 'bottom', 0, 'PE'),
  ];
}

export function createDevice(type: string): Device {
  const item = CATALOG.find(entry => entry.type === type);
  if (!item) throw new Error('Componente não encontrado no catálogo.');
  const dps = type === 'spd' ? DPS_MODELS[0] : null;
  return {
    id: crypto.randomUUID(), type, label: item.name, rail: 0, slot: 0, modules: item.modules,
    poles: item.poles, amperage: null, curve: 'C', gauge: null, sensitivity: 0,
    voltage: dps?.voltage ?? 0, surgeCurrent: dps?.surgeCurrent ?? 0, description: dps?.description ?? '', circuitId: null,
    color: type === 'neutral-bus' ? '#1686cf' : type === 'earth-bus' ? '#27854c' : '#20252b',
    terminals: buildTerminals(type, item.poles), mount: item.mount ?? 'rail',
    edgeSide: item.mount === 'edge' ? 'top' : undefined, edgeOffset: item.mount === 'edge' ? type === 'power-entry' ? 88 : 50 : undefined,
    model: dps?.id,
    technicalModelId: type === 'breaker-2p' ? GENERIC_DIN_2P.id : undefined,
    visualVariant: type === 'breaker-2p' ? GENERIC_DIN_2P.visualVariant : undefined,
    breakingCapacityKa: type === 'breaker-2p' ? null : undefined,
    tag: type === 'breaker-2p' ? '' : undefined,
    spdInput: type === 'spd' ? 'phase' : undefined,
    visualModel: 'classic',
    orientation: type === 'neutral-bus' || type === 'earth-bus' ? 'vertical' : undefined,
    busTerminalSide: type === 'neutral-bus' || type === 'earth-bus' ? 'right' : undefined,
    combSide: type === 'comb-bus' ? 'bottom' : undefined,
  };
}
