# Drift Demo Script

Target length: about **2 minutes 40 seconds**, leaving room below Figma's three-minute limit. Prepare a two-minute live version by shortening the explanation after the postcard returns.

The video follows one round in order. The highlight is a completed postcard appearing on both writers' screens. Use real teammate contributions, label the environment accurately, and keep a continuous capture across sealing and return. The current 50-second silent sandbox MP4 is a backup or editing source, not proof of live Claude or attendee outcomes.

## Before recording

- Choose the actual submitted build. Verify whether Claude is configured and tested; the script has two branches below.
- Use an isolated demonstration database with a clean queue and two independent guest identities. Both people submit their own setup; Writer B then catches Writer A's. Do not demonstrate against an attendee database or imply that staged teammates are independent pilot users.
- Use two readable browser windows or phones, labeled Writer A and Writer B. Keep enough resolution to read the six-word lines.
- After A tosses, leave A on **My postcards**. B's completion updates that collection live; A can then open “Your bottle came back” without refreshing. The app does not automatically switch A from catching to a full reveal.
- Have humans choose their own setup and ending. Keep any sample/starter labels visible if those sources are used.
- Disable mutual hello in the main demo unless the submitted release actually enables it and its location is verified.
- Remove keys, private account panels, and unrelated desktop content from the recording area. Include narration or captions; the existing recording is silent.

## Recorded walkthrough

| Time | On screen | Suggested narration |
| --- | --- | --- |
| 0:00 to 0:08 | Tease the finished postcard, with each half labeled by writer. | “Six words from you. Six from a stranger. One little story you made together.” |
| 0:08 to 0:22 | Today's prompt on a phone-friendly screen. | “We wanted to give event attendees a small creative task before an introduction. Drift starts with a shared daily prompt.” |
| 0:22 to 0:38 | Writer A types their six-word setup and tosses it. | “Write six words and toss your bottle. You contribute a beginning; somebody else gives it an ending.” |
| 0:38 to 0:53 | Writer B's own setup is submitted, then B catches A's. | “Every player contributes before catching. Another writer's anonymous beginning arrives here.” |
| 0:53 to 1:10 | B types a partial human draft, then uses the appropriate Claude branch below. | Live branch: “If you get stuck, Claude can suggest a direction using this setup and your draft. The ending stays yours.” |
| 1:10 to 1:35 | B finishes their own ending and seals it. A's open collection updates; A opens the returned card. Keep both screens visible without refreshing. | “Now seal the postcard. It arrives in the original writer's collection live. Open it, and you both have the same finished story.” |
| 1:35 to 1:48 | Save the PNG and show the actual artifact. | “Both writers can keep it, save the image, or share the story.” |
| 1:48 to 2:10 | Small diagram: two browsers, SpacetimeDB, Claude. | “SpacetimeDB owns assignment, private state, and publication. Model checks run outside the transaction. The server rechecks the claim before publishing once and synchronizing both writers.” |
| 2:10 to 2:27 | A concise test result or clearly labeled engineering illustration. | “A late model response cannot publish after the bottle has changed hands. Our local checks cover claim races, private access, retries, and recovery.” |
| 2:27 to 2:40 | Final postcard, Drift name, actual working link if available, and team attribution. | “A stranger starts a tiny story. You finish it. You both keep what you made.” |

The times are an editing plan, not permission to fabricate frames or hide failed operations. Cut long typing waits if useful, while keeping the decisive seal-and-return interval visibly continuous.

### Claude segment branches

**After real calls are verified:** show one genuine nudge from the current assigned setup/draft, then the human's independently written ending. Describe contextual setup/pair moderation as the safety path, and show the actual recorded result or an explicitly labeled test example. Useful output needs human review; a successful HTTP response alone does not establish helpfulness.

**If still in sandbox:** retain the visible sandbox notice. Replace the nudge segment with a brief explanation: “This local demonstration has AI checks off. The server-side Claude moderation and guidance integrations are implemented; live provider evaluation is still pending.” Continue into the actual working shared-card flow. Label the Claude connection in the architecture image “Implemented integration; calls disabled in this recording.” Do not insert invented AI output or an animation implying a real check ran.

## Live two minute version

1. Spend about 15 seconds on the prompt and promise.
2. Spend about 65 seconds on two real contributions, catching, sealing, and the live return.
3. Spend about 20 seconds on the artifact and how SpacetimeDB makes it shared.
4. Spend about 20 seconds on Claude's verified role or its honest pending status, then invite the judge to try a fresh input.

Keep one extra minute ready for questions about claims, privacy, model failures, and what is still unverified. Store a backup recording locally for venue connectivity problems, while remaining ready for the required live demonstration.

## Gallery order

1. **Hero:** the completed postcard and the short tagline. Make the two separate contributions visually obvious.
2. **The daily action:** prompt plus setup field.
3. **The surprise:** caught setup plus a human reply.
4. **The proof:** both writers receiving the same completed card.
5. **The engineering:** one small architecture image, if it adds clarity.

Recapture from the actual submitted build. Existing exports have a localhost footer, and some existing reveal screenshots show hello enabled only for tests. Keep accurate provenance and avoid unsupported pilot or live-AI claims.

## Recording and export checks

- Voice is understandable; all essential steps also have readable labels or captions.
- No terminal wall, long logo intro, or sponsor list delays the game reveal.
- Every sentence of narration matches what is on screen and what actually ran.
- The video is within the chosen limit and retains a local copy.
- The hosted link works signed out, permits embedding, and plays inside the Devpost preview.
- The page, video, thumbnail, and live pitch use the same product name and interaction story.

The timing reference is the [FaceTimeOS first-place demo](https://www.youtube.com/watch?v=zN96RdE0OSg): its narration moves into a demonstration by 0:18 and reaches task confirmation near 1:42. Drift should use that economy while showing its own interaction honestly.
