import { useEffect, useState } from 'react';
import { coastPeriodAt } from './coast-time';

export function useCoastPeriod() {
  const [period, setPeriod] = useState(() => coastPeriodAt(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      setPeriod(coastPeriodAt(new Date()));
      clearTimeout(timer);
      // Check on the next local-clock minute, including the 06:00/18:00 boundary.
      timer = setTimeout(update, 60_000 - (Date.now() % 60_000));
    };
    update();
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return period;
}
