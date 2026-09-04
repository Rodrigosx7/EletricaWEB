import { useEffect, useState } from "react";
import { supabase } from "../supabase";

type Servico = {
  id: number;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  preco: number;
  user_id: string;
  created_at?: string;
};

export default function Servicos() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [usuario, setUsuario] = useState<any>(null);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");

  const [busca, setBusca] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const [servicoEditando, setServicoEditando] =
    useState<Servico | null>(null);

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
      Number(servico.preco).toFixed(2).replace(".", ",")
    );

    setMostrarFormulario(true);
  }

  function converterPreco(valor: string) {
    const somenteNumeros = valor.replace(/\D/g, "");

    if (!somenteNumeros) {
      setPreco("");
      return;
    }

    const numero = Number(somenteNumeros) / 100;

    setPreco(
      numero.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  function precoNumerico() {
    return Number(
      preco
        .replace(/\./g, "")
        .replace(",", ".")
    );
  }

  async function salvarServico(e: React.FormEvent) {
    e.preventDefault();

    if (!nome.trim()) {
      alert("Digite o nome do serviço.");
      return;
    }

    if (!usuario) {
      alert("Usuário não identificado.");
      return;
    }

    const valor = precoNumerico();

    if (isNaN(valor) || valor < 0) {
      alert("Digite um preço válido.");
      return;
    }

    setCarregando(true);

    if (servicoEditando) {
      const { error } = await supabase
        .from("servicos")
        .update({
          nome: nome.trim(),
          categoria: categoria.trim() || null,
          descricao: descricao.trim() || null,
          preco: valor,
        })
        .eq("id", servicoEditando.id)
        .eq("user_id", usuario.id);

      if (error) {
        console.error("Erro ao editar serviço:", error);
        alert("Erro ao editar serviço.");
        setCarregando(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from("servicos")
        .insert({
          nome: nome.trim(),
          categoria: categoria.trim() || null,
          descricao: descricao.trim() || null,
          preco: valor,
          user_id: usuario.id,
        });

      if (error) {
        console.error("Erro ao cadastrar serviço:", error);
        alert("Erro ao cadastrar serviço.");
        setCarregando(false);
        return;
      }
    }

    await carregarServicos(usuario.id);

    limparFormulario();
    setMostrarFormulario(false);
    setCarregando(false);
  }

  async function excluirServico(id: number) {
    const confirmar = confirm(
      "Deseja realmente excluir este serviço?"
    );

    if (!confirmar || !usuario) return;

    const { error } = await supabase
      .from("servicos")
      .delete()
      .eq("id", id)
      .eq("user_id", usuario.id);

    if (error) {
      console.error("Erro ao excluir serviço:", error);
      alert("Erro ao excluir serviço.");
      return;
    }

    setServicos((lista) =>
      lista.filter((servico) => servico.id !== id)
    );
  }

  const servicosFiltrados = servicos.filter((servico) => {
    const termo = busca.toLowerCase().trim();

    if (!termo) return true;

    return (
      servico.nome.toLowerCase().includes(termo) ||
      (servico.categoria || "")
        .toLowerCase()
        .includes(termo)
    );
  });

  function formatarPreco(valor: number) {
    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">

      <div className="max-w-7xl mx-auto">

        {/* CABEÇALHO */}
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
            className="bg-[#FFD60A] text-[#0D1B2A] font-bold px-5 py-3 rounded-lg hover:opacity-90 transition shadow-sm"
          >
            + Novo serviço
          </button>

        </div>

        {/* CARD TOTAL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">

          <div className="bg-white rounded-xl shadow-sm p-6">

            <p className="text-sm text-gray-500">
              Total de serviços
            </p>

            <p className="text-3xl font-bold text-gray-900 mt-2">
              {servicos.length}
            </p>

          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">

            <p className="text-sm text-gray-500">
              Serviços encontrados
            </p>

            <p className="text-3xl font-bold text-gray-900 mt-2">
              {servicosFiltrados.length}
            </p>

          </div>

        </div>

        {/* BUSCA */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Buscar serviço
          </label>

          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite o nome ou categoria..."
            className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent"
          />

        </div>

        {/* LISTA */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">

          <div className="p-6 border-b border-gray-100">

            <h2 className="text-xl font-bold text-gray-900">
              Serviços cadastrados
            </h2>

          </div>

          {servicosFiltrados.length === 0 ? (

            <div className="p-10 text-center">

              <div className="text-4xl mb-3">
                ⚡
              </div>

              <h3 className="font-semibold text-gray-900">
                {busca
                  ? "Nenhum serviço encontrado"
                  : "Nenhum serviço cadastrado"}
              </h3>

              <p className="text-gray-500 text-sm mt-1">
                {busca
                  ? "Tente pesquisar por outro nome ou categoria."
                  : "Cadastre seus serviços para utilizá-los futuramente nos orçamentos."}
              </p>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-gray-50">

                  <tr>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Serviço
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Categoria
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Descrição
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Preço
                    </th>

                    <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">
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

                          <div className="w-10 h-10 rounded-full bg-[#0D1B2A] text-white flex items-center justify-center font-bold">
                            ⚡
                          </div>

                          <div>

                            <p className="font-semibold text-gray-900">
                              {servico.nome}
                            </p>

                            <p className="text-xs text-gray-400">
                              Serviço #{servico.id}
                            </p>

                          </div>

                        </div>

                      </td>

                      <td className="px-6 py-4">

                        {servico.categoria ? (

                          <span className="inline-flex px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
                            {servico.categoria}
                          </span>

                        ) : (

                          <span className="text-sm text-gray-400">
                            Sem categoria
                          </span>

                        )}

                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">

                        <span className="line-clamp-2">
                          {servico.descricao ||
                            "Sem descrição"}
                        </span>

                      </td>

                      <td className="px-6 py-4">

                        <span className="font-bold text-gray-900">
                          {formatarPreco(servico.preco)}
                        </span>

                      </td>

                      <td className="px-6 py-4">

                        <div className="flex justify-end gap-2">

                          <button
                            onClick={() =>
                              abrirEditarServico(servico)
                            }
                            className="px-3 py-2 rounded-lg text-sm font-medium text-[#0D1B2A] bg-gray-100 hover:bg-gray-200 transition"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() =>
                              excluirServico(servico.id)
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

      {/* MODAL */}
      {mostrarFormulario && (

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">

          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">

            {/* CABEÇALHO */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">

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
                onClick={() => {
                  limparFormulario();
                  setMostrarFormulario(false);
                }}
                className="text-gray-400 hover:text-gray-700 text-2xl"
              >
                ×
              </button>

            </div>

            {/* FORMULÁRIO */}
            <form
              onSubmit={salvarServico}
              className="p-6"
            >

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* NOME */}
                <div className="md:col-span-2">

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do serviço *
                  </label>

                  <input
                    type="text"
                    value={nome}
                    onChange={(e) =>
                      setNome(e.target.value)
                    }
                    placeholder="Ex: Instalação de tomada"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A]"
                  />

                </div>

                {/* CATEGORIA */}
                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>

                  <input
                    type="text"
                    value={categoria}
                    onChange={(e) =>
                      setCategoria(e.target.value)
                    }
                    placeholder="Ex: Instalação"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A]"
                  />

                </div>

                {/* PREÇO */}
                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preço base
                  </label>

                  <div className="relative">

                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                      R$
                    </span>

                    <input
                      type="text"
                      value={preco}
                      onChange={(e) =>
                        converterPreco(e.target.value)
                      }
                      placeholder="0,00"
                      className="w-full border border-gray-200 rounded-lg pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A]"
                    />

                  </div>

                </div>

                {/* DESCRIÇÃO */}
                <div className="md:col-span-2">

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>

                  <textarea
                    value={descricao}
                    onChange={(e) =>
                      setDescricao(e.target.value)
                    }
                    placeholder="Descreva o que está incluído no serviço..."
                    rows={4}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] resize-none"
                  />

                </div>

              </div>

              {/* BOTÕES */}
              <div className="flex justify-end gap-3 mt-7">

                <button
                  type="button"
                  onClick={() => {
                    limparFormulario();
                    setMostrarFormulario(false);
                  }}
                  className="px-5 py-3 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={carregando}
                  className="px-5 py-3 rounded-lg bg-[#FFD60A] text-[#0D1B2A] font-bold hover:opacity-90 disabled:opacity-50"
                >
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

    </div>
  );
}