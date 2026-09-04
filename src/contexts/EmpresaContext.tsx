import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";

export type Empresa = {
  id: string;
  user_id: string;
  nome: string;
  slogan: string | null;
  logo_url: string | null;
  cor_primaria: string;
  cor_secundaria: string;
};

type EmpresaContextValue = {
  empresa: Empresa | null;
  carregando: boolean;
  atualizar: (patch: Partial<Empresa>) => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
  removerLogo: () => Promise<void>;
};

const EmpresaContext = createContext<EmpresaContextValue | null>(null);

export function useEmpresa(): EmpresaContextValue {
  const ctx = useContext(EmpresaContext);
  if (!ctx) {
    throw new Error(
      "useEmpresa precisa estar dentro de <EmpresaProvider>"
    );
  }
  return ctx;
}

type EmpresaProviderProps = {
  usuario: User | null;
  children: ReactNode;
};

const COR_PRIMARIA_PADRAO = "#FFD60A";
const COR_SECUNDARIA_PADRAO = "#0D1B2A";

function hexParaHsl(hex: string): string {
  // Converte #RRGGBB para "H S% L%" — útil para variantes de Tailwind via opacity
  const limpo = hex.replace("#", "");
  const r = parseInt(limpo.substring(0, 2), 16) / 255;
  const g = parseInt(limpo.substring(2, 4), 16) / 255;
  const b = parseInt(limpo.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(
    l * 100
  )}%`;
}

function aplicarCoresCss(corPrimaria: string, corSecundaria: string) {
  const root = document.documentElement;
  root.style.setProperty(
    "--color-primary",
    corPrimaria || COR_PRIMARIA_PADRAO
  );
  root.style.setProperty(
    "--color-primary-hsl",
    hexParaHsl(corPrimaria || COR_PRIMARIA_PADRAO)
  );
  root.style.setProperty(
    "--color-secondary",
    corSecundaria || COR_SECUNDARIA_PADRAO
  );
  root.style.setProperty(
    "--color-primary-hover",
    corPrimaria + "E6" // 90% opacity em hex
  );
}

export function EmpresaProvider({
  usuario,
  children,
}: EmpresaProviderProps): ReactElement {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Carrega empresa do usuário logado
  useEffect(() => {
    if (!usuario) {
      setEmpresa(null);
      return;
    }

    let cancelado = false;
    async function carregar() {
      setCarregando(true);

      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .eq("user_id", usuario!.id)
        .maybeSingle();

      if (cancelado) return;

      if (error) {
        console.error("Erro ao carregar empresa:", error);
        setCarregando(false);
        return;
      }

      if (data) {
        setEmpresa(data as Empresa);
        aplicarCoresCss(
          data.cor_primaria || COR_PRIMARIA_PADRAO,
          data.cor_secundaria || COR_SECUNDARIA_PADRAO
        );
      }

      setCarregando(false);
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [usuario]);

  const atualizar = useCallback(
    async (patch: Partial<Empresa>) => {
      if (!empresa) return;

      const payload = { ...patch, updated_at: new Date().toISOString() };

      const { error } = await supabase
        .from("empresas")
        .update(payload)
        .eq("id", empresa.id);

      if (error) {
        console.error("Erro ao atualizar empresa:", error);
        throw new Error(
          `Erro ao atualizar empresa: ${error.message}`
        );
      }

      // Recarrega do banco para garantir consistência (evita race condition
      // entre estado local e dados reais)
      const { data: atualizado, error: erroReload } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", empresa.id)
        .maybeSingle();

      if (erroReload) {
        console.error("Erro ao recarregar empresa:", erroReload);
        // Fallback: usar o payload mesmo
        const novaEmpresa = { ...empresa, ...payload } as Empresa;
        setEmpresa(novaEmpresa);
        if (patch.cor_primaria || patch.cor_secundaria) {
          aplicarCoresCss(
            novaEmpresa.cor_primaria || COR_PRIMARIA_PADRAO,
            novaEmpresa.cor_secundaria || COR_SECUNDARIA_PADRAO
          );
        }
        return;
      }

      if (atualizado) {
        const dadosAtualizados = atualizado as Empresa;
        setEmpresa(dadosAtualizados);
        aplicarCoresCss(
          dadosAtualizados.cor_primaria || COR_PRIMARIA_PADRAO,
          dadosAtualizados.cor_secundaria || COR_SECUNDARIA_PADRAO
        );
      }
    },
    [empresa]
  );

  const uploadLogo = useCallback(
    async (file: File): Promise<string> => {
      if (!usuario) {
        throw new Error("Usuário não autenticado.");
      }

      const extensao = file.name.split(".").pop()?.toLowerCase() || "png";
      if (!["png", "jpg", "jpeg", "svg", "webp"].includes(extensao)) {
        throw new Error("Formato inválido. Use PNG, JPG, SVG ou WEBP.");
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Arquivo muito grande. Máximo 5MB.");
      }

      const caminho = `${usuario.id}/logo-${Date.now()}.${extensao}`;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(caminho, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(
          `Erro ao enviar logo: ${uploadError.message}`
        );
      }

      const { data: urlData } = supabase.storage
        .from("logos")
        .getPublicUrl(caminho);

      const url = urlData.publicUrl;

      await atualizar({ logo_url: url });

      return url;
    },
    [usuario, atualizar]
  );

  const removerLogo = useCallback(async () => {
    await atualizar({ logo_url: null });
  }, [atualizar]);

  const value = useMemo(
    () => ({
      empresa,
      carregando,
      atualizar,
      uploadLogo,
      removerLogo,
    }),
    [empresa, carregando, atualizar, uploadLogo, removerLogo]
  );

  return (
    <EmpresaContext.Provider value={value}>
      {children}
    </EmpresaContext.Provider>
  );
}
