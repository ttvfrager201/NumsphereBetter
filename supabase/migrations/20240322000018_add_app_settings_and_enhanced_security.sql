-- Create app settings table for dynamic configuration
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  frontend_url TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default frontend URL setting
INSERT INTO app_settings (key, frontend_url, description) 
VALUES (
  'frontend_base_url', 
  'https://mystifying-torvalds4-r9r87.view-3.tempo-dev.app',
  'Base URL for frontend application redirects'
) ON CONFLICT (key) DO NOTHING;

-- Insert Stripe webhook endpoint setting
INSERT INTO app_settings (key, value, description) 
VALUES (
  'stripe_webhook_endpoint', 
  'https://fcvopojvuqwmqejxpkqd.supabase.co/functions/v1/stripe-webhook',
  'Correct Stripe webhook endpoint URL'
) ON CONFLICT (key) DO NOTHING;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
CREATE INDEX IF NOT EXISTS idx_app_settings_active ON app_settings(is_active);

-- Update user_subscriptions to include more security fields
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE;

-- Update status constraint to include new statuses
ALTER TABLE user_subscriptions 
DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;

ALTER TABLE user_subscriptions 
ADD CONSTRAINT user_subscriptions_status_check 
CHECK (status IN ('pending_payment', 'pending', 'active', 'canceled', 'past_due', 'paused', 'suspended', 'payment_failed'));

-- Create function to automatically clean expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  -- Clean up expired payment sessions (older than 1 hour)
  DELETE FROM user_subscriptions 
  WHERE status IN ('pending_payment', 'pending') 
    AND created_at < NOW() - INTERVAL '1 hour';
  
  -- Clean up expired device trust (older than 30 days)
  DELETE FROM user_devices 
  WHERE expires_at < NOW() 
    OR last_login < NOW() - INTERVAL '30 days';
  
  -- Clean up old security logs (older than 90 days)
  DELETE FROM payment_security_log 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Clean up old webhook logs (older than 30 days)
  DELETE FROM webhook_events_log 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate subscription integrity
CREATE OR REPLACE FUNCTION validate_subscription_integrity(
  p_user_id UUID,
  p_stripe_subscription_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  active_count INTEGER;
  pending_count INTEGER;
  validation_result JSONB;
  issues TEXT[] := '{}';
BEGIN
  -- Count active subscriptions
  SELECT COUNT(*) INTO active_count
  FROM user_subscriptions
  WHERE user_id = p_user_id
    AND status = 'active';
  
  -- Count pending subscriptions
  SELECT COUNT(*) INTO pending_count
  FROM user_subscriptions
  WHERE user_id = p_user_id
    AND status IN ('pending_payment', 'pending');
  
  -- Check for issues
  IF active_count > 1 THEN
    issues := array_append(issues, 'multiple_active_subscriptions');
  END IF;
  
  IF pending_count > 2 THEN
    issues := array_append(issues, 'too_many_pending_subscriptions');
  END IF;
  
  -- Check for old pending subscriptions
  IF EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_id = p_user_id
      AND status IN ('pending_payment', 'pending')
      AND created_at < NOW() - INTERVAL '2 hours'
  ) THEN
    issues := array_append(issues, 'stale_pending_subscriptions');
  END IF;
  
  validation_result := jsonb_build_object(
    'user_id', p_user_id,
    'active_subscriptions', active_count,
    'pending_subscriptions', pending_count,
    'issues', to_jsonb(issues),
    'is_valid', array_length(issues, 1) IS NULL OR array_length(issues, 1) = 0,
    'checked_at', NOW()
  );
  
  -- Log validation if issues found
  IF array_length(issues, 1) > 0 THEN
    INSERT INTO payment_security_log (
      user_id, event_type, payload, status, created_at
    ) VALUES (
      p_user_id, 'subscription_integrity_check', validation_result, 'warning', NOW()
    );
  END IF;
  
  RETURN validation_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle automatic subscription cleanup
CREATE OR REPLACE FUNCTION auto_cleanup_subscriptions()
RETURNS void AS $$
BEGIN
  -- Cancel old pending subscriptions
  UPDATE user_subscriptions 
  SET status = 'canceled',
      canceled_at = NOW(),
      updated_at = NOW()
  WHERE status IN ('pending_payment', 'pending')
    AND created_at < NOW() - INTERVAL '2 hours';
  
  -- Log cleanup action
  INSERT INTO payment_security_log (
    event_type, payload, status, created_at
  ) VALUES (
    'automatic_cleanup',
    jsonb_build_object(
      'action', 'canceled_stale_subscriptions',
      'timestamp', NOW()
    ),
    'completed',
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for subscription validation
CREATE OR REPLACE FUNCTION trigger_validate_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate subscription integrity on insert/update
  PERFORM validate_subscription_integrity(NEW.user_id, NEW.stripe_subscription_id);
  
  -- Auto-cleanup if too many pending subscriptions
  IF NEW.status IN ('pending_payment', 'pending') THEN
    PERFORM auto_cleanup_subscriptions();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS subscription_validation_trigger ON user_subscriptions;
CREATE TRIGGER subscription_validation_trigger
  AFTER INSERT OR UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_validate_subscription();

-- Create scheduled cleanup job (requires pg_cron extension)
-- This will run every hour to clean up expired sessions
-- SELECT cron.schedule('cleanup-expired-sessions', '0 * * * *', 'SELECT cleanup_expired_sessions();');

-- Enable realtime for app settings
alter publication supabase_realtime add table app_settings;

-- Add comments
COMMENT ON TABLE app_settings IS 'Dynamic application configuration settings';
COMMENT ON FUNCTION cleanup_expired_sessions IS 'Automatically clean up expired sessions and old data';
COMMENT ON FUNCTION validate_subscription_integrity IS 'Validate subscription data integrity and detect anomalies';
COMMENT ON FUNCTION auto_cleanup_subscriptions IS 'Automatically cleanup stale subscription records';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status_created ON user_subscriptions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON user_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_log_created ON webhook_events_log(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_security_log_created ON payment_security_log(created_at);
