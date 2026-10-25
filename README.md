# Drift

**Six words from you. Six from a stranger.** A mobile web game where two people make a tiny comedy postcard together.

[Play the deployed game](https://drift-game.drift-calhacks-2026-owlsowo.workers.dev/) · [Submission video draft and provenance](docs/video-handoff.md) · [Figma / Mana workflow artifacts](docs/workflow-checkpoint.md)

**Release** writes a beginning letter. **Pick up** finds another writer’s beginning and lets you add an ending. These are separate actions with independent drafts. A beginning stays in the daily pool so several people can each complete a different pair from it. **My bottles** stores beginning IDs and completed-pair IDs in first-party cookies; opening a beginning retrieves all its endings. Drafts and the anonymous session token remain in local storage. Public IDs allow reading approved letters, while author-only actions still require the owning session. Sample starters are clearly labeled and AI guidance never writes either creative line.

## Current status

The build uses React 19, TypeScript, Vite 8 and SpacetimeDB 2.13. The hosted independent-letter upgrade preserved the original database and records with defaulted appended columns and an owner backfill. See [migration evidence](docs/letter-migration.md). The current three-writer integration passes ten checks in Chrome and ten in WebKit: multiple endings, independent drafts, real ID cookies, reload recovery, private/public contribution captions and actual PNG download. These are isolated synthetic checks with model calls disabled.

The full-screen sea uses the locally bundled MIT-licensed Noniv WebGPU FFT engine. Unsupported devices and reduced motion use the credited sea photograph. The bottle and lighthouse are original SVG, the dock is CSS, and paper uses a real credited photograph; **no AI-generated images ship in the runtime**. See [asset sources](docs/asset-sources.md). The note opens over the same sea. The current pickup ritual supports deliberate pointer shakes alongside tap/keyboard opening, with explicit opt-in phone motion, an off control and reduced-motion support. Browser sensor checks are emulated; physical phones remain unverified.

**Live checkpoint:** Cloudflare HTTPS and Maincloud are deployed. The contribution-caption release is `e0df0d3` ([served-file evidence](docs/evidence/contribution-release.json)); the new shake refinement is recorded separately when deployed. A real hosted two-browser Claude flow and Turnstile negative checks passed before the independent-letter redesign. A new hosted multi-writer/model flow under the revised mechanics remains pending; local tests do not establish it. Figma Make/Slides and Mana Bottle Kitchen have actual workflow artifacts: [workflow checkpoint](docs/workflow-checkpoint.md). Actual phones, attendee outcomes and final sponsor eligibility remain unverified. The team owns submission writing.

## Local development

Prerequisites: Node 22.12+ (tested here with 26.7), npm, Chrome, and the [SpacetimeDB 2.13 CLI](https://spacetimedb.com/install).

```sh
npm ci
npm ci --prefix spacetimedb
test -f .env || cp .env.example .env
# Put ANTHROPIC_API_KEY in .env for real model calls. Never commit it.

# Terminal 1: start a local database server
spacetime start --listen-addr 0.0.0.0:3000

# Terminal 2: publish the module, then generate its client bindings
npm run db:publish:local
npm run db:generate
npm run dev
```

The frontend is at `http://localhost:5173`; another device on the same network can use the LAN URL printed by Vite. Use two separate browser profiles/incognito contexts for distinct writers. Tabs in the same browser share an identity and resume the same active round.

`db:publish:local` loads the untracked root `.env` without printing its contents. If no key is present, it enables an explicitly labeled local sandbox. Production publishing must not set `DRIFT_DEV_MODE=true`.

### Configuration

Server environment values: `ANTHROPIC_API_KEY`, optional `MODERATION_MODEL` (default `claude-haiku-5-5`) and `NUDGE_MODEL` (default `claude-sonnet-5-5`). They are installed as private SpacetimeDB environment values during publish. They are not embedded in the frontend bundle or passed in command arguments.

Frontend build values: `VITE_SPACETIMEDB_HOST` and `VITE_SPACETIMEDB_DATABASE`. Set them in `apps/web/.env.local` for a hosted database. Without them, the client connects to port 3000 on the current hostname and the `drift-local` database. **Never prefix a secret with `VITE_`.**

Publish to Maincloud with `npm run db:publish -- <unique-database-name> --server maincloud` after the human owner logs into the intended account. The script refuses a non-local sandbox publish. Update frontend values, regenerate bindings, and run the two-device checks again before claiming a deployment works.

## Checks

```sh
npm test
npm run test:server
npm run check:server
npm run check:scripts
npm run build
npm run test:letters
DRIFT_TEST_ENGINE=webkit npm run test:letters
npm run test:ritual
DRIFT_TEST_ENGINE=webkit npm run test:ritual
npm run test:migration
npm run test:paper-fallbacks
npm run eval:models -- --dry-run
```

The integration tests require the local database server. Each creates a disposable database and, for browser tests, its own frontend; cleanup leaves the main development database alone. They use synthetic fixtures in isolated browsers, save screenshots and test full reload recovery, live returns and downloads. They do not establish model quality or social impact. `test:live` probes concurrent claims and access controls; `test:states` injects loading, pause and offline failures.

### Earlier verification checkpoints

The older `test:ui`, `test:shore`, `test:webkit`, `test:recovery`, `test:coldstart` and demo scripts describe earlier mechanics and are not passing release gates for the independent-letter redesign. The records below are historical context; use the current letter/ritual/migration checks above for this build. Install the WebKit engine with `npx playwright install webkit` before current WebKit checks.

`test:webkit` additionally needs `npx playwright install webkit`. The actual engine passes the catch/open/write/return/export loop with an iPhone viewport, and found a mobile completion-order bug now fixed. Share cancellation/denial use injected adapters; physical iPhones, motion sensors and OS share sheets remain separate checks. See [browser evidence and limits](docs/browser-checks.md).

`test:recovery` exercises real catch/skip transitions in Chrome and WebKit, then injects the UI clock/lease/assignment projection to check deadline and daily-reset recovery without an overnight wait. Earlier local words remain copyable without replacing the active draft; expired envelopes and other identities are excluded. Short-viewport checks are not physical-keyboard evidence. The module suite separately verifies real server-time expiry and reassignment. See [draft recovery](docs/draft-recovery.md).

`test:coldstart` disables all starter fallback in an AI-off sandbox and exercises the two-identity flow at phone/desktop sizes in Chrome and WebKit. A writer can leave a published beginning drifting; a later peer can finish it and return the shared postcard after that original round closes. Closing still counts toward the daily limit. See [empty-sea recovery](docs/coldstart.md).

The [note-opening comparison](docs/note-opening.md) covers image delays, a complete mesh/CSS opening and stable visible controls. `npm run test:paper-fallbacks` exercises rendering failures and dynamic reduced motion; `DRIFT_BENCHMARK_LABEL=after npm run benchmark:paper` records the controlled timing diagnostic, separate from production page metrics.

`npm run demo:rehearse` discovers and exercises the recording flow in a disposable local sandbox. After it passes, `npm run demo:record` records two isolated browser identities and assembles a 1280×720 MP4 in the task’s `outputs/` folder. Chrome, Playwright’s FFmpeg helper (`npx playwright install ffmpeg`) and a system `ffmpeg` are required. The video is visibly labeled as synthetic sandbox participation with model checks off. It is a product demonstration, not live AI or attendee evidence. The recorded checkpoint and its provenance are in `docs/evidence/local-sandbox-demo.mp4` and `demo-run.json`. See `docs/deployment.md` for the real release handoff.

## Architecture and boundaries

- The server checks exact word count and character limits. Unicode letters/numbers count; emoji-only chunks do not.
- Private rounds, bottles, requests, reports, ownership and counters cannot be queried by other writers. Caller-specific views expose only permitted progress.
- Only approved anonymous beginning and postcard text is public. Either author can hide it; hiding deletes the public projection.
- Catching is transactional. Each response round has its own assignment, version and absolute ten-minute lease. Different writers may respond to the same beginning concurrently. A late model callback rechecks the response round before publication.
- Paid operations persist a bound request before dispatch, enforce round/global quotas, and finalize separately. Duplicate IDs do not spend again; reusing an ID for changed content fails.
- Publication of each pair, response-round completion and both authors’ ownership finalize atomically; the beginning stays open for other writers.
- Setup moderation runs before delivery; pair moderation runs before postcard publication. Uncertain or malformed responses withhold text and preserve drafts.
- Only the database owner can pause dispatch/publication or invoke the purge reducer. The application cap starts at 1,000 dispatches, including uncertain calls. Provider budget alerts are a separate control.

An hourly private maintenance schedule enforces seven days for submitted request text, and thirty days for published beginnings, cards, reports and rounds. It also purges orphaned hidden-card author mappings and expired hello details. Browser drafts expire seven days after the latest edit. The owner can also run `purge_old_data` manually. Hiding cannot retract downloaded images or screenshots.

## Competition evidence

See `docs/competition.md` for the track plan and evidence gaps. The product targets a playful first interaction for first-time event attendees; this remains a hypothesis. Screenshots, automated test identities and starter content must never be represented as real pilot participation.

The coach now requests short, everyday guidance using the actual theme and speaker. [The coaching checkpoint](docs/coach-evaluation.md) records nine real contexts, the strict word-count failures and final receiver revalidation. Seven of nine final-prompt hints were judged useful by Codex; two were generic. These are agent judgments, not human labels. The original moderation evidence is unchanged.

The October 21 illustrated prototype and earlier planning documents informed direction. This implementation was started during the event on October 24, 2026. The older prototype’s code and scripted demo are not used as evidence of live functionality.

## Optional hello

The mutual hello feature is implemented and disabled by default. To enable it, the human owner must physically verify a public meeting point and set server environment values `DRIFT_HELLO_ENABLED=true`, `DRIFT_MEETING_SPOT=<public label>` and `DRIFT_MEETING_SPOT_VERIFIED=true`, then republish. It is available only for cards made by two guest identities, not team starters. It expires ten minutes after postcard creation. Withdrawal or hiding cancels access. The private recognition phrase is absent from public data and exports.

Cloudflare static hosting is deployed and actual HTTPS headers were verified. The CSP does not allow unsafe-eval; the browser SDK uses a tested interpreted serialization adapter. Server-side Turnstile binds a verified pass to one caller identity before paid operations. See `docs/security-boundaries.md` for the bounded guest-token and distribution model.

## Starter authorship

The sample starter arrays in `packages/game-rules/index.ts` are development fixtures, not verified human contributions. Production team inventory is a separate reviewed bundle, initially empty. Prepare a Mana Bottle Kitchen export with at least twenty human-written, reviewed, unique lines per each of seven prompts, then run `npm run starters:check -- /path/to/export.json`. After content review/moderation, `--install` installs a complete human-team bundle in source only. Review the diff, deploy, and explicitly opt in with `DRIFT_STARTERS_HUMAN_WRITTEN=true`. An environment flag alone cannot relabel development examples as human. Draft exports never install. Structural validation catches word/character counts, duplicate prompt IDs, Unicode/case-equivalent lines and obvious contact patterns; it cannot prove authorship or replace moderation. Samples remain tagged in stored cards and exports even if server settings later change. If production has neither a peer bottle nor approved starters, it preserves the setup and offers an honest retry instead.

## Owner operations

`npm run ops:activity` reads private UTC-day counts for committed stories and deduplicated author open/export/share reports. No unique-visitor tracking is added; client reports are best effort and do not prove recipient delivery or social benefit. Daily totals expire after thirty days. See [activity meanings and boundaries](docs/activity.md).

Claude calls now reserve estimated USD before dispatch and reconcile observed token usage before accepting model output. Unknown billing keeps its hold for owner review. The initial application budget is $10, separate from the 1,000-dispatch cap; it is not the provider account balance. `npm run ops:usage -- --calls` reads named owner diagnostics through the existing CLI login. `npm run cost:report` reprices saved evaluation usage without new calls. See [budget behavior and limitations](docs/ai-budget.md).

The database owner can call `admin_status` for dispatch/cap/failure counts, `admin_reports` for the private unresolved queue, `resolve_report` with a report ID and `dismiss` or `hide`, `set_pause`, `set_dispatch_cap`, and `purge_old_data`. These operations are checked on the server; they are not a general admin dashboard. A viewer report hides a card for that viewer while preserving its publication for the authors unless the owner resolves it by hiding.
