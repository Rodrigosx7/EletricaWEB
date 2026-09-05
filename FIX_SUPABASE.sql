-- ============================================
-- SCRIPT DEFINITIVO DE SETUP SUPABASE
-- EletricaWEB — à prova de balas
-- Idempotente (pode rodar várias vezes)
-- Resolve: 403 forbidden, permission denied on sequence,
--          policy missing, table missing, etc
-- ============================================

-- ============================================
-- FASE 1: SCHEMAS
-- ============================================

grant usage on schema public to postgres;
grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant usage on schema storage to postgres;
grant usage on schema storage to anon;
grant usage on schema storage to authenticated;

-- ============================================
-- FASE 2: TABELAS (cria se não existir)
-- ============================================

create table if not exists public.clientes (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  nome text not null,
  telefone text,
  email text,
  endereco text,
  created_at timestamptz default now()
);

create table if not exists public.servicos (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  nome text not null,
  categoria text,
  descricao text,
  preco numeric(12, 2) default 0,
  created_at timestamptz default now()
);

create table if not exists public.produtos (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  nome text not null,
  categoria text,
  preco_custo numeric(12, 2) default 0,
  preco_venda numeric(12, 2) default 0,
  unidade text default 'un',
  estoque numeric(12, 3) default 0,
  estoque_minimo numeric(12, 3) default 0,
  codigo text,
  fornecedor text,
  created_at timestamptz default now()
);

create table if not exists public.orcamentos (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  numero integer not null,
  cliente_id bigint references public.clientes(id) on delete cascade,
  data_orcamento date default current_date,
  validade date,
  status text default 'Pendente',
  desconto numeric(12, 2) default 0,
  valor_total numeric(12, 2) default 0,
  observacoes text,
  created_at timestamptz default now()
);

create table if not exists public.orcamento_itens (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  orcamento_id bigint references public.orcamentos(id) on delete cascade,
  tipo text not null check (tipo in ('servico', 'produto')),
  servico_id bigint references public.servicos(id),
  produto_id bigint references public.produtos(id),
  descricao text not null,
  quantidade numeric(12, 3) default 1,
  valor_unitario numeric(12, 2) default 0,
  subtotal numeric(12, 2) default 0
);

create table if not exists public.ordens_servico (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  numero integer not null,
  cliente_id bigint references public.clientes(id),
  orcamento_id bigint references public.orcamentos(id),
  data_abertura date default current_date,
  data_inicio date,
  data_previsao date,
  data_conclusao date,
  status text default 'Aberta',
  descricao text,
  observacoes text,
  valor_servico numeric(12, 2) default 0,
  custo_materiais numeric(12, 2) default 0,
  valor_total numeric(12, 2) default 0,
  created_at timestamptz default now()
);

create table if not exists public.ordem_servico_itens (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  ordem_servico_id bigint references public.ordens_servico(id) on delete cascade,
  tipo text not null check (tipo in ('servico', 'produto')),
  servico_id bigint references public.servicos(id),
  produto_id bigint references public.produtos(id),
  descricao text not null,
  quantidade numeric(12, 3) default 1,
  valor_unitario numeric(12, 2) default 0,
  subtotal numeric(12, 2) default 0
);

-- ============================================
-- FASE 3: GRANTs nas TABELAS
-- ============================================

grant select, insert, update, delete on table public.clientes to authenticated;
grant select, insert, update, delete on table public.servicos to authenticated;
grant select, insert, update, delete on table public.produtos to authenticated;
grant select, insert, update, delete on table public.orcamentos to authenticated;
grant select, insert, update, delete on table public.orcamento_itens to authenticated;
grant select, insert, update, delete on table public.ordens_servico to authenticated;
grant select, insert, update, delete on table public.ordem_servico_itens to authenticated;

-- ============================================
-- FASE 4: GRANTs nas SEQUENCES (ESSENCIAL para bigserial)
-- Resolve "permission denied for sequence X_id_seq"
-- ============================================

grant usage, select on all sequences in schema public to authenticated;
grant usage, select on all sequences in schema public to anon;
grant usage, select on all sequences in schema public to postgres;

-- ============================================
-- FASE 5: RLS + Policies
-- ============================================

alter table public.clientes enable row level security;
alter table public.servicos enable row level security;
alter table public.produtos enable row level security;
alter table public.orcamentos enable row level security;
alter table public.orcamento_itens enable row level security;
alter table public.ordens_servico enable row level security;
alter table public.ordem_servico_itens enable row level security;

-- Drop policies antigas (se existirem)
drop policy if exists "Users can manage own clientes" on public.clientes;
drop policy if exists "Users can manage own servicos" on public.servicos;
drop policy if exists "Users can manage own produtos" on public.produtos;
drop policy if exists "Users can manage own orcamentos" on public.orcamentos;
drop policy if exists "Users can manage own orcamento_itens" on public.orcamento_itens;
drop policy if exists "Users can manage own ordens_servico" on public.ordens_servico;
drop policy if exists "Users can manage own ordem_servico_itens" on public.ordem_servico_itens;

-- Cria policies novas (permissão total para os próprios dados)
create policy "Users can manage own clientes"
  on public.clientes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own servicos"
  on public.servicos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own produtos"
  on public.produtos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own orcamentos"
  on public.orcamentos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own orcamento_itens"
  on public.orcamento_itens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own ordens_servico"
  on public.ordens_servico for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own ordem_servico_itens"
  on public.ordem_servico_itens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================
-- FIM
-- ============================================

select 'Setup completo aplicado' as status;
