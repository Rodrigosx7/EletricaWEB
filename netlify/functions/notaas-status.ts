import {
  autenticarEmissor,
  lerConfiguracao,
  lerRespostaApi,
  mensagemErroApi,
  respostaJson,
  type FunctionEvent,
} from "../lib/notaas";

export const config = {
  path: "/.netlify/functions/notaas-status",
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== "GET") {
    return respostaJson(405, { error: "Método não permitido." });
  }

  const config = lerConfiguracao();
  if (!config) {
    return respostaJson(503, {
      code: "NOTAAS_NOT_CONFIGURED",
      error: "A integração Notaas ainda não foi configurada no ambiente seguro do servidor.",
    });
  }

  const emissor = await autenticarEmissor(event, config);
  if (!emissor) {
    return respostaJson(403, { error: "Esta conta não está autorizada a consultar notas deste emissor." });
  }

  const invoiceId = event.queryStringParameters?.id?.trim();
  if (!invoiceId || !/^[\w-]+$/.test(invoiceId)) {
    return respostaJson(400, { error: "Informe um identificador de nota válido." });
  }

  const { data: registro, error: registroErro } = await emissor.banco.from("notaas_requests")
    .select("draft_id").eq("user_id", emissor.userId).eq("invoice_id", invoiceId).maybeSingle();
  if (registroErro) return respostaJson(503, { error: "Não foi possível verificar a titularidade da nota." });
  if (!registro) return respostaJson(404, { error: "Nota não encontrada para esta conta." });

  try {
    const response = await fetch(`${config.baseUrl}/invoices/${encodeURIComponent(invoiceId)}/status`, {
      headers: { "x-api-key": config.apiKey },
    });
    const resposta = await lerRespostaApi(response);
    if (!response.ok) return respostaJson(response.status, { error: mensagemErroApi(resposta) });

    return respostaJson(200, {
      invoiceId,
      status: resposta.status,
      numeroNfe: resposta.numeroNfe,
      chNFSe: resposta.chNFSe,
      emittedAt: resposta.emittedAt,
      pdfUrl: resposta.pdfUrl,
      xmlUrl: resposta.xmlUrl,
      errorCode: resposta.errorCode,
      errorMessage: resposta.errorMessage,
    });
  } catch {
    return respostaJson(502, { error: "Não foi possível consultar a API Notaas agora." });
  }
};
