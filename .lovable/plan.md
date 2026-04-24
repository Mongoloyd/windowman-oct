

## Hotfix: Resolve TS2345 type-drift in 5 Supabase mutation call sites

### Root cause (analysis)

Supabase's generated `Database` types use `RejectExcessProperties<ExactShape, Provided>`. This intersects `Provided` with `{ [x: string]: never }` to forbid unknown columns. Any payload typed with an **index signature** (`Record<string, any>`, `JsonObject = Record<string, unknown>`) collapses to `never` per-key under that intersection → "string index signatures are incompatible".

Casting to `JsonObject` made the problem *worse* than passing the raw typed object, because `ContractorLeadUpdate` and `ContractorFollowupUpdate` are already the correct exact-shape types.

### Why prior fix failed

Lines 267, 484, 509 cast a perfectly valid `ContractorLeadUpdate` / `ContractorFollowupUpdate` to `JsonObject` — discarding the exact shape and triggering the index-signature rejection. The cast is pure noise; removing it fixes those three errors.

Lines 205, 209 in `AdminPartners.tsx` build `metaPayload` as `Record<string, any>`, which hits the same index-signature wall.

### The fix (5 surgical edits, types only)

**`src/lib/contractors2/service.ts`**

| Line | Before | After |
|------|--------|-------|
| 267  | `.update(updates as JsonObject)` | `.update(updates)` |
| 484  | `.update(updates as JsonObject)` | `.update(updates)` |
| 509  | `.update({ status: "canceled" } as JsonObject)` | `.update({ status: "canceled" satisfies ContractorFollowupStatus } as ContractorFollowupUpdate)` |

`updates` already has type `ContractorLeadUpdate` / `ContractorFollowupUpdate` — these *are* the Supabase-generated exact-shape Update types re-exported via `@/types/contractorLead`. Removing the bad cast restores the exact shape and the compiler accepts it.

**`src/pages/AdminPartners.tsx`**

Replace the `Record<string, any>` declaration with the generated Supabase `Update` type (which is structurally compatible with the `Insert` call site on line 209 because all fields used are also valid Insert columns):

```ts
type MetaConfigUpdate = Database['public']['Tables']['meta_configurations']['Update'];
const metaPayload: MetaConfigUpdate = {
  client_id: clientId,
  pixel_id: sanitize(pixelId),
  test_event_code: testEventCode.trim() ? sanitize(testEventCode) : null,
};
```

Then on line 209, the insert path needs the `Insert` shape — cast at the call site:
```ts
.insert(metaPayload as Database['public']['Tables']['meta_configurations']['Insert'])
```

This is safe because every field assigned (`client_id`, `pixel_id`, `test_event_code`, optional `access_token`) exists on the Insert type.

### Simulation — does this eliminate the error?

**Yes.** Reasoning:

1. **Lines 267/484** — `ContractorLeadUpdate` / `ContractorFollowupUpdate` are imported from `@/types/contractorLead`, which mirrors the Supabase generated `Update` shape. They have no index signature. `RejectExcessProperties<Exact, ContractorLeadUpdate>` reduces to `ContractorLeadUpdate` (no excess keys to reject). ✅
2. **Line 509** — `{ status: "canceled" }` cast to `ContractorFollowupUpdate` is a single known column on the exact Update shape — no index signature, no rejection. ✅
3. **Lines 205/209** — Replacing `Record<string, any>` with the generated `Update`/`Insert` types removes the `[x: string]: any` index signature that triggers `Type 'any' is not assignable to type 'never'`. ✅

**Logic preserved:** zero runtime changes. Only static type annotations / removed casts.

**Risk of regression:** none — if any previously-tolerated extra field existed on `metaPayload`, the compiler will now correctly flag it (which is the desired outcome under WindowMan's "fail-closed" rule).

### Files changed

- `src/lib/contractors2/service.ts` (3 line edits, no imports added)
- `src/pages/AdminPartners.tsx` (1 type alias + 2 line edits, add `Database` import from `@/integrations/supabase/types` if not already present)

No service / RLS / edge-function / migration changes. No new files. No deletions.

