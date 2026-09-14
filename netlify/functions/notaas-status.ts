import {
  exigirUsuario,
  lerConfiguracao,
  lerRespostaApi,
  mensagemErroApi,
  respostaJson,
  type FunctionEvent,
} from "../lib/notaas";

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

  if (!(await exigirUsuario(event, config))) {
    return respostaJson(401, { error: "Faça login novamente para consultar a nota." });
  }

  const invoiceId = event.queryStringParameters?.id?.trim();
  if (!invoiceId || !/^[\w-]+$/.test(invoiceId)) {
    return respostaJson(400, { error: "Informe um identificador de nota válido." });
  }

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
