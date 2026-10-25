# Drift

**Six words from you. Six from a stranger.**

Drift is a daily story game inspired by the old QQ and WeChat drift bottles. Pick up someone's six-word beginning, write a six-word ending, and keep the postcard you made together.

[Play Drift](https://driftbottle.ink/) · [Figma and Mana workflow](docs/workflow-checkpoint.md) · [Deployment details](docs/deployment.md)

## How to play

1. **Pick up** a bottle. Shake it with your cursor, or use the tap/keyboard controls, to open the note.
2. Write an ending in exactly six words.
3. The finished story returns to both writers. Save it as an image, share its link, or send your co-writer a private thank-you.

Use **Release** to leave your own beginning. Several people can write different endings for the same bottle. **My bottles** holds your beginnings and returned stories, including a link to the other endings. The daily prompt changes, and each guest gets up to three rounds a day.

Phone motion is optional. The game also supports keyboard controls, paused animation and reduced motion.

## Built with

- **React, TypeScript and Vite** for the web app.
- **SpacetimeDB** for catches, private progress, shared stories, voting and live updates between writers.
- **Claude** for moderation, optional writing hints and arranging approved artwork into postcard illustrations. People write both six-word lines.
- **Cloudflare Workers and Turnstile** for hosting, HTTPS and server-checked human verification.
- **WebGPU** for the moving sea, using the bundled MIT-licensed Noniv FFT ocean engine. Devices without WebGPU get a coast artwork fallback.

We used **Figma Make and Slides** to prototype interactions and document the design process. **Mana** helped build Bottle Kitchen, a separate tool for preparing and reviewing starter lines. Its app, build chat and tested export handoff are linked in the [workflow notes](docs/workflow-checkpoint.md).

## How the shared story works

SpacetimeDB gives each writer a timed assignment. Claude's check runs outside the database transaction; before saving the result, the server checks the writer, assignment and deadline again. The completed postcard then appears for both writers through subscriptions.

Each accepted ending also queues a postcard illustration. Claude chooses and positions pieces from a fixed art catalog. It cannot add new story text, remote assets or executable markup. If illustration generation fails, the original words and sharing remain available.

Unfinished drafts stay in the browser. The server keeps ownership, reports and other private state behind caller-specific views. Either co-writer can hide a completed pair; the original writer can withdraw a beginning and its replies. See [security and privacy details](docs/security-boundaries.md), [retry recovery](docs/hint-retry-context.md) and [author withdrawal](docs/author-withdrawal.md).

## Run locally

You need Node.js 22.12+, npm and the [SpacetimeDB 2.13 CLI](https://spacetimedb.com/install).

```sh
npm ci
npm ci --prefix spacetimedb
test -f .env || cp .env.example .env
```

For real Claude calls, add `ANTHROPIC_API_KEY` to the root `.env`. Without a key, local publishing enables a labeled sandbox with model checks off. Keep `.env` out of Git.

Start the database in one terminal:

```sh
spacetime start --listen-addr 0.0.0.0:3000
```

In another terminal, publish the module and start the app:

```sh
npm run db:publish:local
npm run db:generate
npm run dev
```

Open `http://localhost:5173`. Use separate browser profiles or incognito contexts for two writers; tabs in the same profile share a guest identity.

Server model settings are `MODERATION_MODEL`, `NUDGE_MODEL` and `SCENE_MODEL`. The defaults are Claude Haiku 5.5 for moderation and Sonnet 5.5 for hints and illustrations. API keys stay on the server.

For a hosted frontend, set the public values `VITE_SPACETIMEDB_HOST`, `VITE_SPACETIMEDB_DATABASE` and `VITE_TURNSTILE_SITE_KEY` in `apps/web/.env.local`. Never prefix a secret with `VITE_`. Follow the [deployment guide](docs/deployment.md) for production publishing and verification.

## Checks

```sh
npm test
npm run test:server
npm run check:server
npm run check:scripts
npm run build
npm run test:letters
DRIFT_TEST_ENGINE=webkit npm run test:letters
npm run test:pickup-flow
```

Browser checks need the local database and Chrome. Install WebKit with `npx playwright install webkit` for WebKit runs. The test runner creates disposable local databases and uses synthetic writers; it does not call the live game's database or paid models.

The current recorded release passed 63 unit tests and 133 server tests. Browser checks cover writing, live returns, saved drafts, bottle opening, voting and image downloads. The [domain deployment report](docs/evidence/owned-domain-deployment-2026-10-25.json) records the published versions, asset checks and HTTPS verification.

Physical-phone checks, an attendee pilot and independent human review of moderation quality remain incomplete. Automated and synthetic tests do not establish those outcomes. Production team-starter inventory is still empty; the bundled samples are development fixtures.

## Hosting and saved bottles

The primary address is **[driftbottle.ink](https://driftbottle.ink/)**. The [original address](https://drift-game.drift-calhacks-2026-owlsowo.workers.dev/) stays available for existing players. Guest identity and saved history belong to each browser origin, so the new domain opens its own shelf. Shared bottle links can still be opened by anyone with the link.

## More detail

- [Artwork sources and licenses](docs/asset-sources.md), including the team-approved AI coast artwork and credited paper photograph.
- [Navigation and draft recovery](docs/navigation-and-recovery.md).
- [Model budget and owner controls](docs/ai-budget.md).
- [Figma and Mana files, stage log and workflow evidence](docs/workflow-checkpoint.md).
- [Illustration contracts and art catalog](packages/scene-contracts/index.ts).
- [Release history and test records](docs/team-progress.md).

The optional mutual-hello feature is disabled by default. It requires both writers to opt in and the owner to verify a public meeting point before enabling it; see the [security notes](docs/security-boundaries.md#hello).
