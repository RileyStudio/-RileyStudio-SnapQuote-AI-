'use client';

/**
 * ApprovalStamp — the one piece of personality in an otherwise restrained UI.
 * Echoes the trade's own paperwork (inspection stamps, permit stamps) rather
 * than a generic checkmark animation. Renders inert before approval, then
 * "lands" with a quick stamp motion when the customer approves.
 */
export default function ApprovalStamp({ approved = false, dateLabel }) {
  if (!approved) return null;

  return (
    <div
      className="relative w-40 h-40 mx-auto select-none rotate-[-8deg] animate-[stamp-land_0.5s_ease-out]"
    >
      <div className="absolute inset-0 rounded-full border-[6px] border-approved" />
      <div className="absolute inset-[10px] rounded-full border-2 border-approved" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-approved">
        <span className="font-display font-extrabold text-2xl tracking-widest leading-none">
          APPROVED
        </span>
        {dateLabel && (
          <span className="font-display text-xs tracking-wide mt-1">{dateLabel}</span>
        )}
      </div>
      {/* rough inked-edge texture via layered radial noise, kept subtle */}
      <div
        className="absolute inset-0 rounded-full mix-blend-multiply opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, transparent 60%, rgba(31,138,76,0.4) 61%, transparent 62%)',
        }}
      />
    </div>
  );
}
