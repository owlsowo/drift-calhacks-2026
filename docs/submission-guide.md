# Drift Submission Guide

> **Current submission materials:** the [polished package](submission/README.md), prepared October 24, updates the product/evidence status below to the `ef68492` build: catch-first gameplay, hosted Cloudflare/Maincloud, real Claude checks, Turnstile enforcement, and scheduled retention. The original guide below retains its `de623f4` research baseline. Use the package’s [evidence ledger](submission/evidence-ledger.md) and [owner checklist](submission/owner-checklist.md) for current readiness. Video is excluded from this preparation task.

Prepared October 24, 2026, Pacific time. Implementation baseline: local checkout `de623f4`. This package prepares the entry; it does not submit to Devpost, upload media, change repository visibility, or claim sponsor eligibility.

Present Drift as **a daily co-op writing game where two strangers turn two six-word contributions into a postcard they both keep**. Lead with the completed human artifact, demonstrate the exchange that created it, then explain why its shared state and AI boundaries are difficult to implement well.

The strongest proof is one continuous moment: Writer B finishes Writer A's setup, seals the postcard, and the same result appears on Writer A's screen without a refresh. That gives the game, its human purpose, and its real-time engineering a single visible outcome.

## Materials and deadlines

### Event requirements

| Item | Required preparation | Source |
| --- | --- | --- |
| Deadline | Submit by **Sunday, October 25, 2026, 9:00 AM Pacific**. A complete initial entry Saturday night is recommended. | [Cal Hacks overview](https://cal-hacks-13-0.devpost.com/), [Hacker Guide](https://docs.google.com/document/d/1RQrueC9wm5u8uxtWSC2gadIchp05hVayhGUrIjxT9dE/edit) |
| Eligibility | Accepted and checked in; be at the venue by 8:00 AM Sunday. Implementation belongs to the event hacking period. Earlier ideation is allowed. | [Overview](https://cal-hacks-13-0.devpost.com/), [Hive FAQ](https://hive.hackberkeley.org/faq) |
| Team information | Actual teammates, team name, and current table/location. Keep the judging assignment accurate when received. | [Guide](https://docs.google.com/document/d/1RQrueC9wm5u8uxtWSC2gadIchp05hVayhGUrIjxT9dE/edit), [FAQ](https://hive.hackberkeley.org/faq) |
| Summary | A two- or three-sentence elevator pitch. | [FAQ](https://hive.hackberkeley.org/faq) |
| Project image and code | A project image and GitHub repository link. | [Overview](https://cal-hacks-13-0.devpost.com/) |
| Demonstration | Prepare a working live demo and include a meaningful video for asynchronous sponsor review. | [Overview requirements and functionality rubric](https://cal-hacks-13-0.devpost.com/), [Guide](https://docs.google.com/document/d/1RQrueC9wm5u8uxtWSC2gadIchp05hVayhGUrIjxT9dE/edit) |
| Judging attendance | Entire team at its assigned table **10:30 AM to 12:30 PM Sunday**. | [Guide](https://docs.google.com/document/d/1RQrueC9wm5u8uxtWSC2gadIchp05hVayhGUrIjxT9dE/edit) |

The overview permits recorded or live demonstration, while the Guide explicitly calls for live demonstration. Prepare both. Its three-minute pitch plus two-minute questions slot also accommodates the Guide's recommended two-minute core pitch. The table assignment may arrive after the submission deadline even though the FAQ requests location in the entry: include the current location and update the assigned table when permitted.

The 2025 submission deadline, editing extension, table rules, and presentation length do not carry over to 2026.

### Devpost fields and media

Prepare the project name, tagline, story, technology tags, teammates, repository URL, demo URL, gallery images, video URL, and any event-specific prize choices. Devpost describes a 140-character tagline and up to 25 technology tags. A thumbnail should use JPG, PNG, or GIF, stay below 5 MB, and preferably use a 3:2 aspect ratio. Host an embeddable, publicly viewable video on YouTube or Vimeo and test playback while signed out. [Devpost submission steps](https://help.devpost.com/article/126-know-your-submission-steps), [submission configuration](https://help.devpost.com/article/145-how-do-i-set-up-the-submission-period)

These are platform fields, not proof of every event-specific requirement. The [actual Cal Hacks submission area](https://devpost.com/submit-to/29871-cal-hacks-13-0/manage/submissions) currently shows a registration prompt in the available signed-out session. The Additional Details fields, prize entry limits, and review-access instructions therefore still need inspection by the registered entry owner. A global three-minute video maximum was not found; use a video under three minutes to satisfy Figma's explicit limit as well.

The current GitHub repository is private. The event requires its link; a universal public-repository or license requirement was not established. Resolve judge access with the owner and organizers. Do not assume an inaccessible link is useful, or change visibility without the owner's authorization. Devpost's generic examples of public-code and license questions are not Cal Hacks rules.

### Packaging recommendations

Prepare one complete package with:

1. The [Devpost draft](devpost-draft.md), revised to match the submitted release.
2. A narrated or captioned video of approximately 2 minutes 40 seconds, following the [demo script](demo-script.md).
3. A 3:2 gallery thumbnail: the real finished postcard, two labeled contributions, and Drift's tagline.
4. Four supporting images: the daily prompt, caught setup/reply, completed card on both devices, and one small architecture diagram.
5. An accessible working URL if deployment is finished; otherwise accurate local demo/setup instructions.
6. The code link and README explaining setup, service use, known limits, and which evidence is local or synthetic.
7. A locally stored backup video and two ready demonstration devices or isolated browser profiles.

The image count and architecture diagram are presentation recommendations, not extra organizer mandates. The first gallery image should communicate the product without requiring someone to read a system diagram.

## What the Cal Hacks 12.0 winners suggest

The following awards are verified from the project-page badges. The analysis concerns their current written entries, which may have changed since judging. These are presentation observations, not proof that a particular storytelling technique caused the award.

| Entry and award | Presentation observation | Application to Drift |
| --- | --- | --- |
| [FaceTimeOS](https://devpost.com/software/facetime-macos-ai-agent), First Overall | A familiar situation leads to an easily described interaction and visible task confirmation. Technologies have specific roles, followed by concrete integration challenges. | Explain the interaction in a sentence, then show a postcard arriving on both devices. Connect backend components to that observable behavior. |
| [Ted.AI](https://devpost.com/software/ted-ai-x8537t), Second Overall | A recognizable teddy bear and specific intended audience make the product easy to picture. Its description moves from sensed input to response and dashboard. | Use the bottle and postcard consistently. Show what each writer gives and receives. Do not borrow unsupported health or social-impact claims. |
| [Project No Cap](https://devpost.com/software/project-no-cap), Third Overall | Several features share a single concern about misinformation. Its challenge section describes scope cuts and integration tradeoffs. | Keep one purpose across the game, optional hints, and shared result. Favor a short concrete walkthrough over a broad list of capabilities. |
| [Bob](https://devpost.com/software/bob-vj43mq), Most Creative Hack | Physical-work assistance is followed by a specific technical data path and implementation obstacles. | Show engineering depth through claim ownership, live return, and stale-response handling rather than the number of services. |
| [Expungo](https://devpost.com/software/clearpathai), Greatest Social Impact and Promise Public Impact | A beneficiary's problem connects to a sequence of actions ending in usable output. Technical roles support those actions. | Explain the small task Drift enables for attendees and end on its artifact. Include actual pilot observations if collected. |
| [Elda AI](https://devpost.com/software/elda-ai), Best Use of Claude | Personal motivation and distinct responsibilities make the AI role legible. | Demonstrate one real contextual moderation or coaching example, then state its limits. A model logo is not evidence of a useful integration. |
| [Love Island To Die For](https://devpost.com/software/love-island-to-die-for), JanitorAI Functional Novel and Fun | Its premise, player objective, constraints, and revelations explain the game before its implementation. | Teach the verbs first: write, toss, catch, finish, reveal. Make the reveal the main event. |
| [CleanGetaway](https://devpost.com/software/cleangetaway), JanitorAI Functional Novel and Fun | Shared conversations and multiplayer state support its game mechanics; labeled images help explain them. Its long entry also contains editorial leftovers. | Use a small amount of technical evidence and carefully edited prose. Winning entries are references, not templates to copy indiscriminately. |

### First place video timing

The [FaceTimeOS video](https://www.youtube.com/watch?v=zN96RdE0OSg) is 2:02 long. Its auto-generated narration establishes the problem and promise in the first 18 seconds, introduces the demonstration at 0:18, starts the call around 0:35, describes screen sharing at 0:54, gives the task at 1:00, and confirms completion around 1:42. The opening frame also states the product interaction plainly. This timing analysis uses the captions and opening frame; it is not a frame-by-frame analysis of all the videos.

The transferable lesson is to spend most of the short presentation on an intelligible task reaching a visible result. Drift should give judges something they can repeat afterward: two writers, twelve words, one shared postcard.

## A coherent story for Drift

**Project name:** Drift

**Tagline:** Six words from you. Six from a stranger.

**Two-sentence summary:** Drift is a daily co-op writing game where two strangers turn two six-word lines into a postcard they both keep. Write a beginning, catch someone else's, and finish their story.

The intended audience is first-time event attendees who would enjoy a small creative interaction before an introduction. Describe that as the community and design hypothesis until interviews or a pilot substantiate the need.

Use one causal sequence throughout the page, gallery, video, and live pitch:

1. **An easy first action:** today's shared prompt and a six-word setup.
2. **A human surprise:** another writer's setup arrives anonymously.
3. **A small contribution:** the player invents its six-word ending, optionally using a verified AI hint.
4. **A shared result:** one canonical postcard returns to both writers.
5. **A keepsake:** save or share the actual postcard.

Explain the implementation after that sequence: React provides the mobile browser experience; SpacetimeDB owns assignment, publication, private views, and synchronization; the Claude integration checks contextual safety and can suggest a writing direction. People supply both creative lines.

The current build allows three rounds daily and awards one daily stamp. Do not describe it as strictly one attempt per day. Keep original profile matching, drawing, generated artwork, and disabled physical meetups out of the main story. The optional hello flow can be a clearly labeled future/disabled capability in questions if relevant.

### Where to show engineering depth

Use one example: a model finishes checking a reply after its bottle has expired or been reassigned. The system rechecks the claim and refuses stale publication. This explains why reliable collaboration needs more than a pair of text boxes and an API call.

A compact architecture visual needs only two browsers, SpacetimeDB, and Claude. Show the model call outside the database transaction, followed by a transactional recheck and publication. Avoid implying that the current implementation has Turnstile, automated retention, a dollar-based budget ledger, or production operation.

## Sponsor evidence

The current public listing names **Claude for Public Benefit**, **Best Use of Spacetime**, and **Best Figma Workflow Hack**. Earlier notes about those awards being absent or split into five Figma categories are superseded by the [updated listing](https://cal-hacks-13-0.devpost.com/).

| Route | Evidence to prepare | Current readiness |
| --- | --- | --- |
| Spacetime | Explain authoritative game state, exclusive catches, transactions, and subscriptions; demonstrate the two-device return. | Strong software fit. Local implementation exists; hosted operation remains unverified. |
| Anthropic | Name the community and real need; show a working Claude contribution and explain failure handling. | Conditional on live model calls, reviewed outputs, and actual community evidence. |
| Meta | Show a meaningful human interaction and how AI contributes to it. | Conditional. A small real pilot and useful live hint would strengthen the case. |
| People-First | Show what attendees actually did and whether they enjoyed or wanted to continue the interaction. | Themed fit, but no participant outcome evidence yet. |
| Figma | Prepare the required workflow artifacts for real Figma work. | No completed workflow evidence established in the repository. |

The first four rows apply the published [Hive sponsor briefs](https://hive.hackberkeley.org/prizes) to Drift; the readiness judgments are ours. They do not require changing the product into an agent, adding another database, or attaching irrelevant sponsor services.

### Figma extras

If entering Figma, prepare its **video of at most three minutes**, **stage log of at most 200 words per stage**, and **required Figma Slides** with the workflow, demo, embedded Make/prototype work, and code link. Files must be accessible to Anyone and the team education verified. Cover ideation, prototyping, handoff, and code generation; record the tools, reasons, approximate minutes, usefulness rating from 1 to 5, and how outputs reached the final project. [Figma brief](https://docs.google.com/document/d/1HjzThDGveSLiilIdEPEHq12ZVLZ5eS0T8CQC5_m_-rg/edit)

Record genuine work and rework. Do not invent a design history, timing, ratings, or Agent use after the fact. Public submission files should contain only project material intended for that audience.

## Existing assets and remaining work

Paths in this table are relative to the repository root.

| Asset | Existing file | Recommended treatment |
| --- | --- | --- |
| Product recording | `docs/evidence/local-sandbox-demo.mp4` | 50.08-second silent, 1280 by 720 sandbox recording. Keep as a labeled backup/excerpt; create the final narrated video separately. |
| Provenance | `docs/evidence/demo-run.json` | Records synthetic browser-driven writers and AI checks off. Preserve those distinctions. |
| Home screenshots | `docs/evidence/home-1440.png`, `home-360.png` | Useful composition references; recapture the final release and retain truthful environment labels. |
| Reply screenshots | `docs/evidence/reply-1440.png`, `reply-360.png` | Good support for the collaborative action. |
| Reveal screenshots | `docs/evidence/reveal-1440.png`, `reveal-360.png` | Existing capture includes hello from test configuration. Recapture without implying that disabled feature is live. |
| Exported card | `docs/evidence/postcard-export.png` | Strong artifact reference; current footer is localhost. Use a fresh export from the submitted build. |
| Architecture | `docs/architecture.md` | Convert its central idea into one readable supporting image if useful. |
| Test evidence | `docs/evidence/live-invariants.json`, `ui-smoke.json`, `accessibility.json` | Technical evidence, not attendee or social-impact evidence. |

The current sandbox can demonstrate actual local database collaboration. It cannot demonstrate real Claude output, hosted availability, or attendee benefit. The final narration must match the environment on screen. If live AI remains unavailable, use the honest integration wording in the draft and reconsider AI-specific entries rather than simulating a provider response.

### Claims that can be used now

- A local React/SpacetimeDB game with completed postcards, private participant state, reconnect, reporting, author removal, and PNG export.
- Six rule/model-contract tests and 36 server tests passed during local setup, along with type checks and the production build.
- A local browser round was completed. The repository also contains recorded synthetic two-browser evidence.
- Server-side Claude integration is implemented, while its real operation and output quality remain unverified.

Claims about users enjoying the game, new friendships, reduced loneliness, production scale, useful live hints, or sponsor qualification require additional evidence.

## Production order before submission

1. Open the actual Devpost entry early, inspect its Additional Details fields, and fill team/location information. Do not wait on a polished video to create the draft.
2. Decide the submitted release and its precise evidence status. Verify live Claude before recording any AI segment.
3. Run the two-writer flow in a clean demonstration room with real teammate contributions. Capture the continuous live return and export.
4. Make the narrated/captioned video, thumbnail, and selected screenshots. Check every public link signed out.
5. Finish applicable Figma deliverables and real pilot notes if those activities occur. Keep claims proportionate to what was observed.
6. Review code access, story, category choices, team membership, and location; preview the rendered entry; submit before the deadline and verify its submitted status.

The remaining organizer questions are narrow: actual category opt-in/stacking limits, the accepted code-access path for a private repository, and how to update a table assigned after submission. Team-size metadata also conflicts with the Guide/FAQ on solo entries; resolve that only if the team is solo. No outreach or submission was performed as part of preparing this package.
