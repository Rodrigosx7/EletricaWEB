import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";

type DashboardProps = {
  setPagina: (pagina: string) => void;
};

type KPIs = {
  faturamentoMes: number;
  osAbertas: number;
  osAndamento: number;
  osConcluidasMes: number;
  totalClientes: number;
  totalProdutos: number;
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

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function formatarData(data: string | null) {
  if (!data) return "—";
  const partes = data.split("-");
  if (partes.length !== 3) return data;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function classeStatus(status: string) {
  if (status === "Aberta") return "bg-yellow-100 text-yellow-700";
  if (status === "Em andamento") return "bg-blue-100 text-blue-700";
  if (status === "Concluída") return "bg-green-100 text-green-700";
  if (status === "Cancelada") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
}

const KPIS_INICIAIS: KPIs = {
  faturamentoMes: 0,
  osAbertas: 0,
  osAndamento: 0,
  osConcluidasMes: 0,
  totalClientes: 0,
  totalProdutos: 0,
  estoqueBaixo: 0,
  totalOrcamentosPendentes: 0,
};

export default function Dashboard({ setPagina }: DashboardProps) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [kpis, setKpis] = useState<KPIs>(KPIS_INICIAIS);
  const [osRecentes, setOsRecentes] = useState<OSRecente[]>([]);

  useEffect(() => {
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

      const [
        clientesRes,
        produtosRes,
        orcamentosRes,
        ordensRes,
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
      ]);

      const produtos = produtosRes.data || [];
      const ordens = ordensRes.data || [];

      const estoqueBaixo = produtos.filter(
        (p) => p.estoque <= p.estoque_minimo
      ).length;

      const osAbertas = ordens.filter(
        (o) => o.status === "Aberta"
      ).length;
      const osAndamento = ordens.filter(
        (o) => o.status === "Em andamento"
      ).length;
      const osConcluidasMes = ordens.filter(
        (o) =>
          o.status === "Concluída" &&
          o.data_abertura >= inicioMesISO
      );
      const faturamentoMes = osConcluidasMes.reduce(
        (total, o) =>
          total + (Number(o.valor_total) || 0),
        0
      );

      setKpis({
        faturamentoMes,
        osAbertas,
        osAndamento,
        osConcluidasMes: osConcluidasMes.length,
        totalClientes: clientesRes.count || 0,
        totalProdutos: produtos.length,
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
      icone: "👤",
      cor: "from-sky-500 to-sky-600",
    },
    {
      id: "orcamentos",
      titulo: "Novo orçamento",
      descricao: "Criar um orçamento",
      icone: "📋",
      cor: "from-violet-500 to-violet-600",
    },
    {
      id: "ordens-servico",
      titulo: "Nova O.S.",
      descricao: "Abrir ordem de serviço",
      icone: "🔧",
      cor: "from-amber-500 to-amber-600",
    },
    {
      id: "produtos",
      titulo: "Cadastrar produto",
      descricao: "Adicionar material ao estoque",
      icone: "📦",
      cor: "from-emerald-500 to-emerald-600",
    },
  ];

  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="h-9 w-64 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-gray-200 rounded mt-2 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-sm p-6 h-32 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {saudacao()}
            {usuario?.user_metadata?.nome
              ? `, ${usuario.user_metadata.nome.split(" ")[0]}`
              : ""}
            {" ⚡"}
          </h1>
          <p className="text-gray-500 mt-1">
            Visão geral do seu negócio hoje
          </p>
        </div>

        {/* KPIs principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* Faturamento do mês — destaque */}
          <div className="bg-gradient-to-br from-[#0D1B2A] to-[#1a2f47] rounded-xl shadow-md p-6 text-white lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider text-gray-300 font-semibold">
                Faturamento
              </p>
              <span className="text-2xl">💰</span>
            </div>
            <h2 className="text-3xl font-bold">
              {formatarMoeda(kpis.faturamentoMes)}
            </h2>
            <p className="text-sm text-gray-300 mt-2">
              {kpis.osConcluidasMes === 0
                ? "Nenhuma O.S. concluída no mês"
                : `${kpis.osConcluidasMes} O.S. concluída${
                    kpis.osConcluidasMes === 1 ? "" : "s"
                  } em ${new Date().toLocaleDateString(
                    "pt-BR",
                    { month: "long" }
                  )}`}
            </p>
          </div>

          {/* OS Abertas */}
          <button
            type="button"
            onClick={() => setPagina("ordens-servico")}
            className="bg-white rounded-xl shadow-sm p-6 text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                O.S. Abertas
              </p>
              <span className="text-2xl">📋</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">
              {kpis.osAbertas}
            </h2>
            <p className="text-sm text-gray-400 mt-2">
              Aguardando início
            </p>
          </button>

          {/* Em andamento */}
          <button
            type="button"
            onClick={() => setPagina("ordens-servico")}
            className="bg-white rounded-xl shadow-sm p-6 text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                Em andamento
              </p>
              <span className="text-2xl">🔧</span>
            </div>
            <h2 className="text-3xl font-bold text-blue-600">
              {kpis.osAndamento}
            </h2>
            <p className="text-sm text-gray-400 mt-2">
              Serviços em execução
            </p>
          </button>

          {/* Orçamentos pendentes */}
          <button
            type="button"
            onClick={() => setPagina("orcamentos")}
            className="bg-white rounded-xl shadow-sm p-6 text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                Orçamentos pendentes
              </p>
              <span className="text-2xl">📝</span>
            </div>
            <h2 className="text-3xl font-bold text-yellow-600">
              {kpis.totalOrcamentosPendentes}
            </h2>
            <p className="text-sm text-gray-400 mt-2">
              Aguardando aprovação
            </p>
          </button>
        </div>

        {/* KPIs secundários */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button
            type="button"
            onClick={() => setPagina("clientes")}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:border-[#FFD60A] transition-colors"
          >
            <p className="text-xs text-gray-500 font-medium">
              Clientes
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {kpis.totalClientes}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPagina("produtos")}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:border-[#FFD60A] transition-colors"
          >
            <p className="text-xs text-gray-500 font-medium">
              Produtos
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {kpis.totalProdutos}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPagina("servicos")}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:border-[#FFD60A] transition-colors"
          >
            <p className="text-xs text-gray-500 font-medium">
              Serviços
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              —
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              cat. cadastradas
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPagina("produtos")}
            className={`rounded-xl shadow-sm border p-4 text-left transition-colors ${
              kpis.estoqueBaixo > 0
                ? "bg-red-50 border-red-200 hover:border-red-400"
                : "bg-white border-gray-100 hover:border-[#FFD60A]"
            }`}
          >
            <p
              className={`text-xs font-medium ${
                kpis.estoqueBaixo > 0
                  ? "text-red-600"
                  : "text-gray-500"
              }`}
            >
              Estoque baixo
            </p>
            <p
              className={`text-2xl font-bold mt-1 ${
                kpis.estoqueBaixo > 0
                  ? "text-red-600"
                  : "text-gray-900"
              }`}
            >
              {kpis.estoqueBaixo}
            </p>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ações rápidas */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Ações rápidas
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Atalho para criar novos cadastros
            </p>

            <div className="space-y-2">
              {acoes.map((acao) => (
                <button
                  key={acao.id}
                  onClick={() => setPagina(acao.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-[#FFD60A] hover:bg-yellow-50/50 transition text-left group"
                >
                  <div
                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${acao.cor} flex items-center justify-center text-xl shadow-sm group-hover:scale-105 transition-transform`}
                  >
                    {acao.icone}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      {acao.titulo}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {acao.descricao}
                    </p>
                  </div>
                  <span className="text-gray-300 group-hover:text-[#FFD60A] transition-colors">
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* O.S. recentes */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Ordens de Serviço recentes
                </h2>
                <p className="text-sm text-gray-500">
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
                <div className="text-4xl mb-3">📋</div>
                <h3 className="font-semibold text-gray-900">
                  Nenhuma O.S. cadastrada
                </h3>
                <p className="text-gray-500 text-sm mt-1">
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
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                        O.S.
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Cliente
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Data
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {osRecentes.map((os) => (
                      <tr
                        key={os.id}
                        className="hover:bg-gray-50 transition"
                      >
                        <td className="px-6 py-3 font-semibold text-gray-900">
                          #{String(os.numero).padStart(4, "0")}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-700">
                          {os.cliente_nome || "—"}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">
                          {formatarData(os.data_abertura)}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${classeStatus(
                              os.status
                            )}`}
                          >
                            {os.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm font-medium text-gray-900 text-right">
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
