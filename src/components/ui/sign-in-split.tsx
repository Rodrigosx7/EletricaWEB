import { useState, type FormEvent, type ReactElement } from "react";
import { Eye, EyeOff, Mail, Lock, User as IconUser } from "lucide-react";
import { supabase } from "../../supabase";

type SignInSplitProps = { aoIrParaRecuperacao: () => void; aoSucesso?: () => void; };

export function SignInSplit({ aoIrParaRecuperacao }: SignInSplitProps): ReactElement {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lembrarMe, setLembrarMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleCarregando, setGoogleCarregando] = useState(false);

  function toggleMode() {
    setIsSignUp(!isSignUp);
    setEmail(""); setSenha(""); setNome(""); setShowPassword(false);
  }

  async function entrarComGoogle() {
    if (googleCarregando || isSubmitting) return;
    setGoogleCarregando(true);
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, queryParams: { access_type: "offline", prompt: "consent" } } });
      if (error) {
        console.error("Erro no login com Google:", error);
        alert("Não foi possível iniciar o login com Google. Verifique se o provedor está habilitado no Supabase.");
        setGoogleCarregando(false);
      }
    } catch (err) {
      console.error(err); alert("Erro inesperado ao iniciar o login com Google."); setGoogleCarregando(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); setIsSubmitting(true);
    try {
      if (isSignUp) {
        if (!nome.trim()) { alert("Digite seu nome."); setIsSubmitting(false); return; }
        if (senha.length < 6) { alert("A senha deve ter pelo menos 6 caracteres."); setIsSubmitting(false); return; }
        const { error } = await supabase.auth.signUp({ email: email.trim(), password: senha, options: { data: { nome: nome.trim() } } });
        if (error) { alert(error.message); setIsSubmitting(false); return; }
        alert("Conta criada com sucesso! Verifique seu e-mail para confirmar a conta."); setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) { alert("E-mail ou senha incorretos."); setIsSubmitting(false); return; }
      }
    } catch (err) {
      console.error(err); alert("Erro inesperado. Tente novamente.");
    } finally { setIsSubmitting(false); }
  }

  return (
    <section className="auth-form-side">
      <div className="auth-form">
        <div className="auth-mobile-brand" aria-label="Portal Elétrico"><img className="auth-brand-logo" src="/logo.png" alt="" width="30" height="30" />Portal Elétrico</div>
        <header className="auth-form-heading">
          <span className="auth-kicker">ÁREA DO CLIENTE</span>
          <h1>{isSignUp ? "Crie sua área de trabalho" : "Acesse sua operação"}</h1>
          <p>{isSignUp ? "Cadastre seus dados para começar." : "Entre para continuar de onde parou."}</p>
        </header>

        <form onSubmit={handleSubmit}>
          {isSignUp && <AuthInput id="auth-name" label="Nome completo" icon={<IconUser />} type="text" value={nome} onChange={setNome} placeholder="Seu nome" autoComplete="name" />}
          <AuthInput id="auth-email" label="E-mail" icon={<Mail />} type="email" value={email} onChange={setEmail} placeholder="voce@empresa.com.br" autoComplete="email" />
          <div className="auth-field">
            <label htmlFor="auth-password">Senha</label>
            <div className="auth-input-wrap">
              <Lock aria-hidden="true" />
              <input id="auth-password" type={showPassword ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Digite sua senha" autoComplete={isSignUp ? "new-password" : "current-password"} required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="auth-password-toggle" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff /> : <Eye />}</button>
            </div>
          </div>

          <div className="auth-form-options">
            <label className="auth-checkbox"><input type="checkbox" checked={lembrarMe} onChange={(e) => setLembrarMe(e.target.checked)} /><span>Lembrar de mim</span></label>
            {!isSignUp && <button type="button" onClick={aoIrParaRecuperacao} className="auth-text-action">Esqueci minha senha</button>}
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary auth-submit">{isSubmitting ? <><span className="auth-spinner" aria-hidden="true" /> Aguarde...</> : isSignUp ? "Criar conta" : "Entrar"}</button>
        </form>

        <div className="auth-divider"><span>ou continue com</span></div>
        <button type="button" onClick={entrarComGoogle} disabled={googleCarregando || isSubmitting} className="btn-secondary auth-google">{googleCarregando ? <span className="auth-spinner auth-spinner-dark" aria-hidden="true" /> : <GoogleIcon />}{googleCarregando ? "Redirecionando..." : "Google"}</button>
        <p className="auth-mode-switch">{isSignUp ? "Já tem uma conta?" : "Ainda não tem uma conta?"} <button type="button" onClick={toggleMode}>{isSignUp ? "Entrar" : "Criar conta"}</button></p>
      </div>
    </section>
  );
}

type AuthInputProps = { id: string; label: string; icon: ReactElement; type: "text" | "email"; value: string; onChange: (value: string) => void; placeholder: string; autoComplete: string; };

function AuthInput({ id, label, icon, type, value, onChange, placeholder, autoComplete }: AuthInputProps): ReactElement {
  return <div className="auth-field"><label htmlFor={id}>{label}</label><div className="auth-input-wrap"><span aria-hidden="true">{icon}</span><input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} required /></div></div>;
}

function GoogleIcon(): ReactElement {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3A12 12 0 1 1 32 15.5l5.8-5.8A20.9 20.9 0 1 0 45.5 24c0-1.5-.1-2.7-.4-3.9z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 32 15.5l5.8-5.8A21.4 21.4 0 0 0 6.3 14.7z" /><path fill="#4CAF50" d="M24 45.5c5.5 0 10.3-2.1 14.1-5.7l-6.3-5.3A12 12 0 0 1 12.9 31l-6.5 5A21.5 21.5 0 0 0 24 45.5z" /><path fill="#1976D2" d="M45.5 24c0-1.3-.1-2.6-.4-3.9H24v8h11.3a12 12 0 0 1-3.5 6.4l6.3 5.3c4.5-4.2 7.4-9.7 7.4-15.8z" /></svg>;
}
