import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  LockKeyhole,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { formatarData, formatarMoeda, mascaraMoeda, converterNumero } from "../utils/formatters";
import {
  formatarStatusNotaFiscal,
  novaRascunhoNotaFiscal,
  pendenciasNotaFiscal,
  statusNotaFiscal,
  type RascunhoNotaFiscal,
} from "../utils/notasFiscais";
import { consultarStatusNota, emitirNotaFiscal, NotaasApiError } from "../utils/notaasApi";
import "./notas-fiscais.css";

type NotasFiscaisProps = {
  usuarioId: string;
};

function chaveNotas(usuarioId: string) {
  return `portal-notas-fiscais-v1:${usuarioId}`;
}

function carregarNotas(usuarioId: string): RascunhoNotaFiscal[] {
  if (typeof window === "undefined") return [];
  try {
    const dados = window.localStorage.getItem(chaveNotas(usuarioId));
    if (!dados) return [];
    const lista: unknown = JSON.parse(dados);
    if (!Array.isArray(lista)) return [];
    return lista.filter((nota): nota is RascunhoNotaFiscal => {
      if (!nota || typeof nota !== "object") return false;
      const item = nota as Partial<RascunhoNotaFiscal>;
      return typeof item.id === "string" && item.tipo === "NFS-e";
    });
  } catch {
    return [];
  }
}

function rotuloStatusNotaas(status?: string): string {
  switch (status) {
    case "queued": return "Na fila";
    case "processing": return "Processando";
    case "issued": return "Emitida";
    case "cancelled": return "Cancelada";
    case "error": return "Erro na emissão";
    default: return "Ainda não enviada";
  }
}

export default function NotasFiscais({ usuarioId }: NotasFiscaisProps) {
  const [rascunhos, setRascunhos] = useState<RascunhoNotaFiscal[]>(() => carregarNotas(usuarioId));
  const [notaAtual, setNotaAtual] = useState<RascunhoNotaFiscal>(() => {
    const salvas = carregarNotas(usuarioId);
    return salvas[0] || novaRascunhoNotaFiscal();
  });
  const [mensagem, setMensagem] = useState("");
  const [emitindo, setEmitindo] = useState(false);
  const [consultandoStatus, setConsultandoStatus] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(chaveNotas(usuarioId), JSON.stringify(rascunhos));
  }, [rascunhos, usuarioId]);

  const pendencias = useMemo(() => pendenciasNotaFiscal(notaAtual), [notaAtual]);
  const status = statusNotaFiscal(notaAtual);
  const notaEmProcessamento = Boolean(notaAtual.notaasInvoiceId && ["queued", "processing"].includes(notaAtual.notaasStatus || ""));
  const notaEmitida = notaAtual.notaasStatus === "issued";

  function atualizar<K extends keyof RascunhoNotaFiscal>(campo: K, valor: RascunhoNotaFiscal[K]) {
    setNotaAtual((atual) => ({ ...atual, [campo]: valor }));
    setMensagem("");
  }

  function selecionarNota(nota: RascunhoNotaFiscal) {
    setNotaAtual(nota);
    setMensagem("");
  }

  function novaNota() {
    setNotaAtual(novaRascunhoNotaFiscal());
    setMensagem("");
  }

  function salvarNaLista(nota: RascunhoNotaFiscal) {
    setRascunhos((atuais) => {
      const existe = atuais.some((item) => item.id === nota.id);
      return existe
        ? atuais.map((item) => (item.id === nota.id ? nota : item))
        : [nota, ...atuais];
    });
  }

  function salvar(e: FormEvent) {
    e.preventDefault();
    const agora = new Date().toISOString();
    const notaSalva: RascunhoNotaFiscal = {
      ...notaAtual,
      status,
      atualizadoEm: agora,
    };

    salvarNaLista(notaSalva);
    setNotaAtual(notaSalva);
    setMensagem(status === "pronta-revisao"
      ? "Rascunho salvo e pronto para revisão."
      : "Rascunho salvo. Complete os campos pendentes antes de revisar.");
  }

  function excluirAtual() {
    setRascunhos((atuais) => atuais.filter((nota) => nota.id !== notaAtual.id));
    const proxima = rascunhos.find((nota) => nota.id !== notaAtual.id);
    setNotaAtual(proxima || novaRascunhoNotaFiscal());
    setMensagem("Rascunho excluído.");
  }

  function valorAlterado(valor: string) {
    const numero = converterNumero(valor);
    atualizar("valorServico", Number.isFinite(numero) ? numero : 0);
  }

  async function acompanharStatus(id: string, invoiceId: string) {
    setConsultandoStatus(true);
    try {
      for (let tentativa = 0; tentativa < 20; tentativa += 1) {
        if (tentativa > 0) await new Promise((resolve) => window.setTimeout(resolve, 3000));
        const resposta = await consultarStatusNota(invoiceId);
        const dados: Partial<RascunhoNotaFiscal> = {
          notaasInvoiceId: invoiceId,
          notaasStatus: resposta.status,
          notaasNumeroNfe: resposta.numeroNfe,
          notaasChNFSe: resposta.chNFSe,
          notaasPdfUrl: resposta.pdfUrl,
          notaasXmlUrl: resposta.xmlUrl,
          notaasErro: resposta.errorMessage,
          atualizadoEm: new Date().toISOString(),
        };
        setRascunhos((atuais) => atuais.map((item) => item.id === id ? { ...item, ...dados } : item));
        setNotaAtual((atual) => atual.id === id ? { ...atual, ...dados } : atual);

        if (["issued", "error", "cancelled"].includes(resposta.status || "")) {
          setMensagem(resposta.status === "issued"
            ? "NFS-e emitida. Os documentos ficarão disponíveis quando a Notaas concluir o processamento."
            : `A Notaas informou: ${rotuloStatusNotaas(resposta.status)}${resposta.errorMessage ? ` — ${resposta.errorMessage}` : ""}`);
          return;
        }
      }
      setMensagem("A nota ainda está sendo processada. Use o botão de emitir novamente para consultar depois.");
    } catch (error) {
      setMensagem(error instanceof NotaasApiError ? error.message : "Não foi possível consultar o status da nota.");
    } finally {
      setConsultandoStatus(false);
    }
  }

  async function emitir() {
    if (notaEmProcessamento && notaAtual.notaasInvoiceId) {
      void acompanharStatus(notaAtual.id, notaAtual.notaasInvoiceId);
      return;
    }
    if (notaEmitida) {
      setMensagem("Esta nota já foi emitida. Consulte os documentos abaixo antes de gerar outra.");
      return;
    }
    if (pendencias.length > 0 || emitindo || consultandoStatus) {
      setMensagem("Complete os dados pendentes antes de enviar a nota.");
      return;
    }

    setEmitindo(true);
    setMensagem("Enviando a solicitação para a Notaas…");
    try {
      const resposta = await emitirNotaFiscal(notaAtual);
      const notaAtualizada: RascunhoNotaFiscal = {
        ...notaAtual,
        notaasInvoiceId: resposta.invoiceId,
        notaasStatus: resposta.status || "queued",
        notaasErro: undefined,
        atualizadoEm: new Date().toISOString(),
      };
      salvarNaLista(notaAtualizada);
      setNotaAtual(notaAtualizada);
      setMensagem(`Solicitação enviada. Protocolo ${resposta.invoiceId || "recebido"}.`);
      if (resposta.invoiceId) void acompanharStatus(notaAtualizada.id, resposta.invoiceId);
    } catch (error) {
      setMensagem(error instanceof NotaasApiError ? error.message : "Não foi possível enviar a nota.");
    } finally {
      setEmitindo(false);
    }
  }

  return (
    <div className="product-page notas-page">
      <header className="page-header notas-page-header">
        <div>
          <p className="analysis-eyebrow">Fiscal / Documentos</p>
          <h1>Notas fiscais</h1>
          <p>Prepare NFS-e de serviços elétricos com os dados certos antes da emissão.</p>
        </div>
        <div className="page-actions">
          <span className="notas-mode-badge"><LockKeyhole size={14} aria-hidden="true" /> Emissão protegida</span>
          <button type="button" onClick={novaNota} className="btn-primary">
            <Plus size={18} aria-hidden="true" /> Novo rascunho
          </button>
        </div>
      </header>

      <section className="notas-alert inline-alert" aria-label="Status da emissão">
        <AlertTriangle size={18} aria-hidden="true" />
        <div>
          <strong>Integração Notaas preparada com emissão protegida.</strong>
          <p>A solicitação só sai pelo backend depois que a API key, a alíquota ISS e os dados fiscais forem configurados no ambiente seguro.</p>
        </div>
      </section>

      <div className="notas-layout">
        <aside className="surface-card notas-list-panel" aria-labelledby="notas-salvas">
          <div className="notas-panel-heading">
            <div>
              <span className="analysis-eyebrow">Arquivo local</span>
              <h2 id="notas-salvas">Rascunhos</h2>
            </div>
            <strong>{rascunhos.length}</strong>
          </div>
          {rascunhos.length === 0 ? (
            <div className="notas-list-empty">
              <FileText size={22} aria-hidden="true" />
              <p>Seus rascunhos aparecerão aqui.</p>
              <button type="button" className="btn-secondary" onClick={novaNota}>Criar primeiro</button>
            </div>
          ) : (
            <div className="notas-list" role="list">
              {rascunhos.map((nota) => {
                const notaStatus = statusNotaFiscal(nota);
                const ativa = nota.id === notaAtual.id;
                return (
                  <button
                    type="button"
                    role="listitem"
                    key={nota.id}
                    onClick={() => selecionarNota(nota)}
                    className="notas-list-item"
                    data-active={ativa}
                  >
                    <span className="notas-list-item-icon"><FileText size={16} aria-hidden="true" /></span>
                    <span className="notas-list-item-copy">
                      <strong>{nota.clienteNome || "Tomador não informado"}</strong>
                      <small>{formatarData(nota.dataEmissao)} · {formatarStatusNotaFiscal(notaStatus)}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="notas-local-note">Os rascunhos ficam neste navegador até a integração com o banco de dados.</p>
        </aside>

        <form className="surface-card notas-editor" onSubmit={salvar}>
          <div className="notas-editor-heading">
            <div>
              <span className="analysis-eyebrow">NFS-e · Serviço</span>
              <h2>{notaAtual.clienteNome || "Novo documento fiscal"}</h2>
              <p>Preencha o que já sabe. O restante pode ser completado depois.</p>
            </div>
            <span className="status-label" data-tone={notaAtual.notaasStatus === "issued" || status === "pronta-revisao" ? "success" : "warning"}>
              {notaAtual.notaasStatus ? `Notaas: ${rotuloStatusNotaas(notaAtual.notaasStatus)}` : formatarStatusNotaFiscal(status)}
            </span>
          </div>

          <section className="notas-form-section">
            <div className="notas-section-title"><span>01</span><div><h3>Tomador do serviço</h3><p>Quem receberá a NFS-e?</p></div></div>
            <div className="form-grid">
              <label><span className="field-label">Nome ou razão social <b>*</b></span><input className="input-base" value={notaAtual.clienteNome} onChange={(e) => atualizar("clienteNome", e.target.value)} placeholder="Ex.: João da Silva" /></label>
              <label><span className="field-label">CPF ou CNPJ <b>*</b></span><input className="input-base" value={notaAtual.clienteDocumento} onChange={(e) => atualizar("clienteDocumento", e.target.value)} placeholder="Somente números ou formatado" /></label>
              <label><span className="field-label">E-mail</span><input type="email" className="input-base" value={notaAtual.clienteEmail} onChange={(e) => atualizar("clienteEmail", e.target.value)} placeholder="cliente@email.com" /></label>
              <label><span className="field-label">Endereço</span><input className="input-base" value={notaAtual.clienteEndereco} onChange={(e) => atualizar("clienteEndereco", e.target.value)} placeholder="Rua, número, bairro" /></label>
            </div>
          </section>

          <section className="notas-form-section">
            <div className="notas-section-title"><span>02</span><div><h3>Prestação</h3><p>Dados que identificam o serviço e o local da emissão.</p></div></div>
            <div className="form-grid">
              <label><span className="field-label">Município de emissão <b>*</b></span><input className="input-base" value={notaAtual.municipio} onChange={(e) => atualizar("municipio", e.target.value)} placeholder="Ex.: Uberlândia - MG" /></label>
              <label><span className="field-label">Data de emissão</span><input type="date" className="input-base" value={notaAtual.dataEmissao} onChange={(e) => atualizar("dataEmissao", e.target.value)} /></label>
              <label><span className="field-label">Código do serviço municipal</span><input className="input-base" value={notaAtual.codigoServico} onChange={(e) => atualizar("codigoServico", e.target.value)} placeholder="Consulte a prefeitura" /></label>
              <label><span className="field-label">Valor do serviço <b>*</b></span><input inputMode="decimal" className="input-base" value={notaAtual.valorServico ? mascaraMoeda(String(Math.round(notaAtual.valorServico * 100))) : ""} onChange={(e) => valorAlterado(e.target.value)} placeholder="0,00" /></label>
              <label className="notas-span-full"><span className="field-label">Descrição do serviço <b>*</b></span><textarea className="input-base" rows={3} value={notaAtual.descricaoServico} onChange={(e) => atualizar("descricaoServico", e.target.value)} placeholder="Ex.: Instalação de quadro de distribuição e testes de funcionamento." /></label>
              <label className="notas-span-full"><span className="field-label">Observações</span><textarea className="input-base" rows={2} value={notaAtual.observacoes} onChange={(e) => atualizar("observacoes", e.target.value)} placeholder="Informações internas para a revisão." /></label>
            </div>
          </section>

          <section className="notas-review-section" aria-labelledby="notas-revisao">
            <div className="notas-review-heading"><div><span className="analysis-eyebrow">Conferência</span><h3 id="notas-revisao">Antes de emitir</h3></div><strong>{formatarMoeda(notaAtual.valorServico)}</strong></div>
            {pendencias.length > 0 ? (
              <ul className="notas-pending-list">{pendencias.map((pendencia) => <li key={pendencia}><AlertTriangle size={14} aria-hidden="true" /> {pendencia}</li>)}</ul>
            ) : (
              <p className="notas-ready"><CheckCircle2 size={16} aria-hidden="true" /> Dados essenciais preenchidos. Revise os impostos no ambiente fiscal antes de transmitir.</p>
            )}
            {notaAtual.notaasInvoiceId && (
              <div className="notas-provider-result">
                <strong>Retorno da Notaas</strong>
                <span>{rotuloStatusNotaas(notaAtual.notaasStatus)} · protocolo {notaAtual.notaasInvoiceId}</span>
                {notaAtual.notaasNumeroNfe && <span>Número da NFS-e: {notaAtual.notaasNumeroNfe}</span>}
                {notaAtual.notaasErro && <span className="notas-provider-error">{notaAtual.notaasErro}</span>}
                {(notaAtual.notaasPdfUrl || notaAtual.notaasXmlUrl) && <div className="notas-document-links">
                  {notaAtual.notaasPdfUrl && <a href={notaAtual.notaasPdfUrl} target="_blank" rel="noreferrer">Abrir PDF</a>}
                  {notaAtual.notaasXmlUrl && <a href={notaAtual.notaasXmlUrl} target="_blank" rel="noreferrer">Abrir XML</a>}
                </div>}
              </div>
            )}
          </section>

          <footer className="notas-editor-footer">
            <div>{mensagem && <span className="notas-feedback" role="status">{mensagem}</span>}</div>
            <div className="page-actions">
              {rascunhos.some((nota) => nota.id === notaAtual.id) && <button type="button" className="btn-secondary notas-delete" onClick={excluirAtual}><Trash2 size={16} aria-hidden="true" /> Excluir</button>}
              <button type="submit" className="btn-primary"><Save size={16} aria-hidden="true" /> Salvar rascunho</button>
              <button type="button" className="btn-secondary notas-emit-button" disabled={pendencias.length > 0 || emitindo || consultandoStatus || notaEmitida} onClick={() => void emitir()} title={pendencias.length > 0 ? "Complete os campos pendentes para habilitar a emissão" : notaEmitida ? "Esta NFS-e já foi emitida" : notaEmProcessamento ? "Consultar o processamento na Notaas" : "Enviar a NFS-e para a Notaas"}>
                {emitindo || consultandoStatus ? <RefreshCw size={16} aria-hidden="true" className="notas-spin" /> : <Send size={16} aria-hidden="true" />}
                {emitindo ? "Enviando…" : consultandoStatus ? "Consultando…" : notaEmProcessamento ? "Atualizar status" : notaEmitida ? "Nota emitida" : "Emitir nota"}
              </button>
            </div>
          </footer>
        </form>

        <aside className="surface-card notas-next-panel" aria-labelledby="proxima-etapa">
          <span className="analysis-eyebrow">Próxima etapa</span>
          <h2 id="proxima-etapa">O que falta para emitir?</h2>
          <ol className="notas-checklist">
            <li data-done={Boolean(notaAtual.municipio.trim())}><span>1</span><div><strong>Município</strong><small>Definir regras e código de serviço.</small></div></li>
            <li><span>2</span><div><strong>Empresa</strong><small>Conferir CNPJ, endereço e enquadramento MEI.</small></div></li>
            <li><span>3</span><div><strong>Integração Notaas</strong><small>Configurar a API key e a alíquota no backend seguro.</small></div></li>
            <li><span>4</span><div><strong>Homologação</strong><small>Testar autorização antes da produção.</small></div></li>
          </ol>
          <div className="notas-mei-note">
            <strong>Rota mais simples para MEI</strong>
            <p>Use o emissor web nacional com sua conta gov.br. O portal não exige certificado digital para a emissão manual.</p>
          </div>
          <div className="notas-links">
            <a href="https://www.gov.br/nfse/pt-br/pagina-inicial" target="_blank" rel="noreferrer">Portal NFS-e <ExternalLink size={14} aria-hidden="true" /></a>
            <a href="https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica" target="_blank" rel="noreferrer">Documentação técnica <ExternalLink size={14} aria-hidden="true" /></a>
          </div>
        </aside>
      </div>
    </div>
  );
}
