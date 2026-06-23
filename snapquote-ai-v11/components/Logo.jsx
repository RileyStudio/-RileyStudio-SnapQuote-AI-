export default function Logo({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <span
      className={`font-display font-bold tracking-tight inline-flex items-baseline gap-1 ${sizes[size]} ${className}`}
    >
      <span>Snap</span>
      <span className="text-orange">Quote</span>
      <span className="text-[0.5em] align-super font-body font-semibold bg-ink text-paper rounded px-1 ml-0.5">
        AI
      </span>
    </span>
  );
}
