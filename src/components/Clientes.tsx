import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Search,
  UserPlus,
  X,
  Phone,
  Mail,
  MapPin,
  User as IconeUser,
} from "lucide-react";
import { supabase } from "../supabase";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./ui/toast";

type Cliente = {
  id: number;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  email: string | null;
  user_id: string;
  created_at?: string;
};

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 0 || !partes[0]) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/**
 * Aplica máscara brasileira de telefone: (11) 98765-4321 ou (11) 1234-5678.
 * Aceita 10 (fixo) ou 11 (celular) dígitos.
 */
function mascaraTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);

  if (digitos.length === 0) return "";
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  }
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

function emailValido(email: string): boolean {
  // Validação simples, suficiente para a UX inline
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuario, setUsuario] = useState<User | null>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");

  const [busca, setBusca] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const [clienteEditando, setClienteEditando] =
    useState<Cliente | null>(null);
  const [clienteParaExcluir, setClienteParaExcluir] =
    useState<Cliente | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const { mostrarToast } = useToast();

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
      mostrarToast("Erro ao carregar clientes.", "erro");
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

  async function salvarCliente(e: FormEvent) {
    e.preventDefault();

    if (!nome.trim()) {
      mostrarToast("Digite o nome do cliente.", "alerta");
      return;
    }

    if (email.trim() && !emailValido(email)) {
      mostrarToast("E-mail inválido.", "alerta");
      return;
    }

    if (!usuario) {
      mostrarToast("Usuário não identificado.", "erro");
      return;
    }

    setCarregando(true);

    const dados = {
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      endereco: endereco.trim() || null,
    };

    if (clienteEditando) {
      const { error } = await supabase
        .from("clientes")
        .update(dados)
        .eq("id", clienteEditando.id)
        .eq("user_id", usuario.id);

      if (error) {
        console.error("Erro ao editar cliente:", error);
        mostrarToast("Erro ao editar cliente.", "erro");
        setCarregando(false);
        return;
      }

      mostrarToast("Cliente atualizado com sucesso!", "sucesso");
    } else {
      const { error } = await supabase
        .from("clientes")
        .insert({ ...dados, user_id: usuario.id });

      if (error) {
        console.error("Erro ao cadastrar cliente:", error);
        mostrarToast("Erro ao cadastrar cliente.", "erro");
        setCarregando(false);
        return;
      }

      mostrarToast("Cliente cadastrado com sucesso!", "sucesso");
    }

    await carregarClientes(usuario.id);

    limparFormulario();
    setMostrarFormulario(false);
    setCarregando(false);
  }

  async function confirmarExclusao() {
    if (!clienteParaExcluir || !usuario) return;

    setExcluindo(true);

    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("id", clienteParaExcluir.id)
      .eq("user_id", usuario.id);

    setExcluindo(false);

    if (error) {
      console.error("Erro ao excluir cliente:", error);
      mostrarToast("Erro ao excluir cliente.", "erro");
      return;
    }

    setClientes((lista) =>
      lista.filter((c) => c.id !== clienteParaExcluir.id)
    );
    mostrarToast("Cliente excluído com sucesso.", "sucesso");
    setClienteParaExcluir(null);
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
        {/* Cabeçalho */}
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
            className="inline-flex items-center gap-2 bg-[#FFD60A] text-[#0D1B2A] font-bold px-5 py-3 rounded-lg hover:bg-yellow-400 transition shadow-lg shadow-yellow-500/20"
          >
            <UserPlus className="w-5 h-5" />
            Novo cliente
          </button>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500">Total de clientes</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {clientes.length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500">
              Clientes encontrados
            </p>
            <p className="text-3xl font-bold text-[#0D1B2A] mt-2">
              {clientesFiltrados.length}
            </p>
          </div>
        </div>

        {/* Busca */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <label
            htmlFor="busca_cliente"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            Buscar cliente
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
            <input
              id="busca_cliente"
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite nome, telefone ou e-mail..."
              className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Clientes cadastrados
            </h2>
            <span className="text-sm text-gray-500">
              {clientesFiltrados.length}{" "}
              {clientesFiltrados.length === 1
                ? "cliente"
                : "clientes"}
            </span>
          </div>

          {clientesFiltrados.length === 0 ? (
            <div className="p-10 text-center">
              <div className="inline-flex w-16 h-16 rounded-full bg-yellow-50 items-center justify-center mb-4">
                <IconeUser className="w-8 h-8 text-[#FFD60A]" />
              </div>
              <h3 className="font-semibold text-gray-900">
                {busca
                  ? "Nenhum cliente encontrado"
                  : "Nenhum cliente cadastrado"}
              </h3>
              <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
                {busca
                  ? "Tente pesquisar por outro nome, telefone ou e-mail."
                  : "Cadastre seu primeiro cliente para começar."}
              </p>
              {!busca && (
                <button
                  onClick={abrirNovoCliente}
                  className="mt-5 inline-flex items-center gap-2 bg-[#FFD60A] hover:bg-yellow-400 text-[#0D1B2A] font-bold px-5 py-2.5 rounded-lg transition shadow-lg shadow-yellow-500/20"
                >
                  <UserPlus className="w-4 h-4" />
                  Cadastrar primeiro cliente
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
                      Cliente
                    </th>
                    <th
                      scope="col"
                      className="text-left px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      Telefone
                    </th>
                    <th
                      scope="col"
                      className="text-left px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      E-mail
                    </th>
                    <th
                      scope="col"
                      className="text-left px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      Endereço
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
                  {clientesFiltrados.map((cliente) => (
                    <tr
                      key={cliente.id}
                      className="hover:bg-gray-50 transition"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD60A] to-yellow-500 text-[#0D1B2A] font-bold flex items-center justify-center shrink-0">
                            {iniciais(cliente.nome)}
                          </div>
                          <p className="font-semibold text-gray-900">
                            {cliente.nome}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {cliente.telefone ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            {cliente.telefone}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">
                            Não informado
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {cliente.email ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            <span className="truncate max-w-[200px]">
                              {cliente.email}
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">
                            Não informado
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                        {cliente.endereco ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="line-clamp-1">
                              {cliente.endereco}
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">
                            Não informado
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => abrirEditarCliente(cliente)}
                            className="px-3 py-2 rounded-lg text-sm font-medium text-[#0D1B2A] bg-gray-100 hover:bg-gray-200 transition"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() =>
                              setClienteParaExcluir(cliente)
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
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

            <form onSubmit={salvarCliente} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label
                    htmlFor="cliente_nome"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="cliente_nome"
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome completo"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="cliente_telefone"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Telefone
                  </label>
                  <input
                    id="cliente_telefone"
                    type="tel"
                    inputMode="numeric"
                    value={telefone}
                    onChange={(e) =>
                      setTelefone(mascaraTelefone(e.target.value))
                    }
                    placeholder="(11) 98765-4321"
                    maxLength={16}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="cliente_email"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    E-mail
                  </label>
                  <input
                    id="cliente_email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
                  />
                </div>

                <div className="md:col-span-2">
                  <label
                    htmlFor="cliente_endereco"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Endereço
                  </label>
                  <input
                    id="cliente_endereco"
                    type="text"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Rua, número, bairro..."
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#FFD60A] focus:border-transparent transition"
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
                    : clienteEditando
                    ? "Salvar alterações"
                    : "Cadastrar cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        aberto={clienteParaExcluir !== null}
        titulo="Excluir cliente?"
        descricao={
          <>
            Tem certeza que deseja excluir{" "}
            <strong className="text-gray-900">
              {clienteParaExcluir?.nome}
            </strong>
            ? Esta ação não pode ser desfeita.
          </>
        }
        textoBotaoConfirmar="Excluir"
        corBotaoConfirmar="vermelho"
        carregando={excluindo}
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setClienteParaExcluir(null)}
      />
    </div>
  );
}
