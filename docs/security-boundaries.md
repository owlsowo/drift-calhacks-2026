# Security and privacy

## Identity and access

SpacetimeDB issues an anonymous guest identity. A reconnect token is stored locally because the direct browser SDK needs it to reconnect without a separate auth proxy. This is a bounded guest-session tradeoff; it is not an HttpOnly-cookie architecture. React renders escaped plain text, no participant HTML is accepted, fonts are bundled, and production static headers provide a restrictive CSP. Clearing storage can lose progress and create a different identity. One-human-one-account enforcement is not claimed.

All raw gameplay/ownership/report/request/hello tables are private. Caller-scoped views enforce ownership in the server. Approved public beginning and postcard projections contain no identity mapping or recognition phrases. Guessing a round ID does not grant write access. Other viewers can privately report and hide a share card for themselves; this cannot remove publication for everyone. Only actual authors may hide a card globally, and only the database owner may pause or purge.

## Model calls

The Anthropic key is an untracked, server-only environment value. The frontend never calls Anthropic. The schema/instruction/output checks are shared with the evaluation runner. Model output does not authorize any state change: the transaction rechecks identity, immutable request binding, claim version, absolute deadline, hidden state, publication state and pause flag.

A paid attempt and estimated USD reservation are persisted before dispatch. Duplicate IDs replay saved results; changed text cannot reuse a request ID. Valid provider usage settles before parsing the output, including rejected or late results. Unknown billing keeps its hold until owner reconciliation. Financial rows have no participant identity or text. Provider refusals, truncation, invalid schemas, contradictory moderation, network failures, late results and exhausted quotas fail closed and keep the writing flow recoverable. No request is blindly retried after an ambiguous transport outcome.

The model contract does not prove moderation accuracy. Synthetic HTTP tests establish application behavior for specified responses. Moderation quality requires separate human evaluation.

## Hello

Disabled unless the owner enables it and supplies a verified public meeting point. Both authors must opt in within ten minutes after card creation. The caller-specific subscription contains no phrase or meeting location; a separate author-authorized procedure checks expiry at access before returning them. Withdrawal, hiding and expiry revoke future access. A person can retain information already seen, as with any displayed text; this cannot be retracted technically.

## Distribution and deployment

The production build runs on hosted Maincloud and Cloudflare HTTPS. Actual static response headers were checked. Turnstile is verified on the server against expected hostname/action and bound to the guest identity for one hour. Per-round limits, a global dispatch cap, estimated-USD reservations and an owner kill switch are implemented. Clearing storage can still create new guest identities. The owner-only fixed synthetic health check bypasses the guest gate for diagnostics, uses the shared budget/cap, is throttled to one per minute and cannot publish. Budget prices are reviewed estimates; uncertain billing keeps its hold. Account spending outside this ledger and independent security testing remain outside these checks.

## Beginning pools and browser ID shelf

Release and Pick up use separate private response rounds. Several identities may answer one approved beginning; each identity may answer it once. A per-round version, assignment and deadline bind each moderation result. The public beginning ID and postcard.beginningId connect the approved texts without publishing identity mappings.

First-party cookies retain only the browser's beginning IDs and completed-pair IDs, scoped to the backend/database and split under individual cookie limits. These IDs grant public reading only. Hide/report ownership decisions still use the private session identity; copying ID cookies to another browser does not grant author-only actions.
