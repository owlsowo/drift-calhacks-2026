import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/kalam/latin-400.css';
import { PROMPTS } from '../../../packages/game-rules/index';
import { Ocean } from './Ocean';
import { Shore } from './Shore';
import type { CoastPeriod } from './coast-time';
import './style.css';
import './natural.css';
import './daylight-coast.css';

// A development-only art preview. It has no game connection or writing actions.
function CoastPreview() {
  const [period, setPeriod] = useState<CoastPeriod>('day');
  const [paused, setPaused] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const nothing = async () => {};
  return (
    <div className="app-shell sea-world shore-shell" data-time-of-day={period}>
      <Ocean timeOfDay={period} paused={paused} />
      <header className="site-header">
        <span className="wordmark">drift</span>
        <nav aria-label="Coast preview">
          {(['day', 'night'] as const).map((value) => (
            <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>
              {value === 'day' ? 'Day' : 'Night'}
            </button>
          ))}
          <button aria-pressed={paused} onClick={() => setPaused(!paused)}>
            {paused ? 'Resume sea' : 'Pause sea'}
          </button>
        </nav>
      </header>
      <main className="main view-today">
        <Shore
          mode="home"
          prompt={PROMPTS[0]}
          disabled={false}
          busy=""
          actionLabel="Write a beginning"
          onAction={nothing}
          onWrite={nothing}
          onCollection={() => {}}
          headingRef={heading}
        />
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<CoastPreview />);
