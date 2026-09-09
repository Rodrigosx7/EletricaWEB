import { useCallback, useState } from "react";

/**
 * Estado e ações de paginação reutilizáveis.
 *
 * Uso típico:
 *   const paginacao = usePaginacao(20);
 *   // paginacao.pagina, paginacao.tamanho, paginacao.total,
 *   // paginacao.paginar(0, 50), paginacao.proxima(), paginacao.anterior()
 */
export type Paginacao<TFiltro> = {
  pagina: number;
  tamanho: number;
  total: number;
  filtro: TFiltro;
  setPagina: (p: number) => void;
  setTamanho: (t: number) => void;
  setTotal: (t: number) => void;
  setFiltro: (f: TFiltro) => void;
  paginar: (pagina: number, total: number) => void;
  proxima: () => boolean;
  anterior: () => boolean;
  resetar: () => void;
  totalPaginas: number;
  offset: number;
  limite: number;
};

export function usePaginacao<TFiltro = Record<string, unknown>>(
  tamanhoInicial = 20
): Paginacao<TFiltro> {
  const [pagina, setPagina] = useState(0);
  const [tamanho, setTamanho] = useState(tamanhoInicial);
  const [total, setTotal] = useState(0);

  // Filtro genérico — útil para resetar paginação quando muda o termo de busca.
  const [filtro, setFiltroState] = useState<TFiltro>({} as TFiltro);

  const setFiltro = useCallback((f: TFiltro) => {
    setFiltroState(f);
    setPagina(0); // muda filtro → volta pra primeira página
  }, []);

  const resetar = useCallback(() => {
    setPagina(0);
  }, []);

  const paginar = useCallback((_p: number, t: number) => {
    setTotal(t);
    // Se o total caiu e a página atual ficou inválida, volta pra anterior.
    setPagina((atual) => {
      const max = Math.max(0, Math.ceil(t / tamanhoInicial) - 1);
      return Math.min(atual, max);
    });
  }, []);

  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  const offset = pagina * tamanho;
  const limite = tamanho;

  const proxima = useCallback((): boolean => {
    const max = Math.max(0, Math.ceil(total / tamanho) - 1);
    if (pagina >= max) return false;
    setPagina((p) => p + 1);
    return true;
  }, [pagina, total, tamanho]);

  const anterior = useCallback((): boolean => {
    if (pagina <= 0) return false;
    setPagina((p) => p - 1);
    return true;
  }, [pagina]);

  return {
    pagina,
    tamanho,
    total,
    filtro,
    setPagina,
    setTamanho,
    setTotal,
    setFiltro,
    paginar,
    proxima,
    anterior,
    resetar,
    totalPaginas,
    offset,
    limite,
  };
}
