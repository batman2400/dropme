-- ============================================
-- dropme. Database Schema for Supabase
-- ============================================
-- INSTRUCTIONS: Copy and paste this entire file
-- into the Supabase SQL Editor and click "Run".
-- ============================================

-- 1. USERS TABLE
-- Stores profile data linked to Supabase Auth
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  user_type TEXT NOT NULL CHECK (user_type IN ('passenger', 'driver')) DEFAULT 'passenger',
  vehicle_type TEXT,
  license_plate TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. RIDES TABLE
-- Drivers post available rides
CREATE TABLE IF NOT EXISTS rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  vehicle_type TEXT NOT NULL,
  available_seats INTEGER NOT NULL CHECK (available_seats > 0),
  starting_point TEXT NOT NULL,
  end_point TEXT NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL,
  calculated_fare INTEGER,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. REQUESTS TABLE
-- Passengers search for rides
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  seats_needed INTEGER NOT NULL CHECK (seats_needed > 0) DEFAULT 1,
  pickup_location TEXT NOT NULL,
  dropoff_location TEXT NOT NULL,
  pickup_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('searching', 'matched', 'cancelled')) DEFAULT 'searching',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. ROW LEVEL SECURITY (RLS)
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = user_id);

-- All authenticated users can view other users' profiles (needed for ride cards)
CREATE POLICY "Authenticated users can view all profiles" ON users
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = user_id);

-- Everyone can view active rides
CREATE POLICY "Anyone can view active rides" ON rides
  FOR SELECT USING (status = 'active');

-- Drivers can insert their own rides
CREATE POLICY "Drivers can insert rides" ON rides
  FOR INSERT WITH CHECK (
    driver_id IN (SELECT id FROM users WHERE user_id = auth.uid())
  );

-- Drivers can update their own rides
CREATE POLICY "Drivers can update own rides" ON rides
  FOR UPDATE USING (
    driver_id IN (SELECT id FROM users WHERE user_id = auth.uid())
  );

-- Drivers can delete their own rides
CREATE POLICY "Drivers can delete own rides" ON rides
  FOR DELETE USING (
    driver_id IN (SELECT id FROM users WHERE user_id = auth.uid())
  );

-- Drivers can view ALL of their own rides (any status)
CREATE POLICY "Drivers can view own rides" ON rides
  FOR SELECT USING (
    driver_id IN (SELECT id FROM users WHERE user_id = auth.uid())
  );

-- Passengers can view their own requests
CREATE POLICY "Passengers can view own requests" ON requests
  FOR SELECT USING (
    passenger_id IN (SELECT id FROM users WHERE user_id = auth.uid())
  );

-- Passengers can insert their own requests
CREATE POLICY "Passengers can insert requests" ON requests
  FOR INSERT WITH CHECK (
    passenger_id IN (SELECT id FROM users WHERE user_id = auth.uid())
  );

-- Passengers can update their own requests
CREATE POLICY "Passengers can update own requests" ON requests
  FOR UPDATE USING (
    passenger_id IN (SELECT id FROM users WHERE user_id = auth.uid())
  );

