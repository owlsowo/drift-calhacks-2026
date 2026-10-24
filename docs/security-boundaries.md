# Reviewed boundaries

The review uses the ECC security-review skill and actual module/browser checks. This document records choices and evidence, not a blanket production-security certification.

## Identity and access

SpacetimeDB issues an anonymous guest identity. A reconnect token is stored locally because the direct browser SDK needs it to reconnect without a separate auth proxy. This is a bounded guest-session tradeoff; it is not an HttpOnly-cookie architecture. React renders escaped plain text, no participant HTML is accepted, fonts are bundled, and production static headers provide a restrictive CSP. Clearing storage can lose progress and create a different identity. One-human-one-account enforcement is not claimed.

All raw gameplay/ownership/report/request/hello tables are private. Caller-scoped views enforce ownership in the server. Approved public postcard projections contain no identity mapping or recognition phrases. Guessing a round ID does not grant write access. Other viewers can privately report and hide a share card for themselves; this cannot remove publication for everyone. Only actual authors may hide a card globally, and only the database owner may pause or purge.

## Model calls

The Anthropic key is an untracked, server-only environment value. The frontend never calls Anthropic. The schema/instruction/output checks are shared with the evaluation runner. Model output does not authorize any state change: the transaction rechecks identity, immutable request binding, claim version, absolute deadline, hidden state, publication state and pause flag.

A paid attempt is persisted and counted before dispatch. Duplicate IDs replay saved results; changed text cannot reuse a request ID. Provider refusals, truncation, invalid schemas, contradictory moderation, network failures, late results and exhausted quotas fail closed and keep the writing flow recoverable. No request is blindly retried after an ambiguous transport outcome.

The model contract does not prove moderation accuracy. Synthetic HTTP tests establish application behavior for specified responses. Live evaluation and human review remain necessary before claiming real model quality.

## Hello

Disabled unless the owner enables it and supplies a verified public meeting point. Both authors must opt in within ten minutes after card creation. The caller-specific subscription contains no phrase or meeting location; a separate author-authorized procedure checks expiry at access before returning them. Withdrawal, hiding and expiry revoke future access. A person can retain information already seen, as with any displayed text; this cannot be retracted technically.

## Distribution and deployment

The current build is a controlled local sandbox. A global paid dispatch cap and owner kill switch are implemented. It has no IP-based bot defense or Turnstile integration yet. Keep distribution controlled until account setup, hosted checks, rate controls and live moderation are complete. Static `_headers` apply only on compatible hosting; verify actual response headers after deployment. A provider budget alert is not an application spending cap.

## Evidence

- Official Spacetime module test harness: authorization, lease expiry, rollover, replay, caps, external-call race/failure cases and hello privacy.
- Two isolated browser contexts: real database loop, reload recovery, live return, export and hide.
- WCAG automated scans at 360x800 and 1440x1000: home, help and writing states.
- Production dependency audit: zero reported advisories at the recorded check. Audits cover known advisories only.

No public production deployment, external penetration test or actual attendee validation is claimed.
