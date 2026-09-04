import { useState, type FormEvent } from "react";
import { User, Mail, Lock, ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "../supabase";
import {
  AuthShell,
  AuthCard,
  AuthHeader,
  FloatingField,
  PrimaryButton,
} from "../components/ui/auth-shell";

type CadastroProps = {
  voltarLogin: () => void;
};

function Cadastro({ voltarLogin }: CadastroProps) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function criarConta(e: FormEvent) {
    e.preventDefault();

    if (!nome.trim()) {
      alert("Digite seu nome.");
      return;
    }

    if (!email.trim()) {
      alert("Digite seu e-mail.");
      return;
    }

    if (senha.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (senha !== confirmarSenha) {
      alert("As senhas não coincidem.");
      return;
    }

    setCarregando(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        data: {
          nome: nome.trim(),
        },
      },
    });

    if (error) {
      console.error("Erro ao criar conta:", error);
      alert(error.message);
      setCarregando(false);
      return;
    }

    alert(
      "Conta criada com sucesso! Verifique seu e-mail para confirmar a conta."
    );

    setNome("");
    setEmail("");
    setSenha("");
    setConfirmarSenha("");

    voltarLogin();

    setCarregando(false);
  }

  return (
    <AuthShell>
      <AuthCard>
        <AuthHeader
          icone={<User className="w-7 h-7 text-[#0D1B2A]" />}
          titulo="Criar sua conta"
          subtitulo="Comece a gerenciar seus serviços elétricos"
        />

        <form className="space-y-7" onSubmit={criarConta}>
          <FloatingField
            id="cadastro_nome"
            label="Nome completo"
            icone={<User size={16} />}
            value={nome}
            onChange={setNome}
            placeholder="Nome"
            required
          />
          <FloatingField
            id="cadastro_email"
            label="E-mail"
            icone={<Mail size={16} />}
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="E-mail"
            required
          />
          <FloatingField
            id="cadastro_senha"
            label="Senha (mínimo 6 caracteres)"
            icone={<Lock size={16} />}
            type="password"
            value={senha}
            onChange={setSenha}
            placeholder="Senha"
            required
          />
          <FloatingField
            id="cadastro_confirmar"
            label="Confirmar senha"
            icone={<Lock size={16} />}
            type="password"
            value={confirmarSenha}
            onChange={setConfirmarSenha}
            placeholder="Confirmar senha"
            required
          />

          <PrimaryButton
            carregando={carregando}
            carregandoTexto="Criando conta..."
            texto="Criar conta"
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

export default Cadastro;
