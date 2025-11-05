-- =====================================================
-- MIGRATION: Fix Multi-Tenant Data Isolation Issues
-- Data: 2025-11-05
-- Objetivo: Corrigir vazamento de dados entre operações
-- =====================================================

-- =====================================================
-- 1. REMOVER POLICY CONFLITANTE DE CAMPAIGNS
-- =====================================================

-- Esta policy estava permitindo que qualquer pessoa visse todas as campanhas
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON campaigns;

-- =====================================================
-- 2. ADICIONAR POLICIES INSERT/UPDATE/DELETE - SELLERS
-- =====================================================

-- Remover policies antigas que usam owner_id
DROP POLICY IF EXISTS "Users can create sellers in their teams" ON sellers;
DROP POLICY IF EXISTS "Users can update sellers in their teams" ON sellers;
DROP POLICY IF EXISTS "Users can delete sellers in their teams" ON sellers;

-- Novas policies usando team_members
CREATE POLICY "Users can create sellers in teams they belong to"
ON sellers FOR INSERT
WITH CHECK (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Users can update sellers in teams they belong to"
ON sellers FOR UPDATE
USING (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Users can delete sellers in teams they belong to"
ON sellers FOR DELETE
USING (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- =====================================================
-- 3. ADICIONAR POLICIES INSERT/UPDATE/DELETE - CAMPAIGNS
-- =====================================================

-- Remover policies antigas que usam owner_id
DROP POLICY IF EXISTS "Users can create campaigns in their teams" ON campaigns;
DROP POLICY IF EXISTS "Users can update campaigns in their teams" ON campaigns;
DROP POLICY IF EXISTS "Users can delete campaigns in their teams" ON campaigns;

-- Novas policies usando team_members
CREATE POLICY "Users can create campaigns in teams they belong to"
ON campaigns FOR INSERT
WITH CHECK (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Users can update campaigns in teams they belong to"
ON campaigns FOR UPDATE
USING (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Users can delete campaigns in teams they belong to"
ON campaigns FOR DELETE
USING (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- =====================================================
-- 4. ADICIONAR POLICIES INSERT/UPDATE/DELETE - SELLER_CONTACTS
-- =====================================================

-- Remover policies antigas que usam owner_id
DROP POLICY IF EXISTS "Users can create seller contacts in their teams" ON seller_contacts;
DROP POLICY IF EXISTS "Users can update seller contacts in their teams" ON seller_contacts;
DROP POLICY IF EXISTS "Users can delete seller contacts in their teams" ON seller_contacts;

-- Novas policies usando team_members
CREATE POLICY "Users can create seller_contacts in teams they belong to"
ON seller_contacts FOR INSERT
WITH CHECK (
  seller_id IN (
    SELECT s.id 
    FROM sellers s
    INNER JOIN team_members tm ON s.team_id = tm.team_id
    WHERE tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Users can update seller_contacts in teams they belong to"
ON seller_contacts FOR UPDATE
USING (
  seller_id IN (
    SELECT s.id 
    FROM sellers s
    INNER JOIN team_members tm ON s.team_id = tm.team_id
    WHERE tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Users can delete seller_contacts in teams they belong to"
ON seller_contacts FOR DELETE
USING (
  seller_id IN (
    SELECT s.id 
    FROM sellers s
    INNER JOIN team_members tm ON s.team_id = tm.team_id
    WHERE tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin')
  )
);

-- =====================================================
-- 5. PREVENIR MUDANÇAS NO team_id (INTEGRIDADE DE DADOS)
-- =====================================================

-- Função para prevenir alteração de team_id após criação
CREATE OR REPLACE FUNCTION prevent_team_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.team_id IS DISTINCT FROM NEW.team_id THEN
    RAISE EXCEPTION 'team_id cannot be changed after creation for data integrity';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para prevenir mudança de team_id
DROP TRIGGER IF EXISTS prevent_sellers_team_change ON sellers;
CREATE TRIGGER prevent_sellers_team_change
  BEFORE UPDATE ON sellers
  FOR EACH ROW
  EXECUTE FUNCTION prevent_team_id_change();

DROP TRIGGER IF EXISTS prevent_campaigns_team_change ON campaigns;
CREATE TRIGGER prevent_campaigns_team_change
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION prevent_team_id_change();

DROP TRIGGER IF EXISTS prevent_clicks_team_change ON clicks;
CREATE TRIGGER prevent_clicks_team_change
  BEFORE UPDATE ON clicks
  FOR EACH ROW
  EXECUTE FUNCTION prevent_team_id_change();

-- =====================================================
-- 6. ADICIONAR ÍNDICES PARA PERFORMANCE MULTI-TENANT
-- =====================================================

-- Índice composto para lookup de team_members (consulta mais comum)
CREATE INDEX IF NOT EXISTS idx_team_members_user_team 
ON team_members(user_id, team_id);

-- Índice composto para analytics de clicks
CREATE INDEX IF NOT EXISTS idx_clicks_team_campaign_date 
ON clicks(team_id, campaign_id, created_at DESC);

-- Índice composto para lookup de seller_contacts
CREATE INDEX IF NOT EXISTS idx_seller_contacts_seller_campaign 
ON seller_contacts(seller_id, campaign_id);

-- =====================================================
-- 7. VALIDAÇÃO DE INTEGRIDADE DE DADOS
-- =====================================================

-- Verificar clicks com team_id incompatível
DO $$ 
DECLARE
  mismatched_clicks INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatched_clicks
  FROM clicks cl
  INNER JOIN campaigns c ON cl.campaign_id = c.id
  WHERE cl.team_id != c.team_id;
  
  IF mismatched_clicks > 0 THEN
    RAISE NOTICE '⚠️ AVISO: % clicks encontrados com team_id incompatível com a campanha', mismatched_clicks;
    
    -- Corrigir automaticamente
    UPDATE clicks cl
    SET team_id = c.team_id
    FROM campaigns c
    WHERE cl.campaign_id = c.id
    AND cl.team_id != c.team_id;
    
    RAISE NOTICE '✅ Clicks corrigidos automaticamente';
  ELSE
    RAISE NOTICE '✅ Nenhum click com team_id incompatível';
  END IF;
END $$;

-- Verificar seller_contacts com team_id incompatível
DO $$ 
DECLARE
  mismatched_contacts INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatched_contacts
  FROM seller_contacts sc
  INNER JOIN sellers s ON sc.seller_id = s.id
  INNER JOIN campaigns c ON sc.campaign_id = c.id
  WHERE s.team_id != c.team_id;
  
  IF mismatched_contacts > 0 THEN
    RAISE WARNING '⚠️ AVISO: % seller_contacts encontrados com team_id incompatível!', mismatched_contacts;
    RAISE NOTICE 'Execute manualmente: SELECT * FROM seller_contacts sc INNER JOIN sellers s ON sc.seller_id = s.id INNER JOIN campaigns c ON sc.campaign_id = c.id WHERE s.team_id != c.team_id;';
  ELSE
    RAISE NOTICE '✅ Nenhum seller_contact com team_id incompatível';
  END IF;
END $$;

-- Verificar teams sem membros
DO $$ 
DECLARE
  teams_without_members INTEGER;
BEGIN
  SELECT COUNT(*) INTO teams_without_members
  FROM teams t
  WHERE NOT EXISTS (
    SELECT 1 FROM team_members tm 
    WHERE tm.team_id = t.id
  );
  
  IF teams_without_members > 0 THEN
    RAISE WARNING '⚠️ AVISO: % teams encontrados sem membros!', teams_without_members;
  ELSE
    RAISE NOTICE '✅ Todos os teams têm pelo menos um membro';
  END IF;
END $$;

-- =====================================================
-- 8. FUNÇÃO PÚBLICA PARA REDIRECT (BYPASS RLS)
-- =====================================================

-- Esta função permite acesso público aos redirect URLs
-- Ela bypassa RLS usando SECURITY DEFINER
CREATE OR REPLACE FUNCTION public_get_campaign_redirect(campaign_full_slug TEXT)
RETURNS TABLE (
  campaign_id UUID,
  campaign_name TEXT,
  is_active BOOLEAN,
  greeting_message TEXT
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.is_active,
    c.greeting_message
  FROM campaigns c
  WHERE c.full_slug = campaign_full_slug;
END;
$$ LANGUAGE plpgsql;

-- Comentário explicativo
COMMENT ON FUNCTION public_get_campaign_redirect IS 
'Permite acesso público a campanhas via redirect URL. Usa SECURITY DEFINER para bypass RLS.';

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================

-- Log final
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration de correção multi-tenant aplicada com sucesso!';
  RAISE NOTICE '📊 Policies RLS atualizadas para usar team_members';
  RAISE NOTICE '🔒 Proteção contra mudança de team_id ativada';
  RAISE NOTICE '⚡ Índices de performance criados';
  RAISE NOTICE '✨ Integridade de dados verificada';
  RAISE NOTICE '========================================';
END $$;
