import { useState } from "react";
import { SignInFlo } from "../components/ui/sign-in-flo";
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
    <SignInFlo
      aoIrParaRecuperacao={() => setTela("recuperacao")}
      // Sucesso é detectado pelo App.tsx via onAuthStateChange — sem prop necessária
    />
  );
}

export default Login;
