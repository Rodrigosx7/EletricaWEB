import type { ReactElement, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "./ui/Modal";

type ConfirmDialogProps = {
  aberto: boolean;
  titulo: string;
  descricao: ReactNode;
  textoBotaoConfirmar?: string;
  textoBotaoCancelar?: string;
  corBotaoConfirmar?: "amarelo" | "vermelho";
  carregando?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
};

export default function ConfirmDialog({
  aberto, titulo, descricao, textoBotaoConfirmar = "Confirmar",
  textoBotaoCancelar = "Cancelar", corBotaoConfirmar = "amarelo",
  carregando = false, aoConfirmar, aoCancelar,
}: ConfirmDialogProps): ReactElement | null {
  if (!aberto) return null;
  return <Modal title={titulo} onClose={aoCancelar} busy={carregando}
    footer={<>
      <button type="button" onClick={aoCancelar} disabled={carregando} className="btn-secondary">{textoBotaoCancelar}</button>
      <button type="button" onClick={aoConfirmar} disabled={carregando} className={corBotaoConfirmar === "vermelho" ? "btn-danger" : "btn-primary"}>
        {carregando ? "Aguarde…" : textoBotaoConfirmar}
      </button>
    </>}>
    <div className="flex items-start gap-3 text-sm leading-relaxed">
      <AlertTriangle className="shrink-0 mt-0.5 text-[var(--color-warning)]" size={20} aria-hidden="true" />
      <div>{descricao}</div>
    </div>
  </Modal>;
}
