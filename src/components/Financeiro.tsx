import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from "react";
import type { User } from "@supabase/supabase-js";
import { Search, Plus, ArrowUpRight, ArrowDownRight, Trash2, Pencil, FileDown, Wallet } from "lucide-react";
import { supabase } from "../supabase";
import {
  formatarMoeda,
  formatarData,
  dataIsoAtual,
  primeiroDiaMes,
} from "../utils/formatters";
import ConfirmDialog from "./ConfirmDialog";
import Modal from "./ui/Modal";
import "./analysis-pages.css";
import { useToast } from "./ui/toast";
import { usePaginacao } from "../hooks/usePaginacao";
import ControlesPaginacao from "./ui/ControlesPaginacao";

type TipoMovimento = "receita" | "despesa";

type Movimento = {
  id: string;
  user_id: string;
  tipo: TipoMovimento;
  categoria: string;
  descricao: string;
  valor: number;
  data_movimento: string;
  forma_pagamento: string | null;
  observacoes: string | null;
  ordem_servico_id: number | null;
  created_at: string;
  updated_at: string;
};

const CATEGORIAS_RECEITA = [
  "Serviço prestado",
  "Orçamento aprovado",
  "Venda de produto",
  "Outros",
];

const CATEGORIAS_DESPESA = [
  "Material",
  "Combustível",
  "Alimentação",
  "Ferramenta",
  "Transporte",
  "Outros",
];

const FORMAS_PAGAMENTO = [
  "Dinheiro",
  "PIX",
  "Cartão de crédito",
  "Cartão de débito",
  "Transferência",
  "Boleto",
  "Cheque",
];

export default function Financeiro(): ReactElement {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState(false);
  const paginacao = usePaginacao(20);

  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | TipoMovimento>(
    "todos"
  );
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes());
  const [dataFim, setDataFim] = useState(dataIsoAtual());
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [movEditando, setMovEditando] = useState<Movimento | null>(null);
  const [movParaExcluir, setMovParaExcluir] = useState<Movimento | null>(
    null
  );
  const [excluindo, setExcluindo] = useState(false);

  const [tipo, setTipo] = useState<TipoMovimento>("receita");
  const [categoria, setCategoria] = useState(CATEGORIAS_RECEITA[0]);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [dataMovimento, setDataMovimento] = useState(dataIsoAtual());
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const { mostrarToast } = useToast();

  useEffect(() => {
    async function carregar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUsuario(user);
      if (user) {
        await carregarMovimentos(user.id);
      } else {
        setCarregando(false);
      }
    }
    carregar();

    // Auto-refresh quando volta para a aba
    function onFocus() {
      carregar();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (usuario) carregarMovimentos(usuario.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, paginacao.pagina, paginacao.tamanho]);

  async function carregarMovimentos(userId: string) {
    setErroCarregamento(false);
    const de = paginacao.offset;
    const ate = de + paginacao.tamanho - 1;
    const { data, error, count } = await supabase
      .from("movimentacoes")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("data_movimento", { ascending: false })
      .order("created_at", { ascending: false })
      .range(de, ate);

    setCarregando(false);

    if (error) {
      setErroCarregamento(true);
      console.error("Erro ao carregar movimentações:", error);
      mostrarToast("Erro ao carregar movimentações.", "erro");
      return;
    }

    setMovimentos(data || []);
    paginacao.setTotal(count ?? 0);
  }

  function limparFormulario() {
    setMovEditando(null);
    setTipo("receita");
    setCategoria(CATEGORIAS_RECEITA[0]);
    setDescricao("");
    setValor("");
    setDataMovimento(dataIsoAtual());
    setFormaPagamento("");
    setObservacoes("");
  }

  function abrirNovaMovimentacao() {
    limparFormulario();
    setModalAberto(true);
  }

  function abrirEditarMovimentacao(mov: Movimento) {
    setMovEditando(mov);
    setTipo(mov.tipo);
    setCategoria(mov.categoria);
    setDescricao(mov.descricao);
    setValor(String(mov.valor).replace(".", ","));
    setDataMovimento(mov.data_movimento);
    setFormaPagamento(mov.forma_pagamento || "");
    setObservacoes(mov.observacoes || "");
    setModalAberto(true);
  }

  // Atualiza categoria quando muda o tipo (no modo novo)
  useEffect(() => {
    if (!movEditando) {
      if (tipo === "receita") {
        setCategoria(CATEGORIAS_RECEITA[0]);
      } else {
        setCategoria(CATEGORIAS_DESPESA[0]);
      }
    }
  }, [tipo, movEditando]);

  async function salvar(e: FormEvent) {
    e.preventDefault();

    if (!descricao.trim()) {
      mostrarToast("Digite uma descrição.", "alerta");
      return;
    }

    const valorNumerico = Number(valor.replace(/\./g, "").replace(",", "."));
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      mostrarToast("Digite um valor válido.", "alerta");
      return;
    }

    if (!usuario) {
      mostrarToast("Usuário não identificado.", "erro");
      return;
    }

    setSalvando(true);

    const payload = {
      user_id: usuario.id,
      tipo,
      categoria,
      descricao: descricao.trim(),
      valor: valorNumerico,
      data_movimento: dataMovimento,
      forma_pagamento: formaPagamento || null,
      observacoes: observacoes.trim() || null,
      ordem_servico_id: null,
    };

    let error;
    if (movEditando) {
      const res = await supabase
        .from("movimentacoes")
        .update(payload)
        .eq("id", movEditando.id)
        .eq("user_id", usuario.id);
      error = res.error;
    } else {
      const res = await supabase
        .from("movimentacoes")
        .insert(payload);
      error = res.error;
    }

    setSalvando(false);

    if (error) {
      console.error("Erro ao salvar:", error);
      mostrarToast(
        movEditando
          ? "Erro ao atualizar movimentação."
          : "Erro ao cadastrar movimentação.",
        "erro"
      );
      return;
    }

    mostrarToast(
      movEditando
        ? "Movimentação atualizada!"
        : "Movimentação cadastrada!",
      "sucesso"
    );

    await carregarMovimentos(usuario.id);
    limparFormulario();
    setModalAberto(false);
  }

  async function confirmarExclusao() {
    if (!movParaExcluir || !usuario) return;
    setExcluindo(true);

    const { error } = await supabase
      .from("movimentacoes")
      .delete()
      .eq("id", movParaExcluir.id)
      .eq("user_id", usuario.id);

    setExcluindo(false);

    if (error) {
      console.error("Erro ao excluir:", error);
      mostrarToast("Erro ao excluir movimentação.", "erro");
      return;
    }

    setMovimentos((lista) =>
      lista.filter((m) => m.id !== movParaExcluir.id)
    );
    mostrarToast("Movimentação excluída.", "sucesso");
    setMovParaExcluir(null);
  }

  // Filtra + busca
  const movimentosFiltrados = useMemo(() => {
    return movimentos.filter((m) => {
      if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
      if (m.data_movimento < dataInicio) return false;
      if (m.data_movimento > dataFim) return false;
      const termo = busca.toLowerCase().trim();
      if (termo) {
        const alvo =
          `${m.descricao} ${m.categoria} ${m.forma_pagamento || ""} ${m.observacoes || ""}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [movimentos, filtroTipo, dataInicio, dataFim, busca]);

  // KPIs do período filtrado
  const stats = useMemo(() => {
    const totalReceitas = movimentosFiltrados
      .filter((m) => m.tipo === "receita")
      .reduce((s, m) => s + m.valor, 0);
    const totalDespesas = movimentosFiltrados
      .filter((m) => m.tipo === "despesa")
      .reduce((s, m) => s + m.valor, 0);
    const lucro = totalReceitas - totalDespesas;
    return {
      totalReceitas,
      totalDespesas,
      lucro,
      totalMovimentos: movimentosFiltrados.length,
    };
  }, [movimentosFiltrados]);

  function exportarCSV() {
    if (movimentosFiltrados.length === 0) {
      mostrarToast("Não há dados para exportar.", "alerta");
      return;
    }

    const linhas = [
      "Data;Tipo;Categoria;Descrição;Valor;Forma de Pagamento;Observações",
      ...movimentosFiltrados.map((m) =>
        [
          m.data_movimento,
          m.tipo,
          m.categoria,
          `"${m.descricao.replace(/"/g, '""')}"`,
          m.valor.toFixed(2).replace(".", ","),
          m.forma_pagamento || "",
          `"${(m.observacoes || "").replace(/"/g, '""')}"`,
        ].join(";")
      ),
    ];

    const blob = new Blob(["﻿" + linhas.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${dataInicio}-${dataFim}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarToast("CSV exportado!", "sucesso");
  }

  const categorias =
    tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
  const maiorFluxo = Math.max(stats.totalReceitas, stats.totalDespesas, 1);

  function fecharModal() {
    limparFormulario();
    setModalAberto(false);
  }

  function acoesMovimento(mov: Movimento) {
    return (
      <div className="row-actions">
        <button type="button" onClick={() => abrirEditarMovimentacao(mov)}
          className="icon-button" title="Editar movimentação"
          aria-label={`Editar ${mov.descricao}`}>
          <Pencil size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setMovParaExcluir(mov)}
          className="icon-button analysis-delete" title="Excluir movimentação"
          aria-label={`Excluir ${mov.descricao}`}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="product-page analysis-page">
      <header className="page-header">
        <div>
          <p className="analysis-eyebrow">Análise / Fluxo de caixa</p>
          <h1>Financeiro</h1>
          <p>Acompanhe o que entra, o que sai e o resultado do seu trabalho.</p>
        </div>
        <div className="page-actions">
          <button type="button" onClick={exportarCSV} className="btn-secondary">
            <FileDown size={17} aria-hidden="true" /> Exportar CSV
          </button>
          <button type="button" onClick={abrirNovaMovimentacao} className="btn-primary">
            <Plus size={18} aria-hidden="true" /> Nova movimentação
          </button>
        </div>
      </header>

      <section className="analysis-cash-overview" aria-label="Resumo das movimentações selecionadas" aria-busy={carregando}>
        <div className="analysis-balance">
          <span className="analysis-eyebrow">Saldo da seleção</span>
          <strong className={stats.lucro < 0 ? "analysis-negative" : ""}>
            {carregando ? "—" : formatarMoeda(stats.lucro)}
          </strong>
          <p>Receitas menos despesas · {stats.totalMovimentos} movimentações</p>
          <small>Totais e filtros consideram os registros da página atual.</small>
        </div>
        <div className="analysis-flow-comparison">
          <div>
            <div className="analysis-flow-label">
              <span><ArrowUpRight size={17} aria-hidden="true" /> Receitas</span>
              <strong>{carregando ? "—" : formatarMoeda(stats.totalReceitas)}</strong>
            </div>
            <div className="analysis-track" aria-hidden="true">
              <span className="analysis-bar-income" style={{ width: `${stats.totalReceitas / maiorFluxo * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="analysis-flow-label">
              <span><ArrowDownRight size={17} aria-hidden="true" /> Despesas</span>
              <strong>{carregando ? "—" : formatarMoeda(stats.totalDespesas)}</strong>
            </div>
            <div className="analysis-track" aria-hidden="true">
              <span className="analysis-bar-expense" style={{ width: `${stats.totalDespesas / maiorFluxo * 100}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="data-panel" aria-labelledby="financeiro-movimentos">
        <div className="section-heading">
          <div>
            <h2 id="financeiro-movimentos">Livro de movimentações</h2>
            <p>Receitas e despesas registradas, em ordem de data.</p>
          </div>
          <span className="record-meta">{movimentosFiltrados.length} exibidas</span>
        </div>
        <div className="data-toolbar analysis-ledger-toolbar">
          <div className="analysis-search">
            <label htmlFor="fin_busca" className="sr-only">Buscar movimentações</label>
            <Search size={17} aria-hidden="true" />
            <input id="fin_busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Descrição, categoria ou pagamento" className="input-base" />
          </div>
          <div className="analysis-date-range">
            <div><label htmlFor="fin_inicio" className="field-label">De</label>
              <input id="fin_inicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="input-base" /></div>
            <div><label htmlFor="fin_fim" className="field-label">Até</label>
              <input id="fin_fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="input-base" /></div>
          </div>
        </div>
        <div className="analysis-ledger-tabs">
          <div className="filter-tabs" aria-label="Tipo de movimentação">
            {(["todos", "receita", "despesa"] as const).map((filtro) => (
              <button key={filtro} type="button" aria-pressed={filtroTipo === filtro}
                onClick={() => setFiltroTipo(filtro)}>
                {filtro === "todos" ? "Todas" : filtro === "receita" ? "Receitas" : "Despesas"}
              </button>
            ))}
          </div>
          <span className="record-meta">Página {paginacao.pagina + 1} de {paginacao.totalPaginas}</span>
        </div>

        {erroCarregamento ? (
          <div className="empty-state" role="alert">
            <h3>Não foi possível carregar as movimentações</h3>
            <p>Atualize os dados para continuar acompanhando o caixa.</p>
            <button className="btn-secondary" type="button" onClick={() => usuario && carregarMovimentos(usuario.id)}>Tentar novamente</button>
          </div>
        ) : carregando ? (
          <div className="empty-state" role="status"><p>Carregando movimentações…</p></div>
        ) : movimentosFiltrados.length === 0 ? (
          <div className="empty-state">
            <Wallet size={28} aria-hidden="true" />
            <h3>Nenhuma movimentação nesta seleção</h3>
            <p>Ajuste o período ou os filtros, ou registre uma entrada ou saída.</p>
            <button type="button" onClick={abrirNovaMovimentacao} className="btn-secondary">
              <Plus size={17} aria-hidden="true" /> Nova movimentação
            </button>
          </div>
        ) : (
          <>
            <div className="analysis-desktop-ledger">
              <table className="data-table">
                <thead><tr>
                  <th scope="col">Data</th><th scope="col">Movimentação</th>
                  <th scope="col">Pagamento</th><th scope="col" className="analysis-align-right">Valor</th>
                  <th scope="col"><span className="sr-only">Ações</span></th>
                </tr></thead>
                <tbody>{movimentosFiltrados.map((mov) => (
                  <tr key={mov.id}>
                    <td className="analysis-date-cell">{formatarData(mov.data_movimento)}</td>
                    <td>
                      <p className="record-primary">{mov.descricao}</p>
                      <p className="record-meta">{mov.tipo === "receita" ? "Receita" : "Despesa"} · {mov.categoria}</p>
                      {mov.ordem_servico_id && <p className="record-meta">Receita automática · OS #{mov.ordem_servico_id}</p>}
                    </td>
                    <td className="record-meta">{mov.forma_pagamento || "Não informado"}</td>
                    <td className={`analysis-money ${mov.tipo === "receita" ? "analysis-positive" : "analysis-negative"}`}>
                      {mov.tipo === "receita" ? "+" : "−"} {formatarMoeda(mov.valor)}
                    </td>
                    <td>{acoesMovimento(mov)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="analysis-mobile-ledger">
              {movimentosFiltrados.map((mov) => (
                <article className="record-row" key={mov.id}>
                  <div className="analysis-mobile-ledger-heading">
                    <span className="record-meta">{formatarData(mov.data_movimento)} · {mov.tipo === "receita" ? "Receita" : "Despesa"}</span>
                    <strong className={mov.tipo === "receita" ? "analysis-positive" : "analysis-negative"}>
                      {mov.tipo === "receita" ? "+" : "−"} {formatarMoeda(mov.valor)}
                    </strong>
                  </div>
                  <p className="record-primary">{mov.descricao}</p>
                  <p className="record-meta">{mov.categoria} · {mov.forma_pagamento || "Pagamento não informado"}</p>
                  {mov.ordem_servico_id && <p className="record-meta">Receita automática · OS #{mov.ordem_servico_id}</p>}
                  {acoesMovimento(mov)}
                </article>
              ))}
            </div>
          </>
        )}
        {!carregando && !erroCarregamento && paginacao.total > 0 && (
          <ControlesPaginacao pagina={paginacao.pagina} totalPaginas={paginacao.totalPaginas}
            total={paginacao.total} tamanho={paginacao.tamanho} onAnterior={paginacao.anterior}
            onProxima={paginacao.proxima} onMudarTamanho={paginacao.setTamanho} />
        )}
      </section>

      {modalAberto && (
        <Modal title={movEditando ? "Editar movimentação" : "Nova movimentação"}
          description="Registre os detalhes da entrada ou saída do seu caixa."
          onClose={fecharModal} busy={salvando}
          footer={<>
            <button type="button" onClick={fecharModal} disabled={salvando} className="btn-secondary">Cancelar</button>
            <button type="submit" form="movimentacao-form" disabled={salvando} className="btn-primary">
              {salvando ? "Salvando…" : movEditando ? "Salvar alterações" : "Registrar movimentação"}
            </button>
          </>}>
          <form id="movimentacao-form" onSubmit={salvar}>
            <section className="form-section">
              <h3>01 / Identificação</h3><p>O que esta movimentação representa?</p>
              <div className="filter-tabs analysis-movement-type" aria-label="Tipo de movimentação">
                <button type="button" aria-pressed={tipo === "receita"} onClick={() => setTipo("receita")}>
                  <ArrowUpRight size={17} aria-hidden="true" /> Receita
                </button>
                <button type="button" aria-pressed={tipo === "despesa"} onClick={() => setTipo("despesa")}>
                  <ArrowDownRight size={17} aria-hidden="true" /> Despesa
                </button>
              </div>
              <div className="form-grid">
                <div className="analysis-span-full">
                  <label htmlFor="mov_descricao" className="field-label">Descrição *</label>
                  <input id="mov_descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Ex.: Instalação elétrica residencial" className="input-base" required />
                </div>
                <div className="analysis-span-full">
                  <label htmlFor="mov_categoria" className="field-label">Categoria</label>
                  <select id="mov_categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input-base">
                    {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </section>
            <section className="form-section">
              <h3>02 / Valor e pagamento</h3><p>Informe o valor e quando a movimentação aconteceu.</p>
              <div className="form-grid">
                <div>
                  <label htmlFor="mov_valor" className="field-label">Valor (R$) *</label>
                  <input id="mov_valor" type="text" inputMode="decimal" value={valor}
                    onChange={(e) => {
                      const digitos = e.target.value.replace(/\D/g, "");
                      if (!digitos) { setValor(""); return; }
                      setValor((Number(digitos) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                    }} placeholder="0,00" className="input-base" required />
                </div>
                <div>
                  <label htmlFor="mov_data" className="field-label">Data</label>
                  <input id="mov_data" type="date" value={dataMovimento} onChange={(e) => setDataMovimento(e.target.value)} className="input-base" />
                </div>
                <div className="analysis-span-full">
                  <label htmlFor="mov_forma" className="field-label">Forma de pagamento</label>
                  <select id="mov_forma" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} className="input-base">
                    <option value="">Não informar</option>
                    {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            </section>
            <section className="form-section">
              <h3>03 / Observações</h3><p>Acrescente informações úteis para consultar depois.</p>
              <label htmlFor="mov_observacoes" className="field-label">Anotações opcionais</label>
              <textarea id="mov_observacoes" value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
                rows={3} placeholder="Detalhes desta movimentação" className="input-base" />
            </section>
          </form>
        </Modal>
      )}
      <ConfirmDialog aberto={movParaExcluir !== null} titulo="Excluir movimentação?"
        descricao={movParaExcluir ? <>A movimentação <strong>{movParaExcluir.descricao}</strong>, de <strong>{formatarMoeda(movParaExcluir.valor)}</strong>, será excluída. Esta ação não pode ser desfeita.</> : null}
        textoBotaoConfirmar="Excluir" corBotaoConfirmar="vermelho" carregando={excluindo}
        aoConfirmar={confirmarExclusao} aoCancelar={() => setMovParaExcluir(null)} />
    </div>
  );
}
