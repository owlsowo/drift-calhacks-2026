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

## Draft/deadline recovery release

Frontend version `f5c8e71b-aaa6-4a29-a6a9-2468d886394d` deploys `8b98334`. Expiry feedback no longer depends on the assignment panel, earlier local words are recoverable by identity/round without replacing the active draft, and the closed-round view uses photographed paper for contrast. Skipped and closed-round drafts remain copyable, including from memory when browser storage is blocked. Old progress steps are hidden; the fresh-day action catches first. No backend schema/data or provider integration changed.

CI passed (run `40144625518`), as did 57 module tests, 22 Chrome two-writer checks, twelve content-state captures and eight targeted Chrome/WebKit recovery checks. Recovery fixtures explicitly inject the UI clock, lease/withheld-assignment projection and clipboard; the real server transition is separately covered by the module test clock. There is no physical-phone or overnight-wait claim. Both hosted entry assets match the tested build (`draft-recovery-release.json`).

The 605,259-byte / 177-file source snapshot `drift-source-8b98334.zip` passes fresh root/server installs and frontend/server builds after extraction without env files or publishing. `recovery-source-snapshot.json` records its hash. The earlier source/review bundles remain historical checkpoints, while the private GitHub main contains the current code.

The current local team review pack is `drift-review-pack-8b98334.zip`, 6,501,633 bytes / 24 files. It combines the clean-build source snapshot, current recovery notes/screenshots and existing labeled 2:31 video. Source/media hashes, relative Markdown file links, credential scans and ZIP integrity pass; `current-review-pack.json` records the result. Packaging did not upload code, change repo visibility or submit an entry.

## Empty-sea participation release

Frontend version `799bb04c-e43b-4826-a558-85f3fe170d5c` deploys `6beae71`. A published beginning can stay on today's tide while its writer closes the counted round; a later peer can still finish it and return the same canonical postcard. A return that arrives while the author waits changes the recovery action to keeping the story. The home/catch recovery copy distinguishes these states, and a new return clears stale drifting feedback.

The backend update adds an optional development-starter switch for a genuinely empty AI-off sandbox. The remote migration plan contained no database-table changes, the identity remained the same, and production publishing forced development mode off. All 58 module tests, twelve local Chrome/WebKit cold-start checks, 22 Chrome UI checks, frontend build and server/scripts typechecks passed. CI passed for `6beae71` (run `40146124728`). Real hosted entry assets match the tested build; the real shore was observed on edition 002 with the spaceship prompt after UTC reset. The release probes created no public test story or paid model call. See `coldstart-release.json`, `coldstart/checks.json` and `docs/coldstart.md`.

The current 614,737-byte source snapshot `drift-source-6beae71.zip` contains 182 files and passes clean installs plus frontend/server/module builds after extraction without env files. `coldstart-source-snapshot.json` records the archive hash and commands. The ten-route plan adds Most Technically Complex as a stretch category using existing evidence; it does not establish eligibility, category caps or a final entry.

The refreshed `drift-review-pack-6beae71.zip` is 6,862,813 bytes / 28 files. It pairs the clean-build source with the ten-route plan, current cold-start/recovery notes and the earlier explicitly labeled 2:31 video. Relative file links, source/video hashes, credential pattern/value checks and ZIP integrity pass (`current-review-pack.json`). Nothing was uploaded or submitted by packaging.

## Complete note-opening release

Frontend version `fe7e22a3-c759-4a3c-bd66-b799d71db0f0` deploys `3ab064d`. A ready note mesh starts at zero and completes its final frame; slow or failed textures use a complete CSS opening after a bounded 200 ms renderer choice. Context loss and reduced motion leave readable controls, and controls no longer fade through low contrast. The sea no longer requests unnecessary multisample antialiasing for its full-screen quad; no phone battery or field-performance improvement is claimed.

The controlled before/after diagnostic, eight Chrome/WebKit failure cases, ten shore checks, nine WebKit game checks and production build passed. CI run `40148987110` succeeded. Both hosted entry assets match the tested local build byte for byte (`note-opening-release.json`), and the connected live shore was inspected after deployment. These probes created no production story or paid model call. See `docs/note-opening.md` for measured tradeoffs and test limits.

## Independent letters and quiet-coast deployment

PR #1 merged as `b36904d`; migration follow-up `c2e0d4d` is deployed as Cloudflare version `83c598bd-166e-458d-b3d2-bec4f635c16c`. Release and Pick up are independent, a beginning can receive several writers' endings, and the browser shelf saves public IDs without granting author permissions. The bundled MIT WebGPU ocean and bottle ritual are active. Generated runtime images from the original PR were replaced with the existing licensed photographs, SVG lighthouse and CSS grain; historical branch screenshots remain distinct from current runtime assets.

An actual local old-release-to-new-release upgrade preserved eleven synthetic rounds/four bottles, a visible pair, a hidden pair, active leases, ownership, request receipts and cost/activity records. Its owner backfill was run twice to verify idempotency. Five migration module tests bring the server suite to 66; 25 unit tests, the current eight-check Chrome pool flow, production build and server/scripts typechecks pass. CI `40151007933` passed for `c2e0d4d`. The integration commit separately passed eight pool checks in each Chrome/WebKit engine and eight note fault cases. Older sequential-flow scripts are not claimed as passing under the new mechanics.

Hosted publishing explicitly used `--delete-data=never`. The plan only added defaulted end columns, two tables and an index. The database identity stayed `c20021eee2fe643cce13a21845d5dcb1a168026f58ec4ac83d36ebd86563be60`. An ignored local owner backup and post-upgrade SQL comparison verify all existing row counts and old fields, except two completed-release stage changes; scheduled maintenance and expiring shore passes were excluded from immutable comparison. Three approved legacy beginnings were projected; this is not attendee or human-starter-inventory evidence. Submissions were restored to their previous unpaused state.

The live connected shore, new controls and rendered ocean were inspected on HTTPS. The entry JS/CSS and lazy ocean chunk match the tested build, and CSP still excludes unsafe-eval. These release probes created no story or paid model call. Evidence: `letter-migration.json`, `letter-upgrade-hosted.json`, `independent-letters-release.json`, `migration-*.png` and `independent-letters-live-home.png`. Physical phones and a new hosted multi-writer/model flow remain separate verification work.

## 2026-10-25 — visible bottle shakes and contribution captions

Frontend `e0df0d3` (Cloudflare `152a165e-3d3f-45fa-90eb-ec236d7a817e`, CI `40152060990`) adds private-role contribution captions and neutral PNG captions with photograph credit. Ten local checks in each Chrome/WebKit include actual downloads and cookie-only public recovery. See `contribution-release.json`.

Frontend `4acb0a3` (Cloudflare `b7f31eb6-95bf-430f-8aa9-c5c1d4387cbf`, CI `40152447514`) restores pointer/explicit opt-in phone shakes in the reachable pickup ritual. Six checks per Chrome/WebKit cover permission denial/failure, deliberate reversals, weak/hidden/axis-changing input, focus, reduced motion and phone opt-out. Twenty-seven unit checks and the current Chrome letter flow pass. Phone sensor and permission checks are emulated. All served entry/ocean assets match the tested build; the new hosted Help text was inspected and captured. Neither release probe creates a story or paid call. The database was unchanged. See `bottle-ritual-shake.md` and `bottle-ritual-release.json`.

## 2026-10-25 — bounded retry records

Frontend `e298e2a` is deployed as Cloudflare `1f936ef8-629c-4d45-b0c2-290dd1cb33a7`; CI `40153206152` succeeded. Request retry text now receives the same bounded envelope as drafts, retains its original ID through unknown outcomes and is removed immediately after a confirmed result. Current-connection guards keep manual reconnect status accurate.

Six retention checks, ten letter checks and six ritual checks pass per Chrome/WebKit using corrected synchronous state polling. The retention suite injects response loss after an actual local server commit and confirms replay leaves one request with the same ID. Time, sensor, permission and storage faults are emulated. No provider call is made by these local suites. Served entry/ocean bytes match the tested build, strict CSP remains, and the hosted Privacy explanation was inspected. The database is unchanged. See `local-retry-retention.md`, `local-retention-release.json` and `local-retention-live-privacy.png`.

## 2026-10-25 — owner-approved coast and lighthouse

The owner approved restoring the PR landscape and lighthouse in Codex. Frontend `98f854b` is live as Cloudflare `527fbfff-d9bb-4c89-b756-df1fb9349441`; CI `40154046528` passed. All three approved image files match the original PR exactly. The transparent headland sits over live simulated water; unsupported WebGPU gets the responsive landscape/portrait art. Paper remains photographed and the dock remains CSS. Credits disclose generated artwork accurately.

Twenty-five targeted scene/ritual/paper checks passed after this change. The served JS/CSS, ocean chunk, three images and credits page match the tested build. The connected public scene was inspected; no story or paid call was created, and no database change occurred. See `approved-coast.md`, `approved-coast-release.json` and `approved-coast-live.png`.

## 2026-10-25 — direct co-writing invitations

`0462e9b` is live as Cloudflare `74a2867b-2dbf-460d-9bc4-5836e884a965`; CI `40155096372` passed. Backend publication kept the same database identity, used `--delete-data=never` and required no table migration or backfill. Paused before/after owner readback preserved existing rows/fields with zero completed-release changes. The shore is unpaused.

All 75 server and 27 unit checks, fourteen local Chrome/WebKit invitation checks and the current Chrome letter regression pass. The live public invitation view was inspected and the new hosted reducer rejects an unverified guest. Served entry/ocean files match the tested build. No hosted story or paid model call was created by these release probes; this is not yet the new hosted multi-writer Claude completion gate. See `bottle-invitations.md`, `invitation-upgrade-hosted.json`, `hosted-invitation-check.json`, `invitation-release.json` and `invitation-live-public.png`.
