export function createOcean(canvas: HTMLCanvasElement, options?: {
  paused?: boolean;
  signal?: AbortSignal;
  onReady?: () => void;
  onError?: (error: unknown) => void;
}): Promise<{ setPaused: (paused: boolean) => void; destroy: () => void }>;
