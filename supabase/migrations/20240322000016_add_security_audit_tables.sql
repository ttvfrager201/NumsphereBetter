-- Add security audit and monitoring tables for enterprise SaaS

-- Security audit log table
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  event_details JSONB,
  ip_address INET,
  user_agent TEXT,
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source VARCHAR(50) DEFAULT 'system'
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_event_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON security_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_severity ON security_audit_log(severity);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_ip_address ON security_audit_log(ip_address);

-- Webhook events log for debugging and monitoring
CREATE TABLE IF NOT EXISTS webhook_events_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'stripe',
  status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'retrying')),
  attempts INTEGER DEFAULT 1,
  payload JSONB,
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_log_event_id ON webhook_events_log(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_log_event_type ON webhook_events_log(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_log_status ON webhook_events_log(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_log_created_at ON webhook_events_log(created_at);

-- Failed login attempts tracking
CREATE TABLE IF NOT EXISTS failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  attempt_count INTEGER DEFAULT 1,
  first_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_email ON failed_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_ip_address ON failed_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_blocked_until ON failed_login_attempts(blocked_until);

-- Subscription change history for audit trail
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  old_plan_id VARCHAR(50),
  new_plan_id VARCHAR(50),
  change_reason VARCHAR(100),
  changed_by VARCHAR(50) DEFAULT 'system',
  stripe_event_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription_id ON subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created_at ON subscription_history(created_at);

-- Add missing columns to existing tables for better security
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS last_updated_by VARCHAR(50) DEFAULT 'system',
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE;

-- Add security columns to user_devices table
ALTER TABLE user_devices 
ADD COLUMN IF NOT EXISTS security_score INTEGER DEFAULT 100 CHECK (security_score >= 0 AND security_score <= 100),
ADD COLUMN IF NOT EXISTS risk_factors JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS last_security_check TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_user_id UUID,
  p_event_type VARCHAR(100),
  p_event_details JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_severity VARCHAR(20) DEFAULT 'medium',
  p_source VARCHAR(50) DEFAULT 'system'
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO security_audit_log (
    user_id, event_type, event_details, ip_address, 
    user_agent, severity, source
  ) VALUES (
    p_user_id, p_event_type, p_event_details, p_ip_address,
    p_user_agent, p_severity, p_source
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track subscription changes
CREATE OR REPLACE FUNCTION track_subscription_change(
  p_user_id UUID,
  p_subscription_id UUID,
  p_old_status VARCHAR(50),
  p_new_status VARCHAR(50),
  p_old_plan_id VARCHAR(50) DEFAULT NULL,
  p_new_plan_id VARCHAR(50) DEFAULT NULL,
  p_change_reason VARCHAR(100) DEFAULT 'webhook_update',
  p_changed_by VARCHAR(50) DEFAULT 'stripe_webhook',
  p_stripe_event_id VARCHAR(255) DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  history_id UUID;
BEGIN
  INSERT INTO subscription_history (
    user_id, subscription_id, old_status, new_status,
    old_plan_id, new_plan_id, change_reason, changed_by,
    stripe_event_id, metadata
  ) VALUES (
    p_user_id, p_subscription_id, p_old_status, p_new_status,
    p_old_plan_id, p_new_plan_id, p_change_reason, p_changed_by,
    p_stripe_event_id, p_metadata
  ) RETURNING id INTO history_id;
  
  RETURN history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and update failed login attempts
CREATE OR REPLACE FUNCTION check_failed_login_attempts(
  p_email VARCHAR(255),
  p_ip_address INET,
  p_user_agent TEXT DEFAULT NULL,
  p_max_attempts INTEGER DEFAULT 5,
  p_lockout_duration_minutes INTEGER DEFAULT 30
) RETURNS JSONB AS $$
DECLARE
  attempt_record failed_login_attempts%ROWTYPE;
  is_blocked BOOLEAN := FALSE;
  remaining_attempts INTEGER;
BEGIN
  -- Get existing record
  SELECT * INTO attempt_record
  FROM failed_login_attempts
  WHERE email = p_email AND ip_address = p_ip_address
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Check if currently blocked
  IF attempt_record.blocked_until IS NOT NULL AND attempt_record.blocked_until > NOW() THEN
    is_blocked := TRUE;
  END IF;
  
  -- If not blocked, increment attempt count
  IF NOT is_blocked THEN
    IF attempt_record.id IS NULL THEN
      -- First attempt
      INSERT INTO failed_login_attempts (email, ip_address, user_agent)
      VALUES (p_email, p_ip_address, p_user_agent);
      remaining_attempts := p_max_attempts - 1;
    ELSE
      -- Update existing record
      UPDATE failed_login_attempts
      SET 
        attempt_count = attempt_count + 1,
        last_attempt_at = NOW(),
        blocked_until = CASE 
          WHEN attempt_count + 1 >= p_max_attempts 
          THEN NOW() + INTERVAL '1 minute' * p_lockout_duration_minutes
          ELSE NULL
        END,
        updated_at = NOW()
      WHERE id = attempt_record.id;
      
      remaining_attempts := p_max_attempts - (attempt_record.attempt_count + 1);
      
      IF remaining_attempts <= 0 THEN
        is_blocked := TRUE;
      END IF;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'blocked', is_blocked,
    'remaining_attempts', GREATEST(0, remaining_attempts),
    'blocked_until', CASE WHEN is_blocked THEN attempt_record.blocked_until ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear successful login attempts
CREATE OR REPLACE FUNCTION clear_failed_login_attempts(
  p_email VARCHAR(255),
  p_ip_address INET
) RETURNS VOID AS $$
BEGIN
  DELETE FROM failed_login_attempts
  WHERE email = p_email AND ip_address = p_ip_address;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log subscription changes
CREATE OR REPLACE FUNCTION trigger_log_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Only log if status or plan changed
    IF OLD.status IS DISTINCT FROM NEW.status OR OLD.plan_id IS DISTINCT FROM NEW.plan_id THEN
      PERFORM track_subscription_change(
        NEW.user_id,
        NEW.id,
        OLD.status,
        NEW.status,
        OLD.plan_id,
        NEW.plan_id,
        'status_change',
        COALESCE(NEW.last_updated_by, 'system')
      );
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM track_subscription_change(
      NEW.user_id,
      NEW.id,
      NULL,
      NEW.status,
      NULL,
      NEW.plan_id,
      'subscription_created',
      COALESCE(NEW.last_updated_by, 'system')
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS subscription_change_log_trigger ON user_subscriptions;
CREATE TRIGGER subscription_change_log_trigger
  AFTER INSERT OR UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_subscription_change();

-- Enable realtime for audit tables (optional)
alter publication supabase_realtime add table security_audit_log;
alter publication supabase_realtime add table webhook_events_log;
alter publication supabase_realtime add table subscription_history;

-- Create indexes for better performance on large datasets
CREATE INDEX IF NOT EXISTS idx_security_audit_log_composite ON security_audit_log(user_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_log_composite ON webhook_events_log(event_type, status, created_at);

-- Add comments for documentation
COMMENT ON TABLE security_audit_log IS 'Comprehensive security audit log for tracking all security-related events';
COMMENT ON TABLE webhook_events_log IS 'Log of all webhook events for debugging and monitoring';
COMMENT ON TABLE failed_login_attempts IS 'Track failed login attempts for rate limiting and security';
COMMENT ON TABLE subscription_history IS 'Audit trail for all subscription changes';

COMMENT ON FUNCTION log_security_event IS 'Function to log security events with proper validation';
COMMENT ON FUNCTION track_subscription_change IS 'Function to track subscription changes for audit purposes';
COMMENT ON FUNCTION check_failed_login_attempts IS 'Function to check and update failed login attempts with rate limiting';
COMMENT ON FUNCTION clear_failed_login_attempts IS 'Function to clear failed login attempts after successful login';
