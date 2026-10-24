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

The private repository stays private. A judge still needs source access. Physical-phone behavior, independent moderation labels, and actual Figma/Mana workflow entries remain separate verification tasks.

## Catch-first daily ritual

The main shake/pick action now catches a peer beginning before asking for writing. Reply moderation creates the postcard immediately; an optional invitation then allows the writer to toss their own beginning in the same round or keep the result and leave. The write-first dock control remains. A returned bottle changes the bucket label based on actual co-author ownership. Seven prompts rotate weekly from October 24, with the first two preserving the original demo days. New example lines are development samples, not human-written production starters. `catch-first.json` and 42 server tests cover the transitions and empty-pool rollback.
