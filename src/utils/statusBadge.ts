/**
 * Mapeamento centralizado de classes Tailwind para badges de status.
 * Texto 800 (não 700) para melhor contraste sem virar alerta.
 * Tons emerald/amber/blue/slate/red são semânticos e harmonizam
 * com a paleta primary (amarelo) e secondary (navy).
 */
export function classeStatus(status: string): string {
  const mapa: Record<string, string> = {
    // Ordens de Serviço
    "Aberta": "bg-amber-100 text-amber-800",
    "Em andamento": "bg-blue-100 text-blue-800",
    "Concluída": "bg-emerald-100 text-emerald-800",
    "Concluido": "bg-emerald-100 text-emerald-800",
    "Cancelada": "bg-red-100 text-red-800",
    // Orçamentos
    "Pendente": "bg-slate-100 text-slate-700",
    "Aprovado": "bg-emerald-100 text-emerald-800",
    "Recusado": "bg-red-100 text-red-800",
    "Orçamento": "bg-slate-100 text-slate-700",
    "Aguardando aprovação": "bg-amber-100 text-amber-800",
  };
  return mapa[status] || "bg-slate-100 text-slate-700";
}
