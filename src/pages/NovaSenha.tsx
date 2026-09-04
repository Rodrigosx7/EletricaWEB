import { useState } from "react";
import { supabase } from "../supabase";

function NovaSenha() {
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [alterada, setAlterada] = useState(false);

  async function alterarSenha(e: React.FormEvent) {
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
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#0D1B2A",
        }}
      >
        <div
          style={{
            width: "350px",
            padding: "30px",
            background: "white",
            borderRadius: "12px",
            textAlign: "center",
          }}
        >
          <h1>RJ ELÉTRICA</h1>

          <h2>Senha alterada!</h2>

          <p>
            Sua senha foi alterada com sucesso.
          </p>

          <button
            onClick={() => {
              window.location.href = "/";
            }}
            style={{
              width: "100%",
              padding: "12px",
              cursor: "pointer",
            }}
          >
            Ir para o sistema
          </button>
        </div>
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
        onSubmit={alterarSenha}
        style={{
          width: "350px",
          padding: "30px",
          background: "white",
          borderRadius: "12px",
        }}
      >
        <h1>RJ ELÉTRICA</h1>

        <p>Crie uma nova senha</p>

        <label>Nova senha</label>

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

        <label>Confirmar nova senha</label>

        <input
          type="password"
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
          placeholder="Digite novamente"
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
          {carregando ? "Alterando..." : "Alterar senha"}
        </button>
      </form>
    </div>
  );
}

export default NovaSenha;