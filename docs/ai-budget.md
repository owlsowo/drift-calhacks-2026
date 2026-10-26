# Claude budget and usage accounting

The application reserves an estimated USD amount transactionally before each provider dispatch. Its default application budget is $10. The existing 1,000-dispatch cap and per-round limits still apply. The database owner can lower the budget to zero or raise it up to $50. Neither number is the provider account's remaining credit balance.

## What is counted

`ai_budget` and `ai_call` are private tables. A call gets an opaque financial ID, model, operation, request byte count, price version, reservation, observed token counts, cost estimate, outcome and server elapsed time. The financial row contains no story text, participant identity or contact details. The private gameplay request maps to this ID for seven days; completed financial details expire after thirty days, while totals remain. Unresolved billing holds remain until the owner reconciles them.

The catalog uses first-party standard/global [Anthropic rates](https://platform.claude.com/docs/en/about-claude/pricing), checked October 24, 2026: Haiku 5.5 $0.10 input / $0.50 output per million tokens for this app's bounded prompts, and Sonnet 5.5 $2 / $10. Integer nanodollars per token and rounded-up microdollars avoid floating-point ledger arithmetic. Known cache buckets are priced as well; an unknown model, billing modifier or invalid usage record is never treated as a free call.

Requests are bounded at 16 KiB and 1,024 output tokens. The reservation includes deliberately conservative tokenizer/wrapper headroom. Provider-reported usage determines the recorded estimate, even when moderation refuses, output parsing fails or the answer arrives too late to publish. An unexpected overrun is recorded in full and prevents further budgeted calls rather than discarding the excess. This is an application control based on reviewed prices, not an invoice guarantee; discounts, taxes, price changes and account use elsewhere require the provider console.

## Failure and replay rules

- Concurrent calls see both estimated spend and existing reservations before dispatch.
- A duplicate request ID returns its saved result without another reservation, charge or HTTP call.
- Known usage settles the call and releases unused reservation headroom before the game decides whether the result may publish.
- A timeout, HTTP failure, missing usage or unrecognized billing modifier keeps the original hold. The application does not guess that the call was free.
- After at least one minute, the owner may reconcile an uncertain/stalled call using the provider console's charge, including zero when confirmed unbilled. A repeated identical reconciliation is a no-op; a conflicting second reconciliation is rejected.
- Old pre-release calls are explicitly shown as older dispatches. The new ledger does not pretend to reconstruct their missing token usage. Component evaluations are separate from application calls.

Latency is elapsed server time from reservation to observed provider response/failure, including intervening transaction work. It is not end-to-end phone latency. Owner percentiles use retained measured external calls; sandbox calls and unmeasured crashes are excluded. Financial totals are cumulative since the recorded start, while individual/token/latency detail follows record retention.

## Owner operations

Run `npm run ops:usage -- --calls` for a named, read-only JSON report using the existing CLI owner login. It never extracts credentials or dispatches model calls.

Use the authenticated database owner and `node scripts/spacetime.mjs call YOUR_DATABASE_NAME <operation> ... --server maincloud`:

| Operation | Arguments | Purpose |
| --- | --- | --- |
| admin_ai_usage | none | Budget, estimated spend, held amount, tracking start, older dispatches and retained usage/latency counts |
| admin_ai_calls | none | Most recent fifty private cost records; no participant text/identity |
| set_ai_budget | limitMicros | Integer USD microdollars; 10000000 means $10, maximum 50000000 |
| reconcile_ai_call | costId, chargedMicros | Settle an unknown/stalled record after checking provider billing; never blindly release a hold |
| admin_probe_claude | moderation or nudge | Fixed synthetic provider health check, at least one minute apart, using the same budget; publishes no bottle/card |

Owner probes are diagnostics and do not require a guest Turnstile pass. They remain owner-only, bounded by the shared budget/dispatch cap, and cannot publish. Ordinary paid game actions still require server verification and valid ownership/claims. Do not automatically retry an ambiguous probe or user request.

