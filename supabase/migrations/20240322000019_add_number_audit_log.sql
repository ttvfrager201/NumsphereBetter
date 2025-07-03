CREATE TABLE IF NOT EXISTS number_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('purchased', 'released', 'modified')),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_number_audit_log_user_id ON number_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_number_audit_log_phone_number ON number_audit_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_number_audit_log_action ON number_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_number_audit_log_created_at ON number_audit_log(created_at);

alter publication supabase_realtime add table number_audit_log;
