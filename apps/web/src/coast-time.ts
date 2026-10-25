export type CoastPeriod = 'day' | 'night';

// Scenery follows the viewer's clock. Prompt days and writing quotas stay on
// their existing server clock, independent of this visual change.
export function coastPeriodAt(date: Date): CoastPeriod {
  const hour = date.getHours();
  return hour >= 6 && hour < 18 ? 'day' : 'night';
}
