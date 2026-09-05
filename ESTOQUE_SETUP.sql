-- ============================================
-- SISTEMA DE ESTOQUE - Movimentações e Triggers
-- EletricaWEB / Portal Elétrico
-- Idempotente (pode rodar várias vezes)
-- ============================================

-- ============================================
-- PARTE 1: TABELA ESTOQUE_MOVIMENTACOES
-- ============================================

create table if not exists public.estoque_movimentacoes (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  produto_id bigint references public.produtos(id) on delete cascade not null,
  ordem_servico_id bigint references public.ordens_servico(id) on delete set null,
  tipo text not null check (tipo in ('entrada', 'saida', 'ajuste')),
  quantidade numeric(12, 3) not null check (quantidade > 0),
  estoque_anterior numeric(12, 3) not null,
  estoque_posterior numeric(12, 3) not null,
  observacao text,
  created_at timestamptz default now()
);

create index if not exists idx_estoque_mov_user_produto
  on public.estoque_movimentacoes (user_id, produto_id);

create index if not exists idx_estoque_mov_ordem
  on public.estoque_movimentacoes (ordem_servico_id);

alter table public.estoque_movimentacoes enable row level security;

drop policy if exists "Users can manage own estoque_mov" on public.estoque_movimentacoes;
create policy "Users can manage own estoque_mov"
  on public.estoque_movimentacoes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on table public.estoque_movimentacoes to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ============================================
-- PARTE 2: FUNÇÃO PARA ATUALIZAR ESTOQUE
-- Faz a baixa/aumento E registra a movimentação numa transação
-- ============================================

create or replace function public.atualizar_estoque_produto(
  p_produto_id bigint,
  p_tipo text,
  p_quantidade numeric,
  p_observacao text default null,
  p_ordem_servico_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_estoque_atual numeric;
  v_novo_estoque numeric;
begin
  -- Pega user_id do auth
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  -- Lock no produto para evitar race condition
  select estoque
    into v_estoque_atual
    from public.produtos
   where id = p_produto_id
     and user_id = v_user_id
   for update;

  if not found then
    raise exception 'Produto % não encontrado', p_produto_id;
  end if;

  -- Calcula novo estoque baseado no tipo
  if p_tipo = 'entrada' then
    v_novo_estoque := v_estoque_atual + p_quantidade;
  elsif p_tipo = 'saida' then
    if v_estoque_atual < p_quantidade then
      raise exception 'Estoque insuficiente para o produto %. Disponível: %, Solicitado: %',
        p_produto_id, v_estoque_atual, p_quantidade;
    end if;
    v_novo_estoque := v_estoque_atual - p_quantidade;
  elsif p_tipo = 'ajuste' then
    -- ajuste: define o estoque exato (quantidade é o valor final desejado)
    v_novo_estoque := p_quantidade;
  else
    raise exception 'Tipo inválido: %. Use entrada, saida ou ajuste.', p_tipo;
  end if;

  if v_novo_estoque < 0 then
    raise exception 'Estoque não pode ficar negativo (produto %)', p_produto_id;
  end if;

  -- Atualiza o estoque do produto
  update public.produtos
     set estoque = v_novo_estoque
   where id = p_produto_id
     and user_id = v_user_id;

  -- Registra a movimentação
  insert into public.estoque_movimentacoes (
    user_id, produto_id, ordem_servico_id,
    tipo, quantidade,
    estoque_anterior, estoque_posterior,
    observacao
  ) values (
    v_user_id, p_produto_id, p_ordem_servico_id,
    p_tipo, p_quantidade,
    v_estoque_atual, v_novo_estoque,
    p_observacao
  );
end;
$$;

grant execute on function public.atualizar_estoque_produto(
  bigint, text, numeric, text, bigint
) to authenticated;

-- ============================================
-- PARTE 3: TRIGGER AUTOMÁTICO NA CONCLUSÃO DA OS
-- Quando o status da OS muda para "Concluída",
-- percorre os itens da OS e baixa o estoque de cada produto
-- ============================================

create or replace function public.baixar_estoque_os_concluida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_ja_processado boolean;
begin
  -- Só processa se status mudou para "Concluída" e antes era diferente
  if new.status = 'Concluída' and (old.status is null or old.status <> 'Concluída') then

    -- Verifica se os itens dessa OS já foram processados (evita duplicação)
    select exists(
      select 1 from public.estoque_movimentacoes
      where ordem_servico_id = new.id
        and tipo = 'saida'
      limit 1
    ) into v_ja_processado;

    if v_ja_processado then
      return new; -- já processado, não faz nada
    end if;

    -- Percorre os itens da OS
    for v_item in
      select id, produto_id, quantidade
        from public.ordem_servico_itens
       where ordem_servico_id = new.id
         and produto_id is not null
         and tipo = 'produto'
    loop
      begin
        perform public.atualizar_estoque_produto(
          v_item.produto_id,
          'saida',
          v_item.quantidade,
          'Baixa automática - OS #' || new.numero || ' concluída',
          new.id
        );
      exception when others then
        -- Log do erro mas não bloqueia a conclusão da OS
        raise warning 'Erro ao baixar estoque do produto %: %', v_item.produto_id, SQLERRM;
      end;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_baixar_estoque_os on public.ordens_servico;

create trigger trg_baixar_estoque_os
  after update on public.ordens_servico
  for each row execute function public.baixar_estoque_os_concluida();

-- ============================================
-- PARTE 4: VIEW DE ESTOQUE ATUAL
-- ============================================

create or replace view public.vw_estoque_atual as
select
  p.id,
  p.user_id,
  p.nome,
  p.estoque,
  p.estoque_minimo,
  case
    when p.estoque <= 0 then 'sem_estoque'
    when p.estoque <= p.estoque_minimo then 'baixo'
    else 'ok'
  end as status_estoque,
  p.unidade,
  p.preco_custo,
  p.preco_venda,
  (p.estoque * p.preco_custo) as valor_estoque
from public.produtos p;

grant select on public.vw_estoque_atual to authenticated;

-- ============================================
-- FIM
-- ============================================

select 'Sistema de estoque instalado com sucesso' as status;
