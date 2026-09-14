import { dataIsoAtual } from "./formatters";

export type NotaFiscalStatus = "rascunho" | "pronta-revisao";

/**
 * Dados mínimos para preparar uma NFS-e sem transmiti-la.
 * A emissão real depende do município, do regime tributário e de um provedor
 * autorizado; por isso o primeiro fluxo trabalha apenas com rascunhos.
 */
export type RascunhoNotaFiscal = {
  id: string;
  tipo: "NFS-e";
  status: NotaFiscalStatus;
  criadoEm: string;
  atualizadoEm: string;
  dataEmissao: string;
  clienteNome: string;
  clienteDocumento: string;
  clienteEmail: string;
  clienteEndereco: string;
  municipio: string;
  descricaoServico: string;
  codigoServico: string;
  valorServico: number;
  observacoes: string;
  notaasInvoiceId?: string;
  notaasStatus?: string;
  notaasNumeroNfe?: string;
  notaasChNFSe?: string;
  notaasPdfUrl?: string;
  notaasXmlUrl?: string;
  notaasErro?: string;
};

export function novaRascunhoNotaFiscal(): RascunhoNotaFiscal {
  const agora = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    tipo: "NFS-e",
    status: "rascunho",
    criadoEm: agora,
    atualizadoEm: agora,
    dataEmissao: dataIsoAtual(),
    clienteNome: "",
    clienteDocumento: "",
    clienteEmail: "",
    clienteEndereco: "",
    municipio: "",
    descricaoServico: "",
    codigoServico: "",
    valorServico: 0,
    observacoes: "",
  };
}

/** Retorna os dados que ainda impedem a revisão do rascunho. */
export function pendenciasNotaFiscal(nota: RascunhoNotaFiscal): string[] {
  const pendencias: string[] = [];
  if (!nota.clienteNome.trim()) pendencias.push("Identifique o tomador do serviço");
  const documento = nota.clienteDocumento.replace(/\D/g, "");
  if (documento.length !== 11 && documento.length !== 14) pendencias.push("Informe um CPF ou CNPJ válido do tomador");
  if (!nota.municipio.trim()) pendencias.push("Informe o município de emissão");
  if (!nota.descricaoServico.trim()) pendencias.push("Descreva o serviço prestado");
  if (!Number.isFinite(nota.valorServico) || nota.valorServico <= 0) {
    pendencias.push("Informe um valor de serviço maior que zero");
  }
  return pendencias;
}

export function statusNotaFiscal(nota: RascunhoNotaFiscal): NotaFiscalStatus {
  return pendenciasNotaFiscal(nota).length === 0 ? "pronta-revisao" : "rascunho";
}

export function formatarStatusNotaFiscal(status: NotaFiscalStatus): string {
  return status === "pronta-revisao" ? "Pronta para revisão" : "Rascunho";
}
