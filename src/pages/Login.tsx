import { useState } from "react";
import { supabase } from "../supabase";
import Cadastro from "./Cadastro";

function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mostrarCadastro, setMostrarCadastro] = useState(false);
  const [mostrarRecuperacao, setMostrarRecuperacao] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();

    if (!email || !senha) {
      alert("Preencha o e-mail e a senha.");
      return;
    }

    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      console.error("Erro no login:", error);
      alert("E-mail ou senha incorretos.");
      setCarregando(false);
      return;
    }

    setCarregando(false);
  }

  async function recuperarSenha(e: React.FormEvent) {
    e.preventDefault();

    if (!email) {
      alert("Digite seu e-mail.");
      return;
    }

    setCarregando(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: "https://portal-eletrico.netlify.app/#redefinir-senha",
    });

    if (error) {
      console.error("Erro ao recuperar senha:", error);
      alert(error.message);
      setCarregando(false);
      return;
    }

    alert("Enviamos um link para redefinir sua senha. Verifique seu e-mail.");

    setCarregando(false);
  }

  // Tela de cadastro
  if (mostrarCadastro) {
    return (
      <Cadastro
        voltarLogin={() => setMostrarCadastro(false)}
      />
    );
  }

  // Tela de recuperação de senha
  if (mostrarRecuperacao) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#0D1B2A",
        }}
      >
        <form
          onSubmit={recuperarSenha}
          style={{
            width: "350px",
            padding: "30px",
            background: "white",
            borderRadius: "12px",
          }}
        >
          <h1>RJ ELÉTRICA</h1>

          <p>Recuperar senha</p>

          <p>
            Digite seu e-mail para receber o link de recuperação.
          </p>

          <label>E-mail</label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            style={{
              width: "100%",
              padding: "10px",
              marginTop: "5px",
              marginBottom: "20px",
              boxSizing: "border-box",
            }}
          />

          <button
            type="submit"
            disabled={carregando}
            style={{
              width: "100%",
              padding: "12px",
              cursor: "pointer",
            }}
          >
            {carregando ? "Enviando..." : "Enviar link"}
          </button>

          <br />
          <br />

          <button
            type="button"
            onClick={() => setMostrarRecuperacao(false)}
            style={{
              width: "100%",
              padding: "10px",
              cursor: "pointer",
            }}
          >
            Voltar para o login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#0D1B2A",
      }}
    >
      <form
        onSubmit={entrar}
        style={{
          width: "350px",
          padding: "30px",
          background: "white",
          borderRadius: "12px",
        }}
      >
        <h1>RJ ELÉTRICA</h1>

        <p>Entre na sua conta</p>

        <label>E-mail</label>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          style={{
            width: "100%",
            padding: "10px",
            marginTop: "5px",
            marginBottom: "15px",
            boxSizing: "border-box",
          }}
        />

        <label>Senha</label>

        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Sua senha"
          style={{
            width: "100%",
            padding: "10px",
            marginTop: "5px",
            marginBottom: "10px",
            boxSizing: "border-box",
          }}
        />

        <button
          type="button"
          onClick={() => setMostrarRecuperacao(true)}
          style={{
            border: "none",
            background: "none",
            padding: "0",
            marginBottom: "20px",
            cursor: "pointer",
          }}
        >
          Esqueci minha senha
        </button>

        <button
          type="submit"
          disabled={carregando}
          style={{
            width: "100%",
            padding: "12px",
            cursor: "pointer",
          }}
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>

        <p
          style={{
            textAlign: "center",
            marginTop: "20px",
            marginBottom: "10px",
          }}
        >
          Ainda não possui uma conta?
        </p>

        <button
          type="button"
          onClick={() => setMostrarCadastro(true)}
          style={{
            width: "100%",
            padding: "10px",
            cursor: "pointer",
          }}
        >
          Criar conta
        </button>
      </form>
    </div>
  );
}

export default Login;