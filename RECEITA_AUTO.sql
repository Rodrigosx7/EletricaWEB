-- ============================================
-- SISTEMA DE RECEITA AUTOMÁTICA
-- Quando uma OS é concluída, insere receita
-- automaticamente na tabela 'movimentacoes'
-- ============================================

-- FASE 1: TABELA MOVIMENTACOES (Financeiro)
create table if not exists public.movimentacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  tipo text not null check (tipo in ('receita', 'despesa')),
  categoria text not null,
  descricao text not null,
  valor numeric(12, 2) not null check (valor >= 0),
  data_movimento date not null default current_date,
  forma_pagamento text,
  observacoes text,
  ordem_servico_id bigint references public.ordens_servico(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_movimentacoes_user_data
  on public.movimentacoes (user_id, data_movimento desc);

create index if not exists idx_movimentacoes_user_tipo
  on public.movimentacoes (user_id, tipo);

alter table public.movimentacoes enable row level security;

drop policy if exists "Users can manage own movimentacoes" on public.movimentacoes;
create policy "Users can manage own movimentacoes"
  on public.movimentacoes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on table public.movimentacoes to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Trigger para updated_at
create or replace function public.atualizar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_movimentacoes_updated_at on public.movimentacoes;
create trigger trg_movimentacoes_updated_at
  before update on public.movimentacoes
  for each row execute function public.atualizar_updated_at();

-- FASE 2: FUNÇÃO QUE GERA RECEITA AUTOMÁTICA
create or replace function public.gerar_receita_os_concluida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ja_existe boolean;
begin
  -- Só processa se status mudou para "Concluída" e antes era diferente
  if new.status = 'Concluída' and (old.status is null or old.status <> 'Concluída') then

    -- Verifica se já existe receita gerada para essa OS
    select exists(
      select 1 from public.movimentacoes
      where ordem_servico_id = new.id
        and tipo = 'receita'
      limit 1
    ) into v_ja_existe;

    if v_ja_existe then
      return new;
    end if;

    -- Insere a receita automática
    if new.valor_total > 0 then
      insert into public.movimentacoes (
        user_id,
        tipo,
        categoria,
        descricao,
        valor,
        data_movimento,
        forma_pagamento,
        observacoes,
        ordem_servico_id
      ) values (
        new.user_id,
        'receita',
        'Serviço prestado',
        'Receita da OS #' || new.numero,
        new.valor_total,
        coalesce(new.data_conclusao, current_date),
        null,
        'Gerada automaticamente pela conclusão da OS',
        new.id
      );
    end if;
  end if;

  return new;
end;
$$;

-- FASE 3: TRIGGER NA TABELA ORDENS_SERVICO
drop trigger if exists trg_gerar_receita_os on public.ordens_servico;

create trigger trg_gerar_receita_os
  after update on public.ordens_servico
  for each row execute function public.gerar_receita_os_concluida();

-- ============================================
-- FIM
-- ============================================

select 'Sistema de receita automatica instalado com sucesso' as status;
