-- Execute no Supabase antes de habilitar a emissão fiscal no Netlify.
-- Apenas a função de servidor, usando service_role, pode acessar esta tabela.
create table if not exists public.notaas_requests (
  user_id uuid not null references auth.users(id),
  draft_id uuid not null,
  status text not null check (status in ('reserved', 'rejected', 'queued', 'processing', 'issued', 'cancelled', 'error')),
  invoice_id text unique,
  created_at timestamptz not null default now(),
  primary key (user_id, draft_id)
);

create index if not exists idx_notaas_requests_owner_invoice
  on public.notaas_requests (user_id, invoice_id);

alter table public.notaas_requests enable row level security;
revoke all on public.notaas_requests from anon, authenticated;
grant select, insert, update on public.notaas_requests to service_role;
