-- Enhanced security measures for payment processing

-- Add security columns to user_subscriptions if they don't exist
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS security_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_verification_attempt TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS proration_amount INTEGER DEFAULT 0;

-- Update status check constraint to include new statuses
ALTER TABLE user_subscriptions 
DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;

ALTER TABLE user_subscriptions 
ADD CONSTRAINT user_subscriptions_status_check 
CHECK (status IN ('pending_payment', 'pending', 'active', 'canceled', 'past_due', 'paused', 'suspended'));

-- Create payment security log table
CREATE TABLE IF NOT EXISTS payment_security_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type VARCHAR(50) NOT NULL,
  security_fingerprint TEXT,
  ip_address INET,
  user_agent TEXT,
  suspicious_indicators JSONB DEFAULT '[]'::jsonb,
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  action_taken VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_security_log_user_id ON payment_security_log(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_security_log_event_type ON payment_security_log(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_security_log_created_at ON payment_security_log(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_security_log_risk_score ON payment_security_log(risk_score);

-- Create function to log payment security events
CREATE OR REPLACE FUNCTION log_payment_security_event(
  p_user_id UUID,
  p_session_id TEXT,
  p_event_type VARCHAR(50),
  p_security_fingerprint TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_suspicious_indicators JSONB DEFAULT '[]'::jsonb,
  p_risk_score INTEGER DEFAULT 0,
  p_action_taken VARCHAR(50) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO payment_security_log (
    user_id, session_id, event_type, security_fingerprint,
    ip_address, user_agent, suspicious_indicators, risk_score, action_taken
  ) VALUES (
    p_user_id, p_session_id, p_event_type, p_security_fingerprint,
    p_ip_address, p_user_agent, p_suspicious_indicators, p_risk_score, p_action_taken
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to detect payment anomalies
CREATE OR REPLACE FUNCTION detect_payment_anomalies(
  p_user_id UUID,
  p_session_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  anomaly_score INTEGER := 0;
  anomalies JSONB := '[]'::jsonb;
  recent_attempts INTEGER;
  subscription_count INTEGER;
BEGIN
  -- Check for multiple recent payment attempts
  SELECT COUNT(*) INTO recent_attempts
  FROM user_subscriptions
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '1 hour'
    AND status IN ('pending_payment', 'pending');
  
  IF recent_attempts > 3 THEN
    anomaly_score := anomaly_score + 30;
    anomalies := anomalies || jsonb_build_object('type', 'multiple_recent_attempts', 'count', recent_attempts);
  END IF;
  
  -- Check for multiple active subscriptions (should not happen)
  SELECT COUNT(*) INTO subscription_count
  FROM user_subscriptions
  WHERE user_id = p_user_id
    AND status = 'active';
  
  IF subscription_count > 1 THEN
    anomaly_score := anomaly_score + 50;
    anomalies := anomalies || jsonb_build_object('type', 'multiple_active_subscriptions', 'count', subscription_count);
  END IF;
  
  -- Check for rapid status changes
  IF EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_id = p_user_id
      AND updated_at > NOW() - INTERVAL '5 minutes'
      AND status = 'active'
  ) AND EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_id = p_user_id
      AND created_at > NOW() - INTERVAL '5 minutes'
      AND status IN ('pending_payment', 'pending')
  ) THEN
    anomaly_score := anomaly_score + 40;
    anomalies := anomalies || jsonb_build_object('type', 'rapid_status_change', 'timeframe', '5_minutes');
  END IF;
  
  RETURN jsonb_build_object(
    'anomaly_score', anomaly_score,
    'anomalies', anomalies,
    'risk_level', CASE
      WHEN anomaly_score >= 70 THEN 'high'
      WHEN anomaly_score >= 40 THEN 'medium'
      WHEN anomaly_score >= 20 THEN 'low'
      ELSE 'minimal'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate payment session
CREATE OR REPLACE FUNCTION validate_payment_session(
  p_user_id UUID,
  p_session_id TEXT,
  p_security_fingerprint TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  session_exists BOOLEAN := FALSE;
  session_status TEXT;
  anomaly_result JSONB;
  validation_result JSONB;
BEGIN
  -- Check if session exists and get status
  SELECT EXISTS(
    SELECT 1 FROM user_subscriptions
    WHERE user_id = p_user_id
      AND stripe_checkout_session_id = p_session_id
  ), COALESCE(
    (SELECT status FROM user_subscriptions
     WHERE user_id = p_user_id
       AND stripe_checkout_session_id = p_session_id
     ORDER BY created_at DESC
     LIMIT 1), 'not_found'
  ) INTO session_exists, session_status;
  
  -- Detect anomalies
  anomaly_result := detect_payment_anomalies(p_user_id, p_session_id);
  
  -- Build validation result
  validation_result := jsonb_build_object(
    'valid', session_exists AND session_status IN ('pending_payment', 'pending', 'active'),
    'session_exists', session_exists,
    'session_status', session_status,
    'anomaly_score', anomaly_result->'anomaly_score',
    'risk_level', anomaly_result->'risk_level',
    'anomalies', anomaly_result->'anomalies'
  );
  
  -- Log the validation attempt
  PERFORM log_payment_security_event(
    p_user_id,
    p_session_id,
    'session_validation',
    p_security_fingerprint,
    NULL,
    NULL,
    anomaly_result->'anomalies',
    (anomaly_result->'anomaly_score')::INTEGER,
    CASE WHEN (anomaly_result->'anomaly_score')::INTEGER >= 70 THEN 'blocked' ELSE 'allowed' END
  );
  
  RETURN validation_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically log subscription changes
CREATE OR REPLACE FUNCTION trigger_log_subscription_security()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes for security monitoring
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM log_payment_security_event(
      NEW.user_id,
      NEW.stripe_checkout_session_id,
      'status_change',
      NEW.security_fingerprint,
      NULL,
      NULL,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
      CASE
        WHEN NEW.status = 'active' AND OLD.status IN ('pending_payment', 'pending') THEN 0
        WHEN NEW.status = 'canceled' THEN 10
        ELSE 5
      END,
      'automatic_log'
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS subscription_security_log_trigger ON user_subscriptions;
CREATE TRIGGER subscription_security_log_trigger
  AFTER INSERT OR UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_subscription_security();

-- Enable realtime for security monitoring
alter publication supabase_realtime add table payment_security_log;

-- Add comments for documentation
COMMENT ON TABLE payment_security_log IS 'Security monitoring and logging for payment-related events';
COMMENT ON FUNCTION log_payment_security_event IS 'Function to log payment security events with risk scoring';
COMMENT ON FUNCTION detect_payment_anomalies IS 'Function to detect suspicious payment patterns and anomalies';
COMMENT ON FUNCTION validate_payment_session IS 'Function to validate payment sessions and detect fraud attempts';

-- Create index for faster security queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_security ON user_subscriptions(user_id, stripe_checkout_session_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_fingerprint ON user_subscriptions(security_fingerprint) WHERE security_fingerprint IS NOT NULL;
