-- ============================================================================
-- MIGRATION: POPULAR GUSTAVO DE CASTRO COM DADOS SUFIXO 2
-- ============================================================================
-- Move vendedores e campanhas com sufixo "2" para Gustavo de Castro
-- ============================================================================

DO $$
DECLARE
  v_team_gustavo UUID;
  v_team_caio UUID;
  v_campanhas_movidas INT;
  v_vendedores_movidos INT;
  v_clicks_movidos INT;
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'INICIANDO MIGRAÇÃO PARA GUSTAVO DE CASTRO';
  RAISE NOTICE '============================================================================';
  
  -- ============================================================================
  -- 1. IDENTIFICAR IDS DAS OPERAÇÕES
  -- ============================================================================
  
  SELECT id INTO v_team_gustavo FROM teams WHERE slug = 'gustavo-de-castro';
  SELECT id INTO v_team_caio FROM teams WHERE slug = 'caio-martins';
  
  IF v_team_gustavo IS NULL THEN
    RAISE EXCEPTION 'Operação Gustavo de Castro não encontrada!';
  END IF;
  
  IF v_team_caio IS NULL THEN
    RAISE EXCEPTION 'Operação Caio Martins não encontrada!';
  END IF;
  
  RAISE NOTICE '✅ Gustavo de Castro ID: %', v_team_gustavo;
  RAISE NOTICE '✅ Caio Martins ID: %', v_team_caio;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 2. MOVER VENDEDORES COM SUFIXO 2 → GUSTAVO DE CASTRO
  -- ============================================================================
  
  UPDATE sellers
  SET team_id = v_team_gustavo
  WHERE team_id = v_team_caio
  AND name LIKE '%2';
  
  GET DIAGNOSTICS v_vendedores_movidos = ROW_COUNT;
  RAISE NOTICE '✅ Vendedores movidos para Gustavo de Castro: %', v_vendedores_movidos;
  
  -- ============================================================================
  -- 3. MOVER CAMPANHAS COM SUFIXO 2 → GUSTAVO DE CASTRO
  -- ============================================================================
  
  -- Primeiro, atualizar full_slug das campanhas
  UPDATE campaigns
  SET full_slug = 'gustavo-de-castro-' || REPLACE(slug, '2', '')
  WHERE team_id = v_team_caio
  AND name LIKE '%2';
  
  -- Depois, mover as campanhas
  UPDATE campaigns
  SET team_id = v_team_gustavo
  WHERE team_id = v_team_caio
  AND name LIKE '%2';
  
  GET DIAGNOSTICS v_campanhas_movidas = ROW_COUNT;
  RAISE NOTICE '✅ Campanhas movidas para Gustavo de Castro: %', v_campanhas_movidas;
  
  -- ============================================================================
  -- 4. ATUALIZAR CLICKS DAS CAMPANHAS MOVIDAS
  -- ============================================================================
  
  UPDATE clicks
  SET team_id = v_team_gustavo
  WHERE campaign_id IN (
    SELECT id FROM campaigns WHERE team_id = v_team_gustavo
  )
  AND team_id != v_team_gustavo;
  
  GET DIAGNOSTICS v_clicks_movidos = ROW_COUNT;
  RAISE NOTICE '✅ Clicks atualizados para Gustavo de Castro: %', v_clicks_movidos;
  
  -- ============================================================================
  -- 5. RELATÓRIO FINAL
  -- ============================================================================
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'MIGRAÇÃO CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Operação Caio Martins agora possui:';
  RAISE NOTICE '  - Vendedores: %', (SELECT COUNT(*) FROM sellers WHERE team_id = v_team_caio);
  RAISE NOTICE '  - Campanhas: %', (SELECT COUNT(*) FROM campaigns WHERE team_id = v_team_caio);
  RAISE NOTICE '  - Clicks: %', (SELECT COUNT(*) FROM clicks WHERE team_id = v_team_caio);
  RAISE NOTICE '';
  RAISE NOTICE 'Operação Gustavo de Castro agora possui:';
  RAISE NOTICE '  - Vendedores: %', (SELECT COUNT(*) FROM sellers WHERE team_id = v_team_gustavo);
  RAISE NOTICE '  - Campanhas: %', (SELECT COUNT(*) FROM campaigns WHERE team_id = v_team_gustavo);
  RAISE NOTICE '  - Clicks: %', (SELECT COUNT(*) FROM clicks WHERE team_id = v_team_gustavo);
  RAISE NOTICE '============================================================================';
  
END $$;

-- ============================================================================
-- 6. VERIFICAÇÕES FINAIS
-- ============================================================================

-- Listar vendedores por operação
SELECT 
  t.team_name,
  s.name,
  s.weight
FROM sellers s
INNER JOIN teams t ON s.team_id = t.id
ORDER BY t.team_name, s.name;

-- Listar campanhas por operação
SELECT 
  t.team_name,
  c.name,
  c.slug,
  c.full_slug,
  c.is_active
FROM campaigns c
INNER JOIN teams t ON c.team_id = t.id
ORDER BY t.team_name, c.name;

-- Resumo por operação
SELECT 
  t.team_name,
  t.slug,
  (SELECT COUNT(*) FROM sellers WHERE team_id = t.id) as sellers_count,
  (SELECT COUNT(*) FROM campaigns WHERE team_id = t.id) as campaigns_count,
  (SELECT COUNT(*) FROM clicks WHERE team_id = t.id) as clicks_count
FROM teams t
ORDER BY t.team_name;
