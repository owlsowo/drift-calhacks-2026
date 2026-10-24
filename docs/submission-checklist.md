# Drift — tracks and submission checklist

Checked October 24, 2026 against the Devpost listing, organizer guide and Figma brief. The public listing and rules were rechecked that afternoon; detailed sponsor requirements below retain the earlier brief review. These are target entries, not submitted or confirmed awards.

## Target portfolio

| Track | Drift's case | Material outside product integration |
| --- | --- | --- |
| Best Use of Spacetime | Authoritative catches, shared state, atomic completion and immediate postcard return | Explain the backend's essential role in the Devpost/README; show two identities and a return without refresh. The published guide does not prescribe a separate essay or word limit. |
| Anthropic — Claude for Public Benefit | Moderation and optional guidance that preserves human authorship | Name a specific community; describe a problem the team has lived or learned from someone affected; show a usable solution; explain Claude's role and failure risks. These are judging expectations, not a prescribed four-document submission. |
| Meta — Bringing People Closer Together with AI | Two people make something together; AI helps participation | Explain the connection mechanism, why AI matters, originality and the working demo. The guide does not prescribe a separate writeup format or require a Meta model. |
| Best People-First Social Impact Hack | A low-pressure, anonymous creative exchange | Explain who benefits, the barrier addressed, consent/privacy/accessibility choices and limits of existing evidence. This is our recommended supporting narrative, not an additional published essay requirement. |
| Most Creative Project | A revival of QQ/WeChat drift bottles as a daily six-plus-six-word ritual | Explain the original inspiration and our contribution; show the physical interaction and coauthored artifact. No separate published essay requirement found. |
| Hacker's Choice | A memorable experience other hackers can try | A working link, clear project image and concise demo. No separate published writeup requirement found. |
| Overall awards | A complete project with intentional UX and engineering depth | Main Devpost submission and demonstration. First/second/third are placements, not three independent integrations. |
| Best Figma Workflow Hack | Actual Make iteration, implemented handoff and native Slides deck with playable embed | Stage log, Education verification and file access recorded. The 2:31 video draft needs team review/upload and files need embedding in the submission. |
| Best Use of Mana | Working Bottle Kitchen app, public build chat and real export-to-validator handoff | The submission draft contains the concrete paragraph and public links; actual app/export gates appear in the video draft. Final category fields/upload remain. |

Beginner is conditional on the team's eligibility. Notability, Commit Fellowship, domain and Vultr are not committed entries. Commit would require team interest, category opt-in and its supplemental form; Notability requires genuine contemporaneous use. We have not established an entry-count cap or prize-stacking policy.

## Common submission bundle

- Devpost project description: inspiration, what it does, how it was built, challenges, accomplishments, lessons and next steps. This structure is a practical drafting plan; the visible portal fields govern the final submission.
- Project image and GitHub repository link are explicitly required by Devpost. Give judges source access while keeping the repository private.
- Working public app URL and a clear demo video. Devpost allows a prerecorded or live demonstration; its judging criteria also call for a meaningful video for asynchronous sponsor review. The organizer guide expects a live demo at judging.
- The 2:31 video draft is complete for review. It distinguishes recorded local two-identity behavior from separate hosted Claude evidence, and includes Spacetime/Figma/Mana work and image credits. See `docs/video-handoff.md`; review/upload are still pending.
- Select the relevant prize categories in the actual submission form and answer any extra sponsor fields it presents.
- Deadline: Sunday October 25, 2026, 9:00 AM Pacific. Be at the assigned judging table for the full 10:30 AM–12:30 PM window.

## Figma — explicit extra deliverables

1. Demo video, maximum three minutes.
2. Workflow artifact / stage log, maximum 200 words PER STAGE. Cover ideation, prototyping, handoff and code generation, accurately identifying where Figma was used and where other tools were used.
3. Figma Slides demonstrating the work and workflow — explicitly required.
4. Embedded Make/prototype files, accessible to Anyone, plus a working code/repository link.
5. Education verification.

For each stage record: tool/product and why, approximate minutes, effectiveness rating 1–5, how the output reached the final project, and relevant friction/rework. Do not invent timing, initial Figma usage, interviews or measured time savings. A later design iteration is valid when described honestly.

The actual stage log is complete in `docs/figma-stage-log.md`, with the same workflow represented in the native Slides deck. These are Codex estimates/ratings for a later iteration, not measured time savings or attendee feedback:

| Stage | Actual tools and why | Approx. minutes | Rating 1–5 | Output used in Drift | Friction |
| --- | --- | --- | --- | --- | --- |
| Ideation | Owner references + existing app; Figma was not the original ideation tool | ~2 | 4 | Scoped empty/returned states | Late-stage scope only |
| Prototyping | Figma Make | ~4 | 3 | Four inspectable states; compact empty note | First version too tall/opaque; cached frame |
| Handoff | Make recommendation + code review | ~3 | 4 | Empty recovery and returned-story seal in `2544990` | Retained existing mesh rather than adopting timing blindly |
| Code generation | Codex React/CSS; separate Make prototype | ~5 | 4 | Tested/deployed game update; native Slides/embed | ~10 additional active minutes for presentation work |

The detailed Figma brief lists Best Design, Most Creative, Best Figma Workflow and Best Stage Log, while current Devpost exposes one Best Figma Workflow Hack entry. Prepare the full artifact bundle; do not count four confirmed separate entry slots without clarification.

## Mana — explicit evidence, flexible writing format

- Say where Mana helped. One concrete paragraph is our drafting choice; the guide does not specify a paragraph count or word limit.
- Provide one or two public Mana pages/chats used during the build, such as the working companion app and its development chat.
- Demonstrate one specific moment where Mana changed what was built or accelerated it.
- If pursuing the inside-Mana bonus, provide a working app/agent a judge can open and use.

The concrete paragraph and artifact links are in `docs/workflow-checkpoint.md` and `docs/submission-draft.md`. The actual synthetic draft validates structurally and is refused for installation; all human lists remain empty. Mana's own reported test counts are distinguished from the independent browser checks.

## Human input still needed

- Devpost draft link, teammate details and eligibility. The public overview lists ages 18+, college students and teams of 2–4; the team must confirm its actual eligibility/check-in and resolve any applicable exception with organizers. Beginner eligibility is separate.
- A short, truthful account of who this is for and a problem the team has personally experienced. Do not invent an attendee interview or claim reduced loneliness without evidence.
- Human-written starter lines if we want populated production inventory. Development samples remain labeled as samples.
- Final review of the writeup, public workflow sharing and judge access to the private code.

`docs/judge-handoff.md` provides the evidence map and local source-snapshot command. Creating that ZIP does not grant source access or submit the project.

No additional account login is established as necessary for this target portfolio now that Figma and Mana are available.

## Sources

- [Current prize list, requirements and deadline](https://cal-hacks-13-0.devpost.com/)
- [Organizer guide: Anthropic, Meta, Spacetime, Mana and judging](https://docs.google.com/document/d/1RQrueC9wm5u8uxtWSC2gadIchp05hVayhGUrIjxT9dE/edit)
- [Figma submission brief](https://docs.google.com/document/d/1HjzThDGveSLiilIdEPEHq12ZVLZ5eS0T8CQC5_m_-rg/edit)
