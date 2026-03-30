-- ============================================
-- dropme. Push Subscriptions Table
-- ============================================
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard → SQL Editor
-- 2. Click "New query"
-- 3. Copy-paste this ENTIRE file
-- 4. Click "Run"
-- ============================================

-- =====================
-- STEP 1: Create PUSH_SUBSCRIPTIONS table
-- =====================
-- Stores Web Push subscription data for each user/device.
-- When a user opens the app and grants notification permission,
-- the browser generates a push subscription (endpoint + keys).
-- We store it here so our Edge Function can send push notifications
-- even when the browser is completely closed.
--
-- A user can have multiple subscriptions (e.g., laptop + phone),
-- so the primary key is the endpoint URL (unique per device).

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  endpoint        TEXT NOT NULL,          -- The push service URL (unique per device/browser)
  p256dh          TEXT NOT NULL,          -- Browser's public encryption key
  auth            TEXT NOT NULL,          -- Browser's authentication secret
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  -- Each device/browser endpoint should only appear once per user
  UNIQUE(user_id, endpoint)
);

-- Create an index for fast lookups by user_id
-- (we'll query this when sending push notifications to a specific user)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON push_subscriptions(user_id);

-- =====================
-- STEP 2: Enable Row Level Security (RLS)
-- =====================
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own push subscriptions
CREATE POLICY "Users can view own push subscriptions"
  ON push_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own push subscriptions
CREATE POLICY "Users can insert own push subscriptions"
  ON push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own push subscriptions (e.g., refresh keys)
CREATE POLICY "Users can update own push subscriptions"
  ON push_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own push subscriptions (e.g., logout/unsubscribe)
CREATE POLICY "Users can delete own push subscriptions"
  ON push_subscriptions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =====================
-- STEP 3: Allow Edge Function to read subscriptions
-- =====================
-- The Supabase Edge Function uses the SERVICE_ROLE key,
-- which bypasses RLS. So no extra policy is needed for it.
-- This comment is here just to clarify: the Edge Function
-- CAN read any user's subscription to send them a push.

-- ============================================
-- DONE! The push_subscriptions table is ready.
-- Next: Add frontend subscription logic (Step 3)
-- ============================================
