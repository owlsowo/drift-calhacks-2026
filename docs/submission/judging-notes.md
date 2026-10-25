# Drift — live judging notes

Prepared October 24, 2026. This is the current catch-first presentation. It supersedes older write-before-catch walkthroughs. No video is included in this package.

## Two-minute pitch

The words below are spoken copy. Bracketed directions are presenter cues. Rehearse once against actual provider latency; the core proof is the continuous seal-and-return moment.

**0:00–0:20 — the promise**

“Six words from you. Six from a stranger. Drift is a daily co-op writing game where two people make a tiny comedy postcard together.

“Our idea is to give first-time event attendees something small to make together before asking them to introduce themselves. That is our design hypothesis; we have not run an attendee pilot.”

**0:20–1:10 — the exchange**

[Keep two separate browser identities visible. A has already tossed the demonstration setup; B is on the shore.]

“This is a staged two-writer demonstration. Our first browser has left a six-word beginning. The next writer can catch it immediately.”

[B selects **Pick up a bottle**. Read the actual setup.]

“You get someone else’s beginning and add exactly six words of your own. If you are stuck, the optional Claude nudge suggests a direction. It does not supply the finished ending.”

[B enters the prepared synthetic reply. Select **Seal our postcard**. Keep A’s collection visible throughout; open the returned card after it arrives.]

“When we seal it, both writers receive the same postcard. Watch the original writer’s collection: it arrives without a refresh.”

**1:10–1:40 — why the engineering matters**

[Show the returned card on both browsers, then **Save image**.]

“SpacetimeDB owns the catch, the private participant state, and the final publication. Claude checks the setup and completed pair, with optional writing guidance. Both creative lines stay human-written.

“Model calls happen outside the transaction. Before publishing, the server checks that the same writer still owns the same unexpired catch. A late model response cannot publish an obsolete story.”

**1:40–2:00 — the result**

“We have demonstrated real hosted SpacetimeDB and Claude calls with synthetic writers, and tested claim races, privacy, retries, and failures. We are still verifying normal-user access through the newly enabled bot check and physical-phone behavior.

“The thing we want to test next is simple: does making one little joke together make a first interaction easier? Two writers, twelve words, one shared postcard.”

**Environment branch:** Use the Claude action only after a successful fresh rehearsal on the chosen release. For a local sandbox presentation, keep its notice visible, skip the nudge action, and replace the AI sentences with: “This local demonstration has model checks off. Separately, a hosted synthetic test completed real Claude moderation and guidance before the bot gate was enabled.” Do not narrate a call as live while it is disabled.

## Thirty-second pitch

“Drift is a daily co-op writing game: six words from you, six from a stranger, one postcard you both keep. Catch an anonymous beginning, write its ending, and watch the result arrive in both collections. SpacetimeDB makes the catch and live return authoritative; Claude checks context and offers optional guidance while people write both lines. We are testing whether a tiny shared joke can make a first interaction easier. The software works in staged tests; attendee benefit is our next question.”

## Deterministic two-browser demonstration

This is a staged demonstration with synthetic content, not an attendee study. Use an isolated demonstration database with an empty peer queue, no production starter attestation, and two fresh browser identities. Two tabs in one ordinary profile share an identity and cannot stand in for two people. Use isolated profiles or browser contexts. Leave mutual hello disabled.

### Preflight

1. Confirm the release, frontend origin, connected database, current daily prompt, and whether the visible sandbox notice is expected. Keep both browsers on the same prompt and avoid the UTC date rollover during the demonstration.
2. For a hosted demonstration, complete the real bot check in **both** browsers and rehearse the full path before the judging slot. The recorded hosted success preceded Turnstile enablement; the subsequent gate test proved rejection, not normal-user success. Do not call the current access path verified until the positive rehearsal succeeds.
3. Set browser zoom so both six-word lines and A’s collection are readable. Use the dock button or keyboard activation for a repeatable catch; phone motion is optional and has not been verified on a physical phone.
4. Have the matching pair below ready to type. These are synthetic demonstration lines whose original human authorship is not established. Do not call them spontaneous attendee contributions or label a development fixture as an attested team starter. For a live demonstration with actual human-written content, replace them with two new six-word contributions during rehearsal.

| Prompt shown by the server | A’s six-word beginning | B’s six-word ending |
| --- | --- | --- |
| Banned from the aquarium | I challenged their shark to poker. | Our lawyers would like another hand. |
| One very suspicious spaceship | Our captain replaced gravity with glitter. | The glitter was an emergency feature. |

Each line has exactly six words. For another daily prompt, prepare and count a matching pair during rehearsal. Do not change the public clock or invent an aquarium prompt when the server shows another day.

### Run of show

| Step | Writer A | Writer B | What this proves |
| --- | --- | --- | --- |
| 1. Leave one real peer bottle | Select **Write my six words**, enter the chosen setup, then **Toss my bottle**. Wait for success. | Stay on the shore; do not submit a setup. | A uses the supported write-first route to supply inventory. |
| 2. Prepare the return | Open **My postcards** in the top navigation. Leave this view visible. | Select **Pick up a bottle**. | B catches before writing; in this empty queue A is the only eligible peer. |
| 3. Verify the assignment | Keep the collection open. | Read the caught text and confirm it exactly matches A’s line. If a different or sample line appears, stop and reset the demonstration room. | The card will connect these two identities. |
| 4. Optional real nudge | Keep the collection visible. | On a rehearsed live-Claude release only, type a short draft, select **A little nudge**, and read the actual result. Then enter the prepared ending. | Genuine contextual guidance; the nudge does not populate the ending. |
| 5. Seal and return | Keep A visible without refreshing. | Select **Seal our postcard** and wait. | The pair is checked and published. A’s collection updates through its subscription. |
| 6. Open the same artifact | Open the new returned card from the collection. | Leave the completed card visible. | Both authors see the same two lines. A does not automatically navigate to a full reveal. |
| 7. Keep it | Show the matching card. | Select **Save image** and open the actual PNG. Then select **Keep this story. Maybe later.** if ending the round. | A real keepsake; leaving a new beginning is optional. |

The post-reveal **Toss my own bottle** action is an optional continuation. Do not demonstrate it as a prerequisite for B to receive or keep the postcard. A can wait for the return without finishing another bottle first. Complete the assignment within its ten-minute lease; reset with fresh identities if it expires or the daily quota is exhausted.

## Questions judges may ask

**What is the problem, and who has actually asked for this?**  
The target is first-time event attendees who might prefer a small shared creative task before an introduction. That is a hypothesis from the product direction, not a validated finding. No attendee pilot or interview result is claimed. A next pilot should observe whether people complete the exchange, understand the collaboration, and want to play again.

**Why six words?**  
It bounds the effort for each participant and gives both people an equal visible contribution. The server enforces exactly six words and a 160-character limit. Whether six is the best constraint still needs user testing.

**What does Claude do? Are the jokes generated?**  
Claude Haiku 5.5 checks submitted beginnings and completed pairs; Sonnet 5.5 offers optional guidance grounded in the assigned beginning and current draft. Humans supply both six-word lines. The application validates model output and withholds publication on uncertain, malformed, or failed checks. This is a model-assisted safety boundary, not a safety guarantee.

**Have real Claude calls worked?**  
Yes. A hosted synthetic two-browser test completed setup moderation, a real nudge, pair moderation, live return, and PNG export. It ran before Turnstile was enabled. A later test confirmed that forged tokens and unverified identities are rejected; normal-user positive access through that gate remains unverified in the recorded evidence.

**How did you evaluate the model?**  
The revised 50-case synthetic run produced 50 valid outputs. Moderation matched 35 of 36 development labels; the remaining case conservatively requested review for harmless instruction-like text. Codex reviewed 14 hints for grounding, contact-data leakage, and writing a complete ending. The hints remained guidance, but tone can be bureaucratic. These are development labels and agent review, not independent human evaluation.

**Why SpacetimeDB?**  
The database owns the shared game rather than just storing finished text. Transactions grant exclusive catches, enforce caller ownership and leases, and finalize the pair with its authors and completion state. Caller-specific views protect private progress; subscriptions deliver the published result to both browsers. The external model call is followed by a transaction that rechecks the claim before publication.

**What happens when two people catch at once, or an AI response is late?**  
A bottle has one active claim with a version and ten-minute absolute lease. Publication rechecks the caller, claim, version, and deadline. An expired or reassigned bottle cannot be published by the old callback. Request IDs also bind operations to their content: replays do not dispatch again, and changed content cannot reuse an ID.

**What happens if nobody else is playing?**  
Production prefers peer bottles. Verified human-written team starters are supported, but the current arrays are development samples and are not attested production inventory. Without peers or attested starters, the app preserves the setup and asks the writer to retry. The demonstration uses A’s real submitted bottle to make that dependency visible.

**Is it anonymous and private?**  
There is no profile or contact exchange in the main loop. Guest identities reconnect through a token stored in the browser; that is not proof of one human per account. Raw gameplay, ownership, requests, and reports are private on the server. Approved postcard text is public and shareable, so writers should not put personal details in it. Either author can hide a card; hiding cannot retract downloaded images or screenshots. Model checks send the relevant submitted text to Claude.

**How long do you keep things?**  
The implemented hourly maintenance removes submitted request text and bottles after seven days, and cards, reports, and rounds after thirty days. Browser drafts expire seven days after their latest edit. These are application retention controls, not a claim about provider retention or somebody else’s saved copy.

**Can people meet or exchange contacts?**  
The optional mutual hello capability is implemented and disabled in this release. It requires both authors to opt in and an owner-verified public meeting point. It is outside the main submission claim.

**What works, and what is still missing?**  
The two-writer loop, exclusive claims, private views, live return, PNG export, author hiding, and recovery have local test evidence. A real hosted Claude loop also passed with synthetic writers. The current positive bot-gate flow, physical-phone sensors, independent moderation assessment, and attendee outcomes still need verification. Automated accessibility scans support the tested states; they do not replace assistive-technology testing.

## Fallbacks without video

| Failure | Honest live response |
| --- | --- |
| Venue internet or hosted bot gate blocks play | Switch to a rehearsed local database and frontend with two isolated identities. Keep the sandbox notice visible and say model checks are off. Demonstrate the real database catch and live return. |
| Claude is slow or unavailable | Let the actual recovery state remain visible. Say publication is withheld and the draft is preserved. If needed, move to the labeled local sandbox for the collaboration proof; do not fabricate an approved result. |
| Queue is empty or catches an unrelated bottle | Return to the isolated empty demonstration room. A tosses first, B catches second. Do not silently substitute a starter for the other browser’s contribution. |
| Browser, database, or display fails | Use the package’s labeled gallery images and exported postcard for a narrated walkthrough. Call them captured synthetic examples and state that the live run is unavailable. A screenshot walkthrough is a fallback, not live-functionality evidence. |

## Internal presenter checklist — do not paste into the public entry

- Keep the two-minute core inside the event’s three-minute pitch slot; retain the remaining time for a judge’s fresh input or latency. The official listing allows two minutes for questions. [Cal Hacks requirements](https://cal-hacks-13-0.devpost.com/)
- The hosted URL is `https://drift-game.drift-calhacks-2026-owlsowo.workers.dev`. Current service evidence is in [live-release.md](evidence/live-release.md), [hosted-smoke.json](evidence/hosted-smoke.json), [hosted-gate.json](evidence/hosted-gate.json), and [catch-first.json](evidence/catch-first.json).
- A clean queue makes the catch deterministic. Do not run a rehearsal that deletes or resets attendee data.
- Keep source access, team members, current location, and final submission status accurate. The repository is private; a repository link by itself does not give judges access.
- Do not imply a physical phone, an attendee study, a friendship outcome, or positive bot-gate verification from browser automation.
