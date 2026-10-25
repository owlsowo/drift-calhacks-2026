# Drift evidence ledger

Product baseline: `ef6849229833a951d5eda5c1e0295c955081f27c`, inspected October 24, 2026, Pacific time. This ledger reconciles the earlier guide with the product now implemented. It separates existing recorded behavior from the checks run while preparing this package.

## Product and service claims

| Claim used in the submission | Supporting record | Scope |
| --- | --- | --- |
| A writer can catch before writing, seal a card immediately, and optionally give afterward. | [catch-first.json](evidence/catch-first.json) | Actual local database and browser test; synthetic writers; sandbox; AI off. |
| Claude moderation, a contextual nudge, canonical publication, live return, and PNG export have worked on the hosted service. | [hosted-smoke.json](evidence/hosted-smoke.json), [live release](evidence/live-release.md) | Real hosted services with synthetic inputs. This precedes Turnstile activation and the catch-first revision. The synthetic card was hidden afterward. |
| The hosted service enforces the bot gate. | [hosted-gate.json](evidence/hosted-gate.json) | Real Siteverify rejected a forged token; an unverified identity could not start a round. No successful normal-user challenge flow is established. |
| Catch ownership, privacy and duplicate publication are enforced. | [live-invariants.json](evidence/live-invariants.json), [local tests](evidence/local-checks.json) | Local synthetic network checks and server harness tests. Not a load test or proof of production-wide reliability. |
| Collection, export, recovery, reporting, and author hiding work in the tested flow. | [ui-smoke.json](evidence/ui-smoke.json) | Local browser fixtures. Some older UI captures include test-only hello; none of those hello images is used in this gallery. |
| Keyboard/button routes, reduced motion, and graphics fallback accompany shaking. | [shore-interactions.json](evidence/shore-interactions.json) | Synthetic browser gestures and sensor permission events. No physical-phone sensor test. |
| Automated accessibility checks passed in the documented states. | [accessibility.json](evidence/accessibility.json), [frontend review](evidence/frontend-review.json) | Tested states/viewports only. The recorded frontend review includes references to other repository evidence; those are historical source references, not extra files promised in this archive. No assistive-technology user study. |
| A 50-case live synthetic evaluation returned 50 valid outputs; moderation matched 35 of 36 labels. | [evaluation](evidence/model-evaluation.json), [cases](evidence/model-cases.json), [live release](evidence/live-release.md) | Development labels and Codex review of 14 hints. The conservative mismatch withheld harmless instruction-like text. Contract validity is distinct from moderation accuracy, usefulness, and human review. |
| Hourly retention, private raw state, server-side gating and request limits are implemented. | Current server source; [live release](evidence/live-release.md) | Implementation plus bounded tests. Guest identities can be recreated; application retention does not retract downloaded copies or specify provider retention. |

The source repository is [owlsowo/drift-calhacks-2026](https://github.com/owlsowo/drift-calhacks-2026). It remains private. The source-access handoff is an owner task, and this archive is a submission-material package rather than a code release.

## Checks during package preparation

| Check | Result |
| --- | --- |
| `npm run test:server` | 43 passed. Current count exceeds the older README’s 42. |
| Equivalent unit suite via `node --import tsx --test` | 14 passed. The `npm test` wrapper hit sandbox IPC permission denial before running tests; the direct equivalent ran successfully. Full command and distinction are in `local-checks.json`. |
| `npm run build` | Passed TypeScript and Vite production build. |
| `npm run check:server` | Passed. |
| `npm run check:scripts` | Passed. |
| Gallery QA | All five final PNGs rendered and visually inspected; dimensions, file sizes and source hashes recorded in `package-manifest.json`. |
| PDF QA | Four pages rendered and visually inspected; text extraction checked for missing glyphs and expected content. |
| Package QA | Local Markdown link targets checked; archive integrity and absence of video/environment files verified. |

Model calls, hosted mutations, attendee tests and phone tests were not repeated for this packaging task. Existing evidence is copied without changing its timestamps or implying a new run. The reviewed product screenshots are preserved in `source/screenshots/`; their selection and cropping do not create new functionality evidence.

## Gallery provenance

| Output | Existing source | Treatment |
| --- | --- | --- |
| 01 thumbnail | `docs/evidence/hosted-postcard.png` | Full actual hosted Canvas export, scaled and slightly rotated within a branded composition. Synthetic example, live checks. |
| 02 daily prompt | `docs/evidence/home-1440.png` | Actual local screenshot; cropped to shore/prompt/dock. Environment label repeated outside the crop. |
| 03 contribution | `docs/evidence/reply-1440.png` | Actual local reply screenshot, cropped to the writing action. Its prior write-first sidebar is part of the source capture; the current main route is catch-first. |
| 04 shared result | `docs/evidence/catch-first-reveal-360.png` and `returned-bottle-1440.png` | Actual captures from the same local test; crop of B’s card alongside A’s returned-bottle indicator. Still images alone do not establish timing. |
| 05 architecture | Current claim/request/publication implementation | Original diagram, not a screenshot. Model call outside transaction; authoritative recheck and atomic publication. |

## Claims kept out

No attendee adoption, enjoyment, friendship formation, loneliness reduction, production scale, guaranteed safety, physical-phone verification, active meetup capability, verified production starter authorship, or completed Figma/Mana/Notability workflow is claimed. The public story states the audience and intended benefit as hypotheses. No category entry, eligibility, organizer approval, or submitted status is implied.

## Organizer references

The [official event listing](https://cal-hacks-13-0.devpost.com/) and [Devpost submission steps](https://help.devpost.com/article/126-know-your-submission-steps) were checked during preparation. They support the deadline, project image/code/presentation requirements, published prize names, thumbnail format, and platform field list. The [Hive prizes page](https://hive.hackberkeley.org/prizes) is client-rendered and its current detailed brief text was not exposed to the web reader. The linked organizer Google Doc was inaccessible to the reader on this pass; its judging-attendance detail is carried forward from the supplied submission guide and marked for final reconfirmation. Event-specific Additional Details, eligibility, opt-ins and source access must be checked in the registered entry.
