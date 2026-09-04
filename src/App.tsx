import NovaSenha from "./pages/NovaSenha";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import Login from "./pages/Login";
import Dashboard from "./components/Dashboard";
import Sidebar from "./components/Sidebar";
import Clientes from "./components/Clientes";
import Servicos from "./components/Servicos";
import Produtos from "./components/Produtos";

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
  const [pagina, setPagina] = useState("dashboard");

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

  // Recuperação de senha
  const recuperandoSenha =
    window.location.hash.includes("type=recovery") ||
    window.location.hash.includes("redefinir-senha");

  if (recuperandoSenha) {
    return <NovaSenha />;
  }

  // Se não estiver logado, mostrar Login
  if (!usuario) {
    return <Login />;
  }

  // Sistema
  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar
        pagina={pagina}
        setPagina={setPagina}
        sair={sair}
      />

      <main className="ml-64 min-h-screen">

        {/* Dashboard */}
        {pagina === "dashboard" && <Dashboard />}

        {/* Clientes */}
        {pagina === "clientes" && <Clientes />}

        {/* Outras páginas - temporariamente */}
        {pagina === "orcamentos" && (
          <div className="p-8">
            <h1 className="text-3xl font-bold">
              Orçamentos
            </h1>

            <p className="text-gray-500 mt-2">
              Módulo em construção.
            </p>
          </div>
        )}
        
        {pagina === "servicos" && <Servicos />}

        {pagina === "produtos" && <Produtos />}

        {pagina === "financeiro" && (
          <div className="p-8">
            <h1 className="text-3xl font-bold">
              Financeiro
            </h1>

            <p className="text-gray-500 mt-2">
              Módulo em construção.
            </p>
          </div>
        )}

        {pagina === "relatorios" && (
          <div className="p-8">
            <h1 className="text-3xl font-bold">
              Relatórios
            </h1>

            <p className="text-gray-500 mt-2">
              Módulo em construção.
            </p>
          </div>
        )}

        {pagina === "configuracoes" && (
          <div className="p-8">
            <h1 className="text-3xl font-bold">
              Configurações
            </h1>

            <p className="text-gray-500 mt-2">
              Módulo em construção.
            </p>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;