import { ChevronLeft, ChevronRight } from "lucide-react";

type ControlesPaginacaoProps = {
  pagina: number;
  totalPaginas: number;
  total: number;
  tamanho: number;
  onProxima: () => void;
  onAnterior: () => void;
  onMudarTamanho?: (tamanho: number) => void;
  opcoesTamanho?: number[];
};

/**
 * Barra inferior de paginação — usada por todas as listas tabeladas.
 * Mostra contagem, botões anterior/próxima e seletor de tamanho.
 */
export default function ControlesPaginacao({
  pagina,
  totalPaginas,
  total,
  tamanho,
  onProxima,
  onAnterior,
  onMudarTamanho,
  opcoesTamanho = [10, 20, 50, 100],
}: ControlesPaginacaoProps) {
  const inicio = total === 0 ? 0 : pagina * tamanho + 1;
  const fim = Math.min(total, (pagina + 1) * tamanho);
  const temProxima = pagina < totalPaginas - 1;
  const temAnterior = pagina > 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50">
      <div className="text-sm text-slate-600">
        Mostrando <span className="font-semibold">{inicio}</span>–
        <span className="font-semibold">{fim}</span> de{" "}
        <span className="font-semibold">{total}</span>
      </div>

      <div className="flex items-center gap-3">
        {onMudarTamanho && (
          <select
            value={tamanho}
            onChange={(e) => onMudarTamanho(Number(e.target.value))}
            className="text-sm border border-slate-300 rounded-lg px-2 py-1 bg-white"
            aria-label="Itens por página"
          >
            {opcoesTamanho.map((n) => (
              <option key={n} value={n}>
                {n} por página
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAnterior}
            disabled={!temAnterior}
            className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
            aria-label="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-700 px-2">
            Página {pagina + 1} de {Math.max(1, totalPaginas)}
          </span>
          <button
            type="button"
            onClick={onProxima}
            disabled={!temProxima}
            className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
            aria-label="Próxima página"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
