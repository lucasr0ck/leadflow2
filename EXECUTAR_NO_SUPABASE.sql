-- ========================================
-- EXECUTAR ESTE SQL NO SUPABASE DASHBOARD
-- SQL Editor > New Query > Cole este código > Run
-- ========================================

-- ========================================
-- PARTE 1: SISTEMA DE AUDITORIA
-- ========================================

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  user_agent TEXT,
  ip_address TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_logs;

-- Create policies
CREATE POLICY "Users can read their own audit logs"
  ON audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- ========================================
-- PARTE 2: FUNÇÕES RPC PARA ANALYTICS
-- ========================================

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clicks_created_at ON clicks(created_at);
CREATE INDEX IF NOT EXISTS idx_clicks_campaign_created ON clicks(campaign_id, created_at);
CREATE INDEX IF NOT EXISTS idx_clicks_seller_created ON clicks(seller_id, created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_team_id ON campaigns(team_id);
CREATE INDEX IF NOT EXISTS idx_sellers_team_id ON sellers(team_id);

-- Function 1: Get campaign analytics
CREATE OR REPLACE FUNCTION get_campaign_analytics(
  team_id_param UUID,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  campaign_id UUID,
  campaign_name TEXT,
  campaign_slug TEXT,
  total_clicks BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS campaign_id,
    c.name AS campaign_name,
    c.slug AS campaign_slug,
    COUNT(cl.id) AS total_clicks
  FROM campaigns c
  LEFT JOIN clicks cl ON cl.campaign_id = c.id
    AND cl.created_at >= start_date
    AND cl.created_at <= end_date
  WHERE c.team_id = team_id_param
  GROUP BY c.id, c.name, c.slug
  ORDER BY total_clicks DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Get seller analytics
CREATE OR REPLACE FUNCTION get_seller_analytics(
  team_id_param UUID,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  seller_id UUID,
  seller_name TEXT,
  total_clicks BIGINT,
  contacts_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id AS seller_id,
    s.name AS seller_name,
    COUNT(DISTINCT cl.id) AS total_clicks,
    COUNT(DISTINCT sc.id) AS contacts_count
  FROM sellers s
  LEFT JOIN clicks cl ON cl.seller_id = s.id
    AND cl.created_at >= start_date
    AND cl.created_at <= end_date
  LEFT JOIN seller_contacts sc ON sc.seller_id = s.id
  WHERE s.team_id = team_id_param
  GROUP BY s.id, s.name
  ORDER BY total_clicks DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 3: Get daily clicks
CREATE OR REPLACE FUNCTION get_daily_clicks(
  team_id_param UUID,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  click_date DATE,
  total_clicks BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(cl.created_at) AS click_date,
    COUNT(cl.id) AS total_clicks
  FROM clicks cl
  INNER JOIN campaigns c ON c.id = cl.campaign_id
  WHERE c.team_id = team_id_param
    AND cl.created_at >= start_date
    AND cl.created_at <= end_date
  GROUP BY DATE(cl.created_at)
  ORDER BY click_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 4: Get total clicks
CREATE OR REPLACE FUNCTION get_total_clicks(
  team_id_param UUID,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS BIGINT AS $$
DECLARE
  total BIGINT;
BEGIN
  SELECT COUNT(cl.id) INTO total
  FROM clicks cl
  INNER JOIN campaigns c ON c.id = cl.campaign_id
  WHERE c.team_id = team_id_param
    AND cl.created_at >= start_date
    AND cl.created_at <= end_date;
  
  RETURN COALESCE(total, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 5: Get analytics comparison
CREATE OR REPLACE FUNCTION get_analytics_comparison(
  team_id_param UUID,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  current_period_clicks BIGINT,
  previous_period_clicks BIGINT,
  growth_percentage NUMERIC
) AS $$
DECLARE
  period_duration INTERVAL;
  previous_start TIMESTAMPTZ;
  previous_end TIMESTAMPTZ;
  current_clicks BIGINT;
  previous_clicks BIGINT;
BEGIN
  period_duration := end_date - start_date;
  previous_end := start_date;
  previous_start := previous_end - period_duration;
  
  SELECT COUNT(cl.id) INTO current_clicks
  FROM clicks cl
  INNER JOIN campaigns c ON c.id = cl.campaign_id
  WHERE c.team_id = team_id_param
    AND cl.created_at >= start_date
    AND cl.created_at <= end_date;
  
  SELECT COUNT(cl.id) INTO previous_clicks
  FROM clicks cl
  INNER JOIN campaigns c ON c.id = cl.campaign_id
  WHERE c.team_id = team_id_param
    AND cl.created_at >= previous_start
    AND cl.created_at < previous_end;
  
  RETURN QUERY
  SELECT 
    COALESCE(current_clicks, 0) AS current_period_clicks,
    COALESCE(previous_clicks, 0) AS previous_period_clicks,
    CASE 
      WHEN previous_clicks = 0 OR previous_clicks IS NULL THEN 
        CASE WHEN current_clicks > 0 THEN 100.0 ELSE 0.0 END
      ELSE 
        ROUND(((current_clicks::NUMERIC - previous_clicks::NUMERIC) / previous_clicks::NUMERIC * 100), 2)
    END AS growth_percentage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 6: Get seller performance
CREATE OR REPLACE FUNCTION get_seller_performance(
  team_id_param UUID,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  seller_id UUID,
  seller_name TEXT,
  seller_weight INTEGER,
  total_clicks BIGINT,
  efficiency_score NUMERIC,
  contacts_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id AS seller_id,
    s.name AS seller_name,
    s.weight AS seller_weight,
    COUNT(DISTINCT cl.id) AS total_clicks,
    CASE 
      WHEN s.weight > 0 THEN ROUND(COUNT(DISTINCT cl.id)::NUMERIC / s.weight::NUMERIC, 2)
      ELSE 0
    END AS efficiency_score,
    COUNT(DISTINCT sc.id) AS contacts_count
  FROM sellers s
  LEFT JOIN clicks cl ON cl.seller_id = s.id
    AND cl.created_at >= start_date
    AND cl.created_at <= end_date
  LEFT JOIN seller_contacts sc ON sc.seller_id = s.id
  WHERE s.team_id = team_id_param
  GROUP BY s.id, s.name, s.weight
  ORDER BY efficiency_score DESC, total_clicks DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- VERIFICAÇÃO FINAL
-- ========================================
-- Execute esta query para verificar se tudo foi criado:
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND routine_name LIKE 'get_%'
-- ORDER BY routine_name;
