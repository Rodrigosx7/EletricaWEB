import type { CatalogItem, Device, Terminal } from '../types.ts';

export const CATALOG: CatalogItem[] = [
  { type: 'breaker-1p', name: 'Disjuntor monopolar', category: 'Proteção', modules: 1, poles: 1, description: 'Proteção de um polo; corrente e curva a definir.' },
  { type: 'breaker-2p', name: 'Disjuntor bipolar', category: 'Proteção', modules: 2, poles: 2, description: 'Dois polos com acionamento conjunto.' },
  { type: 'breaker-3p', name: 'Disjuntor tripolar', category: 'Proteção', modules: 3, poles: 3, description: 'Três polos com acionamento conjunto.' },
  { type: 'main-breaker', name: 'Disjuntor geral', category: 'Proteção', modules: 2, poles: 2, description: 'Dispositivo geral; seleção depende da alimentação.' },
  { type: 'rcd-2p', name: 'DR bipolar', category: 'Proteção', modules: 2, poles: 2, description: 'Terminais de fase e neutro; não substitui proteção de sobrecorrente.' },
  { type: 'rcd-4p', name: 'DR tetrapolar', category: 'Proteção', modules: 4, poles: 4, description: 'Terminais de três fases e neutro.' },
  { type: 'spd', name: 'DPS', category: 'Proteção', modules: 1, poles: 1, description: 'Representação L–PE genérica; topologia e características a verificar.' },
  { type: 'rcbo-2p', name: 'Disjuntor com DR', category: 'Proteção', modules: 2, poles: 2, description: 'Representação genérica de proteção diferencial e sobrecorrente combinadas.' },
  { type: 'switch-disconnector-2p', name: 'Interruptor-seccionador', category: 'Proteção', modules: 2, poles: 2, description: 'Seccionamento bipolar; categoria e corrente a definir conforme o fabricante.' },
  { type: 'fuse-holder', name: 'Porta-fusível', category: 'Proteção', modules: 1, poles: 1, description: 'Porta-fusível modular; fusível e capacidade de interrupção a definir.' },
  { type: 'motor-breaker-3p', name: 'Disjuntor-motor', category: 'Proteção', modules: 3, poles: 3, description: 'Proteção de motor em três polos; faixa de ajuste e coordenação a definir.' },
  { type: 'comb-bus', name: 'Barramento pente', category: 'Distribuição', modules: 4, poles: 4, description: 'Distribuição visual de um mesmo potencial.' },
  { type: 'neutral-bus', name: 'Barramento de neutro', category: 'Distribuição', modules: 4, poles: 8, description: 'Oito pontos identificados N.' },
  { type: 'earth-bus', name: 'Barramento de terra', category: 'Distribuição', modules: 4, poles: 8, description: 'Oito pontos identificados PE.' },
  { type: 'terminal', name: 'Borne', category: 'Distribuição', modules: 1, poles: 1, description: 'Ponto de conexão modular.' },
  { type: 'through-terminal', name: 'Borne de passagem', category: 'Distribuição', modules: 1, poles: 1, description: 'Conexão de passagem no trilho DIN.' },
  { type: 'terminal-n', name: 'Borne de neutro', category: 'Distribuição', modules: 1, poles: 1, description: 'Borne genérico identificado para neutro.' },
  { type: 'terminal-pe', name: 'Borne de proteção PE', category: 'Distribuição', modules: 1, poles: 1, description: 'Borne genérico identificado para condutor de proteção.' },
  { type: 'distribution-block', name: 'Bloco distribuidor', category: 'Distribuição', modules: 3, poles: 4, description: 'Distribuição visual; capacidade a definir.' },
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
  { type: 'meter', name: 'Medidor de energia', category: 'Outros', modules: 4, poles: 2, description: 'Medidor ilustrativo L/N; conferir diagrama do fabricante.' },
  { type: 'voltmeter', name: 'Voltímetro DIN', category: 'Outros', modules: 2, poles: 2, description: 'Indicação de tensão; faixa e ligação dependem do modelo.' },
  { type: 'ammeter', name: 'Amperímetro DIN', category: 'Outros', modules: 2, poles: 2, description: 'Indicação de corrente; entrada direta ou TC depende do modelo.' },
];

const terminal = (id: string, label: string, side: Terminal['side'], index: number, kind: Terminal['kind'] = 'L'): Terminal => ({ id, label, side, index, kind });

/** Pinagens genéricas editáveis pelo projeto; não representam um modelo de fabricante. */
export function buildTerminals(type: string, poles: number): Terminal[] {
  if (type === 'neutral-bus' || type === 'earth-bus' || type === 'comb-bus') {
    const kind = type === 'neutral-bus' ? 'N' : type === 'earth-bus' ? 'PE' : 'L';
    return Array.from({ length: poles }, (_, i) => terminal(`top-${i}`, `${kind}${i + 1}`, 'top', i, kind));
  }
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

export function createDevice(type: string): Device {
  const item = CATALOG.find(entry => entry.type === type);
  if (!item) throw new Error('Componente não encontrado no catálogo.');
  return {
    id: crypto.randomUUID(), type, label: item.name, rail: 0, slot: 0, modules: item.modules,
    poles: item.poles, amperage: null, curve: 'C', gauge: null, sensitivity: 0,
    voltage: 0, surgeCurrent: 0, description: '', circuitId: null,
    color: type === 'neutral-bus' ? '#1686cf' : type === 'earth-bus' ? '#27854c' : '#20252b',
    terminals: buildTerminals(type, item.poles),
  };
}
