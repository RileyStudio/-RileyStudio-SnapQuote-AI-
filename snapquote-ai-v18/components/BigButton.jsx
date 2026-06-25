'use client';

const variants = {
  primary: 'bg-orange text-white hover:bg-orange-dark active:bg-orange-dark',
  secondary: 'bg-site text-white hover:bg-site-dark active:bg-site-dark',
  ghost: 'bg-transparent text-ink border border-line hover:bg-line/40',
  approve: 'bg-approved text-white hover:brightness-95',
};

export default function BigButton({
  children,
  variant = 'primary',
  type = 'button',
  onClick,
  disabled = false,
  fullWidth = true,
  className = '',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`tap-target ${fullWidth ? 'w-full' : ''} rounded-card font-display font-semibold text-lg tracking-wide
        px-6 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
