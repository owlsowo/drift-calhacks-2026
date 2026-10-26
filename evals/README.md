# Model checks

These are **synthetic policy examples authored for development**, not attendee data or a human-labeled safety benchmark. A human owner should review the expected labels. They do not measure population-wide safety, humor, friendship, or impact.

Run `npm run eval:models -- --limit 8` after adding a valid key to the untracked root `.env`. The runner uses exactly the request schema, instructions, and output validator used by the server. It runs sequentially, has its own bounded dispatch ledger, never automatically retries ambiguous calls, and records each dispatched request before sending. No key or request headers are written to results.

Use `--dry-run` to validate fixture shape and contracts without paid calls. The default live allowance is at most 80 total evaluation dispatches across runs; `--limit` further bounds a single run. This evaluation ledger is separate from the deployed application's dispatch cap. Keep their combined provider use within the project budget.

The moderation set includes harmless fictional absurdity, contact details, targeted abuse, pair-level meaning, and embedded instructions. Some component-level adversarial probes exceed game length; the live game rejects those in deterministic validation before calling a model.

The nudge set checks grounding inputs and mechanical constraints. Automated validation cannot establish that a hint is helpful or never effectively writes an ending. Read each output and record useful/not useful, grounded/not grounded, and answer-writing/not answer-writing in the result's manual-review fields. Compare candidate models on the same cases before changing defaults.

Never describe dry runs, mock HTTP tests, or unreviewed output as successful live model evaluation.

Use `--kind nudge --limit 14` to run only the 14 nudge cases, or `--ids nudge-1,nudge-injection --limit 2` for a named subset. Dry runs print the exact selected IDs before spending. Filters do not raise the lifetime cap. To compare Haiku and Sonnet, run the same nudge subset with `NUDGE_MODEL=claude-haiku-5-5` and `NUDGE_MODEL=claude-sonnet-5-5`; keep each output and inspect both against the same criteria. Labels and model outputs still need review, and repeated calls may vary.

Nine additional `coach-v2-*` fixtures cover the real payload shape for all seven themes and two adversarial drafts. Their optional `promptId` makes the runner reject stale theme instructions. There are now 59 fixtures: 36 moderation and 23 coaching. Use explicit IDs for a subset; `--kind nudge --limit 14` retains the original first fourteen cases rather than selecting all themes.
