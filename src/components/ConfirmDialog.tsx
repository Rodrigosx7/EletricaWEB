import {
  useEffect,
  type ReactElement,
  type ReactNode,
} from "react";
import { AlertTriangle, X } from "lucide-react";

type ConfirmDialogProps = {
  aberto: boolean;
  titulo: string;
  descricao: ReactNode;
  textoBotaoConfirmar?: string;
  textoBotaoCancelar?: string;
  corBotaoConfirmar?: "amarelo" | "vermelho";
  carregando?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
};

export default function ConfirmDialog({
  aberto,
  titulo,
  descricao,
  textoBotaoConfirmar = "Confirmar",
  textoBotaoCancelar = "Cancelar",
  corBotaoConfirmar = "amarelo",
  carregando = false,
  aoConfirmar,
  aoCancelar,
}: ConfirmDialogProps): ReactElement | null {
  useEffect(() => {
    if (!aberto) return;
    function teclaEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && !carregando) aoCancelar();
    }
    window.addEventListener("keydown", teclaEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", teclaEsc);
      document.body.style.overflow = "";
    };
  }, [aberto, aoCancelar, carregando]);

  if (!aberto) return null;

  const corBotao =
    corBotaoConfirmar === "vermelho"
      ? "bg-red-500 hover:bg-red-600 text-white"
      : "bg-[#FFD60A] hover:bg-yellow-400 text-[#0D1B2A]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => !carregando && aoCancelar()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold text-gray-900">
                  {titulo}
                </h2>
                <button
                  onClick={aoCancelar}
                  disabled={carregando}
                  className="text-gray-400 hover:text-gray-600 transition disabled:opacity-30"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="text-sm text-gray-600 mt-2">
                {descricao}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end">
          <button
            type="button"
            onClick={aoCancelar}
            disabled={carregando}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 font-semibold hover:bg-white transition disabled:opacity-50"
          >
            {textoBotaoCancelar}
          </button>
          <button
            type="button"
            onClick={aoConfirmar}
            disabled={carregando}
            className={`px-4 py-2.5 rounded-lg font-bold transition shadow-sm disabled:opacity-60 ${corBotao}`}
          >
            {carregando ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              textoBotaoConfirmar
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
