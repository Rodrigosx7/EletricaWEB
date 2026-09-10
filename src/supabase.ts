import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Supabase 2.x: as novas API keys são "publishable" (sb_publishable_...)
// em vez de "anon". O @supabase/supabase-js aceita ambas — só precisa
// referenciar o nome correto aqui.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Em produção (Netlify), os valores vêm de "Site settings → Environment variables".
// Em dev, vêm do .env/.env.local. Se faltar, mostramos um erro legível na tela
// em vez de tela em branco.
function criarClienteStub(): SupabaseClient {
  const mensagem =
    "⚠️ Configuração do Supabase ausente.\n\n" +
    "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.\n\n" +
    "Local: crie um arquivo .env na raiz com:\n" +
    "VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co\n" +
    "VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...\n\n" +
    "Netlify: Site settings → Environment variables → adicione as mesmas chaves."

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