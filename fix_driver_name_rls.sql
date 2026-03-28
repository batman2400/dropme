-- Run this in your Supabase SQL Editor

-- Give ALL authenticated users permission to read profiles
CREATE POLICY "Allow authenticated users to read profiles"
ON public.users
FOR SELECT
TO authenticated
USING (true);

-- Ensure RLS is enabled on the users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
