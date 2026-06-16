import { MapPin, ShieldOff, Store, Tag, Smartphone } from "lucide-react";

/**
 * NextdoorTrustStrip — compact, compliance-safe trust row. Presentational only.
 */

const TRUST_ITEMS = [
  { icon: MapPin, label: "South Florida-ready" },
  { icon: ShieldOff, label: "No contractor pressure" },
  { icon: Store, label: "Not a marketplace" },
  { icon: Tag, label: "No savings guaranteed" },
  { icon: Smartphone, label: "Free preview first" },
] as const;

export function NextdoorTrustStrip() {
  return (
    <section aria-label="What to expect from WindowMan">
      <ul className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
        {TRUST_ITEMS.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_12px_-8px_rgba(15,40,90,0.25)]"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-[#0891b2]" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
