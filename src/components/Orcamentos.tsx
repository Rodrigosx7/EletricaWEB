import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type Cliente = {
  id: number;
  nome: string;
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
  clientes?: {
  nome: string;
}[];
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function Orcamentos() {
  const [usuario, setUsuario] = useState<any>(null);

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [orcamentoEditando, setOrcamentoEditando] =
  useState<Orcamento | null>(null);

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
          .select("id, nome")
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
          .select(
            `
            id,
            numero,
            cliente_id,
            data_orcamento,
            validade,
            status,
            desconto,
            valor_total,
            observacoes,
            clientes (
              nome
            )
          `
          )
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
      alert("Selecione um item.");
      return;
    }

    const qtd = Number(quantidade);

    if (!qtd || qtd <= 0) {
      alert("Digite uma quantidade válida.");
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
      alert("Erro ao carregar os itens do orçamento.");
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
      (data || []).map((item: any) => ({
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
    alert("Erro ao carregar orçamento.");
  } finally {
    setSalvando(false);
  }
}

  async function salvarOrcamento() {
  if (!usuario) {
    alert("Usuário não identificado.");
    return;
  }

  if (!clienteId) {
    alert("Selecione um cliente.");
    return;
  }

  if (itens.length === 0) {
    alert("Adicione pelo menos um item ao orçamento.");
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

      alert(
        `Orçamento #${orcamentoEditando.numero} atualizado com sucesso.`
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

    alert(`Orçamento #${proximoNumero} criado com sucesso.`);

    setModalAberto(false);

    await carregarDados();
  } catch (error) {
    console.error("Erro ao salvar orçamento:", error);
    alert("Erro ao salvar orçamento.");
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
      alert("Erro ao carregar os itens do orçamento.");
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

  async function excluirOrcamento(id: number) {
    const confirmar = confirm(
      "Deseja realmente excluir este orçamento?"
    );

    if (!confirmar) return;

    if (!usuario) return;

    const { error } = await supabase
      .from("orcamentos")
      .delete()
      .eq("id", id)
      .eq("user_id", usuario.id);

    if (error) {
      console.error("Erro ao excluir orçamento:", error);
      alert("Erro ao excluir orçamento.");
      return;
    }

    setOrcamentos((lista) =>
      lista.filter((orcamento) => orcamento.id !== id)
    );
  }

  async function gerarPDF(orcamento: Orcamento) {
  if (!usuario) {
    alert("Usuário não identificado.");
    return;
  }

  try {
    const { data: itensPDF, error } = await supabase
      .from("orcamento_itens")
      .select(`
        id,
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
      console.error(error);
      alert("Erro ao carregar os itens do orçamento.");
      return;
    }

    const doc = new jsPDF();

    const numero = String(orcamento.numero).padStart(4, "0");
    const cliente = orcamento.clientes?.[0]?.nome || "Cliente";

    const dataFormatada = new Date(
      orcamento.data_orcamento + "T00:00:00"
    ).toLocaleDateString("pt-BR");

    const validadeFormatada = orcamento.validade
      ? new Date(
          orcamento.validade + "T00:00:00"
        ).toLocaleDateString("pt-BR")
      : "Não informada";

    // Cabeçalho
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("RJ ELÉTRICA", 20, 25);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Orçamento de Serviços Elétricos", 20, 32);

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`ORÇAMENTO #${numero}`, 140, 25);

    // Linha
    doc.setLineWidth(0.5);
    doc.line(20, 40, 190, 40);

    // Informações
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Cliente:", 20, 52);

    doc.setFont("helvetica", "normal");
    doc.text(cliente, 45, 52);

    doc.setFont("helvetica", "bold");
    doc.text("Data:", 20, 61);

    doc.setFont("helvetica", "normal");
    doc.text(dataFormatada, 45, 61);

    doc.setFont("helvetica", "bold");
    doc.text("Validade:", 100, 61);

    doc.setFont("helvetica", "normal");
    doc.text(validadeFormatada, 125, 61);

    doc.setFont("helvetica", "bold");
    doc.text("Status:", 100, 52);

    doc.setFont("helvetica", "normal");
    doc.text(orcamento.status, 125, 52);

    // Tabela
    autoTable(doc, {
      startY: 72,
      head: [
        [
          "Tipo",
          "Descrição",
          "Qtd.",
          "Valor unit.",
          "Subtotal",
        ],
      ],
      body: (itensPDF || []).map((item) => [
        item.tipo === "servico" ? "Serviço" : "Produto",
        item.descricao,
        String(item.quantidade),
        formatarMoeda(Number(item.valor_unitario)),
        formatarMoeda(Number(item.subtotal)),
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 70 },
        2: { cellWidth: 20, halign: "right" },
        3: { cellWidth: 35, halign: "right" },
        4: { cellWidth: 35, halign: "right" },
      },
    });

    const finalY =
      (doc as any).lastAutoTable.finalY + 10;

    const subtotalPDF = (itensPDF || []).reduce(
      (total, item) =>
        total + Number(item.subtotal),
      0
    );

    const descontoPDF = Number(orcamento.desconto) || 0;
    const totalPDF = Number(orcamento.valor_total) || 0;

    // Totais
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    doc.text(
      `Subtotal: ${formatarMoeda(subtotalPDF)}`,
      130,
      finalY
    );

    doc.text(
      `Desconto: ${formatarMoeda(descontoPDF)}`,
      130,
      finalY + 8
    );

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");

    doc.text(
      `TOTAL: ${formatarMoeda(totalPDF)}`,
      130,
      finalY + 20
    );

    // Observações
    if (orcamento.observacoes) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");

      doc.text(
        "Observações:",
        20,
        finalY + 40
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const observacoes = doc.splitTextToSize(
        orcamento.observacoes,
        170
      );

      doc.text(
        observacoes,
        20,
        finalY + 48
      );
    }

    // Rodapé
    const alturaPagina = doc.internal.pageSize.height;

    doc.setLineWidth(0.3);
    doc.line(
      20,
      alturaPagina - 25,
      190,
      alturaPagina - 25
    );

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    doc.text(
      "RJ ELÉTRICA - Serviços Elétricos",
      20,
      alturaPagina - 17
    );

    doc.text(
      `Orçamento #${numero}`,
      155,
      alturaPagina - 17
    );

    // Download
    doc.save(`orcamento-${numero}.pdf`);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert("Erro ao gerar o PDF.");
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
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-3 rounded-lg"
          >
            + Novo orçamento
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

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Nº
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Cliente
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Data
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Status
                    </th>

                    <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">
                      Total
                    </th>

                    <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">
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
                        {orcamento.clientes?.[0]?.nome || "Cliente"}
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
                            onClick={() =>
                              visualizarOrcamento(orcamento)
                            }
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Visualizar
                          </button>

                          <button
  onClick={() => gerarPDF(orcamento)}
  className="text-gray-700 hover:text-gray-900 font-medium"
>
  PDF
</button>
                          
                        <button
  onClick={() => editarOrcamento(orcamento)}
  className="text-orange-600 hover:text-orange-800 font-medium"
>
  Editar
</button>

                          <button
                            onClick={() =>
                              excluirOrcamento(orcamento.id)
                            }
                            className="text-red-600 hover:text-red-800 font-medium"
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
                onClick={() => setModalAberto(false)}
                disabled={salvando}
                className="text-gray-400 hover:text-gray-700 text-2xl"
              >
                ×
              </button>

            </div>

            {/* Conteúdo */}
            <div className="p-6 space-y-6">

              {/* Dados principais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cliente *
                  </label>

                  <select
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
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Status
  </label>

  <select
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data do orçamento
                  </label>

                  <input
                    type="date"
                    value={dataOrcamento}
                    onChange={(e) =>
                      setDataOrcamento(e.target.value)
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Validade
                  </label>

                  <input
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
  onClick={() => {
    setModalAberto(false);
    setOrcamentoEditando(null);
  }}
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
                      {orcamentoVisualizado.clientes?.[0]?.nome ||
  "Cliente"}
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

    </div>
  );
}

export default Orcamentos;