-- Analytics RPC Functions for High Performance
-- These functions use SQL aggregations to calculate analytics without fetching all rows

-- Function to get campaign statistics for a team within date range
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

-- Function to get seller statistics for a team within date range
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

-- Function to get daily clicks aggregation
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

-- Function to get total clicks count (very fast, just COUNT)
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

-- Function to get analytics comparison with previous period
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
  -- Calculate period duration
  period_duration := end_date - start_date;
  
  -- Calculate previous period dates
  previous_end := start_date;
  previous_start := previous_end - period_duration;
  
  -- Get current period clicks
  SELECT COUNT(cl.id) INTO current_clicks
  FROM clicks cl
  INNER JOIN campaigns c ON c.id = cl.campaign_id
  WHERE c.team_id = team_id_param
    AND cl.created_at >= start_date
    AND cl.created_at <= end_date;
  
  -- Get previous period clicks
  SELECT COUNT(cl.id) INTO previous_clicks
  FROM clicks cl
  INNER JOIN campaigns c ON c.id = cl.campaign_id
  WHERE c.team_id = team_id_param
    AND cl.created_at >= previous_start
    AND cl.created_at < previous_end;
  
  -- Calculate growth percentage
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

-- Function to get seller performance with weight efficiency
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

-- Create indexes for better performance (only if tables exist)
DO $$ 
BEGIN
  -- Create indexes for clicks table
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'clicks') THEN
    CREATE INDEX IF NOT EXISTS idx_clicks_created_at ON clicks(created_at);
    CREATE INDEX IF NOT EXISTS idx_clicks_campaign_created ON clicks(campaign_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_clicks_seller_created ON clicks(seller_id, created_at);
  END IF;
  
  -- Create indexes for campaigns table
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaigns') THEN
    CREATE INDEX IF NOT EXISTS idx_campaigns_team_id ON campaigns(team_id);
  END IF;
  
  -- Create indexes for sellers table
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sellers') THEN
    CREATE INDEX IF NOT EXISTS idx_sellers_team_id ON sellers(team_id);
  END IF;
END $$;
