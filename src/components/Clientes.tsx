import { useEffect, useState } from "react";
import { supabase } from "../supabase";

type Cliente = {
  id: number;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  email: string | null;
  user_id: string;
  created_at?: string;
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuario, setUsuario] = useState<any>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");

  const [busca, setBusca] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const [clienteEditando, setClienteEditando] =
    useState<Cliente | null>(null);

  useEffect(() => {
    async function iniciar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUsuario(user);

      if (user) {
        carregarClientes(user.id);
      }
    }

    iniciar();
  }, []);

  async function carregarClientes(userId: string) {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: false });

    if (error) {
      console.error("Erro ao carregar clientes:", error);
      return;
    }

    setClientes(data || []);
  }

  function limparFormulario() {
    setNome("");
    setTelefone("");
    setEmail("");
    setEndereco("");
    setClienteEditando(null);
  }

  function abrirNovoCliente() {
    limparFormulario();
    setMostrarFormulario(true);
  }

  function abrirEditarCliente(cliente: Cliente) {
    setClienteEditando(cliente);

    setNome(cliente.nome);
    setTelefone(cliente.telefone || "");
    setEmail(cliente.email || "");
    setEndereco(cliente.endereco || "");

    setMostrarFormulario(true);
  }

  async function salvarCliente(e: React.FormEvent) {
    e.preventDefault();

    if (!nome.trim()) {
      alert("Digite o nome do cliente.");
      return;
    }

    if (!usuario) {
      alert("Usuário não identificado.");
      return;
    }

    setCarregando(true);

    if (clienteEditando) {
      const { error } = await supabase
        .from("clientes")
        .update({
          nome: nome.trim(),
          telefone: telefone.trim() || null,
          email: email.trim() || null,
          endereco: endereco.trim() || null,
        })
        .eq("id", clienteEditando.id)
        .eq("user_id", usuario.id);

      if (error) {
        console.error("Erro ao editar cliente:", error);
        alert("Erro ao editar cliente.");
        setCarregando(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from("clientes")
        .insert({
          nome: nome.trim(),
          telefone: telefone.trim() || null,
          email: email.trim() || null,
          endereco: endereco.trim() || null,
          user_id: usuario.id,
        });

      if (error) {
        console.error("Erro ao cadastrar cliente:", error);
        alert("Erro ao cadastrar cliente.");
        setCarregando(false);
        return;
      }
    }

    await carregarClientes(usuario.id);

    limparFormulario();
    setMostrarFormulario(false);
    setCarregando(false);
  }

  async function excluirCliente(id: number) {
    const confirmar = confirm(
      "Deseja realmente excluir este cliente?"
    );

    if (!confirmar || !usuario) return;

    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("id", id)
      .eq("user_id", usuario.id);

    if (error) {
      console.error("Erro ao excluir cliente:", error);
      alert("Erro ao excluir cliente.");
      return;
    }

    setClientes((lista) =>
      lista.filter((cliente) => cliente.id !== id)
    );
  }

  const clientesFiltrados = clientes.filter((cliente) => {
    const termo = busca.toLowerCase().trim();

    if (!termo) return true;

    return (
      cliente.nome.toLowerCase().includes(termo) ||
      (cliente.telefone || "").toLowerCase().includes(termo) ||
      (cliente.email || "").toLowerCase().includes(termo)
    );
  });

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">

      <div className="max-w-7xl mx-auto">

        {/* CABEÇALHO */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">

          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Clientes
            </h1>

            <p className="text-gray-500 mt-1">
              Gerencie os clientes do seu negócio
            </p>
          </div>

          <button
            onClick={abrirNovoCliente}
            className="bg-[#FFD60A] text-[#0D1B2A] font-bold px-5 py-3 rounded-lg hover:opacity-90 transition shadow-sm"
          >
            + Novo cliente
          </button>

        </div>

        {/* CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">

          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500">
              Total de clientes
            </p>

            <p className="text-3xl font-bold text-gray-900 mt-2">
              {clientes.length}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500">
              Clientes encontrados
            </p>

            <p className="text-3xl font-bold text-gray-900 mt-2">
              {clientesFiltrados.length}
            </p>
          </div>

        </div>

        {/* BUSCA */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Buscar cliente
          </label>

          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite nome, telefone ou e-mail..."
            className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent"
          />

        </div>

        {/* LISTA */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">

          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">
              Clientes cadastrados
            </h2>
          </div>

          {clientesFiltrados.length === 0 ? (

            <div className="p-10 text-center">

              <div className="text-4xl mb-3">
                👤
              </div>

              <h3 className="font-semibold text-gray-900">
                {busca
                  ? "Nenhum cliente encontrado"
                  : "Nenhum cliente cadastrado"}
              </h3>

              <p className="text-gray-500 text-sm mt-1">
                {busca
                  ? "Tente pesquisar por outro nome, telefone ou e-mail."
                  : "Cadastre seu primeiro cliente para começar."}
              </p>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-gray-50">

                  <tr>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Cliente
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Telefone
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      E-mail
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Endereço
                    </th>

                    <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">
                      Ações
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-100">

                  {clientesFiltrados.map((cliente) => (

                    <tr
                      key={cliente.id}
                      className="hover:bg-gray-50 transition"
                    >

                      <td className="px-6 py-4">

                        <div className="flex items-center gap-3">

                          <div className="w-10 h-10 rounded-full bg-[#0D1B2A] text-white flex items-center justify-center font-bold">
                            {cliente.nome
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <p className="font-semibold text-gray-900">
                              {cliente.nome}
                            </p>

                            <p className="text-xs text-gray-400">
                              Cliente #{cliente.id}
                            </p>
                          </div>

                        </div>

                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {cliente.telefone || "Não informado"}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {cliente.email || "Não informado"}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                        <span className="line-clamp-2">
                          {cliente.endereco || "Não informado"}
                        </span>
                      </td>

                      <td className="px-6 py-4">

                        <div className="flex justify-end gap-2">

                          <button
                            onClick={() =>
                              abrirEditarCliente(cliente)
                            }
                            className="px-3 py-2 rounded-lg text-sm font-medium text-[#0D1B2A] bg-gray-100 hover:bg-gray-200 transition"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() =>
                              excluirCliente(cliente.id)
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

            {/* CABEÇALHO DO MODAL */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">

              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {clienteEditando
                    ? "Editar cliente"
                    : "Novo cliente"}
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  {clienteEditando
                    ? "Atualize os dados do cliente."
                    : "Cadastre um novo cliente."}
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
              onSubmit={salvarCliente}
              className="p-6"
            >

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                <div className="md:col-span-2">

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome *
                  </label>

                  <input
                    type="text"
                    value={nome}
                    onChange={(e) =>
                      setNome(e.target.value)
                    }
                    placeholder="Nome completo"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A]"
                  />

                </div>

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone
                  </label>

                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) =>
                      setTelefone(e.target.value)
                    }
                    placeholder="(00) 00000-0000"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A]"
                  />

                </div>

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    placeholder="cliente@email.com"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A]"
                  />

                </div>

                <div className="md:col-span-2">

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endereço
                  </label>

                  <input
                    type="text"
                    value={endereco}
                    onChange={(e) =>
                      setEndereco(e.target.value)
                    }
                    placeholder="Rua, número, bairro..."
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A]"
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
                    : clienteEditando
                    ? "Salvar alterações"
                    : "Cadastrar cliente"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}