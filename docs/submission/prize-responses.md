# Drift — prize response copy

Prepared October 24, 2026. The four text blocks below are public-facing drafts. The final section is an internal selection checklist. They describe the implemented product and recorded evidence; they do not assert sponsor eligibility or that a prize has been entered.

## Best Use of Spacetime

Drift is a daily co-op writing game: one person leaves a six-word beginning, another catches it and adds a six-word ending, and both keep the same postcard. SpacetimeDB makes that collaboration authoritative. Transactions assign each bottle to one writer under a versioned, ten-minute lease; caller-specific views protect private progress; subscriptions return the finished postcard to the original author without a refresh.

Claude checks run outside the transaction. Before publishing, a new transaction rechecks ownership, the claim version, and its deadline, then finalizes the postcard, consumed claim, completion state, and authors together. Late callbacks cannot publish an expired or reassigned catch, and repeated request IDs do not dispatch again. A real hosted two-browser test demonstrated moderation, canonical publication, live return, and PNG export with synthetic writers. The official module harness passes 43 tests covering transactions, privacy, and failure behavior.

## Claude for Public Benefit

Drift explores a small question: could making one joke together help first-time event attendees begin a conversation? Two writers contribute six words each and receive a shared postcard. Our target community and benefit are design hypotheses; we have not conducted an attendee pilot or demonstrated reduced loneliness.

Claude supports participation while preserving human authorship. Haiku 5.5 checks beginnings before delivery and completed pairs before publication; Sonnet 5.5 offers an optional direction grounded in the caught beginning and the writer’s draft. People write both creative lines. Uncertain, malformed, or failed checks withhold publication and preserve the draft. A hosted synthetic test completed real moderation and guidance, followed by a live return and PNG export. It preceded bot-gate enablement; normal-user access through the new gate still needs verification. A revised 50-case synthetic evaluation produced 50 valid outputs, with moderation matching 35 of 36 development labels. These checks establish a working integration, not proven social benefit or a safety guarantee. Our next step is a small consent-based attendee pilot and independent human review of moderation and coaching.

## Meta/Facebook: Bringing People Closer Together with AI — conditional entry

Drift gives two people a tiny thing to make together before they exchange introductions: a six-word beginning, a six-word ending, and one shared comedy postcard. A writer can catch first, finish the story, and keep it; leaving another beginning is optional. Claude supplies contextual checks and optional coaching, while the creative contributions remain human-written. SpacetimeDB makes the shared result arrive in both collections live.

Our hypothesis is that a bounded creative task can lower the effort of a first interaction for event attendees. A hosted test with synthetic writers demonstrated the collaboration and real AI path before bot-gate enablement. We have not measured whether it helps strangers connect, and normal-user access through the current gate remains to be verified. A small attendee pilot should test whether people understand the shared authorship, enjoy the exchange, and choose to continue. We are presenting an implemented interaction and a testable connection hypothesis, without claiming observed friendship or community outcomes.

## Best People-First Social Impact Hack — conditional entry

Drift is a small shared activity for first-time event attendees: catch an anonymous six-word beginning, add six words, and keep the postcard you made together. The limited contribution keeps the task short; a writing nudge is optional, leaving a new beginning is optional, and the main flow does not ask for a profile or contact exchange. Buttons and keyboard alternatives accompany the playful shake interaction, reduced motion is supported, and either author can hide a published card.

We believe a creative task could make a first interaction easier, but that need and benefit have not been validated with attendees. Current evidence consists of synthetic browser demonstrations, automated checks, and a hosted Claude/SpacetimeDB run before the new bot gate was enabled. It does not show adoption, enjoyment, reduced loneliness, or lasting relationships. The next people-first work is to observe a small consent-based pilot, ask what felt comfortable or confusing, and use those findings to revise the experience.

## Internal selection checklist — do not paste into prize answers

| Route | Evidence fit now | Before opting in |
| --- | --- | --- |
| Spacetime | Strongest direct technical fit: authoritative state, claims, private views, atomic publication, and live subscriptions. | Rehearse a fresh two-browser return on the submitted release, including normal positive bot-gate access; provide judge-readable source. |
| Claude for Public Benefit | Real model integration and synthetic evaluation exist. The community need and public benefit remain hypotheses. | Check the actual sponsor prompts and eligibility. Use the candid copy above; add participant evidence only if it is actually collected and accurately documented. |
| Meta | The interaction centers two humans and uses optional AI support. The connection claim is untested. | Confirm category opt-in requirements. Enter only with that evidence limit clear; do not claim a Meta model integration. |
| People-First | Clear intended audience and bounded interaction, privacy, and accessibility choices. No participant outcomes. | Keep the distinction between design intent and observed benefit explicit. |
| Figma | Not ready: no completed genuine workflow evidence established. | Do not opt in based on invented tooling history. The official brief requires actual workflow artifacts, accessible Figma Slides/files, stage logs, education verification, and its video requirement. Video is outside this package. |

### Submission facts to preserve

- The [official Cal Hacks listing](https://cal-hacks-13-0.devpost.com/) currently names these routes. [Hive’s official prize page](https://hive.hackberkeley.org/prizes) is the sponsor-brief entry point. Category labels do not establish eligibility, stacking rules, or the exact Additional Details fields; the registered owner must inspect the actual form.
- The hosted success in [hosted-smoke.json](evidence/hosted-smoke.json) used synthetic writers before Turnstile was enabled. [hosted-gate.json](evidence/hosted-gate.json) records negative enforcement only. Keep both caveats with any current hosted-readiness claim until a fresh positive run supersedes them.
- Local catch-first evidence in [catch-first.json](evidence/catch-first.json) has model checks off. It is evidence of the database/UI transition, not a second live-Claude result.
- The latest model evaluation is a synthetic development set with Codex review, not independent human assessment. “50 valid outputs” is contract compliance; it is not 50 correct moderation decisions.
- Team starters require real human-written replacements and explicit attestation. Existing starter arrays are development samples. Screenshots, scripted identities, and samples are never participant evidence.
- No public copy should claim a pilot, friendship formation, reduced loneliness, production scale, physical-phone verification, or a completed Figma/Mana/Notability workflow.
- These answers need no new service integration. Do not add unrelated sponsor tooling or recast the game as an autonomous agent to widen the entry list.

### Evidence pointers

- [Current release and model-evaluation record](evidence/live-release.md)
- [Official module tests](https://github.com/owlsowo/drift-calhacks-2026/blob/ef6849229833a951d5eda5c1e0295c955081f27c/spacetimedb/tests/game.test.ts)
- [Claim and publication implementation](https://github.com/owlsowo/drift-calhacks-2026/blob/ef6849229833a951d5eda5c1e0295c955081f27c/spacetimedb/src/index.ts)
- [Current demo and questions](judging-notes.md)
- [Figma’s official workflow brief](https://docs.google.com/document/d/1HjzThDGveSLiilIdEPEHq12ZVLZ5eS0T8CQC5_m_-rg/edit)
