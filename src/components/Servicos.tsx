import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Search,
  Zap,
  Plus,
  X,
  Tag,
  DollarSign,
  ListChecks,
} from "lucide-react";
import { supabase } from "../supabase";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./ui/toast";

type Servico = {
  id: number;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  preco: number;
  user_id: string;
  created_at?: string;
};

function formatarMoeda(valor: number) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Máscara monetária: "1234" → "12,34"; "123456" → "1.234,56".
 */
function mascaraMoeda(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  if (!digitos) return "";
  const numero = Number(digitos) / 100;
  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function converterNumero(valor: string): number {
  return Number(valor.replace(/\./g, "").replace(",", "."));
}

export default function Servicos() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [usuario, setUsuario] = useState<User | null>(null);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");

  const [busca, setBusca] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const [servicoEditando, setServicoEditando] =
    useState<Servico | null>(null);
  const [servicoParaExcluir, setServicoParaExcluir] =
    useState<Servico | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const { mostrarToast } = useToast();

  useEffect(() => {
    async function iniciar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUsuario(user);

      if (user) {
        carregarServicos(user.id);
      }
    }

    iniciar();
  }, []);

  async function carregarServicos(userId: string) {
    const { data, error } = await supabase
      .from("servicos")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: false });

    if (error) {
      console.error("Erro ao carregar serviços:", error);
      mostrarToast("Erro ao carregar serviços.", "erro");
      return;
    }

    setServicos(data || []);
  }

  function limparFormulario() {
    setNome("");
    setCategoria("");
    setDescricao("");
    setPreco("");
    setServicoEditando(null);
  }

  function abrirNovoServico() {
    limparFormulario();
    setMostrarFormulario(true);
  }

  function abrirEditarServico(servico: Servico) {
    setServicoEditando(servico);
    setNome(servico.nome);
    setCategoria(servico.categoria || "");
    setDescricao(servico.descricao || "");
    setPreco(
      Number(servico.preco).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
    setMostrarFormulario(true);
  }

  async function salvarServico(e: FormEvent) {
    e.preventDefault();

    if (!nome.trim()) {
      mostrarToast("Digite o nome do serviço.", "alerta");
      return;
    }

    if (!usuario) {
      mostrarToast("Usuário não identificado.", "erro");
      return;
    }

    const valor = preco ? converterNumero(preco) : 0;

    if (isNaN(valor) || valor < 0) {
      mostrarToast("Digite um preço válido.", "alerta");
      return;
    }

    setCarregando(true);

    const dados = {
      nome: nome.trim(),
      categoria: categoria.trim() || null,
      descricao: descricao.trim() || null,
      preco: valor,
    };

    if (servicoEditando) {
      const { error } = await supabase
        .from("servicos")
        .update(dados)
        .eq("id", servicoEditando.id)
        .eq("user_id", usuario.id);

      if (error) {
        console.error("Erro ao editar serviço:", error);
        mostrarToast("Erro ao editar serviço.", "erro");
        setCarregando(false);
        return;
      }

      mostrarToast("Serviço atualizado com sucesso!", "sucesso");
    } else {
      const { error } = await supabase
        .from("servicos")
        .insert({ ...dados, user_id: usuario.id });

      if (error) {
        console.error("Erro ao cadastrar serviço:", error);
        mostrarToast("Erro ao cadastrar serviço.", "erro");
        setCarregando(false);
        return;
      }

      mostrarToast("Serviço cadastrado com sucesso!", "sucesso");
    }

    await carregarServicos(usuario.id);

    limparFormulario();
    setMostrarFormulario(false);
    setCarregando(false);
  }

  async function confirmarExclusao() {
    if (!servicoParaExcluir || !usuario) return;

    setExcluindo(true);

    const { error } = await supabase
      .from("servicos")
      .delete()
      .eq("id", servicoParaExcluir.id)
      .eq("user_id", usuario.id);

    setExcluindo(false);

    if (error) {
      console.error("Erro ao excluir serviço:", error);
      mostrarToast("Erro ao excluir serviço.", "erro");
      return;
    }

    setServicos((lista) =>
      lista.filter((s) => s.id !== servicoParaExcluir.id)
    );
    mostrarToast("Serviço excluído com sucesso.", "sucesso");
    setServicoParaExcluir(null);
  }

  const servicosFiltrados = servicos.filter((servico) => {
    const termo = busca.toLowerCase().trim();
    if (!termo) return true;
    return (
      servico.nome.toLowerCase().includes(termo) ||
      (servico.categoria || "").toLowerCase().includes(termo)
    );
  });

  // Preço médio dos serviços cadastrados (para o card de estatísticas)
  const precoMedio =
    servicos.length > 0
      ? servicos.reduce((total, s) => total + s.preco, 0) /
        servicos.length
      : 0;

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Serviços
            </h1>
            <p className="text-gray-500 mt-1">
              Cadastre e gerencie os serviços que você oferece
            </p>
          </div>

          <button
            onClick={abrirNovoServico}
            className="inline-flex items-center gap-2 bg-[#FFD60A] text-[#0D1B2A] font-bold px-5 py-3 rounded-lg hover:bg-yellow-400 transition shadow-lg shadow-yellow-500/20"
          >
            <Plus className="w-5 h-5" />
            Novo serviço
          </button>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0">
              <ListChecks className="w-6 h-6 text-[#FFD60A]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">
                Total de serviços
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {servicos.length}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6 text-[#FFD60A]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">
                Serviços encontrados
              </p>
              <p className="text-3xl font-bold text-[#0D1B2A] mt-1">
                {servicosFiltrados.length}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">
                Preço médio
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatarMoeda(precoMedio)}
              </p>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <label
            htmlFor="busca_servico"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            Buscar serviço
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
            <input
              id="busca_servico"
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite o nome ou categoria..."
              className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Serviços cadastrados
            </h2>
            <span className="text-sm text-gray-500">
              {servicosFiltrados.length}{" "}
              {servicosFiltrados.length === 1
                ? "serviço"
                : "serviços"}
            </span>
          </div>

          {servicosFiltrados.length === 0 ? (
            <div className="p-10 text-center">
              <div className="inline-flex w-16 h-16 rounded-full bg-yellow-50 items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-[#FFD60A]" />
              </div>
              <h3 className="font-semibold text-gray-900">
                {busca
                  ? "Nenhum serviço encontrado"
                  : "Nenhum serviço cadastrado"}
              </h3>
              <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
                {busca
                  ? "Tente pesquisar por outro nome ou categoria."
                  : "Cadastre seus serviços para utilizá-los futuramente nos orçamentos."}
              </p>
              {!busca && (
                <button
                  onClick={abrirNovoServico}
                  className="mt-5 inline-flex items-center gap-2 bg-[#FFD60A] hover:bg-yellow-400 text-[#0D1B2A] font-bold px-5 py-2.5 rounded-lg transition shadow-lg shadow-yellow-500/20"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar primeiro serviço
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
                      Serviço
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
                      className="text-left px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      Preço
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
                  {servicosFiltrados.map((servico) => (
                    <tr
                      key={servico.id}
                      className="hover:bg-gray-50 transition"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD60A] to-yellow-500 text-[#0D1B2A] font-bold flex items-center justify-center shrink-0">
                            <Zap className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">
                              {servico.nome}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              Serviço #{servico.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {servico.categoria ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
                            <Tag className="w-3 h-3" />
                            {servico.categoria}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400 italic">
                            Sem categoria
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                        <span className="line-clamp-2">
                          {servico.descricao || (
                            <span className="italic text-gray-400">
                              Sem descrição
                            </span>
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-900 text-base">
                          {formatarMoeda(servico.preco)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              abrirEditarServico(servico)
                            }
                            className="px-3 py-2 rounded-lg text-sm font-medium text-[#0D1B2A] bg-gray-100 hover:bg-gray-200 transition"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setServicoParaExcluir(servico)
                            }
                            className="px-3 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition"
                          >
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
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {servicoEditando
                    ? "Editar serviço"
                    : "Novo serviço"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {servicoEditando
                    ? "Atualize os dados do serviço."
                    : "Cadastre um serviço que você oferece."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  limparFormulario();
                  setMostrarFormulario(false);
                }}
                className="text-gray-400 hover:text-gray-700 transition p-1 rounded-lg hover:bg-gray-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={salvarServico} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Nome */}
                <div className="md:col-span-2">
                  <label
                    htmlFor="servico_nome"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Nome do serviço{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="servico_nome"
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Instalação de tomada"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    required
                  />
                </div>

                {/* Categoria */}
                <div>
                  <label
                    htmlFor="servico_categoria"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Categoria
                  </label>
                  <input
                    id="servico_categoria"
                    type="text"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    placeholder="Ex: Instalação"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                </div>

                {/* Preço */}
                <div>
                  <label
                    htmlFor="servico_preco"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Preço base
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                      R$
                    </span>
                    <input
                      id="servico_preco"
                      type="text"
                      inputMode="numeric"
                      value={preco}
                      onChange={(e) =>
                        setPreco(mascaraMoeda(e.target.value))
                      }
                      placeholder="0,00"
                      className="w-full border border-gray-200 rounded-lg pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    />
                  </div>
                </div>

                {/* Descrição */}
                <div className="md:col-span-2">
                  <label
                    htmlFor="servico_descricao"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Descrição
                  </label>
                  <textarea
                    id="servico_descricao"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Descreva o que está incluído no serviço..."
                    rows={4}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-7">
                <button
                  type="button"
                  onClick={() => {
                    limparFormulario();
                    setMostrarFormulario(false);
                  }}
                  className="px-5 py-3 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={carregando}
                  className="px-5 py-3 rounded-lg bg-[#FFD60A] text-[#0D1B2A] font-bold hover:bg-yellow-400 disabled:opacity-60 transition shadow-lg shadow-yellow-500/20 inline-flex items-center gap-2"
                >
                  {carregando && (
                    <div className="w-4 h-4 border-2 border-[#0D1B2A]/30 border-t-[#0D1B2A] rounded-full animate-spin" />
                  )}
                  {carregando
                    ? "Salvando..."
                    : servicoEditando
                    ? "Salvar alterações"
                    : "Cadastrar serviço"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        aberto={servicoParaExcluir !== null}
        titulo="Excluir serviço?"
        descricao={
          <>
            Tem certeza que deseja excluir{" "}
            <strong className="text-gray-900">
              {servicoParaExcluir?.nome}
            </strong>
            ? Esta ação não pode ser desfeita.
          </>
        }
        textoBotaoConfirmar="Excluir"
        corBotaoConfirmar="vermelho"
        carregando={excluindo}
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setServicoParaExcluir(null)}
      />
    </div>
  );
}
