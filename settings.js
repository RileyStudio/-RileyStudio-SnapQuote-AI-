import { createClient } from '@supabase/supabase-js';

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// In demo mode (no Supabase project configured yet), export null and let
// pages fall back to lib/mockData.js. This is what lets a buyer click
// through the entire product before any backend is wired up.
//
// app/login/page.jsx uses signUp/signInWithPassword (email + password,
// not magic links) — works best with Supabase's "Confirm email" setting
// turned off (see README), so signUp() returns a session immediately
// instead of requiring an email click. app/auth/callback/page.jsx is now
// only a fallback for a confirmation-link ?code=... on projects that
// leave "Confirm email" on; the default detectSessionInUrl: true doesn't
// hurt here, but nothing relies on it.
export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
