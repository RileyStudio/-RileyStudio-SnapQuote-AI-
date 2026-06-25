'use client';

import SectionLabel from './SectionLabel';

const TYPES = ['material', 'labor'];

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function LineItemEditor({ items, onItemsChange }) {
  function updateItem(id, patch) {
    onItemsChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id) {
    onItemsChange(items.filter((item) => item.id !== id));
  }

  function addItem() {
    onItemsChange([
      ...items,
      { id: newId(), description: '', qty: 1, unit_price: 0, type: 'material' },
    ]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Line Items</SectionLabel>
        <button
          type="button"
          onClick={addItem}
          className="font-display font-semibold text-sm text-site tap-target px-2"
        >
          + Add Line Item
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-ink/50 mb-2">
          No line items yet. Add materials or labor to build the estimate.
        </p>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-paper border border-line rounded-card p-3">
            <input
              type="text"
              value={item.description}
              onChange={(e) => updateItem(item.id, { description: e.target.value })}
              placeholder="Description (e.g. Architectural shingles, bundle)"
              className="w-full bg-white border border-line rounded-card px-3 py-2 text-sm mb-2
                focus-visible:outline focus-visible:outline-3 focus-visible:outline-site"
            />

            <div className="flex flex-wrap gap-2 items-center">
              <label className="flex items-center gap-1 text-xs text-ink/50">
                Qty
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={item.qty}
                  onChange={(e) => updateItem(item.id, { qty: parseFloat(e.target.value) || 0 })}
                  className="w-16 bg-white border border-line rounded-card px-2 py-1.5 text-sm"
                />
              </label>

              <label className="flex items-center gap-1 text-xs text-ink/50">
                $
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) =>
                    updateItem(item.id, { unit_price: parseFloat(e.target.value) || 0 })
                  }
                  className="w-20 bg-white border border-line rounded-card px-2 py-1.5 text-sm"
                />
              </label>

              <div className="flex rounded-full border border-line overflow-hidden ml-auto">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => updateItem(item.id, { type: t })}
                    className={`px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wide
                      ${
                        item.type === t
                          ? t === 'labor'
                            ? 'bg-site text-white'
                            : 'bg-orange text-white'
                          : 'text-ink/50'
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label="Remove line item"
                className="text-ink/40 hover:text-orange-dark px-2 py-1.5 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-right text-sm font-semibold mt-2">
              ${(item.qty * item.unit_price).toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
