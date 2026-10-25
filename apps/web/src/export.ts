import type { Card } from '../../../packages/game-rules/index';
const provenance = (card: Card) =>
  card.seeded
    ? card.starterKind === 'team'
      ? 'Beginning by the Drift team.'
      : 'Sample beginning.'
    : '';
export const cardText = (card: Card) =>
  `${card.setup}\n${card.reply}${provenance(card) ? `\n\n${provenance(card)}` : ''}`;
export const cardUrl = (c: Card) =>
  `${location.origin}${location.pathname}?card=${encodeURIComponent(c.id)}`;
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (ctx.measureText(word).width > width) {
      if (line) {
        lines.push(line);
        line = '';
      }
      let piece = '';
      for (const character of [...word]) {
        if (piece && ctx.measureText(piece + character).width > width) {
          lines.push(piece);
          piece = '';
        }
        piece += character;
      }
      line = piece;
      continue;
    }
    const next = line ? line + ' ' + word : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
export async function postcardPng(card: Card): Promise<Blob> {
  const paper = new Image();
  paper.decoding = 'async';
  const paperReady = new Promise<void>((resolve, reject) => {
    paper.onload = () => resolve();
    paper.onerror = () =>
      reject(Error('Couldn’t create your image. Try copying the text instead.'));
    paper.src = new URL('/assets/letter-paper.webp', location.origin).href;
  });
  await Promise.all([document.fonts.load('400 70px Kalam'), paperReady]);
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const c = canvas.getContext('2d')!;
  c.drawImage(paper, 0, 0, canvas.width, canvas.height);
  const edgeShade = c.createLinearGradient(0, 0, canvas.width, canvas.height);
  edgeShade.addColorStop(0, 'rgba(255,255,255,.04)');
  edgeShade.addColorStop(0.5, 'rgba(36,47,61,0)');
  edgeShade.addColorStop(1, 'rgba(36,47,61,.05)');
  c.fillStyle = edgeShade;
  c.fillRect(0, 0, canvas.width, canvas.height);

  const fold = c.createLinearGradient(0, 658, 0, 692);
  fold.addColorStop(0, 'rgba(38,51,66,0)');
  fold.addColorStop(0.46, 'rgba(38,51,66,.055)');
  fold.addColorStop(0.5, 'rgba(38,51,66,.10)');
  fold.addColorStop(0.54, 'rgba(255,255,255,.25)');
  fold.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = fold;
  c.fillRect(0, 658, canvas.width, 34);

  c.fillStyle = '#263342';
  c.textBaseline = 'middle';
  const parts = [
    { text: card.setup, center: 390 },
    { text: card.reply, center: 920 },
  ];
  for (const part of parts) {
    let size = 70;
    let lines: string[] = [];
    do {
      c.font = `400 ${size}px Kalam`;
      lines = wrap(c, part.text, 880);
      if (
        (lines.length * size * 1.4 <= 380 && lines.every((l) => c.measureText(l).width <= 880)) ||
        size === 20
      )
        break;
      size -= 2;
    } while (size >= 20);
    const leading = size * 1.4;
    const firstLine = part.center - ((lines.length - 1) * leading) / 2;
    lines.forEach((line, i) => c.fillText(line, 100, firstLine + i * leading));
  }

  c.fillStyle = 'rgba(38,51,66,.65)';
  c.font = '400 21px Georgia, serif';
  c.textAlign = 'right';
  c.fillText(
    new Date(card.createdMs).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    980,
    100,
  );
  c.textAlign = 'left';
  if (provenance(card)) c.fillText(provenance(card), 100, 1220);
  c.fillText(location.host, 100, 1270);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(Error('Couldn’t create your image. Try copying the text instead.')),
      'image/png',
    ),
  );
}
export async function savePng(card: Card) {
  const blob = await postcardPng(card);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `drift-${card.id.slice(0, 8)}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function shareCard(card: Card) {
  const url = cardUrl(card);
  if (navigator.share) {
    try {
      const blob = await postcardPng(card);
      const file = new File([blob], `drift-${card.id.slice(0, 8)}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] }))
        await navigator.share({
          title: 'Drift',
          text: cardText(card) + '\n' + url,
          files: [file],
        });
      else await navigator.share({ title: 'Drift', text: cardText(card), url });
      return 'Shared';
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error;
    }
  }
  await copyText(url);
  return 'Link copied';
}
export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise<never>((_, reject) => {
          deadline = setTimeout(() => reject(Error('Clipboard permission did not respond.')), 1200);
        }),
      ]);
      return;
    } catch {
      /* Try the browser's user-gesture fallback. */
    } finally {
      clearTimeout(deadline);
    }
  }
  const input = document.createElement('textarea');
  input.value = text;
  input.className = 'clipboard-fallback';
  input.setAttribute('readonly', '');
  input.setAttribute('aria-label', 'Text to copy');
  const focused = document.activeElement as HTMLElement | null;
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  focused?.focus();
  if (!copied) throw Error('This browser couldn’t copy the text. Save the postcard image instead.');
}
