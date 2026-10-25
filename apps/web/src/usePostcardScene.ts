import { useMemo } from 'react';
import {
  getScenePackById,
  validateScene,
  type SceneSpec,
} from '../../../packages/scene-contracts/index';

type SceneRow = { cardId: string; packId: string; sceneJson: string };
type SceneStatusRow = { cardId: string; state: string };
export type IllustrationStatus = 'idle' | 'pending' | 'ready' | 'failed';

export function usePostcardScene(
  cardId: string | undefined,
  rows: SceneRow[],
  statuses: SceneStatusRow[],
) {
  const row = rows.find((item) => item.cardId === cardId);
  const savedStatus = statuses.find((item) => item.cardId === cardId)?.state;
  const scene = useMemo<SceneSpec | undefined>(() => {
    if (!row) return;
    try {
      const pack = getScenePackById(row.packId);
      if (pack) return validateScene(JSON.parse(row.sceneJson), pack);
    } catch {
      // An unavailable/older contract must never stop the original letter from opening.
    }
  }, [row?.sceneJson, row?.packId]);
  // Generation belongs to the accepted ending, so either author can leave or refresh
  // without losing it. Opening a postcard never starts another paid request.
  const status: IllustrationStatus = scene
    ? 'ready'
    : row || savedStatus === 'failed' || savedStatus === 'ready'
      ? 'failed'
      : savedStatus === 'pending'
        ? 'pending'
        : 'idle';
  return { scene, status };
}
