import { useEffect, useRef, useState, type ReactElement } from "react";
import { Upload, Trash2, Save, Mail, Phone, MapPin, ArrowUpRight, Check } from "lucide-react";
import { useEmpresa } from "../contexts/EmpresaContext";
import { useToast } from "../components/ui/toast";
import ConfirmDialog from "./ConfirmDialog";
import "./analysis-pages.css";

const CORES_PRIMARIAS_SUGERIDAS = [
  { nome: "Amarelo", valor: "#FFD60A" },
  { nome: "Azul", valor: "#3B82F6" },
  { nome: "Verde", valor: "#10B981" },
  { nome: "Vermelho", valor: "#EF4444" },
  { nome: "Roxo", valor: "#8B5CF6" },
  { nome: "Laranja", valor: "#F97316" },
];

const CORES_SECUNDARIAS_SUGERIDAS = [
  { nome: "Azul marinho", valor: "#0D1B2A" },
  { nome: "Cinza escuro", valor: "#1F2937" },
  { nome: "Preto", valor: "#0A0A0A" },
  { nome: "Verde escuro", valor: "#064E3B" },
  { nome: "Vinho", valor: "#7C2D12" },
  { nome: "Grafite", valor: "#374151" },
];

export default function Configuracoes(): ReactElement {
  const { empresa, carregando, atualizar, uploadLogo, removerLogo } =
    useEmpresa();
  const { mostrarToast } = useToast();

  const [nome, setNome] = useState("");
  const [slogan, setSlogan] = useState("");
  const [emailContato, setEmailContato] = useState("");
  const [telefoneContato, setTelefoneContato] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [enderecoEmpresa, setEnderecoEmpresa] = useState("");
  const [corPrimaria, setCorPrimaria] = useState("#FFD60A");
  const [corSecundaria, setCorSecundaria] = useState("#0D1B2A");
  const [salvando, setSalvando] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [secao, setSecao] = useState<"empresa" | "visual">("empresa");
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [removendoLogo, setRemovendoLogo] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preenche o form quando a empresa carrega
  useEffect(() => {
    if (empresa) {
      setNome(empresa.nome || "");
      setSlogan(empresa.slogan || "");
      setEmailContato(empresa.email_contato || "");
      setTelefoneContato(empresa.telefone_contato || "");
      setCnpj(empresa.cnpj || "");
      setEnderecoEmpresa(empresa.endereco || "");
      setCorPrimaria(empresa.cor_primaria || "#FFD60A");
      setCorSecundaria(empresa.cor_secundaria || "#0D1B2A");
    }
  }, [empresa]);

  async function salvarAlteracoes() {
    if (!nome.trim()) {
      mostrarToast("Digite o nome da empresa.", "alerta");
      return;
    }

    setSalvando(true);
    try {
      await atualizar({
        nome: nome.trim(),
        slogan: slogan.trim() || null,
        email_contato: emailContato.trim() || null,
        telefone_contato: telefoneContato.trim() || null,
        cnpj: cnpj.trim() || null,
        endereco: enderecoEmpresa.trim() || null,
        cor_primaria: corPrimaria,
        cor_secundaria: corSecundaria,
      });
      mostrarToast(
        "Configurações salvas com sucesso!",
        "sucesso"
      );
    } catch (error) {
      console.error(error);
      const mensagem =
        error instanceof Error
          ? error.message
          : "Erro ao salvar configurações.";
      mostrarToast(mensagem, "erro");
    } finally {
      setSalvando(false);
    }
  }

  async function handleSelecionarArquivo(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    setEnviandoLogo(true);
    try {
      await uploadLogo(file);
      mostrarToast("Logo atualizada com sucesso!", "sucesso");
    } catch (error) {
      console.error(error);
      const mensagem =
        error instanceof Error ? error.message : "Erro ao enviar logo.";
      mostrarToast(mensagem, "erro");
    } finally {
      setEnviandoLogo(false);
      // Permite selecionar o mesmo arquivo de novo
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleRemoverLogo() {
    if (!empresa?.logo_url) return;

    setRemovendoLogo(true);
    try {
      await removerLogo();
      mostrarToast("Logo removida.", "sucesso");
      setConfirmarRemocao(false);
    } catch (error) {
      console.error(error);
      mostrarToast("Erro ao remover logo.", "erro");
    } finally {
      setRemovendoLogo(false);
    }
  }

  function descartarAlteracoes() {
    if (!empresa) return;
    setNome(empresa.nome);
    setSlogan(empresa.slogan || "");
    setEmailContato(empresa.email_contato || "");
    setTelefoneContato(empresa.telefone_contato || "");
    setCnpj(empresa.cnpj || "");
    setEnderecoEmpresa(empresa.endereco || "");
    setCorPrimaria(empresa.cor_primaria || "#FFD60A");
    setCorSecundaria(empresa.cor_secundaria || "#0D1B2A");
  }

  const alteracoesPendentes = Boolean(empresa && (
    nome !== empresa.nome || slogan !== (empresa.slogan || "") ||
    emailContato !== (empresa.email_contato || "") || telefoneContato !== (empresa.telefone_contato || "") ||
    cnpj !== (empresa.cnpj || "") || enderecoEmpresa !== (empresa.endereco || "") ||
    corPrimaria !== (empresa.cor_primaria || "#FFD60A") || corSecundaria !== (empresa.cor_secundaria || "#0D1B2A")
  ));

  if (carregando && !empresa) {
    return <div className="product-page"><header className="page-header"><div><h1>Configurações</h1><p>Identidade e informações da empresa.</p></div></header><div className="data-panel empty-state" role="status"><p>Carregando configurações…</p></div></div>;
  }

  return (
    <div className="product-page analysis-page">
      <header className="page-header">
        <div>
          <p className="analysis-eyebrow">Workspace / Empresa</p>
          <h1>Configurações</h1>
          <p>A identidade da sua empresa, do painel aos documentos.</p>
        </div>
        <span className="analysis-save-status" role="status">
          {alteracoesPendentes ? <><span className="analysis-unsaved-dot" />Alterações não salvas</> : <><Check size={16} aria-hidden="true" />Tudo atualizado</>}
        </span>
      </header>

      <div className="analysis-settings-layout">
        <div className="analysis-settings-main">
          <div className="filter-tabs analysis-settings-tabs" aria-label="Seções de configuração">
            <button type="button" aria-pressed={secao === "empresa"} onClick={() => setSecao("empresa")}>
              <span>01</span> Dados da empresa
            </button>
            <button type="button" aria-pressed={secao === "visual"} onClick={() => setSecao("visual")}>
              <span>02</span> Identidade visual
            </button>
          </div>
          <form id="empresa-configuracoes" onSubmit={(e) => { e.preventDefault(); salvarAlteracoes(); }} className="data-panel analysis-settings-form">
            {secao === "empresa" ? <>
              <section className="form-section">
                <h3>Como sua empresa se apresenta</h3>
                <p>Nome e assinatura utilizados no painel e nos documentos.</p>
                <div className="form-grid">
                  <div className="analysis-span-full">
                    <label htmlFor="empresa_nome" className="field-label">Nome da empresa *</label>
                    <input id="empresa_nome" type="text" autoComplete="organization" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: RJ Elétrica" className="input-base" required />
                  </div>
                  <div className="analysis-span-full">
                    <label htmlFor="empresa_slogan" className="field-label">Slogan</label>
                    <input id="empresa_slogan" value={slogan} onChange={(e) => setSlogan(e.target.value)} placeholder="Ex.: Serviços elétricos com qualidade" className="input-base" />
                  </div>
                  <div className="analysis-span-full">
                    <label htmlFor="empresa_cnpj" className="field-label">CNPJ / CPF</label>
                    <input id="empresa_cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" className="input-base" />
                  </div>
                </div>
              </section>
              <section className="form-section">
                <h3>Contato e localização</h3>
                <p>Dados que seus clientes encontrarão nos PDFs e orçamentos.</p>
                <div className="form-grid">
                  <div>
                    <label htmlFor="empresa_email" className="field-label">E-mail de contato</label>
                    <input id="empresa_email" type="email" autoComplete="email" value={emailContato} onChange={(e) => setEmailContato(e.target.value)} placeholder="contato@empresa.com.br" className="input-base" />
                  </div>
                  <div>
                    <label htmlFor="empresa_telefone" className="field-label">Telefone / WhatsApp</label>
                    <input id="empresa_telefone" type="tel" autoComplete="tel" value={telefoneContato} onChange={(e) => setTelefoneContato(e.target.value)} placeholder="(11) 98765-4321" className="input-base" />
                  </div>
                  <div className="analysis-span-full">
                    <label htmlFor="empresa_endereco" className="field-label">Endereço</label>
                    <input id="empresa_endereco" autoComplete="street-address" value={enderecoEmpresa} onChange={(e) => setEnderecoEmpresa(e.target.value)} placeholder="Rua, número, bairro e cidade" className="input-base" />
                  </div>
                </div>
              </section>
            </> : <>
              <section className="form-section">
                <h3>Logomarca</h3><p>Sua marca no menu lateral e na apresentação dos documentos.</p>
                <div className="analysis-logo-editor">
                  <div className="analysis-logo-preview">
                    {empresa?.logo_url ? <img src={empresa.logo_url} alt={`Logomarca de ${nome || "sua empresa"}`} /> : <span>{(nome || "M").charAt(0).toUpperCase()}</span>}
                  </div>
                  <div>
                    <p className="record-meta">PNG, JPG, SVG ou WEBP, até 5 MB.<br />Prefira uma imagem quadrada, a partir de 256 × 256 px.</p>
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                      onChange={handleSelecionarArquivo} className="hidden" aria-label="Selecionar arquivo de logo" />
                    <div className="page-actions">
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={enviandoLogo} className="btn-secondary">
                        <Upload size={16} aria-hidden="true" />{enviandoLogo ? "Enviando…" : empresa?.logo_url ? "Trocar logo" : "Enviar logo"}
                      </button>
                      {empresa?.logo_url && <button type="button" onClick={() => setConfirmarRemocao(true)} disabled={enviandoLogo} className="icon-button analysis-delete" aria-label="Remover logo" title="Remover logo"><Trash2 size={17} aria-hidden="true" /></button>}
                    </div>
                    <p className="analysis-upload-note">O envio ou a remoção da logo é aplicado imediatamente.</p>
                  </div>
                </div>
              </section>
              <section className="form-section">
                <h3>Cores da marca</h3><p>Uma cor para destaques, outra para a estrutura do painel.</p>
                <div className="analysis-colors-grid">
                  <fieldset>
                    <legend className="field-label">Cor primária</legend>
                    <p className="record-meta">Botões e destaques</p>
                    <div className="analysis-color-swatches">
                      {CORES_PRIMARIAS_SUGERIDAS.map((cor) => <button key={cor.valor} type="button" onClick={() => setCorPrimaria(cor.valor)}
                        className="analysis-color-swatch" style={{ background: cor.valor }} aria-label={`Cor primária: ${cor.nome}`} title={cor.nome} aria-pressed={corPrimaria === cor.valor}>
                        {corPrimaria === cor.valor && <Check size={15} aria-hidden="true" />}
                      </button>)}
                    </div>
                    <div className="analysis-color-input">
                      <input type="color" value={corPrimaria} onChange={(e) => setCorPrimaria(e.target.value)} aria-label="Escolher cor primária personalizada" />
                      <input type="text" value={corPrimaria} onChange={(e) => setCorPrimaria(e.target.value)} className="input-base" aria-label="Código hexadecimal da cor primária" />
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="field-label">Cor secundária</legend>
                    <p className="record-meta">Menu e cabeçalhos escuros</p>
                    <div className="analysis-color-swatches">
                      {CORES_SECUNDARIAS_SUGERIDAS.map((cor) => <button key={cor.valor} type="button" onClick={() => setCorSecundaria(cor.valor)}
                        className="analysis-color-swatch analysis-color-swatch-dark" style={{ background: cor.valor }} aria-label={`Cor secundária: ${cor.nome}`} title={cor.nome} aria-pressed={corSecundaria === cor.valor}>
                        {corSecundaria === cor.valor && <Check size={15} aria-hidden="true" />}
                      </button>)}
                    </div>
                    <div className="analysis-color-input">
                      <input type="color" value={corSecundaria} onChange={(e) => setCorSecundaria(e.target.value)} aria-label="Escolher cor secundária personalizada" />
                      <input type="text" value={corSecundaria} onChange={(e) => setCorSecundaria(e.target.value)} className="input-base" aria-label="Código hexadecimal da cor secundária" />
                    </div>
                  </fieldset>
                </div>
              </section>
            </>}
          </form>
        </div>

        <aside className="analysis-brand-preview" aria-label="Prévia da identidade da empresa">
          <p className="analysis-eyebrow">Prévia da sua marca</p>
          <div className="analysis-brand-sheet">
            <div className="analysis-brand-sheet-heading" style={{ background: corSecundaria }}>
              <div className="analysis-preview-logo">{empresa?.logo_url ? <img src={empresa.logo_url} alt="" /> : <span style={{ color: corPrimaria }}>{(nome || "M").charAt(0).toUpperCase()}</span>}</div>
              <strong>{nome || "Sua empresa"}</strong>
              <p>{slogan || "Sua assinatura profissional"}</p>
              <div className="analysis-preview-accent" style={{ background: corPrimaria }} />
            </div>
            <div className="analysis-brand-sheet-contact">
              <p className="analysis-eyebrow">Informações de contato</p>
              <p><Mail size={15} aria-hidden="true" /><span>{emailContato || "E-mail de contato"}</span></p>
              <p><Phone size={15} aria-hidden="true" /><span>{telefoneContato || "Telefone / WhatsApp"}</span></p>
              <p><MapPin size={15} aria-hidden="true" /><span>{enderecoEmpresa || "Endereço da empresa"}</span></p>
              {cnpj && <p className="record-meta">CNPJ / CPF: {cnpj}</p>}
              <div className="analysis-preview-action" style={{ background: corPrimaria, color: corSecundaria }}>Ver orçamento<ArrowUpRight size={16} aria-hidden="true" /></div>
            </div>
          </div>
          <p className="analysis-data-note">Confira a combinação antes de salvar. Os documentos mantêm as informações cadastradas.</p>
        </aside>
      </div>

      <footer className="analysis-settings-savebar">
        <p>{alteracoesPendentes ? "Suas alterações estão prontas para salvar." : "Nome, contatos e cores são aplicados ao salvar."}</p>
        <div className="page-actions">
          <button type="button" onClick={descartarAlteracoes} disabled={salvando || enviandoLogo} className="btn-secondary">Descartar</button>
          <button type="submit" form="empresa-configuracoes" disabled={salvando || enviandoLogo || !empresa} className="btn-primary">
            <Save size={17} aria-hidden="true" />{salvando ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </footer>
      <ConfirmDialog aberto={confirmarRemocao} titulo="Remover a logo?" descricao="A logo será removida do painel e dos próximos documentos. Você poderá enviar outra imagem."
        textoBotaoConfirmar="Remover logo" corBotaoConfirmar="vermelho" carregando={removendoLogo} aoConfirmar={handleRemoverLogo} aoCancelar={() => setConfirmarRemocao(false)} />
    </div>
  );
}
