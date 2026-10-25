export function createOcean(canvas: HTMLCanvasElement, options?: {
  paused?: boolean;
  scene?: import('../shore-scene').ShoreScene;
  timeOfDay?: 'day' | 'night';
  signal?: AbortSignal;
  onReady?: () => void;
  onError?: (error: unknown) => void;
}): Promise<{
  setPaused: (paused: boolean) => void;
  setTimeOfDay: (period: 'day' | 'night') => void;
  destroy: () => void;
}>;
