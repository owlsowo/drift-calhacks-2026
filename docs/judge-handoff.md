# Drift — judge handoff

One person starts six words. Another finishes them. Both keep the postcard.

[Play the deployed game](https://drift-game.drift-calhacks-2026-owlsowo.workers.dev/) · [Private repository](https://github.com/owlsowo/drift-calhacks-2026) · [2:31 video draft and credits](video-handoff.md)

## Try the interaction

Open the app in two independent browser profiles or two devices. Tabs in the same profile share an identity. One writer can use “Write my six words” and toss a fresh beginning; another uses the bottle or “Pick up a bottle,” opens the paper and writes an ending. The finished postcard returns to its original writer without refreshing. Saving creates a PNG; sharing exposes only the approved anonymous postcard.

The real public pool can contain other people's beginnings, so a particular outgoing bottle's return cannot be promised on demand. If the sea is empty, use the honest writing/retry path. There are no invented strangers. For a deterministic rehearsal, use the disposable local demo commands in the README; that sandbox is visibly labeled, has AI checks off and is not hosted-Claude evidence.

Optional Claude guidance suggests an angle; it does not fill the draft. The writer still supplies exactly six words. Motion can be paused; drag, button and keyboard alternatives are available. After finishing, leaving another beginning is optional. A newly returned story offers a quiet open/dismiss notice without replacing the current draft or moving its focus. Previously saved cards do not announce as fresh arrivals on reload. Mutual hello is disabled on this deployment until a real public meeting point is verified.

## Inspect the work

| Question | Direct evidence |
| --- | --- |
| Is Spacetime essential? | `spacetimedb/src/index.ts`, `docs/architecture.md`, exclusive claims, atomic publication, live returns and ten-writer checks |
| Does Claude actually run? | `docs/evidence/hosted-smoke.json`, `docs/coach-evaluation.md`, saved real provider results in `evals/` |
| Are cost/failure boundaries implemented? | `docs/ai-budget.md`, `packages/ai-costs/`, private budget holds and usage reconciliation |
| Does the tactile UI work? | `docs/browser-checks.md`, Chrome/WebKit renders, water pause, paper mesh and PNG export |
| Was Figma really used? | [Make](https://www.figma.com/make/4Sk3BHNmaGuxH17B36jAxP/Drift-Bottle-Interaction-Prototype), [native Slides](https://www.figma.com/slides/aIXkdSqeFH9r8mXu7qI6zv/Drift-idea-to-working-tide), `docs/figma-stage-log.md` and implemented handoff commit `2544990` |
| Was Mana really used? | [Bottle Kitchen](https://www.mana.space/home/uZUAnp4vMmhOcc7s846yMqttA8V2/apps/drift-bottle-kitchen), [public build chat](https://www.mana.space/shared-chats/uZUAnp4vMmhOcc7s846yMqttA8V2/001792875075719b18054a2b85b4dcba093), actual draft export and validator rejection |

The Figma prototype is a later iteration with sample content, separate from the game. Its current v4 includes a sample writing flow, dated identity and path-aware postcard authorship. The earlier video screenshot depicts v2; that historical version had a placeholder writing action. Production permits over-six-word drafts with feedback rather than adopting the prototype's input cap or synthetic autofill. Mana's companion prepares drafts, verifies structure and tracks review; it does not prove authorship or populate the game automatically. Human starter inventory is still empty.

## Source access without changing repo visibility

Run `python3 scripts/package-source.py` to create a small local ZIP pinned to the current Git commit. It includes build sources, lockfiles, game photo assets/credits, tests, documentation and small evidence records. Large evidence screenshots/video remain in the repository and separate review outputs. No dependencies, live env files, database state or Git history are included.

The packager refuses private/runtime paths, symlinks and common credential signatures; it also compares known ignored local secret values in memory. It verifies ZIP integrity and each file's hash. This check is not a guarantee that every kind of private information has been identified. The snapshot manifest names the exact source commit and all included files.

Extract the ZIP, run `npm ci` and `npm ci --prefix spacetimedb`, then `npm run build`. Live calls require the owner's key and configuration; the key is not in the archive. Local integration checks require a running SpacetimeDB server. See the README for sandbox development.

Packaging is local only. It does not upload code, grant judge access or make the repository public. The team still needs to arrange an approved judge access route and include the GitHub link in its submission.

The first verified snapshot is `drift-source-7b51ca3.zip`: 159 files, 572,127 bytes, pinned to `7b51ca32c477becc48c923e239deffe50a603109`. It passed fresh npm installs for both packages, the frontend build, server typecheck and an actual Spacetime module build after extraction with no env files. `docs/evidence/source-snapshot.json` records the commands, results and archive hash. No model call or database publish was needed. A separate local 6 MB team review pack includes the source ZIP plus the video, poster, captions and writeups; its checks cover local links, media/source hashes and ZIP integrity. Neither ZIP is uploaded by this checkpoint.

The preceding verified product snapshot is `drift-source-86683ac.zip`, pinned to `86683ac7982f7ada2ab566412c94e29e21881736`: 170 files, 593,053 bytes, including private activity diagnostics, daily UI polish and the return notice. It also passed fresh root/server installs, frontend build, server typecheck and actual Spacetime module build with no env files or publishing. `docs/evidence/return-source-snapshot.json` records the hash and checks. Earlier bundles remain historical snapshots; do not describe them as the latest product source.

## Evidence limits and remaining team work

The recorded gameplay uses synthetic identities in a local sandbox with AI off. Real hosted Claude evidence is separately labeled. Evaluation labels and coaching judgments are synthetic/agent-reviewed; no attendee pilot, independent moderation-quality study or measured social benefit is established. Desktop WebKit with an iPhone viewport does not verify physical phones, motion sensors, mobile keyboards or OS share sheets.

Review the video/writeup, provide the team roster/eligibility and truthful firsthand motivation, arrange source access, and finish the actual Devpost fields and uploads. No entry has been submitted by this handoff. The source bundle and video are reviewable artifacts, not proof of final eligibility or category selection.

Latest product source: `drift-source-8b98334.zip`, pinned to `8b9833408e9971d6e1f0561e2fb1b7b34560ce7d`, adds earlier-word and expiry/reset recovery. Its 177 files (605,259 bytes) pass fresh installs, frontend build, server typecheck and Spacetime module build without env files. `docs/evidence/recovery-source-snapshot.json` records the checks. The recovery screenshots use explicitly injected UI deadlines; the separate 57-test module suite covers authoritative expiry/reassignment.

Current product source: `drift-source-6beae71.zip`, pinned to `6beae714853b9074986b8f17576c3da48d9238a6`, adds the empty-sea leave/keep flow and ten-route plan. Its 182 files (614,737 bytes) pass clean installs and frontend/server/module builds without env files. `coldstart-source-snapshot.json` records its hash. Twelve actual local Chrome/WebKit checks use two synthetic identities with no starter fallback; they verify that a real peer postcard can return after the original round closes. Final prize selection remains the team's action; Most Technically Complex is a stretch target.
