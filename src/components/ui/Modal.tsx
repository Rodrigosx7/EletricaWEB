import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type ModalProps = {
  title: string;
  description?: string;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
  children: ReactNode;
  footer?: ReactNode;
};

// Only the topmost dialog owns focus. Nested confirmations preserve their parent.
const openDialogs: symbol[] = [];
let originalOverflow = "";

export default function Modal({ title, description, onClose, busy = false, wide = false, children, footer }: ModalProps) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => { closeRef.current = onClose; busyRef.current = busy; }, [onClose, busy]);

  useEffect(() => {
    const key = Symbol("dialog");
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!openDialogs.length) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    openDialogs.push(key);
    const focusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
    ) || []).filter((el) => el.getClientRects().length > 0);
    (focusable()[0] || panel.current)?.focus();
    function onKey(e: KeyboardEvent) {
      if (openDialogs.at(-1) !== key) return;
      if (e.key === "Escape" && !busyRef.current) {
        e.preventDefault(); e.stopImmediatePropagation(); closeRef.current();
      }
      if (e.key !== "Tab") return;
      const els = focusable();
      const first = els[0]; const last = els.at(-1);
      if (!first) { e.preventDefault(); panel.current?.focus(); return; }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      openDialogs.splice(openDialogs.indexOf(key), 1);
      if (!openDialogs.length) document.body.style.overflow = originalOverflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div ref={panel} className={`modal-panel${wide ? " modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id} aria-describedby={description ? `${id}-description` : undefined} tabIndex={-1}>
        <header className="modal-header">
          <div><h2 id={id}>{title}</h2>{description && <p id={`${id}-description`}>{description}</p>}</div>
          <button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Fechar janela"><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>, document.body
  );
}
