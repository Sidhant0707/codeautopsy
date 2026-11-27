-- Time of the last Lemon Squeezy subscription event applied to a profile, so that
-- late or replayed webhook deliveries cannot overwrite newer subscription state.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_event_at timestamptz;
