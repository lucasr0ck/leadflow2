-- =====================================================
-- CRIAR TEAM MANUALMENTE PARA O USUÁRIO
-- =====================================================

-- 1. Pegar o ID do usuário atual
SELECT id, email FROM auth.users WHERE email = 'multiumcursosltda@gmail.com';

-- 2. CRIAR UM TEAM para esse usuário
-- Substitua USER_ID_AQUI pelo id retornado na query acima
INSERT INTO teams (id, team_name, owner_id, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Multium Cursos',
  'e3df4e90-a293-4c58-a028-8c5d95b8fecd',  -- SEU USER ID
  now(),
  now()
)
RETURNING *;

-- 3. CRIAR team_member para esse team
INSERT INTO team_members (id, team_id, user_id, role, created_at)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM teams WHERE owner_id = 'e3df4e90-a293-4c58-a028-8c5d95b8fecd' ORDER BY created_at DESC LIMIT 1),
  'e3df4e90-a293-4c58-a028-8c5d95b8fecd',  -- SEU USER ID
  'owner',
  now()
)
RETURNING *;

-- 4. VERIFICAR se foi criado
SELECT 
  t.id,
  t.team_name,
  t.owner_id,
  tm.role,
  tm.user_id
FROM teams t
LEFT JOIN team_members tm ON t.id = tm.team_id
WHERE t.owner_id = 'e3df4e90-a293-4c58-a028-8c5d95b8fecd';

-- 5. Mensagem
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Team criado manualmente!';
  RAISE NOTICE 'Faça hard refresh na aplicação (Cmd+Shift+R)';
  RAISE NOTICE '========================================';
END $$;
