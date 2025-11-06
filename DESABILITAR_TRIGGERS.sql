-- =====================================================
-- REMOVER TODOS OS TRIGGERS QUE PODEM CAUSAR 500
-- =====================================================

-- 1. Ver todos os triggers nas tabelas problemáticas
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled
FROM pg_trigger
WHERE tgrelid::regclass::text IN ('teams', 'team_members', 'sellers', 'campaigns')
  AND tgname NOT LIKE 'pg_%'
  AND tgname NOT LIKE 'RI_%';

-- 2. DESABILITAR todos os triggers (exceto system triggers)
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    FOR trigger_record IN 
        SELECT tgname, tgrelid::regclass::text as table_name
        FROM pg_trigger
        WHERE tgrelid::regclass::text IN ('teams', 'team_members', 'sellers', 'campaigns')
          AND tgname NOT LIKE 'pg_%'
          AND tgname NOT LIKE 'RI_%'
    LOOP
        EXECUTE format('ALTER TABLE %I DISABLE TRIGGER %I', trigger_record.table_name, trigger_record.tgname);
        RAISE NOTICE 'Desabilitado trigger % na tabela %', trigger_record.tgname, trigger_record.table_name;
    END LOOP;
END $$;

-- 3. Verificar se foram desabilitados
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    CASE tgenabled
        WHEN 'O' THEN 'ENABLED'
        WHEN 'D' THEN 'DISABLED'
        ELSE 'UNKNOWN'
    END as status
FROM pg_trigger
WHERE tgrelid::regclass::text IN ('teams', 'team_members', 'sellers', 'campaigns')
  AND tgname NOT LIKE 'pg_%'
  AND tgname NOT LIKE 'RI_%';

-- Mensagem
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Triggers desabilitados!';
  RAISE NOTICE 'Tente acessar a aplicação novamente';
  RAISE NOTICE '========================================';
END $$;
