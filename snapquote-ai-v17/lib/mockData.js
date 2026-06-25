// Demo data — powers the click-through demo for prospective buyers.
// None of this requires a live Supabase project or API keys.

export const demoContractor = {
  id: 'demo-contractor-001',
  business_name: 'Riley Roofing Co.',
  phone: '(903) 555-0102',
  email: 'demo@snapquoteai.app',
  brand_color: '#FF5A1F',
  license_number: 'TX-RC-44821',
};

export const demoJobs = [
  {
    id: 'job-001',
    customer_name: 'Dana Whitfield',
    customer_phone: '(903) 555-0148',
    customer_email: 'dana.w@example.com',
    address: '123 Oak Street, Mount Pleasant, TX',
    job_type: 'Roofing',
    status: 'sent',
    total_price: 940,
    created_at: '2026-06-18T14:30:00Z',
  },
  {
    id: 'job-002',
    customer_name: 'Marcus Webb',
    customer_phone: '(903) 555-0199',
    customer_email: 'marcus.webb@example.com',
    address: '14 Pine Court, Mount Vernon, TX',
    job_type: 'Painting',
    status: 'approved',
    total_price: 1150,
    created_at: '2026-06-15T09:00:00Z',
  },
  {
    id: 'job-003',
    customer_name: 'Lena Ortiz',
    customer_phone: '(903) 555-0173',
    customer_email: 'lena.ortiz@example.com',
    address: '88 River Rd, Mount Pleasant, TX',
    job_type: 'HVAC',
    status: 'draft',
    total_price: null,
    created_at: '2026-06-20T16:45:00Z',
  },
];

// Full record for the public Customer Quote View — everything that screen
// needs in one object, independent of demoEstimate above, since the
// customer view also needs branding, photos, and dates that the contractor
// review screen doesn't.
export const demoQuote = {
  id: 'demo-quote-001',
  ticket_number: 'SQ-1042',
  customer_name: 'Dana Whitfield',
  address: '123 Oak Street, Mount Pleasant, TX',
  job_type: 'Roofing',
  quote_date: '2026-06-18',
  expiration_date: '2026-07-02',
  contractor: {
    business_name: 'Riley Roofing Co.',
    initials: 'RR',
    brand_color: '#FF5A1F',
    phone: '(903) 555-0102',
    license_number: 'TX-RC-44821',
  },
  photos: [
    { id: 'p1', caption: 'Ridge — before repair' },
    { id: 'p2', caption: 'Chimney flashing' },
    { id: 'p3', caption: 'Vent area water damage' },
    { id: 'p4', caption: 'Decking close-up' },
  ],
  scope_of_work:
    'Remove and replace approximately 30 damaged shingles along the roof ridge. Inspect and reseal chimney flashing. Repair decking and shingles around the vent pipe where water damage was identified.',
  materials: [
    { description: 'Architectural shingles (bundle, ~33 sq ft)', qty: 3, unit_cost: 42 },
    { description: 'Flashing sealant (tube)', qty: 2, unit_cost: 14 },
    { description: 'Plywood decking patch (4x4 sheet)', qty: 1, unit_cost: 38 },
  ],
  labor: [{ description: '2 workers', hours: 6, rate: 45 }],
  recommendations:
    'Full roof inspection recommended within 12 months given the age of the surrounding shingles.',
  total_price: 940,
};

// Fallback for app/estimates/review when no draft exists yet in this
// browser's localStorage — same shape the New Estimate form produces, so
// the Review page never needs to know which source it's rendering.
export const demoDraftEstimate = {
  id: 'draft-job-003',
  ticket_number: 'SQ-1043',
  status: 'draft',
  customer: {
    name: 'Lena Ortiz',
    phone: '(903) 555-0173',
    email: 'lena.ortiz@example.com',
    address: '88 River Rd, Mount Pleasant, TX',
  },
  job: {
    title: 'AC Unit Replacement',
    description:
      'Replace failing 13-year-old condenser unit. Recheck duct sealing in the attic and recharge refrigerant once the new unit is installed.',
    start_date: '2026-06-29',
    end_date: '2026-06-30',
  },
  lineItems: [
    { id: 'li-1', description: '3-ton condenser unit', qty: 1, unit_price: 2150, type: 'material' },
    { id: 'li-2', description: 'Refrigerant (R-410A, per lb)', qty: 4, unit_price: 28, type: 'material' },
    { id: 'li-3', description: 'Duct sealing supplies', qty: 1, unit_price: 65, type: 'material' },
    { id: 'li-4', description: 'HVAC technician', qty: 8, unit_price: 65, type: 'labor' },
  ],
  photos: [
    { id: 'p1', caption: 'Existing condenser unit' },
    { id: 'p2', caption: 'Attic duct connection' },
  ],
  notes: {
    warranty: '1-year labor warranty. 10-year manufacturer parts warranty on the condenser.',
    payment_terms: '50% deposit to schedule the job, remaining balance due on completion.',
    additional: 'Customer requested a morning appointment due to home office hours.',
  },
  taxRate: 8.25,
  created_at: '2026-06-20T16:50:00Z',
};
