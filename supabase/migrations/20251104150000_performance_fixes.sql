-- ============================================================================
-- PERFORMANCE FIX: Otimizações e correções críticas
-- ============================================================================

-- 1. Atualizar campanhas antigas sem full_slug
UPDATE campaigns
SET full_slug = (
  SELECT t.slug || '-' || campaigns.slug
  FROM teams t
  WHERE t.id = campaigns.team_id
)
WHERE full_slug IS NULL OR full_slug = '';

-- 2. Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_campaigns_full_slug ON campaigns(full_slug);
CREATE INDEX IF NOT EXISTS idx_campaigns_team_id ON campaigns(team_id);
CREATE INDEX IF NOT EXISTS idx_sellers_team_id ON sellers(team_id);
CREATE INDEX IF NOT EXISTS idx_clicks_campaign_id ON clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_clicks_seller_id ON clicks(seller_id);
CREATE INDEX IF NOT EXISTS idx_clicks_team_id ON clicks(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_seller_contacts_seller_id ON seller_contacts(seller_id);

-- 3. Garantir que todas as campanhas têm full_slug único
-- Se houver duplicados, adicionar sufixo
WITH duplicates AS (
  SELECT full_slug, ROW_NUMBER() OVER (PARTITION BY full_slug ORDER BY created_at) as rn, id
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

-- 4. Remover função obsoleta se existir
DROP FUNCTION IF EXISTS cleanup_all_data() CASCADE;

-- 5. Verificação final
DO $$
DECLARE
  v_campaigns_without_full_slug INT;
  v_duplicate_full_slugs INT;
BEGIN
  -- Contar campanhas sem full_slug
  SELECT COUNT(*) INTO v_campaigns_without_full_slug
  FROM campaigns
  WHERE full_slug IS NULL OR full_slug = '';
  
  -- Contar full_slugs duplicados
  SELECT COUNT(*) INTO v_duplicate_full_slugs
  FROM (
    SELECT full_slug
    FROM campaigns
    GROUP BY full_slug
    HAVING COUNT(*) > 1
  ) sub;
  
  IF v_campaigns_without_full_slug > 0 THEN
    RAISE WARNING '⚠️  Ainda existem % campanhas sem full_slug!', v_campaigns_without_full_slug;
  ELSE
    RAISE NOTICE '✅ Todas as campanhas têm full_slug';
  END IF;
  
  IF v_duplicate_full_slugs > 0 THEN
    RAISE WARNING '⚠️  Ainda existem % full_slugs duplicados!', v_duplicate_full_slugs;
  ELSE
    RAISE NOTICE '✅ Todos os full_slugs são únicos';
  END IF;
  
  RAISE NOTICE '✅ Índices criados para melhor performance';
  RAISE NOTICE '✅ Migration de performance aplicada!';
END $$;
