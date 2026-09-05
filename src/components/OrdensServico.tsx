import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import {
  Wrench,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  RotateCcw,
  History,
  Clock,
  Boxes,
  X,
} from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./ui/toast";

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
    useState("Aberta");

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
  }, []);

  async function carregarDados() {
    setCarregando(true);

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

    const { data: ordensData, error: ordensError } =
      await supabase
        .from("ordens_servico")
        .select(
          "id, numero, cliente_id, orcamento_id, data_abertura, data_inicio, data_previsao, data_conclusao, status, descricao, observacoes, valor_servico, custo_materiais, valor_total"
        )
        .eq("user_id", user.id)
        .order("numero", { ascending: false });

    if (ordensError) {
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

  function formatarData(data: string | null) {
    if (!data) {
      return "-";
    }

    const partes = data.split("-");

    if (partes.length !== 3) {
      return data;
    }

    return (
      partes[2] +
      "/" +
      partes[1] +
      "/" +
      partes[0]
    );
  }

  function formatarValor(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function classeStatus(statusAtual: string) {
    if (statusAtual === "Aberta") {
      return "bg-yellow-100 text-yellow-700";
    }

    if (statusAtual === "Em andamento") {
      return "bg-blue-100 text-blue-700";
    }

    if (statusAtual === "Concluída") {
      return "bg-green-100 text-green-700";
    }

    if (statusAtual === "Cancelada") {
      return "bg-red-100 text-red-700";
    }

    return "bg-gray-100 text-gray-700";
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

    setStatus("Aberta");
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
          formatarValor(
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

    setStatus(ordem.status);

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

  if (carregando) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-800">
          Ordens de Serviço
        </h1>

        <p className="text-gray-500 mt-2">
          Carregando...
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">

      <div className="flex items-center justify-between mb-8">

        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Ordens de Serviço
          </h1>

          <p className="text-gray-500 mt-1">
            Gerencie a execução dos seus serviços
          </p>
        </div>

        <button
          onClick={abrirNovaOrdem}
          className="inline-flex items-center gap-2 bg-[#FFD60A] hover:bg-yellow-400 text-[#0D1B2A] font-bold px-5 py-3 rounded-lg transition shadow-lg shadow-yellow-500/20"
        >
          <Wrench className="w-5 h-5" />
          Nova O.S.
        </button>

      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        <table className="w-full">

          <thead className="bg-gray-50 border-b border-gray-200">

            <tr>

              <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                O.S.
              </th>

              <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                Cliente
              </th>

              <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                Origem
              </th>

              <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                Data
              </th>

              <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                Status
              </th>

              <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                Valor
              </th>

              <th scope="col" className="px-6 py-4 text-right text-sm font-semibold text-gray-600">
                Ações
              </th>

            </tr>

          </thead>

          <tbody className="divide-y divide-gray-100">

            {ordens.length === 0 ? (

              <tr>

                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  Nenhuma ordem de serviço cadastrada.
                </td>

              </tr>

            ) : (

              ordens.map((ordem) => (

                <tr
                  key={ordem.id}
                  className="hover:bg-gray-50 transition"
                >

                  <td className="px-6 py-4 font-semibold text-gray-800">
                    #
                    {String(
                      ordem.numero
                    ).padStart(4, "0")}
                  </td>

                  <td className="px-6 py-4 text-gray-700">
                    {nomeCliente(
                      ordem.cliente_id
                    )}
                  </td>

                  <td className="px-6 py-4">

                    {ordem.orcamento_id ? (

                      <span className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                        Orçamento #
                        {String(
                          ordem.orcamento_id
                        ).padStart(4, "0")}
                      </span>

                    ) : (

                      <span className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                        Sem orçamento
                      </span>

                    )}

                  </td>

                  <td className="px-6 py-4 text-gray-600">
                    {formatarData(
                      ordem.data_abertura
                    )}
                  </td>

                  <td className="px-6 py-4">

                    <span
                      className={
                        "px-3 py-1 rounded-full text-sm font-medium " +
                        classeStatus(
                          ordem.status
                        )
                      }
                    >
                      {ordem.status}
                    </span>

                  </td>

                  <td className="px-6 py-4 font-medium text-gray-700">
                    {formatarValor(
                      Number(
                        ordem.valor_total
                      ) || 0
                    )}
                  </td>

                  <td className="px-6 py-4">

                    <div className="flex justify-end gap-2 flex-wrap">

                      <button
                        type="button"
                        onClick={() =>
                          visualizarOrdem(
                            ordem
                          )
                        }
                        title="Visualizar"
                        aria-label="Visualizar O.S."
                        className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg inline-flex items-center gap-1 transition"
                      >
                        <Eye className="w-4 h-4" />
                        Ver
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          abrirHistorico(ordem)
                        }
                        title="Histórico"
                        aria-label="Ver histórico da O.S."
                        className="px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg inline-flex items-center gap-1 transition"
                      >
                        <History className="w-4 h-4" />
                        Histórico
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          editarOrdem(
                            ordem
                          )
                        }
                        title="Editar"
                        aria-label="Editar O.S."
                        className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg inline-flex items-center gap-1 transition"
                      >
                        <Pencil className="w-4 h-4" />
                        Editar
                      </button>

                      {ordem.status !==
                        "Concluída" &&
                        ordem.status !==
                          "Cancelada" && (

                          <button
                            type="button"
                            onClick={() =>
                              setOrdemParaConcluir(ordem)
                            }
                            title="Marcar como concluída"
                            aria-label="Marcar O.S. como concluída"
                            className="px-3 py-2 text-sm text-green-700 hover:bg-green-50 rounded-lg font-medium inline-flex items-center gap-1 transition"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Concluir
                          </button>

                        )}

                      {ordem.status ===
                        "Concluída" && (

                          <button
                            type="button"
                            onClick={() =>
                              setOrdemParaReabrir(ordem)
                            }
                            title="Reabrir O.S."
                            aria-label="Reabrir O.S."
                            className="px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg inline-flex items-center gap-1 transition"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Reabrir
                          </button>

                        )}

                      <button
                        type="button"
                        onClick={() =>
                          setOrdemParaExcluir(ordem)
                        }
                        title="Excluir"
                        aria-label="Excluir O.S."
                        className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg inline-flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir
                      </button>

                    </div>

                  </td>

                </tr>

              ))

            )}

          </tbody>

        </table>

      </div>

      {/* MODAL NOVA / EDITAR */}

      {modalAberto && (

        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
          onClick={fecharModal}
        >

          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="flex items-center justify-between px-6 py-5 border-b">

              <div>

                <h2 className="text-2xl font-bold text-gray-800">
                  {editandoId
                    ? "Editar Ordem de Serviço"
                    : "Nova Ordem de Serviço"}
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  {editandoId
                    ? "Altere os dados da ordem de serviço"
                    : origem === "orcamento"
                    ? "Criar O.S. a partir de orçamento aprovado"
                    : "Criar O.S. sem orçamento"}
                </p>

              </div>

              <button
                onClick={fecharModal}
                disabled={salvando}
                className="text-gray-400 hover:text-gray-600 text-2xl disabled:opacity-50"
              >
                ×
              </button>

            </div>

            <div className="p-6 space-y-6">

              {!editandoId && (

                <div>

                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Origem da O.S. *
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                    <button
                      type="button"
                      onClick={() => {
                        setOrigem("zero");
                        setOrcamentoId("");
                        setClienteId("");
                        setDescricao("");
                        setObservacoes("");
                        setValorServico("");
                        setCustoMateriais("");
                      }}
                      className={
                        "p-4 rounded-xl border text-left transition " +
                        (origem === "zero"
                          ? "border-yellow-400 bg-yellow-50"
                          : "border-gray-300 hover:bg-gray-50")
                      }
                    >

                      <div className="font-semibold text-gray-800">
                        Criar do zero
                      </div>

                      <div className="text-sm text-gray-500 mt-1">
                        Criar uma O.S. independente
                      </div>

                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setOrigem(
                          "orcamento"
                        )
                      }
                      className={
                        "p-4 rounded-xl border text-left transition " +
                        (origem === "orcamento"
                          ? "border-yellow-400 bg-yellow-50"
                          : "border-gray-300 hover:bg-gray-50")
                      }
                    >

                      <div className="font-semibold text-gray-800">
                        A partir de orçamento
                      </div>

                      <div className="text-sm text-gray-500 mt-1">
                        Usar um orçamento aprovado
                      </div>

                    </button>

                  </div>

                </div>

              )}

              {!editandoId &&
                origem === "orcamento" && (

                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">

                    <label htmlFor="os_orcamento" className="block text-sm font-semibold text-gray-700 mb-2">
                      Orçamento aprovado <span className="text-red-500">*</span>
                    </label>

                    {orcamentos.length === 0 ? (

                      <div className="text-sm text-blue-700">
                        Nenhum orçamento aprovado disponível.
                      </div>

                    ) : (

                      <select
                        id="os_orcamento"
                        value={
                          orcamentoId
                        }
                        onChange={(e) =>
                          selecionarOrcamento(
                            e.target.value
                          )
                        }
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white"
                      >

                        <option value="">
                          Selecione um orçamento
                        </option>

                        {orcamentos.map(
                          (orcamento) => (

                            <option
                              key={
                                orcamento.id
                              }
                              value={
                                orcamento.id
                              }
                            >
                              Orçamento #
                              {String(
                                orcamento.numero
                              ).padStart(
                                4,
                                "0"
                              )}
                              {" - "}
                              {nomeCliente(
                                orcamento.cliente_id
                              )}
                              {" - "}
                              {formatarValor(
                                Number(
                                  orcamento.valor_total
                                ) || 0
                              )}
                            </option>

                          )
                        )}

                      </select>

                    )}

                  </div>

                )}

              <div>

                <label htmlFor="os_cliente" className="block text-sm font-semibold text-gray-700 mb-2">
                  Cliente <span className="text-red-500">*</span>
                </label>

                <select
                  id="os_cliente"
                  value={clienteId}
                  onChange={(e) =>
                    setClienteId(
                      e.target.value
                    )
                  }
                  disabled={
                    (!editandoId &&
                      origem ===
                        "orcamento" &&
                      !!orcamentoId)
                  }
                  className={
                    "w-full border border-gray-300 rounded-lg px-4 py-3 " +
                    ((!editandoId &&
                      origem ===
                        "orcamento" &&
                      !!orcamentoId)
                      ? "bg-gray-100"
                      : "bg-white")
                  }
                >

                  <option value="">
                    Selecione um cliente
                  </option>

                  {clientes.map(
                    (cliente) => (

                      <option
                        key={
                          cliente.id
                        }
                        value={
                          cliente.id
                        }
                      >
                        {cliente.nome}
                      </option>

                    )
                  )}

                </select>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div>

                  <label htmlFor="os_data_abertura" className="block text-sm font-semibold text-gray-700 mb-2">
                    Data de abertura <span className="text-red-500">*</span>
                  </label>

                  <input
                    id="os_data_abertura"
                    type="date"
                    value={
                      dataAbertura
                    }
                    onChange={(e) =>
                      setDataAbertura(
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  />

                </div>

                <div>

                  <label htmlFor="os_data_inicio" className="block text-sm font-semibold text-gray-700 mb-2">
                    Data de início
                  </label>

                  <input
                    id="os_data_inicio"
                    type="date"
                    value={
                      dataInicio
                    }
                    onChange={(e) =>
                      setDataInicio(
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  />

                </div>

                <div>

                  <label htmlFor="os_data_previsao" className="block text-sm font-semibold text-gray-700 mb-2">
                    Previsão de conclusão
                  </label>

                  <input
                    id="os_data_previsao"
                    type="date"
                    value={
                      dataPrevisao
                    }
                    onChange={(e) =>
                      setDataPrevisao(
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  />

                </div>

              </div>

              <div>

                <label htmlFor="os_status" className="block text-sm font-semibold text-gray-700 mb-2">
                  Status
                </label>

                <select
                  id="os_status"
                  value={status}
                  onChange={(e) =>
                    setStatus(
                      e.target.value
                    )
                  }
                  className="w-full border border-gray-300 rounded-lg px-4 py-3"
                >

                  <option value="Aberta">
                    Aberta
                  </option>

                  <option value="Em andamento">
                    Em andamento
                  </option>

                  <option value="Concluída">
                    Concluída
                  </option>

                  <option value="Cancelada">
                    Cancelada
                  </option>

                </select>

              </div>

              {editandoId &&
                status === "Concluída" && (

                  <div>

                    <label htmlFor="os_data_conclusao" className="block text-sm font-semibold text-gray-700 mb-2">
                      Data de conclusão
                    </label>

                    <input
                      id="os_data_conclusao"
                      type="date"
                      value={
                        dataConclusao
                      }
                      onChange={(e) =>
                        setDataConclusao(
                          e.target.value
                        )
                      }
                      className="w-full border border-gray-300 rounded-lg px-4 py-3"
                    />

                  </div>

                )}

              <div>

                <label htmlFor="os_descricao" className="block text-sm font-semibold text-gray-700 mb-2">
                  Descrição do serviço <span className="text-red-500">*</span>
                </label>

                <textarea
                  id="os_descricao"
                  value={
                    descricao
                  }
                  onChange={(e) =>
                    setDescricao(
                      e.target.value
                    )
                  }
                  rows={6}
                  placeholder="Descreva o serviço que será realizado..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 resize-none"
                />

              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div>

                  <label htmlFor="os_valor" className="block text-sm font-semibold text-gray-700 mb-2">
                    Valor do serviço
                  </label>

                  <input
                    id="os_valor"
                    type="number"
                    step="0.01"
                    min="0"
                    value={
                      valorServico
                    }
                    onChange={(e) =>
                      setValorServico(
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  />

                </div>

                <div>

                  <label htmlFor="os_custo" className="block text-sm font-semibold text-gray-700 mb-2">
                    Custo dos materiais
                  </label>

                  <input
                    id="os_custo"
                    type="number"
                    step="0.01"
                    min="0"
                    value={
                      custoMateriais
                    }
                    onChange={(e) =>
                      setCustoMateriais(
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  />

                </div>

                <div>

                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Valor total
                  </label>

                  <div className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 font-bold text-gray-800">
                    {formatarValor(
                      valorTotalFormulario
                    )}
                  </div>

                </div>

              </div>

              <div>

                <label htmlFor="os_observacoes" className="block text-sm font-semibold text-gray-700 mb-2">
                  Observações
                </label>

                <textarea
                  id="os_observacoes"
                  value={
                    observacoes
                  }
                  onChange={(e) =>
                    setObservacoes(
                      e.target.value
                    )
                  }
                  rows={4}
                  placeholder="Observações adicionais..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 resize-none"
                />

              </div>

            </div>

            <div className="flex justify-end gap-3 px-6 py-5 border-t bg-gray-50">

              <button
                onClick={fecharModal}
                disabled={salvando}
                className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>

              <button
                onClick={salvarOrdem}
                disabled={salvando}
                className="px-5 py-3 rounded-lg bg-[#FFD60A] text-[#0D1B2A] font-semibold hover:bg-yellow-400"
              >
                {salvando
                  ? "Salvando..."
                  : editandoId
                  ? "Salvar alterações"
                  : "Salvar O.S."}
              </button>

            </div>

          </div>

        </div>

      )}

      {/* MODAL VISUALIZAÇÃO */}

      {modalVisualizacao &&
        ordemVisualizada && (

          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
            onClick={
              fecharVisualizacao
            }
          >

            <div
              className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              onClick={(e) =>
                e.stopPropagation()
              }
            >

              <div className="flex items-center justify-between px-6 py-5 border-b">

                <div>

                  <h2 className="text-2xl font-bold text-gray-800">
                    O.S. #
                    {String(
                      ordemVisualizada.numero
                    ).padStart(4, "0")}
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    Detalhes da ordem de serviço
                  </p>

                </div>

                <button
                  onClick={
                    fecharVisualizacao
                  }
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>

              </div>

              <div className="p-6 space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div className="bg-gray-50 rounded-xl p-4">

                    <p className="text-xs text-gray-500">
                      CLIENTE
                    </p>

                    <p className="font-semibold text-gray-800 mt-1">
                      {nomeCliente(
                        ordemVisualizada.cliente_id
                      )}
                    </p>

                    <p className="text-sm text-gray-600 mt-2">
                      Telefone:{" "}
                      {telefoneCliente(
                        ordemVisualizada.cliente_id
                      )}
                    </p>

                    <p className="text-sm text-gray-600">
                      Endereço:{" "}
                      {enderecoCliente(
                        ordemVisualizada.cliente_id
                      )}
                    </p>

                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">

                    <p className="text-xs text-gray-500">
                      STATUS
                    </p>

                    <span
                      className={
                        "inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium " +
                        classeStatus(
                          ordemVisualizada.status
                        )
                      }
                    >
                      {
                        ordemVisualizada.status
                      }
                    </span>

                    <p className="text-sm text-gray-600 mt-3">
                      Origem:{" "}
                      {ordemVisualizada.orcamento_id
                        ? "Orçamento #" +
                          String(
                            ordemVisualizada.orcamento_id
                          ).padStart(
                            4,
                            "0"
                          )
                        : "Sem orçamento"}
                    </p>

                  </div>

                </div>

                <div>

                  <h3 className="font-bold text-gray-800 mb-3">
                    Datas
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                    <div className="border rounded-lg p-3">

                      <p className="text-xs text-gray-500">
                        Abertura
                      </p>

                      <p className="font-medium mt-1">
                        {formatarData(
                          ordemVisualizada.data_abertura
                        )}
                      </p>

                    </div>

                    <div className="border rounded-lg p-3">

                      <p className="text-xs text-gray-500">
                        Início
                      </p>

                      <p className="font-medium mt-1">
                        {formatarData(
                          ordemVisualizada.data_inicio
                        )}
                      </p>

                    </div>

                    <div className="border rounded-lg p-3">

                      <p className="text-xs text-gray-500">
                        Previsão
                      </p>

                      <p className="font-medium mt-1">
                        {formatarData(
                          ordemVisualizada.data_previsao
                        )}
                      </p>

                    </div>

                    <div className="border rounded-lg p-3">

                      <p className="text-xs text-gray-500">
                        Conclusão
                      </p>

                      <p className="font-medium mt-1">
                        {formatarData(
                          ordemVisualizada.data_conclusao
                        )}
                      </p>

                    </div>

                  </div>

                </div>

                <div>

                  <h3 className="font-bold text-gray-800 mb-3">
                    Descrição
                  </h3>

                  <div className="bg-gray-50 rounded-xl p-4 whitespace-pre-line text-gray-700">
                    {ordemVisualizada.descricao ||
                      "-"}
                  </div>

                </div>

                <div>

                  <h3 className="font-bold text-gray-800 mb-3">
                    Serviços e materiais
                  </h3>

                  {carregandoItens ? (

                    <p className="text-gray-500">
                      Carregando itens...
                    </p>

                  ) : itensVisualizados.length ===
                    0 ? (

                    <div className="bg-gray-50 rounded-xl p-4 text-gray-500">
                      Nenhum item detalhado cadastrado.
                    </div>

                  ) : (

                    <div className="border rounded-xl overflow-hidden">

                      <table className="w-full">

                        <thead className="bg-gray-50">

                          <tr>

                            <th className="px-4 py-3 text-left text-sm">
                              Tipo
                            </th>

                            <th className="px-4 py-3 text-left text-sm">
                              Descrição
                            </th>

                            <th className="px-4 py-3 text-right text-sm">
                              Qtd.
                            </th>

                            <th className="px-4 py-3 text-right text-sm">
                              Unitário
                            </th>

                            <th className="px-4 py-3 text-right text-sm">
                              Subtotal
                            </th>

                          </tr>

                        </thead>

                        <tbody className="divide-y">

                          {itensVisualizados.map(
                            (item) => (

                              <tr
                                key={
                                  item.id
                                }
                              >

                                <td className="px-4 py-3 text-sm">
                                  {item.tipo ===
                                  "servico"
                                    ? "Serviço"
                                    : "Material"}
                                </td>

                                <td className="px-4 py-3 text-sm">
                                  {
                                    item.descricao
                                  }
                                </td>

                                <td className="px-4 py-3 text-sm text-right">
                                  {
                                    item.quantidade
                                  }
                                </td>

                                <td className="px-4 py-3 text-sm text-right">
                                  {formatarValor(
                                    Number(
                                      item.valor_unitario
                                    ) || 0
                                  )}
                                </td>

                                <td className="px-4 py-3 text-sm text-right font-medium">
                                  {formatarValor(
                                    Number(
                                      item.subtotal
                                    ) || 0
                                  )}
                                </td>

                              </tr>

                            )
                          )}

                        </tbody>

                      </table>

                    </div>

                  )}

                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  <div className="bg-gray-50 rounded-xl p-4">

                    <p className="text-sm text-gray-500">
                      Valor do serviço
                    </p>

                    <p className="text-xl font-bold text-gray-800 mt-1">
                      {formatarValor(
                        Number(
                          ordemVisualizada.valor_servico
                        ) || 0
                      )}
                    </p>

                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">

                    <p className="text-sm text-gray-500">
                      Custo dos materiais
                    </p>

                    <p className="text-xl font-bold text-gray-800 mt-1">
                      {formatarValor(
                        Number(
                          ordemVisualizada.custo_materiais
                        ) || 0
                      )}
                    </p>

                  </div>

                  <div className="bg-[#0D1B2A] rounded-xl p-4 text-white">

                    <p className="text-sm text-gray-300">
                      Valor total
                    </p>

                    <p className="text-2xl font-bold mt-1">
                      {formatarValor(
                        Number(
                          ordemVisualizada.valor_total
                        ) || 0
                      )}
                    </p>

                  </div>

                </div>

                <div>

                  <h3 className="font-bold text-gray-800 mb-3">
                    Observações
                  </h3>

                  <div className="bg-gray-50 rounded-xl p-4 whitespace-pre-line text-gray-700">
                    {ordemVisualizada.observacoes ||
                      "Nenhuma observação."}
                  </div>

                </div>

              </div>

              <div className="flex justify-end gap-3 px-6 py-5 border-t bg-gray-50">

                <button
                  onClick={() => {
                    fecharVisualizacao();
                    editarOrdem(
                      ordemVisualizada
                    );
                  }}
                  className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Editar O.S.
                </button>

                {ordemVisualizada.status !==
                  "Concluída" &&
                  ordemVisualizada.status !==
                    "Cancelada" && (

                    <button
                      type="button"
                      onClick={() => {
                        fecharVisualizacao();
                        setOrdemParaConcluir(
                          ordemVisualizada
                        );
                      }}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Concluir O.S.
                    </button>

                  )}

                <button
                  onClick={
                    fecharVisualizacao
                  }
                  className="px-5 py-3 rounded-lg bg-[#FFD60A] text-[#0D1B2A] font-semibold hover:bg-yellow-400"
                >
                  Fechar
                </button>

              </div>

            </div>

          </div>

        )}

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        aberto={ordemParaExcluir !== null}
        titulo="Excluir ordem de serviço?"
        descricao={
          ordemParaExcluir ? (
            <>
              Tem certeza que deseja excluir a O.S.{" "}
              <strong className="text-gray-900">
                #{String(ordemParaExcluir.numero).padStart(4, "0")}
              </strong>{" "}
              do valor de{" "}
              <strong className="text-gray-900">
                {formatarValor(
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
                #{String(ordemParaConcluir.numero).padStart(4, "0")}
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
                #{String(ordemParaReabrir.numero).padStart(4, "0")}
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

      {/* Modal de Histórico da O.S. */}
      {ordemHistorico && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Histórico da O.S. #
                  {String(ordemHistorico.numero).padStart(4, "0")}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Timeline de mudanças de status e movimentações de
                  estoque
                </p>
              </div>
              <button
                type="button"
                onClick={fecharHistorico}
                className="text-gray-400 hover:text-gray-700 transition p-1 rounded-lg hover:bg-gray-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {carregandoHistorico ? (
                <div className="text-center text-gray-500 py-8">
                  Carregando...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Timeline de status */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Mudanças de status
                    </h3>
                    {historicoStatus.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">
                        Nenhuma mudança registrada.
                      </p>
                    ) : (
                      <div className="space-y-3 border-l-2 border-gray-200 pl-4">
                        {historicoStatus.map((item) => (
                          <div key={item.id} className="relative">
                            <span className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-[#FFD60A] border-2 border-white" />
                            <div className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="font-medium text-gray-900 text-sm">
                                  {item.status_anterior ? (
                                    <>
                                      <span className="text-gray-500">
                                        {item.status_anterior}
                                      </span>
                      <span className="mx-2">→</span>
                      <span className="text-[#0D1B2A] font-bold">
                        {item.status_novo}
                      </span>
                                    </>
                                  ) : (
                                    <span className="text-[#0D1B2A] font-bold">
                                      {item.status_novo}
                                    </span>
                                  )}
                                </p>
                                <span className="text-xs text-gray-500">
                                  {new Date(item.created_at).toLocaleString(
                                    "pt-BR"
                                  )}
                                </span>
                              </div>
                              {item.observacao && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {item.observacao}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Movimentações de estoque */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Boxes className="w-4 h-4" />
                      Movimentações de estoque
                    </h3>
                    {historicoEstoque.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">
                        Nenhuma movimentação de estoque registrada.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {historicoEstoque.map((mov) => (
                          <div
                            key={mov.id}
                            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                mov.tipo === "entrada"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : mov.tipo === "saida"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {mov.tipo === "entrada"
                                ? "↓"
                                : mov.tipo === "saida"
                                ? "↑"
                                : "≡"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm">
                                {mov.produto_nome || "Produto"}
                                {" — "}
                                <strong>
                                  {mov.tipo === "entrada" ? "+" : mov.tipo === "saida" ? "−" : ""}
                                  {mov.quantidade}
                                </strong>
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Estoque: {mov.estoque_anterior} →{" "}
                                {mov.estoque_posterior}
                                <span className="ml-2 text-gray-400">
                                  •{" "}
                                  {new Date(mov.created_at).toLocaleString(
                                    "pt-BR"
                                  )}
                                </span>
                              </p>
                              {mov.observacao && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {mov.observacao}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={fecharHistorico}
                className="px-5 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}