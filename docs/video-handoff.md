# Submission video draft

The edited draft is **2 minutes 31.2 seconds**, 1280×720, H.264 MP4. It is silent, with readable on-screen copy and a separate WebVTT caption file. No video has been uploaded or submitted. A teammate can record the optional narration below; no synthetic voice, generated image or music was used.

Files in the private repository:

- [Watch the reviewable draft](evidence/submission-preview.mp4)
- [Poster / submission image](evidence/submission-poster.png)
- [Timed captions](evidence/submission-video.vtt)
- [Export checks, source hashes and timeline](evidence/submission-video.json)
- [Editable scene list](video-edit.json)

The first minute shows the bottle ritual, opening paper, writing and return. The remainder makes the Spacetime, Claude, Figma and Mana work inspectable. It is one shared video draft for judging; final category fields and uploads still need the team.

## What the edit contains

The gameplay is a real isolated local recording with AI checks disabled and synthetic guest identities. The visible sandbox banner and provenance caption remain. Idle waiting was cut; playback speed was not increased. The second writer's view is an explicitly introduced jump cut from the same recorded run. The sea and opening paper are the actual rendered app.

The Claude section is a **separately labeled hosted screenshot** from the real two-browser model test, not part of the sandbox recording. It shows a synthetic test postcard, which was hidden after verification. The source record notes that test preceded Turnstile enablement. A newer separate owner probe also confirms both models return valid contracts, but is not presented as another two-person game recording.

Figma and Mana pictures are actual browser screenshots. Make is a late-stage interaction prototype with sample content, separate from the live game. The video shows v2, whose writing action was a placeholder. A subsequent v4 iteration adds a sample writing flow, dated identity and corrected postcard authorship; the real game's writing flow works independently. The native Slides screenshot shows the tested playable embed. Mana's production gate screenshot was freshly captured with every theme empty and the human-authorship box unchecked. The existing actual Mana draft was accepted structurally and rejected for installation; the video describes that check rather than manufacturing terminal footage.

The clip does not establish a human pilot, independent moderation accuracy, physical-phone performance or measured social impact. Human starter inventory is still empty. The repo remains private; judge access still needs arranging. The video is reviewable, not yet team-approved for submission.

## Optional human narration

The subtitles and baked-in text work without narration. If a teammate records this, leave the writing sequence room to breathe and use the times as cues rather than rushing to fill every pause.

| Time | Suggested narration |
| --- | --- |
| 0:00 | “Drift brings back the QQ and WeChat bottle ritual. Six words from you, six from someone else.” |
| 0:08 | “Here's the actual game in a local sandbox, with AI checks off and synthetic guest identities. Shake a bottle, then open someone's beginning over the sea. You write the six-word ending yourself. Both halves become a postcard you can save. After finishing, you can leave your own beginning for the next person, or simply keep the story and go.” |
| 0:48.8 | “Meanwhile, on the other shore.” |
| 0:51.8 | “This is the original writer, in the same recorded run. The postcard has returned without refreshing. Both writers open the same result.” |
| 1:04.2 | “SpacetimeDB makes that collaboration authoritative: one expiring catch, transactional completion, and a live return to both writers. We also checked concurrent writers.” |
| 1:16.2 | “This separate hosted postcard passed real Claude checks. Haiku checks content; optional Sonnet guidance suggests an angle. Our synthetic evaluation still needs independent human review.” |
| 1:30.2 | “We used Figma Make to improve the quiet pool. We inspected an oversized first version, revised it, then carried the compact paper and clear recovery action into the game.” |
| 1:43.2 | “Our native Figma Slides deck records the stages and includes the prototype, playable inside the presentation.” |
| 1:52.2 | “In Mana, we built Bottle Kitchen: a working companion for the team's own starters, with seven themes, six-word validation, review progress and export.” |
| 2:03.2 | “A draft stays a draft. Production needs reviewed inventory and team attestation. We downloaded a real synthetic draft and verified Drift refused to install it.” |
| 2:13.2 | Leave the image credits readable. |
| 2:21.2 | “The game is deployed. Real-phone checks and a human pilot are next. Drift is a small moment of together.” |

## Reproduce the edit

Use Python with Pillow plus installed `ffmpeg` and `ffprobe`. The scene file is editable; it contains all copy, cuts and screenshot crops. Fonts default to installed Georgia/Arial on macOS or DejaVu on Linux. Override with `DRIFT_DEMO_SERIF` and `DRIFT_DEMO_SANS` if needed.

```sh
python3 scripts/submission-video.py --cards-only
python3 scripts/submission-video.py
```

The first command prepares a contact sheet for visual review. The second also verifies source cuts, text bounds, output dimensions, duration below 180 seconds and a complete error-free decode. Outputs go to the task's sibling `outputs/` directory, and intermediate cards/clips stay in `work/submission-video/`. Evidence records content hashes, so a later edit cannot silently stand in for this checkpoint.

## Video description / image attribution

Drift — six words from you, six from someone else. [Play the game](https://drift-game.drift-calhacks-2026-owlsowo.workers.dev/). Edited local sandbox footage uses synthetic guest identities with AI checks off; the real hosted Claude evidence and actual Figma/Mana screenshots are separately labeled. No attendee pilot is claimed.

Photography, also credited in the video and the [live Image credits page](https://drift-game.drift-calhacks-2026-owlsowo.workers.dev/credits.html):

- Vyacheslav Argenberg, [Andaman Sea at night, Moonset, Moonlight](https://commons.wikimedia.org/wiki/File:Andaman_Sea_at_night,_Moonset,_Moonlight.jpg), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Cropped/resized; tinted and animated in the interface. Video title cards add a dark wash.
- Army1987, [Paperball.png](https://commons.wikimedia.org/wiki/File:Paperball.png), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Source image unchanged; UI animation shown in the recording. The paper-ball image retains its original license.
- D Sharon Pruitt / Pink Sherbet Photography, [Free crumpled paper texture for layers](https://commons.wikimedia.org/wiki/File:Free_crumpled_paper_texture_for_layers_(2978651767).jpg), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/). Resized/optimized, tinted and mapped onto the opening paper surface.

Bottle, dock, lighthouse and paper-surface geometry are original interface components. No Tencent footage or screenshots are included. Workflow screenshots depict Figma and Mana as actually used. Screenshots are scaled and, where recorded in the edit list, cropped for legibility.
