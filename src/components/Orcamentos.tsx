import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { STATUS_ORCAMENTO, STATUS_ORCAMENTO_VALORES, formatarNumero, type StatusOrcamento } from "../utils/constantes";
import { supabase } from "../supabase";
import { usePaginacao } from "../hooks/usePaginacao";
import ControlesPaginacao from "./ui/ControlesPaginacao";
import { formatarMoeda, formatarData } from "../utils/formatters";
import {
  FilePlus,
  FileText,
  Pencil,
  Trash2,
  Loader2,
  Search,
  MoreHorizontal,
} from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./ui/toast";
import { useEmpresa } from "../contexts/EmpresaContext";
import Modal from "./ui/Modal";
type Cliente = {
  id: number;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  email: string | null;
};

type Servico = {
  id: number;
  nome: string;
  preco: number;
};

type Produto = {
  id: number;
  nome: string;
  preco_venda: number;
  unidade: string;
  estoque?: number;
  estoque_minimo?: number;
};

type ItemOrcamento = {
  id: string;
  tipo: "servico" | "produto";
  servico_id?: number;
  produto_id?: number;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
};

type Orcamento = {
  id: number;
  numero: number;
  cliente_id: number;
  data_orcamento: string;
  validade: string | null;
  status: string;
  desconto: number;
  valor_total: number;
  observacoes: string | null;
};

// Cache de logos é por instância do componente (useRef) para não vazar
// entre usuários/empresas diferentes nem reter logos desatualizadas.
type LogoCache = { url: string; data: Promise<string> } | null;

type LogoResult = { data: Promise<string>; nextCache: LogoCache };

function getLogoFromUrl(url: string, cache: LogoCache): LogoResult {
  if (cache && cache.url === url) {
    return { data: cache.data, nextCache: cache };
  }

  const promise = new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas indisponível."));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Logo não pôde ser carregada."));
    img.src = url;
  });

  return { data: promise, nextCache: { url, data: promise } };
}

// Fallback para /logo.png do projeto
const FALLBACK_LOGO_URL = "/logo.png";

type OrcamentosProps = {
  setPagina: (pagina: string) => void;
  abrirAoMontar?: boolean;
};

function Orcamentos({ setPagina, abrirAoMontar = false }: OrcamentosProps) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const { empresa } = useEmpresa();
  const logoCacheRef = useRef<LogoCache>(null);
  const paginacao = usePaginacao(20);

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [ordenacao, setOrdenacao] = useState("numero");

  const [modalAberto, setModalAberto] = useState(abrirAoMontar);
  const modalRef = useRef<HTMLDivElement>(null);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erroDados, setErroDados] = useState(false);
  const [orcamentoEditando, setOrcamentoEditando] =
  useState<Orcamento | null>(null);

  const [orcamentoParaExcluir, setOrcamentoParaExcluir] =
    useState<Orcamento | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [gerandoPDF, setGerandoPDF] = useState<number | null>(null);

  const { mostrarToast } = useToast();

  const [clienteId, setClienteId] = useState("");
  const [dataOrcamento, setDataOrcamento] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [validade, setValidade] = useState("");
  const [status, setStatus] = useState<StatusOrcamento>(STATUS_ORCAMENTO.PENDENTE);
  const [desconto, setDesconto] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [tipoItem, setTipoItem] = useState<"servico" | "produto">("servico");
  const [itemSelecionado, setItemSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState("1");

  const [itens, setItens] = useState<ItemOrcamento[]>([]);

  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!modalAberto) return;
    const focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.querySelector<HTMLSelectElement>("#orc_cliente")?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflowAnterior;
      if (focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true });
    };
  }, [modalAberto]);

  // Visualização
  const [orcamentoVisualizado, setOrcamentoVisualizado] =
    useState<Orcamento | null>(null);

  const [itensVisualizados, setItensVisualizados] =
    useState<ItemOrcamento[]>([]);

  const [carregandoVisualizacao, setCarregandoVisualizacao] =
    useState(false);

  const [osVinculada, setOsVinculada] = useState<{
    id: number;
    numero: number;
    status: string;
  } | null>(null);

  useEffect(() => {
    async function carregarUsuario() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUsuario(user);
    }

    carregarUsuario();
  }, []);

  useEffect(() => {
    if (usuario) carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, paginacao.pagina, paginacao.tamanho]);

  async function carregarDados() {
    if (!usuario) return;
    setCarregandoDados(true);
    setErroDados(false);

    const [clientesResult, servicosResult, produtosResult, orcamentosResult] =
      await Promise.all([
        supabase
          .from("clientes")
          .select("id, nome, telefone, endereco, email")
          .eq("user_id", usuario.id)
          .order("nome"),

        supabase
          .from("servicos")
          .select("id, nome, preco")
          .eq("user_id", usuario.id)
          .order("nome"),

        supabase
          .from("produtos")
          .select("id, nome, preco_venda, unidade")
          .eq("user_id", usuario.id)
          .order("nome"),

       supabase
  .from("orcamentos")
  .select(`
    id,
    numero,
    cliente_id,
    data_orcamento,
    validade,
    status,
    desconto,
    valor_total,
    observacoes
  `, { count: "exact" })
  .eq("user_id", usuario.id)
  .order("numero", { ascending: false })
  .range(paginacao.offset, paginacao.offset + paginacao.tamanho - 1),
      ]);

    if ([clientesResult, servicosResult, produtosResult, orcamentosResult].some((res) => res.error)) {
      setErroDados(true);
      setCarregandoDados(false);
      return;
    }
    setCarregandoDados(false);

    setClientes(clientesResult.data || []);
    setServicos(servicosResult.data || []);
    setProdutos(produtosResult.data || []);
    setOrcamentos((orcamentosResult.data as Orcamento[]) || []);
    paginacao.setTotal(orcamentosResult.count ?? 0);
  }

  function adicionarItem() {
    if (!itemSelecionado) {
      mostrarToast("Selecione um item.", "alerta");
      return;
    }

    const qtd = Number(quantidade);

    if (!qtd || qtd <= 0) {
      mostrarToast("Digite uma quantidade válida.", "alerta");
      return;
    }

    if (tipoItem === "servico") {
      const servico = servicos.find(
        (item) => item.id === Number(itemSelecionado)
      );

      if (!servico) return;

      const novoItem: ItemOrcamento = {
        id: crypto.randomUUID(),
        tipo: "servico",
        servico_id: servico.id,
        descricao: servico.nome,
        quantidade: qtd,
        valor_unitario: Number(servico.preco),
        subtotal: qtd * Number(servico.preco),
      };

      setItens((itensAtuais) => [...itensAtuais, novoItem]);
    } else {
      const produto = produtos.find(
        (item) => item.id === Number(itemSelecionado)
      );

      if (!produto) return;

      // Validação de estoque (não bloqueia, mas avisa)
      const estoqueApos = Number(produto.estoque) - qtd;
      if (estoqueApos < 0) {
        mostrarToast(
          `Estoque insuficiente. Disponível: ${produto.estoque} ${produto.unidade}`,
          "erro"
        );
        return;
      }
      if (estoqueApos <= Number(produto.estoque_minimo)) {
        mostrarToast(
          `Atenção: este item deixará o estoque baixo (${estoqueApos} ${produto.unidade} restantes).`,
          "alerta"
        );
      }

      const novoItem: ItemOrcamento = {
        id: crypto.randomUUID(),
        tipo: "produto",
        produto_id: produto.id,
        descricao: produto.nome,
        quantidade: qtd,
        valor_unitario: Number(produto.preco_venda),
        subtotal: qtd * Number(produto.preco_venda),
      };

      setItens((itensAtuais) => [...itensAtuais, novoItem]);
    }

    setItemSelecionado("");
    setQuantidade("1");
  }

  function removerItem(id: string) {
    setItens((itensAtuais) =>
      itensAtuais.filter((item) => item.id !== id)
    );
  }

  const subtotal = useMemo(
    () => itens.reduce((total, item) => total + item.subtotal, 0),
    [itens]
  );

  const valorDesconto = Number(desconto) || 0;

  const valorTotal = Math.max(subtotal - valorDesconto, 0);

  function abrirNovoOrcamento() {
  setOrcamentoEditando(null);

  setClienteId("");
  setDataOrcamento(new Date().toISOString().split("T")[0]);
  setValidade("");
  setStatus(STATUS_ORCAMENTO.PENDENTE);
  setDesconto("");
  setObservacoes("");
  setItens([]);
  setTipoItem("servico");
  setItemSelecionado("");
  setQuantidade("1");

  setModalAberto(true);
}

async function editarOrcamento(orcamento: Orcamento) {
  if (!usuario) return;

  setSalvando(true);

  try {
    const { data, error } = await supabase
      .from("orcamento_itens")
      .select(`
        id,
        tipo,
        servico_id,
        produto_id,
        descricao,
        quantidade,
        valor_unitario,
        subtotal
      `)
      .eq("orcamento_id", orcamento.id)
      .eq("user_id", usuario.id)
      .order("id");

    if (error) {
      console.error("Erro ao carregar itens:", error);
      mostrarToast(
        "Erro ao carregar os itens do orçamento.",
        "erro"
      );
      return;
    }

    setOrcamentoEditando(orcamento);

    setClienteId(String(orcamento.cliente_id));
    setDataOrcamento(orcamento.data_orcamento);
    setValidade(orcamento.validade || "");
    setStatus(orcamento.status as StatusOrcamento);
    setDesconto(String(orcamento.desconto || ""));
    setObservacoes(orcamento.observacoes || "");

    setItens(
      (data || []).map((item) => ({
        id: String(item.id),
        tipo: item.tipo,
        servico_id: item.servico_id || undefined,
        produto_id: item.produto_id || undefined,
        descricao: item.descricao,
        quantidade: Number(item.quantidade),
        valor_unitario: Number(item.valor_unitario),
        subtotal: Number(item.subtotal),
      }))
    );

    setTipoItem("servico");
    setItemSelecionado("");
    setQuantidade("1");

    setModalAberto(true);
  } catch (error) {
    console.error("Erro ao editar orçamento:", error);
    mostrarToast("Erro ao carregar orçamento.", "erro");
  } finally {
    setSalvando(false);
  }
}

  async function salvarOrcamento() {
  if (!usuario) {
    mostrarToast("Usuário não identificado.", "erro");
    return;
  }

  if (!clienteId) {
    mostrarToast("Selecione um cliente.", "alerta");
    return;
  }

  if (itens.length === 0) {
    mostrarToast(
      "Adicione pelo menos um item ao orçamento.",
      "alerta"
    );
    return;
  }

  setSalvando(true);

  try {
    // ==========================================
    // EDITANDO ORÇAMENTO EXISTENTE
    // ==========================================

    if (orcamentoEditando) {
      const { error: erroOrcamento } = await supabase
        .from("orcamentos")
        .update({
          cliente_id: Number(clienteId),
          data_orcamento: dataOrcamento,
          validade: validade || null,
          status,
          desconto: valorDesconto,
          valor_total: valorTotal,
          observacoes: observacoes.trim() || null,
        })
        .eq("id", orcamentoEditando.id)
        .eq("user_id", usuario.id);

      if (erroOrcamento) {
        throw erroOrcamento;
      }

      // Remove os itens antigos
      const { error: erroExcluirItens } = await supabase
        .from("orcamento_itens")
        .delete()
        .eq("orcamento_id", orcamentoEditando.id)
        .eq("user_id", usuario.id);

      if (erroExcluirItens) {
        throw erroExcluirItens;
      }

      // Insere novamente os itens atualizados
      const itensParaSalvar = itens.map((item) => ({
        orcamento_id: orcamentoEditando.id,
        tipo: item.tipo,
        servico_id: item.servico_id || null,
        produto_id: item.produto_id || null,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        subtotal: item.subtotal,
        user_id: usuario.id,
      }));

      const { error: erroItens } = await supabase
        .from("orcamento_itens")
        .insert(itensParaSalvar);

      if (erroItens) {
        throw erroItens;
      }

      mostrarToast(
        `Orçamento #${orcamentoEditando.numero} atualizado com sucesso.`,
        "sucesso"
      );

      setModalAberto(false);
      setOrcamentoEditando(null);

      await carregarDados();

      return;
    }

    // ==========================================
    // CRIANDO NOVO ORÇAMENTO
    // ==========================================

    const { data: ultimoOrcamento, error: erroNumero } =
      await supabase
        .from("orcamentos")
        .select("numero")
        .eq("user_id", usuario.id)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (erroNumero) {
      throw erroNumero;
    }

    const proximoNumero = (ultimoOrcamento?.numero || 0) + 1;

    const { data: novoOrcamento, error: erroOrcamento } =
      await supabase
        .from("orcamentos")
        .insert({
          numero: proximoNumero,
          cliente_id: Number(clienteId),
          data_orcamento: dataOrcamento,
          validade: validade || null,
          status,
          desconto: valorDesconto,
          valor_total: valorTotal,
          observacoes: observacoes.trim() || null,
          user_id: usuario.id,
        })
        .select()
        .single();

    if (erroOrcamento) {
      throw erroOrcamento;
    }

    const itensParaSalvar = itens.map((item) => ({
      orcamento_id: novoOrcamento.id,
      tipo: item.tipo,
      servico_id: item.servico_id || null,
      produto_id: item.produto_id || null,
      descricao: item.descricao,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      subtotal: item.subtotal,
      user_id: usuario.id,
    }));

    const { error: erroItens } = await supabase
      .from("orcamento_itens")
      .insert(itensParaSalvar);

    if (erroItens) {
      await supabase
        .from("orcamentos")
        .delete()
        .eq("id", novoOrcamento.id)
        .eq("user_id", usuario.id);

      throw erroItens;
    }

    mostrarToast(
      `Orçamento #${proximoNumero} criado com sucesso.`,
      "sucesso"
    );

    setModalAberto(false);

    await carregarDados();
  } catch (error) {
    console.error("Erro ao salvar orçamento:", error);
    mostrarToast("Erro ao salvar orçamento.", "erro");
  } finally {
    setSalvando(false);
  }
}

  async function visualizarOrcamento(orcamento: Orcamento) {
    if (!usuario) return;

    setCarregandoVisualizacao(true);
    setItensVisualizados([]);
    setOrcamentoVisualizado(orcamento);
    setOsVinculada(null);

    const [itensRes, osRes] = await Promise.all([
      supabase
        .from("orcamento_itens")
        .select(`
          id,
          tipo,
          servico_id,
          produto_id,
          descricao,
          quantidade,
          valor_unitario,
          subtotal
        `)
        .eq("orcamento_id", orcamento.id)
        .eq("user_id", usuario.id)
        .order("id"),
      supabase
        .from("ordens_servico")
        .select("id, numero, status")
        .eq("orcamento_id", orcamento.id)
        .eq("user_id", usuario.id)
        .maybeSingle(),
    ]);

    const data = itensRes.data;
    const error = itensRes.error;

    if (error) {
      console.error("Erro ao carregar itens:", error);
      mostrarToast(
        "Erro ao carregar os itens do orçamento.",
        "erro"
      );
      setOrcamentoVisualizado(null);
      setItensVisualizados([]);
      setCarregandoVisualizacao(false);
      return;
    }

    setItensVisualizados((data as ItemOrcamento[]) || []);
    setOsVinculada(osRes.data);
    setCarregandoVisualizacao(false);
  }

  function fecharVisualizacao() {
    setOrcamentoVisualizado(null);
    setItensVisualizados([]);
    setOsVinculada(null);
    setCarregandoVisualizacao(false);
  }

  async function confirmarExclusao() {
    if (!orcamentoParaExcluir || !usuario) return;

    setExcluindo(true);

    const { error } = await supabase
      .from("orcamentos")
      .delete()
      .eq("id", orcamentoParaExcluir.id)
      .eq("user_id", usuario.id);

    setExcluindo(false);

    if (error) {
      console.error("Erro ao excluir orçamento:", error);
      mostrarToast("Erro ao excluir orçamento.", "erro");
      return;
    }

    setOrcamentos((lista) =>
      lista.filter(
        (orcamento) => orcamento.id !== orcamentoParaExcluir.id
      )
    );
    mostrarToast(
      `Orçamento #${formatarNumero(orcamentoParaExcluir.numero)} excluído com sucesso.`,
      "sucesso"
    );
    setOrcamentoParaExcluir(null);
  }

  async function gerarPDF(orcamento: Orcamento) {
  if (!usuario) return;

  setGerandoPDF(orcamento.id);
  try {
    const { data: itensPDF, error } = await supabase
      .from("orcamento_itens")
      .select(`
        tipo,
        descricao,
        quantidade,
        valor_unitario,
        subtotal
      `)
      .eq("orcamento_id", orcamento.id)
      .eq("user_id", usuario.id)
      .order("id");

    if (error) {
      console.error("Erro ao buscar itens para PDF:", error);
      mostrarToast("Erro ao gerar PDF.", "erro");
      return;
    }

   const clienteCompleto = clientes.find(
  (c) => c.id === orcamento.cliente_id
);

const cliente = clienteCompleto?.nome || "Cliente";

    const [{ jsPDF }, autoTableModule] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = autoTableModule.default;
    const doc = new jsPDF();

    // =========================
    // CORES
    // =========================
    const azulEscuro: [number, number, number] = [13, 27, 42];
    const amarelo: [number, number, number] = [255, 214, 10];
    const cinzaTexto: [number, number, number] = [90, 90, 90];
    const cinzaClaro: [number, number, number] = [245, 246, 248];

    // =========================
    // LOGO
    // =========================
    // Define a URL da logo: prioriza a da empresa, depois o fallback padrão
    const logoUrl = empresa?.logo_url || FALLBACK_LOGO_URL;
    const { data: logoBase64Promise, nextCache } = getLogoFromUrl(
      logoUrl,
      logoCacheRef.current
    );
    logoCacheRef.current = nextCache;
    const logoBase64 = await logoBase64Promise;

    // =========================
    // CABEÇALHO (fundo escuro)
    // =========================

    doc.setFillColor(
      azulEscuro[0],
      azulEscuro[1],
      azulEscuro[2]
    );

    doc.rect(0, 0, 210, 42, "F");

    // Logo SOBRE o fundo escuro (única renderização)
    doc.addImage(
      logoBase64,
      "PNG",
      15,
      7,
      38,
      28
    );

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);

    doc.text(
      (empresa?.nome || "Portal Elétrico").toUpperCase(),
      60,
      17
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    doc.text(
      empresa?.slogan || "Gestão para eletricistas",
      60,
      24
    );

    doc.text(
      `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
      60,
      30
    );

    // =========================
    // TÍTULO
    // =========================

    doc.setTextColor(
      azulEscuro[0],
      azulEscuro[1],
      azulEscuro[2]
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);

    doc.text(
      "ORÇAMENTO DE SERVIÇOS ELÉTRICOS",
      105,
      55,
      { align: "center" }
    );

    // Linha amarela
    doc.setFillColor(
      amarelo[0],
      amarelo[1],
      amarelo[2]
    );

    doc.rect(
      78,
      59,
      54,
      2,
      "F"
    );

    // =========================
    // DADOS DO ORÇAMENTO
    // =========================

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");

    doc.text(
      `ORÇAMENTO Nº ${formatarNumero(orcamento.numero)}`,
      20,
      72
    );

    doc.setFont("helvetica", "normal");

    doc.text(
      `Data: ${new Date(
        orcamento.data_orcamento + "T00:00:00"
      ).toLocaleDateString("pt-BR")}`,
      130,
      72
    );

    if (orcamento.validade) {
      doc.text(
        `Validade: ${new Date(
          orcamento.validade + "T00:00:00"
        ).toLocaleDateString("pt-BR")}`,
        130,
        79
      );
    }

    // =========================
    // STATUS (com cor)
    // =========================

    const statusX = 20;
    const statusY = 82;

    const statusTexto = orcamento.status;

    // Cor de fundo por status
    const coresStatus: Record<string, [number, number, number]> = {
      Pendente: [251, 191, 36], // amarelo
      Aprovado: [16, 185, 129], // verde
      Recusado: [239, 68, 68], // vermelho
      "Concluído": [59, 130, 246], // azul → kept as string (object key needs static literal)
    };
    const corStatus = coresStatus[statusTexto] || [100, 116, 139];

    // Badge do status (pílula colorida)
    const larguraBadge = doc.getTextWidth(statusTexto) + 12;
    doc.setFillColor(corStatus[0], corStatus[1], corStatus[2]);
    doc.roundedRect(statusX + 18, statusY - 4, larguraBadge, 6, 1.5, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(statusTexto, statusX + 18 + 6, statusY + 1);

    // Texto "STATUS:" continua cinza
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text("STATUS:", statusX, statusY);

    // =========================
    // CLIENTE
    // =========================

    doc.setFillColor(
      cinzaClaro[0],
      cinzaClaro[1],
      cinzaClaro[2]
    );

    doc.roundedRect(
      15,
      90,
      180,
      clienteCompleto?.telefone ||
        clienteCompleto?.endereco
        ? 34
        : 22,
      3,
      3,
      "F"
    );

    doc.setTextColor(
      azulEscuro[0],
      azulEscuro[1],
      azulEscuro[2]
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);

    doc.text(
      "DADOS DO CLIENTE",
      20,
      99
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    doc.text(
      cliente,
      20,
      107
    );

    let linhaCliente = 114;

    if (clienteCompleto?.telefone) {
      doc.text(
        `Telefone: ${clienteCompleto.telefone}`,
        20,
        linhaCliente
      );

      linhaCliente += 7;
    }

    if (clienteCompleto?.endereco) {
      doc.text(
        `Endereço: ${clienteCompleto.endereco}`,
        20,
        linhaCliente
      );
    }

    // =========================
    // TABELA
    // =========================

    const linhasTabela = (itensPDF || []).map(
      (item) => [
        item.descricao,
        Number(item.quantidade).toLocaleString(
          "pt-BR"
        ),
        `R$ ${Number(
          item.valor_unitario
        ).toFixed(2).replace(".", ",")}`,
        `R$ ${Number(
          item.subtotal
        ).toFixed(2).replace(".", ",")}`,
      ]
    );

    autoTable(doc, {
      startY: 132,
      head: [
        [
          "Descrição",
          "Qtd.",
          "Valor unit.",
          "Subtotal",
        ],
      ],
      body: linhasTabela,
      theme: "grid",
      headStyles: {
        fillColor: azulEscuro,
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        fontSize: 9,
      },
      columnStyles: {
        0: {
          cellWidth: 90,
        },
        1: {
          cellWidth: 20,
          halign: "center",
        },
        2: {
          cellWidth: 35,
          halign: "right",
        },
        3: {
          cellWidth: 35,
          halign: "right",
        },
      },
      margin: {
        left: 15,
        right: 15,
      },
    });

    // =========================
    // TOTAIS
    // =========================

    const finalY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    const subtotalPDF = (itensPDF || []).reduce(
      (total, item) =>
        total + Number(item.subtotal || 0),
      0
    );

    const descontoPDF = Number(
      orcamento.desconto || 0
    );

    const totalPDF = Number(
      orcamento.valor_total || 0
    );

    doc.setTextColor(
      cinzaTexto[0],
      cinzaTexto[1],
      cinzaTexto[2]
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    doc.text(
      "Subtotal:",
      135,
      finalY
    );

    doc.text(
      `R$ ${subtotalPDF
        .toFixed(2)
        .replace(".", ",")}`,
      190,
      finalY,
      { align: "right" }
    );

    doc.text(
      "Desconto:",
      135,
      finalY + 7
    );

    doc.text(
      `R$ ${descontoPDF
        .toFixed(2)
        .replace(".", ",")}`,
      190,
      finalY + 7,
      { align: "right" }
    );

    // Caixa do total
    doc.setFillColor(
      azulEscuro[0],
      azulEscuro[1],
      azulEscuro[2]
    );

    doc.roundedRect(
      125,
      finalY + 13,
      70,
      14,
      3,
      3,
      "F"
    );

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);

    doc.text(
      "TOTAL",
      132,
      finalY + 22
    );

    doc.text(
      `R$ ${totalPDF
        .toFixed(2)
        .replace(".", ",")}`,
      190,
      finalY + 22,
      { align: "right" }
    );

    // =========================
    // OBSERVAÇÕES
    // =========================

    let observacoesY =
      finalY + 38;

    if (orcamento.observacoes) {
      doc.setTextColor(
        azulEscuro[0],
        azulEscuro[1],
        azulEscuro[2]
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);

      doc.text(
        "OBSERVAÇÕES",
        20,
        observacoesY
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      const observacoes = doc.splitTextToSize(
        orcamento.observacoes,
        170
      );

      doc.text(
        observacoes,
        20,
        observacoesY + 7
      );

      observacoesY +=
        7 + observacoes.length * 4;
    }

    // =========================
    // ASSINATURA
    // =========================

    // Calcula altura disponível (não invadir o rodapé)
    const alturaPaginaCalc = doc.internal.pageSize.height;
    const limiteRodape = alturaPaginaCalc - 42;
    let assinaturaY = Math.max(observacoesY + 15, finalY + 50);

    // Se a posição ultrapassar o rodapé, joga para próxima página
    if (assinaturaY > limiteRodape) {
      doc.addPage();
      assinaturaY = 30;
    }

    doc.setTextColor(
      azulEscuro[0],
      azulEscuro[1],
      azulEscuro[2]
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    // Linhas de assinatura (cliente + empresa)
    const linhaY = assinaturaY + 18;
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);

    // Linha do cliente
    doc.line(20, linhaY, 100, linhaY);
    // Linha da empresa
    doc.line(115, linhaY, 195, linhaY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text("Cliente (de acordo)", 20, linhaY + 5);
    doc.text("Empresa / Responsável", 115, linhaY + 5);

    // Data ao lado das linhas
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Data: ___ / ___ / ______", 20, linhaY + 12);
    doc.text("Data: ___ / ___ / ______", 115, linhaY + 12);

    // =========================
    // RODAPÉ
    // =========================

    const alturaPagina =
      doc.internal.pageSize.height;

    doc.setFillColor(
      azulEscuro[0],
      azulEscuro[1],
      azulEscuro[2]
    );

    doc.rect(
      0,
      alturaPagina - 32,
      210,
      32,
      "F"
    );

    doc.setTextColor(255, 255, 255);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    doc.text(
      (empresa?.nome || "Portal Elétrico").toUpperCase(),
      105,
      alturaPagina - 22,
      { align: "center" }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    // Linha 1 do rodapé: slogan (ou texto genérico)
    const linhaRodape1 = empresa?.slogan || "Gestão para eletricistas";
    doc.text(linhaRodape1, 105, alturaPagina - 16, { align: "center" });

    // Linha 2 do rodapé: contato (e-mail, telefone)
    const partesContato: string[] = [];
    if (empresa?.email_contato) partesContato.push(empresa.email_contato);
    if (empresa?.telefone_contato)
      partesContato.push(empresa.telefone_contato);
    if (partesContato.length > 0) {
      doc.text(partesContato.join(" · "), 105, alturaPagina - 11, {
        align: "center",
      });
    }

    // Linha 3 do rodapé: CNPJ + endereço (apenas se preenchidos)
    const partesDoc: string[] = [];
    if (empresa?.cnpj) partesDoc.push(`CNPJ: ${empresa.cnpj}`);
    if (empresa?.endereco) partesDoc.push(empresa.endereco);
    if (partesDoc.length > 0) {
      doc.text(partesDoc.join(" · "), 105, alturaPagina - 6, {
        align: "center",
      });
    }

    // =========================
    // SALVAR PDF
    // =========================

    const numeroPDF = formatarNumero(orcamento.numero);

    doc.save(
      `orcamento-${numeroPDF}.pdf`
    );
  } catch (error) {
    console.error(
      "Erro ao gerar PDF:",
      error
    );

    mostrarToast(
      "Erro ao gerar o PDF.",
      "erro"
    );
  } finally {
    setGerandoPDF(null);
  }
}

  const itensDisponiveis =
    tipoItem === "servico" ? servicos : produtos;

  const orcamentosFiltrados = orcamentos.filter((orcamento) => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const cliente = clientes.find((item) => item.id === orcamento.cliente_id);
    const texto = [formatarNumero(orcamento.numero), cliente?.nome || "", cliente?.endereco || ""].join(" ").toLocaleLowerCase("pt-BR");
    return (!termo || texto.includes(termo)) && (filtroStatus === "todos" || orcamento.status === filtroStatus);
  }).sort((a, b) => ordenacao === "validade" ? (a.validade || "9999").localeCompare(b.validade || "9999") : ordenacao === "valor" ? Number(b.valor_total) - Number(a.valor_total) : b.numero - a.numero);
  const pendentes = orcamentos.filter((orcamento) => orcamento.status === STATUS_ORCAMENTO.PENDENTE);
  const aprovados = orcamentos.filter((orcamento) => orcamento.status === STATUS_ORCAMENTO.APROVADO);
  const valorPendente = pendentes.reduce((total, orcamento) => total + Number(orcamento.valor_total), 0);
  const tomStatus = (valor: string) => valor === STATUS_ORCAMENTO.APROVADO || valor === STATUS_ORCAMENTO.CONCLUIDO ? "success" : valor === STATUS_ORCAMENTO.RECUSADO ? "danger" : "warning";
  function acoesOrcamento(orcamento: Orcamento) {
    return <div className="row-actions">
      <button type="button" onClick={() => visualizarOrcamento(orcamento)} className="btn-secondary" aria-label={`Abrir orçamento ${formatarNumero(orcamento.numero)}`}>Abrir</button>
      <details className="relative" onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}>
        <summary className="icon-button list-none cursor-pointer [&::-webkit-details-marker]:hidden" aria-label={`Mais ações do orçamento ${formatarNumero(orcamento.numero)}`}><MoreHorizontal className="w-5 h-5" aria-hidden="true" /></summary>
        <div className="absolute right-0 top-full z-30 mt-1 w-48 border border-[var(--color-border)] bg-white p-1 shadow-lg rounded-lg" onClick={(event) => { if ((event.target as HTMLElement).closest("button")) event.currentTarget.parentElement?.removeAttribute("open"); }}>
          <button type="button" onClick={() => editarOrcamento(orcamento)} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50"><Pencil className="w-4 h-4" aria-hidden="true" />Editar orçamento</button>
          <button type="button" onClick={() => gerarPDF(orcamento)} disabled={gerandoPDF === orcamento.id} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">{gerandoPDF === orcamento.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <FileText className="w-4 h-4" aria-hidden="true" />}{gerandoPDF === orcamento.id ? "Gerando PDF..." : "Baixar PDF"}</button>
          <button type="button" onClick={() => setOrcamentoParaExcluir(orcamento)} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-red-700 border-t border-slate-100 hover:bg-red-50"><Trash2 className="w-4 h-4" aria-hidden="true" />Excluir orçamento</button>
        </div>
      </details>
    </div>;
  }

  return (
    <div className="product-page">
      <header className="page-header">
        <div><h1>Orçamentos</h1><p>Transforme propostas em serviços. Acompanhe cada resposta.</p></div>
        <div className="page-actions"><button type="button" onClick={abrirNovoOrcamento} className="btn-primary"><FilePlus className="w-4 h-4" aria-hidden="true" />Novo orçamento</button></div>
      </header>

      <div className="metric-strip" aria-label="Resumo dos orçamentos nesta página">
        <div className="metric"><span>Em negociação nesta página</span><strong>{carregandoDados ? "—" : formatarMoeda(valorPendente)}</strong><small>{pendentes.length} orçamentos aguardando resposta</small></div>
        <div className="metric"><span>Aprovados</span><strong>{carregandoDados ? "—" : aprovados.length}</strong><small>Orçamentos nesta página</small></div>
        <div className="metric"><span>Seu histórico</span><strong>{carregandoDados ? "—" : paginacao.total}</strong><small>Orçamentos cadastrados</small></div>
      </div>

      <section className="data-panel" aria-label="Lista de orçamentos">
        <div className="data-toolbar">
          <div className="flex-1 min-w-0"><label htmlFor="orc_busca" className="field-label">Buscar nesta página</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" /><input id="orc_busca" value={busca} onChange={(event) => setBusca(event.target.value)} className="input-base w-full pl-10" placeholder="Nº, cliente ou endereço" /></div></div>
          <div><label htmlFor="orc_ordenacao" className="field-label">Ordenar nesta página</label><select id="orc_ordenacao" value={ordenacao} onChange={(event) => setOrdenacao(event.target.value)} className="input-base w-full"><option value="numero">Mais recentes</option><option value="validade">Próxima validade</option><option value="valor">Maior valor</option></select></div>
        </div>
        <div className="filter-tabs" aria-label="Filtrar status nesta página"><button type="button" aria-pressed={filtroStatus === "todos"} onClick={() => setFiltroStatus("todos")}>Todos</button>{STATUS_ORCAMENTO_VALORES.map((valor) => <button type="button" key={valor} aria-pressed={filtroStatus === valor} onClick={() => setFiltroStatus(valor)}>{valor}</button>)}</div>
        {carregandoDados ? <div className="empty-state" role="status"><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /><p>Carregando orçamentos...</p></div>
          : erroDados ? <div className="empty-state" role="alert"><h2>Não foi possível carregar os orçamentos</h2><p>Confira sua conexão e tente novamente.</p><button type="button" onClick={carregarDados} className="btn-secondary">Tentar novamente</button></div>
          : orcamentosFiltrados.length === 0 ? <div className="empty-state"><h2>{orcamentos.length ? "Nenhum orçamento neste filtro" : "Seu próximo serviço começa aqui"}</h2><p>{orcamentos.length ? "Ajuste a busca ou o status para ver outras propostas desta página." : "Escolha o cliente e adicione os serviços e materiais. Seu orçamento fica pronto para baixar em PDF."}</p><button type="button" onClick={orcamentos.length ? () => { setBusca(""); setFiltroStatus("todos"); } : abrirNovoOrcamento} className="btn-secondary">{orcamentos.length ? "Limpar filtros" : "Criar primeiro orçamento"}</button></div>
          : <>
            <div className="hidden xl:block"><table className="data-table w-full"><thead><tr><th scope="col">Proposta / cliente</th><th scope="col">Datas</th><th scope="col">Status</th><th scope="col" className="text-right">Total</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead><tbody>
              {orcamentosFiltrados.map((orcamento) => { const cliente = clientes.find((item) => item.id === orcamento.cliente_id); return <tr key={orcamento.id}>
                <td><div className="record-meta">Orçamento #{formatarNumero(orcamento.numero)}</div><div className="record-primary">{cliente?.nome || "Cliente"}</div><div className="record-meta max-w-sm truncate" title={cliente?.endereco || undefined}>{cliente?.endereco || "Endereço não informado"}</div></td>
                <td><div className="text-sm font-medium">{formatarData(orcamento.data_orcamento)}</div><div className="record-meta">{orcamento.validade ? `Válido até ${formatarData(orcamento.validade)}` : "Validade não definida"}</div></td>
                <td><span className="status-label" data-tone={tomStatus(orcamento.status)}>{orcamento.status}</span></td>
                <td className="text-right font-semibold whitespace-nowrap tabular-nums">{formatarMoeda(Number(orcamento.valor_total))}</td><td>{acoesOrcamento(orcamento)}</td>
              </tr>; })}
            </tbody></table></div>
            <div className="xl:hidden">{orcamentosFiltrados.map((orcamento) => { const cliente = clientes.find((item) => item.id === orcamento.cliente_id); return <article key={orcamento.id} className="record-row">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="record-meta">Orçamento #{formatarNumero(orcamento.numero)}</div><h2 className="record-primary">{cliente?.nome || "Cliente"}</h2></div><span className="status-label shrink-0" data-tone={tomStatus(orcamento.status)}>{orcamento.status}</span></div><p className="record-meta mt-1">{cliente?.endereco || "Endereço não informado"}</p>
              <div className="flex flex-wrap justify-between gap-2 mt-3"><div className="record-meta"><p>Emissão {formatarData(orcamento.data_orcamento)}</p><p>{orcamento.validade ? `Válido até ${formatarData(orcamento.validade)}` : "Validade não definida"}</p></div><strong className="tabular-nums">{formatarMoeda(Number(orcamento.valor_total))}</strong></div><div className="mt-3">{acoesOrcamento(orcamento)}</div>
            </article>; })}</div>
          </>}
        {!carregandoDados && !erroDados && orcamentos.length > 0 && <p className="px-4 pt-4 text-xs text-slate-500">{orcamentosFiltrados.length} de {orcamentos.length} orçamentos nesta página. Busca, status e ordenação se aplicam a esta página.</p>}
        <ControlesPaginacao pagina={paginacao.pagina} totalPaginas={paginacao.totalPaginas} total={paginacao.total} tamanho={paginacao.tamanho} onAnterior={paginacao.anterior} onProxima={paginacao.proxima} onMudarTamanho={paginacao.setTamanho} />
      </section>

      {modalAberto && <Modal
        title={orcamentoEditando ? `Editar orçamento #${formatarNumero(orcamentoEditando.numero)}` : "Novo orçamento"}
        description="Cliente, escopo e valores em uma única proposta."
        onClose={() => { if (!salvando) { setModalAberto(false); setOrcamentoEditando(null); } }}
        busy={salvando}
        wide
        footer={<><div className="mr-auto" aria-live="polite" aria-atomic="true"><p className="record-meta">Total do orçamento</p><strong className="text-xl sm:text-2xl tabular-nums">{formatarMoeda(valorTotal)}</strong></div><button type="button" onClick={() => { setModalAberto(false); setOrcamentoEditando(null); }} disabled={salvando} className="btn-secondary">Cancelar</button><button type="button" onClick={salvarOrcamento} disabled={salvando || carregandoDados || erroDados} className="btn-primary">{salvando ? "Salvando..." : orcamentoEditando ? "Salvar alterações" : "Salvar orçamento"}</button></>}
      >
        {carregandoDados && <p role="status" className="record-meta">Carregando clientes e itens disponíveis...</p>}
        {erroDados && <div role="alert" className="inline-alert">Não foi possível carregar os dados do formulário. <button type="button" onClick={carregarDados} className="underline font-semibold">Tentar novamente</button></div>}
        <section className="form-section">
          <h3>Cliente e proposta</h3><p>Defina quem vai receber o orçamento e até quando ele é válido.</p>
          <div className="form-grid">
            <div><label htmlFor="orc_cliente" className="field-label">Cliente *</label><select id="orc_cliente" aria-required="true" value={clienteId} onChange={(event) => setClienteId(event.target.value)} className="input-base w-full"><option value="">Selecione um cliente</option>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}</select></div>
            <div><label htmlFor="orc_status" className="field-label">Status</label><select id="orc_status" value={status} onChange={(event) => setStatus(event.target.value as StatusOrcamento)} className="input-base w-full">{STATUS_ORCAMENTO_VALORES.map((valor) => <option key={valor} value={valor}>{valor}</option>)}</select></div>
            <div><label htmlFor="orc_data" className="field-label">Data do orçamento</label><input id="orc_data" type="date" value={dataOrcamento} onChange={(event) => setDataOrcamento(event.target.value)} className="input-base w-full" /></div>
            <div><label htmlFor="orc_validade" className="field-label">Validade</label><input id="orc_validade" type="date" value={validade} onChange={(event) => setValidade(event.target.value)} className="input-base w-full" /></div>
          </div>
        </section>
        <section className="form-section">
          <h3>Serviços e materiais</h3><p>Monte o escopo com os itens do seu catálogo.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label htmlFor="orc_tipo_item" className="field-label">Tipo</label><select id="orc_tipo_item" value={tipoItem} onChange={(event) => { setTipoItem(event.target.value as "servico" | "produto"); setItemSelecionado(""); }} className="input-base w-full"><option value="servico">Serviço</option><option value="produto">Produto</option></select></div>
            <div className="col-span-2 sm:col-span-2 order-first sm:order-none"><label htmlFor="orc_item" className="field-label">Item do catálogo</label><select id="orc_item" value={itemSelecionado} onChange={(event) => setItemSelecionado(event.target.value)} className="input-base w-full"><option value="">{tipoItem === "servico" ? "Selecione um serviço" : "Selecione um produto"}</option>{itensDisponiveis.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></div>
            <div><label htmlFor="orc_quantidade" className="field-label">Quantidade</label><input id="orc_quantidade" type="number" min="0.01" step="0.01" value={quantidade} onChange={(event) => setQuantidade(event.target.value)} className="input-base w-full" /></div>
          </div>
          <div className="flex justify-end mt-3"><button type="button" onClick={adicionarItem} className="btn-secondary">Adicionar item</button></div>
          <div className="mt-5 border-t border-[var(--color-border)]">
            {itens.length === 0 ? <p className="py-6 text-sm text-slate-500 text-center">Adicione o primeiro serviço ou material para compor a proposta.</p> : <div className="divide-y divide-[var(--color-border)]">
              {itens.map((item) => <div key={item.id} className="flex flex-wrap sm:flex-nowrap items-start gap-3 py-4"><div className="min-w-0 flex-1"><p className="record-primary">{item.descricao}</p><p className="record-meta">{item.tipo === "servico" ? "Serviço" : "Material"} · {item.quantidade} × {formatarMoeda(item.valor_unitario)}</p></div><strong className="text-sm tabular-nums shrink-0 pt-1">{formatarMoeda(item.subtotal)}</strong><button type="button" onClick={() => removerItem(item.id)} className="icon-button text-red-700 shrink-0" aria-label={`Remover ${item.descricao}`} title="Remover item"><Trash2 className="w-4 h-4" aria-hidden="true" /></button></div>)}
            </div>}
          </div>
        </section>
        <section className="form-section">
          <h3>Condições comerciais</h3><p>Revise o desconto e as informações que acompanham a proposta.</p>
          <div className="grid sm:grid-cols-[1fr_240px] gap-6">
            <div><label htmlFor="orc_observacoes" className="field-label">Observações</label><textarea id="orc_observacoes" value={observacoes} onChange={(event) => setObservacoes(event.target.value)} rows={4} placeholder="Condições de pagamento, prazo e observações..." className="input-base w-full resize-y" /></div>
            <div className="border-t sm:border-t-0 sm:border-l border-[var(--color-border)] pt-4 sm:pt-0 sm:pl-6"><dl className="flex justify-between gap-3 text-sm mb-4"><dt className="text-slate-600">Subtotal</dt><dd className="font-semibold tabular-nums">{formatarMoeda(subtotal)}</dd></dl><label htmlFor="orc_desconto" className="field-label">Desconto (R$)</label><input id="orc_desconto" type="number" min="0" step="0.01" value={desconto} onChange={(event) => setDesconto(event.target.value)} placeholder="0,00" className="input-base w-full text-right" /></div>
          </div>
        </section>
      </Modal>}

      {orcamentoVisualizado && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]"
          onClick={fecharVisualizacao}
        >

          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Cabeçalho */}
            <div className="p-6 border-b flex items-center justify-between">

              <div>

                <h2 className="text-2xl font-bold text-gray-900">
                  Orçamento #
                  {formatarNumero(orcamentoVisualizado.numero)}
                </h2>

                <p className="text-gray-500 text-sm mt-1">
                  Visualização do orçamento
                </p>

              </div>

              <button
  onClick={fecharVisualizacao}
  className="text-gray-500 hover:text-gray-600 text-2xl"
>
  ×
</button>

            </div>

            {/* Conteúdo */}
            {carregandoVisualizacao ? (
              <div className="p-12 text-center text-gray-500">
                Carregando orçamento...
              </div>
            ) : (
              <div className="p-6 space-y-6">

                {/* Dados do cliente */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div className="bg-gray-50 rounded-xl p-5">

                    <p className="text-sm text-gray-500">
                      Cliente
                    </p>

                    <p className="text-lg font-bold text-gray-900 mt-1">
                     {clientes.find(
  (cliente) =>
    cliente.id === orcamentoVisualizado.cliente_id
)?.nome || "Cliente"}
                    </p>

                  </div>

                  <div className="bg-gray-50 rounded-xl p-5">

                    <p className="text-sm text-gray-500">
                      Status
                    </p>

                    <span
                      className={`inline-flex mt-2 px-3 py-1 rounded-full text-xs font-semibold ${
                        orcamentoVisualizado.status ===
                        STATUS_ORCAMENTO.APROVADO
                          ? "bg-emerald-100 text-emerald-800"
                          : orcamentoVisualizado.status ===
                            STATUS_ORCAMENTO.RECUSADO
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {orcamentoVisualizado.status}
                    </span>

                  </div>

                  <div className="bg-gray-50 rounded-xl p-5">

                    <p className="text-sm text-gray-500">
                      Data do orçamento
                    </p>

                    <p className="font-semibold text-gray-900 mt-1">
                      {new Date(
                        orcamentoVisualizado.data_orcamento +
                          "T00:00:00"
                      ).toLocaleDateString("pt-BR")}
                    </p>

                  </div>

                  <div className="bg-gray-50 rounded-xl p-5">

                    <p className="text-sm text-gray-500">
                      Validade
                    </p>

                    <p className="font-semibold text-gray-900 mt-1">
                      {orcamentoVisualizado.validade
                        ? new Date(
                            orcamentoVisualizado.validade +
                              "T00:00:00"
                          ).toLocaleDateString("pt-BR")
                        : "Não informada"}
                    </p>

                  </div>

                </div>

                {/* Itens */}
                <div>

                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    Itens do orçamento
                  </h3>

                  {itensVisualizados.length === 0 ? (
                    <div className="border border-dashed rounded-xl p-8 text-center text-gray-500">
                      Nenhum item encontrado.
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">

                      <div className="overflow-x-auto">

                        <table className="w-full">

                          <thead className="bg-gray-50">

                            <tr>

                              <th className="text-left px-4 py-3 text-sm text-gray-600">
                                Tipo
                              </th>

                              <th className="text-left px-4 py-3 text-sm text-gray-600">
                                Descrição
                              </th>

                              <th className="text-right px-4 py-3 text-sm text-gray-600">
                                Quantidade
                              </th>

                              <th className="text-right px-4 py-3 text-sm text-gray-600">
                                Unitário
                              </th>

                              <th className="text-right px-4 py-3 text-sm text-gray-600">
                                Subtotal
                              </th>

                            </tr>

                          </thead>

                          <tbody>

                            {itensVisualizados.map((item) => (
                              <tr
                                key={item.id}
                                className="border-t"
                              >

                                <td className="px-4 py-3 text-sm">
                                  {item.tipo === "servico"
                                    ? "Serviço"
                                    : "Produto"}
                                </td>

                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {item.descricao}
                                </td>

                                <td className="px-4 py-3 text-right">
                                  {item.quantidade}
                                </td>

                                <td className="px-4 py-3 text-right">
                                  {formatarMoeda(
                                    Number(
                                      item.valor_unitario
                                    )
                                  )}
                                </td>

                                <td className="px-4 py-3 text-right font-semibold">
                                  {formatarMoeda(
                                    Number(item.subtotal)
                                  )}
                                </td>

                              </tr>
                            ))}

                          </tbody>

                        </table>

                      </div>

                    </div>
                  )}

                </div>

                {/* Observações */}
                {orcamentoVisualizado.observacoes && (
                  <div>

                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      Observações
                    </h3>

                    <div className="bg-gray-50 rounded-xl p-4 text-gray-700 whitespace-pre-wrap">
                      {orcamentoVisualizado.observacoes}
                    </div>

                  </div>
                )}

                {/* Totais */}
                <div className="flex justify-end">

                  <div className="w-full md:w-80 bg-gray-50 rounded-xl p-5">

                    <div className="flex justify-between mb-3">

                      <span className="text-gray-600">
                        Subtotal
                      </span>

                      <span className="font-semibold">
                        {formatarMoeda(
                          itensVisualizados.reduce(
                            (total, item) =>
                              total +
                              Number(item.subtotal),
                            0
                          )
                        )}
                      </span>

                    </div>

                    <div className="flex justify-between mb-3">

                      <span className="text-gray-600">
                        Desconto
                      </span>

                      <span className="font-semibold">
                        {formatarMoeda(
                          Number(
                            orcamentoVisualizado.desconto
                          )
                        )}
                      </span>

                    </div>

                    <div className="border-t pt-4 flex justify-between">

                      <span className="text-xl font-bold">
                        Total
                      </span>

                      <span className="text-xl font-bold text-blue-600">
                        {formatarMoeda(
                          Number(
                            orcamentoVisualizado.valor_total
                          )
                        )}
                      </span>

                    </div>

                  </div>

                </div>

              </div>
            )}

            {/* Rodapé */}
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">

              <button
                onClick={fecharVisualizacao}
                className="px-5 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 font-medium"
              >
                Fechar
              </button>

              {osVinculada && (
                <button
                  type="button"
                  onClick={() => {
                    fecharVisualizacao();
                    setPagina("ordens-servico");
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition"
                >
                  #{formatarNumero(osVinculada.numero)}
                  <span className="text-xs opacity-75">
                    ({osVinculada.status})
                  </span>
                </button>
              )}

              <button
  onClick={() => gerarPDF(orcamentoVisualizado)}
  disabled={gerandoPDF === orcamentoVisualizado.id}
  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
>
  {gerandoPDF === orcamentoVisualizado.id && (
    <Loader2 className="w-4 h-4 animate-spin" />
  )}
  {gerandoPDF === orcamentoVisualizado.id ? "Gerando PDF..." : "Gerar PDF"}
</button>

            </div>

          </div>

        </div>
      )}

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        aberto={orcamentoParaExcluir !== null}
        titulo="Excluir orçamento?"
        descricao={
          orcamentoParaExcluir ? (
            <>
              Tem certeza que deseja excluir o orçamento{" "}
              <strong className="text-gray-900">
                #{formatarNumero(orcamentoParaExcluir.numero)}
              </strong>{" "}
              do valor de{" "}
              <strong className="text-gray-900">
                {formatarMoeda(Number(orcamentoParaExcluir.valor_total))}
              </strong>
              ? Esta ação não pode ser desfeita.
            </>
          ) : null
        }
        textoBotaoConfirmar="Excluir"
        corBotaoConfirmar="vermelho"
        carregando={excluindo}
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setOrcamentoParaExcluir(null)}
      />

    </div>
  );
}

export default Orcamentos;
