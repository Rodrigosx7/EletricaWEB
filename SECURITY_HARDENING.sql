-- Aplicar no SQL Editor do Supabase existente, após backup.
-- Requer as tabelas criadas por FEATURES_FINAL.sql, ESTOQUE_SETUP.sql e SETUP_SUPABASE.sql.
begin;

-- Históricos são escritos apenas pelos triggers/funções do banco.
alter table public.historico_status_os enable row level security;
drop policy if exists "Users can manage own hist_status_os" on public.historico_status_os;
drop policy if exists "Users can read own hist_status_os" on public.historico_status_os;
create policy "Users can read own hist_status_os"
  on public.historico_status_os for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.historico_status_os from public, anon, authenticated;
grant select on public.historico_status_os to authenticated;
revoke usage, select on sequence public.historico_status_os_id_seq from public, anon, authenticated;

alter table public.estoque_movimentacoes enable row level security;
drop policy if exists "Users can manage own estoque_mov" on public.estoque_movimentacoes;
drop policy if exists "Users can read own estoque_mov" on public.estoque_movimentacoes;
create policy "Users can read own estoque_mov"
  on public.estoque_movimentacoes for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.estoque_movimentacoes from public, anon, authenticated;
grant select on public.estoque_movimentacoes to authenticated;
revoke usage, select on sequence public.estoque_movimentacoes_id_seq from public, anon, authenticated;

-- Limites reais no Storage; checagens do navegador não bastam.
update storage.buckets set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'logos';
update storage.buckets set
  file_size_limit = 3145728,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'avatars';

commit;
