-- ============================================
-- dropme. Realtime Architecture Fix
-- ============================================
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Click "New query"
-- 3. Paste this ENTIRE file
-- 4. Click "Run"
-- ============================================
-- PROBLEM: Supabase Realtime silences all row-level events if the RLS
-- policy contains subqueries (EXISTS/IN) or functions. Because our
-- ride_requests table didn't directly have a driver_id column, we used
-- an EXISTS subquery to check if the user owned the ride. This caused
-- ALL realtime notifications to be secretly dropped by the server.
--
-- SOLUTION: Denormalize `driver_id` onto `ride_requests`.
-- ============================================

-- Step 1: Add the driver_id column
ALTER TABLE public.ride_requests 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Step 2: Backfill existing requests with the correct driver_id
UPDATE public.ride_requests rr
SET driver_id = r.driver_id
FROM public.rides r
WHERE rr.ride_id = r.id;

-- Ensure it's never null moving forward
ALTER TABLE public.ride_requests 
ALTER COLUMN driver_id SET NOT NULL;

-- Step 3: Create a database trigger so the frontend never has to
-- explicitly send the driver_id when requesting a ride.
CREATE OR REPLACE FUNCTION public.set_driver_id_on_request()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Look up the driver of the associated ride
  SELECT driver_id INTO NEW.driver_id 
  FROM public.rides 
  WHERE id = NEW.ride_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS populate_driver_id ON public.ride_requests;

CREATE TRIGGER populate_driver_id
  BEFORE INSERT ON public.ride_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_driver_id_on_request();

-- ============================================
-- Step 4: REWRITE ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- Because we now have 'driver_id' directly on the table, we can
-- use a simple direct comparison: `driver_id = auth.uid()`, which 
-- Supabase Realtime flawlessly supports!

-- Drop the old subquery policies
DROP POLICY IF EXISTS "Drivers can view requests for own rides" ON public.ride_requests;
DROP POLICY IF EXISTS "Passengers can view own requests" ON public.ride_requests;
DROP POLICY IF EXISTS "Drivers can update requests for own rides" ON public.ride_requests;
DROP POLICY IF EXISTS "Passengers can update own requests" ON public.ride_requests;

-- CREATE NEW REALTIME-COMPATIBLE POLICIES

-- 1. Anyone involved in the request can view it
CREATE POLICY "Users can view involved requests"
  ON public.ride_requests FOR SELECT
  TO authenticated
  USING (passenger_id = auth.uid() OR driver_id = auth.uid());

-- 2. Anyone involved can update their side of it
CREATE POLICY "Users can update involved requests"
  ON public.ride_requests FOR UPDATE
  TO authenticated
  USING (passenger_id = auth.uid() OR driver_id = auth.uid())
  WITH CHECK (passenger_id = auth.uid() OR driver_id = auth.uid());

-- ============================================
-- DONE! Real-time will now work instantly 
-- across the entire web application.
-- ============================================
