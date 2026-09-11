import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../supabase";
import {
  formatarMoeda,
  mascaraMoeda,
  converterNumero,
} from "../utils/formatters";
import ConfirmDialog from "./ConfirmDialog";
import Modal from "./ui/Modal";
import { useToast } from "./ui/toast";
import { usePaginacao } from "../hooks/usePaginacao";
import ControlesPaginacao from "./ui/ControlesPaginacao";

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
  const [usuario, setUsuario] = useState<User | null>(null);
  const paginacao = usePaginacao(20);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");

  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState("recentes");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState(false);
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
      if (!user) setCarregandoLista(false);
    }
    iniciar();
  }, []);

  useEffect(() => {
    if (usuario) carregarServicos(usuario.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, paginacao.pagina, paginacao.tamanho]);

  async function carregarServicos(userId: string) {
    setCarregandoLista(true);
    setErroLista(false);
    const de = paginacao.offset;
    const ate = de + paginacao.tamanho - 1;
    const { data, error, count } = await supabase
      .from("servicos")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("id", { ascending: false })
      .range(de, ate);

    setCarregandoLista(false);
    if (error) {
      setErroLista(true);
      console.error("Erro ao carregar serviços:", error);
      mostrarToast("Erro ao carregar serviços.", "erro");
      return;
    }

    setServicos(data || []);
    paginacao.setTotal(count ?? 0);
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
    if (categoriaFiltro && servico.categoria !== categoriaFiltro) return false;
    const termo = busca.toLowerCase().trim();
    if (!termo) return true;
    return (
      servico.nome.toLowerCase().includes(termo) ||
      (servico.categoria || "").toLowerCase().includes(termo)
    );
  }).sort((a, b) => ordenacao === "nome" ? a.nome.localeCompare(b.nome, "pt-BR") : ordenacao === "preco" ? a.preco - b.preco : b.id - a.id);

  // Preço médio dos serviços cadastrados (para o card de estatísticas)
  const precoMedio =
    servicos.length > 0
      ? servicos.reduce((total, s) => total + s.preco, 0) /
        servicos.length
      : 0;

  function fecharFormulario() {
    limparFormulario();
    setMostrarFormulario(false);
  }

  function acoesServico(servico: Servico) {
    return <div className="row-actions">
      <button type="button" className="icon-button" onClick={() => abrirEditarServico(servico)} aria-label={"Editar " + servico.nome} title="Editar serviço"><Pencil size={17} aria-hidden="true" /></button>
      <button type="button" className="icon-button" onClick={() => setServicoParaExcluir(servico)} aria-label={"Excluir " + servico.nome} title="Excluir serviço"><Trash2 size={17} aria-hidden="true" /></button>
    </div>;
  }

  const categorias = Array.from(new Set(servicos.flatMap((s) => s.categoria ? [s.categoria] : []))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const temFiltro = Boolean(busca || categoriaFiltro);
  function limparFiltros() { setBusca(""); setCategoriaFiltro(""); }

  return (
    <div className="product-page">
      <header className="page-header">
        <div><h1>Serviços</h1><p>Seu catálogo de trabalho, com escopo e preço de referência.</p></div>
        <div className="page-actions"><button type="button" onClick={abrirNovoServico} className="btn-primary"><Plus size={18} aria-hidden="true" />Novo serviço</button></div>
      </header>
      <div className="metric-strip">
        <div className="metric"><label>No catálogo</label><strong>{paginacao.total}</strong><small>serviços cadastrados</small></div>
        <div className="metric"><label>Preço médio</label><strong>{formatarMoeda(precoMedio)}</strong><small>dos serviços nesta página</small></div>
        <div className="metric"><label>Categorias</label><strong>{categorias.length}</strong><small>nesta página</small></div>
      </div>

      <section className="data-panel" aria-label="Catálogo de serviços">
        <div className="data-toolbar">
          <div className="relative min-w-0 flex-1"><label htmlFor="busca_servico" className="sr-only">Buscar serviço nesta página</label><Search size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" /><input id="busca_servico" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou categoria" className="input-base !pl-10" /></div>
          <div><label htmlFor="filtro_categoria_servico" className="sr-only">Filtrar categoria nesta página</label><select id="filtro_categoria_servico" value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className="input-base"><option value="">Todas as categorias</option>{categorias.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label htmlFor="ordem_servico" className="sr-only">Ordenar serviços nesta página</label><select id="ordem_servico" value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)} className="input-base"><option value="recentes">Mais recentes</option><option value="nome">Nome: A a Z</option><option value="preco">Menor preço</option></select></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-5 py-3"><p className="record-meta" aria-live="polite">{servicosFiltrados.length} resultados nesta página. Busca, filtros e ordenação se aplicam aos itens exibidos.</p>{temFiltro && <button type="button" className="btn-secondary" onClick={limparFiltros}>Limpar filtros</button>}</div>
        {erroLista ? <div className="empty-state" role="alert"><h3>Não foi possível carregar os serviços</h3><p>Tente novamente para consultar o catálogo.</p><button type="button" className="btn-secondary" onClick={() => usuario && carregarServicos(usuario.id)}>Tentar novamente</button></div>
        : carregandoLista ? <div className="empty-state" role="status">Carregando serviços…</div>
        : servicosFiltrados.length === 0 ? <div className="empty-state"><h3>{temFiltro ? "Nenhum serviço com estes filtros" : "Organize os serviços que você oferece"}</h3><p>{temFiltro ? "Ajuste os filtros ou consulte outra página do catálogo." : "Defina nome, escopo e preço base para agilizar seus orçamentos."}</p><button type="button" className="btn-secondary" onClick={temFiltro ? limparFiltros : abrirNovoServico}>{temFiltro ? "Limpar filtros" : "Cadastrar primeiro serviço"}</button></div>
        : <>
          <div className="hidden lg:block"><table className="data-table">
            <thead><tr><th scope="col">Serviço e escopo</th><th scope="col">Categoria</th><th scope="col" className="text-right">Preço base</th><th scope="col" className="text-right">Ações</th></tr></thead>
            <tbody>{servicosFiltrados.map((servico) => <tr key={servico.id}>
              <td><button type="button" className="record-primary text-left hover:underline" onClick={() => abrirEditarServico(servico)}>{servico.nome}</button><p className="record-meta max-w-lg line-clamp-2">{servico.descricao || "Escopo não informado"}</p></td>
              <td>{servico.categoria || <span className="record-meta">Sem categoria</span>}</td>
              <td className="text-right whitespace-nowrap tabular-nums"><strong>{formatarMoeda(servico.preco)}</strong></td>
              <td>{acoesServico(servico)}</td>
            </tr>)}</tbody>
          </table></div>
          <div className="mobile-records lg:hidden">{servicosFiltrados.map((servico) => <article key={servico.id} className="record-row">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><button type="button" className="record-primary text-left" onClick={() => abrirEditarServico(servico)}>{servico.nome}</button><p className="record-meta">{servico.categoria || "Sem categoria"}</p></div>{acoesServico(servico)}</div>
            <p className="mt-3 text-sm text-slate-600">{servico.descricao || "Escopo não informado"}</p>
            <div className="mt-4 flex justify-between gap-3"><span className="record-meta">Preço base</span><strong className="tabular-nums">{formatarMoeda(servico.preco)}</strong></div>
          </article>)}</div>
        </>}
        <ControlesPaginacao pagina={paginacao.pagina} totalPaginas={paginacao.totalPaginas} total={paginacao.total} tamanho={paginacao.tamanho} onAnterior={paginacao.anterior} onProxima={paginacao.proxima} onMudarTamanho={(tamanho) => { paginacao.setTamanho(tamanho); paginacao.setPagina(0); }} />
      </section>

      {mostrarFormulario && <Modal title={servicoEditando ? "Editar serviço" : "Novo serviço"} description="Defina o serviço que será oferecido nos seus orçamentos." onClose={fecharFormulario} busy={carregando} footer={<><button type="button" className="btn-secondary" onClick={fecharFormulario} disabled={carregando}>Cancelar</button><button type="submit" form="form_servico" className="btn-primary" disabled={carregando}>{carregando ? "Salvando…" : servicoEditando ? "Salvar alterações" : "Cadastrar serviço"}</button></>}>
        <form id="form_servico" onSubmit={salvarServico}>
          <section className="form-section"><h3>Serviço e escopo</h3><p>Deixe claro o que está incluído no trabalho.</p>
            <div className="space-y-4"><div><label htmlFor="servico_nome" className="field-label">Nome do serviço *</label><input id="servico_nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Instalação de tomada" className="input-base" required /></div>
            <div><label htmlFor="servico_categoria" className="field-label">Categoria</label><input id="servico_categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex.: Instalação" className="input-base" /></div>
            <div><label htmlFor="servico_descricao" className="field-label">Descrição do trabalho</label><textarea id="servico_descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva as atividades e o que está incluído." rows={4} className="input-base resize-y" /></div></div>
          </section>
          <section className="form-section"><h3>Preço de referência</h3><p>Valor base para a composição dos orçamentos.</p>
            <label htmlFor="servico_preco" className="field-label">Preço base (R$)</label><input id="servico_preco" type="text" inputMode="numeric" value={preco} onChange={(e) => setPreco(mascaraMoeda(e.target.value))} placeholder="0,00" className="input-base" />
          </section>
        </form>
      </Modal>}
      <ConfirmDialog aberto={servicoParaExcluir !== null} titulo="Excluir serviço?" descricao={<>Tem certeza que deseja excluir <strong>{servicoParaExcluir?.nome}</strong>? Esta ação não pode ser desfeita.</>} textoBotaoConfirmar="Excluir" corBotaoConfirmar="vermelho" carregando={excluindo} aoConfirmar={confirmarExclusao} aoCancelar={() => setServicoParaExcluir(null)} />
    </div>
  );
}
