# Phase 2E Privacy Hashing + Enhanced Matching Hardening

## Goal

Create a shared, deterministic privacy hashing contract for future provider dispatch senders without sending events, calling external APIs, or expanding live dispatch scope.

## North Star

WindowMan can prepare provider-safe matching signals while keeping raw homeowner identity out of logs, admin UI, outbox snapshots, attempt snapshots, and provider diagnostics.

## What Was Built

- Shared utility: `src/lib/privacy/identityHashing.ts`
- Unit tests: `src/lib/privacy/__tests__/identityHashing.test.ts`
- Dry-run diagnostics for Meta, Google/GA4, TikTok, and endpoint-style payloads now expose hash-readiness booleans only.
- Admin dry-run drawer shows enhanced matching readiness and presence badges without raw PII or full hashes.

## Normalization Rules

### Email

- Trim leading/trailing whitespace.
- Lowercase.
- Do not remove dots.
- Do not remove plus aliases.
- Do not validate deliverability.
- Blank values return null.
- Malformed non-blank strings normalize but do not throw.

### Phone

- Trim.
- Remove spaces, dashes, parentheses, and dots.
- Preserve leading `+` by rebuilding as `+` plus digits.
- Ten US digits normalize to `+1XXXXXXXXXX`.
- Eleven digits starting with `1` normalize to `+1XXXXXXXXXX`.
- Other values must produce a plausible E.164-like `+` value with 8–15 digits or return null.
- Malformed values return null and do not throw.

### Basic Text

- Trim.
- Lowercase.
- Collapse internal whitespace to a single space.
- Blank values return null.

## SHA-256 Rules

- Hashes are lowercase 64-character SHA-256 hex strings.
- Hashing uses native Web Crypto; no network calls or provider SDKs are used.
- Hash helpers never return raw input values.
- Hash diagnostics expose presence booleans by default.
- Optional hash prefixes are capped at 8 characters and are intended only for internal debugging.

## Double-Hash Guard

`isSha256Hex()` treats 64-character hex strings as already hashed, case-insensitively. `hashNormalizedValue()` returns the lowercase hash and marks `alreadyHashed: true` instead of hashing it again.

## Provider Identity Contracts

### Meta CAPI

Prepared contract fields:

- `em`: email hash array when present.
- `ph`: phone hash array when present.
- `external_id`: external ID hash array when present.
- `fbc` / `fbp`: provider-required cookies remain separate attribution identifiers and must not be shown raw in admin diagnostics.
- IP and user-agent remain deferred unless safely sourced and approved.

### Google Enhanced Conversions

Prepared contract fields:

- `email`: email hash when present.
- `phone_number`: phone hash when present.
- Name/location hashes are supported by the shared builder but should remain deferred until provider policy and data provenance are approved.
- `gclid`, `gbraid`, and `wbraid` are click identifiers, not hashed PII fields.

### TikTok Events API

Prepared contract fields:

- `email`: email hash when present.
- `phone`: phone hash when present.
- `external_id`: external ID hash when present.
- `ttclid` and `ttp` remain separate attribution identifiers and must not be exposed raw in admin UI.

## Admin Display Rules

Allowed:

- `email hash present`
- `phone hash present`
- `external ID hash present`
- `enhanced matching readiness`
- `already hashed detected`
- short internal hash prefixes only when explicitly requested by a trusted internal tool

Forbidden:

- raw email
- raw phone
- full hash in normal admin UI
- raw click IDs
- raw tokens
- Vault secret IDs
- raw endpoint URLs

## Logging Restrictions

Touched utilities and dry-run mapper code do not log raw inputs. Future senders must not log provider `user_data`, raw lead identity, access tokens, raw click IDs, or unredacted provider responses.

## What Is Not Implemented

- No Meta sender.
- No Google sender.
- No TikTok sender.
- No GTM Server or webhook sender.
- No automatic retry worker.
- No provider token validation.
- No live dispatch scope expansion.
- No database mutation or schema migration.
- No persistence of hashed PII to outbox or attempt rows in this sprint.

## Remaining Requirements Before Live Enhanced Matching

- Phase 2A/2B/2C plan and sender artifacts are not present in the repo; live-provider integration remains pending.
- Future live sender must import the shared hashing contract server-side and build provider payloads from hashed values only.
- Provider payload tests must prove no raw email/phone enters request snapshots, logs, outbox rows, or attempts.
- Admin response/reconciliation views must continue showing only booleans, masked IDs, and redacted excerpts.
