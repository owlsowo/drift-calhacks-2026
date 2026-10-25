export type DriftRoute =
  | { view: 'today' }
  | { view: 'collection' }
  | { view: 'card'; cardId: string }
  | { view: 'beginning'; beginningId: string }
  | { view: 'play'; roundId: string };

const HISTORY_KEY = '__driftNavigation';
const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);

export function readDriftRoute(search: string, state: unknown): DriftRoute {
  const params = new URLSearchParams(search);
  const keys = ['card', 'bottle', 'view'].filter((key) => params.has(key));
  if (keys.length === 1) {
    const key = keys[0];
    const values = params.getAll(key);
    if (values.length !== 1) return { view: 'today' };
    if (key === 'card' && validId(values[0])) return { view: 'card', cardId: values[0] };
    if (key === 'bottle' && validId(values[0]))
      return { view: 'beginning', beginningId: values[0] };
    if (key === 'view' && values[0] === 'bottles') return { view: 'collection' };
    return { view: 'today' };
  }
  if (keys.length || search) return { view: 'today' };
  const saved =
    state && typeof state === 'object'
      ? (state as Record<string, unknown>)[HISTORY_KEY]
      : undefined;
  if (saved && typeof saved === 'object') {
    const value = saved as Record<string, unknown>;
    if (value.version === 1 && value.view === 'play' && validId(value.roundId))
      return { view: 'play', roundId: value.roundId };
  }
  return { view: 'today' };
}

export function driftRouteUrl(pathname: string, route: DriftRoute): string {
  if (route.view === 'card') return `${pathname}?card=${encodeURIComponent(route.cardId)}`;
  if (route.view === 'beginning')
    return `${pathname}?bottle=${encodeURIComponent(route.beginningId)}`;
  if (route.view === 'collection') return `${pathname}?view=bottles`;
  return pathname;
}

export function driftHistoryState(route: DriftRoute): object {
  return { [HISTORY_KEY]: { version: 1, ...route } };
}

export function sameDriftRoute(a: DriftRoute, b: DriftRoute): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
