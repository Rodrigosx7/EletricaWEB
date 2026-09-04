import { useState, type FormEvent } from "react";
import { Lock, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "../supabase";
import {
  AuthShell,
  AuthCard,
  AuthHeader,
  FloatingField,
  PrimaryButton,
} from "../components/ui/auth-shell";

function NovaSenha() {
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [alterada, setAlterada] = useState(false);

  async function alterarSenha(e: FormEvent) {
    e.preventDefault();

    if (senha.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (senha !== confirmarSenha) {
      alert("As senhas não coincidem.");
      return;
    }

    setCarregando(true);

    const { error } = await supabase.auth.updateUser({
      password: senha,
    });

    if (error) {
      console.error("Erro ao alterar senha:", error);
      alert(error.message);
      setCarregando(false);
      return;
    }

    setAlterada(true);
    setCarregando(false);
  }

  if (alterada) {
    return (
      <AuthShell>
        <AuthCard>
          <div className="text-center">
            <div className="inline-flex w-14 h-14 rounded-xl bg-green-500 items-center justify-center mb-3 shadow-lg shadow-green-500/30">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white">
              Senha alterada!
            </h2>
            <p className="mt-2 text-sm text-gray-300">
              Sua senha foi alterada com sucesso. Você já pode acessar o
              sistema.
            </p>
          </div>

          <PrimaryButton
            onClick={() => {
              window.location.href = "/";
            }}
            carregandoTexto=""
            texto="Ir para o sistema"
            icone={
              <ArrowRight className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" />
            }
          />
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard>
        <AuthHeader
          icone={<Lock className="w-7 h-7 text-[#0D1B2A]" />}
          titulo="Crie uma nova senha"
          subtitulo="Defina uma senha forte para sua conta"
        />

        <form className="space-y-7" onSubmit={alterarSenha}>
          <FloatingField
            id="nova_senha"
            label="Nova senha (mínimo 6 caracteres)"
            icone={<Lock size={16} />}
            type="password"
            value={senha}
            onChange={setSenha}
            placeholder="Nova senha"
            required
          />
          <FloatingField
            id="nova_senha_confirmar"
            label="Confirmar nova senha"
            icone={<Lock size={16} />}
            type="password"
            value={confirmarSenha}
            onChange={setConfirmarSenha}
            placeholder="Confirmar nova senha"
            required
          />

          <PrimaryButton
            carregando={carregando}
            carregandoTexto="Alterando..."
            texto="Alterar senha"
            icone={
              <ArrowRight className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" />
            }
          />
        </form>
      </AuthCard>
    </AuthShell>
  );
}

export default NovaSenha;
