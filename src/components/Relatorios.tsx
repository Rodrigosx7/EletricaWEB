import { useEffect, useMemo, useState, type ReactElement } from "react";
import { ArrowUpRight, BarChart3 } from "lucide-react";
import { supabase } from "../supabase";
import { STATUS_OS, STATUS_OS_VALORES, STATUS_ORCAMENTO } from "../utils/constantes";
import "./analysis-pages.css";
import { formatarMoeda, formatarData } from "../utils/formatters";

type Periodo = "mes_atual" | "ultimos_3" | "ultimos_6" | "ultimos_12" | "personalizado";

type OrdemServico = {
  id: number;
  numero: number;
  cliente_id: number;
  data_abertura: string;
  status: string;
  valor_total: number;
};

type Orcamento = {
  id: number;
  numero: number;
  cliente_id: number;
  data_orcamento: string;
  status: string;
  valor_total: number;
};

type Cliente = {
  id: number;
  nome: string;
};

type OrcamentoItem = {
  orcamento_id: number;
  tipo: string;
  servico_id: number | null;
  produto_id: number | null;
  descricao: string;
  valor_unitario: number;
  subtotal: number;
};

type Dados = {
  ordens: OrdemServico[];
  orcamentos: Orcamento[];
  clientes: Cliente[];
  itens: OrcamentoItem[];
};

function inicioMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function dataAtual(): string {
  return new Date().toISOString().split("T")[0];
}

const STATUS_OS_VALIDOS = STATUS_OS_VALORES;

export default function Relatorios(): ReactElement {
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [dados, setDados] = useState<Dados>({
    ordens: [],
    orcamentos: [],
    clientes: [],
    itens: [],
  });

  const [periodo, setPeriodo] = useState<Periodo>("ultimos_6");
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    return inicioMes(d);
  });
  const [dataFim, setDataFim] = useState(dataAtual());

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErroCarregamento(false);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setCarregando(false);
        return;
      }

      const [ordensRes, orcamentosRes, clientesRes] = await Promise.all([
        supabase
          .from("ordens_servico")
          .select(
            "id, numero, cliente_id, data_abertura, status, valor_total"
          )
          .eq("user_id", user.id),
        supabase
          .from("orcamentos")
          .select(
            "id, numero, cliente_id, data_orcamento, status, valor_total"
          )
          .eq("user_id", user.id),
        supabase
          .from("clientes")
          .select("id, nome")
          .eq("user_id", user.id),
      ]);

      if (ordensRes.error || orcamentosRes.error || clientesRes.error) {
        setErroCarregamento(true);
        setCarregando(false);
        return;
      }

      const ordens = (ordensRes.data as OrdemServico[]) || [];
      const orcamentos = (orcamentosRes.data as Orcamento[]) || [];

      // Busca os itens dos orçamentos do usuário
      const orcIds = orcamentos.map((o) => o.id);
      let itens: OrcamentoItem[] = [];
      if (orcIds.length > 0) {
        const { data: itensData, error: itensError } = await supabase
          .from("orcamento_itens")
          .select(
            "orcamento_id, tipo, servico_id, produto_id, descricao, valor_unitario, subtotal"
          )
          .eq("user_id", user.id)
          .in("orcamento_id", orcIds);
        if (itensError) {
          setErroCarregamento(true);
          setCarregando(false);
          return;
        }
        itens = (itensData as OrcamentoItem[]) || [];
      }

      setDados({
        ordens,
        orcamentos,
        clientes: (clientesRes.data as Cliente[]) || [],
        itens,
      });
      setCarregando(false);
    }

    carregar();
  }, [tentativa]);

  // Quando muda o período, ajusta datas
  useEffect(() => {
    const hoje = new Date();
    let inicio: Date;
    if (periodo === "mes_atual") {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    } else if (periodo === "ultimos_3") {
      inicio = new Date(hoje);
      inicio.setMonth(hoje.getMonth() - 2);
      inicio.setDate(1);
    } else if (periodo === "ultimos_6") {
      inicio = new Date(hoje);
      inicio.setMonth(hoje.getMonth() - 5);
      inicio.setDate(1);
    } else if (periodo === "ultimos_12") {
      inicio = new Date(hoje);
      inicio.setMonth(hoje.getMonth() - 11);
      inicio.setDate(1);
    } else {
      return; // personalizado mantém o que o usuário digitou
    }
    setDataInicio(inicioMes(inicio));
    setDataFim(dataAtual());
  }, [periodo]);

  // Helpers
  const clientesMap = useMemo(() => {
    const m = new Map<number, string>();
    dados.clientes.forEach((c) => m.set(c.id, c.nome));
    return m;
  }, [dados.clientes]);

  const ordensFiltradas = useMemo(
    () =>
      dados.ordens.filter(
        (o) => o.data_abertura >= dataInicio && o.data_abertura <= dataFim
      ),
    [dados.ordens, dataInicio, dataFim]
  );

  const orcamentosFiltrados = useMemo(
    () =>
      dados.orcamentos.filter(
        (o) =>
          o.data_orcamento >= dataInicio && o.data_orcamento <= dataFim
      ),
    [dados.orcamentos, dataInicio, dataFim]
  );

  // 1. Faturamento por mês (gráfico de barras manual)
  const faturamentoPorMes = useMemo(() => {
    const meses: Record<
      string,
      { receita: number; despesa: number; label: string }
    > = {};

    ordensFiltradas.forEach((o) => {
      if (o.status === STATUS_OS.CONCLUIDA) {
        const chave = o.data_abertura.substring(0, 7); // YYYY-MM
        if (!meses[chave]) {
          const [ano, mes] = chave.split("-");
          const data = new Date(Number(ano), Number(mes) - 1, 1);
          meses[chave] = {
            receita: 0,
            despesa: 0,
            label: data.toLocaleDateString("pt-BR", { month: "short" }),
          };
        }
        meses[chave].receita += Number(o.valor_total) || 0;
      }
    });

    return Object.entries(meses)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chave, valor]) => ({ chave, ...valor }));
  }, [ordensFiltradas]);

  // 2. Status das OS (distribuição)
  const distribuicaoOS = useMemo(() => {
    const mapa: Record<string, number> = {};
    STATUS_OS_VALIDOS.forEach((s) => (mapa[s] = 0));
    ordensFiltradas.forEach((o) => {
      mapa[o.status] = (mapa[o.status] || 0) + 1;
    });
    return mapa;
  }, [ordensFiltradas]);

  const totalOS = ordensFiltradas.length;

  // 3. Top 5 clientes por valor (somando OS Concluídas + Orçamentos Aprovados)
  const topClientes = useMemo(() => {
    const mapa = new Map<number, number>();
    ordensFiltradas
      .filter((o) => o.status === STATUS_OS.CONCLUIDA)
      .forEach((o) => {
        mapa.set(o.cliente_id, (mapa.get(o.cliente_id) || 0) + Number(o.valor_total));
      });
    orcamentosFiltrados
      .filter((o) => o.status === STATUS_ORCAMENTO.APROVADO)
      .forEach((o) => {
        mapa.set(o.cliente_id, (mapa.get(o.cliente_id) || 0) + Number(o.valor_total));
      });

    return Array.from(mapa.entries())
      .map(([cliente_id, valor]) => ({
        nome: clientesMap.get(cliente_id) || "Desconhecido",
        valor,
        cliente_id,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  }, [ordensFiltradas, orcamentosFiltrados, clientesMap]);

  // 4. Itens mais vendidos (top 5 por receita acumulada)
  const topItens = useMemo(() => {
    const mapa = new Map<string, { receita: number; quantidade: number; tipo: string }>();

    // Pega os IDs dos orçamentos aprovados ou OS concluídas no período
    const orcAprovadosIds = new Set(
      orcamentosFiltrados
        .filter((o) => o.status === STATUS_ORCAMENTO.APROVADO)
        .map((o) => o.id)
    );

    dados.itens
      .filter((item) => orcAprovadosIds.has(item.orcamento_id))
      .forEach((item) => {
        const chave = item.tipo + ":" + item.descricao;
        if (!mapa.has(chave)) {
          mapa.set(chave, {
            receita: 0,
            quantidade: 0,
            tipo: item.tipo,
          });
        }
        const e = mapa.get(chave)!;
        e.receita += Number(item.subtotal) || 0;
        e.quantidade += Number(item.subtotal) / Number(item.valor_unitario) || 0;
      });

    return Array.from(mapa.entries())
      .map(([chave, v]) => ({
        descricao: chave.split(":").slice(1).join(":"),
        tipo: v.tipo,
        receita: v.receita,
        quantidade: Math.round(v.quantidade),
      }))
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 5);
  }, [dados.itens, orcamentosFiltrados]);

  // 5. KPIs gerais
  const osConcluidas = useMemo(
    () => ordensFiltradas.filter((o) => o.status === STATUS_OS.CONCLUIDA),
    [ordensFiltradas]
  );

  const kpis = useMemo(() => {
    const receitaTotal = osConcluidas.reduce(
      (s, o) => s + Number(o.valor_total),
      0
    );
    const ticketMedio =
      osConcluidas.length > 0 ? receitaTotal / osConcluidas.length : 0;
    const taxaAprovacao =
      orcamentosFiltrados.length > 0
        ? (orcamentosFiltrados.filter((o) => o.status === STATUS_ORCAMENTO.APROVADO).length /
            orcamentosFiltrados.length) *
          100
        : 0;

    return {
      receitaTotal,
      ticketMedio,
      taxaAprovacao,
      totalClientesAtendidos: new Set(
        ordensFiltradas.map((o) => o.cliente_id)
      ).size,
    };
  }, [osConcluidas, ordensFiltradas, orcamentosFiltrados]);

  const maxBarra =
    Math.max(...faturamentoPorMes.map((m) => m.receita), 1);

  const aprovados = orcamentosFiltrados.filter((o) => o.status === STATUS_ORCAMENTO.APROVADO).length;

  return (
    <div className="product-page analysis-page">
      <header className="page-header">
        <div>
          <p className="analysis-eyebrow">Análise / Desempenho</p>
          <h1>Relatórios</h1>
          <p>Entenda os resultados da operação e de onde vêm as oportunidades.</p>
        </div>
        <span className="analysis-period-label"><BarChart3 size={16} aria-hidden="true" /> {ordensFiltradas.length + orcamentosFiltrados.length} registros no período</span>
      </header>

      <section className="analysis-report-period" aria-label="Período da análise">
        <div>
          <label htmlFor="rel_periodo" className="field-label">Período da análise</label>
          <select id="rel_periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className="input-base">
            <option value="mes_atual">Mês atual</option>
            <option value="ultimos_3">Últimos 3 meses</option>
            <option value="ultimos_6">Últimos 6 meses</option>
            <option value="ultimos_12">Últimos 12 meses</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </div>
        <div className="analysis-date-range">
          <div><label htmlFor="rel_inicio" className="field-label">De</label>
            <input id="rel_inicio" type="date" value={dataInicio} onChange={(e) => { setPeriodo("personalizado"); setDataInicio(e.target.value); }} className="input-base" /></div>
          <div><label htmlFor="rel_fim" className="field-label">Até</label>
            <input id="rel_fim" type="date" value={dataFim} onChange={(e) => { setPeriodo("personalizado"); setDataFim(e.target.value); }} className="input-base" /></div>
        </div>
      </section>

      {carregando ? <div className="data-panel empty-state" role="status"><p>Preparando a análise do período…</p></div> :
        erroCarregamento ? <div className="data-panel empty-state" role="alert">
          <h2>Não foi possível carregar a análise</h2>
          <p>Tente novamente para consultar os resultados do período.</p>
          <button type="button" className="btn-secondary" onClick={() => setTentativa((valorAtual) => valorAtual + 1)}>Tentar novamente</button>
        </div> : <>
          <div className="analysis-performance-grid">
            <section className="data-panel analysis-revenue-panel" aria-labelledby="receita-periodo">
              <div className="analysis-revenue-heading">
                <div>
                  <p className="analysis-eyebrow" id="receita-periodo">Receita de serviços concluídos</p>
                  <strong className="analysis-revenue-total">{formatarMoeda(kpis.receitaTotal)}</strong>
                  <p className="record-meta">{formatarData(dataInicio)} a {formatarData(dataFim)} · pela data de abertura da OS</p>
                </div>
                <ArrowUpRight size={26} aria-hidden="true" />
              </div>
              <div className="analysis-inline-metrics">
                <div><span>Ticket médio</span><strong>{formatarMoeda(kpis.ticketMedio)}</strong><small>por serviço concluído</small></div>
                <div><span>Serviços concluídos</span><strong>{osConcluidas.length}</strong><small>no período selecionado</small></div>
                <div><span>Clientes atendidos</span><strong>{kpis.totalClientesAtendidos}</strong><small>com OS no período</small></div>
              </div>
              <div className="section-heading">
                <div><h2>Evolução mensal</h2><p>Receita e volume de serviços concluídos.</p></div>
              </div>
              {faturamentoPorMes.length === 0 ? <div className="empty-state">
                <h3>A evolução começa com um serviço concluído</h3>
                <p>Os resultados aparecem aqui conforme as ordens de serviço são concluídas.</p>
              </div> : <div className="analysis-monthly-list">
                <div className="analysis-monthly-head" aria-hidden="true"><span>Mês</span><span>Receita</span><span>OS</span></div>
                <ul>
                  {faturamentoPorMes.map((mes) => {
                    const quantidade = ordensFiltradas.filter((o) => o.status === STATUS_OS.CONCLUIDA && o.data_abertura.startsWith(mes.chave)).length;
                    return <li key={mes.chave}>
                      <span className="analysis-month-name">{mes.label}<small>{mes.chave.substring(0, 4)}</small></span>
                      <div className="analysis-month-revenue">
                        <strong>{formatarMoeda(mes.receita)}</strong>
                        <div className="analysis-track" aria-hidden="true"><span className="analysis-bar-income" style={{ width: `${mes.receita / maxBarra * 100}%` }} /></div>
                      </div>
                      <span className="analysis-month-count"><span className="sr-only">Ordens concluídas: </span>{quantidade}</span>
                    </li>;
                  })}
                </ul>
              </div>}
            </section>

            <aside className="analysis-operation-column">
              <section className="data-panel" aria-labelledby="ritmo-operacao">
                <div className="section-heading"><div><h2 id="ritmo-operacao">Ritmo da operação</h2><p>{totalOS} ordens de serviço no período</p></div></div>
                <div className="analysis-status-list">
                  {STATUS_OS_VALIDOS.map((status) => {
                    const quantidade = distribuicaoOS[status] || 0;
                    const porcentagem = totalOS > 0 ? quantidade / totalOS * 100 : 0;
                    return <div key={status}>
                      <div className="analysis-status-label">
                        <span className="status-label" data-tone={status === STATUS_OS.CONCLUIDA ? "success" : status === STATUS_OS.CANCELADA ? "danger" : "warning"}>{status}</span>
                        <strong>{quantidade}<small>{porcentagem.toFixed(0)}%</small></strong>
                      </div>
                      <div className="analysis-track" aria-hidden="true"><span style={{ width: `${porcentagem}%` }} /></div>
                    </div>;
                  })}
                </div>
              </section>
              <section className="analysis-commercial" aria-labelledby="conversao-orcamentos">
                <p className="analysis-eyebrow">Resultado comercial</p>
                <h2 id="conversao-orcamentos">Aprovação de orçamentos</h2>
                <strong className="analysis-approval-rate">{kpis.taxaAprovacao.toFixed(0)}<span>%</span></strong>
                <div className="analysis-track" aria-hidden="true"><span style={{ width: `${kpis.taxaAprovacao}%` }} /></div>
                <p><strong>{aprovados}</strong> aprovados de <strong>{orcamentosFiltrados.length}</strong> orçamentos no período.</p>
              </section>
            </aside>
          </div>

          <div className="analysis-ranking-grid">
            <section className="data-panel" aria-labelledby="clientes-destaque">
              <div className="section-heading"><div><h2 id="clientes-destaque">Clientes em destaque</h2><p>Os cinco maiores volumes em serviços e orçamentos.</p></div></div>
              {topClientes.length === 0 ? <div className="empty-state"><p>Os clientes com serviços concluídos ou orçamentos aprovados aparecerão aqui.</p></div> :
                <ol className="analysis-ranking">
                  {topClientes.map((cliente, indice) => <li key={cliente.cliente_id}>
                    <span className="analysis-rank-position">{String(indice + 1).padStart(2, "0")}</span>
                    <div className="analysis-ranked-content">
                      <div><span className="record-primary">{cliente.nome}</span><strong>{formatarMoeda(cliente.valor)}</strong></div>
                      <div className="analysis-track" aria-hidden="true"><span style={{ width: `${topClientes[0].valor > 0 ? cliente.valor / topClientes[0].valor * 100 : 0}%` }} /></div>
                    </div>
                  </li>)}
                </ol>}
              <p className="analysis-data-note">Soma de OS concluídas e orçamentos aprovados. Documentos vinculados podem compor o mesmo total.</p>
            </section>
            <section className="data-panel" aria-labelledby="itens-destaque">
              <div className="section-heading"><div><h2 id="itens-destaque">Serviços e produtos em destaque</h2><p>Itens com maior valor em orçamentos aprovados.</p></div></div>
              {topItens.length === 0 ? <div className="empty-state"><p>Aprove orçamentos para acompanhar os itens de maior participação.</p></div> :
                <ol className="analysis-ranking analysis-item-ranking">
                  {topItens.map((item, indice) => <li key={item.tipo + ":" + item.descricao}>
                    <span className="analysis-rank-position">{String(indice + 1).padStart(2, "0")}</span>
                    <div className="analysis-ranked-content">
                      <div><span className="record-primary">{item.descricao}</span><strong>{formatarMoeda(item.receita)}</strong></div>
                      <p className="record-meta">{item.tipo === "servico" ? "Serviço" : "Produto"} · {item.quantidade} {item.tipo === "servico" ? "execuções" : "vendas"}</p>
                    </div>
                  </li>)}
                </ol>}
            </section>
          </div>
        </>}
    </div>
  );
}
