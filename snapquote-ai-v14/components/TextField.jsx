export default function TextField({ label, value, onChange, type = 'text', placeholder, full }) {
  return (
    <label className={full ? 'sm:col-span-2 block' : 'block'}>
      <span className="font-display text-xs uppercase tracking-wide text-ink/50 font-semibold">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="tap-target mt-1 w-full rounded-card border border-line bg-white px-3 text-sm
          focus-visible:outline focus-visible:outline-3 focus-visible:outline-site"
      />
    </label>
  );
}
