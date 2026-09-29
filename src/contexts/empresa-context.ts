import { createContext, useContext } from "react";

export type Empresa = {
  id: string;
  user_id: string;
  nome: string;
  slogan: string | null;
  logo_url: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  email_contato: string | null;
  telefone_contato: string | null;
  cnpj: string | null;
  endereco: string | null;
};

export type EmpresaContextValue = {
  empresa: Empresa | null;
  carregando: boolean;
  atualizar: (patch: Partial<Empresa>) => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
  removerLogo: () => Promise<void>;
};

export const EmpresaContext = createContext<EmpresaContextValue | null>(null);

export function useEmpresa(): EmpresaContextValue {
  const ctx = useContext(EmpresaContext);
  if (!ctx) throw new Error("useEmpresa precisa estar dentro de <EmpresaProvider>");
  return ctx;
}
