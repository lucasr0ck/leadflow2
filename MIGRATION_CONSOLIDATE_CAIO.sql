-- ============================================================================
-- MIGRATION: CONSOLIDAR DADOS EM CAIO MARTINS E EXCLUIR MULTIUM CURSOS
-- ============================================================================
-- Move todos os dados de "Multium Cursos" para "Caio Martins"
-- e depois exclui a operação "Multium Cursos"
-- ============================================================================

DO $$
DECLARE
  v_team_caio UUID;
  v_team_multium UUID;
  v_campanhas_movidas INT;
  v_vendedores_movidos INT;
  v_clicks_movidos INT;
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'INICIANDO CONSOLIDAÇÃO DE DADOS';
  RAISE NOTICE '============================================================================';
  
  -- ============================================================================
  -- 1. IDENTIFICAR IDS DAS OPERAÇÕES
  -- ============================================================================
  
  SELECT id INTO v_team_caio FROM teams WHERE slug = 'caio-martins';
  SELECT id INTO v_team_multium FROM teams WHERE slug = 'multium-cursos';
  
  IF v_team_caio IS NULL THEN
    RAISE EXCEPTION 'Operação Caio Martins não encontrada! Execute MIGRATION_POPULATE_DATA.sql primeiro.';
  END IF;
  
  IF v_team_multium IS NULL THEN
    RAISE NOTICE '⚠️  Operação Multium Cursos não existe. Nada a fazer.';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ Caio Martins ID: %', v_team_caio;
  RAISE NOTICE '✅ Multium Cursos ID: %', v_team_multium;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 2. MOVER CAMPANHAS DE MULTIUM CURSOS → CAIO MARTINS
  -- ============================================================================
  
  -- Primeiro, atualizar full_slug das campanhas que vão ser movidas
  UPDATE campaigns
  SET full_slug = 'caio-martins-' || 
    CASE 
      WHEN full_slug LIKE 'multium-cursos-%' THEN SUBSTRING(full_slug FROM 16)
      ELSE slug
    END
  WHERE team_id = v_team_multium;
  
  -- Depois, mover as campanhas
  UPDATE campaigns
  SET team_id = v_team_caio
  WHERE team_id = v_team_multium;
  
  GET DIAGNOSTICS v_campanhas_movidas = ROW_COUNT;
  RAISE NOTICE '✅ Campanhas movidas de Multium Cursos → Caio Martins: %', v_campanhas_movidas;
  
  -- ============================================================================
  -- 3. MOVER VENDEDORES DE MULTIUM CURSOS → CAIO MARTINS
  -- ============================================================================
  
  UPDATE sellers
  SET team_id = v_team_caio
  WHERE team_id = v_team_multium;
  
  GET DIAGNOSTICS v_vendedores_movidos = ROW_COUNT;
  RAISE NOTICE '✅ Vendedores movidos de Multium Cursos → Caio Martins: %', v_vendedores_movidos;
  
  -- ============================================================================
  -- 4. MOVER CLICKS DE MULTIUM CURSOS → CAIO MARTINS
  -- ============================================================================
  
  UPDATE clicks
  SET team_id = v_team_caio
  WHERE team_id = v_team_multium;
  
  GET DIAGNOSTICS v_clicks_movidos = ROW_COUNT;
  RAISE NOTICE '✅ Clicks movidos de Multium Cursos → Caio Martins: %', v_clicks_movidos;
  
  -- ============================================================================
  -- 5. MOVER MEMBROS DE MULTIUM CURSOS → CAIO MARTINS
  -- ============================================================================
  
  -- Inserir membros do Multium Cursos no Caio Martins (sem duplicar)
  INSERT INTO team_members (team_id, user_id, role)
  SELECT v_team_caio, user_id, role
  FROM team_members
  WHERE team_id = v_team_multium
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  
  RAISE NOTICE '✅ Membros migrados para Caio Martins';
  
  -- ============================================================================
  -- 6. EXCLUIR OPERAÇÃO MULTIUM CURSOS
  -- ============================================================================
  
  -- Remover membros (necessário antes de deletar team)
  DELETE FROM team_members WHERE team_id = v_team_multium;
  RAISE NOTICE '✅ Membros removidos de Multium Cursos';
  
  -- Deletar team
  DELETE FROM teams WHERE id = v_team_multium;
  RAISE NOTICE '✅ Operação Multium Cursos EXCLUÍDA';
  
  -- ============================================================================
  -- 7. RELATÓRIO FINAL
  -- ============================================================================
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'CONSOLIDAÇÃO CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Operação Caio Martins agora possui:';
  RAISE NOTICE '  - Vendedores: %', (SELECT COUNT(*) FROM sellers WHERE team_id = v_team_caio);
  RAISE NOTICE '  - Campanhas: %', (SELECT COUNT(*) FROM campaigns WHERE team_id = v_team_caio);
  RAISE NOTICE '  - Clicks: %', (SELECT COUNT(*) FROM clicks WHERE team_id = v_team_caio);
  RAISE NOTICE '';
  RAISE NOTICE 'Operação Multium Cursos foi EXCLUÍDA.';
  RAISE NOTICE '============================================================================';
  
END $$;

-- ============================================================================
-- 8. VERIFICAÇÕES FINAIS
-- ============================================================================

-- Verificar que Multium Cursos não existe mais
SELECT 
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM teams WHERE slug = 'multium-cursos') 
    THEN '✅ Multium Cursos foi excluído com sucesso'
    ELSE '❌ ERRO: Multium Cursos ainda existe!'
  END as status;

-- Listar operações restantes
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

-- Verificar campanhas duplicadas por full_slug
SELECT 
  full_slug,
  COUNT(*) as count
FROM campaigns
GROUP BY full_slug
HAVING COUNT(*) > 1;

-- Se houver duplicados, esta query os resolve:
-- (descomente se necessário)
/*
WITH duplicates AS (
  SELECT 
    id,
    full_slug,
    ROW_NUMBER() OVER (PARTITION BY full_slug ORDER BY created_at) as rn
  FROM campaigns
  WHERE full_slug IN (
    SELECT full_slug 
    FROM campaigns 
    GROUP BY full_slug 
    HAVING COUNT(*) > 1
  )
)
UPDATE campaigns
SET full_slug = campaigns.full_slug || '-' || duplicates.rn
FROM duplicates
WHERE campaigns.id = duplicates.id AND duplicates.rn > 1;
*/
