-- Update Stripe webhook endpoint configuration
-- This migration ensures the webhook endpoint is properly configured

-- Create a function to get the current Supabase URL for webhook configuration
CREATE OR REPLACE FUNCTION get_webhook_endpoint()
RETURNS TEXT AS $$
DECLARE
  base_url TEXT;
BEGIN
  -- Try to get the Supabase URL from settings
  base_url := current_setting('app.supabase_url', true);
  
  -- If null or empty, use a default placeholder
  IF base_url IS NULL OR base_url = '' THEN
    base_url := 'https://your-project.supabase.co';
  END IF;
  
  RETURN base_url || '/functions/v1/stripe-webhook';
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback to a placeholder that should be replaced
    RETURN 'https://your-project.supabase.co/functions/v1/stripe-webhook';
END;
$$ LANGUAGE plpgsql;

-- Create a table to store webhook configuration if it doesn't exist
CREATE TABLE IF NOT EXISTS webhook_config (
  id SERIAL PRIMARY KEY,
  service_name VARCHAR(50) NOT NULL UNIQUE,
  webhook_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert or update Stripe webhook configuration
INSERT INTO webhook_config (service_name, webhook_url, is_active)
VALUES ('stripe', get_webhook_endpoint(), true)
ON CONFLICT (service_name) 
DO UPDATE SET 
  webhook_url = get_webhook_endpoint(),
  updated_at = NOW();

-- Enable realtime for webhook_config table
alter publication supabase_realtime add table webhook_config;