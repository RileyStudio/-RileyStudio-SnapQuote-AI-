'use client';

import { useRef } from 'react';

export default function LogoUploader({ logoDataUrl, brandColor, initials, onChange }) {
  const inputRef = useRef(null);

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    // A single logo is small enough to store directly as a data URL in
    // localStorage — unlike job photos (PhotoUploader.jsx), which use
    // blob object URLs because there can be many large ones per estimate.
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-center gap-4">
      <div
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-dashed border-line
          flex items-center justify-center cursor-pointer shrink-0"
        style={{ backgroundColor: logoDataUrl ? 'transparent' : brandColor }}
      >
        {logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local base64 logo preview
          <img src={logoDataUrl} alt="Business logo" className="w-full h-full object-cover" />
        ) : (
          <span className="font-display font-bold text-white text-lg">{initials}</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="font-display font-semibold text-sm text-site"
        >
          {logoDataUrl ? 'Replace Logo' : 'Upload Logo'}
        </button>
        {logoDataUrl && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="block font-display text-xs text-ink/50 mt-1"
          >
            Remove logo
          </button>
        )}
        <p className="text-xs text-ink/45 mt-1">
          Square image works best. Shown on your quotes and dashboard.
        </p>
      </div>
    </div>
  );
}
