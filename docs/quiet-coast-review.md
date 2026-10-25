# Quiet coast refresh

Pulled main through `05fbb8a`; frontend work is on `codex/quiet-coast`.

The brief is the owner's old WeChat bottle screenshot/video: a place by the sea with a small
release/pick-up/collection ritual. The implementation chooses a nostalgic coastline rather
than a Y2K application shell. It removes persistent navigation and instructions, opens one
paper sheet, and centers the final shared postcard.

The linked [Noniv ocean](https://github.com/Noniv/web-ocean) is a useful visual reference.
Its README describes WebGPU FFT simulation and a capable-GPU requirement. This refresh
uses an original smaller analytic WebGL shader, a fixed horizon, and a transparent coast
overlay. It does not import the external renderer. Assets and prompts: [coast-art.md](coast-art.md).

Validated locally with AI checks explicitly off:

- Production TypeScript/Vite build passed.
- 14 existing rule/model-contract/gesture/draft/CSP tests passed.
- One writer released `I challenged their shark to poker.`; a distinct browser-origin writer
  caught it and submitted `Our lawyers would like another hand.`.
- Both collections received the canonical shared postcard without reloading.
- Save image downloaded a real PNG and displayed success.
- Help's pause/resume control switched renderer state from running to paused and back.
- The resting shore at 360×740 had document dimensions 360×740; all three dock actions fit.
- Responsive screens at 390×844 and desktop were visually inspected.
- A read-only review found and corrected a phone-shake listener that could remain active on home.

The updated shore browser suite was syntax checked, not executed. Prior automated accessibility
reports and screenshots refer to the earlier design; no new accessibility certification or
physical-phone GPU/sensor benchmark is claimed. No hosted deployment was changed.

Current local preview uses the fresh isolated `drift-test-quiet-coast-20261024` room. The old
`drift-local` database was left intact. Local configuration is ignored by Git.
