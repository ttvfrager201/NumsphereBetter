CREATE OR REPLACE FUNCTION public.update_payment_status(
  p_user_id UUID,
  p_plan_id TEXT,
  p_session_id TEXT,
  p_subscription_id TEXT,
  p_customer_id TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Update user payment status
  UPDATE public.users 
  SET has_completed_payment = TRUE, updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Insert or update subscription
  INSERT INTO public.user_subscriptions (
    user_id,
    plan_id,
    stripe_checkout_session_id,
    stripe_subscription_id,
    stripe_customer_id,
    status,
    updated_at
  )
  VALUES (
    p_user_id,
    p_plan_id,
    p_session_id,
    p_subscription_id,
    p_customer_id,
    'active',
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    stripe_checkout_session_id = EXCLUDED.stripe_checkout_session_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    status = EXCLUDED.status,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'user_subscriptions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE user_subscriptions;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'users'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE users;
    END IF;
END $;