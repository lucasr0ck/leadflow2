-- ============================================================================
-- DIAGNÓSTICO COMPLETO DO BANCO DE DADOS
-- ============================================================================
-- Execute este SQL no Supabase SQL Editor para obter informações completas
-- sobre a estrutura atual do banco de dados
-- ============================================================================

\echo '============================================================================'
\echo 'DIAGNÓSTICO COMPLETO - LEADFLOW MULTI-TENANT'
\echo '============================================================================'
\echo ''

-- ============================================================================
-- 1. LISTAR TODAS AS TABELAS DO SISTEMA
-- ============================================================================

\echo '📋 TABELAS EXISTENTES NO BANCO:'
\echo ''

SELECT 
  table_name,
  (SELECT COUNT(*) 
   FROM information_schema.columns 
   WHERE table_name = t.table_name 
   AND table_schema = 'public') as num_colunas,
  pg_size_pretty(pg_total_relation_size('"' || table_schema || '"."' || table_name || '"')) as tamanho
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

\echo ''
\echo '============================================================================'
\echo '2. ESTRUTURA DETALHADA DA TABELA CLICKS'
\echo '============================================================================'
\echo ''

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'clicks'
ORDER BY ordinal_position;

\echo ''
\echo '============================================================================'
\echo '3. ESTRUTURA DETALHADA DA TABELA CLICKS2 (SE EXISTIR)'
\echo '============================================================================'
\echo ''

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clicks2') THEN
    PERFORM column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'clicks2'
    ORDER BY ordinal_position;
  ELSE
    RAISE NOTICE '⚠️  Tabela clicks2 NÃO EXISTE';
  END IF;
END $$;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'clicks2'
ORDER BY ordinal_position;

\echo ''
\echo '============================================================================'
\echo '4. ESTRUTURA DETALHADA DA TABELA SELLERS'
\echo '============================================================================'
\echo ''

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'sellers'
ORDER BY ordinal_position;

\echo ''
\echo '============================================================================'
\echo '5. ESTRUTURA DETALHADA DA TABELA SELLERS2 (SE EXISTIR)'
\echo '============================================================================'
\echo ''

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'sellers2'
ORDER BY ordinal_position;

\echo ''
\echo '============================================================================'
\echo '6. ESTRUTURA DETALHADA DA TABELA CAMPAIGNS'
\echo '============================================================================'
\echo ''

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'campaigns'
ORDER BY ordinal_position;

\echo ''
\echo '============================================================================'
\echo '7. ESTRUTURA DETALHADA DA TABELA CAMPAIGNS2 (SE EXISTIR)'
\echo '============================================================================'
\echo ''

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'campaigns2'
ORDER BY ordinal_position;

\echo ''
\echo '============================================================================'
\echo '8. DADOS ATUAIS NAS OPERAÇÕES'
\echo '============================================================================'
\echo ''

SELECT 
  t.team_name,
  t.slug,
  t.is_active,
  (SELECT COUNT(*) FROM sellers WHERE team_id = t.id) as vendedores,
  (SELECT COUNT(*) FROM campaigns WHERE team_id = t.id) as campanhas,
  (SELECT COUNT(*) FROM clicks WHERE team_id = t.id) as clicks,
  t.created_at
FROM teams t
ORDER BY t.team_name;

\echo ''
\echo '============================================================================'
\echo '9. DADOS EM TABELAS ANTIGAS (SE EXISTIREM)'
\echo '============================================================================'
\echo ''

-- Verificar sellers2
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sellers2') THEN
    RAISE NOTICE '📊 SELLERS2: % registros', (SELECT COUNT(*) FROM sellers2);
  ELSE
    RAISE NOTICE '✅ Tabela sellers2 não existe (já migrada)';
  END IF;
END $$;

-- Verificar campaigns2
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaigns2') THEN
    RAISE NOTICE '📊 CAMPAIGNS2: % registros', (SELECT COUNT(*) FROM campaigns2);
  ELSE
    RAISE NOTICE '✅ Tabela campaigns2 não existe (já migrada)';
  END IF;
END $$;

-- Verificar clicks2
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clicks2') THEN
    RAISE NOTICE '📊 CLICKS2: % registros', (SELECT COUNT(*) FROM clicks2);
  ELSE
    RAISE NOTICE '✅ Tabela clicks2 não existe (já migrada)';
  END IF;
END $$;

-- Verificar seller_contacts2
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'seller_contacts2') THEN
    RAISE NOTICE '📊 SELLER_CONTACTS2: % registros', (SELECT COUNT(*) FROM seller_contacts2);
  ELSE
    RAISE NOTICE '✅ Tabela seller_contacts2 não existe (já migrada)';
  END IF;
END $$;

\echo ''
\echo '============================================================================'
\echo '10. FOREIGN KEYS E RELACIONAMENTOS'
\echo '============================================================================'
\echo ''

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

\echo ''
\echo '============================================================================'
\echo '11. ÍNDICES EXISTENTES'
\echo '============================================================================'
\echo ''

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

\echo ''
\echo '============================================================================'
\echo '12. POLÍTICAS RLS ATIVAS'
\echo '============================================================================'
\echo ''

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

\echo ''
\echo '============================================================================'
\echo '13. SAMPLE DE DADOS - VENDEDORES POR OPERAÇÃO'
\echo '============================================================================'
\echo ''

SELECT 
  t.team_name,
  s.name as vendedor,
  s.weight,
  (SELECT COUNT(*) FROM seller_contacts WHERE seller_id = s.id) as contatos
FROM teams t
INNER JOIN sellers s ON t.id = s.team_id
ORDER BY t.team_name, s.name;

\echo ''
\echo '============================================================================'
\echo '14. SAMPLE DE DADOS - CAMPANHAS POR OPERAÇÃO'
\echo '============================================================================'
\echo ''

SELECT 
  t.team_name,
  c.name as campanha,
  c.slug,
  c.full_slug,
  c.is_active,
  (SELECT COUNT(*) FROM clicks WHERE campaign_id = c.id) as clicks
FROM teams t
INNER JOIN campaigns c ON t.id = c.team_id
ORDER BY t.team_name, c.name;

\echo ''
\echo '============================================================================'
\echo 'DIAGNÓSTICO COMPLETO FINALIZADO'
\echo '============================================================================'
