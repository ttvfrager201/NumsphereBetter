-- Add new status for numbers released due to overdue payment
-- This migration adds support for tracking numbers released due to overdue payments

-- Update the check constraint on twilio_numbers to include the new status
ALTER TABLE twilio_numbers DROP CONSTRAINT IF EXISTS twilio_numbers_status_check;
ALTER TABLE twilio_numbers ADD CONSTRAINT twilio_numbers_status_check 
  CHECK (status IN ('active', 'inactive', 'suspended', 'released', 'suspended_limit_reached', 'released_overdue_payment'));

-- Update the check constraint on user_subscriptions to include the new status
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;
ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_status_check 
  CHECK (status IN ('active', 'inactive', 'past_due', 'canceled', 'unpaid', 'numbers_released_overdue'));

-- Add index for efficient querying of overdue subscriptions
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_overdue 
  ON user_subscriptions(status, created_at) 
  WHERE status IN ('inactive', 'past_due', 'unpaid');

-- Add index for efficient querying of released numbers
CREATE INDEX IF NOT EXISTS idx_twilio_numbers_released_overdue 
  ON twilio_numbers(status, updated_at) 
  WHERE status = 'released_overdue_payment';

-- Add a function to automatically check for overdue payments (can be called by cron job)
CREATE OR REPLACE FUNCTION check_overdue_payments()
RETURNS TABLE(
  user_id uuid,
  phone_numbers_count bigint,
  days_overdue integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.user_id,
    COUNT(tn.id) as phone_numbers_count,
    EXTRACT(DAY FROM NOW() - us.created_at)::integer as days_overdue
  FROM user_subscriptions us
  LEFT JOIN twilio_numbers tn ON us.user_id = tn.user_id 
    AND tn.status IN ('active', 'suspended_limit_reached')
  WHERE us.status IN ('inactive', 'past_due', 'unpaid')
    AND us.created_at < NOW() - INTERVAL '15 days'
  GROUP BY us.user_id, us.created_at
  HAVING COUNT(tn.id) > 0;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the new statuses
COMMENT ON CONSTRAINT twilio_numbers_status_check ON twilio_numbers IS 
  'Status constraint including released_overdue_payment for numbers released due to non-payment';

COMMENT ON CONSTRAINT user_subscriptions_status_check ON user_subscriptions IS 
  'Status constraint including numbers_released_overdue for subscriptions where numbers were released due to overdue payment';
