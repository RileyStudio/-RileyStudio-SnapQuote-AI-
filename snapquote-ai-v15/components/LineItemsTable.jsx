export default function LineItemsTable({ materials = [], labor = [] }) {
  const materialsTotal = materials.reduce((sum, m) => sum + m.qty * m.unit_cost, 0);
  const laborTotal = labor.reduce((sum, l) => sum + l.hours * l.rate, 0);

  return (
    <div className="space-y-5">
      {materials.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-xs uppercase tracking-widest text-ink/50 mb-2">
            Materials
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {materials.map((m, i) => (
                <tr key={i} className="border-b border-line/70 last:border-0">
                  <td className="py-2 pr-2">
                    {m.description} <span className="text-ink/45">× {m.qty}</span>
                  </td>
                  <td className="py-2 text-right font-semibold whitespace-nowrap">
                    ${(m.qty * m.unit_cost).toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-right text-sm font-semibold mt-1 text-ink/70">
            Subtotal: ${materialsTotal.toFixed(0)}
          </p>
        </div>
      )}

      {labor.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-xs uppercase tracking-widest text-ink/50 mb-2">
            Labor
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {labor.map((l, i) => (
                <tr key={i} className="border-b border-line/70 last:border-0">
                  <td className="py-2 pr-2">
                    {l.description}{' '}
                    <span className="text-ink/45">
                      × {l.hours} hrs @ ${l.rate}/hr
                    </span>
                  </td>
                  <td className="py-2 text-right font-semibold whitespace-nowrap">
                    ${(l.hours * l.rate).toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-right text-sm font-semibold mt-1 text-ink/70">
            Subtotal: ${laborTotal.toFixed(0)}
          </p>
        </div>
      )}
    </div>
  );
}
