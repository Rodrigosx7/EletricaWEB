import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Supabase 2.x introduziu as novas "publishable" keys (sb_publishable_...)
// em substituição gradual às legacy "anon" keys (eyJ...). Aceitamos ambas
// para não quebrar deploys que ainda usam o nome antigo.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY

// Em produção (Netlify), os valores vêm de "Site settings → Environment variables".
// Em dev, vêm do .env/.env.local. Se faltar, mostramos um erro legível na tela
// em vez de tela em branco.
function criarClienteStub(): SupabaseClient {
  const mensagem =
    "⚠️ Configuração do Supabase ausente.\n\n" +
    "Defina VITE_SUPABASE_URL e uma das chaves abaixo:\n" +
    "  - VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   (Supabase 2.x)\n" +
    "  - VITE_SUPABASE_ANON_KEY=eyJ...                      (legacy)\n\n" +
    "Local: crie um arquivo .env na raiz com as variáveis acima.\n\n" +
    "Netlify: Site settings → Environment variables → adicione."

  if (typeof document !== "undefined") {
    document.body.innerHTML = `<pre style="font-family:monospace;padding:2rem;color:#7f1d1d;background:#fef2f2;white-space:pre-wrap;line-height:1.5">${mensagem}</pre>`
  }
  // Retorna um cliente "vazio" apontando pra URL dummy pra não quebrar imports.
  return createClient("https://placeholder.supabase.co", "placeholder")
}

export const supabase: SupabaseClient =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
        },
      })
    : criarClienteStub()