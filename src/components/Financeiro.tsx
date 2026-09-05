import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Search,
  Plus,
  X,
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Trash2,
  Pencil,
  Calendar,
  FileDown,
} from "lucide-react";
import { supabase } from "../supabase";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./ui/toast";

type TipoMovimento = "receita" | "despesa";

type Movimento = {
  id: string;
  user_id: string;
  tipo: TipoMovimento;
  categoria: string;
  descricao: string;
  valor: number;
  data_movimento: string;
  forma_pagamento: string | null;
  observacoes: string | null;
  ordem_servico_id: number | null;
  created_at: string;
  updated_at: string;
};

const CATEGORIAS_RECEITA = [
  "Serviço prestado",
  "Orçamento aprovado",
  "Venda de produto",
  "Outros",
];

const CATEGORIAS_DESPESA = [
  "Material",
  "Combustível",
  "Alimentação",
  "Ferramenta",
  "Transporte",
  "Outros",
];

const FORMAS_PAGAMENTO = [
  "Dinheiro",
  "PIX",
  "Cartão de crédito",
  "Cartão de débito",
  "Transferência",
  "Boleto",
  "Cheque",
];

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(data: string): string {
  const partes = data.split("-");
  if (partes.length !== 3) return data;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function dataIsoAtual(): string {
  return new Date().toISOString().split("T")[0];
}

function primeiroDiaMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function corCategoria(cat: string): string {
  // Mapeia categorias conhecidas para cores consistentes
  const mapa: Record<string, string> = {
    "Serviço prestado": "bg-emerald-100 text-emerald-700",
    "Orçamento aprovado": "bg-emerald-100 text-emerald-700",
    "Venda de produto": "bg-emerald-100 text-emerald-700",
    Material: "bg-amber-100 text-amber-700",
    Combustível: "bg-orange-100 text-orange-700",
    Alimentação: "bg-pink-100 text-pink-700",
    Ferramenta: "bg-indigo-100 text-indigo-700",
    Transporte: "bg-blue-100 text-blue-700",
    Outros: "bg-gray-100 text-gray-700",
  };
  return mapa[cat] || "bg-gray-100 text-gray-700";
}

export default function Financeiro(): ReactElement {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | TipoMovimento>(
    "todos"
  );
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes());
  const [dataFim, setDataFim] = useState(dataIsoAtual());

  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [movEditando, setMovEditando] = useState<Movimento | null>(null);
  const [movParaExcluir, setMovParaExcluir] = useState<Movimento | null>(
    null
  );
  const [excluindo, setExcluindo] = useState(false);

  const [tipo, setTipo] = useState<TipoMovimento>("receita");
  const [categoria, setCategoria] = useState(CATEGORIAS_RECEITA[0]);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [dataMovimento, setDataMovimento] = useState(dataIsoAtual());
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const { mostrarToast } = useToast();

  useEffect(() => {
    async function carregar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUsuario(user);
      if (user) {
        await carregarMovimentos(user.id);
      } else {
        setCarregando(false);
      }
    }
    carregar();

    // Auto-refresh quando volta para a aba
    function onFocus() {
      carregar();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function carregarMovimentos(userId: string) {
    const { data, error } = await supabase
      .from("movimentacoes")
      .select("*")
      .eq("user_id", userId)
      .order("data_movimento", { ascending: false })
      .order("created_at", { ascending: false });

    setCarregando(false);

    if (error) {
      console.error("Erro ao carregar movimentações:", error);
      mostrarToast("Erro ao carregar movimentações.", "erro");
      return;
    }

    setMovimentos(data || []);
  }

  function limparFormulario() {
    setMovEditando(null);
    setTipo("receita");
    setCategoria(CATEGORIAS_RECEITA[0]);
    setDescricao("");
    setValor("");
    setDataMovimento(dataIsoAtual());
    setFormaPagamento("");
    setObservacoes("");
  }

  function abrirNovaMovimentacao() {
    limparFormulario();
    setModalAberto(true);
  }

  function abrirEditarMovimentacao(mov: Movimento) {
    setMovEditando(mov);
    setTipo(mov.tipo);
    setCategoria(mov.categoria);
    setDescricao(mov.descricao);
    setValor(String(mov.valor).replace(".", ","));
    setDataMovimento(mov.data_movimento);
    setFormaPagamento(mov.forma_pagamento || "");
    setObservacoes(mov.observacoes || "");
    setModalAberto(true);
  }

  // Atualiza categoria quando muda o tipo (no modo novo)
  useEffect(() => {
    if (!movEditando) {
      if (tipo === "receita") {
        setCategoria(CATEGORIAS_RECEITA[0]);
      } else {
        setCategoria(CATEGORIAS_DESPESA[0]);
      }
    }
  }, [tipo, movEditando]);

  async function salvar(e: FormEvent) {
    e.preventDefault();

    if (!descricao.trim()) {
      mostrarToast("Digite uma descrição.", "alerta");
      return;
    }

    const valorNumerico = Number(valor.replace(/\./g, "").replace(",", "."));
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      mostrarToast("Digite um valor válido.", "alerta");
      return;
    }

    if (!usuario) {
      mostrarToast("Usuário não identificado.", "erro");
      return;
    }

    setSalvando(true);

    const payload = {
      user_id: usuario.id,
      tipo,
      categoria,
      descricao: descricao.trim(),
      valor: valorNumerico,
      data_movimento: dataMovimento,
      forma_pagamento: formaPagamento || null,
      observacoes: observacoes.trim() || null,
      ordem_servico_id: null,
    };

    let error;
    if (movEditando) {
      const res = await supabase
        .from("movimentacoes")
        .update(payload)
        .eq("id", movEditando.id)
        .eq("user_id", usuario.id);
      error = res.error;
    } else {
      const res = await supabase
        .from("movimentacoes")
        .insert(payload);
      error = res.error;
    }

    setSalvando(false);

    if (error) {
      console.error("Erro ao salvar:", error);
      mostrarToast(
        movEditando
          ? "Erro ao atualizar movimentação."
          : "Erro ao cadastrar movimentação.",
        "erro"
      );
      return;
    }

    mostrarToast(
      movEditando
        ? "Movimentação atualizada!"
        : "Movimentação cadastrada!",
      "sucesso"
    );

    await carregarMovimentos(usuario.id);
    limparFormulario();
    setModalAberto(false);
  }

  async function confirmarExclusao() {
    if (!movParaExcluir || !usuario) return;
    setExcluindo(true);

    const { error } = await supabase
      .from("movimentacoes")
      .delete()
      .eq("id", movParaExcluir.id)
      .eq("user_id", usuario.id);

    setExcluindo(false);

    if (error) {
      console.error("Erro ao excluir:", error);
      mostrarToast("Erro ao excluir movimentação.", "erro");
      return;
    }

    setMovimentos((lista) =>
      lista.filter((m) => m.id !== movParaExcluir.id)
    );
    mostrarToast("Movimentação excluída.", "sucesso");
    setMovParaExcluir(null);
  }

  // Filtra + busca
  const movimentosFiltrados = useMemo(() => {
    return movimentos.filter((m) => {
      if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
      if (m.data_movimento < dataInicio) return false;
      if (m.data_movimento > dataFim) return false;
      const termo = busca.toLowerCase().trim();
      if (termo) {
        const alvo =
          `${m.descricao} ${m.categoria} ${m.forma_pagamento || ""} ${m.observacoes || ""}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [movimentos, filtroTipo, dataInicio, dataFim, busca]);

  // KPIs do período filtrado
  const stats = useMemo(() => {
    const totalReceitas = movimentosFiltrados
      .filter((m) => m.tipo === "receita")
      .reduce((s, m) => s + m.valor, 0);
    const totalDespesas = movimentosFiltrados
      .filter((m) => m.tipo === "despesa")
      .reduce((s, m) => s + m.valor, 0);
    const lucro = totalReceitas - totalDespesas;
    return {
      totalReceitas,
      totalDespesas,
      lucro,
      totalMovimentos: movimentosFiltrados.length,
    };
  }, [movimentosFiltrados]);

  function exportarCSV() {
    if (movimentosFiltrados.length === 0) {
      mostrarToast("Não há dados para exportar.", "alerta");
      return;
    }

    const linhas = [
      "Data;Tipo;Categoria;Descrição;Valor;Forma de Pagamento;Observações",
      ...movimentosFiltrados.map((m) =>
        [
          m.data_movimento,
          m.tipo,
          m.categoria,
          `"${m.descricao.replace(/"/g, '""')}"`,
          m.valor.toFixed(2).replace(".", ","),
          m.forma_pagamento || "",
          `"${(m.observacoes || "").replace(/"/g, '""')}"`,
        ].join(";")
      ),
    ];

    const blob = new Blob(["﻿" + linhas.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${dataInicio}-${dataFim}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarToast("CSV exportado!", "sucesso");
  }

  const categorias =
    tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Financeiro
            </h1>
            <p className="text-gray-500 mt-1">
              Controle suas receitas e despesas
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportarCSV}
              className="inline-flex items-center gap-2 bg-white text-gray-700 font-semibold px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
            >
              <FileDown className="w-5 h-5" />
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={abrirNovaMovimentacao}
              className="inline-flex items-center gap-2 bg-[#FFD60A] text-[#0D1B2A] font-bold px-5 py-3 rounded-lg hover:bg-yellow-400 transition shadow-lg shadow-yellow-500/20"
            >
              <Plus className="w-5 h-5" />
              Nova movimentação
            </button>
          </div>
        </div>

        {/* Cards de KPI */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Receitas</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {formatarMoeda(stats.totalReceitas)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Despesas</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatarMoeda(stats.totalDespesas)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                stats.lucro >= 0 ? "bg-blue-50" : "bg-red-50"
              }`}
            >
              <DollarSign
                className={`w-6 h-6 ${
                  stats.lucro >= 0 ? "text-blue-600" : "text-red-600"
                }`}
              />
            </div>
            <div>
              <p className="text-sm text-gray-500">Lucro líquido</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  stats.lucro >= 0 ? "text-blue-600" : "text-red-600"
                }`}
              >
                {formatarMoeda(stats.lucro)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0">
              <Wallet className="w-6 h-6 text-[#FFD60A]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Movimentações</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.totalMovimentos}
              </p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="fin_busca"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                <input
                  id="fin_busca"
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Descrição, categoria..."
                  className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="fin_tipo"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Tipo
              </label>
              <select
                id="fin_tipo"
                value={filtroTipo}
                onChange={(e) =>
                  setFiltroTipo(
                    e.target.value as "todos" | TipoMovimento
                  )
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#FFD60A] bg-white"
              >
                <option value="todos">Todos</option>
                <option value="receita">Receitas</option>
                <option value="despesa">Despesas</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="fin_inicio"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                De
              </label>
              <input
                id="fin_inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#FFD60A]"
              />
            </div>

            <div>
              <label
                htmlFor="fin_fim"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Até
              </label>
              <input
                id="fin_fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#FFD60A]"
              />
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Movimentações
            </h2>
            <span className="text-sm text-gray-500">
              {movimentosFiltrados.length}{" "}
              {movimentosFiltrados.length === 1 ? "item" : "itens"}
            </span>
          </div>

          {carregando ? (
            <div className="p-10 text-center text-gray-500">
              Carregando...
            </div>
          ) : movimentosFiltrados.length === 0 ? (
            <div className="p-10 text-center">
              <div className="inline-flex w-16 h-16 rounded-full bg-yellow-50 items-center justify-center mb-4">
                <Wallet className="w-8 h-8 text-[#FFD60A]" />
              </div>
              <h3 className="font-semibold text-gray-900">
                {busca || filtroTipo !== "todos"
                  ? "Nenhuma movimentação encontrada"
                  : "Nenhuma movimentação cadastrada"}
              </h3>
              <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
                {busca || filtroTipo !== "todos"
                  ? "Tente ajustar os filtros."
                  : "Cadastre sua primeira receita ou despesa para começar."}
              </p>
              {!busca && filtroTipo === "todos" && (
                <button
                  type="button"
                  onClick={abrirNovaMovimentacao}
                  className="mt-5 inline-flex items-center gap-2 bg-[#FFD60A] hover:bg-yellow-400 text-[#0D1B2A] font-bold px-5 py-2.5 rounded-lg transition shadow-lg shadow-yellow-500/20"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar primeira movimentação
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="text-left px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      Data
                    </th>
                    <th
                      scope="col"
                      className="text-left px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      Tipo
                    </th>
                    <th
                      scope="col"
                      className="text-left px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      Categoria
                    </th>
                    <th
                      scope="col"
                      className="text-left px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      Descrição
                    </th>
                    <th
                      scope="col"
                      className="text-right px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      Valor
                    </th>
                    <th
                      scope="col"
                      className="text-right px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movimentosFiltrados.map((mov) => (
                    <tr
                      key={mov.id}
                      className="hover:bg-gray-50 transition"
                    >
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {formatarData(mov.data_movimento)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                            mov.tipo === "receita"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {mov.tipo === "receita" ? "Receita" : "Despesa"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${corCategoria(
                            mov.categoria
                          )}`}
                        >
                          {mov.categoria}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">
                          {mov.descricao}
                        </p>
                        {mov.forma_pagamento && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            via {mov.forma_pagamento}
                          </p>
                        )}
                        {mov.ordem_servico_id && (
                          <p className="text-xs text-emerald-600 mt-0.5">
                            ↳ Receita automática da OS #
                            {mov.ordem_servico_id}
                          </p>
                        )}
                      </td>
                      <td
                        className={`px-6 py-4 text-right font-bold ${
                          mov.tipo === "receita"
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {mov.tipo === "receita" ? "+" : "−"}{" "}
                        {formatarMoeda(mov.valor)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => abrirEditarMovimentacao(mov)}
                            title="Editar"
                            aria-label="Editar movimentação"
                            className="px-3 py-2 rounded-lg text-sm font-medium text-[#0D1B2A] bg-gray-100 hover:bg-gray-200 transition inline-flex items-center gap-1"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setMovParaExcluir(mov)}
                            title="Excluir"
                            aria-label="Excluir movimentação"
                            className="px-3 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de cadastro/edição */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {movEditando ? "Editar movimentação" : "Nova movimentação"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Registre uma receita ou despesa
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  limparFormulario();
                  setModalAberto(false);
                }}
                className="text-gray-400 hover:text-gray-700 transition p-1 rounded-lg hover:bg-gray-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={salvar} className="p-6 space-y-5">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipo("receita")}
                    className={`p-4 rounded-xl border-2 transition text-left ${
                      tipo === "receita"
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                      <span className="font-bold text-gray-900">
                        Receita
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Entrada de dinheiro
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipo("despesa")}
                    className={`p-4 rounded-xl border-2 transition text-left ${
                      tipo === "despesa"
                        ? "border-red-500 bg-red-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-red-600" />
                      <span className="font-bold text-gray-900">
                        Despesa
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Saída de dinheiro
                    </p>
                  </button>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label
                  htmlFor="mov_descricao"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Descrição{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  id="mov_descricao"
                  type="text"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Instalação elétrica residencial"
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  required
                />
              </div>

              {/* Valor + Data */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="mov_valor"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Valor (R$){" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="mov_valor"
                    type="text"
                    inputMode="decimal"
                    value={valor}
                    onChange={(e) => {
                      const digitos = e.target.value.replace(/\D/g, "");
                      if (!digitos) {
                        setValor("");
                        return;
                      }
                      const n = Number(digitos) / 100;
                      setValor(
                        n.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      );
                    }}
                    placeholder="0,00"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="mov_data"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Data
                  </label>
                  <input
                    id="mov_data"
                    type="date"
                    value={dataMovimento}
                    onChange={(e) => setDataMovimento(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A]"
                  />
                </div>
              </div>

              {/* Categoria + Forma de pagamento */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="mov_categoria"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Categoria
                  </label>
                  <select
                    id="mov_categoria"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] bg-white"
                  >
                    {categorias.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="mov_forma"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Forma de pagamento
                  </label>
                  <select
                    id="mov_forma"
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] bg-white"
                  >
                    <option value="">Não informar</option>
                    {FORMAS_PAGAMENTO.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label
                  htmlFor="mov_observacoes"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Observações
                </label>
                <textarea
                  id="mov_observacoes"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  placeholder="Anotações opcionais..."
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    limparFormulario();
                    setModalAberto(false);
                  }}
                  className="px-5 py-3 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-3 rounded-lg bg-[#FFD60A] text-[#0D1B2A] font-bold hover:bg-yellow-400 disabled:opacity-60 transition shadow-lg shadow-yellow-500/20 inline-flex items-center gap-2"
                >
                  {salvando && (
                    <div className="w-4 h-4 border-2 border-[#0D1B2A]/30 border-t-[#0D1B2A] rounded-full animate-spin" />
                  )}
                  {salvando
                    ? "Salvando..."
                    : movEditando
                    ? "Salvar alterações"
                    : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        aberto={movParaExcluir !== null}
        titulo="Excluir movimentação?"
        descricao={
          movParaExcluir ? (
            <>
              Tem certeza que deseja excluir a movimentação{" "}
              <strong className="text-gray-900">
                "{movParaExcluir.descricao}"
              </strong>{" "}
              de{" "}
              <strong className="text-gray-900">
                {formatarMoeda(movParaExcluir.valor)}
              </strong>
              ? Esta ação não pode ser desfeita.
            </>
          ) : null
        }
        textoBotaoConfirmar="Excluir"
        corBotaoConfirmar="vermelho"
        carregando={excluindo}
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setMovParaExcluir(null)}
      />
    </div>
  );
}
