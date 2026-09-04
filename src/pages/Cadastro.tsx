import { useState } from "react";
import { supabase } from "../supabase";

type CadastroProps = {
  voltarLogin: () => void;
};

function Cadastro({ voltarLogin }: CadastroProps) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function criarConta(e: React.FormEvent) {
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
        onSubmit={criarConta}
        style={{
          width: "350px",
          padding: "30px",
          background: "white",
          borderRadius: "12px",
        }}
      >
        <h1>RJ ELÉTRICA</h1>

        <p>Criar sua conta</p>

        <label>Nome</label>
        <br />

        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome"
          style={{
            width: "100%",
            padding: "10px",
            marginTop: "5px",
            marginBottom: "15px",
            boxSizing: "border-box",
          }}
        />

        <label>E-mail</label>
        <br />

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
        <br />

        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          style={{
            width: "100%",
            padding: "10px",
            marginTop: "5px",
            marginBottom: "15px",
            boxSizing: "border-box",
          }}
        />

        <label>Confirmar senha</label>
        <br />

        <input
          type="password"
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
          placeholder="Digite a senha novamente"
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
          {carregando ? "Criando conta..." : "Criar conta"}
        </button>

        <br />
        <br />

        <button
          type="button"
          onClick={voltarLogin}
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

export default Cadastro;