-- ============================================
-- dropme. Enable Full Replica Identity for Realtime
-- ============================================
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Click "New query", paste this file, and Run.
-- ============================================
-- PROBLEM: Postgres only sends the "changed" columns during an UPDATE event 
-- (like changing status from 'pending' to 'cancelled'). It DOES NOT send 
-- ride_id, driver_id, or passenger_id over the websocket. 
-- Because those columns are missing in the update packet, our security rules 
-- (which check driver_id) automatically reject the update, meaning the web app 
-- never sees the cancellation unless you refresh.
--
-- SOLUTION: Set REPLICA IDENTITY FULL so Postgres sends the entire row 
-- on every update, allowing Realtime checks to work perfectly.
-- ============================================

ALTER TABLE public.ride_requests REPLICA IDENTITY FULL;
ALTER TABLE public.rides REPLICA IDENTITY FULL;
