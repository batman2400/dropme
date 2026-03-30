-- ============================================
-- dropme. Auto-Expire Stale Rides
-- ============================================
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard → SQL Editor
-- 2. Click "New query"
-- 3. Copy-paste this ENTIRE file
-- 4. Click "Run"
-- ============================================
-- This creates:
-- 1. A function that cancels rides past departure_time + 30 minutes
-- 2. A pg_cron job that runs this function every 5 minutes
-- 3. Also rejects any pending requests on expired rides
-- ============================================

-- Enable pg_cron extension (for scheduled jobs)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant pg_cron usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- ─── Step 1: Create the auto-expire function ─────────────────
CREATE OR REPLACE FUNCTION public.expire_stale_rides()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_ride_ids UUID[];
BEGIN
  -- Find all active/in_progress rides where departure_time + 30 min has passed
  SELECT ARRAY_AGG(id) INTO expired_ride_ids
  FROM rides
  WHERE status IN ('active', 'in_progress')
    AND departure_time < (NOW() - INTERVAL '30 minutes');

  -- If no expired rides, exit early
  IF expired_ride_ids IS NULL OR array_length(expired_ride_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Step A: Reject all pending requests on these expired rides
  UPDATE ride_requests
  SET status = 'cancelled'
  WHERE ride_id = ANY(expired_ride_ids)
    AND status = 'pending';

  -- Step B: Mark active rides as cancelled, in_progress as completed
  UPDATE rides
  SET status = 'cancelled'
  WHERE id = ANY(expired_ride_ids)
    AND status = 'active';

  UPDATE rides
  SET status = 'completed'
  WHERE id = ANY(expired_ride_ids)
    AND status = 'in_progress';

  RAISE NOTICE 'Expired % rides', array_length(expired_ride_ids, 1);
END;
$$;

-- ─── Step 2: Schedule the cron job (every 5 minutes) ─────────
-- First, remove any existing job with the same name
SELECT cron.unschedule('expire-stale-rides')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-rides'
);

-- Schedule: runs every 5 minutes
SELECT cron.schedule(
  'expire-stale-rides',        -- job name
  '*/5 * * * *',               -- cron expression: every 5 minutes
  $$SELECT public.expire_stale_rides()$$
);

-- ============================================
-- DONE! Rides will now auto-expire.
--
-- Logic:
-- • "active" rides → marked as "cancelled" after departure + 30 min
-- • "in_progress" rides → marked as "completed" after departure + 30 min
-- • Any pending requests on expired rides → auto-rejected
--
-- The cron runs every 5 minutes, so worst case a ride stays
-- visible for ~35 minutes after departure.
-- ============================================
