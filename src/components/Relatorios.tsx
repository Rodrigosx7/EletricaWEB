import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  BarChart3,
  Calendar,
  TrendingUp,
  Users,
  Wrench,
  Package,
  DollarSign,
  FileText,
  Award,
} from "lucide-react";
import { supabase } from "../supabase";

type Periodo = "mes_atual" | "ultimos_3" | "ultimos_6" | "ultimos_12" | "personalizado";

type OrdemServico = {
  id: number;
  numero: number;
  cliente_id: number;
  data_abertura: string;
  status: string;
  valor_total: number;
};

type Orcamento = {
  id: number;
  numero: number;
  cliente_id: number;
  data_orcamento: string;
  status: string;
  valor_total: number;
};

type Cliente = {
  id: number;
  nome: string;
};

type OrcamentoItem = {
  orcamento_id: number;
  tipo: string;
  servico_id: number | null;
  produto_id: number | null;
  descricao: string;
  valor_unitario: number;
  subtotal: number;
};

type Dados = {
  ordens: OrdemServico[];
  orcamentos: Orcamento[];
  clientes: Cliente[];
  itens: OrcamentoItem[];
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function inicioMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function dataAtual(): string {
  return new Date().toISOString().split("T")[0];
}

function corStatus(status: string): string {
  if (status === "Aprovado" || status === "Concluída") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "Pendente" || status === "Aberta" || status === "Em andamento") {
    return "bg-yellow-100 text-yellow-700";
  }
  if (status === "Recusado" || status === "Cancelada") {
    return "bg-red-100 text-red-700";
  }
  return "bg-gray-100 text-gray-700";
}

const STATUS_OS_VALIDOS = ["Aberta", "Em andamento", "Concluída", "Cancelada"];

export default function Relatorios(): ReactElement {
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState<Dados>({
    ordens: [],
    orcamentos: [],
    clientes: [],
    itens: [],
  });

  const [periodo, setPeriodo] = useState<Periodo>("ultimos_6");
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    return inicioMes(d);
  });
  const [dataFim, setDataFim] = useState(dataAtual());

  useEffect(() => {
    async function carregar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setCarregando(false);
        return;
      }

      const [ordensRes, orcamentosRes, clientesRes] = await Promise.all([
        supabase
          .from("ordens_servico")
          .select(
            "id, numero, cliente_id, data_abertura, status, valor_total"
          )
          .eq("user_id", user.id),
        supabase
          .from("orcamentos")
          .select(
            "id, numero, cliente_id, data_orcamento, status, valor_total"
          )
          .eq("user_id", user.id),
        supabase
          .from("clientes")
          .select("id, nome")
          .eq("user_id", user.id),
      ]);

      const ordens = (ordensRes.data as OrdemServico[]) || [];
      const orcamentos = (orcamentosRes.data as Orcamento[]) || [];

      // Busca os itens dos orçamentos do usuário
      const orcIds = orcamentos.map((o) => o.id);
      let itens: OrcamentoItem[] = [];
      if (orcIds.length > 0) {
        const { data: itensData } = await supabase
          .from("orcamento_itens")
          .select(
            "orcamento_id, tipo, servico_id, produto_id, descricao, valor_unitario, subtotal"
          )
          .eq("user_id", user.id)
          .in("orcamento_id", orcIds);
        itens = (itensData as OrcamentoItem[]) || [];
      }

      setDados({
        ordens,
        orcamentos,
        clientes: (clientesRes.data as Cliente[]) || [],
        itens,
      });
      setCarregando(false);
    }

    carregar();
  }, []);

  // Quando muda o período, ajusta datas
  useEffect(() => {
    const hoje = new Date();
    let inicio: Date;
    if (periodo === "mes_atual") {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    } else if (periodo === "ultimos_3") {
      inicio = new Date(hoje);
      inicio.setMonth(hoje.getMonth() - 2);
      inicio.setDate(1);
    } else if (periodo === "ultimos_6") {
      inicio = new Date(hoje);
      inicio.setMonth(hoje.getMonth() - 5);
      inicio.setDate(1);
    } else if (periodo === "ultimos_12") {
      inicio = new Date(hoje);
      inicio.setMonth(hoje.getMonth() - 11);
      inicio.setDate(1);
    } else {
      return; // personalizado mantém o que o usuário digitou
    }
    setDataInicio(inicioMes(inicio));
    setDataFim(dataAtual());
  }, [periodo]);

  // Helpers
  const clientesMap = useMemo(() => {
    const m = new Map<number, string>();
    dados.clientes.forEach((c) => m.set(c.id, c.nome));
    return m;
  }, [dados.clientes]);

  const ordensFiltradas = useMemo(
    () =>
      dados.ordens.filter(
        (o) => o.data_abertura >= dataInicio && o.data_abertura <= dataFim
      ),
    [dados.ordens, dataInicio, dataFim]
  );

  const orcamentosFiltrados = useMemo(
    () =>
      dados.orcamentos.filter(
        (o) =>
          o.data_orcamento >= dataInicio && o.data_orcamento <= dataFim
      ),
    [dados.orcamentos, dataInicio, dataFim]
  );

  // 1. Faturamento por mês (gráfico de barras manual)
  const faturamentoPorMes = useMemo(() => {
    const meses: Record<
      string,
      { receita: number; despesa: number; label: string }
    > = {};

    ordensFiltradas.forEach((o) => {
      if (o.status === "Concluída") {
        const chave = o.data_abertura.substring(0, 7); // YYYY-MM
        if (!meses[chave]) {
          const [ano, mes] = chave.split("-");
          const data = new Date(Number(ano), Number(mes) - 1, 1);
          meses[chave] = {
            receita: 0,
            despesa: 0,
            label: data.toLocaleDateString("pt-BR", { month: "short" }),
          };
        }
        meses[chave].receita += Number(o.valor_total) || 0;
      }
    });

    return Object.entries(meses)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chave, valor]) => ({ chave, ...valor }));
  }, [ordensFiltradas]);

  // 2. Status das OS (distribuição)
  const distribuicaoOS = useMemo(() => {
    const mapa: Record<string, number> = {};
    STATUS_OS_VALIDOS.forEach((s) => (mapa[s] = 0));
    ordensFiltradas.forEach((o) => {
      mapa[o.status] = (mapa[o.status] || 0) + 1;
    });
    return mapa;
  }, [ordensFiltradas]);

  const totalOS = ordensFiltradas.length;

  // 3. Top 5 clientes por valor (somando OS Concluídas + Orçamentos Aprovados)
  const topClientes = useMemo(() => {
    const mapa = new Map<number, number>();
    ordensFiltradas
      .filter((o) => o.status === "Concluída")
      .forEach((o) => {
        mapa.set(o.cliente_id, (mapa.get(o.cliente_id) || 0) + Number(o.valor_total));
      });
    orcamentosFiltrados
      .filter((o) => o.status === "Aprovado")
      .forEach((o) => {
        mapa.set(o.cliente_id, (mapa.get(o.cliente_id) || 0) + Number(o.valor_total));
      });

    return Array.from(mapa.entries())
      .map(([cliente_id, valor]) => ({
        nome: clientesMap.get(cliente_id) || "Desconhecido",
        valor,
        cliente_id,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  }, [ordensFiltradas, orcamentosFiltrados, clientesMap]);

  // 4. Itens mais vendidos (top 5 por receita acumulada)
  const topItens = useMemo(() => {
    const mapa = new Map<string, { receita: number; quantidade: number; tipo: string }>();

    // Pega os IDs dos orçamentos aprovados ou OS concluídas no período
    const orcAprovadosIds = new Set(
      orcamentosFiltrados
        .filter((o) => o.status === "Aprovado")
        .map((o) => o.id)
    );

    dados.itens
      .filter((item) => orcAprovadosIds.has(item.orcamento_id))
      .forEach((item) => {
        const chave = item.tipo + ":" + item.descricao;
        if (!mapa.has(chave)) {
          mapa.set(chave, {
            receita: 0,
            quantidade: 0,
            tipo: item.tipo,
          });
        }
        const e = mapa.get(chave)!;
        e.receita += Number(item.subtotal) || 0;
        e.quantidade += Number(item.subtotal) / Number(item.valor_unitario) || 0;
      });

    return Array.from(mapa.entries())
      .map(([chave, v]) => ({
        descricao: chave.split(":").slice(1).join(":"),
        tipo: v.tipo,
        receita: v.receita,
        quantidade: Math.round(v.quantidade),
      }))
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 5);
  }, [dados.itens, orcamentosFiltrados]);

  // 5. KPIs gerais
  const kpis = useMemo(() => {
    const receitaTotal = ordensFiltradas
      .filter((o) => o.status === "Concluída")
      .reduce((s, o) => s + Number(o.valor_total), 0);
    const ticketMedio =
      ordensFiltradas.filter((o) => o.status === "Concluída").length > 0
        ? receitaTotal /
          ordensFiltradas.filter((o) => o.status === "Concluída").length
        : 0;
    const taxaAprovacao =
      orcamentosFiltrados.length > 0
        ? (orcamentosFiltrados.filter((o) => o.status === "Aprovado").length /
            orcamentosFiltrados.length) *
          100
        : 0;

    return {
      receitaTotal,
      ticketMedio,
      taxaAprovacao,
      totalClientesAtendidos: new Set(
        ordensFiltradas.map((o) => o.cliente_id)
      ).size,
    };
  }, [ordensFiltradas, orcamentosFiltrados]);

  const maxBarra =
    Math.max(...faturamentoPorMes.map((m) => m.receita), 1);

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Relatórios
            </h1>
            <p className="text-gray-500 mt-1">
              Visão analítica do seu negócio
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="rel_periodo"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Período
              </label>
              <select
                id="rel_periodo"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value as Periodo)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#FFD60A] bg-white"
              >
                <option value="mes_atual">Mês atual</option>
                <option value="ultimos_3">Últimos 3 meses</option>
                <option value="ultimos_6">Últimos 6 meses</option>
                <option value="ultimos_12">Últimos 12 meses</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="rel_inicio"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                De
              </label>
              <input
                id="rel_inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setPeriodo("personalizado");
                  setDataInicio(e.target.value);
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#FFD60A]"
              />
            </div>
            <div>
              <label
                htmlFor="rel_fim"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Até
              </label>
              <input
                id="rel_fim"
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setPeriodo("personalizado");
                  setDataFim(e.target.value);
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#FFD60A]"
              />
            </div>
            <div className="flex items-end text-sm text-gray-500">
              <Calendar className="w-4 h-4 mr-2" />
              {ordensFiltradas.length + orcamentosFiltrados.length} registros
              no período
            </div>
          </div>
        </div>

        {carregando ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">
            Carregando dados...
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
              <div className="bg-white rounded-xl shadow-sm p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <DollarSign className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Receita total</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    {formatarMoeda(kpis.receitaTotal)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    OS concluídas no período
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ticket médio</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {formatarMoeda(kpis.ticketMedio)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Por OS concluída
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Taxa de aprovação</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">
                    {kpis.taxaAprovacao.toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Orçamentos aprovados
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Clientes ativos</p>
                  <p className="text-2xl font-bold text-violet-600 mt-1">
                    {kpis.totalClientesAtendidos}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Com OS no período
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Faturamento por mês */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">
                    Faturamento por mês
                  </h2>
                  <BarChart3 className="w-5 h-5 text-gray-400" />
                </div>

                {faturamentoPorMes.length === 0 ? (
                  <p className="text-gray-500 text-sm py-8 text-center">
                    Sem OS concluídas no período selecionado.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {faturamentoPorMes.map((m) => {
                      const pct = (m.receita / maxBarra) * 100;
                      return (
                        <div key={m.chave}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700 capitalize">
                              {m.label}
                            </span>
                            <span className="font-bold text-gray-900">
                              {formatarMoeda(m.receita)}
                            </span>
                          </div>
                          <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-lg transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Status das OS */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">
                    Status das OS
                  </h2>
                  <Wrench className="w-5 h-5 text-gray-400" />
                </div>

                {totalOS === 0 ? (
                  <p className="text-gray-500 text-sm py-8 text-center">
                    Sem OS no período.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {STATUS_OS_VALIDOS.map((status) => {
                      const count = distribuicaoOS[status] || 0;
                      const pct = totalOS > 0 ? (count / totalOS) * 100 : 0;
                      return (
                        <div key={status}>
                          <div className="flex justify-between text-sm mb-1">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${corStatus(status)}`}
                            >
                              {status}
                            </span>
                            <span className="font-bold text-gray-900">
                              {count}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                status === "Concluída"
                                  ? "bg-emerald-500"
                                  : status === "Em andamento" || status === "Aberta"
                                  ? "bg-yellow-500"
                                  : status === "Cancelada"
                                  ? "bg-red-500"
                                  : "bg-gray-400"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Top 5 clientes */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">
                    Top 5 clientes
                  </h2>
                  <Award className="w-5 h-5 text-[#FFD60A]" />
                </div>

                {topClientes.length === 0 ? (
                  <p className="text-gray-500 text-sm py-8 text-center">
                    Sem clientes com receita no período.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {topClientes.map((c, idx) => (
                      <div
                        key={c.cliente_id}
                        className="flex items-center gap-3"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                            idx === 0
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {c.nome}
                          </p>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-[#FFD60A] rounded-full"
                              style={{
                                width: `${
                                  (c.valor / topClientes[0].valor) * 100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                        <p className="font-bold text-gray-900 shrink-0">
                          {formatarMoeda(c.valor)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Itens mais vendidos */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">
                    Itens mais vendidos
                  </h2>
                  <Package className="w-5 h-5 text-gray-400" />
                </div>

                {topItens.length === 0 ? (
                  <p className="text-gray-500 text-sm py-8 text-center">
                    Sem itens vendidos no período.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {topItens.map((item) => (
                      <div
                        key={item.tipo + ":" + item.descricao}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            item.tipo === "servico"
                              ? "bg-blue-100 text-blue-600"
                              : "bg-orange-100 text-orange-600"
                          }`}
                        >
                          {item.tipo === "servico" ? (
                            <Wrench className="w-5 h-5" />
                          ) : (
                            <Package className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {item.descricao}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.tipo === "servico" ? "Serviço" : "Produto"}{" "}
                            · {item.quantidade}{" "}
                            {item.tipo === "servico" ? "execuções" : "vendas"}
                          </p>
                        </div>
                        <p className="font-bold text-emerald-600 shrink-0">
                          {formatarMoeda(item.receita)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Resumo mensal em tabela */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">
                  Resumo mensal
                </h2>
              </div>
              {faturamentoPorMes.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">
                  Sem dados no período.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="text-left px-6 py-3 text-sm font-semibold text-gray-600"
                        >
                          Mês
                        </th>
                        <th
                          scope="col"
                          className="text-right px-6 py-3 text-sm font-semibold text-gray-600"
                        >
                          Receita
                        </th>
                        <th
                          scope="col"
                          className="text-right px-6 py-3 text-sm font-semibold text-gray-600"
                        >
                          OS concluídas
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {faturamentoPorMes.map((m) => {
                        const osMes = ordensFiltradas.filter(
                          (o) =>
                            o.status === "Concluída" &&
                            o.data_abertura.startsWith(m.chave)
                        );
                        return (
                          <tr
                            key={m.chave}
                            className="hover:bg-gray-50 transition"
                          >
                            <td className="px-6 py-4 font-medium text-gray-900 capitalize">
                              {m.label}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-emerald-600">
                              {formatarMoeda(m.receita)}
                            </td>
                            <td className="px-6 py-4 text-right text-gray-700">
                              {osMes.length}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
