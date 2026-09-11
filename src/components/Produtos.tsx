import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { Search, PackagePlus, Pencil, Trash2, History, Boxes, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { supabase } from "../supabase";
import {
  formatarMoeda,
  formatarInputMoeda,
  mascaraMoeda,
  mascaraNumero,
  converterNumero,
  margemLucro,
} from "../utils/formatters";
import ConfirmDialog from "./ConfirmDialog";
import Modal from "./ui/Modal";
import { useToast } from "./ui/toast";
import { usePaginacao } from "../hooks/usePaginacao";
import ControlesPaginacao from "./ui/ControlesPaginacao";

type Produto = {
  id: number;
  nome: string;
  categoria: string | null;
  unidade: string;
  preco_custo: number;
  preco_venda: number;
  estoque: number;
  estoque_minimo: number;
  codigo: string | null;
  fornecedor: string | null;
  user_id: string;
  created_at?: string;
};

export default function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [usuario, setUsuario] = useState<User | null>(null);
  const paginacao = usePaginacao(20);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [precoCusto, setPrecoCusto] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [estoque, setEstoque] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [fornecedor, setFornecedor] = useState("");

  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState("recentes");
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const [produtoEditando, setProdutoEditando] =
    useState<Produto | null>(null);
  const [produtoParaExcluir, setProdutoParaExcluir] =
    useState<Produto | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Movimentação de estoque
  const [produtoMovimentando, setProdutoMovimentando] =
    useState<Produto | null>(null);
  const [tipoMov, setTipoMov] = useState<"entrada" | "saida" | "ajuste">(
    "entrada"
  );
  const [qtdMov, setQtdMov] = useState("");
  const [obsMov, setObsMov] = useState("");
  const [salvandoMov, setSalvandoMov] = useState(false);

  // Histórico de movimentações
  const [produtoHistorico, setProdutoHistorico] = useState<Produto | null>(
    null
  );
  const [historico, setHistorico] = useState<
    Array<{
      id: number;
      tipo: string;
      quantidade: number;
      estoque_anterior: number;
      estoque_posterior: number;
      observacao: string | null;
      ordem_servico_id: number | null;
      created_at: string;
    }>
  >([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erroHistorico, setErroHistorico] = useState(false);

  const [filtroEstoqueBaixo, setFiltroEstoqueBaixo] =
    useState(false);

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

    // Auto-refresh quando volta para a aba
    function onFocus() {
      iniciar();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (usuario) carregarProdutos(usuario.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, paginacao.pagina, paginacao.tamanho]);

  async function carregarProdutos(userId: string) {
    setCarregandoLista(true);
    setErroLista(false);
    const de = paginacao.offset;
    const ate = de + paginacao.tamanho - 1;
    const { data, error, count } = await supabase
      .from("produtos")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("id", { ascending: false })
      .range(de, ate);

    setCarregandoLista(false);
    if (error) {
      setErroLista(true);
      console.error("Erro ao carregar produtos:", error);
      mostrarToast("Erro ao carregar produtos.", "erro");
      return;
    }

    setProdutos(data || []);
    paginacao.setTotal(count ?? 0);
  }

  function limparFormulario() {
    setNome("");
    setCategoria("");
    setUnidade("un");
    setPrecoCusto("");
    setPrecoVenda("");
    setEstoque("");
    setEstoqueMinimo("");
    setCodigo("");
    setFornecedor("");
    setProdutoEditando(null);
  }

  function abrirNovoProduto() {
    limparFormulario();
    setMostrarFormulario(true);
  }

  function abrirEditarProduto(produto: Produto) {
    setProdutoEditando(produto);
    setNome(produto.nome);
    setCategoria(produto.categoria || "");
    setUnidade(produto.unidade);
    setPrecoCusto(formatarInputMoeda(produto.preco_custo));
    setPrecoVenda(formatarInputMoeda(produto.preco_venda));
    setEstoque(String(produto.estoque).replace(".", ","));
    setEstoqueMinimo(
      String(produto.estoque_minimo).replace(".", ",")
    );
    setCodigo(produto.codigo || "");
    setFornecedor(produto.fornecedor || "");
    setMostrarFormulario(true);
  }

  async function salvarProduto(e: FormEvent) {
    e.preventDefault();

    if (!nome.trim()) {
      mostrarToast("Digite o nome do produto.", "alerta");
      return;
    }

    if (!usuario) {
      mostrarToast("Usuário não identificado.", "erro");
      return;
    }

    const custo = precoCusto ? converterNumero(precoCusto) : 0;
    const venda = precoVenda ? converterNumero(precoVenda) : 0;
    const estoqueAtual = estoque ? converterNumero(estoque) : 0;
    const estoqueMin = estoqueMinimo
      ? converterNumero(estoqueMinimo)
      : 0;

    if (isNaN(custo) || custo < 0) {
      mostrarToast("Digite um preço de custo válido.", "alerta");
      return;
    }

    if (isNaN(venda) || venda < 0) {
      mostrarToast("Digite um preço de venda válido.", "alerta");
      return;
    }

    if (isNaN(estoqueAtual) || estoqueAtual < 0) {
      mostrarToast("Digite um estoque válido.", "alerta");
      return;
    }

    if (isNaN(estoqueMin) || estoqueMin < 0) {
      mostrarToast(
        "Digite um estoque mínimo válido.",
        "alerta"
      );
      return;
    }

    setCarregando(true);

    const dados = {
      nome: nome.trim(),
      categoria: categoria.trim() || null,
      unidade,
      preco_custo: custo,
      preco_venda: venda,
      estoque: estoqueAtual,
      estoque_minimo: estoqueMin,
      codigo: codigo.trim() || null,
      fornecedor: fornecedor.trim() || null,
    };

    if (produtoEditando) {
      const { error } = await supabase
        .from("produtos")
        .update(dados)
        .eq("id", produtoEditando.id)
        .eq("user_id", usuario.id);

      if (error) {
        console.error("Erro ao editar produto:", error);
        mostrarToast("Erro ao editar produto.", "erro");
        setCarregando(false);
        return;
      }

      mostrarToast("Produto atualizado com sucesso!", "sucesso");
    } else {
      const { error } = await supabase
        .from("produtos")
        .insert({ ...dados, user_id: usuario.id });

      if (error) {
        console.error("Erro ao cadastrar produto:", error);
        mostrarToast("Erro ao cadastrar produto.", "erro");
        setCarregando(false);
        return;
      }

      mostrarToast("Produto cadastrado com sucesso!", "sucesso");
    }

    await carregarProdutos(usuario.id);

    limparFormulario();
    setMostrarFormulario(false);
    setCarregando(false);
  }

  async function confirmarExclusao() {
    if (!produtoParaExcluir || !usuario) return;

    setExcluindo(true);

    const { error } = await supabase
      .from("produtos")
      .delete()
      .eq("id", produtoParaExcluir.id)
      .eq("user_id", usuario.id);

    setExcluindo(false);

    if (error) {
      console.error("Erro ao excluir produto:", error);
      mostrarToast("Erro ao excluir produto.", "erro");
      return;
    }

    setProdutos((lista) =>
      lista.filter((p) => p.id !== produtoParaExcluir.id)
    );
    mostrarToast("Produto excluído com sucesso.", "sucesso");
    setProdutoParaExcluir(null);
  }

  function abrirMovimentacao(produto: Produto) {
    setProdutoMovimentando(produto);
    setTipoMov("entrada");
    setQtdMov("");
    setObsMov("");
  }

  function fecharMovimentacao() {
    setProdutoMovimentando(null);
    setQtdMov("");
    setObsMov("");
  }

  async function salvarMovimentacao() {
    if (!produtoMovimentando || !usuario) return;

    const quantidade = Number(qtdMov.replace(",", "."));
    if (!quantidade || quantidade <= 0) {
      mostrarToast("Digite uma quantidade válida.", "alerta");
      return;
    }

    setSalvandoMov(true);

    const { error } = await supabase.rpc(
      "atualizar_estoque_produto",
      {
        p_produto_id: produtoMovimentando.id,
        p_tipo: tipoMov,
        p_quantidade: quantidade,
        p_observacao: obsMov.trim() || null,
        p_ordem_servico_id: null,
      }
    );

    setSalvandoMov(false);

    if (error) {
      console.error("Erro ao movimentar estoque:", error);
      const mensagem =
        error.message.includes("Estoque insuficiente")
          ? "Estoque insuficiente para essa saída."
          : "Erro ao movimentar estoque.";
      mostrarToast(mensagem, "erro");
      return;
    }

    mostrarToast(
      `Estoque ${
        tipoMov === "entrada"
          ? "adicionado"
          : tipoMov === "saida"
          ? "removido"
          : "ajustado"
      } com sucesso!`,
      "sucesso"
    );

    fecharMovimentacao();
    await carregarProdutos(usuario.id);
  }

  async function abrirHistorico(produto: Produto) {
    setProdutoHistorico(produto);
    setCarregandoHistorico(true);
    setErroHistorico(false);

    const { data, error } = await supabase
      .from("estoque_movimentacoes")
      .select(
        "id, tipo, quantidade, estoque_anterior, estoque_posterior, observacao, ordem_servico_id, created_at"
      )
      .eq("user_id", usuario!.id)
      .eq("produto_id", produto.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setCarregandoHistorico(false);

    if (error) {
      setErroHistorico(true);
      console.error("Erro ao carregar histórico:", error);
      mostrarToast("Erro ao carregar histórico.", "erro");
      setHistorico([]);
      return;
    }

    setHistorico(data || []);
  }

  function fecharHistorico() {
    setProdutoHistorico(null);
    setHistorico([]);
  }

  const produtosEstoqueBaixo = produtos.filter(
    (p) => p.estoque <= p.estoque_minimo
  );

  const valorEstoque = produtos.reduce(
    (total, p) => total + p.estoque * p.preco_custo,
    0
  );

  const produtosFiltrados = produtos.filter((produto) => {
    const termo = busca.toLowerCase().trim();
    if (filtroEstoqueBaixo) {
      if (produto.estoque > produto.estoque_minimo) return false;
    }
    if (!termo) return true;
    return (
      produto.nome.toLowerCase().includes(termo) ||
      (produto.categoria || "")
        .toLowerCase()
        .includes(termo) ||
      (produto.codigo || "")
        .toLowerCase()
        .includes(termo) ||
      (produto.fornecedor || "")
        .toLowerCase()
        .includes(termo)
    );
  }).sort((a, b) => ordenacao === "nome" ? a.nome.localeCompare(b.nome, "pt-BR") : ordenacao === "estoque" ? a.estoque - b.estoque : b.id - a.id);


  function estoqueBaixo(produto: Produto) {
    return produto.estoque <= produto.estoque_minimo;
  }

  function fecharFormulario() {
    limparFormulario();
    setMostrarFormulario(false);
  }

  function acoesProduto(produto: Produto) {
    return <div className="row-actions">
      <button type="button" className="icon-button" onClick={() => abrirMovimentacao(produto)} aria-label={"Movimentar estoque de " + produto.nome} title="Movimentar estoque"><Boxes size={17} aria-hidden="true" /></button>
      <button type="button" className="icon-button" onClick={() => abrirHistorico(produto)} aria-label={"Ver histórico de " + produto.nome} title="Histórico de movimentações"><History size={17} aria-hidden="true" /></button>
      <button type="button" className="icon-button" onClick={() => abrirEditarProduto(produto)} aria-label={"Editar " + produto.nome} title="Editar produto"><Pencil size={17} aria-hidden="true" /></button>
      <button type="button" className="icon-button" onClick={() => setProdutoParaExcluir(produto)} aria-label={"Excluir " + produto.nome} title="Excluir produto"><Trash2 size={17} aria-hidden="true" /></button>
    </div>;
  }

  const temFiltro = Boolean(busca || filtroEstoqueBaixo);
  function limparFiltros() { setBusca(""); setFiltroEstoqueBaixo(false); }

  return (
    <div className="product-page">
      <header className="page-header">
        <div><h1>Produtos</h1><p>Materiais, preços e disponibilidade para cada serviço.</p></div>
        <div className="page-actions"><button type="button" onClick={abrirNovoProduto} className="btn-primary"><PackagePlus size={18} aria-hidden="true" />Novo produto</button></div>
      </header>
      <div className="metric-strip">
        <div className="metric"><label>No catálogo</label><strong>{paginacao.total}</strong><small>produtos cadastrados</small></div>
        <div className="metric"><label>Estoque baixo</label><strong>{produtosEstoqueBaixo.length}</strong><small>itens nesta página</small></div>
        <div className="metric"><label>Valor em estoque</label><strong>{formatarMoeda(valorEstoque)}</strong><small>custo dos itens nesta página</small></div>
      </div>

      <section className="data-panel" aria-label="Catálogo de materiais">
        <div className="data-toolbar">
          <div className="relative min-w-0 flex-1"><label htmlFor="busca_produto" className="sr-only">Buscar produto nesta página</label><Search size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" /><input id="busca_produto" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, categoria, código ou fornecedor" className="input-base !pl-10" /></div>
          <div className="filter-tabs" aria-label="Filtrar disponibilidade nesta página"><button type="button" aria-pressed={!filtroEstoqueBaixo} onClick={() => setFiltroEstoqueBaixo(false)}>Todos</button><button type="button" aria-pressed={filtroEstoqueBaixo} onClick={() => setFiltroEstoqueBaixo(true)}>Estoque baixo <span>{produtosEstoqueBaixo.length}</span></button></div>
          <div><label htmlFor="ordem_produto" className="sr-only">Ordenar produtos nesta página</label><select id="ordem_produto" value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)} className="input-base"><option value="recentes">Mais recentes</option><option value="nome">Nome: A a Z</option><option value="estoque">Menor estoque</option></select></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-5 py-3"><p className="record-meta" aria-live="polite">{produtosFiltrados.length} resultados nesta página. Busca, filtros e ordenação se aplicam aos itens exibidos.</p>{temFiltro && <button type="button" className="btn-secondary" onClick={limparFiltros}>Limpar filtros</button>}</div>
        {erroLista ? <div className="empty-state" role="alert"><h3>Não foi possível carregar os produtos</h3><p>Tente novamente para consultar materiais e estoque.</p><button type="button" className="btn-secondary" onClick={() => usuario && carregarProdutos(usuario.id)}>Tentar novamente</button></div>
        : carregandoLista ? <div className="empty-state" role="status">Carregando produtos…</div>
        : produtosFiltrados.length === 0 ? <div className="empty-state"><h3>{temFiltro ? "Nenhum produto com estes filtros" : "Tenha seus materiais sob controle"}</h3><p>{temFiltro ? "Ajuste a busca ou consulte outra página do catálogo." : "Cadastre materiais, preços e estoque para preparar seus próximos serviços."}</p><button type="button" className="btn-secondary" onClick={temFiltro ? limparFiltros : abrirNovoProduto}>{temFiltro ? "Limpar filtros" : "Cadastrar primeiro produto"}</button></div>
        : <>
          <div className="hidden xl:block"><table className="data-table">
            <thead><tr><th scope="col">Material</th><th scope="col">Estoque disponível</th><th scope="col" className="text-right">Preço de venda</th><th scope="col" className="text-right">Ações</th></tr></thead>
            <tbody>{produtosFiltrados.map((produto) => <tr key={produto.id}>
              <td><button type="button" className="record-primary text-left hover:underline" onClick={() => abrirEditarProduto(produto)}>{produto.nome}</button><p className="record-meta">{produto.codigo || "Produto #" + produto.id}{produto.categoria ? " · " + produto.categoria : ""}</p>{produto.fornecedor && <p className="record-meta">{produto.fornecedor}</p>}</td>
              <td><div className="flex flex-wrap items-center gap-2"><strong className="tabular-nums">{produto.estoque} {produto.unidade}</strong>{estoqueBaixo(produto) && <span className="status-label" data-tone="warning">Estoque baixo</span>}</div><p className="record-meta">Mínimo: {produto.estoque_minimo} {produto.unidade}</p></td>
              <td className="text-right whitespace-nowrap tabular-nums"><strong>{formatarMoeda(produto.preco_venda)}</strong><p className="record-meta">Custo {formatarMoeda(produto.preco_custo)}</p><p className="record-meta">Margem {margemLucro(produto.preco_venda, produto.preco_custo).toFixed(0)}%</p></td>
              <td>{acoesProduto(produto)}</td>
            </tr>)}</tbody>
          </table></div>
          <div className="mobile-records xl:hidden">{produtosFiltrados.map((produto) => <article key={produto.id} className="record-row">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><button type="button" className="record-primary text-left" onClick={() => abrirEditarProduto(produto)}>{produto.nome}</button><p className="record-meta">{produto.codigo || "Produto #" + produto.id}</p><p className="record-meta">{produto.categoria || "Sem categoria"}{produto.fornecedor ? " · " + produto.fornecedor : ""}</p></div>{estoqueBaixo(produto) && <span className="status-label shrink-0" data-tone="warning">Estoque baixo</span>}</div>
            <div className="my-4 grid grid-cols-2 gap-4"><div><p className="record-meta">Estoque disponível</p><strong className="tabular-nums">{produto.estoque} {produto.unidade}</strong><p className="record-meta">Mínimo {produto.estoque_minimo} {produto.unidade}</p></div><div className="text-right"><p className="record-meta">Preço de venda</p><strong className="tabular-nums">{formatarMoeda(produto.preco_venda)}</strong><p className="record-meta">Custo {formatarMoeda(produto.preco_custo)}</p><p className="record-meta">Margem {margemLucro(produto.preco_venda, produto.preco_custo).toFixed(0)}%</p></div></div>
            <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-2"><span className="record-meta">Gerenciar material</span>{acoesProduto(produto)}</div>
          </article>)}</div>
        </>}
        <ControlesPaginacao pagina={paginacao.pagina} totalPaginas={paginacao.totalPaginas} total={paginacao.total} tamanho={paginacao.tamanho} onAnterior={paginacao.anterior} onProxima={paginacao.proxima} onMudarTamanho={(tamanho) => { paginacao.setTamanho(tamanho); paginacao.setPagina(0); }} />
      </section>

      {mostrarFormulario && <Modal title={produtoEditando ? "Editar produto" : "Novo produto"} description="Cadastre o material e organize seus preços e estoque." onClose={fecharFormulario} busy={carregando} wide footer={<><button type="button" className="btn-secondary" onClick={fecharFormulario} disabled={carregando}>Cancelar</button><button type="submit" form="form_produto" className="btn-primary" disabled={carregando}>{carregando ? "Salvando…" : produtoEditando ? "Salvar alterações" : "Cadastrar produto"}</button></>}>
        <form id="form_produto" onSubmit={salvarProduto}>
          <section className="form-section"><h3>Identificação do material</h3><p>Dados para encontrar o produto no catálogo e nos orçamentos.</p>
            <div className="space-y-4"><div><label htmlFor="produto_nome" className="field-label">Nome do produto *</label><input id="produto_nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Cabo flexível 2,5 mm²" className="input-base" required /></div>
            <div className="form-grid"><div><label htmlFor="produto_categoria" className="field-label">Categoria</label><input id="produto_categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex.: Cabos" className="input-base" /></div><div><label htmlFor="produto_codigo" className="field-label">Código / SKU</label><input id="produto_codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: CAB25" className="input-base" /></div></div>
            <div className="form-grid"><div><label htmlFor="produto_unidade" className="field-label">Unidade *</label><select id="produto_unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} className="input-base"><option value="un">Unidade (un)</option><option value="m">Metro (m)</option><option value="cm">Centímetro (cm)</option><option value="kg">Quilograma (kg)</option><option value="g">Grama (g)</option><option value="l">Litro (L)</option><option value="caixa">Caixa</option><option value="rolo">Rolo</option><option value="peca">Peça</option></select></div><div><label htmlFor="produto_fornecedor" className="field-label">Fornecedor</label><input id="produto_fornecedor" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" className="input-base" /></div></div></div>
          </section>
          <section className="form-section"><h3>Composição de preço</h3><p>Valores de custo e venda por unidade do material.</p>
            <div className="form-grid"><div><label htmlFor="produto_custo" className="field-label">Preço de custo (R$)</label><input id="produto_custo" type="text" inputMode="numeric" value={precoCusto} onChange={(e) => setPrecoCusto(mascaraMoeda(e.target.value))} placeholder="0,00" className="input-base" /></div><div><label htmlFor="produto_venda" className="field-label">Preço de venda (R$)</label><input id="produto_venda" type="text" inputMode="numeric" value={precoVenda} onChange={(e) => setPrecoVenda(mascaraMoeda(e.target.value))} placeholder="0,00" className="input-base" /></div></div>
          </section>
          <section className="form-section"><h3>Controle de estoque</h3><p>O estoque mínimo define quando o material precisa de atenção.</p>
            <div className="form-grid"><div><label htmlFor="produto_estoque" className="field-label">Estoque atual</label><input id="produto_estoque" type="text" inputMode="decimal" value={estoque} onChange={(e) => setEstoque(mascaraNumero(e.target.value))} placeholder="Ex.: 150" className="input-base" /></div><div><label htmlFor="produto_estoque_minimo" className="field-label">Estoque mínimo</label><input id="produto_estoque_minimo" type="text" inputMode="decimal" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(mascaraNumero(e.target.value))} placeholder="Ex.: 30" className="input-base" /></div></div>
          </section>
        </form>
      </Modal>}

      <ConfirmDialog aberto={produtoParaExcluir !== null} titulo="Excluir produto?" descricao={<>Tem certeza que deseja excluir <strong>{produtoParaExcluir?.nome}</strong>? Esta ação não pode ser desfeita.</>} textoBotaoConfirmar="Excluir" corBotaoConfirmar="vermelho" carregando={excluindo} aoConfirmar={confirmarExclusao} aoCancelar={() => setProdutoParaExcluir(null)} />

      {produtoMovimentando && <Modal title="Movimentar estoque" description={produtoMovimentando.nome} onClose={fecharMovimentacao} busy={salvandoMov} footer={<><button type="button" className="btn-secondary" onClick={fecharMovimentacao} disabled={salvandoMov}>Cancelar</button><button type="submit" form="form_movimento" className="btn-primary" disabled={salvandoMov}>{salvandoMov ? "Salvando…" : "Confirmar movimentação"}</button></>}>
        <div className="metric-strip"><div className="metric"><label>Estoque atual</label><strong>{produtoMovimentando.estoque} {produtoMovimentando.unidade}</strong><small>{produtoMovimentando.nome}</small></div></div>
        <form id="form_movimento" onSubmit={(e) => { e.preventDefault(); void salvarMovimentacao(); }}>
          <section className="form-section"><h3>Movimentação</h3><p>Escolha como esta movimentação afeta o estoque atual.</p>
            <fieldset><legend className="field-label">Tipo de movimentação</legend><div className="filter-tabs grid grid-cols-3">
              <button type="button" onClick={() => setTipoMov("entrada")} aria-pressed={tipoMov === "entrada"}><ArrowDownToLine size={16} aria-hidden="true" />Entrada</button>
              <button type="button" onClick={() => setTipoMov("saida")} aria-pressed={tipoMov === "saida"}><ArrowUpFromLine size={16} aria-hidden="true" />Saída</button>
              <button type="button" onClick={() => setTipoMov("ajuste")} aria-pressed={tipoMov === "ajuste"}><Boxes size={16} aria-hidden="true" />Ajuste</button>
            </div></fieldset>
            <div className="mt-5"><label htmlFor="mov_qtd" className="field-label">{tipoMov === "ajuste" ? "Estoque final desejado" : "Quantidade"} ({produtoMovimentando.unidade})</label><input id="mov_qtd" type="text" inputMode="decimal" value={qtdMov} onChange={(e) => setQtdMov(e.target.value)} placeholder="Ex.: 10" className="input-base" aria-describedby="mov_qtd_ajuda" /><p id="mov_qtd_ajuda" className="record-meta mt-2">{tipoMov === "entrada" ? "Será somado ao estoque atual." : tipoMov === "saida" ? "Será subtraído do estoque atual." : "O estoque será definido exatamente neste valor."}</p></div>
          </section>
          <section className="form-section"><h3>Registro</h3><p>A observação fica disponível no histórico do material.</p><label htmlFor="mov_obs" className="field-label">Observação</label><textarea id="mov_obs" value={obsMov} onChange={(e) => setObsMov(e.target.value)} rows={3} placeholder="Ex.: Compra do fornecedor ou ajuste de inventário" className="input-base resize-y" /></section>
        </form>
      </Modal>}

      {produtoHistorico && <Modal title="Histórico de movimentações" description={produtoHistorico.nome + " — últimas 50 movimentações"} onClose={fecharHistorico} wide footer={<button type="button" className="btn-secondary" onClick={fecharHistorico}>Fechar histórico</button>}>
        {carregandoHistorico ? <div className="empty-state" role="status">Carregando movimentações…</div>
        : erroHistorico ? <div className="empty-state" role="alert"><h3>Não foi possível carregar o histórico</h3><p>Tente novamente para consultar as movimentações.</p><button type="button" className="btn-secondary" onClick={() => abrirHistorico(produtoHistorico)}>Tentar novamente</button></div>
        : historico.length === 0 ? <div className="empty-state"><h3>Sem movimentações registradas</h3><p>As entradas, saídas e ajustes deste produto aparecerão aqui.</p></div>
        : <ol className="divide-y divide-[var(--color-border)]">{historico.map((mov) => <li key={mov.id} className="py-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="status-label" data-tone={mov.tipo === "entrada" ? "success" : mov.tipo === "saida" ? "warning" : undefined}>{mov.tipo === "entrada" ? "Entrada" : mov.tipo === "saida" ? "Saída" : "Ajuste"}</span><strong className="ml-3 tabular-nums">{mov.quantidade} {produtoHistorico.unidade}</strong></div><time className="record-meta" dateTime={mov.created_at}>{new Date(mov.created_at).toLocaleString("pt-BR")}</time></div>
          <p className="mt-3 text-sm">Estoque: <strong className="tabular-nums">{mov.estoque_anterior} → {mov.estoque_posterior} {produtoHistorico.unidade}</strong></p>
          {mov.observacao && <p className="record-meta mt-1">{mov.observacao}</p>}{mov.ordem_servico_id && <p className="record-meta mt-1">Ordem de serviço #{mov.ordem_servico_id}</p>}
        </li>)}</ol>}
      </Modal>}
    </div>
  );
}
