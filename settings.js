import { createClient } from '@supabase/supabase-js';

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// In demo mode (no Supabase project configured yet), export null and let
// pages fall back to lib/mockData.js. This is what lets a buyer click
// through the entire product before any backend is wired up.
//
// Note: createClient()'s default options include detectSessionInUrl: true,
// which is relied on by app/auth/callback/page.jsx — it lets the SDK parse
// a hash-fragment session (#access_token=...) automatically for magic-link
// logins that don't use the PKCE ?code= flow. Don't disable it without
// updating that page too.
export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
