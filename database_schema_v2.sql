-- ============================================
-- dropme. Database Schema v2 — Phase 1
-- ============================================
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard
-- 2. Go to SQL Editor (left sidebar)
-- 3. Click "New query"
-- 4. Copy-paste this ENTIRE file
-- 5. Click "Run"
-- ============================================

-- =====================
-- STEP 1: Drop old tables
-- =====================
-- Remove the old schema so we can start fresh.
-- CASCADE ensures dependent objects (policies, triggers) are also dropped.
DROP TABLE IF EXISTS requests CASCADE;
DROP TABLE IF EXISTS rides CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================
-- STEP 2: Enable PostGIS
-- =====================
-- PostGIS adds geographic functions to PostgreSQL.
-- We enable it now for future proximity queries.
CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================
-- STEP 3: Create PROFILES table
-- =====================
-- Stores user profile data. The primary key (id) is the SAME as auth.users.id.
-- This means: profiles.id = the logged-in user's UUID from Supabase Auth.
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  avatar_url      TEXT,          -- profile picture URL (from Supabase Storage)
  phone_number    TEXT,          -- WhatsApp number
  is_verified     BOOLEAN DEFAULT false,  -- true once driving license is approved
  license_image_url TEXT,        -- URL of uploaded driving license image
  vehicle_type    TEXT CHECK (vehicle_type IN ('bike', 'tuk', 'car')),
  vehicle_plate   TEXT,          -- license plate number
  rating_avg      NUMERIC(2,1) DEFAULT 5.0,  -- average star rating (1.0 – 5.0)
  total_ratings   INTEGER DEFAULT 0,          -- number of ratings received
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- STEP 4: Create RIDES table
-- =====================
-- Drivers post rides here. Each ride has start/end coordinates,
-- a route polyline, seat count, and a pre-calculated fare.
CREATE TABLE rides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vehicle_type    TEXT NOT NULL CHECK (vehicle_type IN ('bike', 'tuk', 'car')),
  available_seats INTEGER NOT NULL CHECK (available_seats >= 0),
  start_lat       DOUBLE PRECISION NOT NULL,
  start_lng       DOUBLE PRECISION NOT NULL,
  end_lat         DOUBLE PRECISION NOT NULL,
  end_lng         DOUBLE PRECISION NOT NULL,
  start_address   TEXT NOT NULL,           -- human-readable pickup name
  end_address     TEXT NOT NULL,           -- human-readable dropoff name
  route_polyline  TEXT,                    -- encoded polyline from Google Directions API
  departure_time  TIMESTAMPTZ NOT NULL,
  price_per_seat  INTEGER NOT NULL,        -- fare in Rs (pre-calculated)
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'in_progress', 'completed', 'cancelled')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- STEP 5: Create RIDE_REQUESTS table
-- =====================
-- Passengers request to join a ride. The driver accepts or rejects.
-- Each request has its own pickup/dropoff (supports multi-seat booking
-- where different passengers board at different points).
CREATE TABLE ride_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id         UUID REFERENCES rides(id) ON DELETE CASCADE NOT NULL,
  passenger_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  seats_requested INTEGER NOT NULL DEFAULT 1 CHECK (seats_requested > 0),
  pickup_lat      DOUBLE PRECISION NOT NULL,
  pickup_lng      DOUBLE PRECISION NOT NULL,
  dropoff_lat     DOUBLE PRECISION NOT NULL,
  dropoff_lng     DOUBLE PRECISION NOT NULL,
  pickup_address  TEXT NOT NULL,           -- human-readable pickup name
  dropoff_address TEXT NOT NULL,           -- human-readable dropoff name
  fare            INTEGER NOT NULL,        -- fare for THIS passenger's trip in Rs
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- STEP 6: Enable Row Level Security (RLS)
-- =====================
-- RLS makes sure users can only access data they are allowed to.
-- Without RLS, anyone with the anon key could read/write everything!
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_requests ENABLE ROW LEVEL SECURITY;

-- ── PROFILES POLICIES ──

-- Anyone logged in can view any profile (needed for ride cards, driver info)
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can only create their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can only edit their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── RIDES POLICIES ──

-- Anyone logged in can see active or in-progress rides (for browsing)
CREATE POLICY "Anyone can view active rides"
  ON rides FOR SELECT
  TO authenticated
  USING (status IN ('active', 'in_progress'));

-- Drivers can also see ALL of their own rides (including completed/cancelled)
CREATE POLICY "Drivers can view own rides"
  ON rides FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

-- Only the driver can create a ride (driver_id must match their auth ID)
CREATE POLICY "Drivers can insert rides"
  ON rides FOR INSERT
  TO authenticated
  WITH CHECK (driver_id = auth.uid());

-- Only the driver can update their own ride (e.g., change status, seats)
CREATE POLICY "Drivers can update own rides"
  ON rides FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

-- Only the driver can delete their own ride
CREATE POLICY "Drivers can delete own rides"
  ON rides FOR DELETE
  TO authenticated
  USING (driver_id = auth.uid());

-- ── RIDE_REQUESTS POLICIES ──

-- Passengers can see their own requests
CREATE POLICY "Passengers can view own requests"
  ON ride_requests FOR SELECT
  TO authenticated
  USING (passenger_id = auth.uid());

-- Drivers can see requests for their rides (so they can accept/reject)
CREATE POLICY "Drivers can view requests for own rides"
  ON ride_requests FOR SELECT
  TO authenticated
  USING (
    ride_id IN (SELECT id FROM rides WHERE driver_id = auth.uid())
  );

-- Passengers can create a ride request (passenger_id must match their auth ID)
CREATE POLICY "Passengers can insert requests"
  ON ride_requests FOR INSERT
  TO authenticated
  WITH CHECK (passenger_id = auth.uid());

-- Passengers can update their own requests (e.g., cancel)
CREATE POLICY "Passengers can update own requests"
  ON ride_requests FOR UPDATE
  TO authenticated
  USING (passenger_id = auth.uid())
  WITH CHECK (passenger_id = auth.uid());

-- Drivers can update requests for their rides (e.g., accept/reject)
CREATE POLICY "Drivers can update requests for own rides"
  ON ride_requests FOR UPDATE
  TO authenticated
  USING (
    ride_id IN (SELECT id FROM rides WHERE driver_id = auth.uid())
  );

-- =====================
-- STEP 7: Auto-create profile on signup
-- =====================
-- This trigger automatically creates a row in 'profiles' whenever
-- a new user signs up via Supabase Auth (Google OAuth, email, etc).
-- The user never has to manually create their profile.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- runs with elevated privileges to insert into profiles
SET search_path = public  -- prevents search_path injection
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    -- Pull the name from Google OAuth metadata (or email as fallback)
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      NEW.email
    ),
    -- Pull the avatar from Google OAuth metadata
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Attach the trigger to auth.users
-- DROP first in case it already exists from a previous run
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================
-- STEP 8: Enable Realtime
-- =====================
-- This tells Supabase to broadcast changes to these tables over WebSockets.
-- We need this for the ride request handshake (instant notifications).
ALTER PUBLICATION supabase_realtime ADD TABLE ride_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE rides;

-- ============================================
-- DONE! Your Phase 1 database is ready.
-- Now go create the 'verification_docs' storage bucket
-- (see the instructions in the implementation plan).
-- ============================================
