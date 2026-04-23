## Typography-only hero cleanup

Smallest-safe-diff pass on two files. No theme, layout, or logic changes.

### File 1: `src/components/AuditHero.tsx`

**H1 (currently lines ~146–148):**

```
className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight text-foreground mb-5"
```

→

```
className="font-display text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-foreground mb-5"
```

**Paragraph (currently lines ~163–165):**

```
className="font-body text-base md:text-lg leading-relaxed text-foreground/80 mb-8"
```

→

```
className="font-body max-w-[65ch] text-lg lg:text-xl leading-relaxed text-foreground/80 mb-8"
```

Nothing else in this file is touched: trust pill, ticker stats strip, mascot, grade card, CTAs, PowerTool, TrustBullets, OCR image, and JSX fallback content all stay byte-identical.

### File 2: `src/config/homepageVariants.ts`

`badgeText` values: untouched (per request).
`weight`, `id`, `ACTIVE_VARIANTS`, `ALL_VARIANTS` keys: untouched.

Headlines normalized from ALL CAPS → title/sentence case. Subheadlines only edited where capitalization is awkward (the `pre_sign` subheadline currently has Title-Cased every word — it gets normalized to sentence case).


| variant         | new headline                                                                         | subheadline change                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accusation`    | `""` (unchanged — JSX fallback)                                                      | unchanged                                                                                                                                                       |
| `direct_action` | `Scan your quote. Beat your contractors.`                                            | unchanged                                                                                                                                                       |
| `loss_aversion` | `The average Florida homeowner overpays $4,800 on impact windows. Don't be average.` | unchanged                                                                                                                                                       |
| `fine_print`    | `Your contractor hopes you don't read the fine print. We read it for you.`           | unchanged                                                                                                                                                       |
| `pre_sign`      | `Before you sign that quote, let AI check the math.`                                 | `Upload your estimate. In seconds, our AI forensically grades it across 5 key areas: safety, scope, pricing, fine print, and warranty. Best of all, it's Free.` |
| `question`      | `Is your contractor overcharging you? Find out in 60 seconds.`                       | unchanged                                                                                                                                                       |
| `free_audit`    | `Free AI audit: see exactly where your quote is overpriced.`                         | unchanged                                                                                                                                                       |


Note: this normalizes `pre_sign` to sentence case (matching the rest of the variants after this pass), superseding the earlier Title Case edit. If you want `pre_sign` to remain in Title Case as an outlier, say so and I'll keep `"Before You Sign That Quote, Let AI Check The Math"` instead.

### Out of scope (explicitly not touched)

- Ticker stats strip
- Trust pill / floating badge
- "THE SCANNER", "STEP 1 OF 4 · CONFIGURE YOUR SCAN", "How it works" — none of these live in `AuditHero.tsx` anyway
- Any other section, OTP, scanner, GTM, backend, or routing logic
- `badgeText` strings

### Verification after apply

- `git diff` touches only the two files listed
- Hero H1 and paragraph render with new sizing/measure on the live preview
- Variant rotation still works; no key renamed