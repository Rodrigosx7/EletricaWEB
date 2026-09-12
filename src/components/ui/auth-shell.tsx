import type { ReactElement, ReactNode } from "react";

interface AuthShellProps { children: ReactNode; }

export function AuthShell({ children }: AuthShellProps): ReactElement {
  return <main className="auth-solo">{children}</main>;
}

export function AuthShellSplit({ children }: AuthShellProps): ReactElement {
  return <main className="auth-layout">{children}</main>;
}

interface AuthCardProps { children: ReactNode; }

export function AuthCard({ children }: AuthCardProps): ReactElement {
  return <section className="auth-card">{children}</section>;
}

interface AuthHeaderProps { icone: ReactNode; titulo: string; subtitulo: string; }

export function AuthHeader({ icone, titulo, subtitulo }: AuthHeaderProps): ReactElement {
  return (
    <header className="auth-card-header">
      <span className="auth-card-icon" aria-hidden="true">{icone}</span>
      <h2>{titulo}</h2>
      <p>{subtitulo}</p>
    </header>
  );
}

interface FloatingFieldProps {
  id: string;
  label: string;
  icone: ReactNode;
  type?: "email" | "password" | "text";
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}

export function FloatingField({ id, label, icone, type = "text", value, onChange, placeholder = "", required = false, autoComplete }: FloatingFieldProps): ReactElement {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-input-wrap">
        <span aria-hidden="true">{icone}</span>
        <input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} autoComplete={autoComplete} />
      </div>
    </div>
  );
}

interface PrimaryButtonProps {
  type?: "submit" | "button";
  onClick?: () => void;
  carregando?: boolean;
  carregandoTexto: string;
  texto: string;
  icone?: ReactNode;
}

export function PrimaryButton({ type = "submit", onClick, carregando = false, carregandoTexto, texto, icone }: PrimaryButtonProps): ReactElement {
  return (
    <button type={type} onClick={onClick} disabled={carregando} className="btn-primary auth-primary-button">
      {carregando ? carregandoTexto : texto}
      {!carregando && icone}
    </button>
  );
}
