'use client';

const ROTATIONS = ['-3deg', '2deg', '-1.5deg', '3deg', '-2deg'];

export default function PhotoStrip({ photos = [] }) {
  if (!photos.length) return null;

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 px-1 snap-x snap-mandatory">
      {photos.map((photo, i) => (
        <figure
          key={photo.id || i}
          className="snap-center shrink-0 w-36 bg-white border border-line rounded-sm shadow-card p-2 pb-3"
          style={{ transform: `rotate(${ROTATIONS[i % ROTATIONS.length]})` }}
        >
          <div className="w-full h-28 rounded-sm bg-line/50 overflow-hidden flex items-center justify-center">
            {photo.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local/blob preview, not an optimizable remote asset
              <img
                src={photo.previewUrl}
                alt={photo.caption || 'Job site photo'}
                className="w-full h-full object-cover"
              />
            ) : (
              <CameraIcon />
            )}
          </div>
          <figcaption className="mt-2 text-center text-xs text-ink/70 font-medium leading-tight">
            {photo.caption}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-ink/35"
    >
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
