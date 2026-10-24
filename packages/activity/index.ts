export const ACTIVITY_METRICS = [
  'roundStarted',
  'catchAssigned',
  'setupPublished',
  'peerCompleted',
  'teamCompleted',
  'sampleCompleted',
  'setupOpened',
  'replyOpened',
  'pngRequested',
  'wordsCopied',
  'nativeShareResolved',
  'linkCopied',
  'completionLe30s',
  'completionLe120s',
  'completionOver120s',
] as const;
export type ActivityMetric = (typeof ACTIVITY_METRICS)[number];
export const CARD_ACTIONS = {
  open: 1,
  png_requested: 2,
  words_copied: 4,
  native_share_resolved: 8,
  link_copied: 16,
} as const;
export type CardAction = keyof typeof CARD_ACTIONS;
