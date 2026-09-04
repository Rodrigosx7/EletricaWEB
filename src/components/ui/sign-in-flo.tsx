import {
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Zap,
} from "lucide-react";
import { supabase } from "../../supabase";

/**
 * Paleta do projeto — usada para mapear tokens shadcn-like para cores explícitas.
 * border-border / bg-card / text-foreground / text-muted-foreground / bg-background
 * viram classes Tailwind com hex fixos abaixo.
 */
const COR_FUNDO_PRINCIPAL = "#0D1B2A";
const COR_CARD = "rgba(13, 27, 42, 0.55)";
const COR_BORDA = "rgba(255, 255, 255, 0.15)";
const COR_TEXTO = "#FFFFFF";
const COR_TEXTO_SECUNDARIO = "#94A3B8";

interface FormFieldProps {
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  icon: ReactNode;
  showToggle?: boolean;
  onToggle?: () => void;
  showPassword?: boolean;
}

function AnimatedFormField({
  type,
  placeholder,
  value,
  onChange,
  icon,
  showToggle,
  onToggle,
  showPassword,
}: FormFieldProps): ReactElement {
  const [isFocused, setIsFocused] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div className="relative group">
      <div
        className="relative overflow-hidden rounded-lg border border-white/15 bg-white/5 transition-all duration-300 ease-in-out focus-within:border-[#FFD60A]/70 focus-within:bg-white/10"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors duration-200 group-focus-within:text-[#FFD60A] pointer-events-none z-10">
          {icon}
        </div>

        <input
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`peer w-full bg-transparent pl-10 ${
            showToggle ? "pr-10" : "pr-4"
          } pt-5 pb-1 text-white placeholder:text-transparent focus:outline-none relative z-0`}
          placeholder=" "
          autoComplete="off"
        />

        <label
          className={`absolute left-10 transition-all duration-200 ease-in-out pointer-events-none z-0 ${
            isFocused || value
              ? "top-1.5 text-xs text-[#FFD60A] font-medium"
              : "top-1/2 -translate-y-1/2 text-sm text-gray-400"
          }`}
        >
          {placeholder}
        </label>

        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}

        {isHovering && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(200px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255, 214, 10, 0.10) 0%, transparent 70%)`,
            }}
          />
        )}
      </div>
    </div>
  );
}

interface SignInFloProps {
  aoSucesso?: () => void;
  aoIrParaRecuperacao?: () => void;
}

/**
 * Tela única de Login/Cadastro com partículas + glassmorphism.
 * Substitui tanto Login.tsx quanto Cadastro.tsx (toggle interno).
 */
export function SignInFlo({
  aoSucesso,
  aoIrParaRecuperacao,
}: SignInFloProps): ReactElement {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleCarregando, setGoogleCarregando] = useState(false);
  const [lembrarMe, setLembrarMe] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        if (!nome.trim()) {
          alert("Digite seu nome.");
          return;
        }
        if (senha.length < 6) {
          alert("A senha deve ter pelo menos 6 caracteres.");
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { data: { nome: nome.trim() } },
        });

        if (error) {
          alert(error.message);
          return;
        }

        alert(
          "Conta criada com sucesso! Verifique seu e-mail para confirmar a conta."
        );
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        });

        if (error) {
          alert("E-mail ou senha incorretos.");
          return;
        }

        aoSucesso?.();
      }
    } catch (err) {
      console.error(err);
      alert("Erro inesperado. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleMode() {
    setIsSignUp(!isSignUp);
    setEmail("");
    setSenha("");
    setNome("");
    setShowPassword(false);
  }

  async function entrarComGoogle() {
    if (googleCarregando || isSubmitting) return;
    setGoogleCarregando(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}${window.location.pathname}`
          : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        console.error("Erro no login com Google:", error);
        alert(
          "Não foi possível iniciar o login com Google. Verifique se o provedor está habilitado no Supabase."
        );
        setGoogleCarregando(false);
      }
      // Se der certo, o navegador redireciona — não precisamos resetar o estado.
    } catch (err) {
      console.error(err);
      alert("Erro inesperado ao iniciar o login com Google.");
      setGoogleCarregando(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: COR_FUNDO_PRINCIPAL }}
    >
      {/* Halo amarelo suave no topo (decorativo, não atrapalha a leitura) */}
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-3xl pointer-events-none"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255, 214, 10, 0.10), transparent 70%)",
        }}
      />

      {/* Card glassmorphism */}
      <div
        className="relative w-full max-w-md backdrop-blur-xl border rounded-2xl p-8 shadow-2xl"
        style={{
          zIndex: 10,
          background: COR_CARD,
          borderColor: COR_BORDA,
          color: COR_TEXTO,
        }}
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FFD60A]/15 rounded-full mb-4 shadow-lg shadow-yellow-500/20">
            <Zap className="w-8 h-8 text-[#FFD60A]" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {isSignUp ? "Criar conta" : "Bem-vindo de volta"}
          </h1>
          <p style={{ color: COR_TEXTO_SECUNDARIO }}>
            {isSignUp
              ? "Cadastre-se para começar"
              : "Entre para acessar o painel"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {isSignUp && (
            <AnimatedFormField
              type="text"
              placeholder="Nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              icon={<User size={18} />}
            />
          )}

          <AnimatedFormField
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail size={18} />}
          />

          <AnimatedFormField
            type={showPassword ? "text" : "password"}
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            icon={<Lock size={18} />}
            showToggle
            onToggle={() => setShowPassword(!showPassword)}
            showPassword={showPassword}
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={lembrarMe}
                onChange={(e) => setLembrarMe(e.target.checked)}
                className="w-4 h-4 text-[#FFD60A] bg-transparent border-white/30 rounded focus:ring-[#FFD60A] focus:ring-2"
              />
              <span
                className="text-sm"
                style={{ color: COR_TEXTO_SECUNDARIO }}
              >
                Lembrar-me
              </span>
            </label>

            {!isSignUp && (
              <button
                type="button"
                onClick={aoIrParaRecuperacao}
                className="text-sm text-[#FFD60A] hover:underline"
              >
                Esqueci minha senha
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full relative group bg-[#FFD60A] hover:bg-[#FFE552] text-[#0D1B2A] py-3 px-4 rounded-lg font-bold transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#FFD60A] focus:ring-offset-2 focus:ring-offset-[#0D1B2A] disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden shadow-lg shadow-yellow-500/20"
          >
            <span
              className={`transition-opacity duration-200 ${
                isSubmitting ? "opacity-0" : "opacity-100"
              }`}
            >
              {isSignUp ? "Criar conta" : "Entrar"}
            </span>

            {isSubmitting && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-[#0D1B2A]/30 border-t-[#0D1B2A] rounded-full animate-spin" />
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
          </button>
        </form>

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span
                className="px-2"
                style={{
                  background: "rgba(13, 27, 42, 0.6)",
                  color: COR_TEXTO_SECUNDARIO,
                }}
              >
                Ou continue com
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={entrarComGoogle}
            disabled={googleCarregando || isSubmitting}
            className="mt-6 w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#FFD60A] focus:ring-offset-2 focus:ring-offset-[#0D1B2A] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {googleCarregando ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
                <path
                  fill="#FFC107"
                  d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 8.841C34.553 4.806 29.613 2.5 24 2.5C11.983 2.5 2.5 11.983 2.5 24s9.483 21.5 21.5 21.5S45.5 36.017 45.5 24c0-1.538-.135-3.022-.389-4.417z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12.5 24 12.5c3.059 0 5.842 1.154 7.961 3.039l5.839-5.841C34.553 4.806 29.613 2.5 24 2.5C16.318 2.5 9.642 6.723 6.306 14.691z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 45.5c5.613 0 10.553-2.306 14.802-6.341l-5.839-5.841C30.842 35.846 27.059 38 24 38c-5.039 0-9.345-2.608-11.124-6.481l-6.571 4.819C9.642 41.277 16.318 45.5 24 45.5z"
                />
                <path
                  fill="#1976D2"
                  d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.839 5.841C44.196 35.123 45.5 29.837 45.5 24c0-1.538-.135-3.022-.389-4.417z"
                />
              </svg>
            )}
            <span className="text-white font-semibold">
              {googleCarregando
                ? "Redirecionando..."
                : "Continuar com Google"}
            </span>
          </button>
        </div>

        <div className="mt-8 text-center">
          <p
            className="text-sm"
            style={{ color: COR_TEXTO_SECUNDARIO }}
          >
            {isSignUp ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
            <button
              type="button"
              onClick={toggleMode}
              className="text-[#FFD60A] hover:underline font-bold"
            >
              {isSignUp ? "Entrar" : "Cadastre-se"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
