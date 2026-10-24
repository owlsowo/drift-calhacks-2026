# Live release checkpoint — October 24, 2026

Frontend: https://drift-game.drift-calhacks-2026-owlsowo.workers.dev

Backend: `drift-calhacks-2026` on `https://maincloud.spacetimedb.com`.

The first real hosted two-browser test passed: two independent identities submitted fresh synthetic setups through Claude Haiku 5.5, caught another writer's setup, received a real Sonnet 5.5 nudge, completed pair moderation, observed the live return without refresh and downloaded a PNG. The test postcard was hidden afterwards. `docs/evidence/hosted-smoke.json` records this check, including the enforced HTTPS headers. This run preceded Turnstile enablement; it does not establish a physical-phone or attendee pilot.

The initial strict CSP exposed runtime `Function()` use in SpacetimeDB SDK 2.13 serializers. A small interpreted Product/Sum serialization adapter preserves the wire format without adding unsafe-eval. Its regression test compares SDK wire bytes and round-trips identities/timestamps while dynamic code evaluation is blocked.

## Model evaluation

The initial 12-case run found one nudge rejected by the output contract. The coaching instructions were shortened and explicitly forbid echoing contact details. The subsequent full 50-case run produced 50 valid outputs. Moderation matched 35 of 36 synthetic development labels; the remaining case conservatively returned review for harmless instruction-like text. Fourteen hints were reviewed by Codex for grounding, contact-data leakage and whether they wrote a complete ending. They remained guidance, but overly bureaucratic tone remains a quality limitation. This is an agent-reviewed synthetic evaluation, not a human user study or a safety guarantee. Both runs remain in `evals/`.

## Retention and abuse controls

An hourly private schedule removes expired requests/bottles after seven days and cards/reports/rounds after thirty days. It also removes orphaned author mappings left after hiding and expired hello details. Browser drafts expire seven days after their latest edit; legacy plain-text drafts migrate on first read.

Turnstile uses server-side Siteverify, checks the expected hostname and action, and binds a one-hour pass to the caller identity. The UI alone cannot authorize a paid action. Isolated tests explicitly clear real provider and Turnstile credentials. Production secrets stay in ignored environment files and server environment values.

The private repository stays private. A judge still needs source access. Physical-phone behavior and independent moderation labels remain separate verification tasks. Actual Figma/Mana work, accessible artifact links and the source handoff are now recorded in `docs/workflow-checkpoint.md`; this does not establish final submission or prize eligibility.

## Catch-first daily ritual

The main shake/pick action now catches a peer beginning before asking for writing. Reply moderation creates the postcard immediately; an optional invitation then allows the writer to toss their own beginning in the same round or keep the result and leave. The write-first dock control remains. A returned bottle changes the bucket label based on actual co-author ownership. Seven prompts rotate weekly from October 24, with the first two preserving the original demo days. New example lines are development samples, not human-written production starters. `catch-first.json` and 43 server tests cover the transitions and empty-pool rollback.

## Figma/Mana handoff release

Frontend version `b4b6e68c-e6b8-477e-a6e7-2e7b963d15c5` deploys `2544990`. The backend was updated without schema/data deletion. A real production identity passed the automatic shore check and an empty catch displayed the compact paper recovery note; no model dispatch was needed. The old unconsumed synthetic hosted-smoke bottle was confirmed hidden with empty text. Production team inventory remains empty: an environment flag cannot convert bundled development samples into human content. The actual Mana synthetic draft validates as a draft and is refused for installation. Figma Slides and Make files, and the Mana app/chat snapshot, have public view-only sharing.

## Cost accounting and concurrent-ID release

Frontend version `988b56f4-24c1-41ce-aab0-616be85b50dc` and the matching backend add private USD reservation/usage/latency accounting, owner diagnostics and a transactional ID allocator. The additive migration retained game data and reconnected clients. The real hosted app reloaded successfully and displayed the updated retention explanation.

The first actual ten-writer run exposed duplicate round primary keys under simultaneous starts. A durable counter suffix now keeps opaque server IDs unique even when their UUID component repeats. A forced-entropy regression and the actual ten-writer, shared-identity, private-table and duplicate-publication checks passed afterward. Fifty-one server tests, twenty-one unit tests, build/typechecks and the four catch-first browser checks passed.

The full twenty-one-check browser flow also passed after the ID change, including returned stories, reload recovery, private hello, public sharing/hiding and PNG exports. This run used local SpacetimeDB with AI disabled and synthetic inputs; it does not replace the separate hosted Claude checks. Updated screenshots and the run record are in `docs/evidence/ui-smoke.json`. GitHub CI passed for `fd55ae0`.

Two owner-only fixed synthetic health checks used real Sonnet and Haiku calls, created no game content and settled their reservations. Recorded usage totaled 1,093 input and 75 output tokens, with a $0.001703 estimate and zero remaining holds. The two observed server durations were approximately 1.63 and 1.97 seconds; this is a two-probe snapshot, not a latency benchmark. Four pre-ledger application dispatches and component evaluations are explicitly excluded. See `docs/evidence/hosted-ai-usage.json` and `docs/ai-budget.md`.
