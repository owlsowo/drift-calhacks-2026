"""Build a four-page project brief from the submission assets. No network calls."""
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph

HERE = Path(__file__).resolve().parent
PACKAGE = HERE.parent
OUT = PACKAGE / 'output/pdf/drift-project-brief.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
for family, weight, registered in [('dm-sans','400','DM'),('dm-sans','600','DM-Bold'),('fraunces','400','Fraunces')]:
    stem = HERE / f'assets/{family}-latin-{weight}-normal'
    target = stem.with_suffix('.ttf')
    if not target.exists():
        from fontTools.ttLib import TTFont as SourceFont
        font = SourceFont(stem.with_suffix('.woff2'))
        font.flavor = None
        font.save(target)
    pdfmetrics.registerFont(TTFont(registered, str(target)))

CREAM = HexColor('#f4f0e5')
TEAL = HexColor('#173e43')
MUTED = HexColor('#526968')
SAGE = HexColor('#e2e8d8')
LINE = HexColor('#a7b5a8')
W,H = 595.276,841.89
c = canvas.Canvas(str(OUT), pagesize=(W,H))
c.setTitle('Drift - Cal Hacks 13.0 Project Brief')
c.setAuthor('Drift')
c.setSubject('Two six-word contributions, one shared postcard. Product and evidence checkpoint, October 24, 2026.')

def text(x,y,value,size=12,font='DM',color=TEAL):
    assert x + pdfmetrics.stringWidth(value,font,size) <= W-28, f'Overflow: {value}'
    c.setFillColor(color)
    c.setFont(font,size)
    c.drawString(x,y,value)

def para(x,y,value,width=510,size=12,leading=None,color=TEAL,font='DM'):
    style=ParagraphStyle('body',fontName=font,fontSize=size,leading=leading or size*1.5,textColor=color)
    p=Paragraph(value,style)
    _,height=p.wrap(width,H)
    p.drawOn(c,x,y-height)
    return y-height

def base(number,label):
    c.setFillColor(CREAM); c.rect(0,0,W,H,fill=1,stroke=0)
    if number > 1:
        text(42,H-38,'DRIFT / CAL HACKS 13.0',9,'DM-Bold')
    c.setStrokeColor(LINE); c.setLineWidth(.5); c.line(42,48,W-42,48)
    text(42,31,label,8,color=MUTED)
    text(W-78,31,f'{number:02d} / 04',8,color=MUTED)

def image(name,x,y,width):
    c.drawImage(str(PACKAGE/'gallery'/name),x,y,width=width,height=width*2/3,mask='auto')

def heading(label,title):
    text(42,757,label,10,'DM-Bold',MUTED)
    text(42,718,title,32,'Fraunces')

base(1,'Product brief / October 24, 2026')
image('01-drift-thumbnail.png',0,414,W)
text(42,377,'A little story, together.',29,'Fraunces')
para(42,348,'Drift is a daily co-op writing game where two strangers turn two six-word lines into a postcard they both keep.',size=14,leading=21)
for x,num,title,body in [(42,'01','Catch','Unfold another writer\'s beginning.'),(219,'02','Finish','Add six words of your own.'),(396,'03','Keep','Save the story you made together.')]:
    text(x,265,num,10,'DM-Bold',MUTED)
    text(x,237,title,25,'Fraunces')
    para(x,216,escape(body),width=152,size=11)
para(42,160,'Then, optionally toss your own beginning for the next person. Three rounds daily, one completion stamp. No profile or contact exchange is needed for the main game.',size=11.5,color=MUTED)
text(42,87,'Play Drift',12,'DM-Bold')
c.linkURL('https://drift-game.drift-calhacks-2026-owlsowo.workers.dev',(42,83,113,101),relative=0)
text(174,87,'Source repository (private)',11,'DM-Bold')
c.linkURL('https://github.com/owlsowo/drift-calhacks-2026',(174,83,327,101),relative=0)
para(42,74,'Hosted prototype. Final normal-user bot-check-to-export rehearsal remains pending.',size=8.5,color=MUTED)
c.showPage()

base(2,'The experience / Actual local sandbox capture; AI checks off')
heading('THE EXPERIENCE','A small invitation.')
image('02-the-daily-prompt.png',42,357,511)
text(42,324,'The prompt gives two people a shared starting point.',19,'Fraunces')
para(42,300,'For the aquarium prompt, one writer explains why they were banned. The next writes the aquarium\'s official response. The six-word limit keeps each contribution small while leaving room for an unexpected turn.',size=12)
text(42,211,'The reveal is the main event.',21,'Fraunces')
para(42,188,'When the second writer seals the postcard, its original author receives the same approved pair through a live subscription. Both can keep it in their collection, save an image, or share a link. Leaving another beginning is optional.',size=12)
para(42,107,'Our intended audience is first-time event attendees who might enjoy a creative task before an introduction. That is a design hypothesis; there has not yet been an attendee pilot or measured social outcome.',size=10.5,color=MUTED)
c.showPage()

base(3,'The engineering / Implemented state and AI boundaries')
heading('THE ENGINEERING','One story. One shared state.')
image('05-the-shared-state.png',42,357,511)
text(42,325,'A successful model answer is not enough to publish.',20,'Fraunces')
para(42,301,'The bottle may have expired or changed hands while Claude was checking it. Drift persists the request before dispatch, then rechecks the live owner, version, deadline, withdrawal, and pause state before finalizing the postcard.',size=12)
text(42,209,'SpacetimeDB',18,'Fraunces')
para(42,187,'Authoritative claims, private participant views, atomic card and authorship publication, and subscriptions that deliver the same result to both writers.',width=235,size=11)
text(318,209,'Claude',18,'Fraunces')
para(318,187,'Haiku 5.5 checks setups and completed pairs. Sonnet 5.5 suggests a direction when requested. Players supply both creative lines; uncertain checks withhold publication.',width=235,size=11)
para(42,101,'React + TypeScript + Vite on Cloudflare. Canvas exports the card; native WebGL animates sea and paper with static/CSS and reduced-motion alternatives. Server-side Turnstile and scheduled retention are implemented.',size=9.5,color=MUTED)
c.showPage()

base(4,'Evidence checkpoint / Synthetic tests; no attendee pilot')
heading('THE EVIDENCE','What works today.')
for x,value,label in [(42,'43','server tests pass'),(219,'14','unit / contract tests pass'),(396,'50','valid model outputs')]:
    c.setFillColor(SAGE);c.rect(x,616,157,74,fill=1,stroke=0)
    text(x+13,652,value,29,'Fraunces');text(x+13,632,label,8.5,'DM-Bold')
text(42,582,'Hosted exchange',16,'Fraunces')
para(42,564,'A real Cloudflare/Maincloud two-browser run completed Claude setup checks, a contextual hint, pair moderation, live return, and PNG export with synthetic writers. It preceded Turnstile activation and the newer catch-first revision.',size=11)
text(42,482,'Current catch-first flow',16,'Fraunces')
para(42,464,'An isolated local sandbox test verified catching before writing, immediate postcard completion, the live return, and optional giving afterward. AI checks were off. Separate hosted negative tests rejected forged tokens and unverified identities.',size=11)
text(42,382,'Evaluation and software checks',16,'Fraunces')
para(42,364,'In a 50-case live synthetic evaluation, moderation matched 35 of 36 development labels; one harmless case was conservatively withheld. Fourteen hints received Codex review for grounding and authorship boundaries. This is agent review, not independent human validation. Production build and TypeScript checks pass; documented browser scans found no automated accessibility violations in tested states.',size=11)
text(42,246,'Next verification',16,'Fraunces')
para(42,228,'Rehearse the current hosted game through the enabled bot challenge on physical phones; improve hint tone; supply human-written starters for quiet rooms; run a small consent-based attendee pilot. No adoption, friendship, loneliness, or broad safety outcome is claimed.',size=11)
text(42,143,'Sources and image credits',10,'DM-Bold')
para(42,128,'Technical records: hosted-smoke.json, hosted-gate.json, catch-first.json, live-release.md, and the 50-case evaluation in the repository. Full evidence mapping and source-image provenance accompany this package.',size=8.5,color=MUTED)
para(42,92,'Sea/moon: Vyacheslav Argenberg, CC BY 4.0 (cropped/treated). Paper: D Sharon Pruitt / Pink Sherbet Photography, CC BY 2.0 (resized/tinted/mapped). Full source and license links are in gallery-captions.md. Typography: Fraunces and DM Sans, SIL Open Font License.',size=8,color=MUTED)
c.linkURL('https://commons.wikimedia.org/wiki/File:Andaman_Sea_at_night,_Moonset,_Moonlight.jpg',(42,62,280,85),relative=0)
c.linkURL('https://commons.wikimedia.org/wiki/File:Free_crumpled_paper_texture_for_layers_(2978651767).jpg',(285,62,553,85),relative=0)
c.save()
print(OUT)
