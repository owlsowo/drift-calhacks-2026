import {
  getScenePackById,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  validateScene,
  type SceneAsset,
  type ScenePack,
  type SceneSpec,
} from '../../../packages/scene-contracts/index';

export { SCENE_HEIGHT, SCENE_WIDTH };

type ScenePicture = HTMLImageElement | HTMLCanvasElement;

export interface PreparedScene {
  readonly scene: SceneSpec;
  readonly pack: ScenePack;
  readonly pictures: ReadonlyMap<string, ScenePicture>;
  readonly paper: HTMLCanvasElement;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();
const emojiCache = new Map<string, HTMLCanvasElement>();
const backdropCache = new Map<SceneSpec['backdrop'], HTMLCanvasElement>();
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

function canvas(width: number, height: number) {
  const result = document.createElement('canvas');
  result.width = width;
  result.height = height;
  const ctx = result.getContext('2d');
  if (!ctx) throw new Error('The illustration cannot be drawn in this browser.');
  return { canvas: result, ctx };
}

function image(src: string): Promise<HTMLImageElement> {
  // The model supplies an asset ID, never a path. Restrict even the curated
  // manifest to the shipped same-origin directory so exports remain untainted.
  if (!/^\/assets\/scenes\/[a-zA-Z0-9_/-]+\.(svg|png|webp)$/.test(src) || src.includes('..'))
    return Promise.reject(new Error('This illustration contains an unavailable asset.'));
  const existing = imageCache.get(src);
  if (existing) return existing;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const picture = new Image();
    let timer: ReturnType<typeof setTimeout>;
    const fail = () => {
      clearTimeout(timer);
      picture.onload = null;
      picture.onerror = null;
      imageCache.delete(src);
      reject(new Error('The illustration could not load.'));
    };
    picture.decoding = 'async';
    picture.onload = () => {
      clearTimeout(timer);
      picture.onload = null;
      picture.onerror = null;
      if (picture.naturalWidth > 0 && picture.naturalHeight > 0) resolve(picture);
      else fail();
    };
    picture.onerror = fail;
    timer = setTimeout(fail, 8000);
    picture.src = new URL(src, location.origin).href;
  });
  imageCache.set(src, pending);
  if (imageCache.size > 64) imageCache.delete(imageCache.keys().next().value!);
  return pending;
}

function emojiPicture(emoji: string): HTMLCanvasElement {
  const existing = emojiCache.get(emoji);
  if (existing) return existing;
  const { canvas: picture, ctx } = canvas(512, 512);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400px ${EMOJI_FONT}`;
  let bounds = ctx.measureText(emoji);
  const inkWidth = bounds.actualBoundingBoxLeft + bounds.actualBoundingBoxRight;
  const inkHeight = bounds.actualBoundingBoxAscent + bounds.actualBoundingBoxDescent;
  const fit = Math.min(1, 460 / Math.max(inkWidth || bounds.width, inkHeight || 400));
  ctx.font = `${Math.floor(400 * fit)}px ${EMOJI_FONT}`;
  bounds = ctx.measureText(emoji);
  const left = bounds.actualBoundingBoxLeft || 0;
  const right = bounds.actualBoundingBoxRight || bounds.width;
  const ascent = bounds.actualBoundingBoxAscent || 320 * fit;
  const descent = bounds.actualBoundingBoxDescent || 80 * fit;
  ctx.fillText(emoji, (512 - left - right) / 2 + left, (512 - ascent - descent) / 2 + ascent);
  emojiCache.set(emoji, picture);
  return picture;
}

function wash(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, color.replace(/,[\d.]+\)$/, ',0)'));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
}

function backdrop(kind: SceneSpec['backdrop']): HTMLCanvasElement {
  const existing = backdropCache.get(kind);
  if (existing) return existing;
  const { canvas: picture, ctx } = canvas(SCENE_WIDTH, SCENE_HEIGHT);
  ctx.fillStyle = '#eee9dc';
  ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);

  // These are neutral stage treatments, not additional objects in the story.
  // Keeping horizons soft lets Claude place a table, a raft, or a flying subject.
  const colors: Record<SceneSpec['backdrop'], [string, string, string]> = {
    paper: ['#e9e5d9', '#f1ecdf', '#e1dbcc'],
    sky: ['#bbd0d6', '#e8e7d9', '#d4d7c5'],
    night: ['#56677d', '#8b9aa8', '#a2a9a6'],
    water: ['#c7d7d6', '#dce1d5', '#91b7bc'],
    room: ['#ded8cb', '#eae2d1', '#c9baa3'],
  };
  const palette = colors[kind];
  const field = ctx.createLinearGradient(0, 0, 0, SCENE_HEIGHT);
  field.addColorStop(0, palette[0]);
  field.addColorStop(0.62, palette[1]);
  field.addColorStop(1, palette[2]);
  ctx.fillStyle = field;
  ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
  wash(ctx, 230, 170, 480, 'rgba(255,250,230,.2)');
  wash(ctx, 780, 540, 440, 'rgba(85,105,114,.08)');

  if (kind === 'water') {
    const water = ctx.createLinearGradient(0, 338, 0, SCENE_HEIGHT);
    water.addColorStop(0, 'rgba(98,143,153,0)');
    water.addColorStop(0.2, 'rgba(98,143,153,.19)');
    water.addColorStop(1, 'rgba(83,132,147,.24)');
    ctx.fillStyle = water;
    ctx.fillRect(0, 338, SCENE_WIDTH, 262);
    for (let row = 0; row < 10; row += 1) {
      const y = 377 + row * 24;
      ctx.strokeStyle = `rgba(244,244,225,${0.16 - row * 0.008})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = -20; x <= 920; x += 20) {
        const ripple = Math.sin(x / 85 + row * 1.8) * (2 + row * 0.65);
        if (x === -20) ctx.moveTo(x, y + ripple);
        else ctx.lineTo(x, y + ripple);
      }
      ctx.stroke();
    }
  } else if (kind === 'room') {
    const floor = ctx.createLinearGradient(0, 405, 0, 600);
    floor.addColorStop(0, 'rgba(134,113,90,.08)');
    floor.addColorStop(1, 'rgba(134,113,90,.13)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, 405, 900, 195);
    ctx.strokeStyle = 'rgba(112,102,88,.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 405);
    ctx.lineTo(900, 405);
    ctx.stroke();
  }

  // A seeded grain keeps redraws and downloaded postcards identical.
  let seed = 1307;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 3200; i += 1) {
    ctx.fillStyle = i % 3 ? 'rgba(65,59,48,.035)' : 'rgba(255,255,247,.13)';
    const size = 0.5 + random() * 1.2;
    ctx.fillRect(random() * 900, random() * 600, size, size);
  }
  const light = ctx.createLinearGradient(0, 0, 900, 600);
  light.addColorStop(0, 'rgba(255,255,246,.1)');
  light.addColorStop(0.55, 'rgba(255,255,246,0)');
  light.addColorStop(1, 'rgba(54,51,44,.035)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
  backdropCache.set(kind, picture);
  return picture;
}

/** Resolve only the validated, versioned daily manifest; no model URLs or markup. */
export async function prepareScene(input: SceneSpec): Promise<PreparedScene> {
  const pack = getScenePackById(input.packId);
  if (!pack) throw new Error('This illustration uses an unavailable asset pack.');
  const scene = validateScene(input, pack);
  const byId = new Map(pack.assets.map((asset) => [asset.id, asset]));
  const pictures = new Map<string, ScenePicture>();
  await Promise.all(
    [...new Set(scene.nodes.map((node) => node.asset))].map(async (id) => {
      const asset = byId.get(id);
      if (!asset) throw new Error('This illustration contains an unavailable asset.');
      if (asset.kind === 'image' && asset.src) pictures.set(id, await image(asset.src));
      else if (asset.kind === 'emoji' && asset.emoji) pictures.set(id, emojiPicture(asset.emoji));
      else throw new Error('This illustration contains an unavailable asset.');
    }),
  );
  return { scene, pack, pictures, paper: backdrop(scene.backdrop) };
}

/** Fit the fixed 3:2 scene inside the given rectangle, without stretching sprites. */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  prepared: PreparedScene,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0)
    throw new Error('The illustration size is invalid.');
  const scale = Math.min(width / SCENE_WIDTH, height / SCENE_HEIGHT);
  const assets = new Map<string, SceneAsset>(
    prepared.pack.assets.map((asset) => [asset.id, asset]),
  );
  ctx.save();
  try {
    ctx.translate(x + (width - SCENE_WIDTH * scale) / 2, y + (height - SCENE_HEIGHT * scale) / 2);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(prepared.paper, 0, 0);
    for (const node of prepared.scene.nodes) {
      const asset = assets.get(node.asset);
      const picture = prepared.pictures.get(node.asset);
      if (!asset || !picture) throw new Error('This illustration contains an unavailable asset.');
      const w = (node.width / 100) * SCENE_WIDTH;
      const h = w * (asset.height / asset.width);
      ctx.save();
      try {
        ctx.translate((node.x / 100) * SCENE_WIDTH, (node.y / 100) * SCENE_HEIGHT);
        ctx.rotate((node.rotation * Math.PI) / 180);
        ctx.scale(node.flipX ? -1 : 1, 1);
        const transform = ctx.getTransform();
        const pixelScale = Math.hypot(transform.a, transform.b);
        ctx.shadowColor = 'rgba(37,43,46,.17)';
        // Canvas shadows use device pixels, unlike the transformed sprite geometry.
        ctx.shadowBlur = 5 * pixelScale;
        ctx.shadowOffsetY = 3 * pixelScale;
        ctx.drawImage(picture, -w / 2, -h / 2, w, h);
      } finally {
        ctx.restore();
      }
    }
  } finally {
    ctx.restore();
  }
}
