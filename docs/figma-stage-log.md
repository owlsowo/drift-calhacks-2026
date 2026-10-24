# Drift — Figma stage log

This records a late-stage interaction iteration, after the main game already worked. Approximate minutes are Codex's active-time estimates for this iteration, excluding unattended waits; they are not a time-savings experiment. Ratings are Codex's assessments, not attendee feedback. Each stage is under 200 words.

## Ideation — approximately 2 minutes — 4/5

We used the user's QQ/WeChat bottle references and the existing React game to identify two unresolved moments: an empty sea and recognizing a returned story. Figma was not used for the original product idea. The scope was deliberately small: preserve the sea, offer an honest next action when inventory is empty, and distinguish a coauthored return from a new catch. This brief became the input to Figma Make.

## Prototyping — approximately 4 minutes — 3/5

Figma Make produced four inspectable states: shore, empty pool, returned bottle and postcard. We supplied existing licensed photos and explicitly ruled out generated imagery, fake activity and live API calls. Browser inspection found the first empty state too tall and opaque at the narrow preview width. A second prompt requested a compact paper note, shorter copy and a persistent prototype/sample label. The revised retry displays a pending state and remains empty. We inspected the returned-bottle/open/close paths. A cached preview frame initially complicated browser inspection. The writing action remains a prototype placeholder that returns to shore; actual writing lives in Drift.

## Handoff — approximately 3 minutes — 4/5

We selected the compact “The water is quiet” note and write/retry actions, plus the red ribbon/wax seal reserved for completed returned stories. The Make chat records the recommendation and revision. Codex implemented those decisions in Drift's existing components, rather than copying the prototype wholesale. We retained the existing connected 1.9-second paper mesh; Make's suggested 1.1-second opening was not automatically adopted. Commit `2544990` connects the prototype discussion to implementation and tests.

## Code generation — approximately 5 minutes — 4/5

Codex edited React/CSS in the existing repository; Figma Make generated the separate interaction prototype. An isolated production-mode empty database verified 360px and 1440px flows: catching and retry consume no daily round, the note offers a working writing path, and a draft survives reload through the resume control. Automated accessibility checks passed those states. The implementation was deployed to Cloudflare/Maincloud and the real hosted empty state was inspected. Working code remains private; judge access still needs arranging. Seven source slides were imported through Figma's normal PowerPoint importer and inspected. An eighth slide was added natively with a playable Make embed; its empty-state interaction was tested inside the actual presentation. Preparing, importing and embedding the presentation took approximately 10 additional active minutes; that is presentation work, separate from code generation.

## Artifacts

- [Figma Make — Anyone can view](https://www.figma.com/make/4Sk3BHNmaGuxH17B36jAxP/Drift-Bottle-Interaction-Prototype)
- [Required Figma Slides — Anyone can view](https://www.figma.com/slides/aIXkdSqeFH9r8mXu7qI6zv/Drift-idea-to-working-tide)
- [Live game](https://drift-game.drift-calhacks-2026-owlsowo.workers.dev)
- [Working code / private repository](https://github.com/owlsowo/drift-calhacks-2026)

Education verification was visible in Figma. File sharing is Anyone/can view. The prototype is not published to Figma Community: the free plan required a separate Creator Agreement for that publication. It is available through file sharing. The final <=3-minute video and embedding these files in the actual Devpost submission remain to do.
