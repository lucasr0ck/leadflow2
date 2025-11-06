-- =====================================================
-- VERIFICAR SE HÁ DADOS NO BANCO
-- =====================================================

-- 1. Verificar se o usuário existe
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'multiumcursosltda@gmail.com';

-- 2. Verificar se há teams no banco
SELECT * FROM teams LIMIT 10;

-- 3. Verificar se há team_members no banco
SELECT * FROM team_members LIMIT 10;

-- 4. Contar registros
SELECT 
  'teams' as tabela,
  COUNT(*) as total
FROM teams
UNION ALL
SELECT 
  'team_members' as tabela,
  COUNT(*) as total
FROM team_members
UNION ALL
SELECT 
  'sellers' as tabela,
  COUNT(*) as total
FROM sellers
UNION ALL
SELECT 
  'campaigns' as tabela,
  COUNT(*) as total
FROM campaigns;

-- 5. SE NÃO HOUVER TEAMS, CRIAR UM TEAM DE TESTE
-- Substitua 'USER_ID_AQUI' pelo ID do seu usuário (resultado da query 1)
/*
INSERT INTO teams (id, team_name, owner_id, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Multium Cursos',
  'USER_ID_AQUI',  -- SUBSTITUA PELO SEU USER ID
  now(),
  now()
);
*/

-- 6. DEPOIS, criar team_member
/*
INSERT INTO team_members (id, team_id, user_id, role, created_at)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM teams WHERE owner_id = 'USER_ID_AQUI' LIMIT 1),
  'USER_ID_AQUI',  -- SUBSTITUA PELO SEU USER ID
  'owner',
  now()
);
*/
