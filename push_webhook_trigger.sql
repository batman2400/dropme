-- ============================================
-- dropme. Database Webhook for Push Notifications
-- ============================================
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard
-- 2. Go to SQL Editor (left sidebar)
-- 3. Click "New query"
-- 4. Copy-paste this ENTIRE file
-- 5. Click "Run"
-- ============================================
-- This sets up a Database Webhook that automatically calls
-- the Edge Function whenever a new ride request is created.
-- Result: Drivers get push notifications even when their browser is closed!

-- Enable the pg_net extension (for making HTTP calls from PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the trigger function that calls the Edge Function
CREATE OR REPLACE FUNCTION public.notify_driver_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
  request_id BIGINT;
BEGIN
  -- Build the Edge Function URL
  -- Replace with your actual Supabase project URL
  edge_function_url := 'https://hzxfoomaclfqgfewlers.supabase.co/functions/v1/send-push-notification';

  -- Get the service role key from vault (or hardcode temporarily for testing)
  -- NOTE: In production, use Supabase Vault to store this securely

  -- Call the Edge Function via pg_net (non-blocking HTTP POST)
  SELECT net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'ride_requests',
      'record', jsonb_build_object(
        'id', NEW.id,
        'ride_id', NEW.ride_id,
        'passenger_id', NEW.passenger_id,
        'seats_requested', NEW.seats_requested,
        'pickup_address', NEW.pickup_address,
        'dropoff_address', NEW.dropoff_address,
        'fare', NEW.fare
      )
    )
  ) INTO request_id;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists (safe to re-run)
DROP TRIGGER IF EXISTS on_ride_request_created_push ON ride_requests;

-- Create the trigger on ride_requests INSERT
CREATE TRIGGER on_ride_request_created_push
  AFTER INSERT ON ride_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_push();

-- ============================================
-- DONE! Push notifications are now fully automated.
-- 
-- Flow:
-- 1. Passenger creates a ride request (INSERT into ride_requests)
-- 2. PostgreSQL trigger fires → calls the Edge Function
-- 3. Edge Function looks up the driver's push subscription
-- 4. Edge Function sends Web Push notification
-- 5. Driver's phone/browser receives the notification 🔔
--    (even if the browser is completely closed!)
-- ============================================
