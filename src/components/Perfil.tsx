import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import type { User } from "@supabase/supabase-js";
import { Mail, User as IconUser, Save, X, Camera, Trash2 } from "lucide-react";
import { supabase } from "../supabase";
import { useToast } from "./ui/toast";

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    (usuario.user_metadata?.avatar_url as string | undefined) || null
  );
  const [carregando, setCarregando] = useState(false);
  const [enviandoAvatar, setEnviandoAvatar] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const { mostrarToast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleSelecionarArquivo(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      mostrarToast("Formato inválido. Use PNG, JPG ou WEBP.", "alerta");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      mostrarToast("Arquivo muito grande. Máximo 3MB.", "alerta");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setEnviandoAvatar(true);
    try {
      const extensao = file.name.split(".").pop() || "png";
      const caminho = `${usuario.id}/avatar-${Date.now()}.${extensao}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(caminho, file, { cacheControl: "3600", upsert: true });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(caminho);

      const url = urlData.publicUrl;

      // Atualiza o user_metadata com a URL do avatar
      const { data, error } = await supabase.auth.updateUser({
        data: {
          ...(usuario.user_metadata || {}),
          avatar_url: url,
        },
      });

      if (error) throw new Error(error.message);

      if (data.user) {
        setAvatarUrl(url);
        aoAtualizar(data.user);
        mostrarToast("Foto atualizada!", "sucesso");
      }
    } catch (error) {
      console.error(error);
      const mensagem =
        error instanceof Error
          ? error.message
          : "Erro ao enviar foto.";
      mostrarToast(mensagem, "erro");
    } finally {
      setEnviandoAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoverAvatar() {
    if (!avatarUrl) return;
    if (!confirm("Remover sua foto de perfil?")) return;

    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          ...(usuario.user_metadata || {}),
          avatar_url: null,
        },
      });

      if (error) throw new Error(error.message);

      if (data.user) {
        setAvatarUrl(null);
        aoAtualizar(data.user);
        mostrarToast("Foto removida.", "sucesso");
      }
    } catch (error) {
      console.error(error);
      mostrarToast("Erro ao remover foto.", "erro");
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      mostrarToast("Digite seu nome.", "alerta");
      return;
    }

    setCarregando(true);

    const { data, error } = await supabase.auth.updateUser({
      data: {
        ...(usuario.user_metadata || {}),
        nome: nome.trim(),
      },
    });

    setCarregando(false);

    if (error) {
      mostrarToast(error.message, "erro");
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
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFD60A] to-yellow-500 text-[#0D1B2A] font-bold text-2xl flex items-center justify-center shadow-lg overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  iniciais(nome, usuario.email || "")
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={enviandoAvatar}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#FFD60A] text-[#0D1B2A] flex items-center justify-center shadow-lg hover:bg-yellow-400 transition disabled:opacity-60 border-2 border-[#0D1B2A]"
                title="Alterar foto"
                aria-label="Alterar foto de perfil"
              >
                {enviandoAvatar ? (
                  <div className="w-4 h-4 border-2 border-[#0D1B2A]/30 border-t-[#0D1B2A] rounded-full animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleSelecionarArquivo}
                className="hidden"
                aria-label="Selecionar foto de perfil"
              />
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
          {avatarUrl && (
            <button
              type="button"
              onClick={handleRemoverAvatar}
              className="mt-3 text-xs text-gray-300 hover:text-white inline-flex items-center gap-1 transition"
            >
              <Trash2 className="w-3 h-3" />
              Remover foto
            </button>
          )}
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
