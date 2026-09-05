import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FilePlus,
  X,
  FileText,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./ui/toast";
import { useEmpresa } from "../contexts/EmpresaContext";
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

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Carrega uma URL de logo e devolve como data URL em base64.
let logoCache: { url: string; data: Promise<string> } | null = null;

function getLogoFromUrl(url: string): Promise<string> {
  if (logoCache && logoCache.url === url) return logoCache.data;

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

  logoCache = { url, data: promise };
  return promise;
}

// Fallback para /logo.png do projeto
const FALLBACK_LOGO_URL = "/logo.png";

function Orcamentos() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const { empresa } = useEmpresa();

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [orcamentoEditando, setOrcamentoEditando] =
  useState<Orcamento | null>(null);

  const [orcamentoParaExcluir, setOrcamentoParaExcluir] =
    useState<Orcamento | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const { mostrarToast } = useToast();

  const [clienteId, setClienteId] = useState("");
  const [dataOrcamento, setDataOrcamento] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [validade, setValidade] = useState("");
  const [status, setStatus] = useState("Pendente");
  const [desconto, setDesconto] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [tipoItem, setTipoItem] = useState<"servico" | "produto">("servico");
  const [itemSelecionado, setItemSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState("1");

  const [itens, setItens] = useState<ItemOrcamento[]>([]);

  const [salvando, setSalvando] = useState(false);

  // Visualização
  const [orcamentoVisualizado, setOrcamentoVisualizado] =
    useState<Orcamento | null>(null);

  const [itensVisualizados, setItensVisualizados] =
    useState<ItemOrcamento[]>([]);

  const [carregandoVisualizacao, setCarregandoVisualizacao] =
    useState(false);

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
    if (usuario) {
      carregarDados();
    }
  }, [usuario]);

  async function carregarDados() {
    if (!usuario) return;

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
  `)
  .eq("user_id", usuario.id)
  .order("numero", { ascending: false }),
      ]);

    if (clientesResult.error) {
      console.error(clientesResult.error);
    }

    if (servicosResult.error) {
      console.error(servicosResult.error);
    }

    if (produtosResult.error) {
      console.error(produtosResult.error);
    }

    if (orcamentosResult.error) {
      console.error(orcamentosResult.error);
    }

    setClientes(clientesResult.data || []);
    setServicos(servicosResult.data || []);
    setProdutos(produtosResult.data || []);
    setOrcamentos((orcamentosResult.data as Orcamento[]) || []);
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

  const subtotal = itens.reduce(
    (total, item) => total + item.subtotal,
    0
  );

  const valorDesconto = Number(desconto) || 0;

  const valorTotal = Math.max(subtotal - valorDesconto, 0);

  function abrirNovoOrcamento() {
  setOrcamentoEditando(null);

  setClienteId("");
  setDataOrcamento(new Date().toISOString().split("T")[0]);
  setValidade("");
  setStatus("Pendente");
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
    setStatus(orcamento.status);
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
      setOrcamentoVisualizado(null);
      setItensVisualizados([]);
      setCarregandoVisualizacao(false);
      return;
    }

    setItensVisualizados((data as ItemOrcamento[]) || []);
    setCarregandoVisualizacao(false);
  }

  function fecharVisualizacao() {
    setOrcamentoVisualizado(null);
    setItensVisualizados([]);
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
      `Orçamento #${String(orcamentoParaExcluir.numero).padStart(
        4,
        "0"
      )} excluído com sucesso.`,
      "sucesso"
    );
    setOrcamentoParaExcluir(null);
  }

  async function gerarPDF(orcamento: Orcamento) {
  if (!usuario) return;

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
    const logoBase64 = await getLogoFromUrl(logoUrl);

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
      `ORÇAMENTO Nº ${String(orcamento.numero).padStart(4, "0")}`,
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
      "Concluído": [59, 130, 246], // azul
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

    const numeroPDF = String(
      orcamento.numero
    ).padStart(4, "0");

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
  }
}

  const itensDisponiveis =
    tipoItem === "servico" ? servicos : produtos;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Orçamentos
            </h1>

            <p className="text-gray-500 mt-1">
              Crie e gerencie seus orçamentos
            </p>
          </div>

          <button
            onClick={abrirNovoOrcamento}
            className="inline-flex items-center gap-2 bg-[#FFD60A] text-[#0D1B2A] font-bold px-5 py-3 rounded-lg hover:bg-yellow-400 transition shadow-lg shadow-yellow-500/20"
          >
            <FilePlus className="w-5 h-5" />
            Novo orçamento
          </button>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500">
              Total de orçamentos
            </p>

            <h2 className="text-3xl font-bold text-gray-900 mt-2">
              {orcamentos.length}
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500">
              Pendentes
            </p>

            <h2 className="text-3xl font-bold text-yellow-600 mt-2">
              {
                orcamentos.filter(
                  (orcamento) => orcamento.status === "Pendente"
                ).length
              }
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500">
              Aprovados
            </p>

            <h2 className="text-3xl font-bold text-green-600 mt-2">
              {
                orcamentos.filter(
                  (orcamento) => orcamento.status === "Aprovado"
                ).length
              }
            </h2>
          </div>

        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">

          {orcamentos.length === 0 ? (
            <div className="p-12 text-center">

              <h3 className="text-lg font-semibold text-gray-800">
                Nenhum orçamento cadastrado
              </h3>

              <p className="text-gray-500 mt-2">
                Clique em "Novo orçamento" para começar.
              </p>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-gray-50 border-b">
                  <tr>

                    <th scope="col" className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Nº
                    </th>

                    <th scope="col" className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Cliente
                    </th>

                    <th scope="col" className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Data
                    </th>

                    <th scope="col" className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Status
                    </th>

                    <th scope="col" className="text-right px-6 py-4 text-sm font-semibold text-gray-600">
                      Total
                    </th>

                    <th scope="col" className="text-right px-6 py-4 text-sm font-semibold text-gray-600">
                      Ações
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {orcamentos.map((orcamento) => (
                    <tr
                      key={orcamento.id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >

                      <td className="px-6 py-4 font-semibold text-gray-900">
                        #{String(orcamento.numero).padStart(4, "0")}
                      </td>

                     <td className="px-6 py-4 text-gray-700">
  {clientes.find(
    (cliente) => cliente.id === orcamento.cliente_id
  )?.nome || "Cliente"}
</td>

                      <td className="px-6 py-4 text-gray-600">
                        {new Date(
                          orcamento.data_orcamento + "T00:00:00"
                        ).toLocaleDateString("pt-BR")}
                      </td>

                      <td className="px-6 py-4">
  <span
    className={`px-3 py-1 rounded-full text-xs font-semibold ${
      orcamento.status === "Pendente"
        ? "bg-yellow-100 text-yellow-700"
        : orcamento.status === "Aprovado"
        ? "bg-green-100 text-green-700"
        : orcamento.status === "Recusado"
        ? "bg-red-100 text-red-700"
        : orcamento.status === "Concluído"
        ? "bg-blue-100 text-blue-700"
        : "bg-gray-100 text-gray-700"
    }`}
  >
    {orcamento.status}
  </span>
</td>

                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        {formatarMoeda(
                          Number(orcamento.valor_total)
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">

                        <div className="flex justify-end gap-3">

                          <button
                            type="button"
                            onClick={() =>
                              visualizarOrcamento(orcamento)
                            }
                            title="Visualizar"
                            aria-label="Visualizar orçamento"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium transition"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="hidden lg:inline">
                              Ver
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => gerarPDF(orcamento)}
                            title="Baixar PDF"
                            aria-label="Baixar PDF"
                            className="inline-flex items-center gap-1 text-gray-700 hover:text-gray-900 font-medium transition"
                          >
                            <FileText className="w-4 h-4" />
                            <span className="hidden lg:inline">
                              PDF
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => editarOrcamento(orcamento)}
                            title="Editar"
                            aria-label="Editar orçamento"
                            className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-800 font-medium transition"
                          >
                            <Pencil className="w-4 h-4" />
                            <span className="hidden lg:inline">
                              Editar
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setOrcamentoParaExcluir(orcamento)
                            }
                            title="Excluir"
                            aria-label="Excluir orçamento"
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-medium transition"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden lg:inline">
                              Excluir
                            </span>
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

      {/* ===================================================== */}
      {/* MODAL NOVO ORÇAMENTO                                  */}
      {/* ===================================================== */}

      {modalAberto && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => {
            if (!salvando) {
              setModalAberto(false);
            }
          }}
        >

          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Cabeçalho */}
            <div className="p-6 border-b flex items-center justify-between">

              <div>
                <h2 className="text-2xl font-bold text-gray-900">
  {orcamentoEditando
    ? `Editar orçamento #${String(
        orcamentoEditando.numero
      ).padStart(4, "0")}`
    : "Novo orçamento"}
</h2>

<p className="text-gray-500 text-sm mt-1">
  {orcamentoEditando
    ? "Altere os dados do orçamento"
    : "Preencha os dados do orçamento"}
</p>
              </div>

              <button
                type="button"
                onClick={() => setModalAberto(false)}
                disabled={salvando}
                className="text-gray-400 hover:text-gray-700 transition p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            {/* Conteúdo */}
            <div className="p-6 space-y-6">

              {/* Dados principais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>
                  <label
                    htmlFor="orc_cliente"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Cliente <span className="text-red-500">*</span>
                  </label>

                  <select
                    id="orc_cliente"
                    value={clienteId}
                    onChange={(e) =>
                      setClienteId(e.target.value)
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5"
                  >

                    <option value="">
                      Selecione um cliente
                    </option>

                    {clientes.map((cliente) => (
                      <option
                        key={cliente.id}
                        value={cliente.id}
                      >
                        {cliente.nome}
                      </option>
                    ))}

                  </select>
                </div>

                <div>
  <label
    htmlFor="orc_status"
    className="block text-sm font-medium text-gray-700 mb-1"
  >
    Status
  </label>

  <select
    id="orc_status"
    value={status}
    onChange={(e) => setStatus(e.target.value)}
    className="w-full border border-gray-300 rounded-lg px-3 py-2"
  >
    <option value="Pendente">Pendente</option>
    <option value="Aprovado">Aprovado</option>
    <option value="Recusado">Recusado</option>
    <option value="Concluído">Concluído</option>
  </select>
</div>

                <div>
                  <label
                    htmlFor="orc_data"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Data do orçamento
                  </label>

                  <input
                    id="orc_data"
                    type="date"
                    value={dataOrcamento}
                    onChange={(e) =>
                      setDataOrcamento(e.target.value)
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5"
                  />
                </div>

                <div>
                  <label
                    htmlFor="orc_validade"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Validade
                  </label>

                  <input
                    id="orc_validade"
                    type="date"
                    value={validade}
                    onChange={(e) =>
                      setValidade(e.target.value)
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5"
                  />
                </div>

              </div>

              {/* Adicionar item */}
              <div className="border border-gray-200 rounded-xl p-5">

                <h3 className="font-bold text-gray-900 mb-4">
                  Adicionar item
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">

                  <select
                    value={tipoItem}
                    onChange={(e) => {
                      setTipoItem(
                        e.target.value as
                          | "servico"
                          | "produto"
                      );

                      setItemSelecionado("");
                    }}
                    className="border border-gray-300 rounded-lg px-3 py-2.5"
                  >

                    <option value="servico">
                      Serviço
                    </option>

                    <option value="produto">
                      Produto
                    </option>

                  </select>

                  <select
                    value={itemSelecionado}
                    onChange={(e) =>
                      setItemSelecionado(e.target.value)
                    }
                    className="border border-gray-300 rounded-lg px-3 py-2.5 md:col-span-2"
                  >

                    <option value="">
                      Selecione
                    </option>

                    {itensDisponiveis.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.nome}
                      </option>
                    ))}

                  </select>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={quantidade}
                    onChange={(e) =>
                      setQuantidade(e.target.value)
                    }
                    placeholder="Quantidade"
                    className="border border-gray-300 rounded-lg px-3 py-2.5"
                  />

                </div>

                <button
                  onClick={adicionarItem}
                  className="mt-4 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg font-medium"
                >
                  + Adicionar item
                </button>

              </div>

              {/* Itens */}
              <div>

                <h3 className="font-bold text-gray-900 mb-3">
                  Itens do orçamento
                </h3>

                {itens.length === 0 ? (
                  <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-500">
                    Nenhum item adicionado.
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
                              Qtd.
                            </th>

                            <th className="text-right px-4 py-3 text-sm text-gray-600">
                              Unitário
                            </th>

                            <th className="text-right px-4 py-3 text-sm text-gray-600">
                              Subtotal
                            </th>

                            <th className="text-right px-4 py-3 text-sm text-gray-600">
                              Ação
                            </th>

                          </tr>

                        </thead>

                        <tbody>

                          {itens.map((item) => (
                            <tr
                              key={item.id}
                              className="border-t"
                            >

                              <td className="px-4 py-3 text-sm">
                                {item.tipo === "servico"
                                  ? "Serviço"
                                  : "Produto"}
                              </td>

                              <td className="px-4 py-3 font-medium">
                                {item.descricao}
                              </td>

                              <td className="px-4 py-3 text-right">
                                {item.quantidade}
                              </td>

                              <td className="px-4 py-3 text-right">
                                {formatarMoeda(
                                  item.valor_unitario
                                )}
                              </td>

                              <td className="px-4 py-3 text-right font-semibold">
                                {formatarMoeda(
                                  item.subtotal
                                )}
                              </td>

                              <td className="px-4 py-3 text-right">

                                <button
                                  onClick={() =>
                                    removerItem(item.id)
                                  }
                                  className="text-red-600 hover:text-red-800"
                                >
                                  Remover
                                </button>

                              </td>

                            </tr>
                          ))}

                        </tbody>

                      </table>

                    </div>

                  </div>
                )}

              </div>

              {/* Observações e valores */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>

                  <textarea
                    value={observacoes}
                    onChange={(e) =>
                      setObservacoes(e.target.value)
                    }
                    rows={5}
                    placeholder="Observações do orçamento..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 resize-none"
                  />

                </div>

                <div className="bg-gray-50 rounded-xl p-5">

                  <div className="flex justify-between mb-3">

                    <span className="text-gray-600">
                      Subtotal
                    </span>

                    <span className="font-semibold">
                      {formatarMoeda(subtotal)}
                    </span>

                  </div>

                  <div className="flex items-center justify-between mb-3 gap-4">

                    <span className="text-gray-600">
                      Desconto
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={desconto}
                      onChange={(e) =>
                        setDesconto(e.target.value)
                      }
                      placeholder="R$ 0,00"
                      className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-right"
                    />

                  </div>

                  <div className="border-t pt-4 flex justify-between">

                    <span className="text-xl font-bold text-gray-900">
                      Total
                    </span>

                    <span className="text-xl font-bold text-blue-600">
                      {formatarMoeda(valorTotal)}
                    </span>

                  </div>

                </div>

              </div>

            </div>

            {/* Rodapé */}
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">

              <button
                onClick={() => {
  setModalAberto(false);
  setOrcamentoEditando(null);
}}
                disabled={salvando}
                className="px-5 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 font-medium"
              >
                Cancelar
              </button>

              <button
                onClick={salvarOrcamento}
                disabled={salvando}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
              >
                {salvando
  ? "Salvando..."
  : orcamentoEditando
  ? "Salvar alterações"
  : "Salvar orçamento"}
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ===================================================== */}
      {/* MODAL VISUALIZAR ORÇAMENTO                            */}
      {/* ===================================================== */}

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
                  {String(
                    orcamentoVisualizado.numero
                  ).padStart(4, "0")}
                </h2>

                <p className="text-gray-500 text-sm mt-1">
                  Visualização do orçamento
                </p>

              </div>

              <button
  onClick={fecharVisualizacao}
  className="text-gray-400 hover:text-gray-600 text-2xl"
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
                        "Aprovado"
                          ? "bg-green-100 text-green-700"
                          : orcamentoVisualizado.status ===
                            "Recusado"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
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

              <button
  onClick={() => gerarPDF(orcamentoVisualizado)}
  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
>
  Gerar PDF
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
                #{String(orcamentoParaExcluir.numero).padStart(4, "0")}
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