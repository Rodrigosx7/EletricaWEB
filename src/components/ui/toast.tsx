import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle, AlertTriangle, X } from "lucide-react";

type TipoToast = "sucesso" | "erro" | "alerta";

type Toast = {
  id: number;
  tipo: TipoToast;
  mensagem: string;
};

type ToastContextValue = {
  mostrarToast: (mensagem: string, tipo?: TipoToast) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast precisa estar dentro de <ToastProvider>");
  }
  return ctx;
}

export function ToastProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const contadorRef = useRef(0);

  const remover = useCallback((id: number) => {
    setToasts((lista) => lista.filter((t) => t.id !== id));
  }, []);

  const mostrarToast = useCallback(
    (mensagem: string, tipo: TipoToast = "sucesso") => {
      contadorRef.current += 1;
      const id = contadorRef.current;
      setToasts((lista) => [...lista, { id, tipo, mensagem }]);
      window.setTimeout(() => remover(id), 4000);
    },
    [remover]
  );

  return (
    <ToastContext.Provider value={{ mostrarToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            aoFechar={() => remover(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  aoFechar,
}: {
  toast: Toast;
  aoFechar: () => void;
}): ReactElement {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisivel(true));
  }, []);

  const config = {
    sucesso: {
      icone: <CheckCircle2 className="w-5 h-5 text-green-500" />,
      borda: "border-green-200",
      bg: "bg-green-50",
    },
    erro: {
      icone: <XCircle className="w-5 h-5 text-red-500" />,
      borda: "border-red-200",
      bg: "bg-red-50",
    },
    alerta: {
      icone: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
      borda: "border-yellow-200",
      bg: "bg-yellow-50",
    },
  }[toast.tipo];

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur transition-all duration-300 min-w-[280px] max-w-md ${config.bg} ${config.borda} ${
        visivel
          ? "opacity-100 translate-x-0"
          : "opacity-0 translate-x-4"
      }`}
    >
      {config.icone}
      <p className="flex-1 text-sm text-gray-800 font-medium">
        {toast.mensagem}
      </p>
      <button
        type="button"
        onClick={aoFechar}
        className="text-gray-400 hover:text-gray-600 transition shrink-0"
        aria-label="Fechar notificação"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
