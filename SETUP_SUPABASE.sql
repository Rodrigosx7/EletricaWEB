-- ============================================
-- ROTEIRO COMPLETO DE SETUP DO SUPABASE v2
-- Para o projeto EletricaWEB
-- Cole tudo de uma vez no SQL Editor e clique RUN
-- ============================================

-- ============================================
-- PARTE 1: TABELAS BASE DO SISTEMA
-- ============================================

-- Tabela clientes
create table if not exists public.clientes (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  nome text not null,
  telefone text,
  email text,
  endereco text,
  created_at timestamptz default now()
);
alter table public.clientes enable row level security;

-- Tabela servicos
create table if not exists public.servicos (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  nome text not null,
  categoria text,
  descricao text,
  preco numeric(12, 2) default 0,
  created_at timestamptz default now()
);
alter table public.servicos enable row level security;

-- Tabela produtos
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
alter table public.produtos enable row level security;

-- Tabela orcamentos
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
alter table public.orcamentos enable row level security;

-- Tabela orcamento_itens
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
alter table public.orcamento_itens enable row level security;

-- Tabela ordens_servico
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
alter table public.ordens_servico enable row level security;

-- Tabela ordem_servico_itens
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
alter table public.ordem_servico_itens enable row level security;

-- ============================================
-- PARTE 2: POLICIES RLS (cada user só vê os próprios dados)
-- ============================================

-- clientes
drop policy if exists "Users can manage own clientes" on public.clientes;
create policy "Users can manage own clientes"
  on public.clientes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- servicos
drop policy if exists "Users can manage own servicos" on public.servicos;
create policy "Users can manage own servicos"
  on public.servicos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- produtos
drop policy if exists "Users can manage own produtos" on public.produtos;
create policy "Users can manage own produtos"
  on public.produtos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- orcamentos
drop policy if exists "Users can manage own orcamentos" on public.orcamentos;
create policy "Users can manage own orcamentos"
  on public.orcamentos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- orcamento_itens
drop policy if exists "Users can manage own orcamento_itens" on public.orcamento_itens;
create policy "Users can manage own orcamento_itens"
  on public.orcamento_itens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ordens_servico
drop policy if exists "Users can manage own ordens_servico" on public.ordens_servico;
create policy "Users can manage own ordens_servico"
  on public.ordens_servico for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ordem_servico_itens
drop policy if exists "Users can manage own ordem_servico_itens" on public.ordem_servico_itens;
create policy "Users can manage own ordem_servico_itens"
  on public.ordem_servico_itens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================
-- PARTE 3: TABELA EMPRESAS + TRIGGER
-- ============================================

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  nome text not null default 'Minha Empresa',
  slogan text,
  logo_url text,
  cor_primaria text default '#FFD60A',
  cor_secundaria text default '#0D1B2A',
  email_contato text,
  telefone_contato text,
  cnpj text,
  endereco text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.empresas enable row level security;

drop policy if exists "Users can read own empresa" on public.empresas;
create policy "Users can read own empresa"
  on public.empresas for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own empresa" on public.empresas;
create policy "Users can insert own empresa"
  on public.empresas for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own empresa" on public.empresas;
create policy "Users can update own empresa"
  on public.empresas for update
  using (auth.uid() = user_id);

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

drop trigger if exists on_user_created on auth.users;
create trigger on_user_created
  after insert on auth.users
  for each row execute function public.criar_empresa_padrao();

grant usage on schema public to postgres;
grant all on table public.empresas to postgres;

-- ============================================
-- PARTE 4: STORAGE BUCKETS (logos + avatars)
-- ============================================

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

grant usage on schema storage to authenticated;

drop policy if exists "Users upload own logo" on storage.objects;
create policy "Users upload own logo"
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users update own logo" on storage.objects;
create policy "Users update own logo"
  on storage.objects for update
  using (
    bucket_id = 'logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Logos are publicly readable" on storage.objects;
create policy "Logos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'logos');

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- ============================================
-- PARTE 5: TABELA MOVIMENTACOES (Financeiro)
-- ============================================

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

-- ============================================
-- PARTE 6: GRANTS PARA AS TABELAS DO SISTEMA
-- ============================================

grant select, insert, update, delete on table public.clientes to authenticated;
grant select, insert, update, delete on table public.servicos to authenticated;
grant select, insert, update, delete on table public.produtos to authenticated;
grant select, insert, update, delete on table public.orcamentos to authenticated;
grant select, insert, update, delete on table public.orcamento_itens to authenticated;
grant select, insert, update, delete on table public.ordens_servico to authenticated;
grant select, insert, update, delete on table public.ordem_servico_itens to authenticated;
grant select, insert, update, delete on table public.empresas to authenticated;
grant select, insert, update, delete on table public.movimentacoes to authenticated;

-- ============================================
-- FIM
-- ============================================

select 'Setup completo! ✓' as status;
