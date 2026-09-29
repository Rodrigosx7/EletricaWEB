import { createContext, useContext } from "react";

export type TipoToast = "sucesso" | "erro" | "alerta";
export type ToastContextValue = {
  mostrarToast: (mensagem: string, tipo?: TipoToast) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}
