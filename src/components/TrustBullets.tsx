import { Check } from "lucide-react";

const trustBullets = [
  "No Account or Credit Card Required",
  "256-bit Encrypted & Strictly Confidential",
  "Results Generated in Under 60 Seconds",
  "Your Contractor is Never Notified",
];

export const TrustBullets = () => (
  <div className="mt-6 wm-fade-in-soft">
    <div className="flex flex-col lg:grid lg:grid-cols-2 gap-y-3 gap-x-6 w-fit">
      {trustBullets.map((item) => (
        <div key={item} className="flex items-center gap-2">
          <Check size={16} className="shrink-0 text-primary" strokeWidth={2.5} />
          <span className="whitespace-nowrap font-medium text-xs sm:text-[13px] lg:text-sm text-muted-foreground">
            {item}
          </span>
        </div>
      ))}
    </div>
  </div>
);
