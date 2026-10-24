import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  Copy,
  Download,
  Flag,
  HelpCircle,
  LoaderCircle,
  Mail,
  RotateCcw,
  Share2,
  Shuffle,
  Sparkles,
  Trash2,
  Waves,
  X,
} from 'lucide-react';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/500.css';
import { game, persist, saved } from './game';
import { words, dayOf, type Prompt, type Card } from '../../../packages/game-rules/index';
import { savePng, shareCard, cardText, copyText } from './export';
import './style.css';
import { HelloPanel } from './HelloPanel';
import { friendlyError } from './errors';
import { Shore } from './Shore';
import { Ocean } from './Ocean';
import { PaperNote } from './PaperNote';
import { ShoreGate } from './ShoreGate';

function Bottle({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? 'bottle-small' : 'bottle-art'}
      viewBox="0 0 440 360"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="bottle-shadow"
        d="M90 301c57-12 199-7 241 5 22 7-30 19-113 19S61 308 90 301Z"
        fill="#c8d8ce"
      />
      <g className="floating-bottle" transform="rotate(18 220 165)">
        <path
          d="M196 47v71c-3 13-13 21-28 34-14 12-20 25-20 43v69c0 18 13 31 31 31h82c18 0 31-13 31-31v-69c0-18-6-31-20-43-15-13-25-21-28-34V47"
          fill="#dce9dc"
          fillOpacity=".7"
          stroke="#245b56"
          strokeWidth="3"
        />
        <path
          d="M192 51h56M196 70h48M205 87v40c-4 16-15 26-29 38"
          stroke="#649589"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M193 34h54v20h-54z" fill="#c99463" stroke="#245b56" strokeWidth="3" />
        <path d="M200 37v12m10-12v12m12-12v12m12-12v12" stroke="#936940" strokeWidth="1.5" />
        <path d="M170 208h102v57H170z" fill="#faf5e7" stroke="#79978a" strokeWidth="1.5" />
        <path
          d="m173 210 47 29 49-29m-96 51 33-26m62 26-32-26"
          stroke="#79978a"
          strokeWidth="1.5"
        />
        <path d="M164 193c25 8 65-8 112 0" stroke="#81a69a" strokeWidth="2" />
        <path
          d="M280 224v34c0 15-6 24-15 26"
          stroke="#a3bfb1"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M50 277c31-13 46 13 76 0s44-13 74 0 45 13 76 0 46-13 76 0 29 10 46 2M24 296c32-13 49 13 80 0m219 7c23-9 41 3 70-4"
        stroke="#769d91"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="m91 93 4-14m-13 8 17 5M326 112l5-15m-12 5 17 6"
        stroke="#b5774e"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M326 62c8-8 13-7 17-2m-3-1c6-7 12-8 18-4"
        stroke="#5b8076"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="99" cy="221" r="4" stroke="#95b3a7" strokeWidth="2" />
      <circle cx="333" cy="207" r="7" stroke="#95b3a7" strokeWidth="2" />
    </svg>
  );
}
function Postcard({
  card,
  example = false,
  role = 'public',
}: {
  card: Card;
  example?: boolean;
  role?: string;
}) {
  return (
    <article
      className={`postcard ${example ? 'example-card' : ''}`}
      aria-label={example ? 'Example postcard' : 'Your completed postcard'}
      data-card-id={card.id}
    >
      <div className="postcard-top">
        <span className="eyebrow">{example ? 'A LITTLE EXAMPLE' : 'A LITTLE STORY, TOGETHER'}</span>
        <div className="postmark" aria-hidden="true">
          <span>DRIFT</span>
          <Waves size={23} />
          <small>
            {example
              ? 'NO. 01'
              : new Date(card.createdMs).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
          </small>
        </div>
      </div>
      <div className="card-half setup-half">
        <span className="eyebrow">
          01 /{' '}
          {card.seeded
            ? card.starterKind === 'team'
              ? 'THE DRIFT TEAM’S SETUP'
              : 'A SAMPLE STARTER'
            : role === 'setup'
              ? 'YOUR SETUP'
              : 'A STRANGER’S SETUP'}
        </span>
        <p>{card.setup}</p>
      </div>
      <div className="perforation" />
      <div className="card-half">
        <span className="eyebrow">
          02 /{' '}
          {role === 'reply'
            ? 'YOUR ENDING'
            : role === 'setup'
              ? 'A STRANGER’S ENDING'
              : 'ANOTHER HUMAN’S ENDING'}
        </span>
        <p>{card.reply}</p>
      </div>
      <div className="postcard-bottom">
        <span>
          {card.seeded && card.starterKind !== 'team'
            ? 'A SAMPLE BEGINNING. YOUR ENDING.'
            : 'TWO PEOPLE. TWELVE WORDS.'}
        </span>
        <span className="card-wave">∿∿∿</span>
      </div>
    </article>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      requestAnimationFrame(() => {
        const destination = trigger?.isConnected
          ? trigger
          : document.querySelector<HTMLElement>('main h1');
        destination?.focus();
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <button className="icon-button close" onClick={onClose} aria-label="Close dialog">
        <X size={20} />
      </button>
      <h2 id="modal-title">{title}</h2>
      {children}
    </dialog>
  );
}
function App() {
  const s = useSyncExternalStore(game.subscribe, game.snapshot);
  const [view, setView] = useState<'today' | 'play' | 'collection' | 'card'>('today');
  const [selected, setSelected] = useState('');
  const [modal, setModal] = useState<'how' | 'report' | 'hide' | 'privacy' | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [draftState, setDraft] = useState({ key: '', text: '' });
  const [clock, setClock] = useState(Date.now());
  const [reveal, setReveal] = useState('');
  const [seaPaused, setSeaPaused] = useState(false);
  const [gateReady, setGateReady] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const nowDay = dayOf(clock);
  const active = s.rounds.find(
    (r) => r.stage !== 'done' && (r.day === nowDay || (r.stage === 'reply' && r.leaseMs > clock)),
  );
  const prompt =
    active && view === 'play'
      ? (JSON.parse(active.promptJson) as Prompt)
      : s.today
        ? (JSON.parse(s.today.promptJson) as Prompt)
        : undefined;
  const assignment = s.assignments.find((a) => a.roundId === active?.id);
  const mine = s.ownership
    .filter((o) => !o.hidden)
    .flatMap((o) => {
      const card = s.cards.find((c) => c.id === o.id);
      return card ? [{ card, role: o.role }] : [];
    })
    .sort((a, b) => b.card.createdMs - a.card.createdMs);
  const card = s.cards.find((c) => c.id === selected && !s.reported.some((r) => r.id === c.id));
  const ownership = s.ownership.find((o) => o.id === selected);
  const cardId = card?.id;
  const ownsVisibleCard = !!ownership && !ownership.hidden;
  const recordOpen = useCallback(() => {
    if (cardId && ownsVisibleCard && s.connected) void game.cardAction(cardId, 'open');
  }, [cardId, ownsVisibleCard, s.connected]);
  const currentDraftKey = active
    ? `drift:draft:${s.identity}:${active.id}:${active.stage === 'reply' ? active.assignmentId : 'setup'}`
    : '';
  const draft = draftState.key === currentDraftKey ? draftState.text : '';
  const count = words(draft).length;
  const dailyRounds = s.rounds.filter((r) => r.day === nowDay).length;
  // The server-finalized card marker awards one daily stamp, even if a card is later hidden.
  const stampedToday = s.rounds.some((r) => r.day === nowDay && !!r.cardId);
  const stampedDays = new Set(s.rounds.filter((r) => !!r.cardId).map((r) => r.day)).size;
  const waiting = s.outgoing.filter((o) => !o.cardId && o.day === nowDay);
  const returnedToday = mine.filter(
    (o) => o.role === 'setup' && dayOf(o.card.createdMs) === nowDay,
  ).length;
  const emptyTide = error.startsWith('No bottles are available');
  const remaining = active
    ? Math.max(0, Math.min(600, Math.ceil((active.leaseMs - clock) / 1000)))
    : 0;
  const checksExhausted =
    active && (active.stage === 'write' ? active.setupAttempts : active.replyAttempts) >= 3;
  useEffect(() => {
    const update = () => setClock(Date.now() + s.clockOffsetMs);
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [s.clockOffsetMs]);
  useEffect(() => {
    setDraft({ key: currentDraftKey, text: currentDraftKey ? saved(currentDraftKey) : '' });
    setError('');
  }, [currentDraftKey]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('card');
    if (id) {
      setSelected(id);
      setView('card');
    }
  }, []);
  useEffect(() => {
    heading.current?.focus();
  }, [view, active?.stage]);
  const changeDraft = (value: string) => {
    const limited = [...value].slice(0, 160).join('');
    setDraft({ key: currentDraftKey, text: limited });
    if (currentDraftKey) persist(currentDraftKey, limited);
  };
  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(label);
    setError('');
    try {
      await fn();
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Your shore check')) setGateReady(false);
      setError(friendlyError(e));
    } finally {
      setBusy('');
    }
  };
  async function begin() {
    await run('Opening your bottle…', async () => {
      await game.start();
      setReveal('');
      setView('play');
    });
  }
  async function beginCatch() {
    await run('Finding a bottle…', async () => {
      await game.startCatching();
      setReveal('');
      setView('play');
    });
  }
  async function submit() {
    if (!active) return;
    await run(
      active.stage === 'write' ? 'Checking your six words…' : 'Sealing your postcard…',
      async () => {
        if (active.stage === 'reply') setReveal('pending:' + active.id);
        try {
          await game.paid(active.stage === 'write' ? 'setup' : 'reply', active.id, draft);
        } catch (error) {
          const completed = game.snapshot().rounds.find((r) => r.id === active.id)?.cardId;
          if (active.stage === 'reply' && completed) {
            setSelected(completed);
            setView('card');
            setError('');
            return;
          }
          throw error;
        }
        if (active.stage === 'reply') {
          // Find by live state, because procedure and subscription may arrive in either order.
          const find = () => game.snapshot().rounds.find((r) => r.id === active.id)?.cardId;
          const id = find();
          if (id) {
            setSelected(id);
            setView('card');
          } else {
            setReveal('pending:' + active.id);
          }
        } else if (active.cardId) {
          setView('today');
          setToast('Your bottle is out at sea.');
        }
      },
    );
  }
  useEffect(() => {
    if (view !== 'play' || !reveal.startsWith('pending:')) return;
    const round = s.rounds.find((r) => r.id === reveal.slice(8));
    if (round?.cardId) {
      setSelected(round.cardId);
      setView('card');
      setReveal('');
      setError('');
    }
  }, [s.rounds, reveal, view]);
  const controlsDisabled = !!busy || !s.connected || (!!s.service?.botRequired && !gateReady);
  const reset = new Date((nowDay + 1) * 86400000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  function showCard(id: string) {
    setSelected(id);
    setView('card');
    setError('');
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to the game
      </a>
      <div
        className={`app-shell sea-world ${view === 'today' || (view === 'play' && active?.stage === 'catch') ? 'shore-shell' : ''}`}
      >
        <Ocean paused={seaPaused} />
        <header className="site-header">
          <button
            className="wordmark"
            onClick={() => {
              setView('today');
              setError('');
            }}
            aria-label="Drift home"
          >
            drift<span>∿</span>
          </button>
          <nav aria-label="Main navigation">
            <button
              className={view === 'today' || view === 'play' ? 'nav-active' : ''}
              onClick={() => setView(active ? 'play' : 'today')}
            >
              Today’s bottle
            </button>
            <button
              className={view === 'collection' ? 'nav-active' : ''}
              onClick={() => setView('collection')}
            >
              My postcards {mine.length > 0 && <span className="nav-count">{mine.length}</span>}
            </button>
          </nav>
          <button
            className="icon-button help"
            onClick={() => setModal('how')}
            aria-label="How to play"
          >
            <HelpCircle size={21} />
          </button>
        </header>
        {s.service?.sandbox && (
          <div className="sandbox-banner">
            LOCAL SANDBOX <span>•</span>{' '}
            {s.service.aiReady
              ? 'Claude checks configured'
              : 'AI checks are off. Sample fixtures are labeled.'}
          </div>
        )}
        {!s.storageAvailable && (
          <div className="connection-banner" role="status">
            This browser can’t save progress. Keep this tab open; refreshing may lose your words.
          </div>
        )}
        {s.connected && s.service?.paused && (
          <div className="connection-banner" role="status">
            The tide is taking a short break. You can keep writing and save existing postcards.
          </div>
        )}
        {!s.connected && (
          <div className="connection-banner" role="status">
            {s.connecting ? <LoaderCircle className="spin" size={16} /> : <Waves size={16} />}{' '}
            {s.error || 'Finding the shore…'}
            {!s.connecting && <button onClick={() => game.reconnect()}>Reconnect</button>}
          </div>
        )}
        {s.connected && s.service?.botRequired && !gateReady && (
          <ShoreGate onVerified={() => setGateReady(true)} />
        )}
        <main id="main" className={`main view-${view}`}>
          {view === 'today' && (
            <Shore
              mode="home"
              prompt={prompt}
              disabled={
                controlsDisabled || !prompt || (!active && dailyRounds >= 3) || !!s.service?.paused
              }
              busy={busy}
              actionLabel={
                active
                  ? 'Pick up where you left off'
                  : dailyRounds >= 3
                    ? 'All three stories are tucked away'
                    : stampedToday
                      ? 'Write another little story'
                      : 'Write my six words'
              }
              onAction={beginCatch}
              onWrite={begin}
              onCollection={() => setView('collection')}
              count={mine.length}
              returnedCount={returnedToday}
              empty={emptyTide}
              headingRef={heading}
            />
          )}
          {view === 'play' && prompt && (
            <section className={`play-layout ${active?.stage === 'catch' ? 'shore-play' : ''}`}>
              <div className="play-margin">
                <span className="eyebrow">TODAY’S LITTLE ADVENTURE</span>
                <h2>{prompt.title}</h2>
                <p>{prompt.scene}</p>
                <ol className="steps">
                  {active && !active.setupId && (active.stage === 'reply' || active.cardId) ? (
                    <>
                      <li className="complete">
                        <span>
                          <Check size={15} />
                        </span>
                        Their beginning
                      </li>
                      <li className={active.stage === 'reply' ? 'current' : 'complete'}>
                        <span>2</span>Your six-word ending
                      </li>
                      <li className={active.stage === 'write' ? 'current' : ''}>
                        <span>3</span>Pass a bottle on
                      </li>
                    </>
                  ) : (
                    <>
                      <li className={active?.stage === 'write' ? 'current' : 'complete'}>
                        <span>{active?.stage === 'write' ? '1' : <Check size={15} />}</span>Your six
                        words
                      </li>
                      <li
                        className={
                          active?.stage === 'catch' || active?.stage === 'reply' ? 'current' : ''
                        }
                      >
                        <span>2</span>Their story, your ending
                      </li>
                      <li>
                        <span>3</span>A postcard, together
                      </li>
                    </>
                  )}
                </ol>
                <div className="margin-note">
                  <Waves size={24} />
                  <p>
                    A little weird is welcome.
                    <br />A little imperfect, too.
                  </p>
                </div>
              </div>
              <div className="writing-desk">
                {!active ? (
                  <div className="empty-state">
                    <Mail size={38} />
                    <h1 ref={heading} tabIndex={-1}>
                      A fresh tide.
                    </h1>
                    <p>
                      This prompt has closed, or your round is finished. Your saved words stay on
                      this browser.
                    </p>
                    <button className="button primary" disabled={controlsDisabled} onClick={begin}>
                      Open today’s bottle <ArrowRight size={18} />
                    </button>
                  </div>
                ) : active.stage === 'catch' ? (
                  <Shore
                    mode="catch"
                    hasOutgoing={!!active.setupId}
                    prompt={prompt}
                    disabled={controlsDisabled}
                    busy={busy}
                    actionLabel="Catch a bottle"
                    onAction={() => run('Finding a bottle…', () => game.claim(active.id))}
                    onWrite={begin}
                    onCollection={() => setView('collection')}
                    count={mine.length}
                    returnedCount={returnedToday}
                    empty={emptyTide}
                    headingRef={heading}
                  />
                ) : (
                  <PaperNote key={currentDraftKey} closed={active.stage === 'reply' && !draft}>
                    <div className="desk-heading">
                      <span className="eyebrow">
                        {active.stage === 'write'
                          ? '01 / START SOMETHING SMALL'
                          : '02 / MAKE IT YOURS'}
                      </span>
                      <span className="draft-saved">
                        <Check size={13} />{' '}
                        {s.storageAvailable ? 'Draft saved here' : 'Kept in this tab'}
                      </span>
                    </div>
                    <h1 ref={heading} tabIndex={-1}>
                      {active.stage === 'write' ? prompt.setup : prompt.reply}
                    </h1>
                    {active.stage === 'reply' && assignment && (
                      <div className="caught-note">
                        <div>
                          <span className="eyebrow">
                            {assignment.seeded
                              ? assignment.starterKind === 'team'
                                ? 'WRITTEN BY THE DRIFT TEAM'
                                : 'SAMPLE STARTER · DEVELOPMENT FIXTURE'
                              : 'WRITTEN BY ANOTHER WRITER'}
                          </span>
                          <span className={`lease ${remaining < 60 ? 'urgent' : ''}`}>
                            {remaining > 0
                              ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} left`
                              : 'Bottle expired'}
                          </span>
                        </div>
                        <p>{assignment.text}</p>
                      </div>
                    )}
                    <label className="sr-only" htmlFor="six-words">
                      {active.stage === 'write' ? 'Your six-word setup' : 'Your six-word ending'}
                    </label>
                    <textarea
                      id="six-words"
                      className="story-input"
                      value={draft}
                      onChange={(e) => changeDraft(e.target.value)}
                      placeholder={
                        active.stage === 'write'
                          ? 'A very small beginning…'
                          : 'Your unexpected ending…'
                      }
                      rows={4}
                      aria-describedby="word-help"
                      spellCheck
                      autoComplete="off"
                    />
                    <div className="word-feedback" id="word-help">
                      <div className={`word-dots ${count > 6 ? 'over' : ''}`} aria-hidden="true">
                        {Array.from({ length: 6 }, (_, i) => (
                          <span key={i} className={i < count ? 'filled' : ''} />
                        ))}
                      </div>
                      <span className={count === 6 ? 'count-done' : count > 6 ? 'count-over' : ''}>
                        {count === 6 ? (
                          <>
                            <Check size={14} /> Six words. Just right.
                          </>
                        ) : (
                          `${count} / 6 words`
                        )}
                      </span>
                      <span className="character-count">{[...draft].length}/160</span>
                    </div>
                    {active.stage === 'reply' && (
                      <div className="nudge-area">
                        <button
                          className="nudge-button"
                          disabled={
                            controlsDisabled ||
                            active.nudges >= 2 ||
                            !s.service?.aiReady ||
                            remaining <= 0
                          }
                          onClick={() =>
                            run('Finding a little spark…', async () => {
                              await game.paid('nudge', active.id, draft);
                            })
                          }
                        >
                          <Sparkles size={16} />
                          {busy === 'Finding a little spark…'
                            ? 'Finding a little spark…'
                            : 'A little nudge'}
                          <span>{2 - active.nudges} left</span>
                        </button>
                        {active.hint && (
                          <aside className="nudge" aria-live="polite">
                            <span className="eyebrow">
                              <Sparkles size={12} /> AI GUIDANCE
                            </span>
                            <p>{active.hint}</p>
                            <small>The ending is still yours.</small>
                          </aside>
                        )}
                      </div>
                    )}
                    {checksExhausted && (
                      <div className="quota-recovery">
                        <p>
                          This round has used its three story checks. Your words are saved here.
                        </p>
                        <div>
                          <button
                            className="text-button"
                            onClick={() =>
                              run('Copying…', async () => {
                                await copyText(draft);
                                setToast('Draft copied');
                              })
                            }
                          >
                            <Copy size={14} />
                            Copy my draft
                          </button>
                          <button
                            className="text-button"
                            disabled={controlsDisabled}
                            onClick={() =>
                              run('Closing this round…', async () => {
                                await game.abandon(active.id);
                                setView('today');
                                setToast('Round closed. Your draft is kept on this browser.');
                              })
                            }
                          >
                            End this round <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="desk-actions">
                      <button
                        className="button primary"
                        onClick={submit}
                        disabled={
                          controlsDisabled ||
                          !!checksExhausted ||
                          count !== 6 ||
                          (active.stage === 'reply' && remaining <= 0)
                        }
                      >
                        {busy ? (
                          <>
                            <LoaderCircle className="spin" size={18} />
                            {busy}
                          </>
                        ) : (
                          <>
                            {active.stage === 'write' ? 'Toss my bottle' : 'Seal our postcard'}
                            <ArrowRight size={18} />
                          </>
                        )}
                      </button>
                      {active.stage === 'reply' && (
                        <div className="minor-actions">
                          {remaining > 0 ? (
                            <button
                              disabled={controlsDisabled || active.skips >= 1}
                              onClick={() =>
                                run('Letting this one drift…', () => game.skip(active.id))
                              }
                            >
                              <Shuffle size={15} />
                              {active.skips ? 'Skip used' : 'Skip this bottle'}
                            </button>
                          ) : (
                            <button
                              disabled={controlsDisabled}
                              onClick={() =>
                                run('Finding a fresh bottle…', () => game.claim(active.id))
                              }
                            >
                              <RotateCcw size={15} />
                              Catch a fresh bottle
                            </button>
                          )}
                          <button disabled={controlsDisabled} onClick={() => setModal('report')}>
                            <Flag size={14} />
                            Report
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="privacy-note">
                      Your words may appear on a public share card. Leave out personal details.{' '}
                      <button onClick={() => setModal('privacy')}>How this works</button>
                    </p>
                    <details className="word-rules">
                      <summary>What counts as a word?</summary>
                      <p>
                        Spaces separate words. Apostrophes and hyphens stay together. Emoji on their
                        own don’t count. Exactly six words, up to 160 characters.
                      </p>
                    </details>
                  </PaperNote>
                )}
              </div>
            </section>
          )}
          {view === 'card' && (
            <section className="reveal-layout">
              <div className="reveal-copy">
                <span className="eyebrow">
                  {card ? 'SOMETHING GOOD WASHED ASHORE' : 'A NOTE FROM THE SHORE'}
                </span>
                <h1 ref={heading} tabIndex={-1}>
                  {card ? (
                    card.seeded && card.starterKind !== 'team' ? (
                      <>
                        A little beginning.
                        <br /> <em>A new ending.</em>
                      </>
                    ) : ownership ? (
                      <>
                        Well, look what
                        <br /> <em>we made.</em>
                      </>
                    ) : (
                      <>
                        Two strangers.
                        <br /> <em>One little story.</em>
                      </>
                    )
                  ) : !s.connected ? (
                    'A postcard is washing ashore.'
                  ) : (
                    'This postcard has drifted on.'
                  )}
                </h1>
                <p>
                  {card
                    ? card.seeded && card.starterKind !== 'team'
                      ? 'A development sample, finished with your own six words.'
                      : ownership
                        ? 'Two little lines. One story that belongs to both of you.'
                        : 'Six words from each writer. A tiny collaboration, shared with you.'
                    : !s.connected
                      ? 'Opening this postcard. Your connection needs a moment.'
                      : 'It may have been hidden by an author, or the link may be incomplete.'}
                </p>
                {card && (
                  <>
                    <div className="share-actions">
                      <button
                        className="button primary"
                        onClick={() =>
                          run('Opening share…', async () => {
                            try {
                              const msg = await shareCard(card);
                              setToast(msg === 'Shared' ? 'Share sheet opened' : msg);
                              if (ownership)
                                void game.cardAction(
                                  card.id,
                                  msg === 'Shared' ? 'native_share_resolved' : 'link_copied',
                                );
                            } catch (e) {
                              if ((e as Error).name !== 'AbortError') throw e;
                            }
                          })
                        }
                        disabled={!!busy}
                      >
                        <Share2 size={17} />
                        {ownership ? 'Share our story' : 'Pass this story on'}
                      </button>
                      <button
                        className="button secondary"
                        onClick={() =>
                          run('Making your image…', async () => {
                            await savePng(card);
                            setToast('Postcard image saved');
                            if (ownership) void game.cardAction(card.id, 'png_requested');
                          })
                        }
                        disabled={!!busy}
                      >
                        <Download size={17} />
                        Save image
                      </button>
                      <button
                        className="text-button"
                        onClick={() =>
                          run('Copying…', async () => {
                            await copyText(cardText(card));
                            setToast('Story copied');
                            if (ownership) void game.cardAction(card.id, 'words_copied');
                          })
                        }
                      >
                        <Copy size={15} />
                        Copy the words
                      </button>
                    </div>
                    {
                      <div className="card-management">
                        {ownership && (
                          <button onClick={() => setModal('hide')}>
                            <Trash2 size={14} />
                            Hide this postcard
                          </button>
                        )}
                        <button onClick={() => setModal('report')}>
                          <Flag size={14} />
                          Report
                        </button>
                      </div>
                    }
                    {s.service?.helloEnabled && ownership && !card.seeded && (
                      <HelloPanel
                        cardId={card.id}
                        invitation={s.hellos.find((h) => h.cardId === card.id)}
                        connected={s.connected}
                        time={clock}
                      />
                    )}
                    <div className="return-note">
                      <Mail size={19} />
                      <p>
                        {waiting.length
                          ? 'Your own bottle is still out there. If someone finishes it, it’ll arrive in My postcards.'
                          : 'Every story is better with another human.'}
                      </p>
                    </div>
                    {active?.stage === 'write' && active.cardId === card.id && (
                      <div className="pass-it-on">
                        <p>Want to leave six words for the next person?</p>
                        <button
                          className="button primary"
                          onClick={begin}
                          disabled={controlsDisabled}
                        >
                          Toss my own bottle <ArrowRight size={17} />
                        </button>
                        <button
                          className="text-button"
                          disabled={controlsDisabled}
                          onClick={() =>
                            run('Keeping your postcard…', async () => {
                              await game.abandon(active.id);
                              setView('today');
                            })
                          }
                        >
                          Keep this story. Maybe later.
                        </button>
                      </div>
                    )}
                  </>
                )}
                <button className="text-button back-link" onClick={() => setView('today')}>
                  {card ? (
                    <>
                      <ArrowRight size={16} />
                      Back to the shore
                    </>
                  ) : (
                    <>
                      <ChevronLeft size={16} />
                      Back to today
                    </>
                  )}
                </button>
              </div>
              {card && (
                <div className="reveal-art">
                  <PaperNote key={card.id} postcard onOpen={recordOpen}>
                    <Postcard card={card} role={ownership?.role ?? 'public'} />
                  </PaperNote>
                  <div className="human-seal">
                    <span>✓</span>{' '}
                    {card.seeded
                      ? card.starterKind === 'team'
                        ? 'A team-written beginning. A human ending.'
                        : 'A sample beginning. A writer’s ending.'
                      : 'Made by two humans. Kept by both.'}
                  </div>
                  {ownership?.role === 'reply' && (
                    <div className="stamp-receipt">
                      <Check size={12} /> Today’s stamp is yours. One per day, however many stories.
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
          {view === 'collection' && (
            <section className="collection">
              <div className="collection-heading">
                <div>
                  <span className="eyebrow">LITTLE THINGS WORTH KEEPING</span>
                  <h1 ref={heading} tabIndex={-1}>
                    Your stretch of shore.
                  </h1>
                </div>
                <span className="collection-total">
                  {mine.length} {mine.length === 1 ? 'postcard' : 'postcards'}
                  {stampedDays > 0 && (
                    <small>
                      {stampedDays} daily {stampedDays === 1 ? 'stamp' : 'stamps'}
                    </small>
                  )}
                </span>
              </div>
              {mine.length === 0 && (
                <div className="collection-empty">
                  <Bottle />
                  <h2>A little empty. For now.</h2>
                  <p>Finish a stranger’s story and your first postcard will land here.</p>
                  <button className="button primary" onClick={begin} disabled={controlsDisabled}>
                    Make a little story <ArrowRight size={18} />
                  </button>
                </div>
              )}
              <div className="collection-grid">
                {mine.map(({ card, role }) => (
                  <button
                    className="collection-card"
                    key={card.id}
                    onClick={() => showCard(card.id)}
                  >
                    <Postcard card={card} role={role} />
                    <span>
                      {role === 'setup' ? 'Your bottle came back' : 'You wrote the ending'}
                      <ArrowUpRight size={17} />
                    </span>
                  </button>
                ))}
              </div>
              {waiting.length > 0 && (
                <section className="waiting-section">
                  <h2>Still out at sea</h2>
                  <p>These beginnings are waiting for an ending. A reply isn’t guaranteed.</p>
                  {waiting.map((o) => (
                    <div className="waiting-line" key={o.id}>
                      <Mail size={19} />
                      <span>{o.text}</span>
                      <span className="eyebrow">DRIFTING</span>
                    </div>
                  ))}
                </section>
              )}
            </section>
          )}
          {error &&
            !(
              emptyTide &&
              (view === 'today' || (view === 'play' && active?.stage === 'catch'))
            ) && (
              <div className="error-note" role="alert">
                <span>{error}</span>
                <button aria-label="Dismiss message" onClick={() => setError('')}>
                  <X size={17} />
                </button>
              </div>
            )}
        </main>
        <footer className="site-footer">
          <span>A small moment of together.</span>
          <span>
            Fresh tide at {reset} <span className="footer-dot">·</span>{' '}
            <button onClick={() => setModal('privacy')}>Privacy & care</button>{' '}
            <a href="/credits.html" target="_blank" rel="noreferrer">
              Image credits
            </a>
            <button
              className="sea-motion-button"
              aria-label={seaPaused ? 'Resume sea motion' : 'Pause sea motion'}
              aria-pressed={seaPaused}
              onClick={() => setSeaPaused(!seaPaused)}
            >
              <Waves size={13} />
              {seaPaused ? 'Resume sea' : 'Pause sea'}
            </button>
          </span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal === 'how' && (
        <Modal title="A little story, together." onClose={() => setModal(null)}>
          <ol className="how-list">
            <li>
              <strong>Start with six words.</strong> Answer today’s playful prompt and toss your
              beginning into the sea.
            </li>
            <li>
              <strong>Finish another bottle.</strong> Catch someone else’s setup and add a six-word
              ending. A labeled starter may help when the sea is quiet. Samples are marked in the
              sandbox.
            </li>
            <li>
              <strong>Keep the postcard.</strong> Save or share what you made. Someone may finish
              your own setup later.
            </li>
          </ol>
          <p>
            Up to three rounds a day. One skip each round.{' '}
            {s.service?.sandbox
              ? 'Sample starters are for development.'
              : 'Both creative lines are human-written.'}
          </p>
          <button className="button primary" onClick={() => setModal(null)}>
            I’m in <ArrowRight size={18} />
          </button>
        </Modal>
      )}
      {modal === 'privacy' && (
        <Modal title="A little care goes a long way." onClose={() => setModal(null)}>
          <p>
            Your submitted words are checked before another writer receives them. Completed
            postcards are anonymous and public through share links.
          </p>
          <p>
            Leave out names, contact details, and identifying information. Your draft stays in this
            browser; your session token restores your progress here. Clearing browser storage can
            lose that access.
          </p>
          <p>
            Either author can hide a postcard. That removes its share page, but cannot retract saved
            images or screenshots. Reports are private.
          </p>
          <p>
            Unpublished submissions are retained for seven days; cards and reports for thirty days.
            Hourly cleanup removes expired data and hidden-card author mappings. Saved browser
            drafts expire seven days after their latest edit.
          </p>
          <p>
            Usage and cost records contain no story text or identity. Individual records expire
            after thirty days, except unresolved billing checks; totals remain.
          </p>
          <p>
            Private daily totals count completed stories, first postcard opens and export/share
            requests. We use existing card ownership to avoid counting repeats. These totals contain
            no words or identities and expire after thirty days.
          </p>
          <p>
            AI guidance is optional and stays separate from your words. Starter content is always
            labeled.
          </p>
        </Modal>
      )}
      {modal === 'hide' && card && (
        <Modal title="Let this postcard drift away?" onClose={() => setModal(null)}>
          <p>
            This removes it from both authors’ collections and its public share link. Saved images
            and screenshots can still exist.
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              Keep it
            </button>
            <button
              className="button primary"
              disabled={!!busy}
              onClick={() =>
                run('Hiding…', async () => {
                  await game.hide(card.id);
                  setModal(null);
                  setView('collection');
                  setToast('Postcard hidden');
                })
              }
            >
              Hide postcard
            </button>
          </div>
        </Modal>
      )}
      {modal === 'report' && (
        <Modal title="Help keep the shore kind." onClose={() => setModal(null)}>
          <p>
            Your report is private.{' '}
            {view === 'card' && !ownership
              ? 'This postcard will be hidden for you while the team reviews it.'
              : 'The content will be hidden while the team reviews it.'}{' '}
            Reporting a caught bottle doesn’t use your skip.
          </p>
          <div className="report-options">
            {[
              ['personal', 'Personal or contact details'],
              ['hurtful', 'Hurtful or targeted language'],
              ['unsafe', 'Threatening or sexual content'],
              ['other', 'Something else feels wrong'],
            ].map(([reason, label]) => (
              <button
                className="button secondary"
                disabled={!!busy}
                key={reason}
                onClick={() =>
                  run('Sending report…', async () => {
                    await game.report(
                      view === 'play' ? active!.id : '',
                      view === 'card' ? selected : '',
                      reason,
                    );
                    setModal(null);
                    if (view === 'card' && ownership) setView('collection');
                    setToast('Reported. Thank you for looking out.');
                  })
                }
              >
                {label}
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
