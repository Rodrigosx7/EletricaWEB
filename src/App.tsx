import NovaSenha from "./pages/NovaSenha";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import Login from "./pages/Login";

type Cliente = {
  id: number;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  email: string | null;
  user_id: string;
  created_at?: string;
};

function App() {
  const [usuario, setUsuario] = useState<any>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [carregando, setCarregando] = useState(false);

  // Verificar usuário logado
  useEffect(() => {
    async function verificarUsuario() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUsuario(user);
    }

    verificarUsuario();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Carregar somente os clientes do usuário logado
  async function carregarClientes() {
    if (!usuario) return;

    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("user_id", usuario.id)
      .order("id", { ascending: false });

    if (error) {
      console.error("Erro ao carregar clientes:", error);
      return;
    }

    setClientes(data || []);
  }

  // Carregar clientes quando o usuário estiver logado
  useEffect(() => {
  if (usuario) {
    carregarClientes();
  }
}, [usuario]);

  // Cadastrar cliente
  async function cadastrarCliente(e: React.FormEvent) {
    e.preventDefault();

    if (!nome.trim()) {
      alert("Digite o nome do cliente.");
      return;
    }

    if (!usuario) {
      alert("Usuário não identificado.");
      return;
    }

    setCarregando(true);

    const novoCliente = {
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      endereco: endereco.trim() || null,
      user_id: usuario.id,
    };

    const { error } = await supabase
      .from("clientes")
      .insert(novoCliente);

    if (error) {
      console.error("Erro ao cadastrar:", error);
      alert("Erro ao cadastrar cliente.");
      setCarregando(false);
      return;
    }

    setNome("");
    setTelefone("");
    setEmail("");
    setEndereco("");

    await carregarClientes();

    setCarregando(false);
  }

  // Excluir cliente
  async function excluirCliente(id: number) {
    const confirmar = confirm("Deseja realmente excluir este cliente?");

    if (!confirmar) return;

    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("id", id)
      .eq("user_id", usuario.id);

    if (error) {
      console.error("Erro ao excluir:", error);
      alert("Erro ao excluir cliente.");
      return;
    }

    setClientes((clientesAtuais) =>
      clientesAtuais.filter((cliente) => cliente.id !== id)
    );
  }

  // Logout
  async function sair() {
    await supabase.auth.signOut();
    setClientes([]);
  }

  // Se não estiver logado, mostrar Login
  const recuperandoSenha =
  window.location.hash.includes("type=recovery") ||
  window.location.hash.includes("redefinir-senha");

if (recuperandoSenha) {
  return <NovaSenha />;
}

if (!usuario) {
  return <Login />;
}

  // Sistema
  return (
    <div
      style={{
        maxWidth: "1000px",
        margin: "40px auto",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1>Sistema Financeiro</h1>
          <p>Usuário: {usuario.email}</p>
        </div>

        <button onClick={sair}>Sair</button>
      </div>

      <hr />

      <h2>Clientes</h2>

      <form onSubmit={cadastrarCliente}>
        <div>
          <label>Nome *</label>
          <br />

          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do cliente"
          />
        </div>

        <br />

        <div>
          <label>Telefone</label>
          <br />

          <input
            type="text"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(00) 00000-0000"
          />
        </div>

        <br />

        <div>
          <label>E-mail</label>
          <br />

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@email.com"
          />
        </div>

        <br />

        <div>
          <label>Endereço</label>
          <br />

          <input
            type="text"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Endereço do cliente"
          />
        </div>

        <br />

        <button type="submit" disabled={carregando}>
          {carregando ? "Cadastrando..." : "Cadastrar cliente"}
        </button>
      </form>

      <hr />

      <h2>Clientes cadastrados</h2>

      {clientes.length === 0 ? (
        <p>Nenhum cliente cadastrado.</p>
      ) : (
        <div>
          {clientes.map((cliente) => (
            <div key={cliente.id}>
              <h3>{cliente.nome}</h3>

              <p>
                <strong>Telefone:</strong>{" "}
                {cliente.telefone || "Não informado"}
              </p>

              <p>
                <strong>E-mail:</strong>{" "}
                {cliente.email || "Não informado"}
              </p>

              <p>
                <strong>Endereço:</strong>{" "}
                {cliente.endereco || "Não informado"}
              </p>

              <button onClick={() => excluirCliente(cliente.id)}>
                Excluir
              </button>

              <hr />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;