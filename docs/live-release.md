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

## Theme-aware coaching release

The backend now requests everyday guidance that follows the actual scene/speaker and leaves the player's ending open. A 24-word display ceiling tolerates modest model word-count drift around the shorter writing target. The schema did not change, no migration was needed and frontend assets remain unchanged. Twenty-two unit tests, fifty-one server tests, server/scripts typechecks and the production build pass.

Two real nine-call coaching runs exposed one strict-18-word rejection each; those failures remain recorded. The second run uses the final system prompt verbatim. Its nine saved outputs pass offline revalidation under the final receiver. Codex judged seven helpful and two generic; no complete game endings or contact echoes were observed. This is synthetic agent-reviewed evidence, not independent quality certification. See `docs/coach-evaluation.md`.

A fixed owner-only Sonnet probe passed through the deployed parser and usage ledger, publishing no game content. Its recorded estimate is $0.001896 and measured server duration approximately 1.51 seconds; a single probe is not a latency benchmark. `docs/evidence/coach-hosted-usage.json` records the snapshot. The component evaluation allowance is now 80/80, with $0.064694 estimated for 79 usage-bearing attempts and one earlier unknown charge. It remains separate from application use.

## Mobile payoff and WebKit release

Frontend version `08aedf76-7afc-4798-8421-bc63599910fb` deploys `c3610daf0a2e96d71dbf50385e7442e5ca60be01`. The optional next-beginning invitation now follows the postcard and sharing controls on mobile, instead of appearing ahead of the completion title. The invitation is phrased as an optional question. No backend schema or data changed.

The actual Playwright WebKit 27.2 engine passed seven local checks with iPhone viewport/touch configuration and a desktop view: moving/paused sea pixels, connected paper, draft/catch recovery, two-writer live return, PNG export, copied public links and explicit rendering/share failure cases. Six states passed the selected accessibility scans. Native-share cancellation/denial were injected adapters; physical iPhones, native keyboards, real sensors and OS share sheets remain unverified. Chrome's targeted catch-first flow passes five checks, including completion order. See `docs/browser-checks.md`.

GitHub CI passed for the code commit. Read-only HTTPS fetches confirmed both deployed frontend assets match the tested local build byte for byte; their hashes are in `docs/evidence/mobile-layout-release.json`. This deployment check created no game content or paid model calls.

## Private activity release

Backend and frontend now include private UTC-day story/action diagnostics. Source commit `5947fc7caa038f661751e0f8c800b7343341bcd3` is deployed as Cloudflare version `671d4993-a3e2-4b94-b46d-507b914b46f4`. The additive migration created private `activity_day` and default-zero author action flags, retaining existing records and reconnecting clients. Daily totals contain no story text or identities; action flags use existing private card ownership. The privacy dialog explains the counts.

Fifty-six server tests, eight local WebKit checks, server/scripts typechecks, production build and the actual ten-writer network checks pass. The browser instrumentation check observes visible author opens, excludes an injected hidden-page state and public visitors, distinguishes cancelled/denied/resolved native-share adapters, and deduplicates repeated exports. These are synthetic software checks. CI passed for the code commit.

Actual hosted checks rejected a forged Turnstile token, an unverified start, guest owner-diagnostic access and a guest subscription to daily totals. The initial owner read succeeded with no recorded activity rows; no outcomes or historical traffic are inferred from it. No model call or test story was created by these release probes. Hosted assets match the tested build, and the new privacy paragraph was inspected on the live site. Evidence: `activity-release.json`, `hosted-activity.json`, `hosted-gate.json` and `activity-privacy.png` under `docs/evidence/`.

The 582,669-byte source snapshot `drift-source-5947fc7.zip` also passes fresh installs, frontend build, server typecheck and actual Spacetime module build after extraction. `docs/evidence/activity-source-snapshot.json` records the pinned source/hash and results. It remains a local artifact; judge source access is still separate.

## Daily-game UI release

Frontend version `fe60dd10-2525-4389-b2ff-bc15a4c5ef56` deploys `5043061`. The shore now displays an edition/date from the server day, highlights catching, and shows the collected stamp from actual completed-round state. Six numbered marks replace the tiny writing dots, filling as words are typed and indicating overflow without truncating drafts. The bottle, photographs and connected paper animation remain in use.

The build, 22 unit tests, eight WebKit checks, ten shore-interaction checks and both empty-state viewport flows passed. GitHub CI passed for `5043061` (run `40142755459`). The initial concurrent shore database creation failed; a sequential rerun passed. Selected accessibility scans and visual review cover the refreshed mobile/desktop screens. Hosted assets match the tested build, and the live dated identity/primary action were inspected without paid calls or new test stories. No backend migration was required. Evidence: `daily-ui-release.json` and refreshed browser screenshots. Tonight's actual Figma v3/v4 iteration, adoption decisions and credit-limit friction are recorded in `workflow-notes-evening.md` and the updated stage log.

## Returned-bottle awareness release

Frontend version `4ddc210d-893a-4c17-88a5-08f11874b64a` deploys `86683ac`. A newly completed author-owned beginning now produces a quiet notice with open/dismiss controls. It preserves the current draft and focus, reaches the correct canonical postcard, and treats the first subscription after reload as historical baseline. The persistent polite status region is software-tested, not an assistive-technology user study. Help now explains catching first and an optional beginning after the payoff.

GitHub CI passed for `86683ac` (run `40143261226`). All 22 Chrome two-writer checks and nine WebKit checks pass, including the notice/open path; Chrome also verifies focus, draft recovery and no historical-card announcement after reload. Selected accessibility scans and mobile/desktop screenshot review passed. The actual hosted help dialog was inspected; hosted entry assets match the tested build. The hosted probe created no content or paid calls and no backend migration was needed. See `return-notice-release.json` and the refreshed browser evidence.

The new source snapshot `drift-source-86683ac.zip` contains 170 files (593,053 bytes) and passes fresh root/server installs, frontend build, server typecheck and Spacetime module build after extraction without env files. `return-source-snapshot.json` records the pinned source and archive hash. This is a local review artifact; repo privacy and judge access remain separate.

A refreshed local review pack, `drift-review-pack-86683ac.zip` (6,313,708 bytes / 21 files), combines that source snapshot with the existing labeled 2:31 video, current workflow notes and release evidence. Relative Markdown file links, media/source hashes, credential patterns/known values and ZIP integrity passed. `current-review-pack.json` records its hash. The earlier video is explicitly distinguished from tonight's newer UI. Nothing was uploaded or submitted.
