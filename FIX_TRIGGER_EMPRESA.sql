-- ============================================
-- FIX: Trigger de criar empresa ao cadastrar usuário
-- (Faltando no projeto jhkqubzhfytkglxpwyby)
-- ============================================

-- Função que cria empresa padrão para o usuário novo
create or replace function public.criar_empresa_padrao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.empresas (user_id, nome)
  values (
    new.id,
    coalesce(
      split_part(coalesce(new.raw_user_meta_data->>'nome', ''), ' ', 1),
      'Minha Empresa'
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

grant usage on schema public to postgres;
grant all on table public.empresas to postgres;

-- Trigger que dispara a função quando um usuário é criado
drop trigger if exists on_user_created on auth.users;

create trigger on_user_created
  after insert on auth.users
  for each row execute function public.criar_empresa_padrao();
