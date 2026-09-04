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
import Perfil from "./components/Perfil";
import ConfirmDialog from "./components/ConfirmDialog";
import Topbar from "./components/Topbar";
import { ToastProvider } from "./components/ui/toast";
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
        {pagina === "financeiro" && (
          <EmConstrucao
            titulo="Financeiro"
            descricao="Acompanhe receitas, despesas e fluxo de caixa do seu negócio."
            icone="💰"
          />
        )}

        {/* Relatórios */}
        {pagina === "relatorios" && (
          <EmConstrucao
            titulo="Relatórios"
            descricao="Gere relatórios de faturamento, clientes e desempenho em PDF."
            icone="📊"
          />
        )}

        {/* Configurações */}
        {pagina === "configuracoes" && (
          <EmConstrucao
            titulo="Configurações"
            descricao="Personalize dados da empresa, preferências e integrações."
            icone="⚙️"
          />
        )}

        </div>

      </main>
    </div>
  );
}

function EmConstrucao({
  titulo,
  descricao,
  icone,
}: {
  titulo: string;
  descricao: string;
  icone: string;
}) {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900">
        {titulo}
      </h1>
      <p className="text-gray-500 mt-1">
        {descricao}
      </p>

      <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="text-6xl mb-4">{icone}</div>
          <h2 className="text-xl font-bold text-gray-900">
            Em breve
          </h2>
          <p className="text-gray-500 mt-2 max-w-md">
            Este módulo está em desenvolvimento e ficará disponível em uma
            próxima atualização. Enquanto isso, explore as outras áreas do
            painel.
          </p>
          <button
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("navegar", {
                  detail: { pagina: "dashboard" },
                })
              )
            }
            className="mt-6 bg-[#FFD60A] hover:bg-yellow-400 text-[#0D1B2A] font-bold px-5 py-2.5 rounded-lg transition shadow-lg shadow-yellow-500/20"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}