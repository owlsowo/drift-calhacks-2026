"""Edit real Drift footage and screenshots into a <3-minute reviewable video.

Requires ffmpeg/ffprobe and Pillow. No browser automation, provider calls,
generated imagery, synthetic voice or music. Edit docs/video-edit.json.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / "outputs"
WORK = ROOT.parent / "work" / "submission-video"
PAPER = "#f2edd9"
INK = "#193d43"
MUTED = "#4d6564"
GOLD = "#b7a16c"
RESAMPLE = Image.Resampling.LANCZOS


def run(args: list[str]) -> str:
    result = subprocess.run(args, text=True, capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError(f"{args[0]} failed:\n{result.stderr[-4000:]}")
    return result.stdout


def probe(path: Path) -> dict:
    return json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)]))


def source(relative: str) -> Path:
    path = (ROOT / relative).resolve()
    if not path.is_relative_to(ROOT) or not path.is_file():
        raise ValueError(f"Missing or out-of-repository source: {relative}")
    return path


def font(size: int, serif: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        os.environ.get("DRIFT_DEMO_SERIF" if serif else "DRIFT_DEMO_SANS", ""),
        "/System/Library/Fonts/Supplemental/Georgia.ttf" if serif else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf" if serif else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return ImageFont.truetype(candidate, size)
    raise RuntimeError("Set DRIFT_DEMO_SERIF and DRIFT_DEMO_SANS to installed font paths.")


def wrapped(draw: ImageDraw.ImageDraw, text: str, x: int, y: int, width: int,
            size: int, color: str = INK, serif: bool = False,
            bottom: int = 680, center: bool = False) -> int:
    face = font(size, serif)
    line_height = math.ceil(size * 1.3)
    lines: list[str] = []
    for paragraph in text.split("\n"):
        line = ""
        for word in paragraph.split():
            trial = f"{line} {word}".strip()
            if draw.textlength(trial, font=face) > width:
                if not line:
                    raise ValueError(f"Unbreakable text is too wide: {word}")
                lines.append(line)
                line = word
            else:
                line = trial
        lines.append(line)
    if y + line_height * len(lines) > bottom:
        raise ValueError(f"Text overflows its card: {text}")
    for line in lines:
        dx = (width - draw.textlength(line, font=face)) / 2 if center else 0
        draw.text((x + dx, y), line, font=face, fill=color, stroke_width=0)
        y += line_height
    return y


def picture(canvas: Image.Image, scene: dict, box: tuple[int, int, int, int]) -> None:
    photo = Image.open(source(scene["image"])).convert("RGB")
    if "crop" in scene:
        crop = scene["crop"]
        if not (0 <= crop[0] < crop[2] <= photo.width and 0 <= crop[1] < crop[3] <= photo.height):
            raise ValueError(f"Invalid screenshot crop for {scene['id']}")
        photo = photo.crop(crop)
    x, y, width, height = box
    photo = ImageOps.contain(photo, (width, height), RESAMPLE)
    px, py = x + (width - photo.width) // 2, y + (height - photo.height) // 2
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((px - 6, py - 6, px + photo.width + 6, py + photo.height + 6), fill="#e4ddc9")
    canvas.paste(photo, (px, py))


def card(scene: dict, number: int, count: int, size: tuple[int, int]) -> Image.Image:
    canvas = Image.new("RGB", size, PAPER)
    draw = ImageDraw.Draw(canvas)
    if scene["kind"] == "title":
        sea = ImageOps.fit(Image.open(source(scene["image"])).convert("RGB"), size, RESAMPLE)
        canvas = Image.blend(sea, Image.new("RGB", size, "#102e36"), .6)
        draw = ImageDraw.Draw(canvas)
        wrapped(draw, scene["kicker"], 64, 104, 1152, 15, PAPER, center=True)
        wrapped(draw, scene["title"], 64, 238, 1152, 62, PAPER, True, bottom=440, center=True)
        wrapped(draw, scene["body"], 64, 440, 1152, 27, PAPER, bottom=570, center=True)
        wrapped(draw, scene["note"], 64, 602, 1152, 19, "#e7dfc8", bottom=665, center=True)
    else:
        wrapped(draw, scene["kicker"], 64, 47, 1152, 15, MUTED, bottom=100)
        draw.line((64, 96, 1216, 96), fill=GOLD, width=1)
        if scene["kind"] == "evidence":
            y = wrapped(draw, scene["title"], 64, 154, 510, 43, serif=True, bottom=370)
            y += 25
            for paragraph in scene["paragraphs"]:
                y = wrapped(draw, paragraph, 64, y, 510, 22, bottom=605) + 20
            picture(canvas, scene, (650, 132, 566, 475))
            wrapped(draw, scene["note"], 64, 631, 1152, 17, MUTED, bottom=688)
        elif scene["kind"] == "credits":
            wrapped(draw, scene["title"], 64, 145, 1152, 48, serif=True, bottom=235)
            for i, (creator, license_note) in enumerate(scene["credits"]):
                y = 255 + i * 108
                wrapped(draw, creator, 64, y, 1152, 27, serif=True, bottom=y + 42)
                wrapped(draw, license_note, 64, y + 43, 1152, 20, MUTED, bottom=y + 90)
            wrapped(draw, scene["note"], 64, 631, 1152, 20, MUTED, bottom=688)
        elif scene["kind"] == "diagram":
            wrapped(draw, scene["title"], 64, 145, 1152, 48, serif=True, bottom=235)
            for i, label in enumerate(scene["steps"]):
                x = 64 + i * 399
                draw.rectangle((x, 267, x + 350, 434), fill="#e4ddc9")
                wrapped(draw, f"0{i + 1}", x + 23, 288, 304, 20, MUTED)
                wrapped(draw, label, x + 23, 341, 304, 27, serif=True, bottom=420)
                if i < 2:
                    draw.line((x + 361, 350, x + 385, 350), fill=MUTED, width=2)
                    draw.line((x + 379, 344, x + 385, 350, x + 379, 356), fill=MUTED, width=2)
            wrapped(draw, scene["body"], 64, 485, 1152, 27, bottom=590)
            wrapped(draw, scene["note"], 64, 631, 1152, 18, MUTED, bottom=688)
        else:
            raise ValueError(f"Unsupported card kind: {scene['kind']}")
    draw.text((64, 691), "DRIFT / SUBMISSION VIDEO DRAFT", font=font(11), fill=PAPER if scene["kind"] == "title" else MUTED)
    draw.text((1160, 691), f"{number:02}/{count:02}", font=font(11), fill=PAPER if scene["kind"] == "title" else MUTED)
    return canvas


def timestamp(seconds: float) -> str:
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3600000)
    minutes, milliseconds = divmod(milliseconds, 60000)
    secs, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02}.{milliseconds:03}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cards-only", action="store_true", help="Render and inspect layout before encoding")
    args = parser.parse_args()
    edit_path = source("docs/video-edit.json")
    edit = json.loads(edit_path.read_text())
    if (edit["width"], edit["height"], edit["fps"]) != (1280, 720, 30):
        raise ValueError("This layout is authored for 1280×720 at 30 fps.")
    OUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    timeline = []
    sources = {}
    cursor = 0.0
    contact = []
    segments = []
    for i, scene in enumerate(edit["scenes"]):
        clip = scene["kind"] == "clip"
        duration = scene["end"] - scene["start"] if clip else scene["duration"]
        if duration <= 0:
            raise ValueError("Scene duration must be positive")
        relative = scene.get("source", scene.get("image"))
        if relative:
            path = source(relative)
            sources[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
        png = WORK / f"{i:02}-{scene['id']}.png"
        if clip:
            info = probe(path)
            if not (0 <= scene["start"] < scene["end"] <= float(info["format"]["duration"])):
                raise ValueError(f"Cut exceeds recorded footage: {scene['id']}")
            run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(scene["start"] + min(3, duration / 2)), "-i", str(path), "-frames:v", "1", str(png)])
        else:
            card(scene, i + 1, len(edit["scenes"]), (1280, 720)).save(png)
        contact.append(png)
        timeline.append({"id": scene["id"], "start": round(cursor, 3), "end": round(cursor + duration, 3), "kind": scene["kind"], "caption": scene["caption"]})
        cursor += duration
        if cursor >= 180:
            raise ValueError("Video must be shorter than three minutes")
        if not args.cards_only:
            segment = WORK / f"{i:02}-{scene['id']}.mp4"
            command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
            if clip:
                command += ["-ss", str(scene["start"]), "-i", str(path)]
            else:
                command += ["-loop", "1", "-framerate", "30", "-i", str(png)]
            filters = "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"
            if not clip:
                filters += f",fade=t=in:st=0:d=0.2,fade=t=out:st={duration - .2}:d=0.2"
            command += ["-t", str(duration), "-an", "-vf", filters, "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-video_track_timescale", "15360", str(segment)]
            run(command)
            segments.append(segment)
        print(f"Prepared {scene['id']}: {duration:.2f}s", flush=True)
    sheet = Image.new("RGB", (1280, math.ceil(len(contact) / 3) * 264), PAPER)
    draw = ImageDraw.Draw(sheet)
    for i, png in enumerate(contact):
        thumb = Image.open(png).resize((416, 234), RESAMPLE)
        x, y = (i % 3) * 426, (i // 3) * 264
        sheet.paste(thumb, (x, y))
        draw.text((x + 5, y + 237), f"{timestamp(timeline[i]['start'])} / {timeline[i]['id']}", font=font(13), fill=INK)
    sheet.save(OUT / "drift-submission-video-contact-sheet.jpg")
    shutil.copyfile(contact[0], OUT / "drift-submission-poster.png")
    vtt = ["WEBVTT", ""]
    for entry in timeline:
        vtt += [entry["id"], f"{timestamp(entry['start'])} --> {timestamp(entry['end'])}", entry["caption"], ""]
    (OUT / "drift-submission-video.vtt").write_text("\n".join(vtt))
    if args.cards_only:
        print(f"Layouts checked. Planned duration: {cursor:.2f}s")
        return
    concat = WORK / "concat.txt"
    # All paths are generated below WORK, never taken from a shell or user text.
    concat.write_text("\n".join(f"file '{p.name}'" for p in segments))
    video = OUT / "drift-submission-preview.mp4"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "1", "-i", str(concat), "-c", "copy", "-movflags", "+faststart", str(video)])
    actual = probe(video)
    seconds = float(actual["format"]["duration"])
    stream = next(s for s in actual["streams"] if s["codec_type"] == "video")
    if seconds >= 180 or abs(seconds - cursor) > .2 or (stream["width"], stream["height"]) != (1280, 720):
        raise ValueError("Export duration/dimensions failed verification")
    # Decode the complete exported artifact, rather than trusting encoder success.
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-xerror", "-i", str(video), "-f", "null", "-"])
    evidence = {
        "artifact": video.name,
        "status": edit["status"],
        "durationSeconds": seconds,
        "dimensions": [1280, 720],
        "sha256": hashlib.sha256(video.read_bytes()).hexdigest(),
        "editSha256": hashlib.sha256(edit_path.read_bytes()).hexdigest(),
        "sources": sources,
        "timeline": timeline,
        "audio": "None; silent captioned draft with optional human narration script",
        "scope": "Edited local sandbox gameplay, separately labeled real hosted evidence, actual Figma/Mana screenshots. No generated application frames, AI images or fabricated model output.",
        "credits": "docs/asset-sources.md and apps/web/public/credits.html",
        "checks": ["All referenced files exist within repository", "Source cuts lie within original recording", "Text layout has no detected overflow", "Export is shorter than 180 seconds", "Full exported video decodes without errors"],
    }
    (OUT / "drift-submission-video-evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
    print(f"Verified {video}: {seconds:.2f}s", flush=True)


if __name__ == "__main__":
    main()
