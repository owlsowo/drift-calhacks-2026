# Private activity diagnostics

`npm run ops:activity` reads private owner diagnostics through the existing authenticated Spacetime CLI. It makes no model calls. It reports coarse UTC-day totals, not an attendee count, unique-visitor estimate, social-outcome measure or conversion rate.

## What is counted

Server-confirmed transitions count committed round creation, successful assignment leases, accepted beginnings and completed postcards. Completion is split into peer, reviewed-team-starter and development-sample sources. Resuming a round, replaying a paid request or an empty catch that rolls back does not add another start/completion. A skipped or expired catch that receives a new assignment adds another lease, so assignment counts are not unique people.

Claim-to-publication time has only three buckets: at most 30 seconds, over 30 through 120 seconds, and over 120 seconds. This server interval includes moderation and interruptions inside the claim lease; it is not pure writing time, phone latency or a comparison of people. Existing provider timing/cost diagnostics remain separate.

Client-reported author actions count first unfolded postcard opens with at least ten percent of the paper in the viewport while the page is visible, PNG download requests, copied words, resolved native-share calls and copied share links. Each action counts at most once per author/card, including across reloads or tabs. A setup author's first open is an observed return open; publication or a notification alone does not prove they read it, and viewport presence still does not prove attention. Browsers without IntersectionObserver skip the open report. Unrelated public viewers are not tracked by these action counters.

The client reports only after the corresponding application action succeeds. Share cancellation does not count. A denied native share that successfully falls back to copying counts as a copied link, not a native-share success. A PNG request does not prove a file was saved, and an API-resolved share does not prove recipient delivery. These are best-effort client reports; a modified client can spoof its own reports, and an offline report can be lost. They never block reading, exporting or sharing.

## Privacy and boundaries

`activity_day` is a private table containing only day, server-mode label and numeric totals. It stores no story text, identity, contact details, URL, IP address, device identifier or individual event timestamps. Existing private card ownership stores a small per-author action bitmask for deduplication; this expires with the card/author record, rather than creating a separate visitor history.

The action reducer accepts only fixed tags for an existing visible card owned by the caller. Unknown tags, oversized IDs, outsiders and hidden/missing cards are rejected. The totals are owner-only; guests cannot subscribe to the table or call the diagnostic procedure. No third-party analytics service is added.

Rows are kept for thirty UTC calendar days, including the current day; the hourly maintenance task removes older rows and the owner read filters expired days immediately. Sandbox and live **configuration** rows stay separate. A live label does not establish human/attendee activity: manual tests can also run on a live configuration. Source types stay explicit. Existing pre-release activity is not backfilled.

Counts from different days and actions are not a common cohort: a round or postcard can span days, and first opens can occur long after publication. Never divide these totals into a claimed completion/return/retention rate without a separately defined study. The app has no established attendee pilot or measured social benefit.

## Validation

Five additional module-harness cases cover committed transitions/replay, per-author deduplication and permissions, source separation, mode separation/retention and empty-catch rollback. The actual local WebKit flow reads the private owner totals after two authors open the postcard, exports repeat, cancellation/denial occur, a native-share adapter resolves and a public visitor opens the link. These synthetic checks verify instrumentation, not adoption. The actual ten-writer network test rejects guest access to `activity_day` and `admin_activity`.

The privacy dialog describes the counts. Current deployment state and actual read-only hosted diagnostics are recorded in `docs/live-release.md`.
