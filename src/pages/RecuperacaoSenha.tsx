import { useState, type FormEvent, type ReactElement } from "react";
import { ArrowRight, Mail, ArrowLeft } from "lucide-react";
import {
  AuthShell,
  AuthCard,
  AuthHeader,
  FloatingField,
  PrimaryButton,
} from "../components/ui/auth-shell";

interface RecuperacaoSenhaProps {
  voltarLogin: () => void;
  onSubmit: (email: string) => Promise<void>;
}

export default function RecuperacaoSenha({
  voltarLogin,
  onSubmit,
}: RecuperacaoSenhaProps): ReactElement {
  const [email, setEmail] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) {
      alert("Digite seu e-mail.");
      return;
    }
    await onSubmit(email);
  }

  return (
    <AuthShell>
      <AuthCard>
        <AuthHeader
          icone={<Mail className="w-7 h-7 text-[#0D1B2A]" />}
          titulo="Recuperar senha"
          subtitulo="Digite seu e-mail para receber o link de recuperação"
        />

        <form className="space-y-7" onSubmit={handleSubmit}>
          <FloatingField
            id="recuperacao_email"
            label="E-mail"
            icone={<Mail size={16} />}
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="E-mail"
            required
          />

          <PrimaryButton
            carregandoTexto=""
            texto="Enviar link"
            icone={
              <ArrowRight className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" />
            }
          />
        </form>

        <button
          type="button"
          onClick={voltarLogin}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-300 hover:text-[#FFD60A] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o login
        </button>
      </AuthCard>
    </AuthShell>
  );
}
