# Workflow checkpoint — October 24, 2026

Target entries include **Figma and Mana**, alongside Spacetime, Anthropic, Meta, People-First, Most Creative, Hacker's Choice and Overall. Workflow artifacts are in progress; account access is not completion.

## Figma: actual late-stage iteration

[Make file](https://www.figma.com/make/4Sk3BHNmaGuxH17B36jAxP/Drift-Bottle-Interaction-Prototype)

Around 14:02–14:06 Pacific, Figma Make produced four inspectable interaction states from a sanitized brief: shore, empty pool, returned bottle and postcard. The agent inspected the empty state in the browser. The first version was too tall and opaque at the narrow preview width; a second prompt requested compact real-paper feedback, less copy, a persistent sample label and honest retry behavior. Make produced that revision. Its own build report says it passes; this is not an independently verified production backend.

Concrete handoff into Drift: compact “The water is quiet” feedback with write/retry actions over the existing sea, and the returned-story wax seal/ribbon distinction. The implementation stays in Drift's existing state/animation architecture. No new generated images were used. The prototype uses existing licensed assets and sample text, clearly labeled. The original game predates this Figma session; do not claim Figma was used for initial ideation or the whole codebase.

Outstanding: independent inspection of all prototype paths, accessible sharing, stage log with actual approximate timings/ratings, required Figma Slides and final <=3-minute video. Figma's detailed brief and current Devpost category mapping differ.

## Mana: useful content-preparation companion

[Development chat](https://www.mana.space/home/uZUAnp4vMmhOcc7s846yMqttA8V2?chatId=001792875075719b18054a2b85b4dcba093)

The actual logged-in user workspace is building Drift Bottle Kitchen. It is a local-browser tool for humans to write, review and export starter lines. It must begin empty, distinguish draft from attested human-team exports, enforce the seven-theme/six-word contract and never publish directly to the game database. An earlier send in the sponsor's read-only workspace failed; we moved to the user's workspace. Do not describe that failed attempt as a completed build.

Concrete core handoff: `packages/starter-content` and `scripts/check-starters.ts` validate this export format. Complete human-team exports may be installed into a separate source bundle; incomplete/draft exports cannot. Production checks the installed inventory in addition to the owner's environment opt-in, preventing a flag from relabeling the development examples as human.

Outstanding: verify the working Mana app, exercise invalid input/export gates, obtain public app/chat evidence and show a specific useful workflow moment. Human content and moderation review still require humans; neither the app nor the checker proves authorship.
