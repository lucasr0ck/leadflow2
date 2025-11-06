-- =====================================================
-- DESABILITAR RLS COMPLETAMENTE - ACESSO TOTAL
-- =====================================================
-- ⚠️ ATENÇÃO: Isso remove TODAS as restrições!
-- Use apenas em desenvolvimento/teste
-- =====================================================

-- 🔥 PASSO 1: DESABILITAR RLS em TODAS as tabelas
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE sellers DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE seller_contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE clicks DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- 🔥 PASSO 2: REMOVER TODAS as políticas existentes
DO $$
DECLARE
    policy_record RECORD;
    table_list TEXT[] := ARRAY['teams', 'team_members', 'sellers', 'campaigns', 'seller_contacts', 'clicks', 'audit_logs'];
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY table_list
    LOOP
        FOR policy_record IN 
            EXECUTE format('SELECT policyname FROM pg_policies WHERE tablename = %L', table_name)
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_record.policyname, table_name);
            RAISE NOTICE 'Removida política % da tabela %', policy_record.policyname, table_name;
        END LOOP;
    END LOOP;
END $$;

-- 🔥 PASSO 3: GARANTIR que authenticated users têm acesso
-- (Mesmo com RLS desabilitado, é bom garantir)
GRANT ALL ON teams TO authenticated;
GRANT ALL ON team_members TO authenticated;
GRANT ALL ON sellers TO authenticated;
GRANT ALL ON campaigns TO authenticated;
GRANT ALL ON seller_contacts TO authenticated;
GRANT ALL ON clicks TO authenticated;
GRANT ALL ON audit_logs TO authenticated;

GRANT ALL ON teams TO anon;
GRANT ALL ON team_members TO anon;
GRANT ALL ON sellers TO anon;
GRANT ALL ON campaigns TO anon;
GRANT ALL ON seller_contacts TO anon;
GRANT ALL ON clicks TO anon;
GRANT ALL ON audit_logs TO anon;

-- 🔥 PASSO 4: Verificar status
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE pg_policies.tablename = pg_tables.tablename) as policy_count
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('teams', 'team_members', 'sellers', 'campaigns', 'seller_contacts', 'clicks', 'audit_logs')
ORDER BY tablename;

-- Mensagem final
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS COMPLETAMENTE DESABILITADO!';
  RAISE NOTICE '✅ Todas as políticas removidas';
  RAISE NOTICE '✅ Acesso total concedido';
  RAISE NOTICE '⚠️  ATENÇÃO: Sem proteção de dados!';
  RAISE NOTICE '========================================';
END $$;
