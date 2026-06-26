'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import BigButton from '@/components/BigButton';
import SectionLabel from '@/components/SectionLabel';
import TextField from '@/components/TextField';
import TextAreaField from '@/components/TextAreaField';
import LogoUploader from '@/components/LogoUploader';
import { DEFAULT_SETTINGS, getSettings, saveSettings, resetSettings, initialsOf } from '@/lib/settings';
import { supabase } from '@/lib/supabaseClient';
import { getSettingsRemote, saveSettingsRemote, saveContractorPlanRemote } from '@/lib/supabaseSettings';
import { uploadLogo } from '@/lib/supabaseStorage';
import { PLANS, PLAN_ORDER, planLabel, hasFeature } from '@/lib/plans';

const BRAND_COLOR_PRESETS = ['#FF5A1F', '#1E5AA8', '#1F8A4C', '#C0392B', '#1C1F23', '#0E7C86'];

export default function SettingsPage() {
  const [businessProfile, setBusinessProfile] = useState(DEFAULT_SETTINGS.businessProfile);
  const [branding, setBranding] = useState(DEFAULT_SETTINGS.branding);
  const [estimateTerms, setEstimateTerms] = useState(DEFAULT_SETTINGS.estimateTerms);
  const [plan, setPlan] = useState(DEFAULT_SETTINGS.plan);
  const [statusMessage, setStatusMessage] = useState('');
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [logoUploadStatus, setLogoUploadStatus] = useState('');

  // 'local' = demo mode (localStorage). 'remote' = a real Supabase
  // session exists — Save/Reset write to the contractors/contractor_settings
  // tables instead.
  const [dataSource, setDataSource] = useState('local');
  const [contractorId, setContractorId] = useState(null);

  // Load on refresh — client-only, so this never causes a hydration
  // mismatch against the DEFAULT_SETTINGS used for the initial render.
  useEffect(() => {
    async function load() {
      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (userId) {
          setDataSource('remote');
          setContractorId(userId);
          const settings = await getSettingsRemote(userId);
          setBusinessProfile(settings.businessProfile);
          setBranding(settings.branding);
          setEstimateTerms(settings.estimateTerms);
          setPlan(settings.plan || 'solo');
          return;
        }
      }
      setDataSource('local');
      const settings = getSettings();
      setBusinessProfile(settings.businessProfile);
      setBranding(settings.branding);
      setEstimateTerms(settings.estimateTerms);
      setPlan(settings.plan || 'solo');
    }
    load();
  }, []);

  async function handleLogoFileSelected(file) {
    if (dataSource !== 'remote' || !contractorId) return;
    setLogoUploadStatus('Uploading logo…');
    try {
      const url = await uploadLogo(contractorId, file);
      if (url) {
        setBranding((prev) => ({ ...prev, logo_data_url: url }));
        setLogoUploadStatus('Logo uploaded.');
      } else {
        setLogoUploadStatus('Could not upload logo — using local preview for now.');
      }
    } catch (e) {
      setLogoUploadStatus(e.message || 'Could not upload logo — using local preview for now.');
    }
    setTimeout(() => setLogoUploadStatus(''), 2500);
  }

  async function handlePlanChange(newPlan) {
    setPlan(newPlan);
    if (dataSource === 'remote') {
      try {
        await saveContractorPlanRemote(contractorId, newPlan);
      } catch (e) {
        flashMessage(e.message || 'Could not change plan.');
        return;
      }
    } else {
      saveSettings({ businessProfile, branding, estimateTerms, plan: newPlan });
    }
    flashMessage(`Switched to the ${planLabel(newPlan)} plan.`);
  }

  async function handleSave() {
    if (dataSource === 'remote') {
      try {
        await saveSettingsRemote(contractorId, { businessProfile, branding, estimateTerms });
        flashMessage('Settings saved.');
      } catch (e) {
        flashMessage(e.message || 'Could not save settings.');
      }
      return;
    }
    saveSettings({ businessProfile, branding, estimateTerms, plan });
    flashMessage('Settings saved.');
  }

  async function handleReset() {
    if (dataSource === 'remote') {
      try {
        await saveSettingsRemote(contractorId, DEFAULT_SETTINGS);
        setBusinessProfile(DEFAULT_SETTINGS.businessProfile);
        setBranding(DEFAULT_SETTINGS.branding);
        setEstimateTerms(DEFAULT_SETTINGS.estimateTerms);
        setConfirmingReset(false);
        flashMessage('Reset to demo defaults.');
      } catch (e) {
        flashMessage(e.message || 'Could not reset settings.');
      }
      return;
    }
    resetSettings();
    setBusinessProfile(DEFAULT_SETTINGS.businessProfile);
    setBranding(DEFAULT_SETTINGS.branding);
    setEstimateTerms(DEFAULT_SETTINGS.estimateTerms);
    setPlan(DEFAULT_SETTINGS.plan);
    setConfirmingReset(false);
    flashMessage('Reset to demo defaults.');
  }

  function flashMessage(text) {
    setStatusMessage(text);
    setTimeout(() => setStatusMessage(''), 2500);
  }

  const initials = initialsOf(businessProfile.business_name);

  return (
    <main className="max-w-3xl mx-auto px-5 py-6 pb-36 lg:pb-10">
      <header className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard" className="text-sm text-ink/50 font-display font-semibold">
            ← Dashboard
          </Link>
          <h1 className="font-display font-bold text-2xl mt-1">Settings</h1>
        </div>
        <Logo size="sm" />
      </header>

      <div className="space-y-6">
        {/* Plan — Phase 11: feature gates only, no billing wired up.
            Switching is instant and free; the point is to demo what each
            tier unlocks below (Branding) and elsewhere (Dashboard history,
            email notifications), not to charge anyone. */}
        <div className="bg-white rounded-card shadow-card p-5">
          <SectionLabel>Plan</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PLAN_ORDER.map((p) => {
              const isCurrent = plan === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePlanChange(p)}
                  className={`text-left rounded-card border p-4 transition-colors ${
                    isCurrent ? 'border-orange bg-orange/5' : 'border-line bg-white hover:bg-line/20'
                  }`}
                >
                  <p className="font-display font-bold text-lg flex items-center gap-2">
                    {PLANS[p].label}
                    {isCurrent && (
                      <span className="text-[10px] uppercase tracking-wide bg-orange text-white rounded-full px-2 py-0.5">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="font-display font-extrabold text-base mt-0.5">{PLANS[p].price}</p>
                  <p className="text-xs text-ink/60 mt-1">{PLANS[p].tagline}</p>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink/45 mt-3">
            No payment required — this switches your plan instantly for demo purposes. Full
            feature comparison is on the{' '}
            <Link href="/#pricing" className="underline">
              landing page
            </Link>
            .
          </p>
          {hasFeature(plan, 'founderPricing') && (
            <div className="mt-4 rounded-card bg-ink text-paper px-4 py-3">
              <p className="font-display font-bold text-sm">🎉 Founding Contractor</p>
              <p className="text-xs text-paper/70 mt-1">
                First 10 only. $10/month locked for life while subscribed — including every future
                add-on, discounted for as long as you stay on.
              </p>
            </div>
          )}
        </div>

        {/* Business Profile */}
        <div className="bg-white rounded-card shadow-card p-5">
          <SectionLabel>Business Profile</SectionLabel>
          <div className="grid sm:grid-cols-2 gap-3">
            <TextField
              label="Business Name"
              value={businessProfile.business_name}
              onChange={(v) => setBusinessProfile({ ...businessProfile, business_name: v })}
            />
            <TextField
              label="Owner Name"
              value={businessProfile.owner_name}
              onChange={(v) => setBusinessProfile({ ...businessProfile, owner_name: v })}
            />
            <TextField
              label="Phone"
              type="tel"
              value={businessProfile.phone}
              onChange={(v) => setBusinessProfile({ ...businessProfile, phone: v })}
            />
            <TextField
              label="Email"
              type="email"
              value={businessProfile.email}
              onChange={(v) => setBusinessProfile({ ...businessProfile, email: v })}
            />
            <TextField
              label="Website"
              placeholder="https://yourbusiness.com"
              value={businessProfile.website}
              onChange={(v) => setBusinessProfile({ ...businessProfile, website: v })}
            />
            <TextField
              label="Service Area"
              value={businessProfile.service_area}
              onChange={(v) => setBusinessProfile({ ...businessProfile, service_area: v })}
            />
          </div>
        </div>

        {/* Branding — dashed dividers echo the estimate ticket aesthetic.
            Phase 11: gated behind the Pro/Team plans. */}
        {hasFeature(plan, 'branding') ? (
        <div className="bg-white rounded-card shadow-card overflow-hidden">
          <div className="p-5">
            <SectionLabel>Branding</SectionLabel>
            <LogoUploader
              logoDataUrl={branding.logo_data_url}
              brandColor={branding.brand_color}
              initials={initials}
              onChange={(dataUrl) => setBranding({ ...branding, logo_data_url: dataUrl })}
              onFileSelected={handleLogoFileSelected}
            />
            {logoUploadStatus && <p className="text-xs text-ink/50 mt-2">{logoUploadStatus}</p>}
          </div>

          <div className="border-t border-dashed border-line mx-5" />

          <div className="p-5">
            <p className="font-display text-xs uppercase tracking-wide text-ink/50 font-semibold mb-2">
              Brand Color
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {BRAND_COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use ${color} as brand color`}
                  onClick={() => setBranding({ ...branding, brand_color: color })}
                  className="w-9 h-9 rounded-full border-2"
                  style={{
                    backgroundColor: color,
                    borderColor: branding.brand_color === color ? '#1C1F23' : 'transparent',
                  }}
                />
              ))}
              <label
                className="relative w-9 h-9 rounded-full border border-line flex items-center justify-center
                  cursor-pointer text-ink/40 text-sm overflow-hidden"
                title="Custom color"
              >
                <input
                  type="color"
                  value={branding.brand_color}
                  onChange={(e) => setBranding({ ...branding, brand_color: e.target.value })}
                  className="absolute opacity-0 w-0 h-0"
                />
                +
              </label>
            </div>
          </div>

          <div className="border-t border-dashed border-line mx-5" />

          <div className="p-5 space-y-4">
            <TextAreaField
              label="Quote Footer Text"
              value={branding.footer_text}
              onChange={(v) => setBranding({ ...branding, footer_text: v })}
              full
            />
            <TextField
              label="License / Insurance Note"
              value={branding.license_note}
              onChange={(v) => setBranding({ ...branding, license_note: v })}
              full
            />
          </div>
        </div>
        ) : (
          <UpsellCard
            title="Branding"
            description="Upload a logo, pick a brand color, and customize your quote footer and license note."
            requiredPlan="founder"
            altPlan="pro"
          />
        )}

        {/* Default Estimate Terms */}
        <div className="bg-white rounded-card shadow-card p-5 space-y-4">
          <SectionLabel>Default Estimate Terms</SectionLabel>
          <TextAreaField
            label="Payment Terms"
            value={estimateTerms.payment_terms}
            onChange={(v) => setEstimateTerms({ ...estimateTerms, payment_terms: v })}
            full
          />
          <TextAreaField
            label="Warranty Language"
            value={estimateTerms.warranty_language}
            onChange={(v) => setEstimateTerms({ ...estimateTerms, warranty_language: v })}
            full
          />
          <TextField
            label="Deposit Requirement"
            value={estimateTerms.deposit_requirement}
            onChange={(v) => setEstimateTerms({ ...estimateTerms, deposit_requirement: v })}
            full
          />
          <label className="block max-w-xs">
            <span className="font-display text-xs uppercase tracking-wide text-ink/50 font-semibold">
              Quote Expiration (days)
            </span>
            <input
              type="number"
              min="1"
              value={estimateTerms.expiration_days}
              onChange={(e) =>
                setEstimateTerms({
                  ...estimateTerms,
                  expiration_days: parseInt(e.target.value, 10) || 1,
                })
              }
              className="tap-target mt-1 w-full rounded-card border border-line bg-white px-3 text-sm
                focus-visible:outline focus-visible:outline-3 focus-visible:outline-site"
            />
          </label>
        </div>

        {/* Team — Phase 11: gated behind the Team plan. A real invite
            flow needs actual multi-user auth/roles, which is out of scope
            here; this is the gate + placeholder for that future build. */}
        {hasFeature(plan, 'multiUser') ? (
          <div className="bg-white rounded-card shadow-card p-5">
            <SectionLabel>Team</SectionLabel>
            <p className="text-sm text-ink/70 mb-3">
              Invite crew members to share this Dashboard. Multi-user accounts aren't built yet —
              this is a placeholder for that.
            </p>
            <button
              type="button"
              disabled
              className="tap-target w-full rounded-card font-display font-semibold text-lg tracking-wide
                px-6 bg-line/40 text-ink/40 cursor-not-allowed"
            >
              Invite Team Member (coming soon)
            </button>
          </div>
        ) : (
          <UpsellCard
            title="Team"
            description="Invite crew members so more than one person can manage estimates."
            requiredPlan="team"
          />
        )}
      </div>

      {/* Desktop actions */}
      <div className="hidden lg:flex items-center gap-3 mt-6">
        <BigButton variant="primary" fullWidth={false} className="px-8" onClick={handleSave}>
          Save Settings
        </BigButton>

        {confirmingReset ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink/60">Reset branding and terms to demo defaults?</span>
            <BigButton variant="ghost" fullWidth={false} className="px-4" onClick={handleReset}>
              Confirm Reset
            </BigButton>
            <BigButton
              variant="ghost"
              fullWidth={false}
              className="px-4"
              onClick={() => setConfirmingReset(false)}
            >
              Cancel
            </BigButton>
          </div>
        ) : (
          <BigButton
            variant="ghost"
            fullWidth={false}
            className="px-8"
            onClick={() => setConfirmingReset(true)}
          >
            Reset Demo Settings
          </BigButton>
        )}

        {statusMessage && <p className="text-sm text-approved">{statusMessage}</p>}
      </div>

      {/* Mobile sticky actions */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-line px-5 py-3 space-y-2 z-40">
        {confirmingReset ? (
          <div className="text-center">
            <p className="text-xs text-ink/60 mb-2">Reset branding and terms to demo defaults?</p>
            <div className="flex gap-2">
              <BigButton variant="ghost" onClick={() => setConfirmingReset(false)}>
                Cancel
              </BigButton>
              <BigButton variant="primary" onClick={handleReset}>
                Confirm Reset
              </BigButton>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <BigButton variant="ghost" onClick={() => setConfirmingReset(true)}>
              Reset
            </BigButton>
            <BigButton variant="primary" onClick={handleSave}>
              Save Settings
            </BigButton>
          </div>
        )}
        {statusMessage && <p className="text-center text-xs text-approved">{statusMessage}</p>}
      </div>
    </main>
  );
}

function UpsellCard({ title, description, requiredPlan, altPlan }) {
  return (
    <div className="bg-white rounded-card shadow-card p-5 border-2 border-dashed border-line">
      <div className="flex items-center justify-between mb-2">
        <SectionLabel>{title}</SectionLabel>
        <span className="text-[10px] font-display font-semibold uppercase tracking-wide
          bg-ink text-paper rounded-full px-2 py-0.5">
          {planLabel(requiredPlan)}{altPlan ? ` / ${planLabel(altPlan)}` : '+'}
        </span>
      </div>
      <p className="text-sm text-ink/60">{description}</p>
      <p className="text-xs text-ink/40 mt-2">
        Switch to the {planLabel(requiredPlan)}
        {altPlan ? ` or ${planLabel(altPlan)}` : ''} plan above to unlock this.
      </p>
    </div>
  );
}
