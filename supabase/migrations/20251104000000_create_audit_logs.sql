-- Create audit_logs table to track all important actions in the system
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- 'login', 'logout', 'update', 'create', 'delete'
  entity_type TEXT, -- 'seller', 'campaign', 'contact', etc.
  entity_id UUID, -- ID of the entity being modified
  old_value JSONB, -- Previous state (for updates)
  new_value JSONB, -- New state (for updates/creates)
  user_agent TEXT, -- Browser/device information
  ip_address TEXT, -- IP address of the user
  metadata JSONB, -- Additional context-specific data
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own audit logs
-- Admins can read all audit logs (assuming you have a role system)
CREATE POLICY "Users can read their own audit logs"
  ON audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: System can insert audit logs (for service role)
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Function to automatically log seller weight changes
CREATE OR REPLACE FUNCTION log_seller_weight_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.weight IS DISTINCT FROM NEW.weight THEN
    INSERT INTO audit_logs (
      user_id,
      action_type,
      entity_type,
      entity_id,
      old_value,
      new_value,
      metadata
    ) VALUES (
      auth.uid(),
      'update',
      'seller',
      NEW.id,
      jsonb_build_object('weight', OLD.weight),
      jsonb_build_object('weight', NEW.weight),
      jsonb_build_object('field', 'weight', 'seller_name', NEW.name)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for seller weight changes (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sellers') THEN
    DROP TRIGGER IF EXISTS trigger_log_seller_weight_change ON sellers;
    CREATE TRIGGER trigger_log_seller_weight_change
      AFTER UPDATE ON sellers
      FOR EACH ROW
      EXECUTE FUNCTION log_seller_weight_change();
  END IF;
END $$;

-- Function to automatically log seller deletions
CREATE OR REPLACE FUNCTION log_seller_deletion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    metadata
  ) VALUES (
    auth.uid(),
    'delete',
    'seller',
    OLD.id,
    to_jsonb(OLD),
    jsonb_build_object('seller_name', OLD.name)
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for seller deletions (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sellers') THEN
    DROP TRIGGER IF EXISTS trigger_log_seller_deletion ON sellers;
    CREATE TRIGGER trigger_log_seller_deletion
      BEFORE DELETE ON sellers
      FOR EACH ROW
      EXECUTE FUNCTION log_seller_deletion();
  END IF;
END $$;

-- Function to automatically log campaign changes
CREATE OR REPLACE FUNCTION log_campaign_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      user_id,
      action_type,
      entity_type,
      entity_id,
      new_value,
      metadata
    ) VALUES (
      auth.uid(),
      'create',
      'campaign',
      NEW.id,
      to_jsonb(NEW),
      jsonb_build_object('campaign_name', NEW.name)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      user_id,
      action_type,
      entity_type,
      entity_id,
      old_value,
      new_value,
      metadata
    ) VALUES (
      auth.uid(),
      'update',
      'campaign',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW),
      jsonb_build_object('campaign_name', NEW.name)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for campaign changes (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaigns') THEN
    DROP TRIGGER IF EXISTS trigger_log_campaign_changes ON campaigns;
    CREATE TRIGGER trigger_log_campaign_changes
      AFTER INSERT OR UPDATE ON campaigns
      FOR EACH ROW
      EXECUTE FUNCTION log_campaign_changes();
  END IF;
END $$;

-- Function to automatically log campaign deletions
CREATE OR REPLACE FUNCTION log_campaign_deletion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id,
    action_type,
    entity_type,
    entity_id,
    old_value,
    metadata
  ) VALUES (
    auth.uid(),
    'delete',
    'campaign',
    OLD.id,
    to_jsonb(OLD),
    jsonb_build_object('campaign_name', OLD.name)
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for campaign deletions (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaigns') THEN
    DROP TRIGGER IF EXISTS trigger_log_campaign_deletion ON campaigns;
    CREATE TRIGGER trigger_log_campaign_deletion
      BEFORE DELETE ON campaigns
      FOR EACH ROW
      EXECUTE FUNCTION log_campaign_deletion();
  END IF;
END $$;
