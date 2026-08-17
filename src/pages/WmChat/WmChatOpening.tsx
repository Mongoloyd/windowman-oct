import type { ReactNode } from "react";

import { WmChatTrustCards } from "./WmChatTrustCards";

type WmChatOpeningProps = {
  readonly hero: ReactNode;
  readonly showTrust: boolean;
};

/**
 * Persistent hero shell for the conversation. The artwork stays mounted while
 * the transcript advances; only the peripheral trust rail leaves after the
 * opening choice.
 */
export function WmChatOpening({ hero, showTrust }: WmChatOpeningProps) {
  return (
    <section data-testid="wmchat-opening" className="pt-3 text-center">
      {hero}
      <p className="mt-1 text-[13px] font-medium tracking-[0.015em] text-[#79c8ff] sm:text-sm">
        WindowMan AI · Software, not a contractor
      </p>
      <h1 className="mt-3 text-balance text-2xl font-extrabold tracking-[-0.025em] text-white">
        WindowMan: Your Quote Hero
      </h1>
      <p className="mx-auto mt-2 max-w-[38ch] text-sm leading-6 text-[#9db0c3]">
        Tell me what brought you here. I’ll keep the next step simple.
      </p>
      {showTrust ? <WmChatTrustCards /> : null}
    </section>
  );
}
