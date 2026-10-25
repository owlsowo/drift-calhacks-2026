# Ending discovery and upvotes

Every responder and public reader can use the completed postcard’s explicit all-endings link to open the same beginning and read its other responses. Each ending has a public live upvote count. One anonymous session has one reversible selection per ending; individual voter identities and selections are private. Votes use no writing turn and no model call.

New votes require the existing human check, are limited to 100 additions per session per UTC day and have a brief rate guard. Duplicate submissions are idempotent. Undo is allowed during pauses and after verification expires. Reporting retracts that reporter’s selection. Hiding, withdrawal, resolved removal and retention delete associated vote mappings and public totals. Private rate counters expire after thirty days. Clearing storage creates another anonymous session, so this is not proof of one vote per physical person.

The additive schema creates only private `card_vote` and `vote_rate` tables, plus public totals and sender-scoped selection views. Existing story tables and wire shapes are unchanged. The owner backup/readback allowlist includes both new tables with explicit zero-row expectations for the first upgrade.

Validation: 132 server checks, 45 unit tests, nine backup fixtures, eight browser vote cases per Chrome/WebKit, ten Chrome navigation checks, build and script/server types. Browser cases use actual disposable local state and synthetic stories, with injected lost acknowledgement/expired verification and a denied empty-pass preflight. No live challenge is solved; no paid provider call or physical-phone claim. Hosted publication and readback are recorded separately after release.
