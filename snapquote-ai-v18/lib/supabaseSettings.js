import { supabase } from './supabaseClient';
import { DEFAULT_SETTINGS } from './settings';

export async function getSettingsRemote(contractorId) {
  const { data: contractor } = await supabase
    .from('contractors')
    .select('*')
    .eq('id', contractorId)
    .single();

  if (!contractor) return DEFAULT_SETTINGS;

  const { data: contractorSettings } = await supabase
    .from('contractor_settings')
    .select('*')
    .eq('contractor_id', contractorId)
    .single();

  return {
    businessProfile: {
      business_name: contractor.business_name || DEFAULT_SETTINGS.businessProfile.business_name,
      owner_name: contractor.owner_name || '',
      phone: contractor.phone || '',
      email: contractor.email || '',
      website: contractor.website || '',
      service_area: contractor.service_area || '',
    },
    branding: {
      logo_data_url: contractor.logo_url || '',
      brand_color: contractor.brand_color || DEFAULT_SETTINGS.branding.brand_color,
      footer_text: contractor.footer_text || '',
      license_note: contractor.license_note || '',
    },
    estimateTerms: contractorSettings
      ? {
          payment_terms: contractorSettings.payment_terms,
          warranty_language: contractorSettings.warranty_language,
          deposit_requirement: contractorSettings.deposit_requirement,
          expiration_days: contractorSettings.expiration_days,
        }
      : DEFAULT_SETTINGS.estimateTerms,
    // Phase 11 — read alongside settings since it lives on the same
    // contractors row; see lib/plans.js for what each tier unlocks.
    plan: contractor.plan || 'solo',
  };
}

export async function saveSettingsRemote(contractorId, settings) {
  const { error: contractorError } = await supabase
    .from('contractors')
    .update({
      business_name: settings.businessProfile.business_name,
      owner_name: settings.businessProfile.owner_name,
      phone: settings.businessProfile.phone,
      email: settings.businessProfile.email,
      website: settings.businessProfile.website,
      service_area: settings.businessProfile.service_area,
      logo_url: settings.branding.logo_data_url,
      brand_color: settings.branding.brand_color,
      footer_text: settings.branding.footer_text,
      license_note: settings.branding.license_note,
    })
    .eq('id', contractorId);

  const { error: settingsError } = await supabase
    .from('contractor_settings')
    .update({
      payment_terms: settings.estimateTerms.payment_terms,
      warranty_language: settings.estimateTerms.warranty_language,
      deposit_requirement: settings.estimateTerms.deposit_requirement,
      expiration_days: settings.estimateTerms.expiration_days,
    })
    .eq('contractor_id', contractorId);

  if (contractorError || settingsError) {
    throw new Error(
      contractorError?.message || settingsError?.message || 'Could not save settings to Supabase.'
    );
  }
}

export async function saveContractorPlanRemote(contractorId, plan) {
  const { error } = await supabase.from('contractors').update({ plan }).eq('id', contractorId);
  if (error) throw new Error(error.message);
}
