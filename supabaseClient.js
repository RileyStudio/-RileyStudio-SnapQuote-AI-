// Demo-mode usage limits. These exist purely to keep an unauthenticated
// demo session from being used as a free unlimited product — every call
// site that uses this module already checks dataSource/isDemo === local
// first, so a real Supabase session never even reaches these functions.
// This module itself doesn't know or care about auth state; it's just
// localStorage counters with a max.

const LIMITS = {
  estimate: { key: 'snapquote.demo.estimateCount', max: 3, label: 'demo estimates' },
  aiDraft: { key: 'snapquote.demo.aiDraftCount', max: 5, label: 'AI draft generations' },
  pdf: { key: 'snapquote.demo.pdfCount', max: 2, label: 'PDF downloads' },
  approval: { key: 'snapquote.demo.approvalCount', max: 3, label: 'approvals' },
};

export const DEMO_LIMITS = LIMITS;

function readCount(key) {
  if (typeof window === 'undefined') return 0;
  try {
    const n = parseInt(window.localStorage.getItem(key), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch (e) {
    return 0;
  }
}

function writeCount(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch (e) {
    // Storage blocked (private browsing, quota) — demo limits just won't
    // persist across reloads in that case; never throws, never blocks
    // the action itself.
  }
}

export function getDemoCount(type) {
  const limit = LIMITS[type];
  return limit ? readCount(limit.key) : 0;
}

export function getDemoMax(type) {
  return LIMITS[type]?.max ?? Infinity;
}

export function isDemoLimitReached(type) {
  const limit = LIMITS[type];
  if (!limit) return false;
  return readCount(limit.key) >= limit.max;
}

// Call this right before performing the limited action. Returns
// { allowed, count, max, label }. When `allowed` is false, the counter is
// NOT incremented — a blocked attempt doesn't cost anything, so the same
// action can be retried immediately after the user upgrades.
export function tryConsumeDemoLimit(type) {
  const limit = LIMITS[type];
  if (!limit) return { allowed: true, count: 0, max: Infinity, label: '' };

  const current = readCount(limit.key);
  if (current >= limit.max) {
    return { allowed: false, count: current, max: limit.max, label: limit.label };
  }

  const next = current + 1;
  writeCount(limit.key, next);
  return { allowed: true, count: next, max: limit.max, label: limit.label };
}

// Used by the Dashboard's "Load Demo Estimates" / Settings' "Reset Demo
// Settings" flows if a future pass wants a full demo reset; not wired to
// any button yet on its own.
export function resetDemoLimits() {
  Object.values(LIMITS).forEach((limit) => writeCount(limit.key, 0));
}
