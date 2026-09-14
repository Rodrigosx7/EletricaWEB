import { supabase } from "../supabase";
import type { RascunhoNotaFiscal } from "./notasFiscais";

type ApiResponse = {
  error?: string;
  code?: string;
  invoiceId?: string;
  status?: string;
  pollUrl?: string;
  numeroNfe?: string;
  chNFSe?: string;
  emittedAt?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  errorCode?: string;
  errorMessage?: string;
};

export class NotaasApiError extends Error {
  readonly code?: string;
  readonly statusCode: number;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = "NotaasApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

async function tokenAtual(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new NotaasApiError("Sua sessão expirou. Faça login novamente.", 401);
  return data.session.access_token;
}

async function chamar(path: string, init: RequestInit = {}): Promise<ApiResponse> {
  const token = await tokenAtual();
  let response: Response;
  try {
    response = await fetch(`/.netlify/functions/${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
  } catch {
    throw new NotaasApiError("A função de emissão não está disponível neste ambiente. Use o Netlify Dev ou o deploy do site.", 0);
  }

  let payload: ApiResponse;
  try {
    payload = await response.json() as ApiResponse;
  } catch {
    throw new NotaasApiError("A função de emissão retornou uma resposta inválida.", response.status);
  }
  if (!response.ok) throw new NotaasApiError(payload.error || "A emissão não foi aceita.", response.status, payload.code);
  return payload;
}

export function emitirNotaFiscal(nota: RascunhoNotaFiscal): Promise<ApiResponse> {
  return chamar("notaas-emitir", { method: "POST", body: JSON.stringify(nota) });
}

export function consultarStatusNota(invoiceId: string): Promise<ApiResponse> {
  return chamar(`notaas-status?id=${encodeURIComponent(invoiceId)}`, { method: "GET" });
}
