-- =====================================================
-- MIGRATION: MULTI-TENANT STRUCTURE
-- Data: 2025-11-04
-- Objetivo: Permitir múltiplas operações na mesma aplicação
-- =====================================================

-- =====================================================
-- 1. ADICIONAR CAMPOS NA TABELA TEAMS
-- =====================================================

-- Adicionar slug único para cada team (usado nos links)
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);

-- Gerar slugs para teams existentes baseado no team_name
UPDATE teams 
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(team_name, '[àáâãäå]', 'a', 'gi'),
    '[^a-zA-Z0-9]+', '-', 'g'
  )
)
WHERE slug IS NULL;

-- Garantir que slug não seja nulo no futuro
ALTER TABLE teams ALTER COLUMN slug SET NOT NULL;

-- =====================================================
-- 2. CRIAR TABELA TEAM_MEMBERS (Multi-tenant)
-- =====================================================

-- Relacionamento N:N entre usuários e teams
-- Permite que um usuário participe de múltiplas operações
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);

-- Comentários
COMMENT ON TABLE team_members IS 'Relacionamento entre usuários e teams (operações). Permite multi-tenant.';
COMMENT ON COLUMN team_members.role IS 'owner: criador do team, admin: gerencia membros, member: apenas usa';

-- =====================================================
-- 3. MIGRAR DADOS EXISTENTES
-- =====================================================

-- Adicionar owners existentes como membros com role 'owner'
INSERT INTO team_members (team_id, user_id, role)
SELECT id, owner_id, 'owner'
FROM teams
WHERE owner_id IS NOT NULL
ON CONFLICT (team_id, user_id) DO NOTHING;

-- =====================================================
-- 4. ADICIONAR FULL_SLUG NAS CAMPANHAS
-- =====================================================

-- Adicionar coluna para slug completo (team_slug + campaign_slug)
-- Isso garante que duas operações podem ter campanhas com mesmo nome
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS full_slug TEXT UNIQUE;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_campaigns_full_slug ON campaigns(full_slug);

-- Gerar full_slug para campanhas existentes
UPDATE campaigns c
SET full_slug = t.slug || '-' || c.slug
FROM teams t
WHERE c.team_id = t.id
AND c.full_slug IS NULL;

-- Garantir que full_slug não seja nulo no futuro
ALTER TABLE campaigns ALTER COLUMN full_slug SET NOT NULL;

-- =====================================================
-- 5. RLS POLICIES - TEAM_MEMBERS
-- =====================================================

-- Habilitar RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários veem apenas memberships que pertencem a eles
CREATE POLICY "Users can view their own team memberships"
ON team_members
FOR SELECT
USING (user_id = auth.uid());

-- Policy: Owners e admins podem adicionar membros
CREATE POLICY "Owners and admins can add team members"
ON team_members
FOR INSERT
WITH CHECK (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- Policy: Owners e admins podem atualizar membros
CREATE POLICY "Owners and admins can update team members"
ON team_members
FOR UPDATE
USING (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- Policy: Owners e admins podem remover membros (exceto owners)
CREATE POLICY "Owners and admins can remove team members"
ON team_members
FOR DELETE
USING (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
  AND role != 'owner' -- Não pode remover owners
);

-- =====================================================
-- 6. ATUALIZAR RLS POLICIES - TEAMS
-- =====================================================

-- Remover policies antigas
DROP POLICY IF EXISTS "Users can view their own team" ON teams;
DROP POLICY IF EXISTS "Users can create teams" ON teams;
DROP POLICY IF EXISTS "Users can update their own team" ON teams;

-- Nova policy: Usuários veem teams que são membros
CREATE POLICY "Users can view teams they belong to"
ON teams
FOR SELECT
USING (
  id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Qualquer usuário autenticado pode criar team
CREATE POLICY "Authenticated users can create teams"
ON teams
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Owners e admins podem atualizar team
CREATE POLICY "Owners and admins can update teams"
ON teams
FOR UPDATE
USING (
  id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- Policy: Apenas owners podem deletar team
CREATE POLICY "Only owners can delete teams"
ON teams
FOR DELETE
USING (
  id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid() 
    AND role = 'owner'
  )
);

-- =====================================================
-- 7. ATUALIZAR RLS POLICIES - SELLERS
-- =====================================================

-- Remover policy antiga
DROP POLICY IF EXISTS "Users can view sellers from their team" ON sellers;

-- Nova policy: Usuários veem sellers de teams que são membros
CREATE POLICY "Users can view sellers from teams they belong to"
ON sellers
FOR SELECT
USING (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- 8. ATUALIZAR RLS POLICIES - CAMPAIGNS
-- =====================================================

-- Remover policy antiga
DROP POLICY IF EXISTS "Users can view campaigns from their team" ON campaigns;

-- Nova policy: Usuários veem campaigns de teams que são membros
CREATE POLICY "Users can view campaigns from teams they belong to"
ON campaigns
FOR SELECT
USING (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- 9. ATUALIZAR RLS POLICIES - CLICKS
-- =====================================================

-- Remover policy antiga
DROP POLICY IF EXISTS "Users can view clicks from their team" ON clicks;

-- Nova policy: Usuários veem clicks de teams que são membros
CREATE POLICY "Users can view clicks from teams they belong to"
ON clicks
FOR SELECT
USING (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- 10. ATUALIZAR RLS POLICIES - SELLER_CONTACTS
-- =====================================================

-- Remover policy antiga se existir
DROP POLICY IF EXISTS "Users can view seller_contacts from their team" ON seller_contacts;

-- Nova policy: Usuários veem contacts de sellers de teams que são membros
CREATE POLICY "Users can view seller_contacts from teams they belong to"
ON seller_contacts
FOR SELECT
USING (
  seller_id IN (
    SELECT s.id 
    FROM sellers s
    INNER JOIN team_members tm ON s.team_id = tm.team_id
    WHERE tm.user_id = auth.uid()
  )
);

-- =====================================================
-- 11. ATUALIZAR RLS POLICIES - AUDIT_LOGS (se existir)
-- =====================================================

-- Verificar se tabela existe e criar policy
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'audit_logs') THEN
    -- Remover policy antiga se existir
    DROP POLICY IF EXISTS "Users can view audit_logs from their team" ON audit_logs;
    
    -- Nova policy: Usuários veem audit logs de teams que são membros
    EXECUTE 'CREATE POLICY "Users can view audit_logs from teams they belong to"
    ON audit_logs
    FOR SELECT
    USING (
      team_id IN (
        SELECT team_id 
        FROM team_members 
        WHERE user_id = auth.uid()
      )
    )';
  END IF;
END $$;

-- =====================================================
-- 12. FUNÇÃO AUXILIAR - VERIFICAR SE USUÁRIO É MEMBRO
-- =====================================================

-- Função para verificar se usuário pertence a um team
CREATE OR REPLACE FUNCTION is_team_member(team_id_param UUID, user_id_param UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM team_members 
    WHERE team_id = team_id_param 
    AND user_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário é owner/admin de um team
CREATE OR REPLACE FUNCTION is_team_admin(team_id_param UUID, user_id_param UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM team_members 
    WHERE team_id = team_id_param 
    AND user_id = user_id_param
    AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 13. TRIGGER - AUTO-ADICIONAR OWNER COMO MEMBRO
-- =====================================================

-- Quando um team é criado, adicionar o creator como owner
CREATE OR REPLACE FUNCTION auto_add_team_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (team_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_auto_add_team_owner ON teams;
CREATE TRIGGER trigger_auto_add_team_owner
  AFTER INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_team_owner();

-- =====================================================
-- 14. FUNÇÃO - OBTER TEAMS DO USUÁRIO
-- =====================================================

-- Função para listar todos os teams que o usuário pertence
CREATE OR REPLACE FUNCTION get_user_teams(user_id_param UUID DEFAULT auth.uid())
RETURNS TABLE (
  team_id UUID,
  team_name TEXT,
  team_slug TEXT,
  description TEXT,
  role TEXT,
  is_active BOOLEAN,
  member_count BIGINT,
  joined_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.team_name,
    t.slug,
    t.description,
    tm.role,
    t.is_active,
    (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count,
    tm.joined_at
  FROM teams t
  INNER JOIN team_members tm ON t.id = tm.team_id
  WHERE tm.user_id = user_id_param
  ORDER BY tm.role DESC, t.team_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 15. ATUALIZAR FUNÇÃO get_next_campaign_link
-- =====================================================

-- Atualizar para usar full_slug ao invés de slug
CREATE OR REPLACE FUNCTION get_next_campaign_link(campaign_slug_param TEXT)
RETURNS TABLE (
  seller_id UUID,
  seller_name TEXT,
  contact_url TEXT
) AS $$
DECLARE
  campaign_team_id UUID;
  campaign_id UUID;
BEGIN
  -- Buscar campanha pelo full_slug
  SELECT c.id, c.team_id INTO campaign_id, campaign_team_id
  FROM campaigns c
  WHERE c.full_slug = campaign_slug_param
  AND c.is_active = true;
  
  IF campaign_id IS NULL THEN
    RAISE EXCEPTION 'Campanha não encontrada ou inativa';
  END IF;

  -- Buscar próximo vendedor pela lógica de peso
  RETURN QUERY
  WITH seller_stats AS (
    SELECT 
      s.id,
      s.seller_name,
      s.weight,
      COALESCE(COUNT(cl.id), 0) as total_clicks
    FROM sellers s
    LEFT JOIN clicks cl ON s.id = cl.seller_id
    WHERE s.team_id = campaign_team_id
    AND s.is_active = true
    GROUP BY s.id, s.seller_name, s.weight
  ),
  weighted_sellers AS (
    SELECT 
      ss.id,
      ss.seller_name,
      ss.weight,
      ss.total_clicks,
      CASE 
        WHEN ss.weight = 0 THEN 999999
        ELSE ss.total_clicks::float / ss.weight
      END as ratio
    FROM seller_stats ss
  )
  SELECT 
    ws.id,
    ws.seller_name,
    sc.contact_url
  FROM weighted_sellers ws
  INNER JOIN seller_contacts sc ON ws.id = sc.seller_id
  WHERE sc.campaign_id = campaign_id
  ORDER BY ws.ratio ASC, RANDOM()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================

-- Verificações finais
DO $$ 
BEGIN
  RAISE NOTICE '✅ Migration concluída com sucesso!';
  RAISE NOTICE '📊 Teams com slug: %', (SELECT COUNT(*) FROM teams WHERE slug IS NOT NULL);
  RAISE NOTICE '👥 Team members criados: %', (SELECT COUNT(*) FROM team_members);
  RAISE NOTICE '🔗 Campanhas com full_slug: %', (SELECT COUNT(*) FROM campaigns WHERE full_slug IS NOT NULL);
END $$;
