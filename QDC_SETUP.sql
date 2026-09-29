-- Execute no Supabase para habilitar a sincronização dos quadros.
create table if not exists public.qdc_projetos (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  dados jsonb not null check (jsonb_typeof(dados) = 'object'),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, project_id)
);

create index if not exists idx_qdc_projetos_user_updated
  on public.qdc_projetos (user_id, updated_at desc);

create or replace function public.qdc_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists trg_qdc_touch_updated_at on public.qdc_projetos;
create trigger trg_qdc_touch_updated_at before update on public.qdc_projetos
  for each row execute function public.qdc_touch_updated_at();

alter table public.qdc_projetos enable row level security;
drop policy if exists "Users can manage own qdc_projetos" on public.qdc_projetos;
create policy "Users can manage own qdc_projetos" on public.qdc_projetos
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.qdc_projetos from anon;
grant select, insert, update, delete on public.qdc_projetos to authenticated;
