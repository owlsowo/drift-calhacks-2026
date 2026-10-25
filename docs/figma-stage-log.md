# Drift — Figma stage log

This records a late-stage interaction iteration, after the main game already worked. Approximate minutes are Codex's active-time estimates for this iteration, excluding unattended waits; they are not a time-savings experiment. Ratings are Codex's assessments, not attendee feedback. Each stage is under 200 words.

## Ideation — approximately 3 minutes — 4/5

We used the owner's QQ/WeChat bottle references and existing React game to identify an empty-sea recovery and returned-story recognition problem. Figma was not used for the original product idea. A later owner request added daily-game inspiration: the actual Krillion entry screen informed numbered daily identity and primary-action hierarchy. Wordle informed familiar daily patterns, but its browser page was blocked and not inspected. These scoped briefs became Make inputs; we preserved the intimate sea and human six-word collaboration.

## Prototyping — approximately 8 minutes — 3/5

Figma Make initially produced shore, empty-pool, returned-bottle and postcard states using existing licensed photos. The first empty state was too tall/opaque, so a second prompt requested a compact note and persistent sample labeling. Tonight's v3 added a fifth Writing state, dated identity and word slots. We entered five words, then six, and completed the sample postcard. Review found reversed authorship on that path; a v4 correction was verified for both writing and returned-story paths. Make reported 51 seconds for v3 and 17 seconds for v4, distinct from active review time. A long typing timeout required replacing an unsent partial draft with paste. After v4, Figma reported exhausted daily AI credits; no upgrade was purchased. No live API or attendee testing occurred inside the prototype.

## Handoff — approximately 4 minutes — 4/5

We selected the compact empty note, write/retry actions and red ribbon/wax seal for returned stories. The later Make iteration informed dated identity, catching as the primary action and six visible word-count marks. Codex implemented those choices in existing components instead of copying the prototype wholesale. We retained the connected 1.9-second paper mesh rather than Make's suggested shorter animation, and rejected hard truncation at six words and synthetic autofill for the real game. Revised handoff notes recommend preserving over-count drafts with feedback. Commit `2544990` links the initial iteration to code; `5043061` implements tonight's daily polish. Full working notes preserve friction and adoption decisions.

## Code generation — approximately 14 minutes — 4/5

Codex edited React/CSS in the existing repository; Make generated the separate sample prototype. Isolated production-mode empty-database checks verified 360px/1440px recovery without consuming a round and draft persistence. Tonight's build, 22 unit tests, nine actual WebKit checks, 22 Chrome two-writer checks, ten Chrome shore checks and both empty-state viewport flows passed. Selected accessibility scans found no violations; screenshots were visually inspected. Concurrent local database creation initially failed; a sequential fresh-room rerun passed. Commit `5043061` was pushed and deployed to Cloudflare, and both hosted entry assets matched the tested build. No backend migration or paid calls were needed. A subsequent code-only refinement adds quiet returned-story notices without taking draft focus. Physical phones and attendee outcomes remain unverified. Seven source slides were imported through Figma's PowerPoint importer; an eighth native slide contains a tested playable Make embed. Presentation preparation took approximately 10 additional active minutes, separate from code generation. Source remains private, so judge access still needs arranging.

## Artifacts

- [Figma Make — Anyone can view](https://www.figma.com/make/4Sk3BHNmaGuxH17B36jAxP/Drift-Bottle-Interaction-Prototype)
- [Required Figma Slides — Anyone can view](https://www.figma.com/slides/aIXkdSqeFH9r8mXu7qI6zv/Drift-idea-to-working-tide)
- [Live game](https://drift-game.drift-calhacks-2026-owlsowo.workers.dev)
- [Working code / private repository](https://github.com/owlsowo/drift-calhacks-2026)

Education verification was visible in Figma. File sharing is Anyone/can view. The prototype is not published to Figma Community: the free plan required a separate Creator Agreement for that publication. It is available through file sharing. A 2:31 video draft with actual workflow screenshots is now complete for team review; upload and embedding the files in the actual Devpost submission remain. See `docs/video-handoff.md`.
