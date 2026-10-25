import { memo, type ReactNode } from 'react';
import type { Card } from '../../../packages/game-rules/index';
import type { SceneSpec } from '../../../packages/scene-contracts/index';
import { submissionTime } from './submission-time';
import { SceneIllustration } from './SceneIllustration';
import { SceneLoading } from './SceneLoading';
import type { IllustrationStatus } from './usePostcardScene';

export const Postcard = memo(function Postcard({
  card,
  scene,
  illustrationStatus = 'idle',
  connected = true,
  children,
}: {
  card: Card;
  role?: string;
  scene?: SceneSpec;
  illustrationStatus?: IllustrationStatus;
  connected?: boolean;
  children?: ReactNode;
}) {
  const hasIllustration =
    !!scene || illustrationStatus === 'pending' || illustrationStatus === 'failed';
  return (
    <article
      className={`postcard${hasIllustration ? ' postcard-illustrated' : ''}`}
      aria-label="Your completed postcard"
      data-card-id={card.id}
    >
      <time className="letter-date" dateTime={new Date(card.createdMs).toISOString()}>
        {new Date(card.createdMs).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}
      </time>
      {card.seeded && (
        <small className="starter-source">
          {card.starterKind === 'team' ? 'Beginning by the Drift team' : 'Sample beginning'}
        </small>
      )}
      {scene ? (
        <SceneIllustration scene={scene} />
      ) : hasIllustration ? (
        <SceneLoading failed={illustrationStatus === 'failed'} connected={connected} />
      ) : null}
      <div className="card-half setup-half">
        <p>{card.setup}</p>
      </div>
      <div className="letter-fold" aria-hidden="true" />
      <div className="card-half">
        <p>{card.reply}</p>
      </div>
      <p className="contribution-note">
        <time dateTime={new Date(card.createdMs).toISOString()}>
          {submissionTime(card.createdMs)}
        </time>
      </p>
      {children}
    </article>
  );
});
