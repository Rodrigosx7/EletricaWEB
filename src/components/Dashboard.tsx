import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  UserPlus,
  ClipboardList,
  Wrench,
  Package,
  DollarSign,
  FileText,
  ArrowRight,
} from "lucide-react";
import { supabase } from "../supabase";
import { formatarMoeda, formatarData, primeiroDiaMesAnterior } from "../utils/formatters";
import { formatarNumero } from "../utils/constantes";
import { classeStatus } from "../utils/statusBadge";

type DashboardProps = {
  setPagina: (pagina: string) => void;
};

type KPIs = {
  faturamentoMes: number;
  faturamentoMesAnterior: number;
  osAbertas: number;
  osAndamento: number;
  osConcluidasMes: number;
  totalClientes: number;
  totalProdutos: number;
  totalServicos: number;
  estoqueBaixo: number;
  totalOrcamentosPendentes: number;
};

type OSRecente = {
  id: number;
  numero: number;
  status: string;
  data_abertura: string;
  valor_total: number;
  cliente_nome: string | null;
};

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

const KPIS_INICIAIS: KPIs = {
  faturamentoMes: 0,
  faturamentoMesAnterior: 0,
  osAbertas: 0,
  osAndamento: 0,
  osConcluidasMes: 0,
  totalClientes: 0,
  totalProdutos: 0,
  totalServicos: 0,
  estoqueBaixo: 0,
  totalOrcamentosPendentes: 0,
};

export default function Dashboard({ setPagina }: DashboardProps) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [kpis, setKpis] = useState<KPIs>(KPIS_INICIAIS);
  const [osRecentes, setOsRecentes] = useState<OSRecente[]>([]);

  useEffect(() => {
    carregar();

    // Recarrega dados sempre que o usuário volta para a aba do navegador
    function onFocus() {
      carregar();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);

    async function carregar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUsuario(user);
      if (!user) {
        setCarregando(false);
        return;
      }

      const inicioMes = new Date();
      inicioMes.setDate(1);
      const inicioMesISO = inicioMes.toISOString().split("T")[0];
      const inicioMesAnteriorISO = primeiroDiaMesAnterior();

      const [
        clientesRes,
        produtosRes,
        servicosRes,
        orcamentosRes,
        ordensRes,
        ordensMesRes,
        ordensMesAnteriorRes,
        osAbertasRes,
        osAndamentoRes,
      ] = await Promise.all([
        supabase
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("produtos")
          .select("id, estoque, estoque_minimo")
          .eq("user_id", user.id),
        supabase
          .from("servicos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("orcamentos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "Pendente"),
        supabase
          .from("ordens_servico")
          .select(
            "id, numero, status, data_abertura, valor_total, cliente_id"
          )
          .eq("user_id", user.id)
          .order("numero", { ascending: false })
          .limit(5),
        // OS do mês atual (para faturamento)
        supabase
          .from("ordens_servico")
          .select("valor_total, status, data_abertura")
          .eq("user_id", user.id)
          .eq("status", "Concluída")
          .gte("data_abertura", inicioMesISO),
        // OS do mês anterior (para variação)
        supabase
          .from("ordens_servico")
          .select("valor_total")
          .eq("user_id", user.id)
          .eq("status", "Concluída")
          .gte("data_abertura", inicioMesAnteriorISO)
          .lt("data_abertura", inicioMesISO),
        // KPIs reais: contagem separada de OS abertas (não derivado da lista limitada)
        supabase
          .from("ordens_servico")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "Aberta"),
        // KPIs reais: contagem separada de OS em andamento
        supabase
          .from("ordens_servico")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "Em andamento"),
      ]);

      const produtos = produtosRes.data || [];
      const ordens = ordensRes.data || [];

      const estoqueBaixo = produtos.filter(
        (p) => p.estoque <= p.estoque_minimo
      ).length;

      const osAbertas = osAbertasRes.count || 0;
      const osAndamento = osAndamentoRes.count || 0;
      const osConcluidasMes = ordensMesRes.data || [];
      const faturamentoMes = osConcluidasMes.reduce(
        (total, o) =>
          total + (Number(o.valor_total) || 0),
        0
      );
      const faturamentoMesAnterior = (ordensMesAnteriorRes.data || []).reduce(
        (total, o) => total + (Number(o.valor_total) || 0),
        0
      );

      setKpis({
        faturamentoMes,
        faturamentoMesAnterior,
        osAbertas,
        osAndamento,
        osConcluidasMes: osConcluidasMes.length,
        totalClientes: clientesRes.count || 0,
        totalProdutos: produtos.length,
        totalServicos: servicosRes.count || 0,
        estoqueBaixo,
        totalOrcamentosPendentes:
          orcamentosRes.count || 0,
      });

      // Buscar nomes dos clientes das OS recentes
      if (ordens.length > 0) {
        const clienteIds = Array.from(
          new Set(ordens.map((o) => o.cliente_id))
        );
        const { data: clientesData } = await supabase
          .from("clientes")
          .select("id, nome")
          .eq("user_id", user.id)
          .in("id", clienteIds);

        const mapaClientes = new Map(
          (clientesData || []).map((c) => [c.id, c.nome])
        );

        setOsRecentes(
          ordens.map((o) => ({
            id: o.id,
            numero: o.numero,
            status: o.status,
            data_abertura: o.data_abertura,
            valor_total: Number(o.valor_total) || 0,
            cliente_nome:
              mapaClientes.get(o.cliente_id) || null,
          }))
        );
      } else {
        setOsRecentes([]);
      }

      setCarregando(false);
    }

    carregar();
  }, []);

  const acoes = [
    {
      id: "clientes",
      titulo: "Novo cliente",
      descricao: "Cadastrar um novo cliente",
      Icone: UserPlus,
      cor: "from-sky-500 to-sky-600",
    },
    {
      id: "orcamentos",
      titulo: "Novo orçamento",
      descricao: "Criar um orçamento",
      Icone: ClipboardList,
      cor: "from-violet-500 to-violet-600",
    },
    {
      id: "ordens-servico",
      titulo: "Nova O.S.",
      descricao: "Abrir ordem de serviço",
      Icone: Wrench,
      cor: "from-amber-500 to-amber-600",
    },
    {
      id: "produtos",
      titulo: "Cadastrar produto",
      descricao: "Adicionar material ao estoque",
      Icone: Package,
      cor: "from-emerald-500 to-emerald-600",
    },
  ];

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-50 p-5 md:p-7">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="h-9 w-64 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-slate-200 rounded mt-2 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-card p-5 h-32 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-5 md:p-7">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {saudacao()}
            {usuario?.user_metadata?.nome
              ? `, ${usuario.user_metadata.nome.split(" ")[0]}`
              : ""}
          </h1>
          <p className="text-slate-500 mt-1 text-base">
            Visão geral do seu negócio hoje
          </p>
        </div>

        {/* KPIs principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Faturamento do mês — destaque */}
          <div className="bg-gradient-to-br from-[#0D1B2A] to-[#1a2f47] rounded-xl shadow-md shadow-yellow-500/5 p-5 text-white lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider text-slate-300 font-semibold">
                Faturamento
              </p>
              <DollarSign className="w-7 h-7 text-yellow-400" aria-hidden="true" />
            </div>
            <h2 className="text-4xl font-bold tracking-tight">
              {formatarMoeda(kpis.faturamentoMes)}
            </h2>
            {kpis.faturamentoMesAnterior > 0 ? (
              (() => {
                const variacao =
                  ((kpis.faturamentoMes - kpis.faturamentoMesAnterior) /
                    kpis.faturamentoMesAnterior) *
                  100;
                const cor =
                  variacao > 0
                    ? "text-emerald-300"
                    : variacao < 0
                    ? "text-red-300"
                    : "text-slate-300";
                const seta =
                  variacao > 0 ? "↑" : variacao < 0 ? "↓" : "→";
                return (
                  <p className={`text-sm font-medium mt-2 ${cor}`}>
                    {seta} {Math.abs(variacao).toFixed(0)}% vs. mês anterior
                  </p>
                );
              })()
            ) : (
              <p className="text-sm text-slate-300 mt-2">
                {kpis.osConcluidasMes === 0
                  ? "Nenhuma O.S. concluída no mês"
                  : "— primeira medição"}
              </p>
            )}
          </div>

          {/* OS Abertas */}
          <button
            type="button"
            onClick={() => setPagina("ordens-servico")}
            className="bg-white rounded-xl shadow-card p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                O.S. Abertas
              </p>
              <ClipboardList className="w-7 h-7 text-slate-500" aria-hidden="true" />
            </div>
            <h2 className="text-4xl font-bold text-slate-900 tracking-tight">
              {kpis.osAbertas}
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Aguardando início
            </p>
          </button>

          {/* Em andamento */}
          <button
            type="button"
            onClick={() => setPagina("ordens-servico")}
            className="bg-white rounded-xl shadow-card p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                Em andamento
              </p>
              <Wrench className="w-7 h-7 text-blue-500" aria-hidden="true" />
            </div>
            <h2 className="text-4xl font-bold text-blue-600 tracking-tight">
              {kpis.osAndamento}
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Serviços em execução
            </p>
          </button>

          {/* Orçamentos pendentes */}
          <button
            type="button"
            onClick={() => setPagina("orcamentos")}
            className="bg-white rounded-xl shadow-card p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                Orçamentos pendentes
              </p>
              <FileText className="w-7 h-7 text-yellow-500" aria-hidden="true" />
            </div>
            <h2 className="text-4xl font-bold text-yellow-600 tracking-tight">
              {kpis.totalOrcamentosPendentes}
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Aguardando aprovação
            </p>
          </button>
        </div>

        {/* KPIs secundários */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button
            type="button"
            onClick={() => setPagina("clientes")}
            className="bg-white rounded-xl shadow-card border border-slate-100 p-4 text-left hover:bg-slate-50 transition-colors"
          >
            <p className="text-xs text-slate-500 font-medium">
              Clientes
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
              {kpis.totalClientes}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPagina("produtos")}
            className="bg-white rounded-xl shadow-card border border-slate-100 p-4 text-left hover:bg-slate-50 transition-colors"
          >
            <p className="text-xs text-slate-500 font-medium">
              Produtos
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
              {kpis.totalProdutos}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPagina("servicos")}
            className="bg-white rounded-xl shadow-card border border-slate-100 p-4 text-left hover:bg-slate-50 transition-colors"
          >
            <p className="text-xs text-slate-500 font-medium">
              Serviços
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
              {kpis.totalServicos}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPagina("produtos")}
            className={`rounded-xl shadow-card border p-4 text-left transition-colors ${
              kpis.estoqueBaixo > 0
                ? "bg-red-50 border-red-200 hover:bg-red-50/80"
                : "bg-white border-slate-100 hover:bg-slate-50"
            }`}
          >
            <p
              className={`text-xs font-medium ${
                kpis.estoqueBaixo > 0
                  ? "text-red-600"
                  : "text-slate-500"
              }`}
            >
              Estoque baixo
            </p>
            <p
              className={`text-2xl font-bold mt-1 tracking-tight ${
                kpis.estoqueBaixo > 0
                  ? "text-red-600"
                  : "text-slate-900"
              }`}
            >
              {kpis.estoqueBaixo}
            </p>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ações rápidas */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-card p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">
              Ações rápidas
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              Atalho para criar novos cadastros
            </p>

            <div className="space-y-2">
              {acoes.map((acao) => {
                const Icone = acao.Icone;
                return (
                  <button
                    key={acao.id}
                    onClick={() => setPagina(acao.id)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition text-left group"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg bg-gradient-to-br ${acao.cor} flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform`}
                    >
                      <Icone className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm">
                        {acao.titulo}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {acao.descricao}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#FFD60A] transition-colors shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* O.S. recentes */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-card overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Ordens de Serviço recentes
                </h2>
                <p className="text-sm text-slate-500">
                  As 5 últimas O.S. cadastradas
                </p>
              </div>
              <button
                onClick={() => setPagina("ordens-servico")}
                className="text-sm font-semibold text-[#0D1B2A] hover:text-[#FFD60A] transition"
              >
                Ver todas →
              </button>
            </div>

            {osRecentes.length === 0 ? (
              <div className="p-12 text-center">
                <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-3" aria-hidden="true" />
                <h3 className="font-semibold text-slate-900">
                  Nenhuma O.S. cadastrada
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  Crie a primeira ordem de serviço para começar.
                </p>
                <button
                  onClick={() => setPagina("ordens-servico")}
                  className="mt-4 bg-[#FFD60A] text-[#0D1B2A] font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition"
                >
                  + Nova O.S.
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        O.S.
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Data
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {osRecentes.map((os) => (
                      <tr
                        key={os.id}
                        className="hover:bg-slate-50/60 transition"
                      >
                        <td className="px-6 py-3 font-semibold text-slate-900">
                          #{formatarNumero(os.numero)}
                        </td>
                        <td className="px-6 py-3 text-sm text-slate-700">
                          {os.cliente_nome || "—"}
                        </td>
                        <td className="px-6 py-3 text-sm text-slate-600">
                          {os.data_abertura ? formatarData(os.data_abertura) : "—"}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${classeStatus(
                              os.status
                            )}`}
                          >
                            {os.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm font-medium text-slate-900 text-right">
                          {formatarMoeda(os.valor_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
