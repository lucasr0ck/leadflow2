-- ============================================================================
-- MIGRATION: POPULAR DADOS DAS DUAS OPERAÇÕES
-- ============================================================================
-- Cria operações Caio Martins e Gustavo de Castro com dados existentes
-- ============================================================================

-- ============================================================================
-- 1. IDENTIFICAR USUÁRIOS (você precisa ajustar os emails)
-- ============================================================================

-- Primeiro, vamos ver os usuários existentes:
DO $$
DECLARE
  v_user_caio UUID;
  v_user_gustavo UUID;
  v_team_caio UUID;
  v_team_gustavo UUID;
BEGIN
  -- Buscar ID do Caio pelo email (AJUSTE O EMAIL SE NECESSÁRIO)
  SELECT id INTO v_user_caio
  FROM auth.users
  WHERE email = 'multiumcursoltda@gmail.com' -- ✏️ AJUSTE ESTE EMAIL
  LIMIT 1;
  
  -- Buscar ID do Gustavo pelo email (AJUSTE O EMAIL SE NECESSÁRIO)
  SELECT id INTO v_user_gustavo
  FROM auth.users
  WHERE email = 'gustavo@exemplo.com' -- ✏️ AJUSTE ESTE EMAIL OU USE O MESMO
  LIMIT 1;
  
  -- Se não encontrou Gustavo, usar mesmo usuário do Caio
  IF v_user_gustavo IS NULL THEN
    v_user_gustavo := v_user_caio;
  END IF;
  
  RAISE NOTICE 'User Caio ID: %', v_user_caio;
  RAISE NOTICE 'User Gustavo ID: %', v_user_gustavo;
  
  -- ============================================================================
  -- 2. VERIFICAR SE OPERAÇÕES JÁ EXISTEM
  -- ============================================================================
  
  SELECT id INTO v_team_caio FROM teams WHERE slug = 'caio-martins';
  SELECT id INTO v_team_gustavo FROM teams WHERE slug = 'gustavo-de-castro';
  
  -- ============================================================================
  -- 3. CRIAR OPERAÇÃO CAIO MARTINS (se não existir)
  -- ============================================================================
  
  IF v_team_caio IS NULL AND v_user_caio IS NOT NULL THEN
    INSERT INTO teams (team_name, slug, description, owner_id, is_active)
    VALUES (
      'Caio Martins',
      'caio-martins',
      'Operação principal - Caio Martins',
      v_user_caio,
      true
    )
    RETURNING id INTO v_team_caio;
    
    RAISE NOTICE '✅ Operação Caio Martins criada: %', v_team_caio;
  ELSE
    RAISE NOTICE '⚠️  Operação Caio Martins já existe: %', v_team_caio;
  END IF;
  
  -- ============================================================================
  -- 4. CRIAR OPERAÇÃO GUSTAVO DE CASTRO (se não existir)
  -- ============================================================================
  
  IF v_team_gustavo IS NULL AND v_user_gustavo IS NOT NULL THEN
    INSERT INTO teams (team_name, slug, description, owner_id, is_active)
    VALUES (
      'Gustavo de Castro',
      'gustavo-de-castro',
      'Operação secundária - Gustavo de Castro',
      v_user_gustavo,
      true
    )
    RETURNING id INTO v_team_gustavo;
    
    RAISE NOTICE '✅ Operação Gustavo de Castro criada: %', v_team_gustavo;
  ELSE
    RAISE NOTICE '⚠️  Operação Gustavo de Castro já existe: %', v_team_gustavo;
  END IF;
  
  -- ============================================================================
  -- 5. ASSOCIAR VENDEDORES ÀS OPERAÇÕES
  -- ============================================================================
  
  -- Atualizar sellers SEM sufixo 2 para Caio Martins
  IF v_team_caio IS NOT NULL THEN
    UPDATE sellers
    SET team_id = v_team_caio
    WHERE team_id IN (
      SELECT id FROM teams 
      WHERE slug NOT LIKE '%2%' 
      OR slug IS NULL
    )
    AND name NOT LIKE '%2%';
    
    RAISE NOTICE '✅ Vendedores atualizados para Caio Martins';
  END IF;
  
  -- Atualizar sellers COM sufixo 2 para Gustavo de Castro
  IF v_team_gustavo IS NOT NULL THEN
    UPDATE sellers
    SET team_id = v_team_gustavo
    WHERE name LIKE '%2%';
    
    RAISE NOTICE '✅ Vendedores atualizados para Gustavo de Castro';
  END IF;
  
  -- ============================================================================
  -- 6. ASSOCIAR CAMPANHAS ÀS OPERAÇÕES E GERAR FULL_SLUG
  -- ============================================================================
  
  -- Campanhas SEM sufixo 2 para Caio Martins
  IF v_team_caio IS NOT NULL THEN
    UPDATE campaigns
    SET 
      team_id = v_team_caio,
      full_slug = 'caio-martins-' || slug
    WHERE team_id IN (
      SELECT id FROM teams 
      WHERE slug NOT LIKE '%2%' 
      OR slug IS NULL
    )
    AND name NOT LIKE '%2%'
    AND (full_slug IS NULL OR full_slug = '');
    
    RAISE NOTICE '✅ Campanhas atualizadas para Caio Martins';
  END IF;
  
  -- Campanhas COM sufixo 2 para Gustavo de Castro
  IF v_team_gustavo IS NOT NULL THEN
    UPDATE campaigns
    SET 
      team_id = v_team_gustavo,
      full_slug = 'gustavo-de-castro-' || REPLACE(slug, '2', '')
    WHERE name LIKE '%2%'
    AND (full_slug IS NULL OR full_slug = '');
    
    RAISE NOTICE '✅ Campanhas atualizadas para Gustavo de Castro';
  END IF;
  
  -- ============================================================================
  -- 7. ASSOCIAR CLICKS ÀS OPERAÇÕES
  -- ============================================================================
  
  -- Atualizar clicks baseado na campanha
  UPDATE clicks cl
  SET team_id = c.team_id
  FROM campaigns c
  WHERE cl.campaign_id = c.id
  AND (cl.team_id IS NULL OR cl.team_id != c.team_id);
  
  RAISE NOTICE '✅ Clicks associados às operações';
  
  -- ============================================================================
  -- 8. GARANTIR QUE USUÁRIOS SEJAM MEMBROS DAS OPERAÇÕES
  -- ============================================================================
  
  -- Adicionar Caio como owner da operação Caio Martins
  IF v_team_caio IS NOT NULL AND v_user_caio IS NOT NULL THEN
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (v_team_caio, v_user_caio, 'owner')
    ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'owner';
    
    RAISE NOTICE '✅ Caio adicionado como owner de Caio Martins';
  END IF;
  
  -- Adicionar Gustavo como owner da operação Gustavo de Castro
  IF v_team_gustavo IS NOT NULL AND v_user_gustavo IS NOT NULL THEN
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (v_team_gustavo, v_user_gustavo, 'owner')
    ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'owner';
    
    RAISE NOTICE '✅ Gustavo adicionado como owner de Gustavo de Castro';
  END IF;
  
  -- Se for o mesmo usuário, adicionar às duas operações
  IF v_user_caio = v_user_gustavo AND v_team_caio IS NOT NULL AND v_team_gustavo IS NOT NULL THEN
    INSERT INTO team_members (team_id, user_id, role)
    VALUES 
      (v_team_caio, v_user_caio, 'owner'),
      (v_team_gustavo, v_user_caio, 'owner')
    ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'owner';
    
    RAISE NOTICE '✅ Usuário adicionado às duas operações';
  END IF;
  
  -- ============================================================================
  -- 9. RELATÓRIO FINAL
  -- ============================================================================
  
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'MIGRATION CONCLUÍDA!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Operação Caio Martins (ID: %)', v_team_caio;
  RAISE NOTICE '  - Vendedores: %', (SELECT COUNT(*) FROM sellers WHERE team_id = v_team_caio);
  RAISE NOTICE '  - Campanhas: %', (SELECT COUNT(*) FROM campaigns WHERE team_id = v_team_caio);
  RAISE NOTICE '  - Clicks: %', (SELECT COUNT(*) FROM clicks WHERE team_id = v_team_caio);
  RAISE NOTICE '';
  RAISE NOTICE 'Operação Gustavo de Castro (ID: %)', v_team_gustavo;
  RAISE NOTICE '  - Vendedores: %', (SELECT COUNT(*) FROM sellers WHERE team_id = v_team_gustavo);
  RAISE NOTICE '  - Campanhas: %', (SELECT COUNT(*) FROM campaigns WHERE team_id = v_team_gustavo);
  RAISE NOTICE '  - Clicks: %', (SELECT COUNT(*) FROM clicks WHERE team_id = v_team_gustavo);
  RAISE NOTICE '';
  RAISE NOTICE 'Membros totais: %', (SELECT COUNT(*) FROM team_members);
  RAISE NOTICE '============================================================================';
  
END $$;

-- ============================================================================
-- 10. VERIFICAÇÕES FINAIS
-- ============================================================================

-- Listar operações criadas
SELECT 
  id,
  team_name,
  slug,
  is_active,
  (SELECT COUNT(*) FROM sellers WHERE team_id = teams.id) as sellers_count,
  (SELECT COUNT(*) FROM campaigns WHERE team_id = teams.id) as campaigns_count,
  (SELECT COUNT(*) FROM clicks WHERE team_id = teams.id) as clicks_count
FROM teams
ORDER BY team_name;

-- Listar membros
SELECT 
  t.team_name,
  t.slug,
  tm.role,
  u.email
FROM team_members tm
INNER JOIN teams t ON tm.team_id = t.id
INNER JOIN auth.users u ON tm.user_id = u.id
ORDER BY t.team_name, tm.role;

-- Verificar campanhas com full_slug
SELECT 
  t.team_name,
  c.name,
  c.slug,
  c.full_slug,
  c.is_active
FROM campaigns c
INNER JOIN teams t ON c.team_id = t.id
ORDER BY t.team_name, c.name;
