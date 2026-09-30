-- Execute no SQL Editor do Supabase antes de ativar o botão de solicitação.
-- A exclusão é revisada manualmente; esta tabela não apaga dados por conta própria.
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  requested_at timestamptz not null default now(),
  status text not null default 'requested' check (status in ('requested', 'in_review', 'completed', 'rejected'))
);

create unique index if not exists account_deletion_one_active_request
  on public.account_deletion_requests (user_id)
  where status in ('requested', 'in_review');

alter table public.account_deletion_requests enable row level security;

drop policy if exists "Users can read own deletion request" on public.account_deletion_requests;
create policy "Users can read own deletion request" on public.account_deletion_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can request own deletion" on public.account_deletion_requests;
create policy "Users can request own deletion" on public.account_deletion_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'requested');

revoke all on public.account_deletion_requests from anon;
revoke all on public.account_deletion_requests from authenticated;
grant select on public.account_deletion_requests to authenticated;
grant insert (user_id) on public.account_deletion_requests to authenticated;
