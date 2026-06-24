import EstimateForm from '@/components/EstimateForm';

// Always a blank slate — the old behavior of resuming "the one current
// draft" on this page is gone now that every estimate is its own
// persistent record. See components/EstimateForm.jsx and
// app/estimates/[id]/edit/page.jsx for the resume/edit flow.
export default function NewEstimatePage() {
  return <EstimateForm />;
}
