
Yes, I understand. You want to expand the "What We Actually Inspect" grid from 6 items in 2 columns to **12 items in 4 columns × 3 rows**, with each item phrased in 4 words or less.

## Proposed 12 Inspection Items

Here's a curated list pulled from the WindowMan forensic engine (5 pillars: Safety/Code, Scope Clarity, Price Fairness, Transparency, Warranty). Each is ≤4 words:

**Column 1 — Scope & Materials**
1. Scope Detail
2. Material Assumptions
3. Glass Specifications

**Column 2 — Pricing & Value**
4. Price Position
5. Per-Opening Cost
6. County Baseline Match

**Column 3 — Risk & Fine Print**
7. Warranty Posture
8. Exclusion Language
9. Change-Order Exposure

**Column 4 — Compliance & Install**
10. Permit Handling
11. DP Rating Disclosure
12. Install Scope Clarity

## Implementation

**File:** `src/components/about/TrustProofSection.tsx`

1. Update `proofItems` array from 6 → 12 entries (above list).
2. Change grid from `grid-cols-1 sm:grid-cols-2` → `grid-cols-2 md:grid-cols-4` so it renders as 4 columns on desktop (3 rows stacked) and gracefully falls back to 2 columns on mobile.

That's the entire change — single file, two edits.
