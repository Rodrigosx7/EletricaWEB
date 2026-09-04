import type { ReactElement, ReactNode } from "react";
import { SmokeyBackground } from "./login-form";

interface AuthShellProps {
  children: ReactNode;
}

/**
 * Layout compartilhado para todas as telas de autenticação.
 * Centraliza o fundo WebGL smokey e o container glassmorphism.
 */
export function AuthShell({ children }: AuthShellProps): ReactElement {
  return (
    <main className="relative w-screen h-screen bg-[#0D1B2A] overflow-hidden">
      <SmokeyBackground
        color="#FFD60A"
        backdropBlurAmount="sm"
        className="absolute inset-0"
      />
      <div className="relative z-10 flex items-center justify-center w-full h-full p-4">
        {children}
      </div>
    </main>
  );
}

interface AuthCardProps {
  children: ReactNode;
}

export function AuthCard({ children }: AuthCardProps): ReactElement {
  return (
    <div className="w-full max-w-sm p-8 space-y-6 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl">
      {children}
    </div>
  );
}

interface AuthHeaderProps {
  icone: ReactNode;
  titulo: string;
  subtitulo: string;
}

export function AuthHeader({
  icone,
  titulo,
  subtitulo,
}: AuthHeaderProps): ReactElement {
  return (
    <div className="text-center">
      <div className="inline-flex w-14 h-14 rounded-xl bg-[#FFD60A] items-center justify-center mb-3 shadow-lg shadow-yellow-500/30">
        {icone}
      </div>
      <h2 className="text-3xl font-bold text-white">{titulo}</h2>
      <p className="mt-2 text-sm text-gray-300">{subtitulo}</p>
    </div>
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
}

/**
 * Input com floating label e ícone (estilo consistente com o login glassmorphism).
 */
export function FloatingField({
  id,
  label,
  icone,
  type = "text",
  value,
  onChange,
  placeholder = "",
  required = false,
}: FloatingFieldProps): ReactElement {
  return (
    <div className="relative z-0">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-300/60 appearance-none focus:outline-none focus:ring-0 focus:border-[#FFD60A] peer placeholder-transparent"
        placeholder={placeholder}
        required={required}
      />
      <label
        htmlFor={id}
        className="absolute text-sm text-gray-300 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-[#FFD60A] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
      >
        <span className="inline-flex items-center mr-2 -mt-1">{icone}</span>
        {label}
      </label>
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

export function PrimaryButton({
  type = "submit",
  onClick,
  carregando = false,
  carregandoTexto,
  texto,
  icone,
}: PrimaryButtonProps): ReactElement {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={carregando}
      className="group w-full flex items-center justify-center py-3 px-4 bg-[#FFD60A] hover:bg-yellow-400 rounded-lg text-[#0D1B2A] font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0D1B2A] focus:ring-[#FFD60A] transition-all duration-300 disabled:opacity-60 shadow-lg shadow-yellow-500/20"
    >
      {carregando ? carregandoTexto : texto}
      {icone}
    </button>
  );
}
