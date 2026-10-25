import type { Card } from '../../../packages/game-rules/index';
import { storyPrompt } from './story-context';
import { submissionTime } from './submission-time';
import type { SceneSpec } from '../../../packages/scene-contracts/index';
import { prepareScene, drawScene } from './scene-renderer';
const provenance = (card: Card) =>
  card.seeded
    ? card.starterKind === 'team'
      ? 'Beginning by the Drift team.'
      : 'Sample beginning.'
    : '';
export const cardText = (card: Card) => {
  const prompt = storyPrompt(card.promptId);
  return `Original prompt: ${prompt?.setup ?? 'Unavailable'}\nBeginning: ${card.setup}\n\nHow to respond: ${prompt?.reply ?? 'Unavailable'}\nEnding: ${card.reply}${provenance(card) ? `\n\n${provenance(card)}` : ''}`;
};
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
async function renderPostcard(card: Card, scene?: SceneSpec) {
  // A composition enhances the human exchange; a missing static asset must not
  // prevent saving those words. The renderer bounds every asset load at 8s.
  const illustrationReady = scene
    ? prepareScene(scene).catch(() => undefined)
    : Promise.resolve(undefined);
  const paper = new Image();
  paper.decoding = 'async';
  const paperReady = new Promise<boolean>((resolve) => {
    const finish = (loaded: boolean) => {
      clearTimeout(timer);
      paper.onload = null;
      paper.onerror = null;
      resolve(loaded);
    };
    const timer = setTimeout(() => finish(false), 1200);
    paper.onload = () => finish(true);
    paper.onerror = () => finish(false);
    paper.src = new URL('/assets/paper-texture.jpg', location.origin).href;
  });
  let fontTimer: ReturnType<typeof setTimeout> | undefined;
  const handwritingReady = Promise.race([
    document.fonts
      .load('400 70px Kalam')
      .then((faces) => faces.length > 0)
      .catch(() => false),
    new Promise<boolean>((resolve) => {
      fontTimer = setTimeout(() => resolve(false), 1200);
    }),
  ]).finally(() => clearTimeout(fontTimer));
  const [hasPaper, hasHandwriting, preparedIllustration] = await Promise.all([
    paperReady,
    handwritingReady,
    illustrationReady,
  ]);
  // Draw into a separate layer first. A failed draw cannot leave partial art or
  // a changed context transform behind on the words-only keepsake.
  let illustration: HTMLCanvasElement | undefined;
  if (preparedIllustration) {
    try {
      const layer = document.createElement('canvas');
      layer.width = 900;
      layer.height = 600;
      const context = layer.getContext('2d');
      if (!context) throw Error('Illustration canvas is unavailable.');
      drawScene(context, preparedIllustration, 0, 0, 900, 600);
      illustration = layer;
    } catch {
      /* Keep both original lines when the illustration cannot be painted. */
    }
  }
  const handwriting = hasHandwriting ? 'Kalam' : 'Georgia, serif';
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1650;
  const c = canvas.getContext('2d');
  if (!c) throw Error('Couldn’t create your image. Try copying the text instead.');
  if (hasPaper) c.drawImage(paper, 0, 0, canvas.width, canvas.height);
  else {
    c.fillStyle = '#f2ebd9';
    c.fillRect(0, 0, canvas.width, canvas.height);
  }
  c.fillStyle = 'rgba(242,235,217,.86)';
  c.fillRect(0, 0, canvas.width, canvas.height);
  const edgeShade = c.createLinearGradient(0, 0, canvas.width, canvas.height);
  edgeShade.addColorStop(0, 'rgba(255,255,255,.04)');
  edgeShade.addColorStop(0.5, 'rgba(36,47,61,0)');
  edgeShade.addColorStop(1, 'rgba(36,47,61,.05)');
  c.fillStyle = edgeShade;
  c.fillRect(0, 0, canvas.width, canvas.height);

  if (illustration) c.drawImage(illustration, 90, 150);
  const foldY = illustration ? 1125 : 825;
  const fold = c.createLinearGradient(0, foldY - 17, 0, foldY + 17);
  fold.addColorStop(0, 'rgba(38,51,66,0)');
  fold.addColorStop(0.46, 'rgba(38,51,66,.055)');
  fold.addColorStop(0.5, 'rgba(38,51,66,.10)');
  fold.addColorStop(0.54, 'rgba(255,255,255,.25)');
  fold.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = fold;
  c.fillRect(0, foldY - 17, canvas.width, 34);

  c.fillStyle = '#263342';
  c.textBaseline = 'middle';
  const prompt = storyPrompt(card.promptId);
  const parts = [
    {
      text: card.setup,
      label: `Original prompt: ${prompt?.setup ?? 'Unavailable'}`,
      top: illustration ? 790 : 250,
      center: illustration ? 1000 : 540,
    },
    {
      text: card.reply,
      label: `How to respond: ${prompt?.reply ?? 'Unavailable'}`,
      top: illustration ? 1160 : 900,
      center: illustration ? 1370 : 1190,
    },
  ];
  for (const part of parts) {
    c.font = '400 28px Arial, sans-serif';
    wrap(c, part.label, 880).forEach((line, i) => c.fillText(line, 100, part.top + i * 36));
    let size = illustration ? 58 : 70;
    let lines: string[] = [];
    do {
      c.font = `400 ${size}px ${handwriting}`;
      lines = wrap(c, part.text, 880);
      if (
        (lines.length * size * 1.4 <= (illustration ? 175 : 380) &&
          lines.every((l) => c.measureText(l).width <= 880)) ||
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
  c.fillText(submissionTime(card.createdMs), 100, 1500);
  c.fillText(location.host, 100, 1550);
  c.font = '400 22px Arial, sans-serif';
  if (provenance(card)) c.fillText(provenance(card), 100, 1460, 880);
  c.font = '400 16px Arial, sans-serif';
  c.fillText(
    (illustration ? 'AI composition · ' : '') +
      (hasPaper
        ? 'Paper photo: D Sharon Pruitt · CC BY 2.0 · ' + location.host + '/credits.html'
        : 'Drift · ' + location.host),
    100,
    1610,
    880,
  );
  const blob = await new Promise<Blob>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error('Couldn’t create your image. Try copying the text instead.')),
      2000,
    );
    canvas.toBlob((blob) => {
      clearTimeout(timer);
      if (blob) resolve(blob);
      else reject(Error('Couldn’t create your image. Try copying the text instead.'));
    }, 'image/png');
  });
  return { blob, illustrated: !!illustration };
}
export async function postcardPng(card: Card, scene?: SceneSpec): Promise<Blob> {
  return (await renderPostcard(card, scene)).blob;
}

const prepared = new Map<
  string,
  { expiresAt: number; promise: Promise<Blob>; blob?: Blob; illustrated?: boolean }
>();
const postcardKey = (card: Card, scene?: SceneSpec) =>
  JSON.stringify([
    card.id,
    card.setup,
    card.reply,
    card.seeded,
    card.starterKind,
    card.createdMs,
    location.host,
    // A newly arrived scene must not reuse the text-only postcard prepared earlier.
    scene ?? null,
  ]);
export function preparePostcard(card: Card, scene?: SceneSpec): Promise<Blob> {
  const key = postcardKey(card, scene);
  for (const [oldKey, entry] of prepared)
    if (entry.expiresAt <= Date.now()) prepared.delete(oldKey);
  const existing = prepared.get(key);
  // Keep a fallback ready for the native share click, but let a later explicit
  // preparation retry the same composition after its static asset recovers.
  if (existing && (!scene || existing.illustrated !== false)) return existing.promise;
  while (prepared.size >= 6) prepared.delete(prepared.keys().next().value!);
  const entry = {
    expiresAt: Date.now() + 300000,
    promise: undefined as unknown as Promise<Blob>,
    blob: existing?.blob,
    illustrated: undefined as boolean | undefined,
  };
  entry.promise = renderPostcard(card, scene)
    .then(({ blob, illustrated }) => {
      entry.blob = blob;
      entry.illustrated = illustrated;
      return blob;
    })
    .catch((error) => {
      if (prepared.get(key) === entry) prepared.delete(key);
      throw error;
    });
  prepared.set(key, entry);
  return entry.promise;
}
export async function savePng(card: Card, scene?: SceneSpec) {
  const blob = await preparePostcard(card, scene);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `drift-${card.id.slice(0, 8)}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function shareCard(
  card: Card,
  scene?: SceneSpec,
  { preferLink = false }: { preferLink?: boolean } = {},
) {
  const url = cardUrl(card);
  if (navigator.share) {
    try {
      const cached = preferLink ? undefined : prepared.get(postcardKey(card, scene));
      const blob = cached && cached.expiresAt > Date.now() ? cached.blob : undefined;
      const file = blob
        ? new File([blob], `drift-${card.id.slice(0, 8)}.png`, { type: 'image/png' })
        : undefined;
      let acceptsImage = false;
      try {
        acceptsImage = !!file && !!navigator.canShare?.({ files: [file] });
      } catch {
        /* Share the story URL instead. */
      }
      // Invoke the native sheet during this click, without waiting on fonts or images.
      if (file && acceptsImage)
        await navigator.share({
          title: 'Drift',
          text: cardText(card) + '\n' + url,
          files: [file],
        });
      else {
        if (!preferLink) void preparePostcard(card, scene).catch(() => {});
        await navigator.share({ title: 'Drift', text: cardText(card), url });
      }
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
