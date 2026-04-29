You are working inside the WindowMan repo.

Task: Improve the OrangeScanner decision-gate CTA responsiveness and accessibility.

This is a tightly scoped frontend polish task. It is NOT a lead-modal rebuild. It is NOT a funnel architecture change.

==================================================

PROTECTED COMPONENT GUARDRAILS

==================================================

Do not rename, move, split, or extract OrangeScanner, VerdictHologram, or any existing subcomponent.

Do not change the exported OrangeScanner public props.

Internal subcomponent props inside this same file may be extended only if needed to pass local UI state such as processingAction.

Do not change the behavior, destination, logging, tracking, or side effects of safeInvokeScanClick or safeInvokeDemoClick.

Do not create a new lead modal, scanner flow, upload flow, auth flow, OTP flow, route, backend call, Supabase call, or tracking architecture.

This task is limited to local UI responsiveness, loading state, duplicate-click protection, toast-based error handling, focus-visible accessibility, aria labels, and screen-reader loading status inside OrangeScanner.tsx.

==================================================

SCOPE

==================================================

Only modify this file:

- src/components/OrangeScanner.tsx

Do not modify:

- parent components

- hooks

- data-fetching logic

- Supabase clients

- Edge functions

- scanner/backend logic

- routes

- global CSS

- Vite config

- package files

==================================================

CURRENT CONTEXT TO PRESERVE

==================================================

OrangeScanner.tsx already contains the decision gate inside VerdictHologram.

The decision gate already uses semantic button elements for:

- I Have a Quote

- I Want a Quote

The existing callbacks must be preserved exactly:

- safeInvokeScanClick()

  - logs

  - calls optional parent onScanClick

- safeInvokeDemoClick()

  - logs

  - navigates to:

    /about?startArb=1&step=scope&src=orange-scanner

Do not change what either CTA ultimately does.

Your job is only to make these actions feel responsive, prevent double-clicks, show loading feedback, improve error handling, and improve keyboard/screen-reader accessibility.

==================================================

IMPLEMENTATION REQUIREMENTS

==================================================

1. Add local action state inside OrangeScanner

Add:

type DecisionAction = "have_quote" | "want_quote" | null;

const [processingAction, setProcessingAction] = useState<DecisionAction>(null);

This state tracks which decision-gate CTA is currently processing.

2. Add the existing toast pattern

Import:

import { useToast } from "@/hooks/use-toast";

Inside OrangeScanner:

const { toast } = useToast();

Use the existing destructive toast pattern for caught errors:

toast({

  title: "Action failed",

  description: "Please try again.",

  variant: "destructive",

});

Do not introduce a new error UI pattern.

3. Create one async-safe local wrapper

Add a handler similar to:

const handleDecisionAction = async (

  action: "have_quote" | "want_quote",

  callback: () => void | Promise<void>,

) => {

  if (processingAction) return;

  setProcessingAction(action);

  try {

    await Promise.resolve(callback());

  } catch (error) {

    console.error("OrangeScanner decision action failed", { action, error });

    toast({

      title: "Action failed",

      description: "Please try again.",

      variant: "destructive",

    });

  } finally {

    setProcessingAction(null);

  }

};

Important:

- Do not move callback logic into the wrapper.

- Do not alter safeInvokeScanClick().

- Do not alter safeInvokeDemoClick().

- Only wrap them.

4. Pass processingAction into VerdictHologram

Extend VerdictHologram props with:

processingAction: "have_quote" | "want_quote" | null;

Inside VerdictHologram derive:

const isHaveQuoteLoading = processingAction === "have_quote";

const isWantQuoteLoading = processingAction === "want_quote";

const isAnyActionLoading = processingAction !== null;

5. Add loading UI to the two decision-gate buttons

Import Loader2 from lucide-react.

When "I Have a Quote" is processing:

- disable both decision-gate buttons

- show Loader2 with aria-hidden="true"

- replace visible text with:

  Opening scanner...

When "I Want a Quote" is processing:

- disable both decision-gate buttons

- show Loader2 with aria-hidden="true"

- replace visible text with:

  Opening quote request...

Button dimensions must remain stable.

Preserve existing layout classes such as:

- h-11 md:h-14

- w-full

- md:flex-1

- flex alignment

Do not introduce layout shift.

6. Disable both buttons during processing

Use:

disabled={isAnyActionLoading}

on both decision-gate buttons.

Do not allow the sibling CTA to remain clickable while one action is processing.

7. Improve focus-visible states

Add Tailwind focus-visible classes to both decision-gate buttons:

focus-visible:outline-none

focus-visible:ring-2

focus-visible:ring-cyan-300

focus-visible:ring-offset-2

focus-visible:ring-offset-slate-950

If OrangeScanner.tsx contains other existing button elements in the same visible scanner action surface, add only the same focus-visible classes to those buttons.

Do not change their text, layout, callbacks, state, or behavior.

Do not touch global CSS.

8. Improve aria labels

Use these exact aria labels:

For I Have a Quote:

aria-label="Open the real quote scanner because I already have a window quote"

For I Want a Quote:

aria-label="Start a quote request because I need a window quote"

9. Add screen-reader loading status

When processingAction is not null, render a small status element inside VerdictHologram:

role="status"

aria-live="polite"

The status text should match the active loading state:

- Opening scanner...

- Opening quote request...

This can be visually subtle, but it must be available to assistive technology.

10. Preserve native button behavior

Do not replace buttons with divs.

Do not add custom keyboard handlers unless absolutely necessary.

Enter and Space activation should continue to work natively through button semantics.

==================================================

STOP CONDITIONS

==================================================

Stop and report instead of implementing if:

- the task requires changing parent component state

- the task requires rewriting hooks

- the task requires route changes

- the task requires Supabase/backend changes

- Loader2 is unavailable from lucide-react

- useToast is unavailable from @/hooks/use-toast

==================================================

VERIFICATION CHECKLIST

==================================================

After implementation, confirm:

- only src/components/OrangeScanner.tsx changed

- no routes changed

- no hooks changed

- no backend/Supabase files changed

- no parent components changed

- no package files changed

- no global CSS changed

- no OrangeScanner exported public props changed

- no new lead modal was created

- no scanner, upload, auth, OTP, Supabase, or route behavior was changed

- Loader2 import is used

- useToast import is used

- both decision-gate buttons remain semantic buttons

- both buttons have descriptive aria labels

- both buttons show visible focus rings via keyboard Tab

- clicking either CTA disables both buttons during processing

- active CTA shows spinner plus stable loading text

- caught errors show the destructive toast

- callback behavior remains unchanged

- safeInvokeScanClick still calls the existing scan path

- safeInvokeDemoClick still navigates to /about?startArb=1&step=scope&src=orange-scanner