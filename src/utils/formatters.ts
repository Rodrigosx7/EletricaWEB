/**
 * Funções utilitárias de formatação — extraídas para evitar duplicação.
 */

/** Formata um número como moeda brasileira (R$ 1.234,56). */
export function formatarMoeda(valor: number): string {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Formata um valor monetário para exibição em input (ex: "1.234,56"). */
export function formatarInputMoeda(valor: number): string {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Máscara monetária: "1234" → "12,34"; "123456" → "1.234,56".
 */
export function mascaraMoeda(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  if (!digitos) return "";
  const numero = Number(digitos) / 100;
  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte string formatada em moeda ("1.234,56") em número (1234.56).
 */
export function converterNumero(valor: string): number {
  return Number(valor.replace(/\./g, "").replace(",", "."));
}

/**
 * Máscara de telefone brasileiro: (11) 98765-4321 ou (11) 1234-5678.
 */
export function mascaraTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);

  if (digitos.length === 0) return "";
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  }
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

/**
 * Máscara de estoque: aceita números com até 3 casas decimais (ex: 1.5, 0.250).
 */
export function mascaraNumero(valor: string): string {
  const limpo = valor.replace(/[^\d,]/g, "");
  const partes = limpo.split(",");
  if (partes.length > 2)
    return `${partes[0]},${partes.slice(1).join("").slice(0, 3)}`;
  if (partes[1] && partes[1].length > 3) {
    return `${partes[0]},${partes[1].slice(0, 3)}`;
  }
  return limpo;
}

/** Formata data ISO (YYYY-MM-DD) para o padrão brasileiro (DD/MM/YYYY). Retorna "-" se nula. */
export function formatarData(data: string | null | undefined): string {
  if (!data) return "-";
  const partes = data.split("-");
  if (partes.length !== 3) return data;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

/** Retorna a data de hoje no formato ISO (YYYY-MM-DD). */
export function dataIsoAtual(): string {
  return new Date().toISOString().split("T")[0];
}

/** Retorna o primeiro dia do mês atual no formato ISO (YYYY-MM-01). */
export function primeiroDiaMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Retorna o primeiro dia do mês anterior no formato ISO. */
export function primeiroDiaMesAnterior(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Calcula a margem de lucro bruta (%).
 * Retorna negativo se o custo for maior que a venda.
 */
export function margemLucro(precoVenda: number, precoCusto: number): number {
  if (!precoCusto || precoCusto === 0) return 0;
  return ((precoVenda - precoCusto) / precoCusto) * 100;
}

/**
 * Extrai as iniciais de um nome para uso em avatares.
 * "Maria Silva" → "MS", "João" → "JO". Retorna "U" se vazio.
 */
export function iniciais(nome: string | null | undefined): string {
  if (!nome) return "U";
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 0 || !partes[0]) return "U";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
