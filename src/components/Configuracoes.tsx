import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  Building2,
  Palette,
  Image as ImageIcon,
  Upload,
  Trash2,
  Save,
  CheckCircle2,
  X,
  Mail,
  Phone,
  MapPin,
  FileText,
} from "lucide-react";
import { useEmpresa } from "../contexts/EmpresaContext";
import { useToast } from "../components/ui/toast";

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

    if (!confirm("Remover a logo da empresa?")) return;

    try {
      await removerLogo();
      mostrarToast("Logo removida.", "sucesso");
    } catch (error) {
      console.error(error);
      mostrarToast("Erro ao remover logo.", "erro");
    }
  }

  if (carregando && !empresa) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900">
          Configurações
        </h1>
        <p className="text-gray-500 mt-1">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Configurações
        </h1>
        <p className="text-gray-500 mt-1">
          Personalize a identidade da sua empresa e a aparência do painel
        </p>
      </div>

      <div className="space-y-6">
        {/* Identidade da empresa */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center">
              <Building2
                className="w-5 h-5"
                style={{ color: "var(--color-primary)" }}
              />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Identidade da empresa
              </h2>
              <p className="text-sm text-gray-500">
                Nome e slogan que aparecem no sistema
              </p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div>
              <label
                htmlFor="empresa_nome"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Nome da empresa{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                id="empresa_nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: RJ Elétrica, Silva Instalações..."
                className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:border-transparent transition"
                style={
                  {
                    "--tw-ring-color": "var(--color-primary)",
                  } as React.CSSProperties
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Aparece na sidebar e no topo de orçamentos/relatórios
              </p>
            </div>

            <div>
              <label
                htmlFor="empresa_slogan"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Slogan
              </label>
              <input
                id="empresa_slogan"
                type="text"
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                placeholder="Ex: Serviços elétricos com qualidade"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:border-transparent transition"
                style={
                  {
                    "--tw-ring-color": "var(--color-primary)",
                  } as React.CSSProperties
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Aparece embaixo do nome na sidebar
              </p>
            </div>
          </div>
        </section>

        {/* Contato e endereço */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Phone
                className="w-5 h-5 text-blue-600"
              />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Contato e endereço
              </h2>
              <p className="text-sm text-gray-500">
                Informações que aparecem nos PDFs e para clientes
              </p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="empresa_email"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  <Mail className="w-4 h-4 inline mr-1" />
                  E-mail
                </label>
                <input
                  id="empresa_email"
                  type="email"
                  value={emailContato}
                  onChange={(e) => setEmailContato(e.target.value)}
                  placeholder="contato@minhaempresa.com.br"
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:border-transparent transition"
                  style={
                    {
                      "--tw-ring-color": "var(--color-primary)",
                    } as React.CSSProperties
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="empresa_telefone"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  <Phone className="w-4 h-4 inline mr-1" />
                  Telefone / WhatsApp
                </label>
                <input
                  id="empresa_telefone"
                  type="text"
                  value={telefoneContato}
                  onChange={(e) => setTelefoneContato(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:border-transparent transition"
                  style={
                    {
                      "--tw-ring-color": "var(--color-primary)",
                    } as React.CSSProperties
                  }
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="empresa_cnpj"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                <FileText className="w-4 h-4 inline mr-1" />
                CNPJ / CPF
              </label>
              <input
                id="empresa_cnpj"
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:border-transparent transition"
                style={
                  {
                    "--tw-ring-color": "var(--color-primary)",
                  } as React.CSSProperties
                  }
              />
            </div>

            <div>
              <label
                htmlFor="empresa_endereco"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                <MapPin className="w-4 h-4 inline mr-1" />
                Endereço
              </label>
              <input
                id="empresa_endereco"
                type="text"
                value={enderecoEmpresa}
                onChange={(e) => setEnderecoEmpresa(e.target.value)}
                placeholder="Rua, número, bairro, cidade"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:border-transparent transition"
                style={
                  {
                    "--tw-ring-color": "var(--color-primary)",
                  } as React.CSSProperties
                }
              />
            </div>
          </div>
        </section>

        {/* Logo */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center">
              <ImageIcon
                className="w-5 h-5"
                style={{ color: "var(--color-primary)" }}
              />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Logomarca
              </h2>
              <p className="text-sm text-gray-500">
                Aparece no card da sidebar e no topo dos orçamentos
              </p>
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Preview */}
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-md shrink-0 overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, var(--color-primary), ${corPrimaria}cc)`,
                  color: "var(--color-secondary)",
                }}
              >
                {empresa?.logo_url ? (
                  <img
                    src={empresa.logo_url}
                    alt="Logo"
                    className="w-full h-full object-contain bg-white"
                  />
                ) : (
                  (nome || "M").charAt(0).toUpperCase()
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 mb-3">
                  <strong>Formatos:</strong> PNG, JPG, SVG ou WEBP.
                  <br />
                  <strong>Tamanho máximo:</strong> 5MB. Recomendado
                  quadrado (ex: 256x256).
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                  onChange={handleSelecionarArquivo}
                  className="hidden"
                  aria-label="Selecionar arquivo de logo"
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={enviandoLogo}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-semibold transition disabled:opacity-60 shadow-sm"
                    style={{ background: "var(--color-secondary)" }}
                  >
                    {enviandoLogo ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        {empresa?.logo_url
                          ? "Trocar logo"
                          : "Enviar logo"}
                      </>
                    )}
                  </button>

                  {empresa?.logo_url && (
                    <button
                      type="button"
                      onClick={handleRemoverLogo}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cores */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center">
              <Palette
                className="w-5 h-5"
                style={{ color: "var(--color-primary)" }}
              />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Cores do painel
              </h2>
              <p className="text-sm text-gray-500">
                Personalize as cores primária e secundária
              </p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Cor primária (botões, destaques)
              </label>

              <div className="flex flex-wrap gap-2 mb-3">
                {CORES_PRIMARIAS_SUGERIDAS.map((cor) => (
                  <button
                    key={cor.valor}
                    type="button"
                    onClick={() => setCorPrimaria(cor.valor)}
                    title={cor.nome}
                    className={`w-9 h-9 rounded-lg transition-all ${
                      corPrimaria === cor.valor
                        ? "ring-2 ring-offset-2 scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{
                      background: cor.valor,
                      boxShadow:
                        corPrimaria === cor.valor
                          ? `0 0 0 2px white, 0 0 0 4px ${cor.valor}`
                          : undefined,
                    }}
                    aria-label={cor.nome}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  className="h-10 w-16 rounded-lg border border-gray-200 cursor-pointer"
                  aria-label="Escolher cor primária personalizada"
                />
                <input
                  type="text"
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 font-mono text-sm"
                  aria-label="Código hexadecimal da cor primária"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Cor secundária (sidebar, cabeçalho escuro)
              </label>

              <div className="flex flex-wrap gap-2 mb-3">
                {CORES_SECUNDARIAS_SUGERIDAS.map((cor) => (
                  <button
                    key={cor.valor}
                    type="button"
                    onClick={() => setCorSecundaria(cor.valor)}
                    title={cor.nome}
                    className={`w-9 h-9 rounded-lg transition-all ${
                      corSecundaria === cor.valor
                        ? "ring-2 ring-offset-2 scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{
                      background: cor.valor,
                      boxShadow:
                        corSecundaria === cor.valor
                          ? `0 0 0 2px white, 0 0 0 4px ${cor.valor}`
                          : undefined,
                    }}
                    aria-label={cor.nome}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={corSecundaria}
                  onChange={(e) => setCorSecundaria(e.target.value)}
                  className="h-10 w-16 rounded-lg border border-gray-200 cursor-pointer"
                  aria-label="Escolher cor secundária personalizada"
                />
                <input
                  type="text"
                  value={corSecundaria}
                  onChange={(e) => setCorSecundaria(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 font-mono text-sm"
                  aria-label="Código hexadecimal da cor secundária"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">
                Preview
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="px-5 py-2.5 rounded-lg text-sm font-bold transition shadow-md"
                  style={{
                    background: corPrimaria,
                    color: corSecundaria,
                  }}
                >
                  Botão primário
                </button>
                <div
                  className="px-5 py-2.5 rounded-lg text-sm font-bold shadow-md"
                  style={{
                    background: corSecundaria,
                    color: corPrimaria,
                  }}
                >
                  Botão secundário
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Rodapé fixo com botão salvar */}
        <div className="sticky bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 bg-white border-t border-gray-200 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-500 hidden sm:block">
            As alterações de cor são aplicadas imediatamente. Nome e
            slogan são salvos ao clicar.
          </p>
          <div className="flex gap-3 ml-auto">
            <button
              type="button"
              onClick={() => {
                if (empresa) {
                  setNome(empresa.nome);
                  setSlogan(empresa.slogan || "");
                  setEmailContato(empresa.email_contato || "");
                  setTelefoneContato(empresa.telefone_contato || "");
                  setCnpj(empresa.cnpj || "");
                  setEnderecoEmpresa(empresa.endereco || "");
                  setCorPrimaria(empresa.cor_primaria || "#FFD60A");
                  setCorSecundaria(
                    empresa.cor_secundaria || "#0D1B2A"
                  );
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition"
            >
              <X className="w-4 h-4" />
              Descartar
            </button>
            <button
              type="button"
              onClick={salvarAlteracoes}
              disabled={salvando}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[#0D1B2A] font-bold transition disabled:opacity-60 shadow-md"
              style={{ background: "var(--color-primary)" }}
            >
              {salvando ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#0D1B2A]/30 border-t-[#0D1B2A] rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar alterações
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mensagem de feedback positivo após salvar */}
      <div className="hidden">
        <CheckCircle2 />
      </div>
    </div>
  );
}
