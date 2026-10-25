import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  driftHistoryState,
  driftRouteUrl,
  readDriftRoute,
  sameDriftRoute,
  type DriftRoute,
} from './navigation';

export function useDriftNavigation(beforeNavigation: RefObject<() => void>) {
  const [route, setRoute] = useState(() => readDriftRoute(location.search, history.state));
  const current = useRef(route);
  const generation = useRef(0);
  const navigate = useCallback(
    (next: DriftRoute, replace = false) => {
      const url = driftRouteUrl(location.pathname, next);
      if (
        sameDriftRoute(current.current, next) &&
        location.pathname + location.search + location.hash === url
      )
        return;
      generation.current++;
      beforeNavigation.current();
      history[replace ? 'replaceState' : 'pushState'](driftHistoryState(next), '', url);
      current.current = next;
      setRoute(next);
    },
    [beforeNavigation],
  );
  useLayoutEffect(() => {
    // Initial state has already parsed the link: retain its exact public target,
    // normalize invalid/ambiguous routes, and never briefly write a Home entry.
    history.replaceState(
      driftHistoryState(current.current),
      '',
      driftRouteUrl(location.pathname, current.current),
    );
    const onPop = () => {
      generation.current++;
      beforeNavigation.current();
      const next = readDriftRoute(location.search, history.state);
      current.current = next;
      setRoute(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [beforeNavigation]);
  return { route, navigate, generation };
}
