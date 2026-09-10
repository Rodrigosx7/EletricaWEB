/**
 * Constantes de domínio compartilhadas entre componentes.
 * Centralizar evita strings duplicadas e typos em comparações.
 */

/** Status possíveis de uma Ordem de Serviço. */
export const STATUS_OS = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
} as const;

export type StatusOS = (typeof STATUS_OS)[keyof typeof STATUS_OS];

/** Lista ordenada para uso em selects e filtros. */
export const STATUS_OS_VALORES: StatusOS[] = [
  STATUS_OS.ABERTA,
  STATUS_OS.EM_ANDAMENTO,
  STATUS_OS.CONCLUIDA,
  STATUS_OS.CANCELADA,
];

/** Status possíveis de um Orçamento. */
export const STATUS_ORCAMENTO = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  RECUSADO: "Recusado",
  CONCLUIDO: "Concluído",
} as const;

export type StatusOrcamento =
  (typeof STATUS_ORCAMENTO)[keyof typeof STATUS_ORCAMENTO];

export const STATUS_ORCAMENTO_VALORES: StatusOrcamento[] = [
  STATUS_ORCAMENTO.PENDENTE,
  STATUS_ORCAMENTO.APROVADO,
  STATUS_ORCAMENTO.RECUSADO,
  STATUS_ORCAMENTO.CONCLUIDO,
];

/**
 * Largura fixa do número sequencial de OS/Orçamento.
 * 42 → "0042", 1234 → "1234". Quando o negócio passar de 9999 registros,
 * basta aumentar este valor (ex.: 5) e todas as telas seguem o novo padrão.
 */
export const NUMERO_PAD_LENGTH = 4;

/**
 * Formata número sequencial com padding zero à esquerda.
 * `formatarNumero(42)` → "0042"; `formatarNumero(null)` → "-".
 */
export function formatarNumero(numero: number | null | undefined): string {
  if (numero === null || numero === undefined) return "-";
  return String(numero).padStart(NUMERO_PAD_LENGTH, "0");
}
