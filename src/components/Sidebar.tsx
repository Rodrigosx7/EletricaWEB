import { useEffect, type ReactNode } from "react";
import {
  X,
  LayoutDashboard,
  Users,
  FileText,
  Wrench,
  Zap,
  Package,
  DollarSign,
  BarChart3,
  Calculator,
  ClipboardList,
  Settings,
  LogOut,
  Pencil,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useEmpresa } from "../contexts/EmpresaContext";
import { iniciais } from "../utils/formatters";

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
  icone: (props: { className?: string }) => ReactNode;
};

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
      itens: [{ id: "dashboard", nome: "Dashboard", icone: LayoutDashboard }],
    },
    {
      titulo: "Cadastros",
      itens: [
        { id: "clientes", nome: "Clientes", icone: Users },
        { id: "orcamentos", nome: "Orçamentos", icone: FileText },
        { id: "ordens-servico", nome: "Ordens de Serviço", icone: Wrench },
        { id: "servicos", nome: "Serviços", icone: Zap },
        { id: "produtos", nome: "Produtos", icone: Package },
      ],
    },
    {
      titulo: "Análise",
      itens: [
        { id: "financeiro", nome: "Financeiro", icone: DollarSign },
        { id: "relatorios", nome: "Relatórios", icone: BarChart3 },
      ],
    },
    {
      titulo: "Ferramentas",
      itens: [
        {
          id: "calculadora",
          nome: "Calculadora Elétrica",
          icone: Calculator,
        },
        {
          id: "orcamentoRapido",
          nome: "Orçamento Rápido",
          icone: ClipboardList,
        },
      ],
    },
    {
      titulo: "Conta",
      itens: [
        {
          id: "configuracoes",
          nome: "Configurações",
          icone: Settings,
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
                <Zap className="w-6 h-6" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold truncate">
                {empresa?.nome || "Portal Elétrico"}
              </h1>
              <p className="text-xs text-slate-500 truncate">
                {empresa?.slogan || "Gestão para eletricistas"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="lg:hidden text-slate-500 hover:text-white transition p-1 rounded-lg hover:bg-white/10 shrink-0"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu agrupado */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {grupos.map((grupo) => (
            <div key={grupo.titulo}>
              <p className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
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
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {ativo && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-yellow-300 rounded-r-full" />
                      )}
                      <Icone
                        className={`w-5 h-5 shrink-0 ${
                          ativo ? "text-[#0D1B2A]" : "text-slate-500"
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
              <p className="text-xs text-slate-500 truncate">
                {usuario?.email}
              </p>
            </div>
            <Pencil className="w-4 h-4 text-slate-500 group-hover:text-[#FFD60A] transition shrink-0" />
          </button>

          <button
            type="button"
            onClick={aoPedirLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-red-500/10 hover:text-red-300 transition group"
          >
            <LogOut className="w-5 h-5 text-slate-500 group-hover:text-red-300 shrink-0" />
            <span className="text-sm">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
