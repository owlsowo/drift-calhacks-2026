import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/kalam/latin-400.css';
import { Ocean } from './Ocean';
import { WorldBottles } from './WorldBottles';
import { ShoreScene } from './shore-scene';
import { BottleRitual, type BottleRitualKind } from './BottleRitual';
import './style.css';
import './natural.css';
import './daylight-coast.css';

// Development-only interaction preview: no database, verification or model connection.
function BottlePreview() {
  const [scene] = useState(() => new ShoreScene());
  const [ritual, setRitual] = useState<BottleRitualKind | null>(null);
  const [opened, setOpened] = useState(0);
  const [paused, setPaused] = useState(false);
  const [period, setPeriod] = useState<'day' | 'night'>('day');
  useEffect(() => scene.start(), [scene]);
  useEffect(() => scene.setPaused(paused), [scene, paused]);
  return (
    <div
      className={`app-shell sea-world shore-shell${ritual ? ' has-bottle-ritual' : ''}`}
      data-time-of-day={period}
    >
      <Ocean scene={scene} timeOfDay={period} paused={paused} />
      <WorldBottles scene={scene} />
      <header className="site-header">
        <span className="wordmark">drift</span>
        <nav aria-label="Bottle preview">
          <button onClick={() => setRitual('pickup')}>Pick up</button>
          <button onClick={() => setRitual('release')}>Release bottle</button>
          <button onClick={() => setPaused(!paused)}>{paused ? 'Resume sea' : 'Pause sea'}</button>
          <button onClick={() => setPeriod(period === 'day' ? 'night' : 'day')}>
            {period === 'day' ? 'Night' : 'Day'}
          </button>
        </nav>
      </header>
      <output aria-label="Opened bottles">{opened}</output>
      {ritual && (
        <BottleRitual
          kind={ritual}
          phase="moving"
          worldScene={scene}
          onComplete={() => {
            if (ritual === 'pickup') setOpened((n) => n + 1);
            setRitual(null);
          }}
          onCancel={() => setRitual(null)}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<BottlePreview />);
