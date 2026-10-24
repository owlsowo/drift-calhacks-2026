# How Drift completes one shared postcard

The meaningful technical problem is preserving one shared outcome while two guest writers, expiring claims and an external model interact. A successful model response alone cannot publish a card.

```mermaid
sequenceDiagram
    participant W as Writer’s browser
    participant DB as SpacetimeDB
    participant C as Claude
    participant O as Original writer’s browser
    W->>DB: Catch an eligible approved setup
    DB->>DB: Assign caller + version + absolute deadline atomically
    DB-->>W: Private assignment view
    W->>DB: Submit ending + immutable request ID
    DB->>DB: Verify owner/claim, reserve attempt and estimated USD, count dispatch
    DB->>C: Check combined setup and ending outside transaction
    C-->>DB: Structured decision + fixed reason
    DB->>DB: Settle observed usage before output acceptance; keep unknown billing on hold
    DB->>DB: Recheck ownership/version/deadline/hidden/pause
    alt allowed and still current
        DB->>DB: Atomically create card + ownership + completion
        DB-->>W: Approved public postcard subscription
        DB-->>O: Private ownership/outgoing update + public postcard
    else rejected, uncertain, failed or stale
        DB-->>W: Bounded message; keep local draft
    end
```

## Three boundaries worth explaining to a judge

**Exclusive catch.** The server owns assignment, version and absolute expiry. Two clients cannot simply mark the same bottle as theirs. Self-assignment, exclusions and consumed bottles are checked on the server. A model request does not extend the lease.

**External check.** A short transaction persists immutable pending work and increments usage before the external request. Claude runs outside transaction callbacks. A second transaction checks that the result still belongs to the same live work. A late answer cannot overwrite a reassignment, hidden story or newer request. A request ID cannot be reused with different text.

**One publication.** The canonical postcard, both authors’ ownership and round completion finalize together. The original writer’s browser receives the result through subscriptions. AI guidance follows a separate path and cannot produce a postcard or replace the participant’s draft.

**Metering.** A separate private ledger reserves estimated USD in the same transaction as the request/attempt. Valid provider usage settles before output parsing, so a rejected or late result still records cost. Ambiguous billing retains its reservation. Owner diagnostics show retained server latency, usage and estimates without participant text or identity. A private transactional counter also disambiguates server IDs when UUID entropy repeats under simultaneous starts.

## Private and public data

| Data | Access |
|---|---|
| Approved anonymous postcard text and provenance | Public projection; either author can remove it |
| Unapproved text, assignments, requests, counters, reports, identity mapping | Private tables; caller views expose only permitted progress |
| Reported public card | A visitor may hide it for themselves; cannot delete the authors’ publication |
| Hello opt-in | Author-only caller view; unilateral choice stays private |
| Recognition phrase and meeting spot | Separate procedure verifies mutual consent and current expiry; absent from public card/export |
| Anthropic key | Untracked local configuration installed as a server environment value |

## Evidence and limits

- `spacetimedb/tests/game.test.ts`: 51 harness checks include expiry, rollover, model failures/races, ownership, replay, quotas, reports, hello privacy, budget reservations/reconciliation and forced ID collisions.
- `docs/evidence/live-invariants.json`: actual local network checks for concurrent catches, shared-identity tabs, inaccessible private tables and duplicate publication.
- `docs/evidence/ui-smoke.json`: actual synthetic browser interaction, reload recovery, live return, download and hide/report behavior.
- `docs/evidence/content-states.json`: loading, pause, offline/reconnect and blocked-storage behavior at two viewport sizes.
- `packages/ai-contracts/index.test.ts`: outbound system instructions/data separation and fail-closed parsing. A real fifty-case model evaluation produced valid outputs; moderation matched 35/36 synthetic labels and fourteen hints were reviewed by Codex, not an independent human.
- `docs/evidence/hosted-ai-usage.json`: actual owner health checks against the deployed Claude integration and server ledger. These synthetic probes publish no game content.

These tests establish specified software behavior, not real attendee benefit or production-wide reliability. Hosted Maincloud, Cloudflare HTTPS headers and server-side Turnstile rejection checks passed. Guest identities can still be recreated by clearing storage; one-human-one-account enforcement is not claimed. Physical phones and independent moderation quality remain unverified. Mutual hello is disabled until the owner supplies a verified public meeting point. Price-based cost estimates are not invoices or the provider account balance.
