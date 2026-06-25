const STRIPES =
  'repeating-linear-gradient(45deg, #1C1F23 0 14px, #FFC542 14px 28px)';

export default function DemoBanner() {
  return (
    <div className="sticky top-0 z-50">
      <div className="h-2" style={{ backgroundImage: STRIPES }} />
      <div className="bg-ink text-paper text-center py-1.5 px-3 text-xs font-display font-semibold uppercase tracking-wider">
        EXAMPLE QUOTE — NOT A VALID CONTRACT
      </div>
      <div className="h-2" style={{ backgroundImage: STRIPES }} />
    </div>
  );
}
