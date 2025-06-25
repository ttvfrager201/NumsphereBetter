CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  is_trusted BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  UNIQUE(user_id, device_fingerprint)
);

CREATE TABLE IF NOT EXISTS public.twilio_numbers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  twilio_sid TEXT NOT NULL,
  friendly_name TEXT,
  minutes_allocated INTEGER DEFAULT 0,
  minutes_used INTEGER DEFAULT 0,
  plan_id TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'released')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(phone_number)
);

CREATE TABLE IF NOT EXISTS public.call_flows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  twilio_number_id UUID REFERENCES public.twilio_numbers(id) ON DELETE CASCADE,
  flow_name TEXT NOT NULL,
  flow_config JSONB NOT NULL DEFAULT '{}',
  twilio_flow_sid TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS token_identifier TEXT DEFAULT gen_random_uuid();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS requires_otp_verification BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_otp_verification TIMESTAMP WITH TIME ZONE;

alter publication supabase_realtime add table user_devices;
alter publication supabase_realtime add table twilio_numbers;
alter publication supabase_realtime add table call_flows;
