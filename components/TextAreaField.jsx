export default function TextAreaField({ label, value, onChange, placeholder, full, rows = 3 }) {
  return (
    <label className={full ? 'sm:col-span-2 block' : 'block'}>
      <span className="font-display text-xs uppercase tracking-wide text-ink/50 font-semibold">
        {label}
      </span>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full rounded-card border border-line bg-white px-3 py-2 text-sm
          focus-visible:outline focus-visible:outline-3 focus-visible:outline-site"
      />
    </label>
  );
}
