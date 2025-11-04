-- ============================================================================
-- VERSÃO SIMPLIFICADA: Criar operações manualmente
-- ============================================================================
-- Use esta query se a automática não funcionar
-- ============================================================================

-- 1. IDENTIFICAR SEU USER_ID (execute primeiro e copie o resultado)
SELECT id, email FROM auth.users WHERE email = 'multiumcursolida@gmail.com';
-- ✏️ Copie o ID que aparecer

-- 2. CRIAR AS DUAS OPERAÇÕES (substitua USER_ID_AQUI pelo ID copiado acima)
INSERT INTO teams (team_name, slug, description, owner_id, is_active)
VALUES 
  ('Caio Martins', 'caio-martins', 'Operação principal', 'USER_ID_AQUI', true),
  ('Gustavo de Castro', 'gustavo-de-castro', 'Operação secundária', 'USER_ID_AQUI', true)
ON CONFLICT (slug) DO NOTHING;

-- 3. VERIFICAR OPERAÇÕES CRIADAS
SELECT id, team_name, slug FROM teams;
-- ✏️ Copie os IDs das duas operações

-- 4. ASSOCIAR VOCÊ ÀS OPERAÇÕES (substitua os IDs)
INSERT INTO team_members (team_id, user_id, role)
VALUES 
  ('TEAM_CAIO_ID_AQUI', 'USER_ID_AQUI', 'owner'),
  ('TEAM_GUSTAVO_ID_AQUI', 'USER_ID_AQUI', 'owner')
ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'owner';

-- 5. ATUALIZAR CAMPANHAS PARA CAIO MARTINS (substitua TEAM_CAIO_ID)
UPDATE campaigns
SET 
  team_id = 'TEAM_CAIO_ID_AQUI',
  full_slug = 'caio-martins-' || slug
WHERE name NOT LIKE '%2%'
AND (full_slug IS NULL OR full_slug = '');

-- 6. ATUALIZAR CAMPANHAS PARA GUSTAVO DE CASTRO (substitua TEAM_GUSTAVO_ID)
UPDATE campaigns
SET 
  team_id = 'TEAM_GUSTAVO_ID_AQUI',
  full_slug = 'gustavo-de-castro-' || REPLACE(slug, '2', '')
WHERE name LIKE '%2%'
AND (full_slug IS NULL OR full_slug = '');

-- 7. ATUALIZAR VENDEDORES PARA CAIO MARTINS
UPDATE sellers
SET team_id = 'TEAM_CAIO_ID_AQUI'
WHERE name NOT LIKE '%2%';

-- 8. ATUALIZAR VENDEDORES PARA GUSTAVO DE CASTRO
UPDATE sellers
SET team_id = 'TEAM_GUSTAVO_ID_AQUI'
WHERE name LIKE '%2%';

-- 9. ATUALIZAR CLICKS
UPDATE clicks cl
SET team_id = c.team_id
FROM campaigns c
WHERE cl.campaign_id = c.id;

-- 10. VERIFICAR RESULTADO
SELECT 
  t.team_name,
  (SELECT COUNT(*) FROM sellers WHERE team_id = t.id) as sellers,
  (SELECT COUNT(*) FROM campaigns WHERE team_id = t.id) as campaigns,
  (SELECT COUNT(*) FROM clicks WHERE team_id = t.id) as clicks
FROM teams t
ORDER BY t.team_name;
