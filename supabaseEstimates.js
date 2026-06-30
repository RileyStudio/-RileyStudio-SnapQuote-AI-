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

// ─────────────────────────────────────────────────────────
// DISPLAY-ONLY seat math for the Plans page.
//
// Fails OPEN: null / undefined / error / empty table all collapse to an
// active count of 0, so the page shows a friendly "10 of 10 Founder seats
// remaining" instead of a bare "—". This is safe HERE because it drives a
// label and a button's disabled state only — NOT the actual oversell
// prevention. The real cap is enforced server-side in
// app/api/create-checkout-session/route.js (areFounderSeatsAvailable, which
// fails CLOSED) and again at activation in the webhook's overflow guard.
// Display optimism, server pessimism — on purpose.
//
// Returns { activeFounderCount, remainingFounderSeats, soldOut } so the
// page never has to special-case null.
export async function getFounderSeatDisplay() {
  let activeFounderCount = 0;

  if (supabase) {
    const { data, error } = await supabase.rpc('count_active_founder_subscribers');
    if (!error && typeof data === 'number' && Number.isFinite(data) && data > 0) {
      activeFounderCount = data;
    }
  }

  const remainingFounderSeats = Math.max(0, FOUNDER_SEAT_TOTAL - activeFounderCount);
  const soldOut = remainingFounderSeats <= 0;

  return { activeFounderCount, remainingFounderSeats, soldOut };
}
