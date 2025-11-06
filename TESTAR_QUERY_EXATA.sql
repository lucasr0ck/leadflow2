-- =====================================================
-- TESTAR A QUERY EXATA QUE O CÓDIGO ESTÁ FAZENDO
-- =====================================================

-- Esta é a QUERY EXATA que o frontend está executando
SELECT id, team_name, owner_id, created_at
FROM teams
WHERE owner_id = 'e3df4e90-a293-4c58-a028-8c5d95b8fecd';

-- Se a query acima funcionar, o problema pode ser nas FOREIGN KEYS ou TRIGGERS
-- Vamos verificar se há triggers na tabela teams:
SELECT 
    tgname as trigger_name,
    tgtype as trigger_type,
    tgenabled as enabled
FROM pg_trigger
WHERE tgrelid = 'teams'::regclass
  AND tgname NOT LIKE 'pg_%';

-- Verificar se há foreign keys problemáticas:
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'teams'
  AND tc.constraint_type = 'FOREIGN KEY';
