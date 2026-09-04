import NovaSenha from "./pages/NovaSenha";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import Login from "./pages/Login";
import Dashboard from "./components/Dashboard";
import Sidebar from "./components/Sidebar";
import Clientes from "./components/Clientes";
import Servicos from "./components/Servicos";
import Produtos from "./components/Produtos";
import Orcamentos from "./components/Orcamentos";

function App() {
  const [usuario, setUsuario] = useState<any>(null);
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

  // Logout
  async function sair() {
    await supabase.auth.signOut();
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

       {pagina === "orcamentos" && <Orcamentos />}

        {/* Serviços */}
        {pagina === "servicos" && <Servicos />}

        {/* Produtos */}
        {pagina === "produtos" && <Produtos />}

        {/* Financeiro */}
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

        {/* Relatórios */}
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

        {/* Configurações */}
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