-- =====================================================
-- MIGRATION: CREATE BASE TABLES
-- Data: 2025-07-01
-- Objetivo: Criar tabelas base do sistema
-- =====================================================

-- =====================================================
-- 1. CREATE TEAMS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);

-- =====================================================
-- 2. CREATE SELLERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1 CHECK (weight >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sellers_team_id ON sellers(team_id);

-- =====================================================
-- 3. CREATE SELLER_CONTACTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS seller_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  campaign_id UUID, -- Will be added later when campaigns table exists
  contact_url TEXT NOT NULL,
  phone_number TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE seller_contacts ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_seller_contacts_seller_id ON seller_contacts(seller_id);

-- =====================================================
-- 4. CREATE CAMPAIGNS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  greeting_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, slug)
);

-- Enable RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_team_id ON campaigns(team_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_slug ON campaigns(slug);

-- =====================================================
-- 5. CREATE CLICKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS clicks (
  id BIGSERIAL PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE clicks ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_clicks_campaign_id ON clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_clicks_seller_id ON clicks(seller_id);
CREATE INDEX IF NOT EXISTS idx_clicks_team_id ON clicks(team_id);
CREATE INDEX IF NOT EXISTS idx_clicks_created_at ON clicks(created_at);

-- =====================================================
-- 6. ADD FOREIGN KEY TO SELLER_CONTACTS
-- =====================================================

-- Add campaign_id foreign key constraint
ALTER TABLE seller_contacts 
DROP CONSTRAINT IF EXISTS seller_contacts_campaign_id_fkey;

ALTER TABLE seller_contacts 
ADD CONSTRAINT seller_contacts_campaign_id_fkey 
FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_seller_contacts_campaign_id ON seller_contacts(campaign_id);

-- =====================================================
-- 7. BASIC RLS POLICIES
-- =====================================================

-- Teams policies
CREATE POLICY "Users can view their own teams"
  ON teams FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create teams"
  ON teams FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own teams"
  ON teams FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own teams"
  ON teams FOR DELETE
  USING (owner_id = auth.uid());

-- Sellers policies
CREATE POLICY "Users can view sellers from their teams"
  ON sellers FOR SELECT
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Users can create sellers in their teams"
  ON sellers FOR INSERT
  WITH CHECK (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update sellers in their teams"
  ON sellers FOR UPDATE
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete sellers in their teams"
  ON sellers FOR DELETE
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

-- Seller contacts policies
CREATE POLICY "Users can view seller contacts from their teams"
  ON seller_contacts FOR SELECT
  USING (seller_id IN (
    SELECT s.id FROM sellers s
    INNER JOIN teams t ON s.team_id = t.id
    WHERE t.owner_id = auth.uid()
  ));

CREATE POLICY "Users can create seller contacts in their teams"
  ON seller_contacts FOR INSERT
  WITH CHECK (seller_id IN (
    SELECT s.id FROM sellers s
    INNER JOIN teams t ON s.team_id = t.id
    WHERE t.owner_id = auth.uid()
  ));

CREATE POLICY "Users can update seller contacts in their teams"
  ON seller_contacts FOR UPDATE
  USING (seller_id IN (
    SELECT s.id FROM sellers s
    INNER JOIN teams t ON s.team_id = t.id
    WHERE t.owner_id = auth.uid()
  ));

CREATE POLICY "Users can delete seller contacts in their teams"
  ON seller_contacts FOR DELETE
  USING (seller_id IN (
    SELECT s.id FROM sellers s
    INNER JOIN teams t ON s.team_id = t.id
    WHERE t.owner_id = auth.uid()
  ));

-- Campaigns policies
CREATE POLICY "Users can view campaigns from their teams"
  ON campaigns FOR SELECT
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Anyone can view active campaigns" 
  ON campaigns FOR SELECT
  USING (true);

CREATE POLICY "Users can create campaigns in their teams"
  ON campaigns FOR INSERT
  WITH CHECK (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update campaigns in their teams"
  ON campaigns FOR UPDATE
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete campaigns in their teams"
  ON campaigns FOR DELETE
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

-- Clicks policies
CREATE POLICY "Users can view clicks from their teams"
  ON clicks FOR SELECT
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Service can insert clicks"
  ON clicks FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sellers_updated_at BEFORE UPDATE ON sellers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seller_contacts_updated_at BEFORE UPDATE ON seller_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
