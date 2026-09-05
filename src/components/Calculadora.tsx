import { useState, type ReactElement } from "react";
import {
  Zap,
  Cable,
  Gauge,
  Activity,
  Lightbulb,
  CircuitBoard,
  Receipt,
  Ruler,
  RotateCcw,
  Info,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useToast } from "./ui/toast";

// ============================================
// Cálculos elétricos
// ============================================

// 1) Corrente: I = P / V (P em W, V em V)
function calcularCorrente(
  potenciaW: number,
  tensaoV: number,
  fatorPotencia: number,
  monofasico: boolean
): { corrente: number; trifasico: boolean } {
  if (!potenciaW || !tensaoV) return { corrente: 0, trifasico: !monofasico };
  let corrente: number;
  if (monofasico) {
    corrente = potenciaW / (tensaoV * fatorPotencia);
  } else {
    corrente = potenciaW / (Math.sqrt(3) * tensaoV * fatorPotencia);
  }
  return { corrente, trifasico: !monofasico };
}

// Tabela de ampacidade (NBR 5410, cobre, isolação PVC 70°C, método B1)
// Seção dos condutores (mm²) -> corrente máxima (A)
const TABELA_AMPACIDADE_COBRE: Record<number, number> = {
  0.5: 9,
  0.75: 11,
  1: 15,
  1.5: 17.5,
  2.5: 24,
  4: 32,
  6: 41,
  10: 57,
  16: 76,
  25: 101,
  35: 125,
  50: 151,
  70: 192,
  95: 232,
  120: 269,
  150: 309,
  185: 353,
  240: 415,
};

// 2) Bitola recomendada: pega a primeira seção cuja ampacidade >= corrente
function recomendarBitola(correnteA: number): {
  bitola: number;
  ampacidade: number;
  compativel: boolean;
} {
  if (!correnteA) return { bitola: 0, ampacidade: 0, compativel: false };
  const bitolas = Object.keys(TABELA_AMPACIDADE_COBRE)
    .map(Number)
    .sort((a, b) => a - b);
  for (const bitola of bitolas) {
    const amp = TABELA_AMPACIDADE_COBRE[bitola];
    if (amp >= correnteA) {
      return { bitola, ampacidade: amp, compativel: true };
    }
  }
  // Maior que 240mm²
  return { bitola: 240, ampacidade: 415, compativel: false };
}

// 3) Queda de tensão: dV% = (2 * ρ * L * I) / (V * A) * 100  (monofásico)
// Para trifásico: dV% = (√3 * ρ * L * I) / (V * A) * 100
// ρ cobre = 0.0172 Ω·mm²/m
function calcularQuedaTensao(
  correnteA: number,
  tensaoV: number,
  comprimentoM: number,
  bitolaMm2: number,
  monofasico: boolean,
  sistema: "127" | "220" | "380"
): {
  quedaV: number;
  quedaPercentual: number;
  compativel: boolean;
  limitePercentual: number;
} {
  if (!correnteA || !tensaoV || !comprimentoM || !bitolaMm2)
    return {
      quedaV: 0,
      quedaPercentual: 0,
      compativel: false,
      limitePercentual: sistema === "380" ? 7 : 4,
    };
  const rho = 0.0172; // cobre
  let quedaV: number;
  if (monofasico) {
    quedaV = (2 * rho * comprimentoM * correnteA) / bitolaMm2;
  } else {
    quedaV = (Math.sqrt(3) * rho * comprimentoM * correnteA) / bitolaMm2;
  }
  const quedaPercentual = (quedaV / tensaoV) * 100;
  // Limites NBR 5410:
  // - Iluminação: 4%
  // - Outros usos (tomadas, força): 5% para 127V/220V, 7% para trifásico 380V
  const limitePercentual =
    sistema === "380" ? 7 : 4;
  return {
    quedaV,
    quedaPercentual,
    compativel: quedaPercentual <= limitePercentual,
    limitePercentual,
  };
}

// 4) Fator de potência: correção com capacitor
// Qc = P * (tan(acos(FP_atual)) - tan(acos(FP_desejado)))
function calcularCapacitor(
  potenciaKW: number,
  fpAtual: number,
  fpDesejado: number
): { potenciaReativa: number; fpAtual: number } {
  if (!potenciaKW || !fpAtual || !fpDesejado) {
    return { potenciaReativa: 0, fpAtual: fpAtual };
  }
  const anguloAtual = Math.acos(fpAtual);
  const anguloDesejado = Math.acos(fpDesejado);
  const potenciaReativa =
    potenciaKW * (Math.tan(anguloAtual) - Math.tan(anguloDesejado));
  return { potenciaReativa, fpAtual };
}

// 5) Disjuntor padrão NBR: escolhe o comercial acima da corrente
const DISJUNTORES_COMERCIAIS = [10, 15, 20, 25, 30, 35, 40, 50, 63, 70, 80, 100, 125];

function recomendarDisjuntor(correnteA: number): {
  disjuntor: number;
  compativel: boolean;
} {
  if (!correnteA) return { disjuntor: 0, compativel: false };
  // Regra prática: corrente <= 80% da capacidade do disjuntor
  const correnteComMargem = correnteA / 0.8;
  for (const amp of DISJUNTORES_COMERCIAIS) {
    if (amp >= correnteComMargem) {
      return { disjuntor: amp, compativel: true };
    }
  }
  return { disjuntor: 125, compativel: false };
}

// 6) Iluminação: NBR 5410 — mínimo 100 lux em áreas gerais, recomenda-se
// potência de 100-300 W por ambiente dependendo do tamanho
function calcularIluminacao(
  areaM2: number,
  potenciaLampada: number,
  lumens: number
): {
  lampadasNecessarias: number;
  potenciaTotal: number;
  fluxoTotal: number;
} {
  if (!areaM2 || !potenciaLampada) {
    return { lampadasNecessarias: 0, potenciaTotal: 0, fluxoTotal: 0 };
  }
  // 100 lux mínimo: lux = lumens / área
  // Se lumens informado, usa ele; senão assume estimativa padrão
  const lumensPorLampada = lumens || potenciaLampada * 80; // ~80 lm/W LED
  const luxesAlvo = 150; // recomendado
  const fluxoNecessario = luxesAlvo * areaM2;
  const lampadas = Math.ceil(fluxoNecessario / lumensPorLampada);
  return {
    lampadasNecessarias: lampadas,
    potenciaTotal: lampadas * potenciaLampada,
    fluxoTotal: lampadas * lumensPorLampada,
  };
}

// 7) Consumo de energia (kWh e R$)
function calcularConsumo(
  potenciaW: number,
  horasDia: number,
  diasMes: number,
  tarifaKWh: number
): {
  consumoKWh: number;
  custoMensal: number;
} {
  if (!potenciaW || !horasDia || !diasMes || !tarifaKWh) {
    return { consumoKWh: 0, custoMensal: 0 };
  }
  const kwhMes = (potenciaW * horasDia * diasMes) / 1000;
  const custo = kwhMes * tarifaKWh;
  return { consumoKWh: kwhMes, custoMensal: custo };
}

// 8) Conversão de unidades elétricas
type UnidadeOrigem =
  | "W"
  | "kW"
  | "VA"
  | "kVA"
  | "A"
  | "mA"
  | "hp"
  | "cv";

function converterPotencia(
  valor: number,
  de: UnidadeOrigem,
  para: UnidadeOrigem
): number {
  // Primeiro converte para W
  let watts = 0;
  switch (de) {
    case "W":
      watts = valor;
      break;
    case "kW":
      watts = valor * 1000;
      break;
    case "VA":
      watts = valor; // assumindo FP=1 para simplificação
      break;
    case "kVA":
      watts = valor * 1000;
      break;
    case "A":
      watts = valor * 220; // assumindo 220V
      break;
    case "mA":
      watts = (valor / 1000) * 220;
      break;
    case "hp":
      watts = valor * 745.7;
      break;
    case "cv":
      watts = valor * 735.5;
      break;
  }
  // Agora converte para unidade de destino
  switch (para) {
    case "W":
      return watts;
    case "kW":
      return watts / 1000;
    case "VA":
      return watts;
    case "kVA":
      return watts / 1000;
    case "A":
      return watts / 220;
    case "mA":
      return (watts / 220) * 1000;
    case "hp":
      return watts / 745.7;
    case "cv":
      return watts / 735.5;
  }
}

// ============================================
// Componente
// ============================================

type Aba =
  | "corrente"
  | "bitola"
  | "queda"
  | "fator"
  | "disjuntor"
  | "iluminacao"
  | "consumo"
  | "conversor";

export default function Calculadora(): ReactElement {
  const [aba, setAba] = useState<Aba>("corrente");
  const { mostrarToast } = useToast();

  // ============ Estado: Corrente ============
  const [potencia, setPotencia] = useState("");
  const [tensaoCorrente, setTensaoCorrente] = useState("220");
  const [fpCorrente, setFpCorrente] = useState("0.92");
  const [monofasicoCorrente, setMonofasicoCorrente] = useState(false);

  // ============ Estado: Bitola ============
  const [correnteBitola, setCorrenteBitola] = useState("");
  const [sistemaBitola, setSistemaBitola] = useState<"127" | "220" | "380">(
    "220"
  );
  const [metodoInstalacao, setMetodoInstalacao] = useState("B1");

  // ============ Estado: Queda de tensão ============
  const [correnteQueda, setCorrenteQueda] = useState("");
  const [comprimento, setComprimento] = useState("");
  const [bitolaQueda, setBitolaQueda] = useState("");
  const [sistemaQueda, setSistemaQueda] = useState<"127" | "220" | "380">(
    "220"
  );
  const [monofasicoQueda, setMonofasicoQueda] = useState(true);

  // ============ Estado: Fator de potência ============
  const [potenciaFP, setPotenciaFP] = useState("");
  const [fpAtual, setFpAtual] = useState("0.78");
  const [fpDesejado, setFpDesejado] = useState("0.92");

  // ============ Estado: Disjuntor ============
  const [correnteDisjuntor, setCorrenteDisjuntor] = useState("");

  // ============ Estado: Iluminação ============
  const [areaIlum, setAreaIlum] = useState("");
  const [potLampada, setPotLampada] = useState("9"); // LED comum
  const [lumensLampada, setLumensLampada] = useState("800"); // LED comum

  // ============ Estado: Consumo ============
  const [potConsumo, setPotConsumo] = useState("");
  const [horasDia, setHorasDia] = useState("8");
  const [diasMes, setDiasMes] = useState("30");
  const [tarifa, setTarifa] = useState("0.95"); // tarifa média residencial Brasil 2024

  // ============ Estado: Conversor ============
  const [valorConverter, setValorConverter] = useState("");
  const [deUnidade, setDeUnidade] = useState<UnidadeOrigem>("kW");
  const [paraUnidade, setParaUnidade] = useState<UnidadeOrigem>("W");

  // ============ Cálculos ============
  const potenciaNumerica = Number(potencia.replace(",", "."));
  const tensaoNumerica = Number(tensaoCorrente);
  const fpNumerico = Number(fpCorrente.replace(",", "."));

  const resultadoCorrente = calcularCorrente(
    potenciaNumerica,
    tensaoNumerica,
    fpNumerico,
    monofasicoCorrente
  );

  const resultadoBitola = recomendarBitola(
    Number(correnteBitola.replace(",", "."))
  );

  const tensaoQuedaNumerica = Number(sistemaQueda);
  const resultadoQueda = calcularQuedaTensao(
    Number(correnteQueda.replace(",", ".")),
    tensaoQuedaNumerica,
    Number(comprimento.replace(",", ".")),
    Number(bitolaQueda.replace(",", ".")),
    monofasicoQueda,
    sistemaQueda
  );

  const resultadoFP = calcularCapacitor(
    Number(potenciaFP.replace(",", ".")),
    Number(fpAtual.replace(",", ".")),
    Number(fpDesejado.replace(",", "."))
  );

  const resultadoDisjuntor = recomendarDisjuntor(
    Number(correnteDisjuntor.replace(",", "."))
  );

  const resultadoIluminacao = calcularIluminacao(
    Number(areaIlum.replace(",", ".")),
    Number(potLampada.replace(",", ".")),
    Number(lumensLampada.replace(",", "."))
  );

  const resultadoConsumo = calcularConsumo(
    Number(potConsumo.replace(",", ".")),
    Number(horasDia.replace(",", ".")),
    Number(diasMes.replace(",", ".")),
    Number(tarifa.replace(",", "."))
  );

  const valorConversao = Number(valorConverter.replace(",", "."));
  const resultadoConversao =
    valorConversao && !isNaN(valorConversao)
      ? converterPotencia(valorConversao, deUnidade, paraUnidade)
      : 0;

  function limparAba(alvo: Aba) {
    if (alvo === "corrente") {
      setPotencia("");
      setTensaoCorrente("220");
      setFpCorrente("0.92");
      setMonofasicoCorrente(false);
    } else if (alvo === "bitola") {
      setCorrenteBitola("");
      setSistemaBitola("220");
      setMetodoInstalacao("B1");
    } else if (alvo === "queda") {
      setCorrenteQueda("");
      setComprimento("");
      setBitolaQueda("");
      setSistemaQueda("220");
      setMonofasicoQueda(true);
    } else if (alvo === "fator") {
      setPotenciaFP("");
      setFpAtual("0.78");
      setFpDesejado("0.92");
    } else if (alvo === "disjuntor") {
      setCorrenteDisjuntor("");
    } else if (alvo === "iluminacao") {
      setAreaIlum("");
      setPotLampada("9");
      setLumensLampada("800");
    } else if (alvo === "consumo") {
      setPotConsumo("");
      setHorasDia("8");
      setDiasMes("30");
      setTarifa("0.95");
    } else {
      setValorConverter("");
    }
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Calculadora Elétrica
            </h1>
            <p className="text-gray-500 mt-1">
              Cálculos técnicos baseados na NBR 5410
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-6 overflow-x-auto">
          <div className="flex border-b border-gray-200">
            {abas.map((a) => {
              const Icone = a.icone;
              const ativo = aba === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAba(a.id)}
                  className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                    ativo
                      ? "border-[#FFD60A] text-[#0D1B2A] bg-yellow-50/30"
                      : "border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Icone className="w-4 h-4" />
                  <span className="hidden sm:inline">{a.nome}</span>
                  <span className="sm:hidden">
                    {a.nome.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna de inputs */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                Dados do projeto
              </h2>
              <button
                type="button"
                onClick={() => limparAba(aba)}
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition"
              >
                <RotateCcw className="w-4 h-4" />
                Limpar
              </button>
            </div>

            {aba === "corrente" && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="calc_potencia"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Potência (W)
                  </label>
                  <input
                    id="calc_potencia"
                    type="text"
                    inputMode="decimal"
                    value={potencia}
                    onChange={(e) => setPotencia(e.target.value)}
                    placeholder="Ex: 4400"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="calc_tensao"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Tensão (V)
                    </label>
                    <select
                      id="calc_tensao"
                      value={tensaoCorrente}
                      onChange={(e) => setTensaoCorrente(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] bg-white"
                    >
                      <option value="127">127 V</option>
                      <option value="220">220 V</option>
                      <option value="380">380 V</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="calc_fp"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Fator de potência
                    </label>
                    <input
                      id="calc_fp"
                      type="text"
                      inputMode="decimal"
                      value={fpCorrente}
                      onChange={(e) => setFpCorrente(e.target.value)}
                      placeholder="0.92"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    id="calc_mono"
                    type="checkbox"
                    checked={monofasicoCorrente}
                    onChange={(e) =>
                      setMonofasicoCorrente(e.target.checked)
                    }
                    className="w-4 h-4 text-[#FFD60A] bg-white border-gray-300 rounded focus:ring-[#FFD60A]"
                  />
                  <label
                    htmlFor="calc_mono"
                    className="text-sm text-gray-700"
                  >
                    Circuito monofásico (desmarque para trifásico)
                  </label>
                </div>
              </div>
            )}

            {aba === "bitola" && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="calc_corrente_bitola"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Corrente do circuito (A)
                  </label>
                  <input
                    id="calc_corrente_bitola"
                    type="text"
                    inputMode="decimal"
                    value={correnteBitola}
                    onChange={(e) => setCorrenteBitola(e.target.value)}
                    placeholder="Ex: 30"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="calc_sistema_bitola"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Sistema
                    </label>
                    <select
                      id="calc_sistema_bitola"
                      value={sistemaBitola}
                      onChange={(e) =>
                        setSistemaBitola(
                          e.target.value as "127" | "220" | "380"
                        )
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] bg-white"
                    >
                      <option value="127">127 V (mono)</option>
                      <option value="220">220 V (mono)</option>
                      <option value="380">380 V (tri)</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="calc_metodo"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Método de instalação
                    </label>
                    <select
                      id="calc_metodo"
                      value={metodoInstalacao}
                      onChange={(e) => setMetodoInstalacao(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] bg-white"
                    >
                      <option value="A1">A1 — em eletroduto embutido</option>
                      <option value="A2">A2 — em parede térmica</option>
                      <option value="B1">B1 — em eletroduto aparente</option>
                      <option value="B2">B2 — em calha fechada</option>
                      <option value="C">C — diretamente embutido</option>
                      <option value="E">E — ao ar livre</option>
                    </select>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Tabela baseada em <strong>cobre</strong>, isolação PVC
                    70°C, método de referência B1. Para outros métodos
                    consulte a NBR 5410 completa.
                  </p>
                </div>
              </div>
            )}

            {aba === "queda" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="calc_corrente_queda"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Corrente (A)
                    </label>
                    <input
                      id="calc_corrente_queda"
                      type="text"
                      inputMode="decimal"
                      value={correnteQueda}
                      onChange={(e) => setCorrenteQueda(e.target.value)}
                      placeholder="Ex: 30"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="calc_sistema_queda"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Sistema
                    </label>
                    <select
                      id="calc_sistema_queda"
                      value={sistemaQueda}
                      onChange={(e) =>
                        setSistemaQueda(
                          e.target.value as "127" | "220" | "380"
                        )
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] bg-white"
                    >
                      <option value="127">127 V</option>
                      <option value="220">220 V</option>
                      <option value="380">380 V (tri)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="calc_comprimento"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Comprimento do circuito (m)
                    </label>
                    <input
                      id="calc_comprimento"
                      type="text"
                      inputMode="decimal"
                      value={comprimento}
                      onChange={(e) => setComprimento(e.target.value)}
                      placeholder="Ex: 25"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="calc_bitola_queda"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Bitola (mm²)
                    </label>
                    <select
                      id="calc_bitola_queda"
                      value={bitolaQueda}
                      onChange={(e) => setBitolaQueda(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] bg-white"
                    >
                      <option value="">Selecione</option>
                      {[1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120].map(
                        (b) => (
                          <option key={b} value={b}>
                            {b} mm²
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    id="calc_mono_queda"
                    type="checkbox"
                    checked={monofasicoQueda}
                    onChange={(e) =>
                      setMonofasicoQueda(e.target.checked)
                    }
                    className="w-4 h-4 text-[#FFD60A] bg-white border-gray-300 rounded focus:ring-[#FFD60A]"
                  />
                  <label
                    htmlFor="calc_mono_queda"
                    className="text-sm text-gray-700"
                  >
                    Circuito monofásico (desmarque para trifásico)
                  </label>
                </div>
              </div>
            )}

            {aba === "disjuntor" && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="calc_corrente_disj"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Corrente do circuito (A)
                  </label>
                  <input
                    id="calc_corrente_disj"
                    type="text"
                    inputMode="decimal"
                    value={correnteDisjuntor}
                    onChange={(e) =>
                      setCorrenteDisjuntor(e.target.value)
                    }
                    placeholder="Ex: 22"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use a corrente calculada em "Corrente do circuito"
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Regra prática: corrente ≤ <strong>80%</strong> da
                    capacidade do disjuntor para evitar disparo em regime
                    permanente.
                  </p>
                </div>
              </div>
            )}

            {aba === "iluminacao" && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="calc_area"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Área do ambiente (m²)
                  </label>
                  <input
                    id="calc_area"
                    type="text"
                    inputMode="decimal"
                    value={areaIlum}
                    onChange={(e) => setAreaIlum(e.target.value)}
                    placeholder="Ex: 20"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="calc_pot_lamp"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Potência da lâmpada (W)
                    </label>
                    <input
                      id="calc_pot_lamp"
                      type="text"
                      inputMode="decimal"
                      value={potLampada}
                      onChange={(e) => setPotLampada(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="calc_lumens"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Lumens (opcional)
                    </label>
                    <input
                      id="calc_lumens"
                      type="text"
                      inputMode="decimal"
                      value={lumensLampada}
                      onChange={(e) =>
                        setLumensLampada(e.target.value)
                      }
                      placeholder="Ex: 800"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Cálculo baseado em <strong>150 lux</strong> (NBR 5413,
                    ambientes gerais). Cozinhas e banheiros exigem mais.
                  </p>
                </div>
              </div>
            )}

            {aba === "consumo" && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="calc_pot_consumo"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Potência do equipamento (W)
                  </label>
                  <input
                    id="calc_pot_consumo"
                    type="text"
                    inputMode="decimal"
                    value={potConsumo}
                    onChange={(e) => setPotConsumo(e.target.value)}
                    placeholder="Ex: 1500 (chuveiro)"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="calc_horas"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Horas por dia
                    </label>
                    <input
                      id="calc_horas"
                      type="text"
                      inputMode="decimal"
                      value={horasDia}
                      onChange={(e) => setHorasDia(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="calc_dias"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Dias no mês
                    </label>
                    <input
                      id="calc_dias"
                      type="text"
                      inputMode="decimal"
                      value={diasMes}
                      onChange={(e) => setDiasMes(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="calc_tarifa"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Tarifa (R$/kWh)
                  </label>
                  <input
                    id="calc_tarifa"
                    type="text"
                    inputMode="decimal"
                    value={tarifa}
                    onChange={(e) => setTarifa(e.target.value)}
                    placeholder="0.95"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Tarifa média residencial Brasil 2024: R$ 0,95/kWh
                  </p>
                </div>
              </div>
            )}

            {aba === "conversor" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="col-span-2">
                    <label
                      htmlFor="calc_conv_valor"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Valor
                    </label>
                    <input
                      id="calc_conv_valor"
                      type="text"
                      inputMode="decimal"
                      value={valorConverter}
                      onChange={(e) =>
                        setValorConverter(e.target.value)
                      }
                      placeholder="Ex: 5"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="calc_de"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      De
                    </label>
                    <select
                      id="calc_de"
                      value={deUnidade}
                      onChange={(e) =>
                        setDeUnidade(e.target.value as UnidadeOrigem)
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] bg-white"
                    >
                      <option value="W">W</option>
                      <option value="kW">kW</option>
                      <option value="VA">VA</option>
                      <option value="kVA">kVA</option>
                      <option value="A">A (220V)</option>
                      <option value="mA">mA (220V)</option>
                      <option value="hp">hp</option>
                      <option value="cv">cv</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="calc_para"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Converter para
                  </label>
                  <select
                    id="calc_para"
                    value={paraUnidade}
                    onChange={(e) =>
                      setParaUnidade(e.target.value as UnidadeOrigem)
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] bg-white"
                  >
                    <option value="W">W</option>
                    <option value="kW">kW</option>
                    <option value="VA">VA</option>
                    <option value="kVA">kVA</option>
                    <option value="A">A (220V)</option>
                    <option value="mA">mA (220V)</option>
                    <option value="hp">hp</option>
                    <option value="cv">cv</option>
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Conversões de A↔W assumem 220V. Conversões de VA
                    assumem fator de potência = 1.
                  </p>
                </div>
              </div>
            )}

            {aba === "fator" && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="calc_pot_fp"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Potência ativa (kW)
                  </label>
                  <input
                    id="calc_pot_fp"
                    type="text"
                    inputMode="decimal"
                    value={potenciaFP}
                    onChange={(e) => setPotenciaFP(e.target.value)}
                    placeholder="Ex: 10"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="calc_fp_atual"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      FP atual
                    </label>
                    <input
                      id="calc_fp_atual"
                      type="text"
                      inputMode="decimal"
                      value={fpAtual}
                      onChange={(e) => setFpAtual(e.target.value)}
                      placeholder="0.78"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="calc_fp_desejado"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      FP desejado
                    </label>
                    <input
                      id="calc_fp_desejado"
                      type="text"
                      inputMode="decimal"
                      value={fpDesejado}
                      onChange={(e) => setFpDesejado(e.target.value)}
                      placeholder="0.92"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    A concessionária exige FP ≥ 0.92 para não cobrar
                    multa reativa. Use 0.92 como alvo.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Coluna de resultado */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">
              Resultado
            </h2>

            {aba === "corrente" && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-[#FFD60A]/10 to-amber-50 rounded-xl p-5 border border-[#FFD60A]/20">
                  <p className="text-xs font-bold text-[#0D1B2A] uppercase tracking-wider mb-1">
                    Corrente do circuito
                  </p>
                  <p className="text-4xl font-bold text-[#0D1B2A]">
                    {resultadoCorrente.corrente.toFixed(2)}
                    <span className="text-xl font-normal text-gray-600 ml-2">
                      A
                    </span>
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    {monofasicoCorrente ? "Monofásico" : "Trifásico"} •{" "}
                    {tensaoCorrente} V
                  </p>
                </div>

                <p className="text-xs text-gray-500">
                  Fórmula:{" "}
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[#0D1B2A] font-mono">
                    I = P / V
                  </code>
                </p>
              </div>
            )}

            {aba === "bitola" && (
              <div className="space-y-4">
                <div
                  className={`rounded-xl p-5 border ${
                    resultadoBitola.compativel
                      ? "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200"
                      : "bg-gradient-to-br from-red-50 to-red-100/50 border-red-200"
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-700">
                    Bitola recomendada
                  </p>
                  <p
                    className={`text-4xl font-bold ${
                      resultadoBitola.compativel
                        ? "text-emerald-700"
                        : "text-red-700"
                    }`}
                  >
                    {resultadoBitola.bitola > 0
                      ? resultadoBitola.bitola
                      : "—"}
                    <span className="text-xl font-normal text-gray-600 ml-2">
                      mm²
                    </span>
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Suporta até{" "}
                    <strong>
                      {resultadoBitola.ampacidade} A
                    </strong>{" "}
                    (cobre, PVC 70°C)
                  </p>
                </div>

                {resultadoBitola.compativel ? (
                  <div className="flex items-center gap-2 text-emerald-700 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Bitola compatível com a corrente</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-700 text-sm">
                    <XCircle className="w-4 h-4" />
                    <span>
                      Corrente acima do máximo — consulte um eletricista
                      profissional
                    </span>
                  </div>
                )}
              </div>
            )}

            {aba === "queda" && (
              <div className="space-y-4">
                <div
                  className={`rounded-xl p-5 border ${
                    resultadoQueda.compativel
                      ? "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200"
                      : "bg-gradient-to-br from-red-50 to-red-100/50 border-red-200"
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-700">
                    Queda de tensão
                  </p>
                  <p
                    className={`text-4xl font-bold ${
                      resultadoQueda.compativel
                        ? "text-emerald-700"
                        : "text-red-700"
                    }`}
                  >
                    {resultadoQueda.quedaPercentual.toFixed(2)}
                    <span className="text-xl font-normal text-gray-600 ml-1">
                      %
                    </span>
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Limite NBR 5410:{" "}
                    <strong>
                      {resultadoQueda.limitePercentual}%
                    </strong>
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                  <p className="flex justify-between">
                    <span className="text-gray-600">Queda em volts:</span>
                    <strong className="text-gray-900">
                      {resultadoQueda.quedaV.toFixed(2)} V
                    </strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-600">Tensão no final:</span>
                    <strong className="text-gray-900">
                      {(
                        tensaoQuedaNumerica - resultadoQueda.quedaV
                      ).toFixed(2)}{" "}
                      V
                    </strong>
                  </p>
                </div>

                {resultadoQueda.compativel ? (
                  <div className="flex items-center gap-2 text-emerald-700 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Dentro do limite permitido</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-700 text-sm">
                    <XCircle className="w-4 h-4" />
                    <span>
                      Acima do limite — aumente a bitola ou reduza o
                      comprimento
                    </span>
                  </div>
                )}
              </div>
            )}

            {aba === "disjuntor" && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="calc_corrente_disj"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Corrente do circuito (A)
                  </label>
                  <input
                    id="calc_corrente_disj"
                    type="text"
                    inputMode="decimal"
                    value={correnteDisjuntor}
                    onChange={(e) =>
                      setCorrenteDisjuntor(e.target.value)
                    }
                    placeholder="Ex: 22"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use a corrente calculada em "Corrente do circuito"
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Regra prática: corrente ≤ <strong>80%</strong> da
                    capacidade do disjuntor para evitar disparo em regime
                    permanente.
                  </p>
                </div>
              </div>
            )}

            {aba === "iluminacao" && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="calc_area"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Área do ambiente (m²)
                  </label>
                  <input
                    id="calc_area"
                    type="text"
                    inputMode="decimal"
                    value={areaIlum}
                    onChange={(e) => setAreaIlum(e.target.value)}
                    placeholder="Ex: 20"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="calc_pot_lamp"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Potência da lâmpada (W)
                    </label>
                    <input
                      id="calc_pot_lamp"
                      type="text"
                      inputMode="decimal"
                      value={potLampada}
                      onChange={(e) => setPotLampada(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="calc_lumens"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Lumens (opcional)
                    </label>
                    <input
                      id="calc_lumens"
                      type="text"
                      inputMode="decimal"
                      value={lumensLampada}
                      onChange={(e) =>
                        setLumensLampada(e.target.value)
                      }
                      placeholder="Ex: 800"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Cálculo baseado em <strong>150 lux</strong> (NBR 5413,
                    ambientes gerais). Cozinhas e banheiros exigem mais.
                  </p>
                </div>
              </div>
            )}

            {aba === "consumo" && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="calc_pot_consumo"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Potência do equipamento (W)
                  </label>
                  <input
                    id="calc_pot_consumo"
                    type="text"
                    inputMode="decimal"
                    value={potConsumo}
                    onChange={(e) => setPotConsumo(e.target.value)}
                    placeholder="Ex: 1500 (chuveiro)"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="calc_horas"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Horas por dia
                    </label>
                    <input
                      id="calc_horas"
                      type="text"
                      inputMode="decimal"
                      value={horasDia}
                      onChange={(e) => setHorasDia(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="calc_dias"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Dias no mês
                    </label>
                    <input
                      id="calc_dias"
                      type="text"
                      inputMode="decimal"
                      value={diasMes}
                      onChange={(e) => setDiasMes(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="calc_tarifa"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Tarifa (R$/kWh)
                  </label>
                  <input
                    id="calc_tarifa"
                    type="text"
                    inputMode="decimal"
                    value={tarifa}
                    onChange={(e) => setTarifa(e.target.value)}
                    placeholder="0.95"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Tarifa média residencial Brasil 2024: R$ 0,95/kWh
                  </p>
                </div>
              </div>
            )}

            {aba === "conversor" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="col-span-2">
                    <label
                      htmlFor="calc_conv_valor"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Valor
                    </label>
                    <input
                      id="calc_conv_valor"
                      type="text"
                      inputMode="decimal"
                      value={valorConverter}
                      onChange={(e) =>
                        setValorConverter(e.target.value)
                      }
                      placeholder="Ex: 5"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="calc_de"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      De
                    </label>
                    <select
                      id="calc_de"
                      value={deUnidade}
                      onChange={(e) =>
                        setDeUnidade(e.target.value as UnidadeOrigem)
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] bg-white"
                    >
                      <option value="W">W</option>
                      <option value="kW">kW</option>
                      <option value="VA">VA</option>
                      <option value="kVA">kVA</option>
                      <option value="A">A (220V)</option>
                      <option value="mA">mA (220V)</option>
                      <option value="hp">hp</option>
                      <option value="cv">cv</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="calc_para"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Converter para
                  </label>
                  <select
                    id="calc_para"
                    value={paraUnidade}
                    onChange={(e) =>
                      setParaUnidade(e.target.value as UnidadeOrigem)
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] bg-white"
                  >
                    <option value="W">W</option>
                    <option value="kW">kW</option>
                    <option value="VA">VA</option>
                    <option value="kVA">kVA</option>
                    <option value="A">A (220V)</option>
                    <option value="mA">mA (220V)</option>
                    <option value="hp">hp</option>
                    <option value="cv">cv</option>
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Conversões de A↔W assumem 220V. Conversões de VA
                    assumem fator de potência = 1.
                  </p>
                </div>
              </div>
            )}

            {aba === "disjuntor" && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-xl p-5 border border-violet-200">
                  <p className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-700">
                    Disjuntor recomendado
                  </p>
                  <p className="text-4xl font-bold text-violet-700">
                    {resultadoDisjuntor.disjuntor > 0
                      ? resultadoDisjuntor.disjuntor
                      : "—"}
                    <span className="text-xl font-normal text-gray-600 ml-2">
                      A
                    </span>
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Padrão{" "}
                    {resultadoDisjuntor.disjuntor === 10
                      ? "monofásico"
                      : resultadoDisjuntor.disjuntor <= 40
                      ? "monofásico ou bifásico"
                      : "trifásico"}
                  </p>
                </div>

                {resultadoDisjuntor.compativel ? (
                  <div className="flex items-center gap-2 text-emerald-700 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Disjuntor dentro do limite da corrente</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-700 text-sm">
                    <XCircle className="w-4 h-4" />
                    <span>Corrente muito alta — circuito trifásico obrigatório</span>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                  <p className="text-xs font-semibold text-gray-700">
                    Valores comerciais comuns:
                  </p>
                  <p className="text-xs text-gray-600">
                    10 · 15 · 20 · 25 · 30 · 40 · 50 · 63 · 70 · 100 A
                  </p>
                </div>
              </div>
            )}

            {aba === "iluminacao" && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-5 border border-amber-200">
                  <p className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-700">
                    Lâmpadas necessárias
                  </p>
                  <p className="text-4xl font-bold text-amber-600">
                    {resultadoIluminacao.lampadasNecessarias}
                    <span className="text-xl font-normal text-gray-600 ml-2">
                      un
                    </span>
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Potência total:{" "}
                    <strong>
                      {resultadoIluminacao.potenciaTotal} W
                    </strong>
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                  <p className="flex justify-between">
                    <span className="text-gray-600">Fluxo luminoso total:</span>
                    <strong className="text-gray-900">
                      {resultadoIluminacao.fluxoTotal.toLocaleString(
                        "pt-BR"
                      )}{" "}
                      lm
                    </strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-600">Lúmens por m²:</span>
                    <strong className="text-gray-900">
                      {Number(areaIlum.replace(",", ".")) > 0
                        ? Math.round(
                            resultadoIluminacao.fluxoTotal /
                              Number(areaIlum.replace(",", "."))
                          )
                        : 0}
                    </strong>
                  </p>
                </div>
              </div>
            )}

            {aba === "consumo" && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-xl p-5 border border-rose-200">
                  <p className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-700">
                    Custo mensal estimado
                  </p>
                  <p className="text-4xl font-bold text-rose-700">
                    {resultadoConsumo.custoMensal.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Consumo:{" "}
                    <strong>
                      {resultadoConsumo.consumoKWh.toFixed(1)} kWh/mês
                    </strong>
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                  <p className="flex justify-between">
                    <span className="text-gray-600">kWh/dia:</span>
                    <strong className="text-gray-900">
                      {(
                        resultadoConsumo.consumoKWh /
                        Number(diasMes.replace(",", "."))
                      ).toFixed(2)}
                    </strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-600">Custo anual:</span>
                    <strong className="text-gray-900">
                      {(resultadoConsumo.custoMensal * 12).toLocaleString(
                        "pt-BR",
                        {
                          style: "currency",
                          currency: "BRL",
                        }
                      )}
                    </strong>
                  </p>
                </div>
              </div>
            )}

            {aba === "conversor" && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-xl p-5 border border-indigo-200">
                  <p className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-700">
                    Resultado da conversão
                  </p>
                  <p className="text-4xl font-bold text-indigo-700">
                    {resultadoConversao.toFixed(4)}
                    <span className="text-xl font-normal text-gray-600 ml-2">
                      {paraUnidade}
                    </span>
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    {valorConverter || "0"} {deUnidade} ={" "}
                    {resultadoConversao.toFixed(4)} {paraUnidade}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    Conversões populares:
                  </p>
                  <p className="text-xs text-gray-600">
                    • 1 hp = 745,7 W = 0,7457 kW
                  </p>
                  <p className="text-xs text-gray-600">
                    • 1 cv = 735,5 W = 0,7355 kW
                  </p>
                  <p className="text-xs text-gray-600">
                    • 1 kVA = 1 kW (FP = 1)
                  </p>
                </div>
              </div>
            )}

            {aba === "fator" && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-5 border border-blue-200">
                  <p className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-700">
                    Potência do capacitor
                  </p>
                  <p className="text-4xl font-bold text-blue-700">
                    {resultadoFP.potenciaReativa.toFixed(3)}
                    <span className="text-xl font-normal text-gray-600 ml-2">
                      kVAr
                    </span>
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Banco de capacitores necessário
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                  <p className="flex justify-between">
                    <span className="text-gray-600">FP atual:</span>
                    <strong className="text-gray-900">
                      {Number(fpAtual.replace(",", ".")).toFixed(2)}
                    </strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-600">FP desejado:</span>
                    <strong className="text-gray-900">
                      {Number(fpDesejado.replace(",", ".")).toFixed(2)}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 text-blue-700 text-sm">
                  <Info className="w-4 h-4" />
                  <span>
                    Escolha capacitor com potência padrão comercial
                    próxima desse valor
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Aviso legal */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <strong>Atenção:</strong> estes cálculos são ferramentas de{" "}
            <strong>estimativa</strong>. Para projetos definitivos, consulte a{" "}
            <strong>NBR 5410</strong> completa e um profissional habilitado.
            O cálculo de queda de tensão usa resistividade do cobre a 20°C.
          </p>
        </div>
      </div>
    </div>
  );
}
