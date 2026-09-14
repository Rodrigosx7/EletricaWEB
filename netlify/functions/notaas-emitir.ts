import {
  exigirUsuario,
  lerBody,
  lerConfiguracao,
  lerRespostaApi,
  montarPayload,
  mensagemErroApi,
  respostaJson,
  type FunctionEvent,
} from "../lib/notaas";

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== "POST") {
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
    return respostaJson(401, { error: "Faça login novamente para emitir uma nota." });
  }

  const input = lerBody(event);
  if (!input) return respostaJson(400, { error: "Corpo JSON inválido." });

  let payload: ReturnType<typeof montarPayload>;
  try {
    payload = montarPayload(input, config);
  } catch (error) {
    return respostaJson(422, { error: error instanceof Error ? error.message : "Dados fiscais inválidos." });
  }

  try {
    const response = await fetch(`${config.baseUrl}/emitir`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify(payload),
    });
    const resposta = await lerRespostaApi(response);
    if (!response.ok) {
      return respostaJson(response.status, { error: mensagemErroApi(resposta) });
    }

    return respostaJson(202, {
      invoiceId: resposta.invoiceId,
      status: resposta.status || "queued",
      pollUrl: resposta.pollUrl,
    });
  } catch {
    return respostaJson(502, { error: "Não foi possível alcançar a API Notaas agora." });
  }
};
