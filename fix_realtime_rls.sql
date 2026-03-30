-- ============================================
-- dropme. Fix Realtime RLS for ride_requests
-- ============================================
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Click "New query"
-- 3. Paste this ENTIRE file
-- 4. Click "Run"
-- ============================================
-- PROBLEM: The RLS policy "Drivers can view requests for own rides" uses
-- a subquery (ride_id IN (SELECT ...)) which Supabase Realtime cannot
-- evaluate. This breaks real-time ride request notifications for drivers.
--
-- SOLUTION: Add a direct SELECT policy that Realtime can handle.
-- We also add a helper column or use a simpler check.
-- ============================================

-- Step 1: Drop the old subquery-based SELECT policy for drivers
DROP POLICY IF EXISTS "Drivers can view requests for own rides" ON ride_requests;

-- Step 2: Create a new, realtime-friendly SELECT policy
-- This policy lets authenticated users see ride_requests where:
-- a) They are the passenger (passenger_id = auth.uid()), OR
-- b) They are the driver of the associated ride
-- We use EXISTS with a direct join which Supabase Realtime handles better
CREATE POLICY "Drivers can view requests for own rides"
  ON ride_requests FOR SELECT
  TO authenticated
  USING (
    passenger_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = ride_requests.ride_id
        AND rides.driver_id = auth.uid()
    )
  );

-- Step 3: Drop the passenger-only SELECT policy since the new one covers both
DROP POLICY IF EXISTS "Passengers can view own requests" ON ride_requests;

-- Step 4: Also fix the driver UPDATE policy (same subquery issue)
DROP POLICY IF EXISTS "Drivers can update requests for own rides" ON ride_requests;

CREATE POLICY "Drivers can update requests for own rides"
  ON ride_requests FOR UPDATE
  TO authenticated
  USING (
    passenger_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = ride_requests.ride_id
        AND rides.driver_id = auth.uid()
    )
  );

-- ============================================
-- DONE! Realtime should now work for drivers.
-- ============================================
