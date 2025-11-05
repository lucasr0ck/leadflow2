-- ============================================================================
-- DIAGNÓSTICO: VERIFICAR ESTRUTURA DAS TABELAS ANTIGAS
-- ============================================================================
-- Execute ANTES da migration para ver o que existe
-- ============================================================================

-- 1. Listar todas as tabelas que existem
SELECT 
  table_name,
  CASE 
    WHEN table_name LIKE '%2' THEN '⚠️ Tabela antiga (precisa migrar)'
    ELSE '✅ Tabela unificada'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'sellers', 'sellers2',
  'seller_contacts', 'seller_contacts2',
  'campaigns', 'campaigns2',
  'clicks', 'clicks2',
  'teams', 'teams2'
)
ORDER BY table_name;

-- ============================================================================
-- 2. CONTAR REGISTROS EM CADA TABELA
-- ============================================================================

DO $$
DECLARE
  v_count INT;
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'CONTAGEM DE REGISTROS';
  RAISE NOTICE '============================================================================';
  
  -- Sellers
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sellers') THEN
    SELECT COUNT(*) INTO v_count FROM sellers;
    RAISE NOTICE 'sellers: % registros', v_count;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sellers2') THEN
    SELECT COUNT(*) INTO v_count FROM sellers2;
    RAISE NOTICE 'sellers2: % registros ⚠️ PRECISA MIGRAR', v_count;
  END IF;
  
  -- Seller Contacts
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'seller_contacts') THEN
    SELECT COUNT(*) INTO v_count FROM seller_contacts;
    RAISE NOTICE 'seller_contacts: % registros', v_count;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'seller_contacts2') THEN
    SELECT COUNT(*) INTO v_count FROM seller_contacts2;
    RAISE NOTICE 'seller_contacts2: % registros ⚠️ PRECISA MIGRAR', v_count;
  END IF;
  
  -- Campaigns
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaigns') THEN
    SELECT COUNT(*) INTO v_count FROM campaigns;
    RAISE NOTICE 'campaigns: % registros', v_count;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaigns2') THEN
    SELECT COUNT(*) INTO v_count FROM campaigns2;
    RAISE NOTICE 'campaigns2: % registros ⚠️ PRECISA MIGRAR', v_count;
  END IF;
  
  -- Clicks
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clicks') THEN
    SELECT COUNT(*) INTO v_count FROM clicks;
    RAISE NOTICE 'clicks: % registros', v_count;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clicks2') THEN
    SELECT COUNT(*) INTO v_count FROM clicks2;
    RAISE NOTICE 'clicks2: % registros ⚠️ PRECISA MIGRAR', v_count;
  END IF;
  
  RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- 3. VER ESTRUTURA DAS TABELAS ANTIGAS
-- ============================================================================

-- Se sellers2 existir, mostrar primeiros registros
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sellers2') THEN
    RAISE NOTICE '';
    RAISE NOTICE '📦 VENDEDORES EM sellers2:';
    FOR rec IN 
      SELECT name, weight 
      FROM sellers2 
      ORDER BY name 
      LIMIT 5
    LOOP
      RAISE NOTICE '  - % (peso: %)', rec.name, rec.weight;
    END LOOP;
  END IF;
END $$;

-- Se seller_contacts2 existir, mostrar primeiros registros
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'seller_contacts2') THEN
    RAISE NOTICE '';
    RAISE NOTICE '📞 CONTATOS EM seller_contacts2:';
    FOR rec IN 
      SELECT sc.phone_number, s.name as seller_name
      FROM seller_contacts2 sc
      LEFT JOIN sellers2 s ON sc.seller_id = s.id
      ORDER BY s.name
      LIMIT 5
    LOOP
      RAISE NOTICE '  - % (vendedor: %)', rec.phone_number, rec.seller_name;
    END LOOP;
  END IF;
END $$;

-- Se campaigns2 existir, mostrar primeiros registros
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaigns2') THEN
    RAISE NOTICE '';
    RAISE NOTICE '📢 CAMPANHAS EM campaigns2:';
    FOR rec IN 
      SELECT name, slug, is_active 
      FROM campaigns2 
      ORDER BY name 
      LIMIT 5
    LOOP
      RAISE NOTICE '  - % (slug: %, ativo: %)', rec.name, rec.slug, rec.is_active;
    END LOOP;
  END IF;
END $$;

-- ============================================================================
-- 4. VERIFICAR OPERAÇÕES EXISTENTES
-- ============================================================================

SELECT 
  t.team_name,
  t.slug,
  (SELECT COUNT(*) FROM sellers WHERE team_id = t.id) as sellers_unificados,
  CASE 
    WHEN t.slug = 'gustavo-de-castro' THEN '⚠️ PRECISA RECEBER DADOS DE *2'
    ELSE '✅ OK'
  END as status
FROM teams t
ORDER BY t.team_name;

-- ============================================================================
-- 5. VERIFICAR SE SELLERS ATUAIS TÊM SUFIXO "2" NO NOME
-- ============================================================================

SELECT 
  t.team_name,
  s.name,
  s.weight,
  COUNT(sc.id) as contacts,
  CASE 
    WHEN s.name LIKE '%2' THEN '⚠️ Nome com sufixo 2'
    ELSE '✅ Nome normal'
  END as status
FROM sellers s
INNER JOIN teams t ON s.team_id = t.id
LEFT JOIN seller_contacts sc ON s.id = sc.seller_id
GROUP BY t.team_name, s.name, s.weight
ORDER BY t.team_name, s.name;
