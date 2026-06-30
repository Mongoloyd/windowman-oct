import { cn } from "@/lib/utils";
import {
  landingContainerNarrow,
  landingFocusRing,
  landingSectionPad,
} from "./landingTypes";

const trustChips = ["Not a contractor", "Consumer quote advocate"];

export default function FounderIntro() {
  return (
    <section
      id="founder-intro"
      className={cn("border-t border-border bg-card", landingSectionPad)}
    >
      <div className={landingContainerNarrow}>
        <h2 className="mb-4 font-display text-2xl font-bold text-foreground md:text-3xl">
          Sam Glass built WindowMan for homeowners.
        </h2>
        <p className="mb-8 text-base leading-relaxed text-muted-foreground">
          Most window companies want you focused on their proposal. WindowMan helps you understand any
          proposal. If the quote is strong, the report should say that. If something is vague, missing,
          or worth questioning, the report should show you where to look.
        </p>

        <div className="card-raised max-w-md p-5">
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary"
              aria-hidden="true"
            >
              SG
            </div>
            <div>
              <p className="font-display text-sm font-bold text-foreground">Sam Glass</p>
              <p className="text-xs text-muted-foreground">Founder, WindowMan</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {trustChips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
