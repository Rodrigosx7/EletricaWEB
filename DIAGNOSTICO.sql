-- ============================================
-- DIAGNÓSTICO COMPLETO DO SUPABASE
-- Verifica se todas as tabelas, funções e triggers
-- estão criados e funcionando
-- Roda só leituras — não altera nada
-- ============================================

-- ============================================
-- 1. TABELAS BÁSICAS
-- ============================================
select 'TABELAS BASICAS' as categoria, table_name, 'OK' as status
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'clientes', 'servicos', 'produtos',
    'orcamentos', 'orcamento_itens',
    'ordens_servico', 'ordem_servico_itens'
  )
order by table_name;

-- ============================================
-- 2. TABELAS DE WHITE-LABEL E FINANCEIRO
-- ============================================
select 'TABELAS EXTRAS' as categoria, table_name,
  case
    when table_name = 'empresas' then 'White-label'
    when table_name = 'movimentacoes' then 'Financeiro'
    when table_name = 'estoque_movimentacoes' then 'Estoque'
    when table_name = 'historico_status_os' then 'Histórico OS'
  end as descricao,
  'OK' as status
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'empresas', 'movimentacoes',
    'estoque_movimentacoes', 'historico_status_os'
  )
order by table_name;

-- ============================================
-- 3. BUCKETS DE STORAGE
-- ============================================
select id, name, public
from storage.buckets
where id in ('logos', 'avatars')
order by id;

-- ============================================
-- 4. RLS ATIVO EM TODAS AS TABELAS
-- ============================================
select tablename,
  rowsecurity as rls_ativo
from pg_tables t
join pg_class c on c.relname = t.tablename
where t.schemaname = 'public'
  and t.tablename in (
    'clientes', 'servicos', 'produtos',
    'orcamentos', 'orcamento_itens',
    'ordens_servico', 'ordem_servico_itens',
    'empresas', 'movimentacoes',
    'estoque_movimentacoes', 'historico_status_os'
  )
order by t.tablename;

-- ============================================
-- 5. POLICIES POR TABELA
-- ============================================
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'clientes', 'servicos', 'produtos',
    'orcamentos', 'orcamento_itens',
    'ordens_servico', 'ordem_servico_itens',
    'empresas', 'movimentacoes',
    'estoque_movimentacoes', 'historico_status_os'
  )
order by tablename, policyname;

-- ============================================
-- 6. GRANTS PARA ROLE AUTHENTICATED
-- ============================================
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'authenticated'
  and table_schema = 'public'
  and table_name in (
    'clientes', 'servicos', 'produtos',
    'orcamentos', 'orcamento_itens',
    'ordens_servico', 'ordem_servico_itens',
    'empresas', 'movimentacoes',
    'estoque_movimentacoes', 'historico_status_os'
  )
order by table_name, privilege_type;

-- ============================================
-- 7. FUNÇÕES RPC EXISTENTES
-- ============================================
select routine_name, routine_type
from information_schema.routines
where routine_schema = 'public'
order by routine_name;

-- ============================================
-- 8. TRIGGERS ATIVOS
-- ============================================
select trigger_name, event_object_table, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;

-- ============================================
-- 9. SEQUENCES (bigserial precisa de acesso)
-- ============================================
select sequence_name
from information_schema.sequences
where sequence_schema = 'public'
  and sequence_name like '%_id_seq'
order by sequence_name;

-- ============================================
-- 10. TRIGGER DE CRIAR EMPRESA PADRÃO
-- ============================================
select trigger_name, event_manipulation, action_timing
from information_schema.triggers
where trigger_schema = 'auth'
  and trigger_name = 'on_user_created';

-- ============================================
-- RESUMO FINAL
-- ============================================
select
  (select count(*) from information_schema.tables
   where table_schema = 'public'
     and table_name in ('clientes','servicos','produtos','orcamentos','orcamento_itens','ordens_servico','ordem_servico_itens','empresas','movimentacoes','estoque_movimentacoes','historico_status_os')
  ) as tabelas_encontradas,
  (select count(*) from storage.buckets
   where id in ('logos','avatars')
  ) as buckets_encontrados,
  (select count(*) from information_schema.routines
   where routine_schema = 'public'
  ) as funcoes_encontradas,
  (select count(*) from information_schema.triggers
   where trigger_schema = 'public'
  ) as triggers_encontrados;
