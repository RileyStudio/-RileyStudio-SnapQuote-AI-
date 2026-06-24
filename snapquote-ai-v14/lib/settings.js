import { demoContractor } from './mockData';

export const SETTINGS_KEY = 'snapquote_settings';

// Defaults are derived from the existing demo contractor rather than
// duplicated, so "no settings saved yet" and "the original demo branding"
// are always the same thing — this is what makes the Quote Integration
// fallback work for free: getSettings() already returns these defaults
// when localStorage is empty.
export const DEFAULT_SETTINGS = {
  businessProfile: {
    business_name: demoContractor.business_name,
    owner_name: 'Joseph Riley',
    phone: demoContractor.phone,
    email: demoContractor.email,
    website: '',
    service_area: 'Mount Pleasant & Mount Vernon, TX',
  },
  branding: {
    logo_data_url: '',
    brand_color: demoContractor.brand_color,
    footer_text: 'Thank you for trusting us with your home.',
    license_note: `${demoContractor.license_number} · Licensed & Insured`,
  },
  estimateTerms: {
    payment_terms: 'Remaining balance due upon completion. We accept cash, check, or card.',
    warranty_language:
      '1-year labor warranty on all work performed. Manufacturer warranties apply to materials where applicable.',
    deposit_requirement: '50% deposit required to schedule the job',
    expiration_days: 14,
  },
};

function deepMerge(defaults, saved) {
  if (!saved) return defaults;
  const result = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const defaultValue = defaults[key];
    if (defaultValue && typeof defaultValue === 'object' && !Array.isArray(defaultValue)) {
      result[key] = { ...defaultValue, ...(saved[key] || {}) };
    } else {
      result[key] = key in saved ? saved[key] : defaultValue;
    }
  }
  return result;
}

// SSR-safe: returns the defaults on the server (no window), and the real
// saved settings (merged over defaults, so a partially-saved/older shape
// never produces missing fields) once running in the browser.
export function getSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = window.localStorage.getItem(SETTINGS_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    return deepMerge(DEFAULT_SETTINGS, JSON.parse(stored));
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function resetSettings() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SETTINGS_KEY);
}

export function initialsOf(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Shared shape consumed by the quote page header and the Review screen's
// branding preview — one place that decides how settings become "the
// contractor as the customer will see them."
export function contractorFromSettings(settings) {
  return {
    business_name: settings.businessProfile.business_name,
    initials: initialsOf(settings.businessProfile.business_name),
    brand_color: settings.branding.brand_color,
    phone: settings.businessProfile.phone,
    logo_url: settings.branding.logo_data_url || undefined,
    license_note: settings.branding.license_note,
  };
}

// New Estimate prefills its Notes and Terms section from these defaults
// when starting a fresh draft, so the contractor isn't retyping the same
// payment/warranty language on every job.
export function defaultEstimateNotes(estimateTerms) {
  const payment_terms = estimateTerms.deposit_requirement
    ? `${estimateTerms.deposit_requirement}. ${estimateTerms.payment_terms}`.trim()
    : estimateTerms.payment_terms;

  return {
    warranty: estimateTerms.warranty_language,
    payment_terms,
  };
}
