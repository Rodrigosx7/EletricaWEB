import NovaSenha from "./pages/NovaSenha";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import Login from "./pages/Login";
import Dashboard from "./components/Dashboard";
import Sidebar from "./components/Sidebar";
import Clientes from "./components/Clientes";
import Servicos from "./components/Servicos";
import Produtos from "./components/Produtos";
import Orcamentos from "./components/Orcamentos";
import OrdensServico from "./components/OrdensServico";
import Financeiro from "./components/Financeiro";
import Relatorios from "./components/Relatorios";
import Perfil from "./components/Perfil";
import ConfirmDialog from "./components/ConfirmDialog";
import Topbar from "./components/Topbar";
import Configuracoes from "./components/Configuracoes";
import { ToastProvider } from "./components/ui/toast";
import { EmpresaProvider } from "./contexts/EmpresaContext";
import {
  LayoutDashboard,
  Users,
  FileText,
  Wrench,
  Zap,
  Package,
  Wallet,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export default function App() {
  return (
    <ToastProvider>
      <AppInterno />
    </ToastProvider>
  );
}

function AppInterno() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [pagina, setPagina] = useState("dashboard");
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [logoutAberto, setLogoutAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  // Verificar usuário logado
  useEffect(() => {
    // Se a URL tem tokens OAuth (Supabase acabou de redirecionar),
    // NÃO limpar o hash — o client Supabase precisa ler access_token,
    // expires_at, refresh_token, etc. para estabelecer a sessão.
    // Após o Supabase processar, onAuthStateChange dispara.
    if (window.location.hash && !window.location.hash.includes("access_token")) {
      const hashLimpo = window.location.hash
        .split("&")
        .filter((parte) => !parte.startsWith("#type=recovery"))
        .filter((parte) => !parte.startsWith("redefinir-senha"))
        .join("&");
      if (hashLimpo !== window.location.hash && !hashLimpo.includes("access_token")) {
        if (hashLimpo.length <= 1) {
          history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search
          );
        } else {
          history.replaceState(null, "", hashLimpo);
        }
      }
    }

    async function verificarUsuario() {
      // Pequeno delay para garantir que o Supabase processou o OAuth
      await new Promise((resolve) => setTimeout(resolve, 200));

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUsuario(user);
    }

    verificarUsuario();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUsuario(session.user);

        // Se estamos chegando do OAuth (SIGNED_IN + hash de access_token),
        // limpar o hash agora que a sessão foi estabelecida.
        if (
          event === "SIGNED_IN" &&
          window.location.hash.includes("access_token")
        ) {
          history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search
          );
        }
      } else if (event === "SIGNED_OUT") {
        setUsuario(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Logout
  async function sair() {
    setSaindo(true);
    await supabase.auth.signOut();
    setSaindo(false);
    setLogoutAberto(false);
  }

  // Mapa de título e ícone por página (para a Topbar)
  const infoPagina = useMemo<
    Record<string, { titulo: string; icone: LucideIcon }>
  >(
    () => ({
      dashboard: { titulo: "Dashboard", icone: LayoutDashboard },
      clientes: { titulo: "Clientes", icone: Users },
      orcamentos: { titulo: "Orçamentos", icone: FileText },
      "ordens-servico": {
        titulo: "Ordens de Serviço",
        icone: Wrench,
      },
      servicos: { titulo: "Serviços", icone: Zap },
      produtos: { titulo: "Produtos", icone: Package },
      financeiro: { titulo: "Financeiro", icone: Wallet },
      relatorios: { titulo: "Relatórios", icone: BarChart3 },
      configuracoes: {
        titulo: "Configurações",
        icone: Settings,
      },
    }),
    []
  );

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

  const info = infoPagina[pagina] || infoPagina.dashboard;

  // Sistema
  return (
    <EmpresaProvider usuario={usuario}>
      <div className="min-h-screen bg-gray-100">
      <Sidebar
        pagina={pagina}
        setPagina={(p) => {
          setPagina(p);
          setMenuAberto(false);
        }}
        aoAbrirPerfil={() => setPerfilAberto(true)}
        aoPedirLogout={() => setLogoutAberto(true)}
        usuario={usuario}
        aberta={menuAberto}
        aoFechar={() => setMenuAberto(false)}
      />

      {perfilAberto && usuario && (
        <Perfil
          usuario={usuario}
          aoFechar={() => setPerfilAberto(false)}
          aoAtualizar={(u) => setUsuario(u)}
        />
      )}

      <ConfirmDialog
        aberto={logoutAberto}
        titulo="Sair da conta?"
        descricao="Você precisará fazer login novamente para acessar o painel."
        textoBotaoConfirmar="Sair"
        corBotaoConfirmar="vermelho"
        carregando={saindo}
        aoConfirmar={sair}
        aoCancelar={() => setLogoutAberto(false)}
      />

      <main className="lg:ml-64 min-h-screen">
        <Topbar
          titulo={info.titulo}
          icone={info.icone}
          aoAbrirMenu={() => setMenuAberto(true)}
        />

        <div className="px-4 sm:px-6 lg:px-8 py-6">

        {/* Dashboard */}
        {pagina === "dashboard" && (
          <Dashboard setPagina={setPagina} />
        )}

        {/* Clientes */}
        {pagina === "clientes" && <Clientes />}

        {/* Orçamentos */}
        {pagina === "orcamentos" && <Orcamentos />}

        {/* Ordens de Serviço */}
        {pagina === "ordens-servico" && <OrdensServico />}

        {/* Serviços */}
        {pagina === "servicos" && <Servicos />}

        {/* Produtos */}
        {pagina === "produtos" && <Produtos />}

        {/* Financeiro */}
        {pagina === "financeiro" && <Financeiro />}
        {pagina === "relatorios" && <Relatorios />}

        {/* Configurações */}
        {pagina === "configuracoes" && <Configuracoes />}

        </div>

      </main>
      </div>
    </EmpresaProvider>
  );
}
