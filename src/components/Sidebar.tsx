import { useEffect, useRef, type ReactNode } from "react";
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
  ChevronsLeft,
  ChevronsRight,
  PanelsTopLeft,
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
  recolhida: boolean;
  aoAlternarRecolhida: () => void;
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
  recolhida,
  aoAlternarRecolhida,
}: SidebarProps) {
  const { empresa } = useEmpresa();
  const menuRef = useRef<HTMLElement>(null);

  // Fecha com ESC quando drawer está aberto (apenas em mobile)
  useEffect(() => {
    if (!aberta || window.matchMedia("(min-width: 1024px)").matches) return;
    const focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function teclaEsc(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
      if (e.key !== "Tab") return;
      const botoes = menuRef.current?.querySelectorAll<HTMLButtonElement>("button");
      if (!botoes?.length) return;
      const primeiro = botoes[0];
      const ultimo = botoes[botoes.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }
    window.addEventListener("keydown", teclaEsc);
    return () => {
      window.removeEventListener("keydown", teclaEsc);
      document.body.style.overflow = overflowAnterior;
      if (focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true });
    };
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
      titulo: "Operação",
      itens: [
        { id: "orcamentos", nome: "Orçamentos", icone: FileText },
        { id: "ordens-servico", nome: "Ordens de Serviço", icone: Wrench },
        { id: "notasFiscais", nome: "Notas fiscais", icone: FileText },
      ],
    },
    {
      titulo: "Cadastros",
      itens: [
        { id: "clientes", nome: "Clientes", icone: Users },
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
        { id: "quadros", nome: "Montagem de Quadros", icone: PanelsTopLeft },
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
        ref={menuRef}
        className={`fixed left-0 top-0 h-dvh w-60 ${recolhida ? "lg:w-[4.5rem]" : "lg:w-60"} bg-[var(--color-nav)] text-white flex flex-col border-r border-white/10 z-50 transition-[width,transform] duration-200 ease-in-out ${
          aberta ? "visible translate-x-0" : "invisible -translate-x-full"
        } lg:visible lg:translate-x-0`}
        aria-label="Menu lateral"
      >
        {/* Logo / marca */}
        <div className={`relative h-24 shrink-0 flex items-center gap-3 px-4 border-b border-white/10 ${recolhida ? "lg:justify-center lg:px-2" : "justify-between"}`}>
          <div className={`flex items-center gap-3 min-w-0 ${recolhida ? "lg:hidden" : ""}`}>
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 overflow-hidden border border-white/15"
              style={{
                background: "var(--color-primary)",
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
            <div className={`min-w-0 ${recolhida ? "lg:hidden" : ""}`}>
              <p className="text-base font-bold truncate">
                {empresa?.nome || "Portal Elétrico"}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {empresa?.slogan || "Gestão para eletricistas"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={aoAlternarRecolhida}
            className={`hidden lg:flex w-8 h-8 items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition ${
              recolhida
                ? "static"
                : "absolute top-3 right-2"
            }`}
            aria-label={recolhida ? "Expandir menu lateral" : "Recolher menu lateral"}
            title={recolhida ? "Expandir menu lateral" : "Recolher menu lateral"}
          >
            {recolhida ? (
              <ChevronsRight className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronsLeft className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={aoFechar}
            className="lg:hidden text-slate-300 hover:text-white transition p-3 rounded-lg hover:bg-white/10 shrink-0"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu agrupado */}
        <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-hidden px-2.5 py-5 space-y-5" aria-label="Navegação principal">
          {grupos.map((grupo) => (
            <div key={grupo.titulo}>
              <p className={`px-3 mb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.16em] ${recolhida ? "lg:hidden" : ""}`}>
                {grupo.titulo}
              </p>
              <div>
                {grupo.itens.map((item) => {
                  const ativo = pagina === item.id;
                  const Icone = item.icone;
                  return (
                    <button
                      key={item.id}
                      aria-current={ativo ? "page" : undefined}
                      onClick={() => handleClickItem(item.id)}
                      title={recolhida ? item.nome : undefined}
                      className={`relative w-full flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg text-left text-sm transition ${
                        recolhida ? "lg:justify-center lg:px-0" : ""} ${
                        ativo
                          ? "bg-white/10 text-white font-semibold"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {ativo && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-0.5 bg-[var(--color-primary)]" />
                      )}
                      <Icone
                        className={`w-5 h-5 shrink-0 ${
                          ativo ? "text-[var(--color-primary)]" : "text-slate-500"
                        }`}
                      />
                      <span className={`truncate ${recolhida ? "lg:hidden" : ""}`}>{item.nome}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Usuário + Sair */}
        <div className="shrink-0 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => handleClickItem("configuracoes")}
            aria-current={pagina === "configuracoes" ? "page" : undefined}
            title={recolhida ? "Configurações" : undefined}
            className={`mb-2 w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition ${recolhida ? "lg:justify-center lg:px-0" : ""} ${pagina === "configuracoes" ? "bg-white/10 text-white font-semibold" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
          >
            <Settings className="w-5 h-5 text-slate-500" aria-hidden="true" />
            <span className={recolhida ? "lg:hidden" : ""}>Configurações</span>
          </button>
          <button
            type="button"
            onClick={aoAbrirPerfil}
            title={recolhida ? displayName : undefined}
            className={`w-full flex items-center gap-3 px-2 py-2 mb-1 rounded-lg bg-white/5 hover:bg-white/10 transition text-left group ${recolhida ? "lg:justify-center" : ""}`}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FFD60A] to-yellow-500 text-[#0D1B2A] font-bold flex items-center justify-center text-sm shrink-0 overflow-hidden">
              {usuario?.user_metadata?.avatar_url ? (
                <img
                  src={usuario.user_metadata.avatar_url}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                iniciais(displayName)
              )}
            </div>
            <div className={`min-w-0 flex-1 ${recolhida ? "lg:hidden" : ""}`}>
              <p className="text-sm font-semibold truncate group-hover:text-[#FFD60A] transition">
                {displayName}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {usuario?.email}
              </p>
            </div>
            <Pencil className={`w-4 h-4 text-slate-500 group-hover:text-[#FFD60A] transition shrink-0 ${recolhida ? "lg:hidden" : ""}`} />
          </button>

          <button
            type="button"
            onClick={aoPedirLogout}
            title={recolhida ? "Sair" : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-red-500/10 hover:text-red-300 transition group ${recolhida ? "lg:justify-center lg:px-0" : ""}`}
          >
            <LogOut className="w-5 h-5 text-slate-500 group-hover:text-red-300 shrink-0" />
            <span className={`text-sm ${recolhida ? "lg:hidden" : ""}`}>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
