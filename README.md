# Drift

**Six words from you. Six from a stranger.** A mobile web game where two people make a tiny comedy postcard together.

Write a setup, toss it, catch another writer’s setup, and write its ending. Your completed postcard appears immediately; its original author receives it live. A labeled, team-written starter keeps the normal loop moving when attendee inventory is empty. AI guidance never writes either creative line.

## Current status

Implemented locally with React 19, TypeScript, Vite 8 and SpacetimeDB 2.13. The two-browser loop, draft recovery, live returns, PNG export, collection and author hiding have passed a real local-browser smoke test. See `docs/evidence/ui-smoke.json` and screenshots.

**Not yet verified:** live Claude calls, hosted Maincloud deployment, actual phones, attendee outcomes, Figma/Mana/Notability use or sponsor eligibility. Local development is clearly marked and may explicitly disable model checks. This is never evidence of a live AI integration. No attendee pilot has been conducted.

## Local development

Prerequisites: Node 22.12+ (tested here with 26.7), npm, Chrome, and the [SpacetimeDB 2.13 CLI](https://spacetimedb.com/install).

```sh
npm ci
npm ci --prefix spacetimedb
cp .env.example .env
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
npm run check:server
npm run build
npm run test:ui
```

The UI test requires the local database and frontend to be running. It uses synthetic fixtures in isolated browsers, saves screenshots and tests full reload recovery, live returns and downloads. It does not establish model quality or social impact.

## Architecture and boundaries

- The server checks exact word count and character limits. Unicode letters/numbers count; emoji-only chunks do not.
- Private rounds, bottles, requests, reports, ownership and counters cannot be queried by other writers. Caller-specific views expose only permitted progress.
- Only approved anonymous postcard text is public. Either author can hide it; hiding deletes the public projection.
- Catching is transactional. Each bottle has a claimant, version and absolute ten-minute lease. A late model callback rechecks those values before publication.
- Paid operations persist a bound request before dispatch, enforce round/global quotas, and finalize separately. Duplicate IDs do not spend again; reusing an ID for changed content fails.
- Publication of the pair, consumed claim, completion state and ownership finalize atomically.
- Setup moderation runs before delivery; pair moderation runs before postcard publication. Uncertain or malformed responses withhold text and preserve drafts.
- Only the database owner can pause dispatch/publication or invoke the purge reducer. The application cap starts at 1,000 dispatches, including uncertain calls. Provider budget alerts are a separate control.

Retention is a policy plus an owner-run `purge_old_data` reducer: seven days for submitted request text and bottles; thirty days for cards, reports and rounds. Automatic scheduling is not configured. Hiding cannot retract downloaded images or screenshots.

## Competition evidence

See `docs/competition.md` for the track plan and evidence gaps. The product targets a playful first interaction for first-time event attendees; this remains a hypothesis. Screenshots, automated test identities and starter content must never be represented as real pilot participation.

The October 21 illustrated prototype and earlier planning documents informed direction. This implementation was started during the event on October 24, 2026. The older prototype’s code and scripted demo are not used as evidence of live functionality.
