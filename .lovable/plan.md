# Plan — Refactor ref handling in `PreUploadIntake.tsx`

**Scope lock:** Single-file change. No routing, no exports modified.

## Current state

Build is green. The file uses a custom `btnRef` prop on `PathCard` and `PillChoice` purely so the parent radio-group can call `.focus()` during arrow-key navigation. This works but couples presentational children to focus-management plumbing.

## Goal

Eliminate ref props on `PathCard` and `PillChoice` entirely. Move focus management into the radio-group containers using a single container ref + `querySelectorAll('[role="radio"]')`.

## Why not `forwardRef` (the user's first instinct)

- React 19 deprecates the `forwardRef` pattern in favor of ref-as-prop. Writing new `forwardRef` wrappers in late 2026 is going backwards.
- The children have no semantic need to expose a ref; only the keyboard handler needs it.
- Removes ~20 lines of ref plumbing instead of adding ~8.

## Changes (all inside `src/components/forensic-report/PreUploadIntake.tsx`)

### 1. `PathRadioGroup` and `PillRadioGroup`
- Replace `refs.current[]` array + per-child `btnRef` callback with one `groupRef = useRef<HTMLDivElement>(null)` on the wrapping `<div role="radiogroup">`.
- Helper inside each group:
  ```ts
  const focusAt = (i: number) =>
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[i]
      ?.focus();
  ```
- Arrow/Home/End handlers call `focusAt(next)` after `onSelect`.

### 2. `PathCard` component
- Remove the `btnRef` prop from both the destructure and the type.
- Remove `ref={btnRef}` from the `<button>`.
- Component becomes pure presentational. No other behavior changes.

### 3. `PillChoice` component
- Same treatment as `PathCard`.

### 4. Call sites
- Remove `btnRef={(el) => (refs.current[i] = el)}` from the two `.map()` loops.

## Invariants preserved

- Roving tabindex (`tabIndex={isFocusable ? 0 : -1}`) — unchanged.
- ARIA: `role="radiogroup"`, `role="radio"`, `aria-checked`, `aria-label` — unchanged.
- Arrow-key cycling, Home/End jumps — unchanged behavior.
- Focus-visible ring, skeuomorphic press (`translate-y`, `shadow-inner`), all motion — unchanged.
- `aria-live` announcements — unchanged.
- Session draft persistence, case ID, receipt panel, validation — untouched.

## Out of scope

- No changes to validation, step indicator, receipt, header, or CTA logic.
- No new dependencies.
- No exports change (`PreUploadIntake` named + default).

## Estimated diff

≈ −22 / +10 lines. Net file shrinks. No type changes outside this file.
