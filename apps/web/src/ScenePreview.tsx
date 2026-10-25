// Development-only entry point. Vite's production build only includes index.html.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/kalam/latin-400.css';
import { Postcard } from './Postcard';
import { savePng } from './export';
import { getScenePackById, validateScene } from '../../../packages/scene-contracts/index';
import examples from '../../../evals/scene-results.json';
import './style.css';
import './natural.css';
import './postcard-scene.css';

const cards = examples.flatMap((example) => {
  if (example.status !== 'valid' || !example.scene) return [];
  const pack = getScenePackById(example.scene.packId);
  return pack ? [{ ...example, scene: validateScene(example.scene, pack) }] : [];
});

createRoot(document.getElementById('root')!).render(
  <main className="sea-world scene-study">
    <header>
      <h1>Postcards from twelve words</h1>
      <p>Synthetic demo exchanges · live Claude compositions</p>
    </header>
    <div className="scene-study-grid">
      {cards.map(({ fixture, scene, elapsedMs }) => (
        <section key={fixture.id}>
          <Postcard card={fixture} scene={scene} />
          <div className="scene-study-actions">
            <span>{(elapsedMs / 1000).toFixed(2)} seconds</span>
            <button onClick={() => void savePng(fixture, scene)}>Save postcard</button>
          </div>
        </section>
      ))}
    </div>
  </main>,
);

const style = document.createElement('style');
style.textContent = `
  body { margin:0; background:#172938; }
  .scene-study { padding:clamp(18px,4vw,54px); min-height:100vh; }
  .scene-study header { margin:0 0 32px; color:#ece8da; }
  .scene-study h1 { font:400 clamp(26px,4vw,40px)/1.2 Georgia,serif; margin:0 0 12px; }
  .scene-study header p { font:14px/1.5 Georgia,serif; opacity:.7; }
  .scene-study-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:24px; max-width:1540px; }
  .scene-study .postcard { background-image:linear-gradient(115deg,#f5f0e0ed,#e5deceed),url('/assets/paper-texture.jpg'); box-shadow:0 8px 25px #0004; }
  .scene-study .postcard .card-half p { font-size:24px; }
  .scene-study .postcard .contribution-note { display:none; }
  .scene-study-actions { display:flex; justify-content:space-between; gap:12px; color:#e1e4df; margin-top:15px; font:13px Georgia,serif; align-items:center; }
  .scene-study-actions button { padding:10px 16px; color:#e1e4df; border:1px solid #8b9598; border-radius:2px; background:none; font:inherit; cursor:pointer; }
  @media(max-width:900px) { .scene-study-grid { grid-template-columns:1fr; max-width:520px; margin:auto; } }
`;
document.head.appendChild(style);
