-- =====================================================
-- TESTE: Verificar se o usuário tem acesso aos sellers
-- =====================================================
-- Execute este SQL no Supabase SQL Editor

-- 1. Ver que usuário está logado (substitua pelo seu email)
SELECT id, email FROM auth.users WHERE email LIKE '%seu-email%';

-- 2. Ver que team_id está sendo usado
SELECT * FROM teams ORDER BY created_at DESC LIMIT 1;

-- 3. Ver se existem sellers nesse team
SELECT * FROM sellers 
WHERE team_id = 'c21197f3-f524-44c9-a999-c8bc96c577f8'
LIMIT 5;

-- 4. Ver se o usuário tem permissão no team_members
SELECT * FROM team_members 
WHERE team_id = 'c21197f3-f524-44c9-a999-c8bc96c577f8';

-- 5. TESTE CRÍTICO: Simular a query que está falhando
-- Execute isso conectado como o usuário (use o Supabase Table Editor)
-- Se funcionar aqui mas falhar no front, é problema de build/env vars
