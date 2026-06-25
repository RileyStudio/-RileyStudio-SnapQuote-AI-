export default function JobTicketCard({
  customerName,
  address,
  jobType,
  quoteDate,
  expirationDate,
  ticketNumber,
  startDate,
  completionDate,
}) {
  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <span className="font-display font-semibold text-xs uppercase tracking-widest text-ink/50">
          Estimate Ticket
        </span>
        {ticketNumber && (
          <span className="font-display text-xs text-ink/40">No. {ticketNumber}</span>
        )}
      </div>

      <div className="border-t border-dashed border-line mx-5" />

      <div className="grid grid-cols-2 gap-y-3 gap-x-4 px-5 py-4 text-sm">
        <Field label="Customer" value={customerName} />
        <Field label="Job Type" value={jobType} />
        <Field label="Address" value={address} full />
        <Field label="Quote Date" value={quoteDate} />
        <Field label="Expires" value={expirationDate} />
        {startDate && <Field label="Start" value={startDate} />}
        {completionDate && <Field label="Target Completion" value={completionDate} />}
      </div>
    </div>
  );
}

function Field({ label, value, full }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="font-display text-xs uppercase tracking-wide text-ink/45 font-semibold">
        {label}
      </p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
