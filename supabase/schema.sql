-- ==============================================================================
-- Kodewar LMS - Supabase Database Schema
-- Instructions: Run this script in your Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- 1. Create state persistence table
CREATE TABLE IF NOT EXISTS public.lms_state (
  id TEXT PRIMARY KEY DEFAULT 'primary',
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::TEXT, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.lms_state ENABLE ROW LEVEL SECURITY;

-- 3. Create access policy for authenticated service role and anon access
DROP POLICY IF EXISTS "Allow all access to lms_state" ON public.lms_state;

CREATE POLICY "Allow all access to lms_state"
  ON public.lms_state
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Verify initial record placeholder
INSERT INTO public.lms_state (id, data, updated_at)
VALUES ('primary', '{}'::JSONB, timezone('utc'::TEXT, now()))
ON CONFLICT (id) DO NOTHING;

