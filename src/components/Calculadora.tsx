// ============================================
// UTILITÁRIOS
// ============================================

/**
 * Parse numérico seguro: converte vírgula em ponto,
 * retorna 0 se resultado for NaN ou indefinido.
 */
function parseNumber(valor: string): number {
  if (valor === undefined || valor === null) return 0;
  const normalized = String(valor).replaceAll(",", ".");
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

// ============================================
// 1) CORRENTE ELÉTRICA
// Mono: I = P / (V × FP)
// Tri:  I = P / (√3 × V × FP)
// ============================================
function calcularCorrente(
  potenciaW: number,
  tensaoV: number,
  fatorPotencia: number,
  monofasico: boolean
): { corrente: number; trifasico: boolean; valido: boolean; erro: string | null } {
  if (!potenciaW || potenciaW <= 0) {
    return { corrente: 0, trifasico: !monofasico, valido: false, erro: "Potência deve ser maior que zero." };
  }
  if (!tensaoV || tensaoV <= 0) {
    return { corrente: 0, trifasico: !monofasico, valido: false, erro: "Tensão deve ser maior que zero." };
  }
  if (!fatorPotencia || fatorPotencia <= 0 || fatorPotencia > 1) {
    return { corrente: 0, trifasico: !monofasico, valido: false, erro: "Fator de potência deve estar entre 0 e 1." };
  }
  let corrente: number;
  if (monofasico) {
    corrente = potenciaW / (tensaoV * fatorPotencia);
  } else {
    corrente = potenciaW / (Math.sqrt(3) * tensaoV * fatorPotencia);
  }
  return { corrente, trifasico: !monofasico, valido: true, erro: null };
}

// ============================================
// 2) FATORES DE CORREÇÃO (NBR 5410)
// ============================================

/** Agrupamento: mais de 1 circuito no mesmo eletroduto */
function fatorAgrupamento(nCircuitos: number): number {
  if (!nCircuitos || nCircuitos <= 1) return 1.0;
  if (nCircuitos === 2) return 0.80;
  if (nCircuitos === 3) return 0.70;
  if (nCircuitos === 4) return 0.65;
  if (nCircuitos <= 6) return 0.60;
  if (nCircuitos <= 9) return 0.50;
  return 0.45; // 10+ circuitos
}

/** Temperatura ambiente: assume 30°C como base da tabela */
function fatorTemperatura(tempC: number): number {
  if (!tempC || tempC <= 0) return 1.0;
  if (tempC <= 25) return 1.06;
  if (tempC <= 30) return 1.00;
  if (tempC <= 35) return 0.94;
  if (tempC <= 40) return 0.87;
  if (tempC <= 45) return 0.79;
  if (tempC <= 50) return 0.71;
  return 0.61; // 55°C+
}

// ============================================
// 3) TABELA DE AMPACIDADE NBR 5410 (Tabela 36/37)
// Matriz: método × bitola × nCondutores
// Colunas: 2 condutores (mono/bifásico) | 3 condutores (trifásico)
// ============================================

type MetodoInstalacao = "A1" | "A2" | "B1" | "B2" | "C" | "E";
type NCondutores = 2 | 3;

const BITOLAS_PADRAO = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];

/**
 * Tabela 36 e 37 da NBR 5410 simplificada.
 * Cobre, isolação PVC 70°C.
 * Indices: [A1, A2, B1, B2, C, E]
 * Cada método tem arrays de 15 valores (1.5 a 240 mm²)
 * [0]=2 condutores, [1]=3 condutores
 */
const TAB_AMPACIDADE: Record<MetodoInstalacao, [number[], number[]]> = {
  // Cobre PVC 70°C — Tabela 36/37 NBR 5410
  // 2 condutores (mono/bifásico sem neutro)
  // 3 condutores (trifásico)
  A1: [[15, 19.5, 26, 34, 43, 57, 76, 96, 119, 149, 190, 229, 264, 300, 354],
        [13.5, 17.5, 24, 31, 39, 52, 70, 89, 110, 138, 176, 212, 244, 278, 328]],
  A2: [[14.5, 18.5, 25, 33, 42, 56, 74, 94, 117, 146, 185, 223, 257, 293, 346],
        [13, 17, 23, 30, 38, 51, 68, 87, 108, 135, 172, 207, 239, 272, 321]],
  B1: [[17.5, 24, 32, 41, 57, 76, 101, 125, 151, 192, 246, 283, 328, 374, 449],
        [15.5, 21, 28, 36, 50, 68, 89, 110, 137, 174, 222, 256, 299, 341, 410]],
  B2: [[16, 22, 29, 38, 52, 70, 93, 116, 144, 184, 235, 274, 320, 364, 438],
        [14, 19, 26, 33, 45, 62, 82, 103, 128, 164, 209, 246, 285, 326, 393]],
  C:  [[20, 27, 36, 46, 61, 83, 110, 137, 169, 216, 275, 335, 387, 441, 522],
        [18, 24, 32, 41, 54, 75, 100, 125, 154, 196, 250, 304, 353, 403, 479]],
  E:  [[24, 33, 45, 61, 83, 110, 141, 176, 216, 271, 347, 421, 488, 557, 661],
        [21, 29, 39, 53, 72, 96, 124, 155, 190, 239, 306, 372, 432, 493, 586]],
};

/**
 * Retorna a ampacidade conforme Tabela 36/37 da NBR 5410.
 */
function getAmpacidade(
  bitola: number,
  metodo: MetodoInstalacao,
  nCondutores: NCondutores
): number {
  const idx = BITOLAS_PADRAO.indexOf(bitola);
  if (idx === -1) return 0;
  const col = nCondutores === 2 ? 0 : 1;
  return TAB_AMPACIDADE[metodo][col][idx] ?? 0;
}

// ============================================
// 4) DIMENSIONAMENTO DE BITOLA (com Terra)
// Regra NBR 5410 Tabela 47: bitola mínima
// Regra NBR 5410 Tabela 58: terra
// ============================================

/** Calcula bitola do terra conforme Tabela 58 NBR 5410 */
function calcularBitolaTerra(bitolaFase: number): number {
  if (bitolaFase <= 16) return bitolaFase;
  if (bitolaFase <= 35) return 16;
  return Math.ceil(bitolaFase / 2 * 2) / 2; // metade da fase
}

type ResultadoBitola = {
  bitola: number;
  ampacidade: number;
  compativel: boolean;
  correnteAjustada: number;
  terra: number;
  bitolaMinima: number;
  erro: string | null;
};

function recomendarBitola(
  correnteA: number,
  metodo: MetodoInstalacao,
  nCondutores: NCondutores,
  nCircuitos: number,
  tempC: number,
  tipoCircuito: "iluminacao" | "forca"
): ResultadoBitola {
  if (!correnteA || correnteA <= 0) {
    return {
      bitola: 0, ampacidade: 0, compativel: false,
      correnteAjustada: 0, terra: 0, bitolaMinima: 0, erro: "Corrente inválida."
    };
  }

  // Bitola mínima mecânica (Tabela 47 NBR 5410)
  const bitolaMinima = tipoCircuito === "iluminacao" ? 1.5 : 2.5;

  // Fatores de correção
  const fatGrupo = fatorAgrupamento(nCircuitos);
  const fatTemp = fatorTemperatura(tempC);
  const correnteAjustada = correnteA / (fatGrupo * fatTemp);

  // Percorre bitolas da menor para a maior
  const bitolasValidas = BITOLAS_PADRAO.filter(b => b >= bitolaMinima);
  for (const bitola of bitolasValidas) {
    const amp = getAmpacidade(bitola, metodo, nCondutores);
    if (amp >= correnteAjustada) {
      return {
        bitola,
        ampacidade: amp,
        compativel: true,
        correnteAjustada,
        terra: calcularBitolaTerra(bitola),
        bitolaMinima,
        erro: null
      };
    }
  }

  // Excedeu 240mm²
  return {
    bitola: 240,
    ampacidade: getAmpacidade(240, metodo, nCondutores),
    compativel: false,
    correnteAjustada,
    terra: calcularBitolaTerra(240),
    bitolaMinima,
    erro: "Bitola acima de 240 mm² — consulte profissional habilitado."
  };
}

// ============================================
// 5) QUEDA DE TENSÃO (Física Real a 70°C)
// ρ Cobre = 0.021 Ω·mm²/m | ρ Alumínio = 0.035 Ω·mm²/m
// X (reatância) = 0.0001 Ω/m
// ΔV = I × L × [ (ρ/S) × cosφ + X × sinφ ]
// Limite: 4% (derivação direto da concessionária) | 7% (c/ transformador próprio)
// ============================================

const RHO_COBRE_70C = 0.021;
const RHO_ALUMINIO_70C = 0.035;
const REATANCIA_X = 0.0001; // Ω/m

// ============================================
// 5) QUEDA DE TENSÃO
type ResultadoQueda = {
  quedaV: number;
  quedaPercentual: number;
  compativel: boolean;
  limitePercentual: number;
  tensaoFinal: number;
  erro: string | null;
};

function calcularQuedaTensao(
  correnteA: number,
  tensaoV: number,
  comprimentoM: number,
  bitolaMm2: number,
  monofasico: boolean,
  material: "cobre" | "aluminio",
  fp: number,
  origemEnergia: OrigemEnergia
): ResultadoQueda {
  if (!correnteA || correnteA <= 0) {
    return { quedaV: 0, quedaPercentual: 0, compativel: false, limitePercentual: 4, tensaoFinal: tensaoV, erro: "Corrente inválida." };
  }
  if (!tensaoV || tensaoV <= 0) {
    return { quedaV: 0, quedaPercentual: 0, compativel: false, limitePercentual: 4, tensaoFinal: tensaoV, erro: "Tensão inválida." };
  }
  if (!comprimentoM || comprimentoM <= 0) {
    return { quedaV: 0, quedaPercentual: 0, compativel: false, limitePercentual: 4, tensaoFinal: tensaoV, erro: "Comprimento inválido." };
  }
  if (!bitolaMm2 || bitolaMm2 <= 0) {
    return { quedaV: 0, quedaPercentual: 0, compativel: false, limitePercentual: 4, tensaoFinal: tensaoV, erro: "Bitola inválida." };
  }
  if (fp <= 0 || fp > 1) {
    return { quedaV: 0, quedaPercentual: 0, compativel: false, limitePercentual: 4, tensaoFinal: tensaoV, erro: "Fator de potência inválido." };
  }

  const rho = material === "cobre" ? RHO_COBRE_70C : RHO_ALUMINIO_70C;
  const fpValido = Math.min(Math.max(fp, 0.01), 1);
  const cosPhi = fpValido;
  const sinPhi = Math.sin(Math.acos(fpValido));

  // ΔV = I × L × [ (ρ/S) × cosφ + X × sinφ ]
  // Para monofásico: L = ida+volta (×2); para trifásico: L = fase (×1)
  const fatorDistancia = monofasico ? 2 : 1;
  const quedaV = correnteA * comprimentoM * fatorDistancia * ((rho / bitolaMm2) * cosPhi + REATANCIA_X * sinPhi);

  const quedaPercentual = (quedaV / tensaoV) * 100;
  const limitePercentual = origemEnergia === "concessionaria" ? 4 : 7;
  const tensaoFinal = tensaoV - quedaV;

  return {
    quedaV,
    quedaPercentual,
    compativel: quedaPercentual <= limitePercentual,
    limitePercentual,
    tensaoFinal,
    erro: null
  };
}

// ============================================
// 6) DISJUNTOR (Regra NBR 5410: Ib ≤ In ≤ Iz)
// Remove multiplicador 1.25 (regra NEC, não NBR)
// ============================================

const DISJUNTORES_COMERCIAIS = [10, 15, 16, 20, 25, 30, 32, 35, 40, 50, 63, 70, 80, 100, 125];

type ResultadoDisjuntor = {
  disjuntor: number;
  compativel: boolean;
  erro: string | null;
};

function recomendarDisjuntor(
  correnteA: number,
  ampacidadeCabo: number
): ResultadoDisjuntor {
  if (!correnteA || correnteA <= 0) {
    return { disjuntor: 0, compativel: false, erro: "Corrente de projeto inválida." };
  }
  if (!ampacidadeCabo || ampacidadeCabo <= 0) {
    return { disjuntor: 0, compativel: false, erro: "Ampacidade do cabo inválida." };
  }

  // Encontrar o menor disjuntor comercial >= Ib (corrente de projeto)
  let disjuntorSugerido = 0;
  for (const amp of DISJUNTORES_COMERCIAIS) {
    if (amp >= correnteA) {
      disjuntorSugerido = amp;
      break;
    }
  }

  if (disjuntorSugerido === 0) {
    return { disjuntor: 125, compativel: false, erro: "Corrente muito alta para disjuntores comerciais disponíveis." };
  }

  // Regra NBR 5410: Ib ≤ In ≤ Iz
  if (disjuntorSugerido > ampacidadeCabo) {
    return {
      disjuntor: disjuntorSugerido,
      compativel: false,
      erro: `Disjuntor ${disjuntorSugerido}A excede a ampacidade do cabo (${ampacidadeCabo}A). Aumente a bitola do cabo.`
    };
  }

  return { disjuntor: disjuntorSugerido, compativel: true, erro: null };
}

// ============================================
// 7) FATOR DE POTÊNCIA / CAPACITOR
// Qc = P × (tan(arccos(FP_atual)) - tan(arccos(FP_desejado)))
// ============================================

type ResultadoCapacitor = {
  potenciaReativa: number;
  valido: boolean;
  erro: string | null;
};

function calcularCapacitor(
  potenciaKW: number,
  fpAtual: number,
  fpDesejado: number
): ResultadoCapacitor {
  if (!potenciaKW || potenciaKW <= 0) {
    return { potenciaReativa: 0, valido: false, erro: "Potência deve ser maior que zero." };
  }
  if (!fpAtual || fpAtual <= 0 || fpAtual > 1) {
    return { potenciaReativa: 0, valido: false, erro: "FP atual inválido." };
  }
  if (!fpDesejado || fpDesejado <= 0 || fpDesejado > 1) {
    return { potenciaReativa: 0, valido: false, erro: "FP desejado inválido." };
  }
  if (fpDesejado <= fpAtual) {
    return { potenciaReativa: 0, valido: false, erro: "FP desejado deve ser maior que o atual." };
  }

  const potenciaReativa = potenciaKW * (Math.tan(Math.acos(fpAtual)) - Math.tan(Math.acos(fpDesejado)));
  return { potenciaReativa, valido: true, erro: null };
}

// ============================================
// 8) LUMINOTÉCNICA (NBR ISO 8995-1 - Método dos Lúmens)
// Fluxo_Total = (Lux × Área) / (Fu × Fm)
// Fu = 0.6 (fator de utilização)
// Fm = 0.8 (fator de manutenção)
// ============================================

const LUXES_POR_AMBIENTE: Record<string, number> = {
  quarto: 150,
  sala: 200,
  cozinha: 300,
  banheiro: 200,
  escritorio: 500,
  garagem: 100,
  area: 100,
  corredor: 100,
  geral: 150,
};

const FATOR_UTILIZACAO = 0.6;
const FATOR_MANUTENCAO = 0.8;

const LM_POR_WATT: Record<string, number> = {
  led: 80,
  fluorescente: 60,
  incandescente: 12,
};

type ResultadoIluminacao = {
  lampadasNecessarias: number;
  potenciaTotal: number;
  fluxoTotal: number;
  luxesAlvo: number;
  fluxoPorLampada: number;
  aviso: string | null;
  valido: boolean;
};

function calcularIluminacao(
  areaM2: number,
  potenciaLampada: number,
  lumens: number,
  tipoLampada: "led" | "fluorescente" | "incandescente",
  ambiente: string
): ResultadoIluminacao {
  if (!areaM2 || areaM2 <= 0) {
    return { lampadasNecessarias: 0, potenciaTotal: 0, fluxoTotal: 0, luxesAlvo: 0, fluxoPorLampada: 0, aviso: null, valido: false };
  }
  if (!potenciaLampada || potenciaLampada <= 0) {
    return { lampadasNecessarias: 0, potenciaTotal: 0, fluxoTotal: 0, luxesAlvo: 0, fluxoPorLampada: 0, aviso: null, valido: false };
  }

  const luxesAlvo = LUXES_POR_AMBIENTE[ambiente] ?? 150;
  const lmW = LM_POR_WATT[tipoLampada] ?? 80;

  // Lumens por lâmpada: se informada, usa; senão estima
  const fluxoPorLampada = (lumens && lumens > 0) ? lumens : potenciaLampada * lmW;

  // Fluxo total considerando perdas (NBR ISO 8995-1)
  const fluxoTotal = (luxesAlvo * areaM2) / (FATOR_UTILIZACAO * FATOR_MANUTENCAO);
  const lampadasNecessarias = Math.ceil(fluxoTotal / fluxoPorLampada);
  const potenciaTotal = lampadasNecessarias * potenciaLampada;

  const aviso = tipoLampada === "incandescente"
    ? "Lâmpada incandescente é ineficiente. Considere LED."
    : null;

  return {
    lampadasNecessarias,
    potenciaTotal,
    fluxoTotal,
    luxesAlvo,
    fluxoPorLampada,
    aviso,
    valido: true
  };
}

// ============================================
// 9) CONSUMO DE ENERGIA
// ============================================

type ResultadoConsumo = {
  consumoKWh: number;
  custoMensal: number;
  consumoDiarioKWh: number;
  custoAnual: number;
  valido: boolean;
};

function calcularConsumo(
  potenciaW: number,
  horasDia: number,
  diasMes: number,
  tarifaKWh: number
): ResultadoConsumo {
  if (!potenciaW || potenciaW <= 0) return { consumoKWh: 0, custoMensal: 0, consumoDiarioKWh: 0, custoAnual: 0, valido: false };
  if (!horasDia || !diasMes || !tarifaKWh) return { consumoKWh: 0, custoMensal: 0, consumoDiarioKWh: 0, custoAnual: 0, valido: false };

  const consumoDiarioKWh = (potenciaW * horasDia) / 1000;
  const consumoKWh = consumoDiarioKWh * diasMes;
  const custoMensal = consumoKWh * tarifaKWh;

  return {
    consumoKWh,
    custoMensal,
    consumoDiarioKWh,
    custoAnual: custoMensal * 12,
    valido: true
  };
}

// ============================================
// 10) CONVERSOR DE POTÊNCIA
// ============================================

type UnidadeEletrica = "W" | "kW" | "VA" | "kVA" | "A" | "mA" | "hp" | "cv";

type ResultadoConversao = {
  resultado: number;
  aviso: string | null;
  valido: boolean;
};

function converterPotencia(
  valor: number,
  de: UnidadeEletrica,
  para: UnidadeEletrica,
  fp: number,
  tensaoV: number,
  trifasico: boolean
): ResultadoConversao {
  if (!valor || valor <= 0) return { resultado: 0, aviso: null, valido: false };
  const fpV = Math.min(Math.max(fp, 0.01), 1);

  // Converter para watts primeiro
  let watts = 0;
  switch (de) {
    case "W": watts = valor; break;
    case "kW": watts = valor * 1000; break;
    case "VA": watts = valor * fpV; break;
    case "kVA": watts = valor * 1000 * fpV; break;
    case "A": watts = trifasico ? Math.sqrt(3) * tensaoV * valor * fpV : tensaoV * valor; break;
    case "mA": watts = trifasico ? Math.sqrt(3) * tensaoV * (valor / 1000) * fpV : tensaoV * (valor / 1000); break;
    case "hp": watts = valor * 745.7; break;
    case "cv": watts = valor * 735.5; break;
  }

  // Converter de watts para a unidade desejada
  let resultado = 0;
  switch (para) {
    case "W": resultado = watts; break;
    case "kW": resultado = watts / 1000; break;
    case "VA": resultado = fpV > 0 ? watts / fpV : watts; break;
    case "kVA": resultado = fpV > 0 ? watts / (1000 * fpV) : watts / 1000; break;
    case "A":
      if (trifasico && fpV > 0 && tensaoV > 0) resultado = watts / (Math.sqrt(3) * tensaoV * fpV);
      else if (tensaoV > 0) resultado = watts / tensaoV;
      break;
    case "mA":
      if (trifasico && fpV > 0 && tensaoV > 0) resultado = watts / (Math.sqrt(3) * tensaoV * fpV) * 1000;
      else if (tensaoV > 0) resultado = watts / tensaoV * 1000;
      break;
    case "hp": resultado = watts / 745.7; break;
    case "cv": resultado = watts / 735.5; break;
  }

  let aviso: string | null = null;
  if ((de === "VA" || de === "kVA") && fpV === 1) {
    aviso = "Assumindo FP = 1. Para motores reais, informe FP < 1.";
  }

  return { resultado, aviso, valido: true };
}

// ============================================
// COMPONENTE REACT
// ============================================

import { useState, type ReactElement } from "react";
import {
  Zap, Cable, Activity, Gauge, CircuitBoard,
  Lightbulb, Receipt, Ruler, RotateCcw, Info,
  CheckCircle2, XCircle, AlertTriangle
} from "lucide-react";
import { useToast } from "./ui/toast";

type Aba = "corrente" | "bitola" | "queda" | "fator" | "disjuntor" | "iluminacao" | "consumo" | "conversor";
type Metodo = "A1" | "A2" | "B1" | "B2" | "C" | "E";
type TipoCircuito = "iluminacao" | "forca";
type OrigemEnergia = "concessionaria" | "transformador";
type TipoLampada = "led" | "fluorescente" | "incandescente";
type UnidadeEl = "W" | "kW" | "VA" | "kVA" | "A" | "mA" | "hp" | "cv";
type Material = "cobre" | "aluminio";
type NCond = 2 | 3;

export default function Calculadora(): ReactElement {
  const { mostrarToast } = useToast();
  const [aba, setAba] = useState<Aba>("corrente");

  // --- Corrente ---
  const [potencia, setPotencia] = useState("");
  const [tensaoCorrente, setTensaoCorrente] = useState("220");
  const [fpCorrente, setFpCorrente] = useState("0.92");
  const [monofasicoCorrente, setMonofasicoCorrente] = useState(true);

  // --- Bitola ---
  const [correnteBitola, setCorrenteBitola] = useState("");
  const [sistemaBitola, setSistemaBitola] = useState<"127" | "220" | "380">("220");
  const [metodoBitola, setMetodoBitola] = useState<Metodo>("B1");
  const [nCircuitosBitola, setNCircuitosBitola] = useState("1");
  const [tempAmbienteBitola, setTempAmbienteBitola] = useState("30");
  const [tipoCircuitoBitola, setTipoCircuitoBitola] = useState<TipoCircuito>("forca");

  // --- Queda de tensão ---
  const [correnteQueda, setCorrenteQueda] = useState("");
  const [comprimentoQueda, setComprimentoQueda] = useState("");
  const [bitolaQueda, setBitolaQueda] = useState("");
  const [sistemaQueda, setSistemaQueda] = useState<"127" | "220" | "380">("220");
  const [monofasicoQueda, setMonofasicoQueda] = useState(true);
  const [origemEnergia, setOrigemEnergia] = useState<OrigemEnergia>("concessionaria");
  const [materialQueda, setMaterialQueda] = useState<Material>("cobre");
  const [fpQueda, setFpQueda] = useState("0.92");

  // --- Disjuntor ---
  const [correnteDisjuntor, setCorrenteDisjuntor] = useState("");
  const [ampacidadeDisjuntor, setAmpacidadeDisjuntor] = useState("");

  // --- Fator de potência ---
  const [potenciaFP, setPotenciaFP] = useState("");
  const [fpAtual, setFpAtual] = useState("0.78");
  const [fpDesejado, setFpDesejado] = useState("0.92");

  // --- Iluminação ---
  const [areaIlum, setAreaIlum] = useState("");
  const [potLampada, setPotLampada] = useState("9");
  const [lumensLampada, setLumensLampada] = useState("");
  const [tipoLampada, setTipoLampada] = useState<TipoLampada>("led");
  const [ambiente, setAmbiente] = useState("geral");

  // --- Consumo ---
  const [potConsumo, setPotConsumo] = useState("");
  const [horasDia, setHorasDia] = useState("8");
  const [diasMes, setDiasMes] = useState("30");
  const [tarifa, setTarifa] = useState("0.95");

  // --- Conversor ---
  const [valorConverter, setValorConverter] = useState("");
  const [deUnidade, setDeUnidade] = useState<UnidadeEl>("kW");
  const [paraUnidade, setParaUnidade] = useState<UnidadeEl>("W");
  const [fpConversor, setFpConversor] = useState("1");
  const [tensaoConversor, setTensaoConversor] = useState("220");
  const [trifasicoConversor, setTrifasicoConversor] = useState(false);

  // === CÁLCULOS ===
  const pNum = parseNumber(potencia);
  const tNum = parseNumber(tensaoCorrente);
  const fpNum = parseNumber(fpCorrente);

  const resCorrente = calcularCorrente(pNum, tNum, fpNum, monofasicoCorrente);

  const cBitNum = parseNumber(correnteBitola);
  const nCircNum = parseNumber(nCircuitosBitola);
  const tempNum = parseNumber(tempAmbienteBitola);
  const nCond: NCond = (parseNumber(sistemaBitola) >= 380) ? 3 : 2;

  const resBitola = recomendarBitola(
    cBitNum, metodoBitola, nCond, nCircNum, tempNum, tipoCircuitoBitola
  );

  const cQuedaNum = parseNumber(correnteQueda);
  const compNum = parseNumber(comprimentoQueda);
  const bitolaNum = parseNumber(bitolaQueda);
  const tQuedaNum = parseNumber(sistemaQueda);
  const fpQuedaNum = parseNumber(fpQueda);

  const resQueda = calcularQuedaTensao(
    cQuedaNum, tQuedaNum, compNum, bitolaNum,
    monofasicoQueda, materialQueda, fpQuedaNum, origemEnergia
  );

  const cDisjNum = parseNumber(correnteDisjuntor);
  const ampDisjNum = parseNumber(ampacidadeDisjuntor);
  const resDisjuntor = recomendarDisjuntor(cDisjNum, ampDisjNum);

  const pFPNum = parseNumber(potenciaFP);
  const fpAtualNum = parseNumber(fpAtual);
  const fpDesejadoNum = parseNumber(fpDesejado);
  const resCapacitor = calcularCapacitor(pFPNum, fpAtualNum, fpDesejadoNum);

  const areaNum = parseNumber(areaIlum);
  const potLampNum = parseNumber(potLampada);
  const lumensNum = parseNumber(lumensLampada);
  const resIluminacao = calcularIluminacao(areaNum, potLampNum, lumensNum, tipoLampada, ambiente);

  const potConsNum = parseNumber(potConsumo);
  const horasNum = parseNumber(horasDia);
  const diasNum = parseNumber(diasMes);
  const tarifaNum = parseNumber(tarifa);
  const resConsumo = calcularConsumo(potConsNum, horasNum, diasNum, tarifaNum);

  const valConvNum = parseNumber(valorConverter);
  const fpConvNum = parseNumber(fpConversor);
  const tConvNum = parseNumber(tensaoConversor);
  const resConversao = converterPotencia(valConvNum, deUnidade, paraUnidade, fpConvNum, tConvNum, trifasicoConversor);

  function limparAba(alvo: Aba) {
    if (alvo === "corrente") { setPotencia(""); setTensaoCorrente("220"); setFpCorrente("0.92"); setMonofasicoCorrente(true); }
    else if (alvo === "bitola") { setCorrenteBitola(""); setMetodoBitola("B1"); setNCircuitosBitola("1"); setTempAmbienteBitola("30"); }
    else if (alvo === "queda") { setCorrenteQueda(""); setComprimentoQueda(""); setBitolaQueda(""); }
    else if (alvo === "fator") { setPotenciaFP(""); setFpAtual("0.78"); setFpDesejado("0.92"); }
    else if (alvo === "disjuntor") { setCorrenteDisjuntor(""); setAmpacidadeDisjuntor(""); }
    else if (alvo === "iluminacao") { setAreaIlum(""); setPotLampada("9"); setLumensLampada(""); }
    else if (alvo === "consumo") { setPotConsumo(""); setHorasDia("8"); setDiasMes("30"); setTarifa("0.95"); }
    else { setValorConverter(""); }
    mostrarToast("Calculadora limpa", "sucesso");
  }

  const abas: { id: Aba; nome: string; icone: typeof Zap }[] = [
    { id: "corrente", nome: "Corrente", icone: Zap },
    { id: "bitola", nome: "Bitola", icone: Cable },
    { id: "queda", nome: "Queda tensão", icone: Activity },
    { id: "fator", nome: "Fator de potência", icone: Gauge },
    { id: "disjuntor", nome: "Disjuntor", icone: CircuitBoard },
    { id: "iluminacao", nome: "Iluminação", icone: Lightbulb },
    { id: "consumo", nome: "Consumo", icone: Receipt },
    { id: "conversor", nome: "Conversor", icone: Ruler },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Calculadora Elétrica</h1>
          <p className="text-gray-500 mt-1">Cálculos técnicos conforme NBR 5410 / NBR ISO 8995-1</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-6 overflow-x-auto">
          <div className="flex border-b border-gray-200">
            {abas.map((a) => {
              const Icone = a.icone;
              const ativo = aba === a.id;
              return (
                <button key={a.id} type="button" onClick={() => setAba(a.id)}
                  className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                    ativo ? "border-[#FFD60A] text-[#0D1B2A] bg-yellow-50/30"
                          : "border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  }`}>
                  <Icone className="w-4 h-4" />
                  <span className="hidden sm:inline">{a.nome}</span>
                  <span className="sm:hidden">{a.nome.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inputs */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Dados do projeto</h2>
              <button type="button" onClick={() => limparAba(aba)}
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition">
                <RotateCcw className="w-4 h-4" /> Limpar
              </button>
            </div>

            {/* --- CORRENTE --- */}
            {aba === "corrente" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Potência (W)</label>
                  <input type="text" inputMode="decimal" value={potencia} onChange={e => setPotencia(e.target.value)}
                    placeholder="Ex: 4400" className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tensão (V)</label>
                    <select value={tensaoCorrente} onChange={e => setTensaoCorrente(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none bg-white">
                      <option value="127">127 V</option>
                      <option value="220">220 V</option>
                      <option value="380">380 V</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Fator de potência</label>
                    <input type="text" inputMode="decimal" value={fpCorrente} onChange={e => setFpCorrente(e.target.value)}
                      placeholder="0.92" className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <input type="checkbox" id="mono_corr" checked={monofasicoCorrente}
                    onChange={e => setMonofasicoCorrente(e.target.checked)}
                    className="w-4 h-4 text-[#FFD60A] bg-white border-gray-300 rounded focus:ring-[#FFD60A]" />
                  <label htmlFor="mono_corr" className="text-sm text-gray-700">
                    Monofásico {monofasicoCorrente ? "(desmarque para trifásico)" : ""}
                  </label>
                </div>
                {resCorrente.erro && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <XCircle className="w-4 h-4 shrink-0" />
                    {resCorrente.erro}
                  </div>
                )}
              </div>
            )}

            {/* --- BITOLA --- */}
            {aba === "bitola" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Corrente do circuito (A)</label>
                  <input type="text" inputMode="decimal" value={correnteBitola}
                    onChange={e => setCorrenteBitola(e.target.value)}
                    placeholder="Ex: 30" className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Método de instalação</label>
                    <select value={metodoBitola} onChange={e => setMetodoBitola(e.target.value as Metodo)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none bg-white">
                      <option value="A1">A1 — em eletroduto embutido</option>
                      <option value="A2">A2 — em parede térmica</option>
                      <option value="B1">B1 — em eletroduto aparente</option>
                      <option value="B2">B2 — em calha fechada</option>
                      <option value="C">C — diretamente</option>
                      <option value="E">E — ao ar livre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de circuito</label>
                    <select value={tipoCircuitoBitola} onChange={e => setTipoCircuitoBitola(e.target.value as TipoCircuito)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none bg-white">
                      <option value="forca">Força / Tomadas (mín. 2.5 mm²)</option>
                      <option value="iluminacao">Iluminação (mín. 1.5 mm²)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nº de circuitos no eletroduto</label>
                    <input type="text" inputMode="numeric" value={nCircuitosBitola}
                      onChange={e => setNCircuitosBitola(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Temperatura ambiente (°C)</label>
                    <input type="text" inputMode="decimal" value={tempAmbienteBitola}
                      onChange={e => setTempAmbienteBitola(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Sistema</label>
                  <select value={sistemaBitola} onChange={e => setSistemaBitola(e.target.value as "127" | "220" | "380")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none bg-white">
                    <option value="127">127 V (mono, 2 condutores)</option>
                    <option value="220">220 V (mono, 2 condutores)</option>
                    <option value="380">380 V (trifásico, 3 condutores)</option>
                  </select>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Usa <strong>Tabela 36/37 NBR 5410</strong> conforme método de instalação.
                    Bitola mínima: 1.5 mm² (iluminação) ou 2.5 mm² (força).
                    Inclui dimensionamento do <strong>condutor de proteção (terra)</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* --- QUEDA DE TENSÃO --- */}
            {aba === "queda" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Corrente (A)</label>
                    <input type="text" inputMode="decimal" value={correnteQueda}
                      onChange={e => setCorrenteQueda(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tensão (V)</label>
                    <select value={sistemaQueda} onChange={e => setSistemaQueda(e.target.value as "127" | "220" | "380")}
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none bg-white">
                      <option value="127">127 V</option>
                      <option value="220">220 V</option>
                      <option value="380">380 V</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Comprimento (m)</label>
                    <input type="text" inputMode="decimal" value={comprimentoQueda}
                      onChange={e => setComprimentoQueda(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Bitola (mm²)</label>
                    <select value={bitolaQueda} onChange={e => setBitolaQueda(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none bg-white">
                      <option value="">Selecione</option>
                      {BITOLAS_PADRAO.map(b => <option key={b} value={b}>{b} mm²</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Origem da energia</label>
                    <select value={origemEnergia} onChange={e => setOrigemEnergia(e.target.value as OrigemEnergia)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none bg-white">
                      <option value="concessionaria">Rede da concessionária (4%)</option>
                      <option value="transformador">Transformador próprio (7%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Fator de potência (FP)</label>
                    <input type="text" inputMode="decimal" value={fpQueda}
                      onChange={e => setFpQueda(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Material</label>
                    <select value={materialQueda} onChange={e => setMaterialQueda(e.target.value as Material)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none bg-white">
                      <option value="cobre">Cobre (ρ=0.021 Ω·mm²/m)</option>
                      <option value="aluminio">Alumínio (ρ=0.035 Ω·mm²/m)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input type="checkbox" id="mono_queda" checked={monofasicoQueda}
                      onChange={e => setMonofasicoQueda(e.target.checked)}
                      className="w-4 h-4 text-[#FFD60A] bg-white border-gray-300 rounded focus:ring-[#FFD60A]" />
                    <label htmlFor="mono_queda" className="text-sm text-gray-700">Monofásico</label>
                  </div>
                </div>
                {materialQueda === "aluminio" && bitolaNum > 0 && bitolaNum < 16 && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    NBR 5410 exige bitola mínima de <strong>16 mm²</strong> para alumínio. Bitola informada: {bitolaNum} mm².
                  </div>
                )}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Usa ρ a <strong>70°C</strong> (não 20°C) e inclui reatância (X=0.0001 Ω/m).
                    Limite conforme <strong>origem da energia</strong>: 4% (concessionária) ou 7% (transformador próprio).
                  </p>
                </div>
              </div>
            )}

            {/* --- DISJUNTOR --- */}
            {aba === "disjuntor" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Corrente de projeto Ib (A)</label>
                  <input type="text" inputMode="decimal" value={correnteDisjuntor}
                    onChange={e => setCorrenteDisjuntor(e.target.value)} placeholder="Ex: 25"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ampacidade do cabo Iz (A)</label>
                  <input type="text" inputMode="decimal" value={ampacidadeDisjuntor}
                    onChange={e => setAmpacidadeDisjuntor(e.target.value)} placeholder="Ex: 41 (cabo 6mm² método B1)"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Regra <strong>NBR 5410</strong>: Ib ≤ In ≤ Iz.<br />
                    Encontra o menor disjuntor comercial ≥ Ib e verifica se ≤ Iz (ampacidade corrigida).
                    Não usa multiplicador 1.25 (regra NEC, não NBR).
                  </p>
                </div>
                {resDisjuntor.erro && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <XCircle className="w-4 h-4 shrink-0" />
                    {resDisjuntor.erro}
                  </div>
                )}
              </div>
            )}

            {/* --- FATOR DE POTÊNCIA --- */}
            {aba === "fator" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Potência ativa (kW)</label>
                  <input type="text" inputMode="decimal" value={potenciaFP}
                    onChange={e => setPotenciaFP(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">FP atual</label>
                    <input type="text" inputMode="decimal" value={fpAtual}
                      onChange={e => setFpAtual(e.target.value)} placeholder="0.78"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">FP desejado</label>
                    <input type="text" inputMode="decimal" value={fpDesejado}
                      onChange={e => setFpDesejado(e.target.value)} placeholder="0.92"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                  </div>
                </div>
                {resCapacitor.erro && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <XCircle className="w-4 h-4 shrink-0" />
                    {resCapacitor.erro}
                  </div>
                )}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Qc = P × (tan φ1 - tan φ2). Limite mínimo da concessionária: FP ≥ 0.92.
                  </p>
                </div>
              </div>
            )}

            {/* --- ILUMINAÇÃO --- */}
            {aba === "iluminacao" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Área do ambiente (m²)</label>
                  <input type="text" inputMode="decimal" value={areaIlum}
                    onChange={e => setAreaIlum(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Potência da lâmpada (W)</label>
                    <input type="text" inputMode="decimal" value={potLampada}
                      onChange={e => setPotLampada(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Lumens (opcional)</label>
                    <input type="text" inputMode="decimal" value={lumensLampada}
                      onChange={e => setLumensLampada(e.target.value)} placeholder="Deixe vazio para estimar"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de lâmpada</label>
                    <select value={tipoLampada} onChange={e => setTipoLampada(e.target.value as TipoLampada)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none bg-white">
                      <option value="led">LED (80 lm/W)</option>
                      <option value="fluorescente">Fluorescente (60 lm/W)</option>
                      <option value="incandescente">Incandescente (12 lm/W)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Ambiente</label>
                    <select value={ambiente} onChange={e => setAmbiente(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none bg-white">
                      <option value="quarto">Quarto (150 lux)</option>
                      <option value="sala">Sala (200 lux)</option>
                      <option value="cozinha">Cozinha (300 lux)</option>
                      <option value="banheiro">Banheiro (200 lux)</option>
                      <option value="escritorio">Escritório (500 lux)</option>
                      <option value="garagem">Garagem (100 lux)</option>
                      <option value="geral">Geral (150 lux)</option>
                    </select>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Método dos lúmens (NBR ISO 8995-1):{" "}
                    <strong>Fluxo = (Lux × Área) / (Fu × Fm)</strong>.{" "}
                    Fu=0.6, Fm=0.8. Considera perdas por utilização e manutenção.
                  </p>
                </div>
              </div>
            )}

            {/* --- CONSUMO --- */}
            {aba === "consumo" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Potência (W)</label>
                  <input type="text" inputMode="decimal" value={potConsumo}
                    onChange={e => setPotConsumo(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Horas/dia</label>
                    <input type="text" inputMode="decimal" value={horasDia}
                      onChange={e => setHorasDia(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Dias/mês</label>
                    <input type="text" inputMode="decimal" value={diasMes}
                      onChange={e => setDiasMes(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tarifa (R$/kWh)</label>
                  <input type="text" inputMode="decimal" value={tarifa}
                    onChange={e => setTarifa(e.target.value)} placeholder="0.95"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                </div>
              </div>
            )}

            {/* --- CONVERSOR --- */}
            {aba === "conversor" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Valor</label>
                    <input type="text" inputMode="decimal" value={valorConverter}
                      onChange={e => setValorConverter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">De</label>
                    <select value={deUnidade} onChange={e => setDeUnidade(e.target.value as UnidadeEl)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none bg-white">
                      <option value="W">W</option><option value="kW">kW</option>
                      <option value="VA">VA</option><option value="kVA">kVA</option>
                      <option value="A">A</option><option value="mA">mA</option>
                      <option value="hp">hp</option><option value="cv">cv</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Para</label>
                    <select value={paraUnidade} onChange={e => setParaUnidade(e.target.value as UnidadeEl)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none bg-white">
                      <option value="W">W</option><option value="kW">kW</option>
                      <option value="VA">VA</option><option value="kVA">kVA</option>
                      <option value="A">A</option><option value="mA">mA</option>
                      <option value="hp">hp</option><option value="cv">cv</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">FP</label>
                    <input type="text" inputMode="decimal" value={fpConversor}
                      onChange={e => setFpConversor(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tensão (V)</label>
                    <input type="text" inputMode="numeric" value={tensaoConversor}
                      onChange={e => setTensaoConversor(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none" />
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <input type="checkbox" id="conv_tri" checked={trifasicoConversor}
                    onChange={e => setTrifasicoConversor(e.target.checked)}
                    className="w-4 h-4 text-[#FFD60A] bg-white border-gray-300 rounded focus:ring-[#FFD60A]" />
                  <label htmlFor="conv_tri" className="text-sm text-gray-700">Sistema trifásico (usa √3)</label>
                </div>
              </div>
            )}
          </div>

          {/* Resultados */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Resultado</h2>

            {/* Corrente */}
            {aba === "corrente" && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-[#FFD60A]/10 to-amber-50 rounded-xl p-5 border border-[#FFD60A]/20">
                  <p className="text-xs font-bold uppercase mb-1 text-gray-600">Corrente do circuito</p>
                  <p className="text-4xl font-bold text-[#0D1B2A]">
                    {resCorrente.valido ? resCorrente.corrente.toFixed(2) : "—"}
                    <span className="text-xl font-normal text-gray-600 ml-2">A</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    {monofasicoCorrente ? "Monofásico" : "Trifásico"} • {tensaoCorrente} V
                  </p>
                </div>
                {resCorrente.valido && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                    <p className="text-xs font-semibold text-gray-700 mb-1">Fórmula aplicada:</p>
                    <p className="text-xs text-gray-600 font-mono">
                      {monofasicoCorrente
                        ? "I = P / (V × FP)"
                        : "I = P / (√3 × V × FP)"}
                    </p>
                    <p className="text-xs text-gray-600 font-mono">
                      I = {pNum.toFixed(0)} / ({tNum} × {fpNum}) = {resCorrente.corrente.toFixed(2)} A
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Bitola */}
            {aba === "bitola" && (
              <div className="space-y-4">
                <div className={`rounded-xl p-5 border ${resBitola.compativel ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                  <p className="text-xs font-bold uppercase mb-1 text-gray-600">Bitola recomendada</p>
                  <p className={`text-4xl font-bold ${resBitola.compativel ? "text-emerald-700" : "text-red-700"}`}>
                    {resBitola.bitola > 0 ? resBitola.bitola : "—"}
                    <span className="text-xl font-normal text-gray-600 ml-2">mm²</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Ampacidade: <strong>{resBitola.ampacidade} A</strong> ({metodoBitola})
                    {resBitola.correnteAjustada > 0 && ` • Corrente corrigida: ${resBitola.correnteAjustada.toFixed(1)} A`}
                  </p>
                </div>

                {resBitola.bitola > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs font-bold uppercase mb-2 text-blue-700">Condutor de Proteção (Terra)</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {resBitola.terra}
                      <span className="text-base font-normal text-gray-600 ml-2">mm²</span>
                    </p>
                    <p className="text-xs text-blue-700 mt-1">Conforme Tabela 58 NBR 5410</p>
                  </div>
                )}

                {resBitola.erro ? (
                  <div className="flex items-center gap-2 text-red-700 text-sm">
                    <XCircle className="w-4 h-4" />
                    <span>{resBitola.erro}</span>
                  </div>
                ) : resBitola.compativel ? (
                  <div className="flex items-center gap-2 text-emerald-700 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Bitola compatível — usando método {metodoBitola}</span>
                  </div>
                ) : null}
              </div>
            )}

            {/* Queda de tensão */}
            {aba === "queda" && (
              <div className="space-y-4">
                <div className={`rounded-xl p-5 border ${resQueda.compativel ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                  <p className="text-xs font-bold uppercase mb-1 text-gray-600">Queda de tensão</p>
                  <p className={`text-4xl font-bold ${resQueda.compativel ? "text-emerald-700" : "text-red-700"}`}>
                    {resQueda.quedaPercentual.toFixed(3)}
                    <span className="text-xl font-normal text-gray-600 ml-1">%</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Limite NBR 5410: <strong>{resQueda.limitePercentual}%</strong> ({origemEnergia === "concessionaria" ? "derivação da concessionária" : "c/ transformador próprio"})
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                  <p className="flex justify-between">
                    <span className="text-gray-600">Queda em volts:</span>
                    <strong>{resQueda.quedaV.toFixed(3)} V</strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-600">Tensão no final:</span>
                    <strong>{resQueda.tensaoFinal.toFixed(2)} V</strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-600">Material:</span>
                    <strong>{materialQueda === "cobre" ? "Cobre (ρ=0.021)" : "Alumínio (ρ=0.035)"}</strong>
                  </p>
                </div>
                {resQueda.compativel ? (
                  <div className="flex items-center gap-2 text-emerald-700 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Dentro do limite de {resQueda.limitePercentual}%</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-700 text-sm">
                    <XCircle className="w-4 h-4" />
                    <span>Acima do limite — aumente a bitola ou reduza o comprimento</span>
                  </div>
                )}
              </div>
            )}

            {/* Disjuntor */}
            {aba === "disjuntor" && (
              <div className="space-y-4">
                <div className={`rounded-xl p-5 border ${resDisjuntor.compativel ? "bg-violet-50 border-violet-200" : "bg-red-50 border-red-200"}`}>
                  <p className="text-xs font-bold uppercase mb-1 text-gray-600">Disjuntor recomendado</p>
                  <p className={`text-4xl font-bold ${resDisjuntor.compativel ? "text-violet-700" : "text-red-700"}`}>
                    {resDisjuntor.disjuntor > 0 ? resDisjuntor.disjuntor : "—"}
                    <span className="text-xl font-normal text-gray-600 ml-2">A</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Regra: Ib ≤ In ≤ Iz ({cDisjNum.toFixed(1)} ≤ {resDisjuntor.disjuntor} ≤ {ampDisjNum})
                  </p>
                </div>
                {resDisjuntor.compativel ? (
                  <div className="flex items-center gap-2 text-emerald-700 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Disjuntor dentro do limite da ampacidade do cabo</span>
                  </div>
                ) : resDisjuntor.erro ? (
                  <div className="flex items-center gap-2 text-red-700 text-sm">
                    <XCircle className="w-4 h-4" />
                    <span>{resDisjuntor.erro}</span>
                  </div>
                ) : null}
              </div>
            )}

            {/* Fator de potência */}
            {aba === "fator" && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-5 border border-blue-200">
                  <p className="text-xs font-bold uppercase mb-1 text-gray-600">Potência do capacitor</p>
                  <p className="text-4xl font-bold text-blue-700">
                    {resCapacitor.valido ? resCapacitor.potenciaReativa.toFixed(3) : "—"}
                    <span className="text-xl font-normal text-gray-600 ml-2">kVAr</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-2">Banco de capacitores necessário</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                  <p className="flex justify-between">
                    <span className="text-gray-600">FP atual:</span>
                    <strong>{fpAtualNum.toFixed(3)}</strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-600">FP desejado:</span>
                    <strong>{fpDesejadoNum.toFixed(3)}</strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-600">Potência:</span>
                    <strong>{pFPNum.toFixed(3)} kW</strong>
                  </p>
                </div>
              </div>
            )}

            {/* Iluminação */}
            {aba === "iluminacao" && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-5 border border-amber-200">
                  <p className="text-xs font-bold uppercase mb-1 text-gray-600">Lâmpadas necessárias</p>
                  <p className="text-4xl font-bold text-amber-600">
                    {resIluminacao.valido ? resIluminacao.lampadasNecessarias : "—"}
                    <span className="text-xl font-normal text-gray-600 ml-2">un</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Potência total: <strong>{resIluminacao.potenciaTotal} W</strong>
                  </p>
                </div>
                {resIluminacao.valido && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                    <p className="flex justify-between">
                      <span className="text-gray-600">Fluxo total:</span>
                      <strong>{resIluminacao.fluxoTotal.toFixed(0)} lm</strong>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-gray-600">Luxes alvo ({ambiente}):</span>
                      <strong>{resIluminacao.luxesAlvo} lux</strong>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-gray-600">Fu × Fm:</span>
                      <strong>{FATOR_UTILIZACAO} × {FATOR_MANUTENCAO} = {(FATOR_UTILIZACAO * FATOR_MANUTENCAO).toFixed(2)}</strong>
                    </p>
                    {resIluminacao.aviso && (
                      <p className="text-xs text-amber-700 mt-1">{resIluminacao.aviso}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Consumo */}
            {aba === "consumo" && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-xl p-5 border border-rose-200">
                  <p className="text-xs font-bold uppercase mb-1 text-gray-600">Custo mensal estimado</p>
                  <p className="text-4xl font-bold text-rose-700">
                    {resConsumo.valido ? resConsumo.custoMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00"}
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Consumo: <strong>{resConsumo.consumoKWh.toFixed(1)} kWh/mês</strong>
                  </p>
                </div>
                {resConsumo.valido && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                    <p className="flex justify-between">
                      <span className="text-gray-600">kWh/dia:</span>
                      <strong>{resConsumo.consumoDiarioKWh.toFixed(2)}</strong>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-gray-600">Custo anual:</span>
                      <strong>{resConsumo.custoAnual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Conversor */}
            {aba === "conversor" && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-xl p-5 border border-indigo-200">
                  <p className="text-xs font-bold uppercase mb-1 text-gray-600">Resultado</p>
                  <p className="text-4xl font-bold text-indigo-700">
                    {resConversao.valido ? resConversao.resultado.toFixed(4) : "—"}
                    <span className="text-xl font-normal text-gray-600 ml-2">{paraUnidade}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    {valorConverter || "0"} {deUnidade} → {resConversao.resultado.toFixed(4)} {paraUnidade}
                  </p>
                </div>
                {resConversao.aviso && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {resConversao.aviso}
                  </div>
                )}
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Referências:</p>
                  <p className="text-xs text-gray-600">1 hp = 745.7 W | 1 cv = 735.5 W</p>
                  <p className="text-xs text-gray-600">1 kVA = 1 kW (FP=1)</p>
                  <p className="text-xs text-gray-600">1 A (220V mono) = 220 W</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Aviso legal */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <strong>Atenção:</strong> cálculos de <strong>estimativa</strong>.
            Para projetos definitivos, consulte a <strong>NBR 5410</strong> e <strong>NBR ISO 8995-1</strong> completas
            e um profissional habilitado.
          </p>
        </div>
      </div>
    </div>
  );
}
