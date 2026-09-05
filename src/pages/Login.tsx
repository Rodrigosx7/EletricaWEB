import { useState } from "react";
import { SignInSplit } from "../components/ui/sign-in-split";
import { AuthShellSplit } from "../components/ui/auth-shell";
import AuthHero from "../components/ui/auth-hero";
import RecuperacaoSenha from "./RecuperacaoSenha";
import { supabase } from "../supabase";

type Tela = "login" | "recuperacao";

function Login() {
  const [tela, setTela] = useState<Tela>("login");

  if (tela === "recuperacao") {
    return (
      <RecuperacaoSenha
        voltarLogin={() => setTela("login")}
        onSubmit={async (email) => {
          const { error } = await supabase.auth.resetPasswordForEmail(
            email,
            {
              redirectTo:
                "https://portal-eletrico.netlify.app/#redefinir-senha",
            }
          );
          if (error) {
            alert(error.message);
            return;
          }
          alert(
            "Enviamos um link para redefinir sua senha. Verifique seu e-mail."
          );
          setTela("login");
        }}
      />
    );
  }

  return (
    <AuthShellSplit>
      {/* Lado esquerdo: Hero */}
      <div className="flex items-center justify-center">
        <AuthHero />
      </div>

      {/* Lado direito: Formulário */}
      <SignInSplit aoIrParaRecuperacao={() => setTela("recuperacao")} />
    </AuthShellSplit>
  );
}

export default Login;
