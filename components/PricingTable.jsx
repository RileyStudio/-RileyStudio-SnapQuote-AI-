import { PLANS } from '@/lib/plans';

// Founder-first display order — deliberately separate from PLAN_ORDER
// (lib/plans.js), which exists for feature-gating logic, not marketing
// emphasis. Founder is the cheapest plan but the one we want most visible.
const DISPLAY_ORDER = ['founder', 'solo', 'pro', 'team'];

export default function PricingTable({ highlightPlan = 'founder' }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {DISPLAY_ORDER.map((key) => {
        const plan = PLANS[key];
        const isHighlight = key === highlightPlan;
        return (
          <div
            key={key}
            className={`rounded-card p-5 flex flex-col ${
              isHighlight ? 'border-2 border-orange bg-orange/5' : 'border border-line bg-white'
            }`}
          >
            {isHighlight && (
              <p className="text-[10px] font-display font-bold uppercase tracking-wide text-orange mb-2">
                Best value while it lasts
              </p>
            )}
            <p className="font-display font-bold text-xl">{plan.label}</p>
            <p className="font-display font-extrabold text-3xl mt-1">{plan.price}</p>
            {plan.priceNote && (
              <p className="text-xs text-ink/50 mt-0.5">{plan.priceNote}</p>
            )}
            <ul className="mt-4 space-y-1.5 text-sm text-ink/75 flex-1">
              {plan.featureList.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span className={isHighlight ? 'text-orange' : 'text-site'}>✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
