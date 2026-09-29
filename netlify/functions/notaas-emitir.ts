import {
  autenticarEmissor,
  lerBody,
  lerConfiguracao,
  lerRespostaApi,
  montarPayload,
  mensagemErroApi,
  respostaJson,
  type FunctionEvent,
} from "../lib/notaas";

export const config = {
  path: "/.netlify/functions/notaas-emitir",
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};

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

  const emissor = await autenticarEmissor(event, config);
  if (!emissor) {
    return respostaJson(403, { error: "Esta conta não está autorizada a usar o emissor fiscal configurado." });
  }

  const input = lerBody(event);
  if (!input) return respostaJson(400, { error: "Corpo JSON inválido." });
  const draftId = typeof input.id === "string" ? input.id.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(draftId)) {
    return respostaJson(422, { error: "Identificador do rascunho inválido." });
  }

  let payload: ReturnType<typeof montarPayload>;
  try {
    payload = montarPayload(input, config);
  } catch (error) {
    return respostaJson(422, { error: error instanceof Error ? error.message : "Dados fiscais inválidos." });
  }
  // A chave única no banco reserva o rascunho antes da chamada externa.
  const { error: reservaErro } = await emissor.banco.from("notaas_requests")
    .insert({ user_id: emissor.userId, draft_id: draftId, status: "reserved" });
  if (reservaErro) {
    if (reservaErro.code !== "23505") {
      return respostaJson(503, { error: "Não foi possível registrar a solicitação fiscal. Nenhuma nota foi enviada." });
    }
    const { data: anterior, error: consultaErro } = await emissor.banco.from("notaas_requests")
      .select("status,invoice_id").eq("user_id", emissor.userId).eq("draft_id", draftId).maybeSingle();
    if (consultaErro || !anterior) return respostaJson(503, { error: "Não foi possível consultar a solicitação anterior." });
    if (anterior.invoice_id) return respostaJson(202, { invoiceId: anterior.invoice_id, status: anterior.status });
    if (anterior.status !== "rejected") {
      return respostaJson(409, { code: "NOTAAS_REVIEW_REQUIRED", error: "Já existe uma tentativa de emissão para este rascunho. Confirme o resultado com o suporte antes de tentar novamente." });
    }
    const { data: retomada, error: retomadaErro } = await emissor.banco.from("notaas_requests")
      .update({ status: "reserved" }).eq("user_id", emissor.userId).eq("draft_id", draftId)
      .eq("status", "rejected").select("draft_id").maybeSingle();
    if (retomadaErro || !retomada) return respostaJson(409, { error: "Esta solicitação já está em processamento." });
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
      // Apenas erros de validação confirmam que nenhuma nota foi aceita.
      if ([400, 422].includes(response.status)) {
        const { error: rejeicaoErro } = await emissor.banco.from("notaas_requests")
          .update({ status: "rejected" }).eq("user_id", emissor.userId).eq("draft_id", draftId);
        if (rejeicaoErro) return respostaJson(503, { error: "Não foi possível confirmar a rejeição. Verifique a emissão antes de tentar novamente." });
      }
      return respostaJson(response.status, { error: [400, 422].includes(response.status)
        ? mensagemErroApi(resposta)
        : "O provedor não confirmou a emissão. Não reenvie este rascunho antes de verificar o resultado com o suporte." });
    }
    if (typeof resposta.invoiceId !== "string" || !resposta.invoiceId) {
      return respostaJson(502, { error: "O provedor aceitou a solicitação sem identificador. Confirme a emissão com o suporte antes de tentar novamente." });
    }
    const { error: confirmacaoErro } = await emissor.banco.from("notaas_requests")
      .update({ status: typeof resposta.status === "string" ? resposta.status : "queued", invoice_id: resposta.invoiceId })
      .eq("user_id", emissor.userId).eq("draft_id", draftId);
    if (confirmacaoErro) return respostaJson(503, { error: "O provedor recebeu a solicitação, mas o registro local não foi confirmado. Não reenvie; contate o suporte." });

    return respostaJson(202, {
      invoiceId: resposta.invoiceId,
      status: resposta.status || "queued",
      pollUrl: resposta.pollUrl,
    });
  } catch {
    return respostaJson(502, { error: "Não foi possível confirmar a resposta da API. Não reenvie este rascunho antes de verificar a emissão com o suporte." });
  }
};
