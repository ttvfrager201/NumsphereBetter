-- Add number release tracking to prevent abuse
-- Users can only release one number per subscription

-- Create number_audit_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS number_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('purchased', 'released')),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE number_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view their own audit logs" ON number_audit_log;
CREATE POLICY "Users can view their own audit logs"
  ON number_audit_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can manage audit logs" ON number_audit_log;
CREATE POLICY "Service can manage audit logs"
  ON number_audit_log FOR ALL
  USING (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_number_audit_log_user_action 
  ON number_audit_log(user_id, action);

-- Enable realtime (only if not already added)
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'number_audit_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE number_audit_log;
  END IF;
END $;
