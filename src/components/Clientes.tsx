import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { Search, UserPlus, Pencil, Trash2, Phone, Mail, MapPin } from "lucide-react";
import { supabase } from "../supabase";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./ui/toast";
import Modal from "./ui/Modal";
import { mascaraTelefone } from "../utils/formatters";

type Cliente = {
  id: number;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  email: string | null;
  user_id: string;
  created_at?: string;
};

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
  const [ordenacao, setOrdenacao] = useState("recentes");
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState(false);
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

      if (!user) setCarregandoLista(false);
    }

    iniciar();
  }, []);

  useEffect(() => {
    if (usuario) carregarClientes(usuario.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  async function carregarClientes(userId: string) {
    setCarregandoLista(true);
    setErroLista(false);
    const { data, error } = await supabase
      .from("clientes")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("id", { ascending: false });

    setCarregandoLista(false);
    if (error) {
      setErroLista(true);
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
  }).sort((a, b) => ordenacao === "nome" ? a.nome.localeCompare(b.nome, "pt-BR") : b.id - a.id);

  function fecharFormulario() {
    limparFormulario();
    setMostrarFormulario(false);
  }

  function acoesCliente(cliente: Cliente) {
    return <div className="row-actions">
      <button type="button" className="icon-button" onClick={() => abrirEditarCliente(cliente)} aria-label={"Editar " + cliente.nome} title="Editar cliente"><Pencil size={17} aria-hidden="true" /></button>
      <button type="button" className="icon-button" onClick={() => setClienteParaExcluir(cliente)} aria-label={"Excluir " + cliente.nome} title="Excluir cliente"><Trash2 size={17} aria-hidden="true" /></button>
    </div>;
  }

  return (
    <div className="product-page">
      <header className="page-header">
        <div><h1>Clientes</h1><p>Contatos e locais de atendimento, sempre à mão.</p></div>
        <div className="page-actions"><button type="button" onClick={abrirNovoCliente} className="btn-primary"><UserPlus size={18} aria-hidden="true" />Novo cliente</button></div>
      </header>

      <div className="metric-strip">
        <div className="metric"><label>Base de clientes</label><strong>{clientes.length}</strong><small>cadastros</small></div>
        <div className="metric"><label>Com telefone</label><strong>{clientes.filter((c) => c.telefone).length}</strong><small>contatos disponíveis</small></div>
        <div className="metric"><label>Com endereço</label><strong>{clientes.filter((c) => c.endereco).length}</strong><small>locais informados</small></div>
      </div>

      <section className="data-panel" aria-label="Diretório de clientes">
        <div className="data-toolbar">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="busca_cliente" className="sr-only">Buscar cliente</label>
            <Search size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input id="busca_cliente" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, telefone ou e-mail" className="input-base !pl-10" />
          </div>
          <div>
            <label htmlFor="ordem_cliente" className="sr-only">Ordenar clientes</label>
            <select id="ordem_cliente" value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)} className="input-base">
              <option value="recentes">Mais recentes</option><option value="nome">Nome: A a Z</option>
            </select>
          </div>
          <span className="record-meta" aria-live="polite">{clientesFiltrados.length} {clientesFiltrados.length === 1 ? "cliente" : "clientes"}</span>
        </div>
        {erroLista ? <div className="empty-state" role="alert"><h3>Não foi possível carregar os clientes</h3><p>Tente novamente para consultar seus contatos.</p><button type="button" className="btn-secondary" onClick={() => usuario && carregarClientes(usuario.id)}>Tentar novamente</button></div>
        : carregandoLista ? <div className="empty-state" role="status">Carregando clientes…</div>
        : clientesFiltrados.length === 0 ? <div className="empty-state"><h3>{busca ? "Nenhum cliente nesta busca" : "Seu próximo atendimento começa aqui"}</h3><p>{busca ? "Busque por outro nome, telefone ou e-mail." : "Cadastre o contato e o endereço do cliente para usar nos orçamentos e serviços."}</p><button type="button" className="btn-secondary" onClick={busca ? () => setBusca("") : abrirNovoCliente}>{busca ? "Limpar busca" : "Cadastrar primeiro cliente"}</button></div>
        : <>
          <div className="hidden lg:block">
            <table className="data-table">
              <thead><tr><th scope="col">Cliente</th><th scope="col">Contato</th><th scope="col">Local de atendimento</th><th scope="col" className="text-right">Ações</th></tr></thead>
              <tbody>{clientesFiltrados.map((cliente) => <tr key={cliente.id}>
                <td><button type="button" className="record-primary text-left hover:underline" onClick={() => abrirEditarCliente(cliente)}>{cliente.nome}</button><p className="record-meta">Cadastro #{cliente.id}</p></td>
                <td><p>{cliente.telefone || "Telefone não informado"}</p><p className="record-meta break-all">{cliente.email || "E-mail não informado"}</p></td>
                <td><p className="max-w-xs">{cliente.endereco || <span className="record-meta">Endereço não informado</span>}</p></td>
                <td>{acoesCliente(cliente)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="mobile-records lg:hidden">{clientesFiltrados.map((cliente) => <article key={cliente.id} className="record-row">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><button type="button" className="record-primary text-left" onClick={() => abrirEditarCliente(cliente)}>{cliente.nome}</button><p className="record-meta">Cadastro #{cliente.id}</p></div>{acoesCliente(cliente)}</div>
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex items-center gap-2"><Phone size={15} aria-hidden="true" className="shrink-0 text-slate-500" />{cliente.telefone || "Telefone não informado"}</p>
              {cliente.email && <p className="flex items-start gap-2 break-all"><Mail size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-500" />{cliente.email}</p>}
              <p className="flex items-start gap-2"><MapPin size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-500" />{cliente.endereco || "Endereço não informado"}</p>
            </div>
          </article>)}</div>
        </>}
      </section>

      {mostrarFormulario && <Modal title={clienteEditando ? "Editar cliente" : "Novo cliente"} description="Organize os dados de contato e o local de atendimento." onClose={fecharFormulario} busy={carregando} footer={<><button type="button" className="btn-secondary" onClick={fecharFormulario} disabled={carregando}>Cancelar</button><button type="submit" form="form_cliente" className="btn-primary" disabled={carregando}>{carregando ? "Salvando…" : clienteEditando ? "Salvar alterações" : "Cadastrar cliente"}</button></>}>
        <form id="form_cliente" onSubmit={salvarCliente}>
          <section className="form-section"><h3>Identificação</h3><p>O nome identifica este cliente em toda a operação.</p>
            <label htmlFor="cliente_nome" className="field-label">Nome completo *</label><input id="cliente_nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente ou empresa" className="input-base" required autoComplete="name" />
          </section>
          <section className="form-section"><h3>Contato</h3><p>Informe os canais para combinar visitas e enviar propostas.</p>
            <div className="form-grid">
              <div><label htmlFor="cliente_telefone" className="field-label">Telefone</label><input id="cliente_telefone" type="tel" inputMode="tel" value={telefone} onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} placeholder="(11) 98765-4321" maxLength={16} className="input-base" autoComplete="tel" /></div>
              <div><label htmlFor="cliente_email" className="field-label">E-mail</label><input id="cliente_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" className="input-base" autoComplete="email" /></div>
            </div>
          </section>
          <section className="form-section"><h3>Local de atendimento</h3><p>Inclua rua, número, bairro e complemento.</p>
            <label htmlFor="cliente_endereco" className="field-label">Endereço</label><input id="cliente_endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro e cidade" className="input-base" autoComplete="street-address" />
          </section>
        </form>
      </Modal>}

      <ConfirmDialog aberto={clienteParaExcluir !== null} titulo="Excluir cliente?" descricao={<>Tem certeza que deseja excluir <strong>{clienteParaExcluir?.nome}</strong>? Esta ação não pode ser desfeita.</>} textoBotaoConfirmar="Excluir" corBotaoConfirmar="vermelho" carregando={excluindo} aoConfirmar={confirmarExclusao} aoCancelar={() => setClienteParaExcluir(null)} />
    </div>
  );
}
