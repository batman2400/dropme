-- ============================================
-- dropme. Phase 3 Migration
-- ============================================
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard
-- 2. Go to SQL Editor (left sidebar)
-- 3. Click "New query"
-- 4. Copy-paste this ENTIRE file
-- 5. Click "Run"
-- ============================================

-- =====================
-- Atomic Seat Decrement Function
-- =====================
-- WHY DO WE NEED THIS?
-- When a driver accepts a ride request, we need to subtract
-- the passenger's seats from available_seats. But if two
-- passengers request at the same time and the driver accepts
-- both quickly, a normal UPDATE could cause a "race condition"
-- (both read available_seats = 3, both write 2, instead of 1).
--
-- This function uses GREATEST() to ensure we never go below 0.
-- SECURITY DEFINER means it runs with elevated privileges,
-- so it can update rides even through RLS.

CREATE OR REPLACE FUNCTION decrement_seats(ride_id_input UUID, seats_to_remove INT)
RETURNS void AS $$
BEGIN
  UPDATE rides
  SET available_seats = GREATEST(available_seats - seats_to_remove, 0)
  WHERE id = ride_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- Enable Realtime for ride_requests (if not already done)
-- =====================
-- Phase 1 already added ride_requests to the realtime publication,
-- but we run this as a safety net. If it errors with "already exists",
-- that's fine — it means Phase 1 already set it up.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ride_requests;
EXCEPTION
  WHEN duplicate_object THEN
    -- Already added, nothing to do
    NULL;
END;
$$;

-- ============================================
-- DONE! Now go back and let me generate the
-- React code for DriverActiveRide.jsx.
-- ============================================
