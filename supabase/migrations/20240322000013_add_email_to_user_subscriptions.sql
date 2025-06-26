ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS email TEXT;

CREATE OR REPLACE FUNCTION public.update_subscription_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_subscriptions 
  SET email = (
    SELECT email 
    FROM auth.users 
    WHERE id = NEW.user_id
  )
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_subscription_created ON public.user_subscriptions;
CREATE TRIGGER on_user_subscription_created
  AFTER INSERT ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_subscription_email();

UPDATE public.user_subscriptions 
SET email = (
  SELECT email 
  FROM auth.users 
  WHERE id = user_subscriptions.user_id
)
WHERE email IS NULL;

alter publication supabase_realtime add table user_subscriptions;