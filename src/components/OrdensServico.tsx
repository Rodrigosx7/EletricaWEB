import { useEffect, useState } from "react";
import { supabase } from "../supabase";

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
        alert("Usuário não encontrado.");
        return;
      }

      if (!clienteId) {
        alert("Selecione um cliente.");
        return;
      }

      if (!descricao.trim()) {
        alert("Informe a descrição do serviço.");
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
          .eq("id", editandoId);

        if (error) {
          console.error(error);

          alert(
            "Não foi possível atualizar a O.S."
          );

          return;
        }

        alert(
          "Ordem de serviço atualizada com sucesso!"
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
          alert(
            "Selecione um orçamento aprovado."
          );

          return;
        }

        orcamentoSelecionado =
          orcamentos.find(
            (item) =>
              item.id === Number(orcamentoId)
          ) || null;

        if (!orcamentoSelecionado) {
          alert(
            "Orçamento não encontrado."
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

        alert(
          "Não foi possível gerar o número da O.S."
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

        alert(
          "Não foi possível cadastrar a ordem de serviço."
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

          alert(
            "A O.S. não foi criada porque os itens não puderam ser copiados."
          );

          return;
        }
      }

      alert(
        "Ordem de serviço cadastrada com sucesso!"
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

  async function concluirOrdem(
    ordem: OrdemServico
  ) {
    const confirmar = window.confirm(
      "Deseja marcar a O.S. #" +
        String(ordem.numero).padStart(
          4,
          "0"
        ) +
        " como concluída?"
    );

    if (!confirmar) {
      return;
    }

    const { error } = await supabase
      .from("ordens_servico")
      .update({
        status: "Concluída",
        data_conclusao: hoje(),
      })
      .eq("id", ordem.id);

    if (error) {
      console.error(error);

      alert(
        "Não foi possível concluir a O.S."
      );

      return;
    }

    await carregarDados();
  }

  async function reabrirOrdem(
    ordem: OrdemServico
  ) {
    const confirmar = window.confirm(
      "Deseja reabrir a O.S. #" +
        String(ordem.numero).padStart(
          4,
          "0"
        ) +
        "?"
    );

    if (!confirmar) {
      return;
    }

    const { error } = await supabase
      .from("ordens_servico")
      .update({
        status: "Em andamento",
        data_conclusao: null,
      })
      .eq("id", ordem.id);

    if (error) {
      console.error(error);

      alert(
        "Não foi possível reabrir a O.S."
      );

      return;
    }

    await carregarDados();
  }

  async function excluirOrdem(
    id: number
  ) {
    const confirmar = window.confirm(
      "Tem certeza que deseja excluir esta ordem de serviço?"
    );

    if (!confirmar) {
      return;
    }

    const { error } = await supabase
      .from("ordens_servico")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);

      alert(
        "Não foi possível excluir a ordem de serviço."
      );

      return;
    }

    await carregarDados();
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
          className="bg-[#FFD60A] hover:bg-yellow-400 text-[#0D1B2A] font-semibold px-5 py-3 rounded-lg transition"
        >
          + Nova O.S.
        </button>

      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        <table className="w-full">

          <thead className="bg-gray-50 border-b border-gray-200">

            <tr>

              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                O.S.
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                Cliente
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                Origem
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                Data
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                Status
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                Valor
              </th>

              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">
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
                        onClick={() =>
                          visualizarOrdem(
                            ordem
                          )
                        }
                        className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        Visualizar
                      </button>

                      <button
                        onClick={() =>
                          editarOrdem(
                            ordem
                          )
                        }
                        className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        Editar
                      </button>

                      {ordem.status !==
                        "Concluída" &&
                        ordem.status !==
                          "Cancelada" && (

                          <button
                            onClick={() =>
                              concluirOrdem(
                                ordem
                              )
                            }
                            className="px-3 py-2 text-sm text-green-700 hover:bg-green-50 rounded-lg font-medium"
                          >
                            ✓ Concluir
                          </button>

                        )}

                      {ordem.status ===
                        "Concluída" && (

                          <button
                            onClick={() =>
                              reabrirOrdem(
                                ordem
                              )
                            }
                            className="px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg"
                          >
                            ↩ Reabrir
                          </button>

                        )}

                      <button
                        onClick={() =>
                          excluirOrdem(
                            ordem.id
                          )
                        }
                        className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                      >
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

                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Orçamento aprovado *
                    </label>

                    {orcamentos.length === 0 ? (

                      <div className="text-sm text-blue-700">
                        Nenhum orçamento aprovado disponível.
                      </div>

                    ) : (

                      <select
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

                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cliente *
                </label>

                <select
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

                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data de abertura *
                  </label>

                  <input
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

                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data de início
                  </label>

                  <input
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

                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Previsão de conclusão
                  </label>

                  <input
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

                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Status
                </label>

                <select
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

                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Data de conclusão
                    </label>

                    <input
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

                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Descrição do serviço *
                </label>

                <textarea
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

                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Valor do serviço
                  </label>

                  <input
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

                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Custo dos materiais
                  </label>

                  <input
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

                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observações
                </label>

                <textarea
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
                      onClick={() => {
                        fecharVisualizacao();
                        concluirOrdem(
                          ordemVisualizada
                        );
                      }}
                      className="px-5 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700"
                    >
                      ✓ Concluir O.S.
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

    </div>
  );
}