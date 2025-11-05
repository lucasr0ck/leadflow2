-- =====================================================
-- MIGRATION: VERIFICAÇÃO E CRIAÇÃO DE ESTRUTURA COMPLETA
-- Data: 2025-11-05
-- Objetivo: Garantir que TODAS as tabelas e estruturas existem
-- =====================================================

-- =====================================================
-- 1. VERIFICAR E CRIAR TABELA TEAMS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'teams') THEN
    RAISE NOTICE 'Criando tabela teams...';
    
    CREATE TABLE teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_name TEXT NOT NULL,
      owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
    CREATE INDEX idx_teams_owner_id ON teams(owner_id);
    
    RAISE NOTICE 'Tabela teams criada!';
  ELSE
    RAISE NOTICE 'Tabela teams já existe';
  END IF;
END $$;

-- =====================================================
-- 2. VERIFICAR E CRIAR TABELA TEAM_MEMBERS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'team_members') THEN
    RAISE NOTICE 'Criando tabela team_members...';
    
    CREATE TABLE team_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(team_id, user_id)
    );

    ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
    CREATE INDEX idx_team_members_team_id ON team_members(team_id);
    CREATE INDEX idx_team_members_user_id ON team_members(user_id);
    
    RAISE NOTICE 'Tabela team_members criada!';
  ELSE
    RAISE NOTICE 'Tabela team_members já existe';
  END IF;
END $$;

-- =====================================================
-- 3. VERIFICAR E CRIAR TABELA SELLERS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sellers') THEN
    RAISE NOTICE 'Criando tabela sellers...';
    
    CREATE TABLE sellers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      weight INTEGER NOT NULL DEFAULT 1 CHECK (weight >= 0),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
    CREATE INDEX idx_sellers_team_id ON sellers(team_id);
    CREATE INDEX idx_sellers_is_active ON sellers(is_active);
    
    RAISE NOTICE 'Tabela sellers criada!';
  ELSE
    RAISE NOTICE 'Tabela sellers já existe';
    
    -- Adicionar coluna is_active se não existir
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'sellers' AND column_name = 'is_active'
    ) THEN
      RAISE NOTICE 'Adicionando coluna is_active na tabela sellers...';
      ALTER TABLE sellers ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
  END IF;
END $$;

-- =====================================================
-- 4. VERIFICAR E CRIAR TABELA CAMPAIGNS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaigns') THEN
    RAISE NOTICE 'Criando tabela campaigns...';
    
    CREATE TABLE campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      full_slug TEXT,
      team_slug TEXT,
      redirect_url TEXT NOT NULL,
      greeting_message TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(team_id, slug)
    );

    ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
    CREATE INDEX idx_campaigns_team_id ON campaigns(team_id);
    CREATE INDEX idx_campaigns_slug ON campaigns(slug);
    CREATE INDEX idx_campaigns_full_slug ON campaigns(full_slug);
    CREATE INDEX idx_campaigns_is_active ON campaigns(is_active);
    
    RAISE NOTICE 'Tabela campaigns criada!';
  ELSE
    RAISE NOTICE 'Tabela campaigns já existe';
    
    -- Adicionar colunas se não existirem
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'campaigns' AND column_name = 'full_slug'
    ) THEN
      RAISE NOTICE 'Adicionando coluna full_slug na tabela campaigns...';
      ALTER TABLE campaigns ADD COLUMN full_slug TEXT;
      CREATE INDEX idx_campaigns_full_slug ON campaigns(full_slug);
    END IF;
    
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'campaigns' AND column_name = 'team_slug'
    ) THEN
      RAISE NOTICE 'Adicionando coluna team_slug na tabela campaigns...';
      ALTER TABLE campaigns ADD COLUMN team_slug TEXT;
    END IF;
    
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'campaigns' AND column_name = 'redirect_url'
    ) THEN
      RAISE NOTICE 'Adicionando coluna redirect_url na tabela campaigns...';
      ALTER TABLE campaigns ADD COLUMN redirect_url TEXT NOT NULL DEFAULT '';
    END IF;
    
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'campaigns' AND column_name = 'is_active'
    ) THEN
      RAISE NOTICE 'Adicionando coluna is_active na tabela campaigns...';
      ALTER TABLE campaigns ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
  END IF;
END $$;

-- =====================================================
-- 5. VERIFICAR E CRIAR TABELA SELLER_CONTACTS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'seller_contacts') THEN
    RAISE NOTICE 'Criando tabela seller_contacts...';
    
    CREATE TABLE seller_contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
      contact_url TEXT NOT NULL,
      phone_number TEXT,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    ALTER TABLE seller_contacts ENABLE ROW LEVEL SECURITY;
    CREATE INDEX idx_seller_contacts_seller_id ON seller_contacts(seller_id);
    CREATE INDEX idx_seller_contacts_campaign_id ON seller_contacts(campaign_id);
    
    RAISE NOTICE 'Tabela seller_contacts criada!';
  ELSE
    RAISE NOTICE 'Tabela seller_contacts já existe';
  END IF;
END $$;

-- =====================================================
-- 6. VERIFICAR E CRIAR TABELA CLICKS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'clicks') THEN
    RAISE NOTICE 'Criando tabela clicks...';
    
    CREATE TABLE clicks (
      id BIGSERIAL PRIMARY KEY,
      campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      clicked_at TIMESTAMPTZ DEFAULT now(),
      created_at TIMESTAMPTZ DEFAULT now()
    );

    ALTER TABLE clicks ENABLE ROW LEVEL SECURITY;
    CREATE INDEX idx_clicks_campaign_id ON clicks(campaign_id);
    CREATE INDEX idx_clicks_seller_id ON clicks(seller_id);
    CREATE INDEX idx_clicks_team_id ON clicks(team_id);
    CREATE INDEX idx_clicks_clicked_at ON clicks(clicked_at);
    CREATE INDEX idx_clicks_created_at ON clicks(created_at);
    
    RAISE NOTICE 'Tabela clicks criada!';
  ELSE
    RAISE NOTICE 'Tabela clicks já existe';
    
    -- Adicionar coluna clicked_at se não existir
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'clicks' AND column_name = 'clicked_at'
    ) THEN
      RAISE NOTICE 'Adicionando coluna clicked_at na tabela clicks...';
      ALTER TABLE clicks ADD COLUMN clicked_at TIMESTAMPTZ DEFAULT now();
      CREATE INDEX idx_clicks_clicked_at ON clicks(clicked_at);
    END IF;
  END IF;
END $$;

-- =====================================================
-- 7. VERIFICAR E CRIAR TABELA AUDIT_LOGS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
    RAISE NOTICE 'Criando tabela audit_logs...';
    
    CREATE TABLE audit_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
      action_type TEXT NOT NULL,
      table_name TEXT,
      record_id UUID,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
    CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX idx_audit_logs_team_id ON audit_logs(team_id);
    CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
    CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
    
    RAISE NOTICE 'Tabela audit_logs criada!';
  ELSE
    RAISE NOTICE 'Tabela audit_logs já existe';
  END IF;
END $$;

-- =====================================================
-- 8. POLÍTICAS RLS BÁSICAS
-- =====================================================

-- Teams policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their teams" ON teams;
  CREATE POLICY "Users can view their teams"
    ON teams FOR SELECT
    USING (
      owner_id = auth.uid() OR 
      id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    );

  DROP POLICY IF EXISTS "Users can create teams" ON teams;
  CREATE POLICY "Users can create teams"
    ON teams FOR INSERT
    WITH CHECK (owner_id = auth.uid());

  DROP POLICY IF EXISTS "Users can update their teams" ON teams;
  CREATE POLICY "Users can update their teams"
    ON teams FOR UPDATE
    USING (
      owner_id = auth.uid() OR 
      id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    );

  DROP POLICY IF EXISTS "Users can delete their teams" ON teams;
  CREATE POLICY "Users can delete their teams"
    ON teams FOR DELETE
    USING (owner_id = auth.uid());
END $$;

-- Sellers policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view sellers from their teams" ON sellers;
  CREATE POLICY "Users can view sellers from their teams"
    ON sellers FOR SELECT
    USING (
      team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "Users can manage sellers" ON sellers;
  CREATE POLICY "Users can manage sellers"
    ON sellers FOR ALL
    USING (
      team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    );
END $$;

-- Campaigns policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view campaigns from their teams" ON campaigns;
  CREATE POLICY "Users can view campaigns from their teams"
    ON campaigns FOR SELECT
    USING (
      team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "Anyone can view campaigns for redirect" ON campaigns;
  CREATE POLICY "Anyone can view campaigns for redirect"
    ON campaigns FOR SELECT
    USING (true);

  DROP POLICY IF EXISTS "Users can manage campaigns" ON campaigns;
  CREATE POLICY "Users can manage campaigns"
    ON campaigns FOR ALL
    USING (
      team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    );
END $$;

-- Clicks policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view clicks from their teams" ON clicks;
  CREATE POLICY "Users can view clicks from their teams"
    ON clicks FOR SELECT
    USING (
      team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "Service can insert clicks" ON clicks;
  CREATE POLICY "Service can insert clicks"
    ON clicks FOR INSERT
    WITH CHECK (true);
END $$;

-- =====================================================
-- 9. FUNÇÕES AUXILIARES
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at (se não existirem)
DO $$
BEGIN
  DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
  CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_sellers_updated_at ON sellers;
  CREATE TRIGGER update_sellers_updated_at BEFORE UPDATE ON sellers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
  CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_seller_contacts_updated_at ON seller_contacts;
  CREATE TRIGGER update_seller_contacts_updated_at BEFORE UPDATE ON seller_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================

-- Mensagem final
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION COMPLETA!';
  RAISE NOTICE 'Todas as tabelas foram verificadas/criadas';
  RAISE NOTICE '========================================';
END $$;
