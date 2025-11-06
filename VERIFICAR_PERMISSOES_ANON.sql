-- =====================================================
-- VERIFICAR PERMISSÕES DA ANON KEY
-- =====================================================

-- 1. Ver qual role está sendo usado (deve mostrar 'anon' quando usar ANON_KEY)
SELECT current_user, session_user;

-- 2. Ver permissões da role 'anon' na tabela teams
SELECT 
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'teams'
  AND grantee IN ('anon', 'authenticated', 'public');

-- 3. Verificar se há GRANT específico
SELECT 
    tablename,
    has_table_privilege('anon', 'teams', 'SELECT') as anon_can_select,
    has_table_privilege('authenticated', 'teams', 'SELECT') as auth_can_select;

-- 4. SE não houver permissão, CONCEDER explicitamente:
GRANT SELECT ON teams TO anon;
GRANT SELECT ON teams TO authenticated;
GRANT SELECT ON team_members TO anon;
GRANT SELECT ON team_members TO authenticated;

-- 5. VERIFICAR NOVAMENTE
SELECT 
    tablename,
    has_table_privilege('anon', 'teams', 'SELECT') as anon_can_select,
    has_table_privilege('authenticated', 'teams', 'SELECT') as auth_can_select
FROM pg_tables
WHERE tablename = 'teams';
