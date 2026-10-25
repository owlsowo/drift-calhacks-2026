# Theme-aware Claude coaching checkpoint

The coach now asks for a short, everyday comic direction that respects the actual scene and speaker, rather than defaulting to office language. It keeps the player's draft open and explicitly forbids completing it. The production model remains Sonnet 5.5; moderation is unchanged.

## Why the evaluation changed

The original fourteen nudge fixtures mostly asked for the institution's official response, including spaceship cases. That did not match the live game's captain-defense instruction and biased the test toward formal language. The live server already supplied the correct prompt; this was an evaluation coverage gap, not a production prompt-routing bug.

Nine additional cases now cover all seven current themes plus embedded instructions and fake contact details in the draft. Their payload uses the actual `instructions.setup`, `instructions.reply`, `setup` and `draft` shape. The runner checks theme text against `PROMPTS` before spending. Older fixtures and outputs remain for historical comparison; they were not relabeled as current gameplay contexts.

Each new run records the system instructions, contract version, fixture-set hash, synthetic inputs and available usage even when parsing fails. Raw rejected text is retained for diagnosis. Neither request headers nor the API key is recorded.

## Real calls and the parser decision

Two nine-call runs used real Sonnet responses. Each originally accepted eight outputs and rejected one useful 19-word aquarium hint under an experimental 18-word parser ceiling. Those errors remain in the original result files.

The final prompt still requests a short clause of 8–14 words with an 18-word writing limit. The receiver allows **8–24 words and at most 220 characters**, preserving direction prefixes and the existing no-quote/contact/HTML/newline checks. This gives word-count headroom instead of spending a player's attempt on a harmless one-word overrun. Hints are never truncated or silently rewritten. The minimum also excludes a finished six-word game line, although length and prefix checks alone cannot establish that all guidance preserves human authorship.

The second run's system prompt matches the deployed candidate verbatim. Offline revalidation of its stored JSON accepts all nine responses under the final receiver. This is **nine real responses plus an offline parser check**, not nine new successful live evaluations. The first run used a different prompt and is reported separately.

| Final-prompt sample | Agent-reviewed result |
| --- | --- |
| Actual themes | All seven represented |
| Lengths observed | 13–19 words |
| Grounded in the scene | 9/9 |
| Gives a finished game ending | 0/9 observed |
| Follows the injection / echoes fake email | Neither observed in the two adversarial cases |
| Useful direction | 7/9; the two cafeteria-context hints were generic |

These are Codex judgments on synthetic development cases, not independent human labels, a model comparison or a moderation-quality claim. The hints often still use the same “treat the absurd as ordinary” technique. More variety and human review remain useful; no further component calls were made after the existing 80-dispatch evaluation allowance was reached.

## Deployment and verification

The backend published to the existing Maincloud database without a schema migration. Twenty-two unit tests and fifty-one server tests pass, including the word-count boundaries, real over-target regression, answer-writing rejection, paid-attempt accounting and participant-data isolation. Server/scripts typechecks and the production build pass. Frontend JavaScript/CSS were unchanged by this server-only update.

One owner-only fixed synthetic health check then passed through the actual deployed Sonnet request, parser and accounting path. It published no bottle or postcard. Its hint was:

> Try treating the shark's poker challenge as a perfectly normal, serious incident the aquarium has handled before.

The owner probe is deployment evidence, not another nine-case evaluation or a two-device gameplay test. Its usage is in `docs/evidence/coach-hosted-usage.json`. The prior hosted two-browser flow remains separately recorded.

## Evidence

- `evals/results-2026-10-24T22-21-05-552Z.json`: first candidate, one retained parser failure.
- `evals/results-2026-10-24T22-22-14-878Z.json`: final system prompt, one retained strict-parser failure.
- `docs/evidence/coach-review.json`: offline receiver revalidation and per-case agent judgments.
- `docs/evidence/evaluation-costs.json`: all eighty component dispatches, $0.064694 estimated for seventy-nine with saved usage; one earlier attempt still has unknown billing. Excludes application/owner use and other account activity.

The original fifty-case moderation/hint run and its 35/36 synthetic moderation agreement remain unchanged; these additional runs evaluate coaching only.
