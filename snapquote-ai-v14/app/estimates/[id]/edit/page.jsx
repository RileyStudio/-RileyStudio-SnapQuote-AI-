import EstimateForm from '@/components/EstimateForm';

export default function EditEstimatePage({ params }) {
  return <EstimateForm estimateId={params.id} />;
}
