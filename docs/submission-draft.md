# Drift — current submission draft
Checked October 24, 2026. This is reviewable submission copy, not an already-submitted Devpost entry.

## Tagline
Shake a bottle. Finish six words from a stranger. Keep a story you made together.

## Inspiration
We wanted to revive the quiet, physical feeling of QQ and WeChat drift bottles: something small sent out into the world, with no guarantee of who might find it. Drift brings that ritual back as a little daily nonsense. Instead of an open-ended anonymous chat, two people make one tiny story: a six-word beginning and a six-word ending.

Our intended community is first-time college hackathon attendees who want a short creative break without having to introduce themselves or maintain a profile. That is a design hypothesis; we have not interviewed attendees or measured connection outcomes.

## What it does
Catch another writer's beginning by shaking the bottle with your cursor or using the button. Add six words, and the two halves become a postcard both people can keep. The original writer receives it live. After finishing, you can toss your own beginning for the next person, or leave with the story you made. A write-first route is available too.

The sea stays behind the note. Real photographed paper unfolds as a connected creased surface. The sea moves below a stable horizon; motion can be paused, and reduced-motion users get a quiet alternative. Phone shake is opt-in and has drag/button fallbacks; physical sensors still need testing.

There are three rounds per day, seven rotating prompts, no public score and no profile. An empty pool offers an honest write/retry path. We do not invent strangers or silently relabel generated examples as human messages.

## How we built it
React and TypeScript render the game. SpacetimeDB is the authoritative real-time backend: private participant state, exclusive expiring catches, transactional postcard completion, and live delivery to both writers. Only approved anonymous postcard content is public.

Claude Haiku checks beginnings and the combined story before publication. Optional Sonnet guidance suggests an angle without supplying the finished ending. Requests are bound to the writer, text and claim version; duplicate, expired or late results cannot create another postcard. Paid calls have request limits, a global dispatch cap and an estimated-dollar reservation budget. Valid provider usage settles even when output is rejected; uncertain billing keeps its hold for owner review. Private usage/latency diagnostics contain no story text or participant identity.

Cloudflare serves the HTTPS app. Turnstile tokens are verified on the server with hostname/action checks; an identity-bound pass gates game actions. Hourly retention removes expired server data, and local drafts expire after seven days.

## Challenges
Real-time subscriptions and procedure responses can arrive in either order. We made completion recover from a lost acknowledgment and preserved drafts through interruptions. Another challenge was SpacetimeDB SDK serialization using dynamic code generation under a strict content-security policy. We added an interpreted serializer adapter and compared its wire bytes with the SDK while dynamic evaluation was blocked.

The paper needed to feel like one note opening, rather than disconnected tiles. We retained a continuous mesh and a static/CSS fallback for unavailable graphics acceleration.

## What we accomplished and learned
The app is publicly deployed. A hosted two-browser test used real Claude calls and observed a returned postcard without refresh. Fifty-one server tests and twenty-one unit tests pass. Mobile/desktop browser checks cover the tested interaction, accessibility and recovery states. An actual ten-writer run exposed colliding generated round IDs; a transaction-backed allocator fixed them, with forced-collision and real network checks passing afterward.

A fifty-case real model evaluation produced valid outputs after an initial prompt-contract failure was fixed. Moderation matched 35 of 36 synthetic development labels; fourteen hints were reviewed by Codex. This is agent-reviewed synthetic evidence, not an independent moderation-quality study.

Figma Make helped us iterate on empty-sea feedback and returned-story recognition. A native Figma Slides deck contains the stage log, working-code links and playable Make embed. Mana built Bottle Kitchen, a working authoring companion, and an actual export passed into Drift's validator as a draft while being refused for production installation.

## What is next
Real-phone checks, independent moderation review and human-written starter preparation. We would test the first-time-attendee hypothesis before claiming social outcomes. Production runs with peer bottles or an honest empty state until approved human starter content exists.

## Sponsor-specific sections
**Spacetime:** The collaboration depends on authoritative shared state. Catching reserves one expiring claim, completion rechecks ownership/version/deadline, and both writers receive the canonical result through subscriptions. It is the game backend, not a secondary database.

**Anthropic — Claude for Public Benefit:** We designed for first-time hackathon attendees seeking a low-pressure creative break. Claude checks combined meaning and can help a stuck writer find an angle while preserving human authorship. False positives, contextual misses and contact-data leakage are failure risks; the synthetic evaluation records its limitations. The team still needs to add its truthful firsthand account of the problem before submission.

**Meta:** The AI supports a human-to-human activity. Two people contribute to one artifact; neither creative half is automatically generated. The working return demonstrates the mechanism. Lasting friendship or reduced loneliness has not been established.

**People-First:** Explain the anonymous, finite, consent-aware interaction, recoverable drafts and accessible alternatives. Intended benefit is a manageable first shared activity, not a proven social intervention.

**Creative / Hacker's Choice / Overall:** Show the QQ/WeChat inspiration, cursor-shaken bottle, opening paper over the moving sea, and a postcard returning live. Distinguish the revived metaphor from our six-plus-six-word collaboration and authoritative backend.

**Figma:** Link the Make file, native Slides deck and four-stage log. Describe the late-stage iteration honestly. A reviewable 2:31.2 video draft now combines the labeled product recording with actual hosted and workflow evidence; see `docs/video-handoff.md`. Team review/upload remain. The Make file is also embedded on slide 8.

**Mana:** We used Mana to build Drift Bottle Kitchen, a working app for preparing human-written six-word starters. It tracks seven themes, review progress, validation and export provenance without generating lines or contacting our live game. We exercised an actual draft through Drift's CLI; it validated as a draft and was refused for installation. Mana reports 48 core and 15 UI checks; we separately checked the real input/export gates and removed all synthetic content. It cannot prove authorship or replace moderation; human inventory is still empty.

## Links
- Live game: https://drift-game.drift-calhacks-2026-owlsowo.workers.dev
- Private code: https://github.com/owlsowo/drift-calhacks-2026
- Figma Make: https://www.figma.com/make/4Sk3BHNmaGuxH17B36jAxP/Drift-Bottle-Interaction-Prototype
- Figma Slides: https://www.figma.com/slides/aIXkdSqeFH9r8mXu7qI6zv/Drift-idea-to-working-tide
- Mana app: https://www.mana.space/home/uZUAnp4vMmhOcc7s846yMqttA8V2/apps/drift-bottle-kitchen
- Public Mana build chat: https://www.mana.space/shared-chats/uZUAnp4vMmhOcc7s846yMqttA8V2/001792875075719b18054a2b85b4dcba093

## Before submitting
Add the actual team roster, eligibility answers, truthful firsthand motivation, image and final video. Arrange judge access to private code. Embed the Figma files and select categories in the real Devpost form. Confirm entry/stacking rules and the Figma category mapping. Do not describe local sandbox footage as live Claude footage or synthetic identities as attendee testers.
