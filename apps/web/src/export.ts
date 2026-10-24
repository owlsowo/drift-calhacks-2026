import type { Card } from '../../../packages/game-rules/index';
export const cardText = (c: Card) =>
  `${c.setup}\n${c.reply}\n\nTwo people. Twelve words. Drift.${c.seeded ? ' Setup written by the Drift team.' : ''}`;
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
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#f6f0e4';
  c.fillRect(0, 0, 1080, 1350);
  c.fillStyle = '#173e40';
  c.font = '500 66px Fraunces';
  c.fillText('drift', 76, 121);
  c.font = '500 19px "DM Sans"';
  c.fillText('A LITTLE STORY, TOGETHER.', 76, 161);
  c.save();
  c.translate(913, 123);
  c.rotate(0.15);
  c.strokeStyle = '#6b856c';
  c.lineWidth = 1.7;
  c.beginPath();
  c.arc(0, 0, 62, 0, Math.PI * 2);
  c.stroke();
  c.font = '500 18px "DM Sans"';
  c.textAlign = 'center';
  c.fillText('DRIFT', 0, -17);
  c.font = '400 30px Fraunces';
  c.fillText('∿∿∿', 0, 13);
  c.font = '500 11px "DM Sans"';
  c.fillText('WRITTEN TOGETHER', 0, 35);
  c.restore();
  c.strokeStyle = '#a3afa4';
  c.lineWidth = 2;
  c.strokeRect(76, 222, 928, 894);
  c.fillStyle = '#e2e9df';
  c.fillRect(77, 223, 926, 445);
  c.fillStyle = '#173e40';
  const parts = [
    {
      text: card.setup,
      label: card.seeded ? '01 / THE DRIFT TEAM’S SETUP' : '01 / A STRANGER’S SETUP',
      y: 288,
    },
    { text: card.reply, label: '02 / ANOTHER HUMAN’S ENDING', y: 740 },
  ];
  for (const part of parts) {
    c.font = '600 18px "DM Sans"';
    c.fillText(part.label, 123, part.y);
    let size = 62;
    let lines: string[] = [];
    do {
      c.font = `500 ${size}px Fraunces`;
      lines = wrap(c, part.text, 830);
      if (lines.length * size * 1.25 < 285 && lines.every((l) => c.measureText(l).width <= 830))
        break;
      size -= 2;
    } while (size > 20);
    lines.forEach((line, i) => c.fillText(line, 123, part.y + 87 + i * size * 1.25));
  }
  c.save();
  c.setLineDash([9, 10]);
  c.strokeStyle = '#91a397';
  c.beginPath();
  c.moveTo(77, 669);
  c.lineTo(1003, 669);
  c.stroke();
  c.restore();
  c.fillStyle = '#173e40';
  c.font = '500 28px Fraunces';
  c.fillText('Neither of us could have written this alone.', 76, 1200);
  c.font = '400 19px "DM Sans"';
  c.fillText(location.host, 76, 1251);
  c.fillText(
    new Date(card.createdMs).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    800,
    1251,
  );
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
          title: 'A little story, together',
          text: cardText(card) + '\n' + url,
          files: [file],
        });
      else await navigator.share({ title: 'A little story, together', text: cardText(card), url });
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
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* Try the browser's user-gesture fallback. */
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
