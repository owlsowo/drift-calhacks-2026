# Drift

**Six words from you. Six from a stranger.** A mobile web game where two people make a tiny comedy postcard together.

Shake to catch another writer’s beginning, add a six-word ending and keep the shared postcard. Then optionally toss your own beginning for the next person. A write-first route is also available. Your completed postcard appears immediately; its original author receives it live. The production design supports human-written team starters when peer inventory is empty. Current fallback lines are clearly labeled development samples; production will not silently use them. AI guidance never writes either creative line.

## Current status

Implemented locally with React 19, TypeScript, Vite 8 and SpacetimeDB 2.13. The official module harness passes 43 transaction/privacy/failure tests. Eighteen rule/model-contract/gesture/draft/CSP/schedule/starter-export tests pass. Automated accessibility scans pass the tested writing, reply, reveal, hello, collection, shared-card, loading, pause and offline states at mobile and desktop viewports. The two-browser loop, draft recovery, live returns, PNG export, collection and author hiding pass local-browser smoke tests. See `docs/evidence/ui-smoke.json`, `content-states.json`, `live-invariants.json` and `frontend-review.json` with screenshots.

The WeChat/QQ bottle-inspired shore supports cursor shaking, opt-in phone motion and keyboard/button alternatives. Water and moonlight ripple below a fixed horizon; the sea can be paused and stops when the page is hidden or reduced motion is requested. Caught notes loosen into one continuous creased sheet, settle flat and reveal the writing. Small native WebGL surfaces reuse the credited photographs; static sea and CSS note fallbacks work without WebGL. All photographic assets are human-made; see `docs/asset-sources.md`. Ten browser interaction checks cover sea pixel movement/pause, shaking, permissions, catch recovery, keyboard focus, reduced motion and graphics fallback using synthetic inputs. Physical-phone sensor behavior still needs verification.

**Live checkpoint:** Cloudflare HTTPS and Maincloud are deployed. A real hosted two-browser Claude flow and server-side Turnstile negative checks passed; see `docs/live-release.md`. **Not yet verified:** actual phones, attendee outcomes, Figma/Mana/Notability use or final sponsor eligibility. Local development is clearly marked and may explicitly disable model checks. This is never evidence of a live AI integration. No attendee pilot has been conducted.

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
npm run test:ui
npm run test:a11y
npm run test:shore
npm run eval:models -- --dry-run
```

The integration tests require the local database server. Each creates a disposable database and, for browser tests, its own frontend; cleanup leaves the main development database alone. They use synthetic fixtures in isolated browsers, save screenshots and test full reload recovery, live returns and downloads. They do not establish model quality or social impact. `test:live` probes concurrent claims and access controls; `test:states` injects loading, pause and offline failures.

`npm run demo:rehearse` discovers and exercises the recording flow in a disposable local sandbox. After it passes, `npm run demo:record` records two isolated browser identities and assembles a 1280×720 MP4 in the task’s `outputs/` folder. Chrome, Playwright’s FFmpeg helper (`npx playwright install ffmpeg`) and a system `ffmpeg` are required. The video is visibly labeled as synthetic sandbox participation with model checks off. It is a product demonstration, not live AI or attendee evidence. The recorded checkpoint and its provenance are in `docs/evidence/local-sandbox-demo.mp4` and `demo-run.json`. See `docs/deployment.md` for the real release handoff.

## Architecture and boundaries

- The server checks exact word count and character limits. Unicode letters/numbers count; emoji-only chunks do not.
- Private rounds, bottles, requests, reports, ownership and counters cannot be queried by other writers. Caller-specific views expose only permitted progress.
- Only approved anonymous postcard text is public. Either author can hide it; hiding deletes the public projection.
- Catching is transactional. Each bottle has a claimant, version and absolute ten-minute lease. A late model callback rechecks those values before publication.
- Paid operations persist a bound request before dispatch, enforce round/global quotas, and finalize separately. Duplicate IDs do not spend again; reusing an ID for changed content fails.
- Publication of the pair, consumed claim, completion state and ownership finalize atomically.
- Setup moderation runs before delivery; pair moderation runs before postcard publication. Uncertain or malformed responses withhold text and preserve drafts.
- Only the database owner can pause dispatch/publication or invoke the purge reducer. The application cap starts at 1,000 dispatches, including uncertain calls. Provider budget alerts are a separate control.

An hourly private maintenance schedule enforces seven days for submitted request text and bottles, and thirty days for cards, reports and rounds. It also purges orphaned hidden-card author mappings and expired hello details. Browser drafts expire seven days after the latest edit. The owner can also run `purge_old_data` manually. Hiding cannot retract downloaded images or screenshots.

## Competition evidence

See `docs/competition.md` for the track plan and evidence gaps. The product targets a playful first interaction for first-time event attendees; this remains a hypothesis. Screenshots, automated test identities and starter content must never be represented as real pilot participation.

The October 21 illustrated prototype and earlier planning documents informed direction. This implementation was started during the event on October 24, 2026. The older prototype’s code and scripted demo are not used as evidence of live functionality.

## Optional hello

The mutual hello feature is implemented and disabled by default. To enable it, the human owner must physically verify a public meeting point and set server environment values `DRIFT_HELLO_ENABLED=true`, `DRIFT_MEETING_SPOT=<public label>` and `DRIFT_MEETING_SPOT_VERIFIED=true`, then republish. It is available only for cards made by two guest identities, not team starters. It expires ten minutes after postcard creation. Withdrawal or hiding cancels access. The private recognition phrase is absent from public data and exports.

Cloudflare static hosting is deployed and actual HTTPS headers were verified. The CSP does not allow unsafe-eval; the browser SDK uses a tested interpreted serialization adapter. Server-side Turnstile binds a verified pass to one caller identity before paid operations. See `docs/security-boundaries.md` for the bounded guest-token and distribution model.

## Starter authorship

The sample starter arrays in `packages/game-rules/index.ts` are development fixtures, not verified human contributions. Production team inventory is a separate reviewed bundle, initially empty. Prepare a Mana Bottle Kitchen export with at least twenty human-written, reviewed, unique lines per each of seven prompts, then run `npm run starters:check -- /path/to/export.json`. After content review/moderation, `--install` installs a complete human-team bundle in source only. Review the diff, deploy, and explicitly opt in with `DRIFT_STARTERS_HUMAN_WRITTEN=true`. An environment flag alone cannot relabel development examples as human. Draft exports never install. Structural validation catches word/character counts, duplicate prompt IDs, Unicode/case-equivalent lines and obvious contact patterns; it cannot prove authorship or replace moderation. Samples remain tagged in stored cards and exports even if server settings later change. If production has neither a peer bottle nor approved starters, it preserves the setup and offers an honest retry instead.

## Owner operations

The database owner can call `admin_status` for dispatch/cap/failure counts, `admin_reports` for the private unresolved queue, `resolve_report` with a report ID and `dismiss` or `hide`, `set_pause`, `set_dispatch_cap`, and `purge_old_data`. These operations are checked on the server; they are not a general admin dashboard. A viewer report hides a card for that viewer while preserving its publication for the authors unless the owner resolves it by hiding.
