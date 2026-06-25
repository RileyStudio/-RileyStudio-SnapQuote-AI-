import { createClient } from '@supabase/supabase-js';

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// In demo mode (no Supabase project configured yet), export null and let
// pages fall back to lib/mockData.js. This is what lets a buyer click
// through the entire product before any backend is wired up.
export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
