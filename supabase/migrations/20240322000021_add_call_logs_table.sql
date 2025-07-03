-- Create call logs table for tracking call analytics
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_sid TEXT NOT NULL UNIQUE,
  twilio_number_id UUID REFERENCES twilio_numbers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  call_status TEXT,
  call_duration INTEGER, -- in seconds
  call_minutes INTEGER, -- calculated minutes for billing
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  recording_url TEXT,
  transcription TEXT,
  flow_id UUID REFERENCES call_flows(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_call_logs_user_id ON call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_twilio_number_id ON call_logs(twilio_number_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_sid ON call_logs(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_direction ON call_logs(direction);

-- Enable realtime for call logs
ALTER PUBLICATION supabase_realtime ADD TABLE call_logs;

-- Create function to automatically update minutes used
CREATE OR REPLACE FUNCTION update_number_minutes_on_call_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update when call status changes to completed and we have duration
  IF NEW.call_status = 'completed' AND NEW.call_duration IS NOT NULL AND 
     (OLD.call_status IS NULL OR OLD.call_status != 'completed') THEN
    
    -- Calculate minutes (round up)
    NEW.call_minutes = CEIL(NEW.call_duration::FLOAT / 60);
    
    -- Update the twilio_numbers table with new minutes used
    UPDATE twilio_numbers 
    SET 
      minutes_used = COALESCE(minutes_used, 0) + NEW.call_minutes,
      updated_at = NOW()
    WHERE id = NEW.twilio_number_id;
    
    -- Set ended_at timestamp
    NEW.ended_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic minute tracking
DROP TRIGGER IF EXISTS trigger_update_minutes_on_call_completion ON call_logs;
CREATE TRIGGER trigger_update_minutes_on_call_completion
  BEFORE UPDATE ON call_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_number_minutes_on_call_completion();

-- Create function to get call analytics
CREATE OR REPLACE FUNCTION get_call_analytics(
  p_user_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_calls BIGINT,
  total_minutes BIGINT,
  inbound_calls BIGINT,
  outbound_calls BIGINT,
  average_duration NUMERIC,
  calls_by_day JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH call_stats AS (
    SELECT 
      COUNT(*) as total_calls,
      SUM(COALESCE(call_minutes, 0)) as total_minutes,
      COUNT(*) FILTER (WHERE direction = 'inbound') as inbound_calls,
      COUNT(*) FILTER (WHERE direction = 'outbound') as outbound_calls,
      AVG(COALESCE(call_duration, 0)) as avg_duration
    FROM call_logs 
    WHERE user_id = p_user_id
      AND (p_start_date IS NULL OR DATE(created_at) >= p_start_date)
      AND (p_end_date IS NULL OR DATE(created_at) <= p_end_date)
  ),
  daily_calls AS (
    SELECT 
      jsonb_object_agg(
        DATE(created_at)::TEXT, 
        jsonb_build_object(
          'calls', COUNT(*),
          'minutes', SUM(COALESCE(call_minutes, 0))
        )
      ) as calls_by_day
    FROM call_logs 
    WHERE user_id = p_user_id
      AND (p_start_date IS NULL OR DATE(created_at) >= p_start_date)
      AND (p_end_date IS NULL OR DATE(created_at) <= p_end_date)
    GROUP BY DATE(created_at)
  )
  SELECT 
    cs.total_calls,
    cs.total_minutes,
    cs.inbound_calls,
    cs.outbound_calls,
    ROUND(cs.avg_duration, 2) as average_duration,
    COALESCE(dc.calls_by_day, '{}'::jsonb) as calls_by_day
  FROM call_stats cs
  CROSS JOIN daily_calls dc;
END;
$$ LANGUAGE plpgsql;
