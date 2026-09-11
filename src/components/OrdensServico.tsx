import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { formatarMoeda, formatarData } from "../utils/formatters";
import { STATUS_OS, STATUS_OS_VALORES, formatarNumero, type StatusOS } from "../utils/constantes";
import {
  Pencil,
  Trash2,
  CheckCircle2,
  RotateCcw,
  History,
  Clock,
  Boxes,
  Search,
  MoreHorizontal,
  Plus,
  Loader2,
} from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { usePaginacao } from "../hooks/usePaginacao";
import ControlesPaginacao from "./ui/ControlesPaginacao";
import { useToast } from "./ui/toast";
import Modal from "./ui/Modal";

type Cliente = {
  id: number;
  nome: string;
  telefone: string | null;
  endereco: string | null;
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

type OrcamentoItem = {
  id: number;
  orcamento_id: number;
  tipo: string;
  servico_id: number | null;
  produto_id: number | null;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
};

type OrdemServico = {
  id: number;
  numero: number;
  cliente_id: number;
  orcamento_id: number | null;
  data_abertura: string;
  data_inicio: string | null;
  data_previsao: string | null;
  data_conclusao: string | null;
  status: string;
  descricao: string | null;
  observacoes: string | null;
  valor_servico: number;
  custo_materiais: number;
  valor_total: number;
};

type ItemOS = {
  id?: number;
  ordem_servico_id: number;
  tipo: string;
  servico_id: number | null;
  produto_id: number | null;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
};

export default function OrdensServico() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroDados, setErroDados] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [ordenacao, setOrdenacao] = useState("numero");
  const paginacao = usePaginacao(20);

  const [modalAberto, setModalAberto] = useState(false);
  const [modalVisualizacao, setModalVisualizacao] =
    useState(false);

  const [ordemVisualizada, setOrdemVisualizada] =
    useState<OrdemServico | null>(null);

  const [itensVisualizados, setItensVisualizados] =
    useState<ItemOS[]>([]);

  const [carregandoItens, setCarregandoItens] =
    useState(false);

  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] =
    useState<number | null>(null);

  const [ordemParaExcluir, setOrdemParaExcluir] =
    useState<OrdemServico | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const [ordemParaConcluir, setOrdemParaConcluir] =
    useState<OrdemServico | null>(null);
  const [concluindo, setConcluindo] = useState(false);

  const [ordemParaReabrir, setOrdemParaReabrir] =
    useState<OrdemServico | null>(null);
  const [reabrindo, setReabrindo] = useState(false);

  // Histórico de status + movimentações de estoque
  const [ordemHistorico, setOrdemHistorico] = useState<OrdemServico | null>(
    null
  );
  const [historicoStatus, setHistoricoStatus] = useState<
    Array<{
      id: number;
      status_anterior: string | null;
      status_novo: string;
      observacao: string | null;
      created_at: string;
    }>
  >([]);
  const [historicoEstoque, setHistoricoEstoque] = useState<
    Array<{
      id: number;
      produto_id: number | null;
      produto_nome: string | null;
      tipo: string;
      quantidade: number;
      estoque_anterior: number;
      estoque_posterior: number;
      observacao: string | null;
      created_at: string;
    }>
  >([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  const { mostrarToast } = useToast();

  const [origem, setOrigem] =
    useState<"zero" | "orcamento">("zero");

  const [orcamentoId, setOrcamentoId] =
    useState("");

  const [clienteId, setClienteId] =
    useState("");

  const [dataAbertura, setDataAbertura] =
    useState("");

  const [dataInicio, setDataInicio] =
    useState("");

  const [dataPrevisao, setDataPrevisao] =
    useState("");

  const [dataConclusao, setDataConclusao] =
    useState("");

  const [status, setStatus] =
    useState<StatusOS>(STATUS_OS.ABERTA);

  const [descricao, setDescricao] =
    useState("");

  const [observacoes, setObservacoes] =
    useState("");

  const [valorServico, setValorServico] =
    useState("");

  const [custoMateriais, setCustoMateriais] =
    useState("");

  useEffect(() => {
    carregarDados();
  }, [paginacao.pagina, paginacao.tamanho]);

  async function carregarDados() {
    setCarregando(true);
    setErroDados(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCarregando(false);
      return;
    }

    const { data: clientesData, error: clientesError } =
      await supabase
        .from("clientes")
        .select("id, nome, telefone, endereco")
        .eq("user_id", user.id)
        .order("nome");

    if (clientesError) {
      console.error(
        "Erro ao carregar clientes:",
        clientesError
      );
    }

    const de = paginacao.offset;
    const ate = de + paginacao.tamanho - 1;
    const { data: ordensData, error: ordensError, count: ordensCount } =
      await supabase
        .from("ordens_servico")
        .select(
          "id, numero, cliente_id, orcamento_id, data_abertura, data_inicio, data_previsao, data_conclusao, status, descricao, observacoes, valor_servico, custo_materiais, valor_total",
          { count: "exact" }
        )
        .eq("user_id", user.id)
        .order("numero", { ascending: false })
        .range(de, ate);

    if (ordensError) {
      setErroDados(true);
      console.error(
        "Erro ao carregar ordens:",
        ordensError
      );
    }

    const {
      data: orcamentosData,
      error: orcamentosError,
    } = await supabase
      .from("orcamentos")
      .select(
        "id, numero, cliente_id, data_orcamento, validade, status, desconto, valor_total, observacoes"
      )
      .eq("user_id", user.id)
      .eq("status", "Aprovado")
      .order("numero", { ascending: false });

    if (orcamentosError) {
      console.error(
        "Erro ao carregar orçamentos:",
        orcamentosError
      );
    }

    setClientes(clientesData || []);
    setOrdens(ordensData || []);
    setOrcamentos(orcamentosData || []);
    paginacao.setTotal(ordensCount ?? 0);

    setCarregando(false);
  }

  function hoje() {
    return new Date().toISOString().split("T")[0];
  }

  function nomeCliente(id: number) {
    const cliente = clientes.find(
      (item) => item.id === id
    );

    return cliente ? cliente.nome : "Cliente";
  }

  function telefoneCliente(id: number) {
    const cliente = clientes.find(
      (item) => item.id === id
    );

    return cliente?.telefone || "-";
  }

  function enderecoCliente(id: number) {
    const cliente = clientes.find(
      (item) => item.id === id
    );

    return cliente?.endereco || "-";
  }

  function abrirNovaOrdem() {
    setEditandoId(null);

    setOrigem("zero");
    setOrcamentoId("");

    setClienteId("");
    setDataAbertura(hoje());
    setDataInicio("");
    setDataPrevisao("");
    setDataConclusao("");

    setStatus(STATUS_OS.ABERTA);
    setDescricao("");
    setObservacoes("");
    setValorServico("");
    setCustoMateriais("");

    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) {
      return;
    }

    setModalAberto(false);
    setEditandoId(null);
  }

  function fecharVisualizacao() {
    setModalVisualizacao(false);
    setOrdemVisualizada(null);
    setItensVisualizados([]);
  }

  async function carregarItensOrcamento(
    idOrcamento: number
  ) {
    const { data, error } = await supabase
      .from("orcamento_itens")
      .select(
        "id, orcamento_id, tipo, servico_id, produto_id, descricao, quantidade, valor_unitario, subtotal"
      )
      .eq("orcamento_id", idOrcamento)
      .order("id");

    if (error) {
      console.error(
        "Erro ao carregar itens do orçamento:",
        error
      );

      return [];
    }

    return (data || []) as OrcamentoItem[];
  }

  async function carregarItensOS(idOS: number) {
    const { data, error } = await supabase
      .from("ordem_servico_itens")
      .select(
        "id, ordem_servico_id, tipo, servico_id, produto_id, descricao, quantidade, valor_unitario, subtotal"
      )
      .eq("ordem_servico_id", idOS)
      .order("id");

    if (error) {
      console.error(
        "Erro ao carregar itens da O.S.:",
        error
      );

      return [];
    }

    return (data || []) as ItemOS[];
  }

  async function selecionarOrcamento(id: string) {
    setOrcamentoId(id);

    if (!id) {
      setClienteId("");
      setDescricao("");
      setObservacoes("");
      setValorServico("");
      setCustoMateriais("");

      return;
    }

    const orcamento = orcamentos.find(
      (item) => item.id === Number(id)
    );

    if (!orcamento) {
      return;
    }

    setClienteId(
      String(orcamento.cliente_id)
    );

    const itens = await carregarItensOrcamento(
      orcamento.id
    );

    let totalServicos = 0;
    let totalMateriais = 0;

    const linhas: string[] = [];

    itens.forEach((item) => {
      const subtotal = Number(item.subtotal) || 0;

      if (item.tipo === "servico") {
        totalServicos += subtotal;
      }

      if (item.tipo === "produto") {
        totalMateriais += subtotal;
      }

      linhas.push(
        String(Number(item.quantidade) || 0) +
          "x " +
          item.descricao +
          " - " +
          formatarMoeda(
            Number(item.valor_unitario) || 0
          )
      );
    });

    setValorServico(String(totalServicos));
    setCustoMateriais(String(totalMateriais));
    setDescricao(linhas.join("\n"));
    setObservacoes(
      orcamento.observacoes || ""
    );
  }

  async function salvarOrdem() {
    if (salvando) {
      return;
    }

    setSalvando(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        mostrarToast("Usuário não encontrado.", "erro");
        return;
      }

      if (!clienteId) {
        mostrarToast("Selecione um cliente.", "alerta");
        return;
      }

      if (!descricao.trim()) {
        mostrarToast("Informe a descrição do serviço.", "alerta");
        return;
      }

      const valorServicoNumerico =
        Number(valorServico) || 0;

      const custoMateriaisNumerico =
        Number(custoMateriais) || 0;

      const valorTotal =
        valorServicoNumerico +
        custoMateriaisNumerico;

      if (editandoId) {
        const { error } = await supabase
          .from("ordens_servico")
          .update({
            cliente_id: Number(clienteId),
            data_abertura: dataAbertura,
            data_inicio: dataInicio || null,
            data_previsao: dataPrevisao || null,
            data_conclusao:
              dataConclusao || null,
            status: status,
            descricao: descricao.trim(),
            observacoes:
              observacoes.trim() || null,
            valor_servico:
              valorServicoNumerico,
            custo_materiais:
              custoMateriaisNumerico,
            valor_total: valorTotal,
          })
          .eq("id", editandoId)
          .eq("user_id", user.id);

        if (error) {
          console.error(error);

          mostrarToast(
            "Não foi possível atualizar a O.S.",
            "erro"
          );

          return;
        }

        mostrarToast(
          "Ordem de serviço atualizada com sucesso!",
          "sucesso"
        );

        setModalAberto(false);
        setEditandoId(null);

        await carregarDados();

        return;
      }

      let itensOrcamento: OrcamentoItem[] = [];
      let orcamentoSelecionado:
        Orcamento | null = null;

      if (origem === "orcamento") {
        if (!orcamentoId) {
          mostrarToast(
            "Selecione um orçamento aprovado.",
            "alerta"
          );

          return;
        }

        orcamentoSelecionado =
          orcamentos.find(
            (item) =>
              item.id === Number(orcamentoId)
          ) || null;

        if (!orcamentoSelecionado) {
          mostrarToast(
            "Orçamento não encontrado.",
            "erro"
          );

          return;
        }

        itensOrcamento =
          await carregarItensOrcamento(
            orcamentoSelecionado.id
          );
      }

      const {
        data: ultimaOrdem,
        error: erroNumero,
      } = await supabase
        .from("ordens_servico")
        .select("numero")
        .eq("user_id", user.id)
        .order("numero", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (erroNumero) {
        console.error(erroNumero);

        mostrarToast(
          "Não foi possível gerar o número da O.S.",
          "erro"
        );

        return;
      }

      const proximoNumero = ultimaOrdem
        ? Number(ultimaOrdem.numero) + 1
        : 1;

      let valorTotalFinal = valorTotal;

      if (
        origem === "orcamento" &&
        orcamentoSelecionado
      ) {
        valorTotalFinal =
          Number(
            orcamentoSelecionado.valor_total
          ) || valorTotal;
      }

      const {
        data: novaOrdem,
        error: erroOrdem,
      } = await supabase
        .from("ordens_servico")
        .insert({
          numero: proximoNumero,
          cliente_id: Number(clienteId),
          orcamento_id:
            origem === "orcamento"
              ? Number(orcamentoId)
              : null,
          data_abertura: dataAbertura,
          data_inicio: dataInicio || null,
          data_previsao:
            dataPrevisao || null,
          data_conclusao:
            dataConclusao || null,
          status: status,
          descricao: descricao.trim(),
          observacoes:
            observacoes.trim() || null,
          valor_servico:
            valorServicoNumerico,
          custo_materiais:
            custoMateriaisNumerico,
          valor_total: valorTotalFinal,
          user_id: user.id,
        })
        .select("id")
        .single();

      if (erroOrdem || !novaOrdem) {
        console.error(erroOrdem);

        mostrarToast(
          "Não foi possível cadastrar a ordem de serviço.",
          "erro"
        );

        return;
      }

      if (itensOrcamento.length > 0) {
        const itensParaInserir =
          itensOrcamento.map((item) => ({
            ordem_servico_id:
              novaOrdem.id,
            tipo: item.tipo,
            servico_id:
              item.servico_id,
            produto_id:
              item.produto_id,
            descricao:
              item.descricao,
            quantidade:
              Number(item.quantidade) || 1,
            valor_unitario:
              Number(
                item.valor_unitario
              ) || 0,
            subtotal:
              Number(item.subtotal) || 0,
            user_id: user.id,
          }));

        const { error: erroItens } =
          await supabase
            .from(
              "ordem_servico_itens"
            )
            .insert(itensParaInserir);

        if (erroItens) {
          console.error(erroItens);

          await supabase
            .from("ordens_servico")
            .delete()
            .eq(
              "id",
              novaOrdem.id
            );

          mostrarToast(
            "A O.S. não foi criada porque os itens não puderam ser copiados.",
            "erro"
          );

          return;
        }
      }

      mostrarToast(
        "Ordem de serviço cadastrada com sucesso!",
        "sucesso"
      );

      setModalAberto(false);

      await carregarDados();
    } finally {
      setSalvando(false);
    }
  }

  async function visualizarOrdem(
    ordem: OrdemServico
  ) {
    setOrdemVisualizada(ordem);
    setModalVisualizacao(true);
    setCarregandoItens(true);

    const itens = await carregarItensOS(
      ordem.id
    );

    setItensVisualizados(itens);
    setCarregandoItens(false);
  }

  async function editarOrdem(
    ordem: OrdemServico
  ) {
    setEditandoId(ordem.id);

    setOrigem(
      ordem.orcamento_id
        ? "orcamento"
        : "zero"
    );

    setOrcamentoId(
      ordem.orcamento_id
        ? String(ordem.orcamento_id)
        : ""
    );

    setClienteId(
      String(ordem.cliente_id)
    );

    setDataAbertura(
      ordem.data_abertura
    );

    setDataInicio(
      ordem.data_inicio || ""
    );

    setDataPrevisao(
      ordem.data_previsao || ""
    );

    setDataConclusao(
      ordem.data_conclusao || ""
    );

    setStatus(ordem.status as StatusOS);

    setDescricao(
      ordem.descricao || ""
    );

    setObservacoes(
      ordem.observacoes || ""
    );

    setValorServico(
      String(
        Number(ordem.valor_servico) || 0
      )
    );

    setCustoMateriais(
      String(
        Number(
          ordem.custo_materiais
        ) || 0
      )
    );

    setModalAberto(true);
  }

  async function confirmarConclusao() {
    if (!ordemParaConcluir) return;

    setConcluindo(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        mostrarToast("Usuário não encontrado.", "erro");
        setConcluindo(false);
        return;
      }

      const { error } = await supabase
        .from("ordens_servico")
        .update({
          status: "Concluída",
          data_conclusao: hoje(),
        })
        .eq("id", ordemParaConcluir.id)
        .eq("user_id", user.id);

      if (error) {
        console.error(error);
        mostrarToast(
          "Não foi possível concluir a O.S.",
          "erro"
        );
        setConcluindo(false);
        return;
      }

      mostrarToast(
        `O.S. #${String(ordemParaConcluir.numero).padStart(
          4,
          "0"
        )} concluída com sucesso!`,
        "sucesso"
      );
      setOrdemParaConcluir(null);
      await carregarDados();
    } finally {
      setConcluindo(false);
    }
  }

  async function confirmarReabertura() {
    if (!ordemParaReabrir) return;

    setReabrindo(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        mostrarToast("Usuário não encontrado.", "erro");
        setReabrindo(false);
        return;
      }

      const { error } = await supabase
        .from("ordens_servico")
        .update({
          status: "Em andamento",
          data_conclusao: null,
        })
        .eq("id", ordemParaReabrir.id)
        .eq("user_id", user.id);

      if (error) {
        console.error(error);
        mostrarToast(
          "Não foi possível reabrir a O.S.",
          "erro"
        );
        setReabrindo(false);
        return;
      }

      mostrarToast(
        `O.S. #${String(ordemParaReabrir.numero).padStart(
          4,
          "0"
        )} reaberta com sucesso!`,
        "sucesso"
      );
      setOrdemParaReabrir(null);
      await carregarDados();
    } finally {
      setReabrindo(false);
    }
  }

  async function abrirHistorico(ordem: OrdemServico) {
    setOrdemHistorico(ordem);
    setCarregandoHistorico(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      mostrarToast("Usuário não autenticado.", "erro");
      setCarregandoHistorico(false);
      return;
    }

    const [statusRes, estoqueRes] = await Promise.all([
      supabase
        .from("historico_status_os")
        .select("id, status_anterior, status_novo, observacao, created_at")
        .eq("user_id", user.id)
        .eq("ordem_servico_id", ordem.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("estoque_movimentacoes")
        .select(
          "id, produto_id, tipo, quantidade, estoque_anterior, estoque_posterior, observacao, created_at, produtos(nome)"
        )
        .eq("user_id", user.id)
        .eq("ordem_servico_id", ordem.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    setCarregandoHistorico(false);

    if (statusRes.error) {
      console.error("Erro ao carregar histórico de status:", statusRes.error);
    }
    if (estoqueRes.error) {
      console.error("Erro ao carregar histórico de estoque:", estoqueRes.error);
    }

    setHistoricoStatus(statusRes.data || []);

    // Mapear produtos (join pode não vir completo dependendo da config)
    type MovComProduto = {
      id: number;
      produto_id: number | null;
      tipo: string;
      quantidade: number;
      estoque_anterior: number;
      estoque_posterior: number;
      observacao: string | null;
      created_at: string;
      produtos: { nome: string } | { nome: string }[] | null;
    };
    const movsRaw = (estoqueRes.data as unknown as MovComProduto[]) || [];
    setHistoricoEstoque(
      movsRaw.map((m) => ({
        id: m.id,
        produto_id: m.produto_id,
        produto_nome: Array.isArray(m.produtos)
          ? m.produtos[0]?.nome ?? null
          : m.produtos?.nome ?? null,
        tipo: m.tipo,
        quantidade: m.quantidade,
        estoque_anterior: m.estoque_anterior,
        estoque_posterior: m.estoque_posterior,
        observacao: m.observacao,
        created_at: m.created_at,
      }))
    );
  }

  function fecharHistorico() {
    setOrdemHistorico(null);
    setHistoricoStatus([]);
    setHistoricoEstoque([]);
  }

  async function confirmarExclusao() {
    if (!ordemParaExcluir) return;

    setExcluindo(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        mostrarToast("Usuário não encontrado.", "erro");
        setExcluindo(false);
        return;
      }

      const { error } = await supabase
        .from("ordens_servico")
        .delete()
        .eq("id", ordemParaExcluir.id)
        .eq("user_id", user.id);

      if (error) {
        console.error(error);
        mostrarToast(
          "Não foi possível excluir a ordem de serviço.",
          "erro"
        );
        setExcluindo(false);
        return;
      }

      mostrarToast(
        `O.S. #${String(ordemParaExcluir.numero).padStart(
          4,
          "0"
        )} excluída com sucesso.`,
        "sucesso"
      );
      setOrdemParaExcluir(null);
      await carregarDados();
    } finally {
      setExcluindo(false);
    }
  }

  const orcamentoSelecionadoAtual =
    orcamentos.find(
      (item) =>
        item.id === Number(orcamentoId)
    );

  const valorTotalFormulario =
    origem === "orcamento" &&
    orcamentoSelecionadoAtual &&
    !editandoId
      ? Number(
          orcamentoSelecionadoAtual.valor_total
        ) || 0
      : (Number(valorServico) || 0) +
        (Number(custoMateriais) || 0);

  const ordensFiltradas = ordens.filter((ordem) => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const texto = [formatarNumero(ordem.numero), nomeCliente(ordem.cliente_id), enderecoCliente(ordem.cliente_id), ordem.descricao || ""].join(" ").toLocaleLowerCase("pt-BR");
    return (!termo || texto.includes(termo)) && (filtroStatus === "todos" || ordem.status === filtroStatus);
  }).sort((a, b) => ordenacao === "previsao"
    ? (a.data_previsao || "9999").localeCompare(b.data_previsao || "9999")
    : ordenacao === "valor" ? Number(b.valor_total) - Number(a.valor_total) : b.numero - a.numero);
  const emExecucao = ordens.filter((ordem) => ordem.status === STATUS_OS.EM_ANDAMENTO);
  const pendentes = ordens.filter((ordem) => ordem.status === STATUS_OS.ABERTA);
  const atrasadas = ordens.filter((ordem) => ordem.data_previsao && ordem.data_previsao < hoje() && ordem.status !== STATUS_OS.CONCLUIDA && ordem.status !== STATUS_OS.CANCELADA);
  const tomStatus = (valor: string) => valor === STATUS_OS.CONCLUIDA ? "success" : valor === STATUS_OS.CANCELADA ? "danger" : valor === STATUS_OS.EM_ANDAMENTO ? "warning" : "neutral";
  const prazoOrdem = (ordem: OrdemServico) => ordem.status === STATUS_OS.CONCLUIDA
    ? `Concluída ${formatarData(ordem.data_conclusao)}`
    : ordem.data_previsao ? `Previsão ${formatarData(ordem.data_previsao)}` : "Previsão não definida";
  function acoesOrdem(ordem: OrdemServico) {
    return <div className="row-actions">
      <button type="button" className="btn-secondary" onClick={() => visualizarOrdem(ordem)} aria-label={`Abrir O.S. ${formatarNumero(ordem.numero)}`}>Abrir</button>
      <details className="relative" onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}>
        <summary className="icon-button list-none cursor-pointer [&::-webkit-details-marker]:hidden" aria-label={`Mais ações da O.S. ${formatarNumero(ordem.numero)}`}><MoreHorizontal className="w-5 h-5" aria-hidden="true" /></summary>
        <div className="absolute right-0 top-full z-30 mt-1 w-52 border border-[var(--color-border)] bg-white p-1 shadow-lg rounded-lg" onClick={(event) => { if ((event.target as HTMLElement).closest("button")) event.currentTarget.parentElement?.removeAttribute("open"); }}>
          <button type="button" onClick={() => editarOrdem(ordem)} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50"><Pencil className="w-4 h-4" aria-hidden="true" />Editar O.S.</button>
          <button type="button" onClick={() => abrirHistorico(ordem)} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50"><History className="w-4 h-4" aria-hidden="true" />Ver histórico</button>
          {ordem.status !== STATUS_OS.CONCLUIDA && ordem.status !== STATUS_OS.CANCELADA && <button type="button" onClick={() => setOrdemParaConcluir(ordem)} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50"><CheckCircle2 className="w-4 h-4" aria-hidden="true" />Concluir O.S.</button>}
          {ordem.status === STATUS_OS.CONCLUIDA && <button type="button" onClick={() => setOrdemParaReabrir(ordem)} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50"><RotateCcw className="w-4 h-4" aria-hidden="true" />Reabrir O.S.</button>}
          <button type="button" onClick={() => setOrdemParaExcluir(ordem)} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-red-700 border-t border-slate-100 hover:bg-red-50"><Trash2 className="w-4 h-4" aria-hidden="true" />Excluir O.S.</button>
        </div>
      </details>
    </div>;
  }

  return (
    <div className="product-page">
      <header className="page-header">
        <div><h1>Ordens de serviço</h1><p>Da abertura à entrega, acompanhe cada execução.</p></div>
        <div className="page-actions"><button type="button" onClick={abrirNovaOrdem} className="btn-primary"><Plus className="w-4 h-4" aria-hidden="true" />Nova O.S.</button></div>
      </header>

      <div className="metric-strip" aria-label="Resumo das ordens nesta página">
        <div className="metric"><span>Em execução nesta página</span><strong>{carregando ? "—" : emExecucao.length}</strong><small>Serviços em andamento</small></div>
        <div className="metric"><span>A iniciar</span><strong>{carregando ? "—" : pendentes.length}</strong><small>Ordens abertas nesta página</small></div>
        <div className="metric"><span>Previsão vencida</span><strong>{carregando ? "—" : atrasadas.length}</strong><small>Ordens ativas nesta página</small></div>
      </div>

      <section className="data-panel" aria-label="Lista de ordens de serviço">
        <div className="data-toolbar">
          <div className="min-w-0 flex-1"><label htmlFor="os_busca" className="field-label">Buscar nesta página</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" /><input id="os_busca" value={busca} onChange={(event) => setBusca(event.target.value)} className="input-base w-full pl-10" placeholder="Nº, cliente, local ou serviço" /></div></div>
          <div><label htmlFor="os_ordenacao" className="field-label">Ordenar nesta página</label><select id="os_ordenacao" value={ordenacao} onChange={(event) => setOrdenacao(event.target.value)} className="input-base w-full"><option value="numero">Mais recentes</option><option value="previsao">Próxima previsão</option><option value="valor">Maior valor</option></select></div>
        </div>
        <div className="filter-tabs" aria-label="Filtrar status nesta página">
          <button type="button" aria-pressed={filtroStatus === "todos"} onClick={() => setFiltroStatus("todos")}>Todas</button>
          {STATUS_OS_VALORES.map((valor) => <button type="button" key={valor} aria-pressed={filtroStatus === valor} onClick={() => setFiltroStatus(valor)}>{valor}</button>)}
        </div>
        {carregando ? <div className="empty-state" role="status"><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /><p>Carregando ordens de serviço...</p></div>
          : erroDados ? <div className="empty-state" role="alert"><h2>Não foi possível carregar as ordens</h2><p>Confira sua conexão e tente novamente.</p><button className="btn-secondary" onClick={carregarDados}>Tentar novamente</button></div>
          : ordensFiltradas.length === 0 ? <div className="empty-state"><h2>{ordens.length ? "Nenhuma ordem neste filtro" : "Organize seu próximo serviço"}</h2><p>{ordens.length ? "Ajuste a busca ou o status para ver outras ordens desta página." : "Abra uma O.S. independente ou aproveite os dados de um orçamento aprovado."}</p><button className="btn-secondary" onClick={ordens.length ? () => { setBusca(""); setFiltroStatus("todos"); } : abrirNovaOrdem}>{ordens.length ? "Limpar filtros" : "Criar primeira O.S."}</button></div>
          : <>
            <div className="hidden xl:block">
              <table className="data-table w-full"><thead><tr><th scope="col">Serviço / cliente</th><th scope="col">Execução</th><th scope="col">Status</th><th scope="col" className="text-right">Valor</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
                <tbody>{ordensFiltradas.map((ordem) => <tr key={ordem.id}>
                  <td><div className="record-meta">O.S. #{formatarNumero(ordem.numero)}</div><div className="record-primary">{nomeCliente(ordem.cliente_id)}</div><div className="record-meta max-w-sm truncate" title={enderecoCliente(ordem.cliente_id)}>{enderecoCliente(ordem.cliente_id) === "-" ? "Endereço não informado" : enderecoCliente(ordem.cliente_id)}</div><p className="text-sm mt-1 text-slate-600 max-w-sm truncate">{ordem.descricao || "Sem descrição"}</p></td>
                  <td><div className="text-sm font-medium">{prazoOrdem(ordem)}</div><div className="record-meta">Abertura {formatarData(ordem.data_abertura)}</div>{ordem.data_inicio && <div className="record-meta">Início {formatarData(ordem.data_inicio)}</div>}</td>
                  <td><span className="status-label" data-tone={tomStatus(ordem.status)}>{ordem.status}</span></td>
                  <td className="text-right font-semibold tabular-nums whitespace-nowrap">{formatarMoeda(Number(ordem.valor_total) || 0)}</td>
                  <td>{acoesOrdem(ordem)}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <div className="xl:hidden">{ordensFiltradas.map((ordem) => <article key={ordem.id} className="record-row">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="record-meta">O.S. #{formatarNumero(ordem.numero)}</div><h2 className="record-primary">{nomeCliente(ordem.cliente_id)}</h2></div><span className="status-label shrink-0" data-tone={tomStatus(ordem.status)}>{ordem.status}</span></div>
              <p className="record-meta mt-1">{enderecoCliente(ordem.cliente_id) === "-" ? "Endereço não informado" : enderecoCliente(ordem.cliente_id)}</p><p className="text-sm mt-2 text-slate-700 line-clamp-2">{ordem.descricao || "Sem descrição"}</p>
              <div className="flex flex-wrap justify-between gap-2 mt-3"><span className="record-meta">{prazoOrdem(ordem)}</span><strong className="tabular-nums">{formatarMoeda(Number(ordem.valor_total) || 0)}</strong></div>
              <div className="mt-3">{acoesOrdem(ordem)}</div>
            </article>)}</div>
          </>}
        {!carregando && !erroDados && ordens.length > 0 && <div className="px-4 pt-4 text-xs text-slate-500">{ordensFiltradas.length} de {ordens.length} ordens nesta página. Busca, status e ordenação se aplicam a esta página.</div>}
        <ControlesPaginacao pagina={paginacao.pagina} totalPaginas={paginacao.totalPaginas} total={paginacao.total} tamanho={paginacao.tamanho} onAnterior={paginacao.anterior} onProxima={paginacao.proxima} onMudarTamanho={paginacao.setTamanho} />
      </section>

      {modalAberto && (
        <Modal
          title={editandoId ? "Editar ordem de serviço" : "Nova ordem de serviço"}
          description={editandoId ? "Atualize os dados de execução e os valores do serviço." : "Defina o cliente, o trabalho e a previsão de entrega."}
          onClose={fecharModal}
          busy={salvando}
          wide
          footer={<><div className="mr-auto"><p className="record-meta">Total da O.S.</p><strong className="text-xl tabular-nums">{formatarMoeda(valorTotalFormulario)}</strong></div><button type="button" onClick={fecharModal} disabled={salvando} className="btn-secondary">Cancelar</button><button type="button" onClick={salvarOrdem} disabled={salvando} className="btn-primary">{salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Salvar O.S."}</button></>}
        >
          <section className="form-section">
            <h3>Cliente e origem</h3><p>Vincule o serviço a um cliente e, se houver, a um orçamento aprovado.</p>
            {!editandoId && <div className="grid sm:grid-cols-2 gap-3 mb-5" aria-label="Origem da ordem">
              <button type="button" aria-pressed={origem === "zero"} onClick={() => { setOrigem("zero"); setOrcamentoId(""); setClienteId(""); setDescricao(""); setObservacoes(""); setValorServico(""); setCustoMateriais(""); }} className={`text-left p-4 border rounded-lg ${origem === "zero" ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10" : "border-[var(--color-border)] hover:bg-slate-50"}`}><strong className="block text-sm">Ordem independente</strong><span className="record-meta">Preencha os dados do serviço</span></button>
              <button type="button" aria-pressed={origem === "orcamento"} onClick={() => setOrigem("orcamento")} className={`text-left p-4 border rounded-lg ${origem === "orcamento" ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10" : "border-[var(--color-border)] hover:bg-slate-50"}`}><strong className="block text-sm">A partir de orçamento</strong><span className="record-meta">Aproveite cliente, serviços e materiais</span></button>
            </div>}
            <div className="form-grid">
              {!editandoId && origem === "orcamento" && <div className="sm:col-span-2"><label htmlFor="os_orcamento" className="field-label">Orçamento aprovado *</label>{orcamentos.length === 0 ? <p className="inline-alert">Nenhum orçamento aprovado disponível.</p> : <select id="os_orcamento" value={orcamentoId} onChange={(event) => selecionarOrcamento(event.target.value)} className="input-base w-full" aria-required="true"><option value="">Selecione um orçamento</option>{orcamentos.map((orcamento) => <option key={orcamento.id} value={orcamento.id}>#{formatarNumero(orcamento.numero)} — {nomeCliente(orcamento.cliente_id)} — {formatarMoeda(Number(orcamento.valor_total) || 0)}</option>)}</select>}</div>}
              <div className="sm:col-span-2"><label htmlFor="os_cliente" className="field-label">Cliente *</label><select id="os_cliente" value={clienteId} onChange={(event) => setClienteId(event.target.value)} disabled={!editandoId && origem === "orcamento" && !!orcamentoId} className="input-base w-full" aria-required="true"><option value="">Selecione um cliente</option>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}</select>{clienteId && <p className="record-meta mt-2">{enderecoCliente(Number(clienteId)) === "-" ? "Endereço não informado no cadastro do cliente." : enderecoCliente(Number(clienteId))}</p>}</div>
            </div>
          </section>
          <section className="form-section">
            <h3>Serviço e execução</h3><p>Descreva o trabalho e acompanhe as datas de execução.</p>
            <div className="form-grid">
              <div className="sm:col-span-2"><label htmlFor="os_descricao" className="field-label">Descrição do serviço *</label><textarea id="os_descricao" value={descricao} onChange={(event) => setDescricao(event.target.value)} rows={4} aria-required="true" placeholder="Descreva o serviço a executar..." className="input-base w-full resize-y" /></div>
              <div><label htmlFor="os_data_abertura" className="field-label">Data de abertura *</label><input id="os_data_abertura" type="date" value={dataAbertura} onChange={(event) => setDataAbertura(event.target.value)} className="input-base w-full" aria-required="true" /></div>
              <div><label htmlFor="os_status" className="field-label">Status</label><select id="os_status" value={status} onChange={(event) => setStatus(event.target.value as StatusOS)} className="input-base w-full">{STATUS_OS_VALORES.map((valor) => <option key={valor} value={valor}>{valor}</option>)}</select></div>
              <div><label htmlFor="os_data_inicio" className="field-label">Data de início</label><input id="os_data_inicio" type="date" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} className="input-base w-full" /></div>
              <div><label htmlFor="os_data_previsao" className="field-label">Previsão de conclusão</label><input id="os_data_previsao" type="date" value={dataPrevisao} onChange={(event) => setDataPrevisao(event.target.value)} className="input-base w-full" /></div>
              {status === STATUS_OS.CONCLUIDA && <div><label htmlFor="os_data_conclusao" className="field-label">Data de conclusão</label><input id="os_data_conclusao" type="date" value={dataConclusao} onChange={(event) => setDataConclusao(event.target.value)} className="input-base w-full" /></div>}
            </div>
          </section>
          <section className="form-section">
            <h3>Valores e observações</h3><p>Separe mão de obra e materiais para acompanhar o valor do serviço.</p>
            <div className="form-grid">
              <div><label htmlFor="os_valor" className="field-label">Valor do serviço (R$)</label><input id="os_valor" type="number" step="0.01" min="0" value={valorServico} onChange={(event) => setValorServico(event.target.value)} className="input-base w-full" /></div>
              <div><label htmlFor="os_custo" className="field-label">Custo dos materiais (R$)</label><input id="os_custo" type="number" step="0.01" min="0" value={custoMateriais} onChange={(event) => setCustoMateriais(event.target.value)} className="input-base w-full" /></div>
              <div className="sm:col-span-2"><label htmlFor="os_observacoes" className="field-label">Observações</label><textarea id="os_observacoes" value={observacoes} onChange={(event) => setObservacoes(event.target.value)} rows={3} placeholder="Condições de acesso, cuidados e outras informações..." className="input-base w-full resize-y" /></div>
            </div>
          </section>
        </Modal>
      )}

      {modalVisualizacao && ordemVisualizada && <Modal
        title={`O.S. #${formatarNumero(ordemVisualizada.numero)}`}
        description="Registro de execução do serviço"
        onClose={fecharVisualizacao}
        wide
        footer={<><button type="button" className="btn-secondary" onClick={() => { fecharVisualizacao(); editarOrdem(ordemVisualizada); }}>Editar O.S.</button>{ordemVisualizada.status !== STATUS_OS.CONCLUIDA && ordemVisualizada.status !== STATUS_OS.CANCELADA && <button type="button" className="btn-primary" onClick={() => { fecharVisualizacao(); setOrdemParaConcluir(ordemVisualizada); }}><CheckCircle2 className="w-4 h-4" aria-hidden="true" />Concluir O.S.</button>}<button type="button" className="btn-secondary" onClick={fecharVisualizacao}>Fechar</button></>}
      >
        <section className="form-section">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="record-meta">Cliente e local</p><h3>{nomeCliente(ordemVisualizada.cliente_id)}</h3><p className="mt-2 text-sm text-slate-600">{enderecoCliente(ordemVisualizada.cliente_id)}</p><p className="text-sm text-slate-600">{telefoneCliente(ordemVisualizada.cliente_id)}</p></div>
            <div className="sm:text-right"><span className="status-label" data-tone={tomStatus(ordemVisualizada.status)}>{ordemVisualizada.status}</span><p className="record-meta mt-3">{ordemVisualizada.orcamento_id ? "Vinculada a orçamento" : "Ordem independente"}</p></div>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-[var(--color-border)] mt-6 pt-5">
            {[["Abertura", ordemVisualizada.data_abertura], ["Início", ordemVisualizada.data_inicio], ["Previsão", ordemVisualizada.data_previsao], ["Conclusão", ordemVisualizada.data_conclusao]].map(([rotulo, data]) => <div key={rotulo}><dt className="record-meta">{rotulo}</dt><dd className="font-medium text-sm mt-1 tabular-nums">{formatarData(data)}</dd></div>)}
          </dl>
        </section>
        <section className="form-section"><h3>Escopo do serviço</h3><p className="whitespace-pre-line text-sm text-slate-700">{ordemVisualizada.descricao || "Descrição não informada."}</p></section>
        <section className="form-section">
          <h3>Serviços e materiais</h3>
          {carregandoItens ? <p role="status" className="record-meta">Carregando itens...</p> : itensVisualizados.length === 0 ? <p className="record-meta">Esta ordem não possui itens vinculados.</p> : <div className="divide-y divide-[var(--color-border)]">
            {itensVisualizados.map((item, index) => <div key={item.id ?? index} className="py-3 flex items-start justify-between gap-4"><div className="min-w-0"><p className="record-primary">{item.descricao}</p><p className="record-meta">{item.tipo === "servico" ? "Serviço" : "Material"} · {item.quantidade} × {formatarMoeda(Number(item.valor_unitario) || 0)}</p></div><strong className="shrink-0 text-sm tabular-nums">{formatarMoeda(Number(item.subtotal) || 0)}</strong></div>)}
          </div>}
          <dl className="border-t border-[var(--color-border)] mt-4 pt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt>Serviço</dt><dd className="tabular-nums">{formatarMoeda(Number(ordemVisualizada.valor_servico) || 0)}</dd></div><div className="flex justify-between gap-4"><dt>Materiais</dt><dd className="tabular-nums">{formatarMoeda(Number(ordemVisualizada.custo_materiais) || 0)}</dd></div><div className="flex justify-between gap-4 pt-3 border-t border-[var(--color-border)] font-bold text-xl"><dt>Total da O.S.</dt><dd className="tabular-nums">{formatarMoeda(Number(ordemVisualizada.valor_total) || 0)}</dd></div></dl>
        </section>
        <section className="form-section"><h3>Observações</h3><p className="whitespace-pre-line text-sm text-slate-600">{ordemVisualizada.observacoes || "Nenhuma observação."}</p></section>
      </Modal>}

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        aberto={ordemParaExcluir !== null}
        titulo="Excluir ordem de serviço?"
        descricao={
          ordemParaExcluir ? (
            <>
              Tem certeza que deseja excluir a O.S.{" "}
              <strong className="text-gray-900">
                #{formatarNumero(ordemParaExcluir.numero)}
              </strong>{" "}
              do valor de{" "}
              <strong className="text-gray-900">
                {formatarMoeda(
                  Number(ordemParaExcluir.valor_total) || 0
                )}
              </strong>
              ? Esta ação não pode ser desfeita.
            </>
          ) : null
        }
        textoBotaoConfirmar="Excluir"
        corBotaoConfirmar="vermelho"
        carregando={excluindo}
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setOrdemParaExcluir(null)}
      />

      {/* Confirmação de conclusão */}
      <ConfirmDialog
        aberto={ordemParaConcluir !== null}
        titulo="Concluir ordem de serviço?"
        descricao={
          ordemParaConcluir ? (
            <>
              Marcar a O.S.{" "}
              <strong className="text-gray-900">
                #{formatarNumero(ordemParaConcluir.numero)}
              </strong>{" "}
              como concluída? A data de conclusão será preenchida
              automaticamente.
            </>
          ) : null
        }
        textoBotaoConfirmar="Concluir"
        corBotaoConfirmar="amarelo"
        carregando={concluindo}
        aoConfirmar={confirmarConclusao}
        aoCancelar={() => setOrdemParaConcluir(null)}
      />

      {/* Confirmação de reabertura */}
      <ConfirmDialog
        aberto={ordemParaReabrir !== null}
        titulo="Reabrir ordem de serviço?"
        descricao={
          ordemParaReabrir ? (
            <>
              Reabrir a O.S.{" "}
              <strong className="text-gray-900">
                #{formatarNumero(ordemParaReabrir.numero)}
              </strong>
              ? O status voltará para "Em andamento" e a data de
              conclusão será removida.
            </>
          ) : null
        }
        textoBotaoConfirmar="Reabrir"
        corBotaoConfirmar="amarelo"
        carregando={reabrindo}
        aoConfirmar={confirmarReabertura}
        aoCancelar={() => setOrdemParaReabrir(null)}
      />

      {ordemHistorico && <Modal
        title={`Histórico da O.S. #${formatarNumero(ordemHistorico.numero)}`}
        description="Mudanças de status e movimentações de estoque"
        onClose={fecharHistorico}
        footer={<button type="button" className="btn-secondary" onClick={fecharHistorico}>Fechar</button>}
      >
        {carregandoHistorico ? <p role="status" className="empty-state">Carregando histórico...</p> : <>
          <section className="form-section"><h3 className="flex items-center gap-2"><Clock className="w-4 h-4" aria-hidden="true" />Mudanças de status</h3>
            {historicoStatus.length === 0 ? <p className="record-meta">Nenhuma mudança registrada.</p> : <ol className="border-l border-[var(--color-border)] ml-1 mt-4">{historicoStatus.map((item) => <li key={item.id} className="relative pl-5 pb-6 last:pb-0"><span className="absolute -left-1 top-2 w-2 h-2 rounded-full bg-[var(--color-nav)]" /><p className="text-sm font-medium">{item.status_anterior && <span className="text-slate-500">{item.status_anterior} → </span>}{item.status_novo}</p><p className="record-meta mt-1">{new Date(item.created_at).toLocaleString("pt-BR")}</p>{item.observacao && <p className="text-sm text-slate-600 mt-2">{item.observacao}</p>}</li>)}</ol>}
          </section>
          <section className="form-section"><h3 className="flex items-center gap-2"><Boxes className="w-4 h-4" aria-hidden="true" />Movimentações de estoque</h3>
            {historicoEstoque.length === 0 ? <p className="record-meta">Nenhuma movimentação registrada.</p> : <div className="divide-y divide-[var(--color-border)]">{historicoEstoque.map((mov) => <div key={mov.id} className="py-4"><div className="flex justify-between gap-3"><p className="record-primary">{mov.produto_nome || "Produto"}</p><span className="status-label" data-tone={mov.tipo === "entrada" ? "success" : mov.tipo === "saida" ? "warning" : "neutral"}>{mov.tipo === "entrada" ? "Entrada +" : mov.tipo === "saida" ? "Saída −" : "Ajuste "}{mov.quantidade}</span></div><p className="record-meta mt-1">Estoque: {mov.estoque_anterior} → {mov.estoque_posterior}</p><p className="record-meta">{new Date(mov.created_at).toLocaleString("pt-BR")}</p>{mov.observacao && <p className="text-sm text-slate-600 mt-2">{mov.observacao}</p>}</div>)}</div>}
          </section>
        </>}
      </Modal>}

    </div>
  );
}
