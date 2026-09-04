import { useEffect, type ReactElement } from "react";
import { X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useEmpresa } from "../contexts/EmpresaContext";

type SidebarProps = {
  pagina: string;
  setPagina: (pagina: string) => void;
  aoAbrirPerfil: () => void;
  aoPedirLogout: () => void;
  usuario: User | null;
  aberta: boolean;
  aoFechar: () => void;
};

type MenuItem = {
  id: string;
  nome: string;
  icone: (props: { className?: string }) => ReactElement;
};

function IconeDashboard({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

function IconeClientes({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 014-4h2a4 4 0 014 4v2zm5-12a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0zM6 8a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function IconeOrcamentos({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function IconeOS({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
      />
    </svg>
  );
}

function IconeServicos({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

function IconeProdutos({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );
}

function IconeFinanceiro({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function IconeRelatorios({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

function IconeConfiguracoes({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function IconeSair({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

function iniciais(nome: string | undefined | null): string {
  if (!nome) return "U";
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 0) return "U";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export default function Sidebar({
  pagina,
  setPagina,
  aoAbrirPerfil,
  aoPedirLogout,
  usuario,
  aberta,
  aoFechar,
}: SidebarProps) {
  const { empresa } = useEmpresa();

  // Fecha com ESC quando drawer está aberto (apenas em mobile)
  useEffect(() => {
    if (!aberta) return;
    function teclaEsc(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
    }
    window.addEventListener("keydown", teclaEsc);
    return () => window.removeEventListener("keydown", teclaEsc);
  }, [aberta, aoFechar]);

  function handleClickItem(id: string) {
    setPagina(id);
    // Em mobile, fecha o drawer após selecionar
    aoFechar();
  }

  const grupos: { titulo: string; itens: MenuItem[] }[] = [
    {
      titulo: "Principal",
      itens: [
        {
          id: "dashboard",
          nome: "Dashboard",
          icone: IconeDashboard,
        },
      ],
    },
    {
      titulo: "Cadastros",
      itens: [
        { id: "clientes", nome: "Clientes", icone: IconeClientes },
        {
          id: "orcamentos",
          nome: "Orçamentos",
          icone: IconeOrcamentos,
        },
        {
          id: "ordens-servico",
          nome: "Ordens de Serviço",
          icone: IconeOS,
        },
        { id: "servicos", nome: "Serviços", icone: IconeServicos },
        { id: "produtos", nome: "Produtos", icone: IconeProdutos },
      ],
    },
    {
      titulo: "Análise",
      itens: [
        {
          id: "financeiro",
          nome: "Financeiro",
          icone: IconeFinanceiro,
        },
        {
          id: "relatorios",
          nome: "Relatórios",
          icone: IconeRelatorios,
        },
      ],
    },
    {
      titulo: "Conta",
      itens: [
        {
          id: "configuracoes",
          nome: "Configurações",
          icone: IconeConfiguracoes,
        },
      ],
    },
  ];

  const displayName =
    (usuario?.user_metadata?.nome as string | undefined) ||
    usuario?.email?.split("@")[0] ||
    "Usuário";

  return (
    <>
      {/* Overlay escuro em mobile quando drawer está aberto */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          aberta
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={aoFechar}
        aria-hidden="true"
      />

      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-[#0D1B2A] text-white flex flex-col shadow-xl z-50 transition-transform duration-300 ease-in-out ${
          aberta ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
        aria-label="Menu lateral"
      >
      {/* Logo / marca */}
      <div className="h-20 flex items-center justify-between gap-3 px-5 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md shrink-0 overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))",
              color: "var(--color-secondary)",
            }}
          >
            {empresa?.logo_url ? (
              <img
                src={empresa.logo_url}
                alt="Logo"
                className="w-full h-full object-contain bg-white"
              />
            ) : (
              <svg
                className="w-6 h-6"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold truncate">
              {empresa?.nome || "Portal Elétrico"}
            </h1>
            <p className="text-xs text-gray-400 truncate">
              {empresa?.slogan || "Gestão para eletricistas"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={aoFechar}
          className="lg:hidden text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-white/10 shrink-0"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Menu agrupado */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {grupos.map((grupo) => (
          <div key={grupo.titulo}>
            <p className="px-3 mb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              {grupo.titulo}
            </p>
            <div className="space-y-1">
              {grupo.itens.map((item) => {
                const ativo = pagina === item.id;
                const Icone = item.icone;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleClickItem(item.id)}
                    className={`relative w-full flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg text-left text-sm transition ${
                      ativo
                        ? "bg-[#FFD60A] text-[#0D1B2A] font-semibold shadow-md shadow-yellow-500/20"
                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {ativo && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-yellow-300 rounded-r-full" />
                    )}
                    <Icone
                      className={`w-5 h-5 shrink-0 ${
                        ativo ? "text-[#0D1B2A]" : "text-gray-400"
                      }`}
                    />
                    <span className="truncate">{item.nome}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Usuário + Sair */}
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={aoAbrirPerfil}
          className="w-full flex items-center gap-3 px-2 py-2 mb-1 rounded-lg bg-white/5 hover:bg-white/10 transition text-left group"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FFD60A] to-yellow-500 text-[#0D1B2A] font-bold flex items-center justify-center text-sm shrink-0 overflow-hidden">
            {usuario?.user_metadata?.avatar_url ? (
              <img
                src={`${usuario.user_metadata.avatar_url}${
                  (usuario.user_metadata.avatar_url as string).includes("?")
                    ? "&"
                    : "?"
                }t=${Date.now()}`}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              iniciais(displayName)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate group-hover:text-[#FFD60A] transition">
              {displayName}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {usuario?.email}
            </p>
          </div>
          <svg
            className="w-4 h-4 text-gray-400 group-hover:text-[#FFD60A] transition shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={aoPedirLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-red-500/10 hover:text-red-300 transition group"
        >
          <IconeSair className="w-5 h-5 text-gray-400 group-hover:text-red-300 shrink-0" />
          <span className="text-sm">Sair</span>
        </button>
      </div>
    </aside>
    </>
  );
}
