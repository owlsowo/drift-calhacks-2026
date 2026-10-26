# How Drift grows a pool of shared endings

The meaningful technical problem is keeping each ending tied to its beginning while multiple guest writers, independent expiring response assignments and an external model interact. A successful model response alone cannot publish a card.

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

## State and publication

**Independent response assignments.** The server owns each response round’s beginning ID, version and absolute expiry. Several writers can answer one beginning at the same time. Self-replies and a second reply from the same identity are excluded. A model request does not extend the lease; a result must still match that caller’s response assignment.

**External check.** A short transaction persists immutable pending work and increments usage before the external request. Claude runs outside transaction callbacks. A second transaction checks that the result still belongs to the same live work. A late answer cannot overwrite a reassignment, hidden story or newer request. A request ID cannot be reused with different text.

**One publication per response.** Each canonical postcard includes its beginningId; both authors’ ownership and that response round’s completion finalize together. The beginning remains in the daily pool, and the original writer receives every ending through subscriptions. AI guidance follows a separate path and cannot produce a postcard or replace the participant’s draft.

**Metering.** A separate private ledger reserves estimated USD in the same transaction as the request/attempt. Valid provider usage settles before output parsing, so a rejected or late result still records cost. Ambiguous billing retains its reservation. Owner diagnostics show retained server latency, usage and estimates without participant text or identity. A private transactional counter also disambiguates server IDs when UUID entropy repeats under simultaneous starts.

## Private and public data

| Data | Access |
|---|---|
| Approved anonymous beginning and postcard text/provenance | Public projection; either author can remove it |
| Unapproved text, assignments, requests, counters, reports, identity mapping | Private tables; caller views expose only permitted progress |
| Reported public card | A visitor may hide it for themselves; cannot delete the authors’ publication |
| Hello opt-in | Author-only caller view; unilateral choice stays private |
| Recognition phrase and meeting spot | Separate procedure verifies mutual consent and current expiry; absent from public card/export |
| Anthropic key | Untracked local configuration installed as a server environment value |

