-- ============================================================================
-- MIGRAÇÃO FINAL E DEFINITIVA - GUSTAVO DE CASTRO (CORRIGIDA)
-- ============================================================================
-- Corrige TODOS os problemas identificados:
-- 1. clicks.id é IDENTITY (não pode inserir manualmente, gera novo)
-- 2. clicks2 não tem team_id (será adicionado na migração)
-- 3. sellers/campaigns não tem updated_at
-- 4. sellers, campaigns, seller_contacts usam UUID (podem manter id)
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
  RAISE NOTICE 'MIGRAÇÃO FINAL - GUSTAVO DE CASTRO';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 1. IDENTIFICAR GUSTAVO DE CASTRO
  -- ============================================================================
  
  SELECT id INTO v_team_gustavo FROM teams WHERE slug = 'gustavo-de-castro';
  
  IF v_team_gustavo IS NULL THEN
    RAISE EXCEPTION '❌ Operação Gustavo de Castro não encontrada!';
  END IF;
  
  RAISE NOTICE '✅ Gustavo de Castro ID: %', v_team_gustavo;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 2. MIGRAR SELLERS2 → SELLERS (UUID - pode manter id original)
  -- ============================================================================
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sellers2') THEN
    RAISE NOTICE '📦 Migrando sellers2 → sellers...';
    
    INSERT INTO sellers (id, name, weight, team_id, created_at)
    SELECT 
      id, 
      name, 
      weight, 
      v_team_gustavo,
      COALESCE(created_at, now())
    FROM sellers2
    ON CONFLICT (id) DO UPDATE SET
      team_id = v_team_gustavo,
      name = EXCLUDED.name,
      weight = EXCLUDED.weight;
    
    GET DIAGNOSTICS v_sellers_migrados = ROW_COUNT;
    RAISE NOTICE '✅ Vendedores migrados: %', v_sellers_migrados;
  ELSE
    RAISE NOTICE '⚠️  Tabela sellers2 não existe';
  END IF;
  
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 3. MIGRAR SELLER_CONTACTS2 → SELLER_CONTACTS (UUID - pode manter id)
  -- ============================================================================
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'seller_contacts2') THEN
    RAISE NOTICE '📦 Migrando seller_contacts2 → seller_contacts...';
    
    INSERT INTO seller_contacts (id, seller_id, phone_number, description, created_at)
    SELECT 
      id, 
      seller_id, 
      phone_number, 
      description, 
      COALESCE(created_at, now())
    FROM seller_contacts2
    ON CONFLICT (id) DO UPDATE SET
      phone_number = EXCLUDED.phone_number,
      description = EXCLUDED.description;
    
    GET DIAGNOSTICS v_contacts_migrados = ROW_COUNT;
    RAISE NOTICE '✅ Contatos migrados: %', v_contacts_migrados;
  ELSE
    RAISE NOTICE '⚠️  Tabela seller_contacts2 não existe';
  END IF;
  
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 4. MIGRAR CAMPAIGNS2 → CAMPAIGNS (UUID - pode manter id)
  -- ============================================================================
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaigns2') THEN
    RAISE NOTICE '📦 Migrando campaigns2 → campaigns...';
    
    INSERT INTO campaigns (id, name, slug, full_slug, greeting_message, is_active, team_id, created_at)
    SELECT 
      id, 
      name, 
      slug, 
      'gustavo-de-castro-' || slug, 
      greeting_message, 
      is_active, 
      v_team_gustavo, 
      COALESCE(created_at, now())
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
    RAISE NOTICE '⚠️  Tabela campaigns2 não existe';
  END IF;
  
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 5. MIGRAR CLICKS2 → CLICKS (INT IDENTITY - GERA NOVO ID)
  -- ============================================================================
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clicks2') THEN
    RAISE NOTICE '📦 Migrando clicks2 → clicks...';
    
    -- ⚠️ IMPORTANTE: clicks.id é IDENTITY (auto-increment)
    -- Não podemos inserir o id original, será gerado novo
    -- clicks2 tem: id, campaign_id, seller_id, created_at
    -- clicks tem: id (IDENTITY), campaign_id, seller_id, team_id, created_at
    INSERT INTO clicks (campaign_id, seller_id, team_id, created_at)
    SELECT 
      campaign_id,
      seller_id,
      v_team_gustavo, -- Adicionar team_id do Gustavo
      COALESCE(created_at, now())
    FROM clicks2;
    
    GET DIAGNOSTICS v_clicks_migrados = ROW_COUNT;
    RAISE NOTICE '✅ Clicks migrados: % (novos IDs gerados)', v_clicks_migrados;
  ELSE
    RAISE NOTICE '⚠️  Tabela clicks2 não existe';
  END IF;
  
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 6. RELATÓRIO FINAL
  -- ============================================================================
  
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'MIGRAÇÃO CONCLUÍDA!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Dados migrados:';
  RAISE NOTICE '  ✅ Vendedores: %', v_sellers_migrados;
  RAISE NOTICE '  ✅ Contatos: %', v_contacts_migrados;
  RAISE NOTICE '  ✅ Campanhas: %', v_campanhas_migradas;
  RAISE NOTICE '  ✅ Clicks: % (novos IDs)', v_clicks_migrados;
  RAISE NOTICE '';
  RAISE NOTICE 'Totais no Gustavo de Castro:';
  RAISE NOTICE '  📊 Vendedores: %', (SELECT COUNT(*) FROM sellers WHERE team_id = v_team_gustavo);
  RAISE NOTICE '  📊 Contatos: %', (SELECT COUNT(*) FROM seller_contacts WHERE seller_id IN (SELECT id FROM sellers WHERE team_id = v_team_gustavo));
  RAISE NOTICE '  📊 Campanhas: %', (SELECT COUNT(*) FROM campaigns WHERE team_id = v_team_gustavo);
  RAISE NOTICE '  📊 Clicks: %', (SELECT COUNT(*) FROM clicks WHERE team_id = v_team_gustavo);
  RAISE NOTICE '============================================================================';
  
END $$;

-- ============================================================================
-- 7. VERIFICAÇÃO FINAL - Listar vendedores do Gustavo
-- ============================================================================

SELECT 
  s.name as vendedor,
  s.weight,
  (SELECT COUNT(*) FROM seller_contacts WHERE seller_id = s.id) as contatos,
  (SELECT COUNT(*) FROM clicks WHERE seller_id = s.id) as clicks_totais
FROM sellers s
WHERE s.team_id = (SELECT id FROM teams WHERE slug = 'gustavo-de-castro')
ORDER BY s.name;
