import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Users,
  FilePlus,
  Wrench,
  Package,
  ArrowRight,
} from "lucide-react";
import { supabase } from "../supabase";
import { formatarMoeda, formatarData, primeiroDiaMes, primeiroDiaMesAnterior } from "../utils/formatters";
import { formatarNumero } from "../utils/constantes";


type DashboardProps = {
  setPagina: (pagina: string) => void;
  aoNovoOrcamento: () => void;
};

type KPIs = {
  faturamentoMes: number;
  faturamentoMesAnterior: number;
  osAbertas: number;
  osAndamento: number;
  osConcluidasMes: number;
  totalClientes: number;
  totalProdutos: number;
  totalServicos: number;
  estoqueBaixo: number;
  totalOrcamentosPendentes: number;
};

type OSRecente = {
  id: number;
  numero: number;
  status: string;
  data_abertura: string;
  data_previsao?: string | null;
  valor_total: number;
  cliente_nome: string | null;
};

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

const KPIS_INICIAIS: KPIs = {
  faturamentoMes: 0,
  faturamentoMesAnterior: 0,
  osAbertas: 0,
  osAndamento: 0,
  osConcluidasMes: 0,
  totalClientes: 0,
  totalProdutos: 0,
  totalServicos: 0,
  estoqueBaixo: 0,
  totalOrcamentosPendentes: 0,
};

export default function Dashboard({ setPagina, aoNovoOrcamento }: DashboardProps) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [kpis, setKpis] = useState<KPIs>(KPIS_INICIAIS);
  const [osRecentes, setOsRecentes] = useState<OSRecente[]>([]);

  const [proximosServicos, setProximosServicos] = useState<OSRecente[]>([]);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    carregar();

    // Recarrega dados sempre que o usuário volta para a aba do navegador
    function onFocus() {
      carregar();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);

    async function carregar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUsuario(user);
      if (!user) {
        setCarregando(false);
        return;
      }

      const agora = new Date();
      const hojeISO = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
      const inicioMesISO = primeiroDiaMes();
      const inicioMesAnteriorISO = primeiroDiaMesAnterior();

      const [
        clientesRes,
        produtosRes,
        servicosRes,
        orcamentosRes,
        ordensRes,
        ordensMesRes,
        ordensMesAnteriorRes,
        osAbertasRes,
        osAndamentoRes,
        proximosRes,
      ] = await Promise.all([
        supabase
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("produtos")
          .select("id, estoque, estoque_minimo")
          .eq("user_id", user.id),
        supabase
          .from("servicos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("orcamentos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "Pendente"),
        supabase
          .from("ordens_servico")
          .select(
            "id, numero, status, data_abertura, valor_total, cliente_id"
          )
          .eq("user_id", user.id)
          .order("numero", { ascending: false })
          .limit(5),
        // OS do mês atual (para faturamento)
        supabase
          .from("ordens_servico")
          .select("valor_total, status, data_abertura")
          .eq("user_id", user.id)
          .eq("status", "Concluída")
          .gte("data_abertura", inicioMesISO)
          .lte("data_abertura", hojeISO),
        // OS do mês anterior (para variação)
        supabase
          .from("ordens_servico")
          .select("valor_total")
          .eq("user_id", user.id)
          .eq("status", "Concluída")
          .gte("data_abertura", inicioMesAnteriorISO)
          .lt("data_abertura", inicioMesISO),
        // KPIs reais: contagem separada de OS abertas (não derivado da lista limitada)
        supabase
          .from("ordens_servico")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "Aberta"),
        // KPIs reais: contagem separada de OS em andamento
        supabase
          .from("ordens_servico")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "Em andamento"),
        supabase
          .from("ordens_servico")
          .select("id, numero, status, data_abertura, data_previsao, valor_total, cliente_id")
          .eq("user_id", user.id)
          .in("status", ["Aberta", "Em andamento"])
          .not("data_previsao", "is", null)
          .order("data_previsao")
          .limit(6),
      ]);

      if ([clientesRes, produtosRes, servicosRes, orcamentosRes, ordensRes, ordensMesRes, ordensMesAnteriorRes, osAbertasRes, osAndamentoRes, proximosRes].some((res) => res.error)) {
        setErro(true);
        setCarregando(false);
        return;
      }
      setErro(false);
      const produtos = produtosRes.data || [];
      const ordens = ordensRes.data || [];
      const proximos = proximosRes.data || [];

      const estoqueBaixo = produtos.filter(
        (p) => p.estoque <= p.estoque_minimo
      ).length;

      const osAbertas = osAbertasRes.count || 0;
      const osAndamento = osAndamentoRes.count || 0;
      const osConcluidasMes = ordensMesRes.data || [];
      const faturamentoMes = osConcluidasMes.reduce(
        (total, o) =>
          total + (Number(o.valor_total) || 0),
        0
      );
      const faturamentoMesAnterior = (ordensMesAnteriorRes.data || []).reduce(
        (total, o) => total + (Number(o.valor_total) || 0),
        0
      );

      setKpis({
        faturamentoMes,
        faturamentoMesAnterior,
        osAbertas,
        osAndamento,
        osConcluidasMes: osConcluidasMes.length,
        totalClientes: clientesRes.count || 0,
        totalProdutos: produtos.length,
        totalServicos: servicosRes.count || 0,
        estoqueBaixo,
        totalOrcamentosPendentes:
          orcamentosRes.count || 0,
      });

      // Buscar nomes dos clientes das OS recentes
      if (ordens.length > 0 || proximos.length > 0) {
        const clienteIds = Array.from(
          new Set([...ordens, ...proximos].map((o) => o.cliente_id))
        );
        const { data: clientesData } = await supabase
          .from("clientes")
          .select("id, nome")
          .eq("user_id", user.id)
          .in("id", clienteIds);

        const mapaClientes = new Map(
          (clientesData || []).map((c) => [c.id, c.nome])
        );

        setProximosServicos(proximos.map((o) => ({ ...o, valor_total: Number(o.valor_total) || 0, cliente_nome: mapaClientes.get(o.cliente_id) || null })));
        setOsRecentes(
          ordens.map((o) => ({
            id: o.id,
            numero: o.numero,
            status: o.status,
            data_abertura: o.data_abertura,
            valor_total: Number(o.valor_total) || 0,
            cliente_nome:
              mapaClientes.get(o.cliente_id) || null,
          }))
        );
      } else {
        setOsRecentes([]);
        setProximosServicos([]);
      }

      setCarregando(false);
    }

  }, []);

  const agora = new Date();
  const mes = agora.toLocaleDateString("pt-BR", { month: "long" });
  const anterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const mesAnterior = anterior.toLocaleDateString("pt-BR", { month: "long" });
  const variacao = kpis.faturamentoMesAnterior > 0
    ? ((kpis.faturamentoMes - kpis.faturamentoMesAnterior) / kpis.faturamentoMesAnterior) * 100
    : null;
  const pendencias = [
    { titulo: "O.S. aguardando início", detalhe: "Organize os próximos atendimentos", quantidade: kpis.osAbertas, pagina: "ordens-servico" },
    { titulo: "Serviços em andamento", detalhe: "Acompanhe a execução", quantidade: kpis.osAndamento, pagina: "ordens-servico" },
    { titulo: "Orçamentos pendentes", detalhe: "Acompanhe a aprovação dos clientes", quantidade: kpis.totalOrcamentosPendentes, pagina: "orcamentos" },
    ...(kpis.estoqueBaixo > 0 ? [{ titulo: "Materiais para repor", detalhe: "Produtos abaixo do estoque mínimo", quantidade: kpis.estoqueBaixo, pagina: "produtos" }] : []),
  ];
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const maiorFaturamento = Math.max(kpis.faturamentoMes, kpis.faturamentoMesAnterior, 1);

  if (carregando) {
    return <div className="max-w-7xl mx-auto space-y-6" role="status" aria-label="Carregando painel">
      <div className="h-10 w-56 bg-slate-200 rounded-lg animate-pulse" />
      <div className="grid md:grid-cols-2 gap-6">{[0, 1].map((i) => <div key={i} className="h-64 rounded-2xl bg-slate-200 animate-pulse" />)}</div>
    </div>;
  }

  if (erro) {
    return <div className="surface-card p-8 max-w-7xl mx-auto" role="alert">
      <h1 className="text-2xl font-bold text-slate-900">Não foi possível carregar o painel</h1>
      <p className="text-slate-600 mt-2">Confira sua conexão e tente novamente.</p>
      <button className="btn-primary mt-4" onClick={() => window.location.reload()}>Tentar novamente</button>
    </div>;
  }

  return (
    <div className="product-page">
      <header className="page-header">
        <div>
          <h1>{saudacao()}{usuario?.user_metadata?.nome ? `, ${usuario.user_metadata.nome.split(" ")[0]}` : ""}.</h1>
          <p>Acompanhe os prazos, organize a execução e dê o próximo passo.</p>
        </div>
        <div className="page-actions"><button type="button" onClick={aoNovoOrcamento} className="btn-primary"><FilePlus size={18} aria-hidden="true" />Novo orçamento</button></div>
      </header>

      <div className="operation-layout">
        <section aria-labelledby="agenda-titulo">
          <div className="operation-heading">
            <div><h2 id="agenda-titulo">Na programação</h2><p>Prazos de conclusão das O.S. abertas e em andamento</p></div>
            <button type="button" className="icon-button" aria-label="Ver todas as ordens de serviço" onClick={() => setPagina("ordens-servico")}><ArrowRight size={18} /></button>
          </div>
          {proximosServicos.length === 0 ? (
            <div className="py-10 sm:py-14">
              <p className="text-xs text-[var(--color-muted)] mb-2">Previsões de conclusão</p>
              <h3 className="text-xl font-semibold max-w-xs">Abra espaço para o próximo serviço.</h3>
              <p className="text-sm text-[var(--color-muted)] mt-3 max-w-sm">Nenhuma O.S. ativa com prazo cadastrado. Defina a previsão de conclusão para organizar o trabalho aqui.</p>
              <button type="button" className="btn-secondary mt-5" onClick={() => setPagina("ordens-servico")}>Organizar ordens de serviço</button>
            </div>
          ) : (
            <ol className="schedule-list">
              {proximosServicos.map((os) => {
                const date = new Date(`${os.data_previsao?.slice(0,10)}T12:00:00`);
                const atrasado = date < hoje;
                const previstoHoje = date.toDateString() === hoje.toDateString();
                return <li className="schedule-entry" key={os.id}>
                  <time dateTime={os.data_previsao || undefined}><strong>{date.getDate().toString().padStart(2,"0")}</strong>{date.toLocaleDateString("pt-BR", { month: "short" })}</time>
                  <div className="min-w-0">
                    <div className="flex justify-between flex-wrap gap-2"><h3>{os.cliente_nome || "Cliente não informado"}</h3><span className="status-label" data-tone={atrasado ? "danger" : previstoHoje ? "warning" : undefined}>{atrasado ? "Prazo vencido" : previstoHoje ? "Vence hoje" : os.status}</span></div>
                    <p>O.S. #{formatarNumero(os.numero)} · {formatarMoeda(os.valor_total)}</p>
                    <button type="button" onClick={() => setPagina("ordens-servico")} className="text-xs underline underline-offset-4 mt-2 min-h-11">Acompanhar execução</button>
                  </div>
                </li>;
              })}
            </ol>
          )}
        </section>

        <aside className="attention-queue" aria-labelledby="atencao-titulo">
          <h2 id="atencao-titulo">Pontos de atenção</h2>
          <p>Uma visão do trabalho que está em aberto.</p>
          {pendencias.map(({ titulo, detalhe, quantidade, pagina }) => (
            <button type="button" key={pagina + titulo} onClick={() => setPagina(pagina)} className="attention-item">
              <strong>{quantidade.toString().padStart(2,"0")}</strong>
              <span>{titulo}<small>{detalhe}</small></span>
              <ArrowRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
            </button>
          ))}
        </aside>
      </div>

      <section className="revenue-summary" aria-labelledby="faturamento-titulo">
        <div>
          <h2 id="faturamento-titulo">Faturamento de {mes}</h2>
          <div className="amount">{formatarMoeda(kpis.faturamentoMes)}</div>
          <p>{kpis.osConcluidasMes} O.S. concluída{kpis.osConcluidasMes !== 1 ? "s" : ""} · de 1 a {agora.getDate()} de {mes}</p>
          <button type="button" className="text-xs underline underline-offset-4 mt-2 min-h-11" onClick={() => setPagina("financeiro")}>Consultar movimentações financeiras</button>
        </div>
        <div>
          <p>{variacao === null ? `Sem faturamento em ${mesAnterior} para comparar.` : `${variacao >= 0 ? "+" : "−"}${Math.abs(variacao).toFixed(0)}% em relação a ${mesAnterior} completo`}</p>
          {[{label:mes,value:kpis.faturamentoMes},{label:mesAnterior,value:kpis.faturamentoMesAnterior}].map(item => <div className="comparison-row" key={item.label}>
            <span className="capitalize">{item.label}</span><span className="track"><span className="fill block" style={{width:`${item.value / maiorFaturamento * 100}%`}} /></span><span>{formatarMoeda(item.value)}</span>
          </div>)}
          <p className="mt-3 max-w-md">Valores das O.S. concluídas, agrupados pela data de abertura. O mês atual ainda está em andamento.</p>
        </div>
      </section>

      <section className="data-panel" aria-labelledby="recentes-titulo">
        <div className="section-heading">
          <div><h2 id="recentes-titulo">Últimas ordens de serviço</h2><p>As cinco O.S. mais recentes da operação</p></div>
          <button type="button" className="btn-secondary" onClick={() => setPagina("ordens-servico")}>Ver todas <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        {osRecentes.length === 0 ? <div className="empty-state"><h3>A operação começa com a primeira O.S.</h3><p>Converta um orçamento aprovado ou crie uma ordem de serviço para acompanhar a execução.</p></div> : <>
          <div className="hidden md:block overflow-x-auto"><table className="data-table">
            <thead><tr>{["Ordem / cliente","Abertura","Situação","Valor"].map(label=><th scope="col" key={label} className={label==="Valor"?"text-right":""}>{label}</th>)}</tr></thead>
            <tbody>{osRecentes.map(os=><tr key={os.id}>
              <td><div className="record-primary">{os.cliente_nome || "Cliente não informado"}</div><div className="record-meta">O.S. #{formatarNumero(os.numero)}</div></td>
              <td className="whitespace-nowrap">{formatarData(os.data_abertura)}</td>
              <td><span className="status-label" data-tone={os.status === "Concluída" ? "success" : os.status === "Em andamento" ? "warning" : undefined}>{os.status}</span></td>
              <td className="text-right whitespace-nowrap font-semibold tabular-nums">{formatarMoeda(os.valor_total)}</td>
            </tr>)}</tbody>
          </table></div>
          <ul className="md:hidden">{osRecentes.map(os=><li key={os.id} className="record-row">
            <div className="flex flex-wrap justify-between gap-2"><p className="record-primary">{os.cliente_nome || "Cliente não informado"}</p><span className="status-label">{os.status}</span></div>
            <p className="record-meta">O.S. #{formatarNumero(os.numero)} · {formatarData(os.data_abertura)}</p><p className="text-sm font-semibold mt-2">{formatarMoeda(os.valor_total)}</p>
          </li>)}</ul>
        </>}
      </section>
      <nav aria-label="Acesso aos cadastros" className="catalog-links">
        {[{label:"Clientes",total:kpis.totalClientes,page:"clientes",Icon:Users},{label:"Serviços",total:kpis.totalServicos,page:"servicos",Icon:Wrench},{label:"Produtos",total:kpis.totalProdutos,page:"produtos",Icon:Package}].map(({label,total,page,Icon})=><button key={page} type="button" onClick={()=>setPagina(page)}><Icon size={16} aria-hidden="true"/>{label}<strong>{total}</strong></button>)}
      </nav>
    </div>
  );
}
