import { supabase } from './supabaseClient';

export const FOUNDER_SEAT_TOTAL = 10;

// Returns remaining Founder seats out of 10, or null if it genuinely
// can't be determined (Supabase not configured, or the RPC call itself
// failed). Callers must treat null as "unknown," never as "available" —
// the whole point of this check is to never oversell past 10 seats, so
// failing to determine the count should fail closed, not open.
export async function getFounderSeatsRemaining() {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('count_active_founder_subscribers');
  if (error || typeof data !== 'number') return null;

  return Math.max(0, FOUNDER_SEAT_TOTAL - data);
}

export async function areFounderSeatsAvailable() {
  const remaining = await getFounderSeatsRemaining();
  return remaining !== null && remaining > 0;
}
