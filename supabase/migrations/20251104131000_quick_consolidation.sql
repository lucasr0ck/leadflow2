-- ============================================================================
-- SCRIPT SIMPLIFICADO: Migração Rápida (mesma conta Supabase)
-- ============================================================================
-- Use este script se você tem tabelas sellers2, campaigns2, clicks2, etc.
-- no MESMO banco de dados
-- ============================================================================

-- PASSO 1: Configurar (EDITE ESTES VALORES!)
-- ============================================================================

DO $$
DECLARE
  -- 🔧 CONFIGURE AQUI:
  v_owner_id uuid := '00000000-0000-0000-0000-000000000000';  -- UUID do owner
  v_team_name text := 'Operação B';
  v_team_slug text := 'operacao-b';
  v_team_description text := 'Segunda operação migrada';
  
  -- Variáveis de trabalho (não editar)
  v_team_id uuid;
  v_count integer;
BEGIN
  
  -- ========================================================================
  -- PASSO 2: Criar Team
  -- ========================================================================
  
  RAISE NOTICE '📦 Criando team...';
  
  INSERT INTO teams (team_name, slug, description, owner_id, is_active)
  VALUES (v_team_name, v_team_slug, v_team_description, v_owner_id, true)
  ON CONFLICT (slug) DO UPDATE 
  SET team_name = EXCLUDED.team_name
  RETURNING id INTO v_team_id;
  
  RAISE NOTICE '✅ Team criado com ID: %', v_team_id;
  
  -- ========================================================================
  -- PASSO 3: Migrar Sellers
  -- ========================================================================
  
  RAISE NOTICE '👥 Migrando sellers...';
  
  -- Verifica se tabela sellers2 existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sellers2') THEN
    
    INSERT INTO sellers (name, weight, team_id, created_at)
    SELECT 
      name,
      weight,
      v_team_id,
      created_at
    FROM sellers2
    ON CONFLICT DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '✅ % sellers migrados', v_count;
    
  ELSE
    RAISE NOTICE '⚠️  Tabela sellers2 não encontrada. Pulando...';
  END IF;
  
  -- ========================================================================
  -- PASSO 4: Migrar Seller Contacts
  -- ========================================================================
  
  RAISE NOTICE '📞 Migrando contatos...';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'seller_contacts2') THEN
    
    -- Usar nome do seller para mapear (assume nomes únicos)
    INSERT INTO seller_contacts (seller_id, phone_number, description, created_at)
    SELECT 
      s_new.id,
      sc2.phone_number,
      sc2.description,
      sc2.created_at
    FROM seller_contacts2 sc2
    JOIN sellers2 s_old ON sc2.seller_id = s_old.id
    JOIN sellers s_new ON s_old.name = s_new.name AND s_new.team_id = v_team_id
    ON CONFLICT DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '✅ % contatos migrados', v_count;
    
  ELSE
    RAISE NOTICE '⚠️  Tabela seller_contacts2 não encontrada. Pulando...';
  END IF;
  
  -- ========================================================================
  -- PASSO 5: Migrar Campaigns
  -- ========================================================================
  
  RAISE NOTICE '📢 Migrando campanhas...';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns2') THEN
    
    INSERT INTO campaigns (
      name, 
      slug, 
      full_slug, 
      greeting_message, 
      is_active, 
      team_id, 
      created_at
    )
    SELECT 
      name,
      slug,
      v_team_slug || '-' || slug,  -- Gera full_slug
      greeting_message,
      is_active,
      v_team_id,
      created_at
    FROM campaigns2
    ON CONFLICT (full_slug) DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '✅ % campanhas migradas', v_count;
    
  ELSE
    RAISE NOTICE '⚠️  Tabela campaigns2 não encontrada. Pulando...';
  END IF;
  
  -- ========================================================================
  -- PASSO 6: Migrar Clicks
  -- ========================================================================
  
  RAISE NOTICE '🖱️  Migrando clicks...';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clicks2') THEN
    
    -- Mapear IDs através de slug/nome
    INSERT INTO clicks (campaign_id, seller_id, team_id, created_at)
    SELECT 
      c_new.id,
      s_new.id,
      v_team_id,
      cl2.created_at
    FROM clicks2 cl2
    JOIN campaigns2 c2 ON cl2.campaign_id = c2.id
    JOIN sellers2 s2 ON cl2.seller_id = s2.id
    JOIN campaigns c_new ON c2.slug = c_new.slug AND c_new.team_id = v_team_id
    JOIN sellers s_new ON s2.name = s_new.name AND s_new.team_id = v_team_id
    ON CONFLICT DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '✅ % clicks migrados', v_count;
    
  ELSE
    RAISE NOTICE '⚠️  Tabela clicks2 não encontrada. Pulando...';
  END IF;
  
  -- ========================================================================
  -- PASSO 7: Resumo Final
  -- ========================================================================
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '✨ MIGRAÇÃO CONCLUÍDA!';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Team ID: %', v_team_id;
  RAISE NOTICE 'Team Slug: %', v_team_slug;
  RAISE NOTICE '';
  
  -- Contar registros migrados
  SELECT COUNT(*) INTO v_count FROM sellers WHERE team_id = v_team_id;
  RAISE NOTICE 'Sellers migrados: %', v_count;
  
  SELECT COUNT(*) INTO v_count 
  FROM seller_contacts sc
  JOIN sellers s ON sc.seller_id = s.id
  WHERE s.team_id = v_team_id;
  RAISE NOTICE 'Contatos migrados: %', v_count;
  
  SELECT COUNT(*) INTO v_count FROM campaigns WHERE team_id = v_team_id;
  RAISE NOTICE 'Campanhas migradas: %', v_count;
  
  SELECT COUNT(*) INTO v_count FROM clicks WHERE team_id = v_team_id;
  RAISE NOTICE 'Clicks migrados: %', v_count;
  
  RAISE NOTICE '';
  RAISE NOTICE '📋 Próximos passos:';
  RAISE NOTICE '1. Verificar dados em /settings/teams';
  RAISE NOTICE '2. Testar redirect: /r/%-%', v_team_slug, 'sua-campanha';
  RAISE NOTICE '3. Se tudo OK, pode remover tabelas *2';
  RAISE NOTICE '';
  
END $$;

-- ============================================================================
-- VERIFICAÇÃO: Execute para validar migração
-- ============================================================================

SELECT 
  t.team_name,
  t.slug,
  COUNT(DISTINCT s.id) as total_sellers,
  COUNT(DISTINCT sc.id) as total_contacts,
  COUNT(DISTINCT c.id) as total_campaigns,
  COUNT(DISTINCT cl.id) as total_clicks
FROM teams t
LEFT JOIN sellers s ON t.id = s.team_id
LEFT JOIN seller_contacts sc ON s.id = sc.seller_id
LEFT JOIN campaigns c ON t.id = c.team_id
LEFT JOIN clicks cl ON c.id = cl.campaign_id
GROUP BY t.id, t.team_name, t.slug
ORDER BY t.created_at;

-- ============================================================================
-- VERIFICAR FULL_SLUGS (não deve retornar linhas)
-- ============================================================================

SELECT 
  full_slug,
  COUNT(*) as duplicates,
  array_agg(id) as campaign_ids
FROM campaigns
GROUP BY full_slug
HAVING COUNT(*) > 1;

-- Se retornar duplicados, ajuste manualmente:
-- UPDATE campaigns SET full_slug = 'novo-slug-unico' WHERE id = 'uuid';

-- ============================================================================
-- LIMPEZA (OPCIONAL - Execute apenas após verificar que tudo está OK!)
-- ============================================================================

/*
-- ⚠️  ATENÇÃO: Isto remove permanentemente as tabelas antigas!
-- Só execute após confirmar que a migração foi 100% bem-sucedida

DROP TABLE IF EXISTS clicks2 CASCADE;
DROP TABLE IF EXISTS seller_contacts2 CASCADE;
DROP TABLE IF EXISTS campaigns2 CASCADE;
DROP TABLE IF EXISTS sellers2 CASCADE;

-- Confirme a remoção
RAISE NOTICE '🗑️  Tabelas antigas removidas com sucesso!';
*/
