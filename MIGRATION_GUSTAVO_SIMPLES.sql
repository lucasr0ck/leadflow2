-- ============================================================================
-- MIGRATION SIMPLIFICADA: GUSTAVO DE CASTRO (SEM updated_at)
-- ============================================================================
-- Versão sem updated_at para compatibilidade máxima
-- ============================================================================

DO $$
DECLARE
  v_team_gustavo UUID;
  v_sellers_migrados INT := 0;
  v_contacts_migrados INT := 0;
  v_campanhas_migradas INT := 0;
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'MIGRAÇÃO SIMPLIFICADA - GUSTAVO DE CASTRO';
  RAISE NOTICE '============================================================================';
  
  -- Buscar Gustavo
  SELECT id INTO v_team_gustavo FROM teams WHERE slug = 'gustavo-de-castro';
  
  IF v_team_gustavo IS NULL THEN
    RAISE EXCEPTION '❌ Operação Gustavo de Castro não encontrada!';
  END IF;
  
  RAISE NOTICE '✅ Gustavo ID: %', v_team_gustavo;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- 1. MIGRAR SELLERS2
  -- ============================================================================
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sellers2') THEN
    RAISE NOTICE '📦 Migrando sellers2...';
    
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
    RAISE NOTICE '✅ Vendedores: %', v_sellers_migrados;
  END IF;
  
  -- ============================================================================
  -- 2. MIGRAR SELLER_CONTACTS2
  -- ============================================================================
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'seller_contacts2') THEN
    RAISE NOTICE '📦 Migrando seller_contacts2...';
    
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
    RAISE NOTICE '✅ Contatos: %', v_contacts_migrados;
  END IF;
  
  -- ============================================================================
  -- 3. MIGRAR CAMPAIGNS2
  -- ============================================================================
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaigns2') THEN
    RAISE NOTICE '📦 Migrando campaigns2...';
    
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
      name = EXCLUDED.name;
    
    GET DIAGNOSTICS v_campanhas_migradas = ROW_COUNT;
    RAISE NOTICE '✅ Campanhas: %', v_campanhas_migradas;
  END IF;
  
  -- ============================================================================
  -- 4. MIGRAR CLICKS2
  -- ============================================================================
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clicks2') THEN
    RAISE NOTICE '📦 Migrando clicks2...';
    
    INSERT INTO clicks (id, campaign_id, seller_id, team_id, created_at)
    SELECT 
      id, 
      campaign_id, 
      seller_id, 
      v_team_gustavo,
      COALESCE(created_at, now())
    FROM clicks2
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE '✅ Clicks migrados';
  END IF;
  
  -- ============================================================================
  -- RELATÓRIO
  -- ============================================================================
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'MIGRAÇÃO CONCLUÍDA!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Gustavo de Castro agora tem:';
  RAISE NOTICE '  Vendedores: %', (SELECT COUNT(*) FROM sellers WHERE team_id = v_team_gustavo);
  RAISE NOTICE '  Contatos: %', (SELECT COUNT(*) FROM seller_contacts WHERE seller_id IN (SELECT id FROM sellers WHERE team_id = v_team_gustavo));
  RAISE NOTICE '  Campanhas: %', (SELECT COUNT(*) FROM campaigns WHERE team_id = v_team_gustavo);
  RAISE NOTICE '  Clicks: %', (SELECT COUNT(*) FROM clicks WHERE team_id = v_team_gustavo);
  RAISE NOTICE '============================================================================';
  
END $$;

-- Verificar resultado
SELECT 
  s.name,
  COUNT(sc.id) as contacts
FROM sellers s
LEFT JOIN seller_contacts sc ON s.id = sc.seller_id
WHERE s.team_id = (SELECT id FROM teams WHERE slug = 'gustavo-de-castro')
GROUP BY s.name
ORDER BY s.name;
