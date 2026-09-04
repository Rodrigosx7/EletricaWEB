import type { ReactElement } from "react";
import { Menu, type LucideIcon } from "lucide-react";

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
  icone: Icone,
  aoAbrirMenu,
  acaoDireita,
}: TopbarProps): ReactElement {
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-200">
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 h-16">
        <div className="flex items-center gap-3 min-w-0">
          {/* Botão hamburger — só mobile */}
          <button
            type="button"
            onClick={aoAbrirMenu}
            className="lg:hidden text-gray-700 hover:text-gray-900 transition p-2 rounded-lg hover:bg-gray-100 -ml-2"
            aria-label="Abrir menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {Icone && (
            <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0 hidden sm:flex">
              <Icone className="w-5 h-5 text-[#FFD60A]" />
            </div>
          )}

          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">
              {titulo}
            </h1>
            {subtitulo && (
              <p className="text-xs text-gray-500 truncate hidden sm:block">
                {subtitulo}
              </p>
            )}
          </div>
        </div>

        {acaoDireita && <div className="shrink-0">{acaoDireita}</div>}
      </div>
    </header>
  );
}
