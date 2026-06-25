'use client';

import { useRef, useState } from 'react';
import { demoQuote } from '@/lib/mockData';

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function PhotoUploader({ photos, onPhotosChange }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    // Local-only previews — no upload happens here. The raw `file` is
    // kept on the object too (not just the blob preview URL) so
    // EstimateForm can upload it to Supabase Storage at save time when a
    // real session exists; in demo mode it's simply dropped before
    // persisting, exactly as before. Note: object URLs are only valid for
    // this browser tab/session — a hard refresh loses the preview even
    // though the entry remains in localStorage.
    const newPhotos = files.map((file) => ({
      id: newId(),
      caption: file.name,
      previewUrl: URL.createObjectURL(file),
      file,
    }));

    onPhotosChange([...photos, ...newPhotos]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function removePhoto(id) {
    onPhotosChange(photos.filter((p) => p.id !== id));
  }

  const hasPhotos = photos.length > 0;

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        className={`tap-target rounded-card border-2 border-dashed flex flex-col items-center justify-center
          text-center py-8 px-4 cursor-pointer transition-colors
          ${dragging ? 'border-orange bg-orange/5' : 'border-line bg-white'}`}
      >
        <CameraIcon />
        <p className="mt-2 font-display font-semibold text-sm">Drag photos here, or tap to upload</p>
        <p className="text-xs text-ink/50 mt-1">JPG or PNG, straight from the job site</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {hasPhotos ? (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative shrink-0 w-24 h-24 rounded-card overflow-hidden border border-line"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img src={photo.previewUrl} alt={photo.caption} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                aria-label="Remove photo"
                className="absolute top-1 right-1 bg-ink/70 text-white rounded-full w-5 h-5 text-xs
                  flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-xs text-ink/45 mb-2">No photos uploaded yet — sample photos shown below.</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {demoQuote.photos.map((p) => (
              <div
                key={p.id}
                className="shrink-0 w-24 h-24 rounded-card bg-line/40 grayscale opacity-70
                  flex items-center justify-center"
                title={p.caption}
              >
                <CameraIcon small />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CameraIcon({ small }) {
  const size = small ? 20 : 28;
  return (
    <svg
      width={size}
      height={size}
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
