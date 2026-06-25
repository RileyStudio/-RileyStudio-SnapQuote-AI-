const STYLES = {
  draft: 'bg-site/10 text-site',
  sent: 'bg-orange/10 text-orange-dark',
  approved: 'bg-approved/10 text-approved',
};

const LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  approved: 'Approved',
};

export default function StatusBadge({ status }) {
  const key = STYLES[status] ? status : 'draft';
  return (
    <span
      className={`inline-flex items-center font-display font-semibold text-sm uppercase tracking-wide
        rounded-full px-3 py-1 ${STYLES[key]}`}
    >
      {LABELS[key]}
    </span>
  );
}
