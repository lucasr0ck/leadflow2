-- ============================================================================
-- VERIFICAÇÃO COMPLETA DO SISTEMA DE REDIRECT
-- ============================================================================
-- Execute no Supabase SQL Editor para diagnosticar problemas
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR CAMPANHAS E FULL_SLUG
-- ============================================================================

SELECT 
  t.team_name,
  c.name as campaign_name,
  c.slug,
  c.full_slug,
  c.is_active,
  c.greeting_message,
  CASE 
    WHEN c.full_slug IS NULL THEN '❌ full_slug é NULL!'
    WHEN c.full_slug = '' THEN '❌ full_slug está vazio!'
    WHEN c.full_slug NOT LIKE t.slug || '-%' THEN '⚠️ full_slug não começa com team slug!'
    ELSE '✅ OK'
  END as status
FROM campaigns c
INNER JOIN teams t ON c.team_id = t.id
ORDER BY t.team_name, c.name;

-- ============================================================================
-- 2. VERIFICAR VENDEDORES E CONTATOS
-- ============================================================================

SELECT 
  t.team_name,
  s.name as seller_name,
  s.weight,
  COUNT(sc.id) as contacts_count,
  CASE 
    WHEN COUNT(sc.id) = 0 THEN '❌ Sem contatos!'
    WHEN COUNT(sc.id) = 1 THEN '⚠️ Apenas 1 contato'
    ELSE '✅ OK'
  END as status
FROM sellers s
INNER JOIN teams t ON s.team_id = t.id
LEFT JOIN seller_contacts sc ON s.id = sc.seller_id
GROUP BY t.team_name, s.name, s.weight
ORDER BY t.team_name, s.name;

-- ============================================================================
-- 3. LISTAR TODOS OS CONTATOS
-- ============================================================================

SELECT 
  t.team_name,
  s.name as seller_name,
  sc.phone_number,
  sc.description,
  CASE 
    WHEN sc.phone_number IS NULL THEN '❌ Telefone NULL!'
    WHEN sc.phone_number = '' THEN '❌ Telefone vazio!'
    WHEN sc.phone_number !~ '^[0-9]+$' THEN '⚠️ Telefone com caracteres inválidos'
    WHEN LENGTH(sc.phone_number) < 10 THEN '⚠️ Telefone muito curto'
    ELSE '✅ OK'
  END as status
FROM seller_contacts sc
INNER JOIN sellers s ON sc.seller_id = s.id
INNER JOIN teams t ON s.team_id = t.id
ORDER BY t.team_name, s.name;

-- ============================================================================
-- 4. VERIFICAR DISTRIBUIÇÃO DE CLICKS
-- ============================================================================

SELECT 
  t.team_name,
  c.name as campaign_name,
  s.name as seller_name,
  COUNT(cl.id) as total_clicks,
  ROUND(COUNT(cl.id) * 100.0 / NULLIF((
    SELECT COUNT(*) FROM clicks WHERE campaign_id = c.id
  ), 0), 2) as percentage
FROM campaigns c
INNER JOIN teams t ON c.team_id = t.id
LEFT JOIN clicks cl ON c.id = cl.campaign_id
LEFT JOIN sellers s ON cl.seller_id = s.id
GROUP BY t.team_name, c.name, s.name, c.id
ORDER BY t.team_name, c.name, total_clicks DESC;

-- ============================================================================
-- 5. SIMULAR PRÓXIMO REDIRECT
-- ============================================================================

-- Para cada campanha, mostra qual vendedor receberá o próximo click
WITH campaign_clicks AS (
  SELECT 
    c.id as campaign_id,
    c.name as campaign_name,
    c.full_slug,
    t.team_name,
    COUNT(cl.id) as total_clicks
  FROM campaigns c
  INNER JOIN teams t ON c.team_id = t.id
  LEFT JOIN clicks cl ON c.id = cl.campaign_id
  WHERE c.is_active = true
  GROUP BY c.id, c.name, c.full_slug, t.team_name
),
sellers_per_team AS (
  SELECT 
    s.team_id,
    s.id as seller_id,
    s.name as seller_name,
    ROW_NUMBER() OVER (PARTITION BY s.team_id ORDER BY s.created_at) - 1 as seller_index,
    COUNT(*) OVER (PARTITION BY s.team_id) as sellers_count
  FROM sellers s
)
SELECT 
  cc.team_name,
  cc.campaign_name,
  cc.full_slug,
  cc.total_clicks,
  s.seller_name as next_seller,
  s.seller_index,
  s.sellers_count,
  (cc.total_clicks % s.sellers_count) as expected_index,
  CASE 
    WHEN (cc.total_clicks % s.sellers_count) = s.seller_index THEN '✅ Este receberá o próximo'
    ELSE '⏭️ Próximo na fila'
  END as status
FROM campaign_clicks cc
INNER JOIN campaigns c ON cc.campaign_id = c.id
INNER JOIN sellers_per_team s ON c.team_id = s.team_id
ORDER BY cc.team_name, cc.campaign_name, s.seller_index;

-- ============================================================================
-- 6. VERIFICAR EDGE FUNCTION (testável via query)
-- ============================================================================

-- Esta query simula a lógica da edge function
-- Teste com um full_slug real:
DO $$
DECLARE
  v_full_slug TEXT := 'caio-martins-ig-bio'; -- ✏️ AJUSTE ESTE SLUG
  v_campaign RECORD;
  v_sellers RECORD[];
  v_click_count INT;
  v_seller_index INT;
  v_selected_seller RECORD;
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'SIMULAÇÃO DE REDIRECT PARA: %', v_full_slug;
  RAISE NOTICE '============================================================================';
  
  -- Buscar campanha
  SELECT * INTO v_campaign
  FROM campaigns
  WHERE full_slug = v_full_slug AND is_active = true;
  
  IF NOT FOUND THEN
    RAISE NOTICE '❌ Campanha não encontrada ou inativa!';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ Campanha encontrada: % (ID: %)', v_campaign.name, v_campaign.id;
  RAISE NOTICE '   Mensagem: %', v_campaign.greeting_message;
  RAISE NOTICE '';
  
  -- Contar clicks totais
  SELECT COUNT(*) INTO v_click_count
  FROM clicks
  WHERE campaign_id = v_campaign.id;
  
  RAISE NOTICE '📊 Total de clicks: %', v_click_count;
  RAISE NOTICE '';
  
  -- Buscar vendedores
  SELECT COUNT(*) INTO v_seller_index
  FROM sellers
  WHERE team_id = v_campaign.team_id;
  
  IF v_seller_index = 0 THEN
    RAISE NOTICE '❌ Nenhum vendedor encontrado!';
    RETURN;
  END IF;
  
  RAISE NOTICE '👥 Vendedores disponíveis: %', v_seller_index;
  
  -- Calcular próximo vendedor
  v_seller_index := v_click_count % v_seller_index;
  
  RAISE NOTICE '🎯 Próximo vendedor (index): %', v_seller_index;
  RAISE NOTICE '';
  
  -- Selecionar vendedor
  SELECT s.*, COUNT(sc.id) as contacts_count
  INTO v_selected_seller
  FROM sellers s
  LEFT JOIN seller_contacts sc ON s.id = sc.seller_id
  WHERE s.team_id = v_campaign.team_id
  GROUP BY s.id
  ORDER BY s.created_at
  LIMIT 1 OFFSET v_seller_index;
  
  RAISE NOTICE '✅ Vendedor selecionado: %', v_selected_seller.name;
  RAISE NOTICE '   ID: %', v_selected_seller.id;
  RAISE NOTICE '   Contatos: %', v_selected_seller.contacts_count;
  RAISE NOTICE '';
  
  IF v_selected_seller.contacts_count = 0 THEN
    RAISE NOTICE '❌ Vendedor sem contatos!';
    RETURN;
  END IF;
  
  -- Contar clicks do vendedor
  SELECT COUNT(*) INTO v_click_count
  FROM clicks
  WHERE campaign_id = v_campaign.id AND seller_id = v_selected_seller.id;
  
  RAISE NOTICE '📞 Clicks do vendedor: %', v_click_count;
  
  -- Selecionar contato
  v_seller_index := v_click_count % v_selected_seller.contacts_count;
  
  RAISE NOTICE '🎯 Próximo contato (index): %', v_seller_index;
  RAISE NOTICE '';
  
  -- Mostrar contato
  FOR v_selected_seller IN 
    SELECT phone_number, description
    FROM seller_contacts
    WHERE seller_id = v_selected_seller.id
    ORDER BY created_at
    LIMIT 1 OFFSET v_seller_index
  LOOP
    RAISE NOTICE '✅ Contato selecionado: %', v_selected_seller.phone_number;
    RAISE NOTICE '   Descrição: %', v_selected_seller.description;
    RAISE NOTICE '';
    RAISE NOTICE '🔗 URL WhatsApp:';
    RAISE NOTICE 'https://wa.me/%?text=%', 
      REGEXP_REPLACE(v_selected_seller.phone_number, '[^0-9]', '', 'g'),
      v_campaign.greeting_message;
  END LOOP;
  
  RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- 7. CORRIGIR PROBLEMAS COMUNS
-- ============================================================================

-- Corrigir full_slug se estiver NULL ou vazio
UPDATE campaigns c
SET full_slug = t.slug || '-' || c.slug
FROM teams t
WHERE c.team_id = t.id
AND (c.full_slug IS NULL OR c.full_slug = '');

-- Verificar quantas campanhas foram corrigidas
SELECT 
  'Campanhas com full_slug corrigido' as status,
  COUNT(*) as count
FROM campaigns
WHERE full_slug IS NOT NULL AND full_slug != '';

-- ============================================================================
-- 8. RESUMO FINAL
-- ============================================================================

DO $$
DECLARE
  v_campaigns INT;
  v_campaigns_ok INT;
  v_sellers INT;
  v_sellers_ok INT;
  v_contacts INT;
  v_clicks INT;
BEGIN
  SELECT COUNT(*) INTO v_campaigns FROM campaigns WHERE is_active = true;
  SELECT COUNT(*) INTO v_campaigns_ok FROM campaigns WHERE is_active = true AND full_slug IS NOT NULL AND full_slug != '';
  SELECT COUNT(*) INTO v_sellers FROM sellers;
  SELECT COUNT(*) INTO v_sellers_ok FROM sellers WHERE id IN (SELECT DISTINCT seller_id FROM seller_contacts);
  SELECT COUNT(*) INTO v_contacts FROM seller_contacts;
  SELECT COUNT(*) INTO v_clicks FROM clicks;
  
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'RESUMO DO SISTEMA';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Campanhas ativas: % (%/%)', 
    CASE WHEN v_campaigns = v_campaigns_ok THEN '✅' ELSE '⚠️' END,
    v_campaigns_ok, v_campaigns;
  RAISE NOTICE 'Vendedores com contatos: % (%/%)', 
    CASE WHEN v_sellers = v_sellers_ok THEN '✅' ELSE '⚠️' END,
    v_sellers_ok, v_sellers;
  RAISE NOTICE 'Total de contatos: %', v_contacts;
  RAISE NOTICE 'Total de clicks registrados: %', v_clicks;
  RAISE NOTICE '============================================================================';
END $$;
