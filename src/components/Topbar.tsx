import { useEffect, useState, type ReactElement } from "react";
import { Menu, ChevronRight, type LucideIcon } from "lucide-react";
import { useEmpresa } from "../contexts/EmpresaContext";

type TopbarProps = {
  titulo: string;
  subtitulo?: string;
  icone?: LucideIcon;
  aoAbrirMenu: () => void;
  acaoDireita?: ReactElement;
};

export default function Topbar({
  titulo,
  subtitulo,
  aoAbrirMenu,
  acaoDireita,
}: TopbarProps): ReactElement {
  const { empresa } = useEmpresa();
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const intervalo = window.setInterval(() => setAgora(new Date()), 1_000);
    return () => window.clearInterval(intervalo);
  }, []);

  const horaFormatada = agora.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dataFormatada = agora.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return (
    <header aria-label={`Navegação: ${titulo}`} className="workspace-topbar">
      <div className="workspace-context">
        <div className="flex items-center gap-3 min-w-0">
          {/* Botão hamburger — só mobile */}
          <button
            type="button"
            onClick={aoAbrirMenu}
            className="icon-button lg:hidden -ml-2"
            aria-label="Abrir menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="min-w-0 flex items-center gap-3">
            <p className="truncate max-w-48 hidden sm:block">
              {empresa?.nome || "Portal Elétrico"}
            </p>
            <ChevronRight size={14} className="hidden sm:block shrink-0" aria-hidden="true" />
            <strong className="truncate">{titulo}</strong>
            {subtitulo && (
              <p className="text-xs text-gray-500 truncate hidden sm:block">
                {subtitulo}
              </p>
            )}
          </div>
        </div>

      </div>
      {acaoDireita || (
        <time
          dateTime={agora.toISOString()}
          className="flex items-center gap-4 tabular-nums whitespace-nowrap"
        >
          <span>{horaFormatada}</span>
          <span>{dataFormatada}</span>
        </time>
      )}
    </header>
  );
}
