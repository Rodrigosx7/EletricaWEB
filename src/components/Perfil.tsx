import {
  useEffect,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import type { User } from "@supabase/supabase-js";
import { Mail, User as IconUser, Save, X } from "lucide-react";
import { supabase } from "../supabase";

type PerfilProps = {
  usuario: User;
  aoFechar: () => void;
  aoAtualizar: (usuario: User) => void;
};

function iniciais(nome: string | undefined | null, email: string): string {
  if (nome && nome.trim()) {
    const partes = nome.trim().split(/\s+/);
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }
  return (email[0] || "U").toUpperCase();
}

export default function Perfil({
  usuario,
  aoFechar,
  aoAtualizar,
}: PerfilProps): ReactElement {
  const [nome, setNome] = useState(
    (usuario.user_metadata?.nome as string | undefined) || ""
  );
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    function teclaEsc(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
    }
    window.addEventListener("keydown", teclaEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", teclaEsc);
      document.body.style.overflow = "";
    };
  }, [aoFechar]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      alert("Digite seu nome.");
      return;
    }

    setCarregando(true);

    const { data, error } = await supabase.auth.updateUser({
      data: { nome: nome.trim() },
    });

    setCarregando(false);

    if (error) {
      alert(error.message);
      return;
    }

    if (data.user) {
      aoAtualizar(data.user);
      setSucesso(true);
      setTimeout(aoFechar, 800);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={aoFechar}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho com gradiente */}
        <div className="bg-gradient-to-br from-[#0D1B2A] to-[#1a2f47] p-6 text-white relative">
          <button
            onClick={aoFechar}
            className="absolute top-4 right-4 text-gray-300 hover:text-white transition"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFD60A] to-yellow-500 text-[#0D1B2A] font-bold text-xl flex items-center justify-center shrink-0 shadow-lg">
              {iniciais(nome, usuario.email || "")}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold truncate">
                {nome || "Seu perfil"}
              </h2>
              <p className="text-sm text-gray-300 truncate">
                {usuario.email}
              </p>
            </div>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={salvar} className="p-6 space-y-5">
          <div>
            <label
              htmlFor="perfil_nome"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              Nome
            </label>
            <div className="relative">
              <IconUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <input
                id="perfil_nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD60A]/50 focus:border-[#FFD60A] text-gray-900 transition"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="perfil_email"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <input
                id="perfil_email"
                type="email"
                value={usuario.email || ""}
                disabled
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              O e-mail não pode ser alterado por aqui.
            </p>
          </div>

          {sucesso && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
              Perfil atualizado com sucesso!
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={aoFechar}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={carregando}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#FFD60A] hover:bg-yellow-400 rounded-lg text-[#0D1B2A] font-bold transition disabled:opacity-60 shadow-lg shadow-yellow-500/20"
            >
              {carregando ? (
                <div className="w-5 h-5 border-2 border-[#0D1B2A]/30 border-t-[#0D1B2A] rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
