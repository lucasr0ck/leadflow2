-- ============================================================================
-- MIGRATION: MIGRAR TABELAS ANTIGAS (suffix 2) PARA GUSTAVO DE CASTRO
-- ============================================================================
-- Move dados de sellers2, seller_contacts2, campaigns2, clicks2
-- para as tabelas unificadas com team_id do Gustavo de Castro
-- ============================================================================

DO $$
DECLARE
  v_team_gustavo UUID;
  v_sellers_migrados INT := 0;
  v_contacts_migrados INT := 0;
  v_campanhas_migradas INT := 0;
  v_clicks_migrados INT := 0;
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'INICIANDO MIGRAÇÃO DAS TABELAS ANTIGAS PARA GUSTAVO DE CASTRO';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 1. IDENTIFICAR TEAM GUSTAVO DE CASTRO
  -- ============================================================================
  
  SELECT id INTO v_team_gustavo FROM teams WHERE slug = 'gustavo-de-castro';
  
  IF v_team_gustavo IS NULL THEN
    RAISE EXCEPTION '❌ Operação Gustavo de Castro não encontrada!';
  END IF;
  
  RAISE NOTICE '✅ Gustavo de Castro ID: %', v_team_gustavo;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 2. MIGRAR SELLERS2 → SELLERS
  -- ============================================================================
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sellers2') THEN
    RAISE NOTICE '📦 Migrando sellers2 → sellers...';
    
    INSERT INTO sellers (
      id,
      name,
      weight,
      team_id,
      created_at,
      updated_at
    )
    SELECT 
      id,
      name,
      weight,
      v_team_gustavo, -- Associar ao Gustavo
      created_at,
      updated_at
    FROM sellers2
    ON CONFLICT (id) DO UPDATE SET
      team_id = v_team_gustavo,
      name = EXCLUDED.name,
      weight = EXCLUDED.weight;
    
    GET DIAGNOSTICS v_sellers_migrados = ROW_COUNT;
    RAISE NOTICE '✅ Vendedores migrados: %', v_sellers_migrados;
  ELSE
    RAISE NOTICE '⚠️  Tabela sellers2 não existe, pulando...';
  END IF;
  
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 3. MIGRAR SELLER_CONTACTS2 → SELLER_CONTACTS
  -- ============================================================================
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'seller_contacts2') THEN
    RAISE NOTICE '📦 Migrando seller_contacts2 → seller_contacts...';
    
    INSERT INTO seller_contacts (
      id,
      seller_id,
      phone_number,
      description,
      created_at,
      updated_at
    )
    SELECT 
      id,
      seller_id,
      phone_number,
      description,
      created_at,
      updated_at
    FROM seller_contacts2
    ON CONFLICT (id) DO UPDATE SET
      phone_number = EXCLUDED.phone_number,
      description = EXCLUDED.description;
    
    GET DIAGNOSTICS v_contacts_migrados = ROW_COUNT;
    RAISE NOTICE '✅ Contatos migrados: %', v_contacts_migrados;
  ELSE
    RAISE NOTICE '⚠️  Tabela seller_contacts2 não existe, pulando...';
  END IF;
  
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 4. MIGRAR CAMPAIGNS2 → CAMPAIGNS (se existir)
  -- ============================================================================
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaigns2') THEN
    RAISE NOTICE '📦 Migrando campaigns2 → campaigns...';
    
    INSERT INTO campaigns (
      id,
      name,
      slug,
      full_slug,
      greeting_message,
      is_active,
      team_id,
      created_at,
      updated_at
    )
    SELECT 
      id,
      name,
      slug,
      'gustavo-de-castro-' || slug, -- Gerar full_slug
      greeting_message,
      is_active,
      v_team_gustavo, -- Associar ao Gustavo
      created_at,
      updated_at
    FROM campaigns2
    ON CONFLICT (id) DO UPDATE SET
      team_id = v_team_gustavo,
      full_slug = 'gustavo-de-castro-' || EXCLUDED.slug,
      name = EXCLUDED.name,
      greeting_message = EXCLUDED.greeting_message,
      is_active = EXCLUDED.is_active;
    
    GET DIAGNOSTICS v_campanhas_migradas = ROW_COUNT;
    RAISE NOTICE '✅ Campanhas migradas: %', v_campanhas_migradas;
  ELSE
    RAISE NOTICE '⚠️  Tabela campaigns2 não existe, pulando...';
  END IF;
  
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 5. MIGRAR CLICKS2 → CLICKS (se existir)
  -- ============================================================================
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clicks2') THEN
    RAISE NOTICE '📦 Migrando clicks2 → clicks...';
    
    INSERT INTO clicks (
      id,
      campaign_id,
      seller_id,
      team_id,
      clicked_at,
      created_at
    )
    SELECT 
      id,
      campaign_id,
      seller_id,
      v_team_gustavo, -- Associar ao Gustavo
      clicked_at,
      created_at
    FROM clicks2
    ON CONFLICT (id) DO NOTHING;
    
    GET DIAGNOSTICS v_clicks_migrados = ROW_COUNT;
    RAISE NOTICE '✅ Clicks migrados: %', v_clicks_migrados;
  ELSE
    RAISE NOTICE '⚠️  Tabela clicks2 não existe, pulando...';
  END IF;
  
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 6. RELATÓRIO FINAL
  -- ============================================================================
  
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'MIGRAÇÃO CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Dados migrados para Gustavo de Castro:';
  RAISE NOTICE '  - Vendedores: %', v_sellers_migrados;
  RAISE NOTICE '  - Contatos: %', v_contacts_migrados;
  RAISE NOTICE '  - Campanhas: %', v_campanhas_migradas;
  RAISE NOTICE '  - Clicks: %', v_clicks_migrados;
  RAISE NOTICE '';
  RAISE NOTICE 'Totais na operação Gustavo de Castro:';
  RAISE NOTICE '  - Vendedores: %', (SELECT COUNT(*) FROM sellers WHERE team_id = v_team_gustavo);
  RAISE NOTICE '  - Contatos: %', (SELECT COUNT(*) FROM seller_contacts WHERE seller_id IN (SELECT id FROM sellers WHERE team_id = v_team_gustavo));
  RAISE NOTICE '  - Campanhas: %', (SELECT COUNT(*) FROM campaigns WHERE team_id = v_team_gustavo);
  RAISE NOTICE '  - Clicks: %', (SELECT COUNT(*) FROM clicks WHERE team_id = v_team_gustavo);
  RAISE NOTICE '============================================================================';
  
END $$;

-- ============================================================================
-- 7. EXCLUIR TABELAS ANTIGAS (descomente após confirmar que está OK)
-- ============================================================================

-- ⚠️ CUIDADO: Só execute depois de verificar que os dados foram migrados!
-- ⚠️ Descomente as linhas abaixo SOMENTE depois de confirmar que está tudo OK

/*
DROP TABLE IF EXISTS clicks2 CASCADE;
DROP TABLE IF EXISTS seller_contacts2 CASCADE;
DROP TABLE IF EXISTS sellers2 CASCADE;
DROP TABLE IF EXISTS campaigns2 CASCADE;
DROP TABLE IF EXISTS teams2 CASCADE;

RAISE NOTICE '✅ Tabelas antigas excluídas com sucesso!';
*/

-- ============================================================================
-- 8. VERIFICAÇÕES FINAIS
-- ============================================================================

-- Verificar se tabelas antigas ainda existem
SELECT 
  table_name,
  CASE 
    WHEN table_name IN (
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    ) THEN '⚠️ Ainda existe'
    ELSE '✅ Excluída'
  END as status
FROM (
  VALUES 
    ('sellers2'),
    ('seller_contacts2'),
    ('campaigns2'),
    ('clicks2'),
    ('teams2')
) AS t(table_name);

-- Listar vendedores por operação
SELECT 
  t.team_name,
  t.slug,
  COUNT(DISTINCT s.id) as sellers_count,
  COUNT(sc.id) as contacts_count
FROM teams t
LEFT JOIN sellers s ON t.id = s.team_id
LEFT JOIN seller_contacts sc ON s.id = sc.seller_id
GROUP BY t.team_name, t.slug
ORDER BY t.team_name;

-- Listar todos os vendedores do Gustavo
SELECT 
  s.name,
  s.weight,
  COUNT(sc.id) as contacts
FROM sellers s
LEFT JOIN seller_contacts sc ON s.id = sc.seller_id
WHERE s.team_id = (SELECT id FROM teams WHERE slug = 'gustavo-de-castro')
GROUP BY s.name, s.weight
ORDER BY s.name;

-- Listar todas as campanhas do Gustavo
SELECT 
  c.name,
  c.slug,
  c.full_slug,
  c.is_active,
  COUNT(cl.id) as clicks
FROM campaigns c
LEFT JOIN clicks cl ON c.id = cl.campaign_id
WHERE c.team_id = (SELECT id FROM teams WHERE slug = 'gustavo-de-castro')
GROUP BY c.id, c.name, c.slug, c.full_slug, c.is_active
ORDER BY c.name;
