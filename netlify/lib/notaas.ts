import { createClient } from "@supabase/supabase-js";

export type FunctionEvent = {
  httpMethod?: string;
  headers: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
  queryStringParameters?: Record<string, string | undefined> | null;
};

export type NotaasConfig = {
  apiKey: string;
  baseUrl: string;
  aliquotaIss: number;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export type NotaDraftInput = {
  id?: unknown;
  dataEmissao?: unknown;
  clienteNome?: unknown;
  clienteDocumento?: unknown;
  clienteEmail?: unknown;
  clienteEndereco?: unknown;
  descricaoServico?: unknown;
  codigoServico?: unknown;
  valorServico?: unknown;
};

function env(name: string): string {
  return process.env[name]?.trim() || "";
}

export function lerConfiguracao(): NotaasConfig | null {
  const apiKey = env("NOTAAS_API_KEY");
  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const supabaseAnonKey = env("SUPABASE_ANON_KEY") || env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_ANON_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const aliquotaRaw = env("NOTAAS_ALIQUOTA_ISS");
  const aliquotaIss = Number(aliquotaRaw);

  if (!apiKey || !supabaseUrl || !supabaseAnonKey || !Number.isFinite(aliquotaIss) || aliquotaIss < 0 || aliquotaIss > 100) {
    return null;
  }

  return {
    apiKey,
    baseUrl: env("NOTAAS_API_BASE_URL") || "https://platform.notaas.com.br/api/v1",
    aliquotaIss,
    supabaseUrl,
    supabaseAnonKey,
  };
}

export function respostaJson(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

export function lerBody(event: FunctionEvent): NotaDraftInput | null {
  if (!event.body) return null;
  try {
    const texto = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    const valor: unknown = JSON.parse(texto);
    return valor && typeof valor === "object" ? valor as NotaDraftInput : null;
  } catch {
    return null;
  }
}

export async function exigirUsuario(event: FunctionEvent, config: NotaasConfig): Promise<boolean> {
  const authorization = event.headers.authorization || event.headers.Authorization || "";
  if (!authorization.startsWith("Bearer ")) return false;

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return false;

  const cliente = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await cliente.auth.getUser(token);
  return !error && Boolean(data.user);
}

function textoObrigatorio(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function apenasDigitos(value: string): string {
  return value.replace(/\D/g, "");
}

export function montarPayload(input: NotaDraftInput, config: NotaasConfig) {
  const nome = textoObrigatorio(input.clienteNome);
  const documento = apenasDigitos(textoObrigatorio(input.clienteDocumento));
  const descricao = textoObrigatorio(input.descricaoServico);
  const valor = typeof input.valorServico === "number" ? input.valorServico : Number(input.valorServico);

  if (!nome) throw new Error("Informe o nome ou razão social do tomador.");
  if (documento.length !== 11 && documento.length !== 14) throw new Error("Informe um CPF ou CNPJ válido do tomador.");
  if (!descricao) throw new Error("Informe a descrição do serviço.");
  if (!Number.isFinite(valor) || valor <= 0) throw new Error("Informe um valor de serviço maior que zero.");

  const dataEmissao = textoObrigatorio(input.dataEmissao);
  const competencia = /^\d{4}-\d{2}-\d{2}$/.test(dataEmissao) ? dataEmissao.slice(0, 7) : undefined;
  const codigoServicoMunicipal = apenasDigitos(textoObrigatorio(input.codigoServico));
  const email = textoObrigatorio(input.clienteEmail);
  const endereco = textoObrigatorio(input.clienteEndereco);

  return {
    tomador: {
      nome,
      ...(documento.length === 11 ? { cpf: documento } : { cnpj: documento }),
      ...(email ? { email } : {}),
      ...(endereco ? { endereco: { logradouro: endereco } } : {}),
    },
    servico: {
      descricao,
      ...(codigoServicoMunicipal ? { codigoServico: codigoServicoMunicipal } : {}),
    },
    valores: {
      total: Number(valor.toFixed(2)),
      aliquotaIss: config.aliquotaIss,
      issRetido: false,
    },
    ...(competencia ? { competencia } : {}),
    ...(textoObrigatorio(input.id) ? { referencia: textoObrigatorio(input.id) } : {}),
  };
}

export async function lerRespostaApi(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload: unknown = await response.json();
    return payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function mensagemErroApi(payload: Record<string, unknown>): string {
  if (typeof payload.errorMessage === "string") return payload.errorMessage;
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.error === "string") return payload.error;
  return "A Notaas recusou a solicitação. Revise os dados fiscais e tente novamente.";
}
