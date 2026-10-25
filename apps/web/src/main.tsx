import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
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
  Heart,
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
import '@fontsource/kalam/latin-400.css';
import { game, persist, saved, type Snapshot } from './game';
import { words, dayOf, type Prompt, type Card } from '../../../packages/game-rules/index';
import { savePng, shareCard, cardText, copyText, preparePostcard } from './export';
import './style.css';
import { HelloPanel } from './HelloPanel';
import { friendlyError } from './errors';
import { Postcard } from './Postcard';
import { usePostcardScene } from './usePostcardScene';
import { Shore } from './Shore';
import { Ocean } from './Ocean';
import { PaperNote } from './PaperNote';
import { ShoreGate } from './ShoreGate';
import { EarlierDrafts } from './EarlierDrafts';
import { BottleRitual, type BottleRitualKind } from './BottleRitual';
import { useDriftNavigation } from './useDriftNavigation';
import { confirmedAction } from './confirmed-action';
import './natural.css';
import './postcard-scene.css';

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
function Modal({
  title,
  children,
  onClose,
  canClose = true,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  canClose?: boolean;
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
      onCancel={(event) => {
        if (canClose) onClose();
        else event.preventDefault();
      }}
      onClick={(e) => {
        if (canClose && e.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <button
        className="icon-button close"
        onClick={onClose}
        disabled={!canClose}
        aria-label="Close dialog"
      >
        <X size={20} />
      </button>
      <h2 id="modal-title">{title}</h2>
      {children}
    </dialog>
  );
}
function waitForGame<T>(read: (state: Snapshot) => T | undefined, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe = () => {};
    const finish = () => {
      clearTimeout(timer);
      unsubscribe();
    };
    const check = () => {
      if (settled) return;
      const value = read(game.snapshot());
      if (value !== undefined) {
        settled = true;
        finish();
        resolve(value);
      }
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      finish();
      reject(Error(message));
    }, 10000);
    unsubscribe = game.subscribe(check);
    if (settled) unsubscribe();
    else check();
  });
}

function assignedBottle(state: Snapshot, roundId: string) {
  const round = state.rounds.find((item) => item.id === roundId);
  if (!round || round.stage !== 'reply' || round.leaseMs <= Date.now() + state.clockOffsetMs)
    return;
  return state.assignments.find(
    (item) => item.roundId === roundId && item.id === round.assignmentId,
  );
}

function withinDeadline<T>(operation: Promise<T>, message: string, milliseconds = 15000) {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    operation,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Error(message)), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function confirmReply(roundId: string, text: string) {
  let unsubscribe = () => {};
  const committed = new Promise<void>((resolve) => {
    const check = () => {
      if (game.snapshot().rounds.some((r) => r.id === roundId && r.stage === 'done' && r.cardId))
        resolve();
    };
    unsubscribe = game.subscribe(check);
    check();
  });
  try {
    await withinDeadline(
      Promise.race([game.paid('reply', roundId, text), committed]),
      'Your reply could not be confirmed. Your draft is saved. Reconnect and check My bottles before trying again.',
      30000,
    );
  } finally {
    unsubscribe();
  }
}

async function confirmWithdrawal(bottleId: string) {
  let unsubscribe = () => {};
  const committed = new Promise<void>((resolve, reject) => {
    const check = () => {
      const state = game.snapshot();
      if (state.connected && !state.beginnings.some((item) => item.id === bottleId)) resolve();
    };
    unsubscribe = game.subscribe(check);
    void game.withdraw(bottleId).then(check, reject);
  });
  try {
    await withinDeadline(
      committed,
      'Withdrawal could not be confirmed. Reconnect and check your bottle before trying again.',
    );
  } finally {
    unsubscribe();
  }
}

async function confirmThanks(cardId: string) {
  let unsubscribe = () => {};
  const committed = new Promise<void>((resolve, reject) => {
    const check = () => {
      const state = game.snapshot();
      if (state.connected && state.appreciation.some((item) => item.cardId === cardId && item.sent))
        resolve();
    };
    unsubscribe = game.subscribe(check);
    check();
    void game.thank(cardId).then(check, reject);
  });
  try {
    await withinDeadline(
      committed,
      'Your thanks could not be confirmed. Reconnect and try again; it will only be sent once.',
    );
  } finally {
    unsubscribe();
  }
}

function App() {
  const s = useSyncExternalStore(game.subscribe, game.snapshot);
  const beforeNavigation = useRef(() => {});
  const {
    route,
    navigate,
    generation: navigationGeneration,
  } = useDriftNavigation(beforeNavigation);
  const view = route.view;
  const selected = route.view === 'card' ? route.cardId : '';
  const playingRoundId = route.view === 'play' ? route.roundId : '';
  const selectedBeginningId = route.view === 'beginning' ? route.beginningId : '';
  const [openedCardId, setOpenedCardId] = useState('');
  const [withdrawalId, setWithdrawalId] = useState('');
  const navigation = useRef({ view, playingRoundId, selectedBeginningId });
  navigation.current = { view, playingRoundId, selectedBeginningId };
  const [bottleLookup, setBottleLookup] = useState('');
  const [modal, setModal] = useState<'how' | 'report' | 'hide' | 'withdraw' | 'privacy' | null>(
    null,
  );
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [draftState, setDraft] = useState({ key: '', text: '' });
  const [clock, setClock] = useState(Date.now());
  const [reveal, setReveal] = useState('');
  const [seaPaused, setSeaPaused] = useState(false);
  const [gateReady, setGateReady] = useState(false);
  const [returnedNotice, setReturnedNotice] = useState('');
  const seenReturns = useRef<{ identity: string; ids: Set<string> } | null>(null);
  const seenThanks = useRef<{ identity: string; ids: Set<string> } | null>(null);
  const [ritual, setRitual] = useState<{
    kind: BottleRitualKind;
    phase: 'waiting' | 'moving';
  } | null>(null);
  const ritualDone = useRef<((opened: boolean) => void) | null>(null);
  const actionRunning = useRef(false);
  const releasingRound = useRef('');
  const heading = useRef<HTMLHeadingElement>(null);
  beforeNavigation.current = () => {
    setModal(null);
    setError('');
    setReveal('');
    finishRitual(false);
    setRitual(null);
  };
  const nowDay = dayOf(clock);
  const writeRound = s.rounds.find((round) => round.stage === 'write' && round.day === nowDay);
  const catchRound = s.rounds.find(
    (round) =>
      (round.stage === 'catch' && round.day === nowDay) ||
      (round.stage === 'reply' && (round.day === nowDay || round.leaseMs > clock)),
  );
  const active =
    view === 'play' ? s.rounds.find((round) => round.id === playingRoundId) : undefined;
  const prompt =
    active && view === 'play'
      ? (JSON.parse(active.promptJson) as Prompt)
      : s.today
        ? (JSON.parse(s.today.promptJson) as Prompt)
        : undefined;
  const assignment = s.assignments.find(
    (a) => a.roundId === active?.id && a.id === active.assignmentId,
  );
  const assignmentUnavailable = s.connected && active?.stage === 'reply' && !assignment;
  const closedWrite = active?.stage === 'write' && active.day !== nowDay;
  const released = s.book.beginningIds
    .flatMap((id) => {
      const beginning = s.beginnings.find((item) => item.id === id);
      return beginning
        ? [
            {
              ...beginning,
              endings: s.cards.filter(
                (pair) =>
                  pair.beginningId === id && !s.reported.some((report) => report.id === pair.id),
              ),
            },
          ]
        : [];
    })
    .sort((a, b) => b.createdMs - a.createdMs);
  const completed = s.book.pairIds
    .flatMap((id) => {
      const pair = s.cards.find(
        (item) => item.id === id && !s.reported.some((report) => report.id === id),
      );
      return pair ? [pair] : [];
    })
    .sort((a, b) => b.createdMs - a.createdMs);
  const beginning = s.beginnings.find((item) => item.id === selectedBeginningId);
  const ownsBeginning = !!beginning && s.outgoing.some((item) => item.id === beginning.id);
  useEffect(() => {
    if (
      modal === 'withdraw' &&
      (view !== 'beginning' || selectedBeginningId !== withdrawalId || !ownsBeginning)
    )
      setModal(null);
  }, [modal, view, selectedBeginningId, withdrawalId, ownsBeginning]);
  const finishedBeginning =
    !!beginning && s.rounds.some((round) => round.assignmentId === beginning.id && !!round.cardId);
  const heldInvitation =
    !!beginning &&
    catchRound?.stage === 'reply' &&
    catchRound.assignmentId === beginning.id &&
    catchRound.leaseMs > clock;
  const otherBottleOpen =
    !!beginning &&
    catchRound?.stage === 'reply' &&
    catchRound.assignmentId !== beginning.id &&
    catchRound.leaseMs > clock;
  const endings = s.cards
    .filter(
      (pair) =>
        pair.beginningId === selectedBeginningId &&
        !s.reported.some((report) => report.id === pair.id),
    )
    .sort((a, b) => b.createdMs - a.createdMs);
  const card = s.cards.find((c) => c.id === selected && !s.reported.some((r) => r.id === c.id));
  const parentBeginning = card && s.beginnings.find((item) => item.id === card.beginningId);
  const otherEndings = parentBeginning
    ? s.cards.filter(
        (item) =>
          item.beginningId === parentBeginning.id &&
          item.id !== card?.id &&
          !s.reported.some((report) => report.id === item.id),
      ).length
    : 0;
  const ownership = s.ownership.find((o) => o.id === selected);
  const appreciation = s.appreciation.find((item) => item.cardId === selected);
  const cardId = card?.id;
  const ownsVisibleCard = !!ownership && !ownership.hidden;
  const illustration = usePostcardScene(cardId, s.scenes, s.sceneStatuses);
  useEffect(() => {
    if (view === 'card' && card) void preparePostcard(card, illustration.scene).catch(() => {});
  }, [view, card, illustration.scene]);
  const recordOpen = useCallback(() => {
    if (cardId) setOpenedCardId(cardId);
    if (cardId && ownsVisibleCard && s.connected) void game.cardAction(cardId, 'open');
  }, [cardId, ownsVisibleCard, s.connected]);
  const currentDraftKey = active
    ? `drift:draft:${s.identity}:${active.id}:${active.stage === 'reply' ? active.assignmentId : 'setup'}`
    : '';
  const draft = draftState.key === currentDraftKey ? draftState.text : '';
  const count = words(draft).length;
  const dailyRounds = s.rounds.filter((r) => r.day === nowDay).length;
  const returnedToday = released.reduce(
    (total, letter) =>
      total + letter.endings.filter((pair) => dayOf(pair.createdMs) === nowDay).length,
    0,
  );
  const unopenedIds = new Set(
    s.unopenedReturns
      .filter(
        (item) =>
          s.cards.some((card) => card.id === item.id) &&
          !s.reported.some((report) => report.id === item.id),
      )
      .map((item) => item.id),
  );
  const returnedCard = s.cards.find(
    (item) =>
      item.id === returnedNotice &&
      s.ownership.some((owner) => owner.id === item.id && owner.role === 'setup' && !owner.hidden),
  );
  useEffect(() => {
    if (!s.connected || !s.identity) return;
    const returned = s.ownership
      .filter((o) => o.role === 'setup' && !o.hidden)
      .flatMap((o) => s.cards.filter((card) => card.id === o.id))
      .sort((a, b) => b.createdMs - a.createdMs);
    if (seenReturns.current?.identity !== s.identity) {
      // The first complete subscription is a baseline, not a new-arrival event.
      seenReturns.current = { identity: s.identity, ids: new Set(returned.map((card) => card.id)) };
      setReturnedNotice('');
      return;
    }
    const arriving = returned.find((card) => !seenReturns.current!.ids.has(card.id));
    for (const card of returned) seenReturns.current.ids.add(card.id);
    if (arriving) {
      setToast('');
      setReturnedNotice(arriving.id);
    }
  }, [s.connected, s.identity, s.ownership, s.cards]);
  useEffect(() => {
    if (!s.connected || !s.identity) return;
    const received = s.appreciation.filter(
      (item) =>
        item.received &&
        s.cards.some((card) => card.id === item.cardId) &&
        !s.reported.some((report) => report.id === item.cardId),
    );
    if (seenThanks.current?.identity !== s.identity) {
      seenThanks.current = {
        identity: s.identity,
        ids: new Set(received.map((item) => item.cardId)),
      };
      return;
    }
    const arrived = received.find((item) => !seenThanks.current!.ids.has(item.cardId));
    for (const item of received) seenThanks.current.ids.add(item.cardId);
    if (arrived && !(view === 'card' && selected === arrived.cardId))
      setToast('A co-writer sent a little thanks. Find it in My bottles.');
  }, [s.connected, s.identity, s.appreciation, s.cards, s.reported, view, selected]);
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
    if (s.connected && s.today && s.today.day !== nowDay) void game.refresh().catch(() => {});
  }, [s.connected, s.today?.day, nowDay]);
  // Restore before paint so switching between independent drafts never exposes an empty input.
  useLayoutEffect(() => {
    setDraft({ key: currentDraftKey, text: currentDraftKey ? saved(currentDraftKey) : '' });
  }, [currentDraftKey]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (ritual) return;
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [view, selected, selectedBeginningId, playingRoundId, active?.stage, !!ritual]);
  useEffect(() => () => ritualDone.current?.(false), []);
  function finishRitual(opened: boolean) {
    const resolve = ritualDone.current;
    ritualDone.current = null;
    resolve?.(opened);
  }
  function playRitual(kind: BottleRitualKind) {
    return new Promise<boolean>((resolve) => {
      ritualDone.current = resolve;
      setRitual({ kind, phase: 'moving' });
    });
  }
  const changeDraft = (value: string) => {
    const limited = [...value].slice(0, 160).join('');
    setDraft({ key: currentDraftKey, text: limited });
    if (currentDraftKey) persist(currentDraftKey, limited);
  };
  const run = async (label: string, fn: (stillHere: () => boolean) => Promise<unknown>) => {
    if (actionRunning.current) return;
    const startedAt = navigationGeneration.current;
    const stillHere = () => navigationGeneration.current === startedAt;
    actionRunning.current = true;
    setBusy(label);
    setError('');
    try {
      await fn(stillHere);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Your shore check')) setGateReady(false);
      if (stillHere()) setError(friendlyError(e));
    } finally {
      actionRunning.current = false;
      setRitual(null);
      setBusy('');
    }
  };
  async function startBeginning() {
    return confirmedAction({
      snapshot: game.snapshot,
      subscribe: game.subscribe,
      read: (state) =>
        state.connected
          ? state.rounds.find(
              (round) =>
                round.stage === 'write' && round.day === dayOf(Date.now() + state.clockOffsetMs),
            )?.id
          : undefined,
      act: () => game.start(),
      message:
        'Your beginning could not be confirmed. Your draft is saved. Reconnect and try again.',
    });
  }
  async function closeRound(roundId: string) {
    return confirmedAction({
      snapshot: game.snapshot,
      subscribe: game.subscribe,
      read: (state) =>
        state.connected &&
        state.rounds.some((round) => round.id === roundId && round.stage === 'done')
          ? true
          : undefined,
      act: () => game.abandon(roundId),
      message: 'Your earlier round is taking a moment to close. Your draft is saved.',
    });
  }
  async function begin() {
    await run('Opening your bottle…', async (stillHere) => {
      const id = await startBeginning();
      if (stillHere()) navigate({ view: 'play', roundId: id });
    });
  }
  async function copyDraft(text: string) {
    await run('Copying…', async () => {
      await copyText(text);
      setToast('Draft copied');
    });
  }
  async function beginCatch() {
    await run('Finding a bottle…', async () => {
      await pickUp();
    });
  }
  async function pickUp(roundId?: string, skip = false, invitationId?: string) {
    const startedAt = navigationGeneration.current;
    const stillHere = () => navigationGeneration.current === startedAt;
    setRitual({ kind: 'pickup', phase: 'waiting' });
    const id =
      roundId ??
      (await withinDeadline(
        invitationId ? game.startInvited(invitationId) : game.startCatching(),
        'Your bottle is taking a moment. Try picking up again.',
      ));
    if (!stillHere()) return;
    const priorVersion = game.snapshot().rounds.find((item) => item.id === id)?.version ?? -1;
    if (skip)
      await withinDeadline(game.skip(id), 'Your bottle is taking a moment. Try picking up again.');
    if (!stillHere()) return;
    if (!invitationId && (skip || !assignedBottle(game.snapshot(), id)))
      await withinDeadline(game.claim(id), 'Your bottle is taking a moment. Try picking up again.');
    if (!stillHere()) return;
    await waitForGame((state) => {
      if (skip && (state.rounds.find((item) => item.id === id)?.version ?? -1) <= priorVersion)
        return;
      const received = assignedBottle(state, id);
      return received && (!invitationId || received.id === invitationId) ? received : undefined;
    }, 'Your bottle is taking a moment. Try picking up again.');
    if (!stillHere()) return;
    const opened = await playRitual('pickup');
    if (!stillHere()) return;
    if (!opened) {
      navigate(invitationId ? { view: 'beginning', beginningId: invitationId } : { view: 'today' });
      return;
    }
    // The bottle may have been left in the light until its lease expired.
    if (!assignedBottle(game.snapshot(), id))
      throw Error('Your bottle expired. Pick up another one.');
    navigate({ view: 'play', roundId: id });
  }
  async function releaseToSea() {
    const startedAt = navigationGeneration.current;
    await playRitual('release');
    if (navigationGeneration.current !== startedAt) return;
    navigate({ view: 'today' }, true);
    setError('');
    setToast('Bottle released');
  }
  async function submit() {
    if (!active || closedWrite) return;
    const roundId = active.id;
    const stage = active.stage;
    const text = draft;
    await run(
      stage === 'write' ? 'Checking your six words…' : 'Sealing your postcard…',
      async (stillHere) => {
        if (stage === 'write') {
          releasingRound.current = roundId;
          setRitual({ kind: 'release', phase: 'waiting' });
          try {
            try {
              await withinDeadline(
                game.paid('setup', roundId, text),
                'Your release could not be confirmed. Your draft is saved. Reconnect and check My bottles before trying again.',
                30000,
              );
            } catch (error) {
              const committed = game.snapshot().rounds.find((item) => item.id === roundId);
              if (committed?.stage !== 'done' || !committed.setupId) throw error;
            }
            await waitForGame(
              (state) =>
                state.rounds.find(
                  (item) => item.id === roundId && item.stage === 'done' && !!item.setupId,
                ),
              'Your release is taking a moment. Your draft is saved.',
            );
            if (stillHere()) await releaseToSea();
          } finally {
            releasingRound.current = '';
          }
          return;
        }
        if (active.stage === 'reply') setReveal('pending:' + active.id);
        try {
          await confirmReply(roundId, text);
        } catch (error) {
          const completed = game.snapshot().rounds.find((r) => r.id === active.id)?.cardId;
          if (active.stage === 'reply' && completed) {
            if (
              stillHere() &&
              navigation.current.view === 'play' &&
              navigation.current.playingRoundId === roundId
            ) {
              navigate({ view: 'card', cardId: completed }, true);
              setError('');
            }
            return;
          }
          throw error;
        }
        if (
          stillHere() &&
          active.stage === 'reply' &&
          navigation.current.view === 'play' &&
          navigation.current.playingRoundId === roundId
        ) {
          // Find by live state, because procedure and subscription may arrive in either order.
          const find = () => game.snapshot().rounds.find((r) => r.id === active.id)?.cardId;
          const id = find();
          if (id) {
            navigate({ view: 'card', cardId: id }, true);
          } else {
            setReveal('pending:' + active.id);
          }
        }
      },
    );
  }
  useEffect(() => {
    if (view !== 'play' || !reveal.startsWith('pending:')) return;
    const round = s.rounds.find((r) => r.id === reveal.slice(8));
    if (round?.cardId) {
      navigate({ view: 'card', cardId: round.cardId }, true);
      setReveal('');
      setError('');
    }
  }, [s.rounds, reveal, view, navigate]);
  useEffect(() => {
    if (!s.connected || view !== 'play' || active?.stage !== 'done' || actionRunning.current)
      return;
    // A restored or late-finished round opens its existing result; history never
    // starts a fresh round or repeats a release ritual.
    // A two-step new-tide recovery may close the old round before its new start
    // fails. Keep that failure visible when leaving the now-abandoned editor.
    const recoveryError = !active.cardId && !active.setupId ? error : '';
    navigate(
      active.cardId
        ? { view: 'card', cardId: active.cardId }
        : active.setupId
          ? { view: 'beginning', beginningId: active.setupId }
          : { view: 'today' },
      true,
    );
    if (recoveryError) setError(recoveryError);
  }, [s.connected, view, active?.stage, active?.setupId, active?.cardId, busy, error, navigate]);
  const controlsDisabled = !!busy || !s.connected || (!!s.service?.botRequired && !gateReady);
  const needsShoreCheck = !!s.service?.botRequired && !gateReady;
  const reset = new Date((nowDay + 1) * 86400000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  function showBeginning(id: string) {
    navigate({ view: 'beginning', beginningId: id });
    setError('');
  }
  async function copyInvitation(id: string) {
    await run('Copying invitation…', async () => {
      await copyText(`${location.origin}${location.pathname}?bottle=${encodeURIComponent(id)}`);
      setToast('Bottle link copied');
    });
  }
  function showCard(id: string) {
    setReturnedNotice((current) => (current === id ? '' : current));
    navigate({ view: 'card', cardId: id });
    setError('');
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to the game
      </a>
      <div
        className={`app-shell sea-world ${view === 'today' || (view === 'play' && active?.stage === 'catch') ? 'shore-shell' : ''}${ritual ? ' has-bottle-ritual' : ''}${view === 'today' && needsShoreCheck ? ' has-shore-check' : ''}${view === 'today' && returnedCard ? ' has-returned-note' : ''}`}
      >
        <Ocean paused={seaPaused} />
        <header className="site-header" inert={!!ritual}>
          <button
            className="wordmark"
            onClick={() => {
              navigate({ view: 'today' });
              setError('');
            }}
            aria-label="Drift home"
          >
            drift
          </button>
          {s.service?.sandbox && (
            <span
              className="preview-mark"
              title={s.service.aiReady ? 'Local preview' : 'Local preview. Message checks are off.'}
            >
              Preview
            </span>
          )}
          {view !== 'today' && (
            <button
              className="shore-back"
              onClick={() => {
                navigate({
                  view: view === 'card' || view === 'beginning' ? 'collection' : 'today',
                });
                setError('');
              }}
            >
              <ChevronLeft size={16} />{' '}
              {view === 'card' || view === 'beginning' ? 'Back to bottles' : 'Back to the sea'}
            </button>
          )}
          <button
            className="icon-button help"
            onClick={() => setModal('how')}
            aria-label="How to play"
          >
            <HelpCircle size={21} />
          </button>
        </header>
        {(!s.storageAvailable || !s.bookStored) && (
          <div className="connection-banner" role="status">
            This browser can’t save all your bottle IDs or progress. Keep this tab open.
          </div>
        )}
        {s.connected && s.service?.paused && (
          <div className="connection-banner" role="status">
            Submissions are paused. You can keep writing and save existing replies.
          </div>
        )}
        {!s.connected && (
          <div className="connection-banner" role="status">
            {s.connecting ? <LoaderCircle className="spin" size={16} /> : <Waves size={16} />}{' '}
            {s.error || 'Finding the shore…'}
            {!s.connecting && <button onClick={() => game.reconnect()}>Reconnect</button>}
          </div>
        )}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {returnedCard ? 'Your bottle came back. Someone added six words.' : ''}
        </div>
        <main id="main" className={`main view-${view}`} inert={!!ritual}>
          {returnedCard && (
            <aside
              className={`returned-notice${view === 'today' ? ' returned-notice--shore' : ''}`}
              aria-label="Returned bottle"
            >
              <div>
                <Mail size={19} aria-hidden="true" />
                <span>Your bottle came back. Someone added six words.</span>
              </div>
              <button className="text-button" onClick={() => showCard(returnedCard.id)}>
                Open returned postcard <ArrowRight size={16} aria-hidden="true" />
              </button>
              <button
                className="icon-button"
                aria-label="Dismiss returned bottle notice"
                onClick={() => setReturnedNotice('')}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </aside>
          )}
          {s.connected &&
            s.service?.botRequired &&
            !gateReady &&
            ((view === 'today' && !returnedCard) || view === 'play') && (
              <ShoreGate
                placement={view === 'today' ? 'shore' : 'inline'}
                onVerified={() => setGateReady(true)}
              />
            )}
          {view === 'today' && (
            <Shore
              mode="home"
              day={s.today?.day}
              restingMessage={
                !writeRound && !catchRound && dailyRounds >= 3
                  ? `Today’s limit reached. Try again at ${reset}.`
                  : undefined
              }
              prompt={prompt}
              disabled={controlsDisabled || !prompt || !!s.service?.paused}
              writeDisabled={
                controlsDisabled ||
                !prompt ||
                (!writeRound && dailyRounds >= 3) ||
                !!s.service?.paused
              }
              pickDisabled={
                controlsDisabled ||
                !prompt ||
                (!catchRound && dailyRounds >= 3) ||
                !!s.service?.paused
              }
              busy={busy}
              actionLabel={writeRound ? 'Continue your beginning' : 'Write a beginning'}
              onAction={beginCatch}
              onWrite={begin}
              onCollection={() => navigate({ view: 'collection' })}
              unopenedCount={unopenedIds.size}
              returnedCount={returnedToday}
              empty={emptyTide}
              headingRef={heading}
            />
          )}
          {view === 'play' && prompt && (
            <section className={`play-layout ${active?.stage === 'catch' ? 'shore-play' : ''}`}>
              <div className="writing-desk">
                {!active ? (
                  <div className="empty-state closed-round">
                    <Mail size={38} />
                    <h1 ref={heading} tabIndex={-1}>
                      This round has ended.
                    </h1>
                    <p>
                      This prompt has closed, or your round is finished. Your saved words stay on
                      this browser.
                    </p>
                    <button className="button primary" disabled={controlsDisabled} onClick={begin}>
                      Write a beginning <ArrowRight size={18} />
                    </button>
                    <EarlierDrafts
                      identity={s.identity}
                      rounds={s.rounds}
                      day={nowDay}
                      currentKey={currentDraftKey}
                      busy={!!busy}
                      onCopy={(text) => void copyDraft(text)}
                    />
                  </div>
                ) : active.stage === 'catch' ? (
                  <Shore
                    mode="catch"
                    prompt={prompt}
                    disabled={controlsDisabled || !!s.service?.paused}
                    writeDisabled={
                      controlsDisabled || (!writeRound && dailyRounds >= 3) || !!s.service?.paused
                    }
                    busy={busy}
                    actionLabel="Catch a bottle"
                    onAction={() => run('Finding a bottle…', () => pickUp(active.id))}
                    onWrite={begin}
                    onCollection={() => navigate({ view: 'collection' })}
                    unopenedCount={unopenedIds.size}
                    returnedCount={returnedToday}
                    empty={emptyTide}
                    headingRef={heading}
                  />
                ) : (
                  <PaperNote key={currentDraftKey}>
                    <h1 ref={heading} tabIndex={-1}>
                      {active.stage === 'write' ? prompt.setup : prompt.reply}
                    </h1>
                    {active.stage === 'reply' && assignment && (
                      <div className="caught-note">
                        <div>
                          {assignment.seeded && (
                            <span className="eyebrow">
                              {assignment.starterKind === 'team'
                                ? 'Beginning by the Drift team'
                                : 'Sample beginning'}
                            </span>
                          )}
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
                      {active.stage === 'write'
                        ? 'Your six-word beginning'
                        : 'Your six-word ending'}
                    </label>
                    <textarea
                      id="six-words"
                      className="story-input"
                      value={draft}
                      onChange={(e) => changeDraft(e.target.value)}
                      placeholder={active.stage === 'write' ? 'Write six words…' : 'Your reply…'}
                      rows={2}
                      aria-describedby="word-help"
                      spellCheck
                      autoComplete="off"
                    />
                    <div className="word-feedback" id="word-help">
                      <span className={count > 6 ? 'count-over' : ''}>{count}/6 words</span>
                      {draft && (
                        <span className="draft-saved">
                          {s.storageAvailable ? 'Saved' : 'Unsaved'}
                        </span>
                      )}
                      {[...draft].length > 130 && (
                        <span className="character-count">{[...draft].length}/160</span>
                      )}
                    </div>
                    {active.stage === 'reply' && s.service?.aiReady && (
                      <div className="nudge-area">
                        <button
                          className="nudge-button"
                          disabled={
                            controlsDisabled ||
                            active.nudges >= 2 ||
                            !s.service?.aiReady ||
                            assignmentUnavailable ||
                            remaining <= 0
                          }
                          onClick={() =>
                            run('Finding a hint…', async () => {
                              await withinDeadline(
                                game.paid('nudge', active.id, draft),
                                'Your hint could not be confirmed. Your draft is saved. Try Hint again to check the same request.',
                                30000,
                              );
                            })
                          }
                        >
                          <Sparkles size={16} />
                          {busy === 'Finding a hint…' ? 'Finding a hint…' : 'Hint'}
                          <span>{2 - active.nudges} left</span>
                        </button>
                        {active.hint && !assignmentUnavailable && (
                          <aside className="nudge" aria-live="polite">
                            <span className="eyebrow">
                              <Sparkles size={12} /> AI hint
                            </span>
                            <p>{active.hint}</p>
                            <small>Your ending is still yours.</small>
                          </aside>
                        )}
                      </div>
                    )}
                    {active.stage === 'reply' &&
                      (remaining <= 0 || assignmentUnavailable) &&
                      !checksExhausted && (
                        <div className="quota-recovery expiry-recovery" role="status">
                          <p>
                            <strong>
                              {assignmentUnavailable
                                ? 'That beginning is no longer available.'
                                : 'This bottle has drifted on.'}
                            </strong>{' '}
                            {draft.trim()
                              ? 'Your ending is still here. Copy it before catching a fresh beginning.'
                              : 'Catch a fresh beginning when you’re ready.'}
                          </p>
                          {draft.trim() && (
                            <button
                              className="text-button"
                              disabled={!!busy}
                              onClick={() => void copyDraft(draft)}
                            >
                              <Copy size={14} /> Copy my draft
                            </button>
                          )}
                        </div>
                      )}
                    {closedWrite && (
                      <div className="quota-recovery expiry-recovery" role="status">
                        <p>
                          <strong>This tide has closed.</strong> Your beginning is still here. Today
                          has a new prompt.
                        </p>
                        <div>
                          {draft.trim() && (
                            <button
                              className="text-button"
                              disabled={!!busy}
                              onClick={() => void copyDraft(draft)}
                            >
                              <Copy size={14} /> Copy my draft
                            </button>
                          )}
                          <button
                            className="text-button"
                            disabled={controlsDisabled || !!s.service?.paused}
                            onClick={() =>
                              void run('Opening today’s beginning…', async (stillHere) => {
                                await closeRound(active.id);
                                if (!stillHere()) return;
                                const id = await startBeginning();
                                if (stillHere()) navigate({ view: 'play', roundId: id });
                              })
                            }
                          >
                            Start today’s beginning <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                    {checksExhausted && !closedWrite && (
                      <div className="quota-recovery">
                        <p>
                          This round has used its three story checks. Your words are saved here.
                        </p>
                        <div>
                          <button
                            className="text-button"
                            disabled={!!busy}
                            onClick={() => void copyDraft(draft)}
                          >
                            <Copy size={14} />
                            Copy my draft
                          </button>
                          <button
                            className="text-button"
                            disabled={controlsDisabled}
                            onClick={() =>
                              run('Closing this round…', async (stillHere) => {
                                await closeRound(active.id);
                                if (stillHere()) {
                                  navigate({ view: 'today' });
                                  setToast('Round closed. Your draft is kept on this browser.');
                                }
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
                          closedWrite ||
                          !!checksExhausted ||
                          count !== 6 ||
                          (active.stage === 'reply' && (remaining <= 0 || assignmentUnavailable))
                        }
                      >
                        {busy ? (
                          <>
                            <LoaderCircle className="spin" size={18} />
                            {busy}
                          </>
                        ) : (
                          <>
                            {active.stage === 'write' ? 'Release' : 'Send reply'}
                            <ArrowRight size={18} />
                          </>
                        )}
                      </button>
                      {active.stage === 'reply' && (
                        <div className="minor-actions">
                          {remaining > 0 && !assignmentUnavailable ? (
                            <button
                              disabled={controlsDisabled || active.skips >= 1}
                              onClick={() =>
                                run('Finding another bottle…', () => pickUp(active.id, true))
                              }
                            >
                              <Shuffle size={15} />
                              {active.skips ? 'Skip used' : 'Skip this bottle'}
                            </button>
                          ) : (
                            <button
                              disabled={controlsDisabled || !!checksExhausted}
                              onClick={() =>
                                run('Finding a fresh bottle…', async (stillHere) => {
                                  if (active.day !== nowDay) {
                                    await closeRound(active.id);
                                    if (stillHere()) await pickUp();
                                  } else await pickUp(active.id);
                                })
                              }
                            >
                              <RotateCcw size={15} />
                              Catch a fresh bottle
                            </button>
                          )}
                          <button
                            disabled={controlsDisabled || assignmentUnavailable}
                            onClick={() => setModal('report')}
                          >
                            <Flag size={14} />
                            Report
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="privacy-note">
                      This may be shared. Leave out personal details.{' '}
                      <button onClick={() => setModal('privacy')}>Privacy</button>
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
            <section className={`reveal-layout ${card ? 'has-postcard' : ''}`}>
              <div className="reveal-copy">
                <h1 ref={heading} tabIndex={-1} className={card ? 'sr-only' : ''}>
                  {card ? 'Saved reply' : s.connected ? 'Reply unavailable' : 'Opening reply…'}
                </h1>
                {!card && (
                  <p>
                    {s.connected
                      ? 'The link may be incomplete, or an author may have hidden this reply.'
                      : 'Waiting for a connection.'}
                  </p>
                )}
                {card && (
                  <>
                    <div className="share-actions">
                      <button
                        className="button primary"
                        onClick={() =>
                          run('Opening share…', async () => {
                            try {
                              const msg = await shareCard(card, illustration.scene, {
                                preferLink: illustration.status === 'pending',
                              });
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
                        Share
                      </button>
                      <button
                        className="button secondary postcard-save"
                        onClick={() =>
                          run('Making your image…', async () => {
                            await savePng(card, illustration.scene);
                            setToast('Postcard image saved');
                            if (ownership) void game.cardAction(card.id, 'png_requested');
                          })
                        }
                        disabled={!!busy || (illustration.status === 'pending' && s.connected)}
                      >
                        <Download size={17} />
                        <span className="postcard-save-label">
                          <span aria-hidden="true">Save image</span>
                          <span>
                            {illustration.status === 'pending'
                              ? s.connected
                                ? 'Drawing…'
                                : 'Save words'
                              : 'Save image'}
                          </span>
                        </span>
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
                        Copy text
                      </button>
                    </div>
                    {parentBeginning && (
                      <div className="other-endings">
                        <button
                          className="text-button"
                          onClick={() => showBeginning(parentBeginning.id)}
                        >
                          {otherEndings
                            ? `Other endings from this bottle (${otherEndings})`
                            : 'View this bottle'}
                          <ArrowRight size={14} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                    {
                      <div className="card-management">
                        {ownership && (
                          <button onClick={() => setModal('hide')}>
                            <Trash2 size={14} />
                            Hide
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
                  </>
                )}
              </div>
              {card && (
                <div className="reveal-art">
                  <PaperNote key={card.id} postcard onOpen={recordOpen}>
                    <Postcard
                      card={card}
                      role={ownership?.role}
                      scene={illustration.scene}
                      illustrationStatus={illustration.status}
                      connected={s.connected}
                    >
                      {appreciation && ownership && !ownership.hidden && (
                        <div
                          className="co-writer-thanks"
                          role="group"
                          aria-label="Private thanks between co-writers"
                        >
                          {appreciation.received && (
                            <p className="thanks-received" role="status">
                              <Heart size={15} aria-hidden="true" /> Your co-writer sent a little
                              thanks.
                            </p>
                          )}
                          <button
                            className="text-button"
                            disabled={
                              !!busy ||
                              !s.connected ||
                              appreciation.sent ||
                              openedCardId !== card.id
                            }
                            onClick={() =>
                              void run('Sending thanks…', () => confirmThanks(card.id))
                            }
                          >
                            {appreciation.sent ? <Check size={15} /> : <Heart size={15} />}
                            {appreciation.sent
                              ? 'Thanks sent'
                              : busy === 'Sending thanks…'
                                ? 'Sending thanks…'
                                : 'Thank your co-writer'}
                          </button>
                          <small>Private, just between the two writers.</small>
                        </div>
                      )}
                    </Postcard>
                  </PaperNote>
                </div>
              )}
            </section>
          )}
          {view === 'collection' && (
            <section className="collection bottle-shelf">
              <div className="collection-heading">
                <h1 ref={heading} tabIndex={-1}>
                  My bottles
                </h1>
                <span className="collection-total">Saved on this browser</span>
              </div>
              {released.length === 0 && completed.length === 0 && (
                <div className="collection-empty">
                  <Bottle />
                  <h2>No saved bottles yet.</h2>
                  <p>Release a beginning, or pick up someone else’s.</p>
                  <button
                    className="button primary"
                    onClick={needsShoreCheck ? () => navigate({ view: 'today' }) : begin}
                    disabled={needsShoreCheck ? !!busy : controlsDisabled || !!s.service?.paused}
                  >
                    {needsShoreCheck ? 'Start at the sea' : 'Write a beginning'}
                  </button>
                </div>
              )}
              {released.length > 0 && (
                <section className="shelf-section">
                  <h2>Your beginnings</h2>
                  <div className="beginning-list">
                    {released.map((letter) => (
                      <button
                        key={letter.id}
                        className="beginning-preview"
                        onClick={() => showBeginning(letter.id)}
                      >
                        <span>{letter.text}</span>
                        <small>
                          {letter.endings.length}{' '}
                          {letter.endings.length === 1 ? 'ending' : 'endings'}
                          {letter.endings.some((pair) => unopenedIds.has(pair.id)) && (
                            <strong className="unopened-label">
                              {letter.endings.filter((pair) => unopenedIds.has(pair.id)).length}{' '}
                              unopened
                            </strong>
                          )}
                          {letter.endings.some((pair) =>
                            s.appreciation.some((item) => item.cardId === pair.id && item.received),
                          ) && (
                            <span className="thanks-label">
                              <Heart size={12} aria-hidden="true" /> Thanks received
                            </span>
                          )}
                        </small>
                        <ChevronLeft size={16} className="letter-forward" />
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {completed.length > 0 && (
                <section className="shelf-section">
                  <h2>Your replies</h2>
                  <div className="collection-grid">
                    {completed.map((pair) => (
                      <button
                        className="collection-card"
                        key={pair.id}
                        onClick={() => showCard(pair.id)}
                      >
                        <Postcard
                          card={pair}
                          role={
                            s.ownership.find((item) => item.id === pair.id && !item.hidden)?.role
                          }
                        >
                          {s.appreciation.some(
                            (item) => item.cardId === pair.id && item.received,
                          ) && (
                            <span className="thanks-label">
                              <Heart size={12} aria-hidden="true" /> Thanks received
                            </span>
                          )}
                        </Postcard>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <details className="bottle-lookup">
                <summary>Open a bottle by ID</summary>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (/^[a-zA-Z0-9_-]{1,128}$/.test(bottleLookup.trim()))
                      showBeginning(bottleLookup.trim());
                  }}
                >
                  <label className="sr-only" htmlFor="bottle-id">
                    Beginning bottle ID
                  </label>
                  <input
                    id="bottle-id"
                    value={bottleLookup}
                    onChange={(event) => setBottleLookup(event.target.value)}
                    maxLength={128}
                    placeholder="Bottle ID"
                    required
                    pattern="[a-zA-Z0-9_-]+"
                  />
                  <button className="button secondary" type="submit">
                    Open bottle
                  </button>
                </form>
              </details>
              <EarlierDrafts
                identity={s.identity}
                rounds={s.rounds}
                day={nowDay}
                currentKey={currentDraftKey}
                busy={!!busy}
                onCopy={(text) => void copyDraft(text)}
              />
            </section>
          )}
          {view === 'beginning' && (
            <section className="bottle-page">
              <h1 ref={heading} tabIndex={-1} className={beginning ? 'sr-only' : ''}>
                {beginning
                  ? ownsBeginning
                    ? 'Your bottle'
                    : 'A drifting beginning'
                  : s.connected
                    ? 'Bottle unavailable'
                    : 'Opening bottle…'}
              </h1>
              {beginning ? (
                <>
                  <PaperNote>
                    <p className="invitation-theme">
                      {(JSON.parse(beginning.promptJson) as Prompt).title}
                    </p>
                    {beginning.seeded && (
                      <span className="eyebrow">
                        {beginning.starterKind === 'team'
                          ? 'Beginning by the Drift team'
                          : 'Sample beginning'}
                      </span>
                    )}
                    <p className="letter-text">{beginning.text}</p>
                    <details className="bottle-receipt">
                      <summary>Bottle ID</summary>
                      <code>{beginning.id}</code>
                      <div className="letter-address">
                        <button
                          className="text-button"
                          onClick={() =>
                            run('Copying bottle ID…', async () => {
                              await copyText(beginning.id);
                              setToast('Bottle ID copied');
                            })
                          }
                        >
                          <Copy size={14} />
                          Copy bottle ID
                        </button>
                        <button
                          className="text-button"
                          onClick={() => void copyInvitation(beginning.id)}
                        >
                          Copy bottle link
                        </button>
                        {ownsBeginning && (
                          <button
                            className="text-button"
                            disabled={!!busy || !s.connected}
                            onClick={(event) => {
                              event.currentTarget.focus();
                              setError('');
                              setWithdrawalId(beginning.id);
                              setModal('withdraw');
                            }}
                          >
                            Withdraw this bottle
                          </button>
                        )}
                      </div>
                    </details>
                  </PaperNote>
                  <div className="invitation-actions">
                    {s.connected &&
                      s.service?.botRequired &&
                      !gateReady &&
                      !ownsBeginning &&
                      !finishedBeginning &&
                      (beginning.day === nowDay || heldInvitation) && (
                        <ShoreGate onVerified={() => setGateReady(true)} />
                      )}
                    {ownsBeginning ? (
                      <>
                        <p>
                          {beginning.day === nowDay
                            ? 'Your six words are drifting. Invite someone to add theirs.'
                            : 'An earlier tide. Your shared replies stay here to reread.'}
                        </p>
                        <button
                          className="button primary"
                          disabled={!!busy}
                          onClick={() => void copyInvitation(beginning.id)}
                        >
                          <Share2 size={16} />{' '}
                          {beginning.day === nowDay
                            ? 'Invite someone to finish'
                            : 'Copy bottle link'}
                        </button>
                      </>
                    ) : finishedBeginning ? (
                      <p>You already added an ending to this beginning.</p>
                    ) : beginning.day !== nowDay && !heldInvitation ? (
                      <>
                        <p>
                          This beginning is from an earlier tide. You can still read its replies.
                        </p>
                        <button
                          className="button primary"
                          disabled={
                            needsShoreCheck
                              ? !!busy
                              : controlsDisabled ||
                                !!s.service?.paused ||
                                (!catchRound && dailyRounds >= 3)
                          }
                          onClick={needsShoreCheck ? () => navigate({ view: 'today' }) : beginCatch}
                        >
                          Find today’s bottle
                        </button>
                      </>
                    ) : otherBottleOpen ? (
                      <>
                        <p>You have another bottle open. Your ending is saved there.</p>
                        <button
                          className="button primary"
                          disabled={controlsDisabled || !!s.service?.paused}
                          onClick={() =>
                            void run('Opening your bottle…', () => pickUp(catchRound!.id))
                          }
                        >
                          Resume your open bottle
                        </button>
                      </>
                    ) : (
                      <>
                        <p>
                          {heldInvitation
                            ? 'Your ending is waiting in this bottle.'
                            : 'Someone began it. Your six words could finish it.'}
                        </p>
                        <button
                          className="button primary"
                          disabled={
                            controlsDisabled ||
                            !!s.service?.paused ||
                            (!catchRound && dailyRounds >= 3)
                          }
                          onClick={() =>
                            void run('Opening this bottle…', () =>
                              pickUp(undefined, false, beginning.id),
                            )
                          }
                        >
                          {heldInvitation ? 'Resume your ending' : 'Write an ending'}{' '}
                          <ArrowRight size={16} />
                        </button>
                        {!catchRound && dailyRounds >= 3 && (
                          <p>Today’s limit is reached. You can still read the replies.</p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="endings-heading">
                    <h2>
                      {endings.length} {endings.length === 1 ? 'reply' : 'replies'}
                    </h2>
                  </div>
                  {endings.length === 0 ? (
                    <p className="shelf-note">No replies yet.</p>
                  ) : (
                    <div className="ending-list">
                      {endings.map((pair) => (
                        <button
                          className="ending-preview"
                          key={pair.id}
                          onClick={() => showCard(pair.id)}
                        >
                          <span>{pair.reply}</span>
                          <small>
                            {unopenedIds.has(pair.id) && (
                              <strong className="unopened-label">Unopened</strong>
                            )}
                            {s.appreciation.some(
                              (item) => item.cardId === pair.id && item.received,
                            ) && (
                              <span className="thanks-label">
                                <Heart size={12} aria-hidden="true" /> Thanks received
                              </span>
                            )}
                            {new Date(pair.createdMs).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </small>
                          <ArrowUpRight size={16} />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="shelf-note">
                  {s.connected
                    ? 'The ID may be incomplete, or this bottle and its replies may have been removed. You can find your other stories in My bottles.'
                    : 'Waiting for the bottle to arrive.'}
                </p>
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
        {ritual && (
          <BottleRitual
            kind={ritual.kind}
            phase={ritual.phase}
            onComplete={() => finishRitual(true)}
            onCancel={() => finishRitual(false)}
          />
        )}
      </div>
      {toast && !ritual && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal === 'how' && (
        <Modal title="How to play" onClose={() => setModal(null)}>
          <ol className="how-list">
            <li>
              <strong>Release.</strong> Write a six-word beginning for today’s prompt.
            </li>
            <li>
              <strong>Pick up.</strong> Shake or tap a bottle, then add a six-word ending.
            </li>
            <li>
              <strong>My bottles.</strong> Read replies to your beginnings and revisit the pairs you
              finished. The badge counts unopened replies. Open your beginning to invite someone to
              finish it.
            </li>
          </ol>
          <p>Up to three bottles a day. One skip per reply.</p>
          {s.service?.sandbox && !s.service.aiReady && (
            <p>This is a local preview. Message checks and AI hints are off.</p>
          )}
          <button className="button primary" onClick={() => setModal(null)}>
            Back to the sea
          </button>
          <div className="shore-settings">
            <button onClick={() => setModal('privacy')}>Privacy</button>
            <a href="/credits.html" target="_blank" rel="noreferrer">
              Image credits
            </a>
            <button
              className="sea-motion-button"
              aria-label={seaPaused ? 'Resume sea motion' : 'Pause sea motion'}
              aria-pressed={seaPaused}
              onClick={() => setSeaPaused(!seaPaused)}
            >
              <Waves size={14} /> {seaPaused ? 'Resume sea motion' : 'Pause sea motion'}
            </button>
            <small>A fresh prompt arrives at {reset}.</small>
          </div>
        </Modal>
      )}
      {modal === 'privacy' && (
        <Modal title="Privacy" onClose={() => setModal(null)}>
          <p>
            {s.service?.sandbox && !s.service.aiReady
              ? 'Message checks are off in this local preview.'
              : 'Your submitted words are checked before another writer receives them.'}{' '}
            Released beginnings and completed replies are anonymous and public. A beginning can
            receive endings from several writers; each pair has its own share link.
          </p>
          <p>
            Leave out names, contact details, and identifying information. First-party cookies save
            the IDs of your beginnings and completed pairs for thirty days. They contain no message
            text. Your drafts and anonymous session token stay in this browser. Cookies let you
            reopen the public letters by ID; author-only actions still require your session token.
            Clearing browser data can lose that access.
          </p>
          <p>
            Either author can hide a postcard. The beginning’s author can also withdraw the entire
            bottle through its Bottle ID controls. That removes the beginning and all its replies
            from public links and both authors’ collections. Saved images or screenshots cannot be
            retracted. Reports are private.
          </p>
          <p>
            Unpublished submissions are retained for seven days; published beginnings, pairs, and
            reports for thirty days. Hourly cleanup removes expired data and hidden-card author
            mappings. Saved browser drafts expire seven days after their latest edit. Temporary
            request records used for retrying expire seven days after the latest attempt, and are
            removed sooner when the server confirms a result.
          </p>
          <p>
            Usage and cost records contain no story text or identity. Individual records expire
            after thirty days, except unresolved billing checks; totals remain.
          </p>
          <p>
            Private daily totals count completed stories, first postcard opens and export/share
            requests. We use existing card ownership to avoid counting repeats. These totals contain
            no words or identities and expire after thirty days. Your private postcard-open record
            also keeps track of which replies you have yet to open.
          </p>
          <p>
            AI guidance is optional and stays separate from your words. Starter content is always
            labeled.
          </p>
          <p>
            On a completed human story, either co-writer can send one private thank-you. Only the
            two original writers can see it; opening a note does not send one. It stays with the
            story under the same retention and hiding rules.
          </p>
          <p>
            Phone shake is optional and can be turned off on the bottle screen. Motion readings stay
            on your device and are never saved or sent.
          </p>
        </Modal>
      )}
      {modal === 'hide' && card && (
        <Modal title="Hide this reply?" onClose={() => setModal(null)}>
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
                run('Hiding…', async (stillHere) => {
                  await game.hide(card.id);
                  if (stillHere()) {
                    setModal(null);
                    navigate({ view: 'collection' });
                    setToast('Postcard hidden');
                  }
                })
              }
            >
              Hide postcard
            </button>
          </div>
        </Modal>
      )}
      {modal === 'withdraw' && beginning && ownsBeginning && beginning.id === withdrawalId && (
        <Modal title="Withdraw this bottle?" onClose={() => setModal(null)} canClose={!busy}>
          <p>
            Your beginning and all its replies will leave the sea, both authors’ collections, and
            their public links. Nobody will be able to add another ending.
          </p>
          <p>Saved images and screenshots can still exist. This does not restore a daily turn.</p>
          {error && <p role="alert">{error}</p>}
          <div className="modal-actions">
            <button className="button secondary" disabled={!!busy} onClick={() => setModal(null)}>
              Keep it drifting
            </button>
            <button
              className="button primary"
              disabled={!!busy || !s.connected}
              onClick={() => {
                const bottleId = beginning.id;
                void run('Withdrawing…', async (stillHere) => {
                  await confirmWithdrawal(bottleId);
                  if (
                    stillHere() &&
                    navigation.current.view === 'beginning' &&
                    navigation.current.selectedBeginningId === bottleId
                  ) {
                    setModal(null);
                    navigate({ view: 'collection' });
                  }
                  setToast('Bottle withdrawn');
                });
              }}
            >
              {busy === 'Withdrawing…' ? 'Withdrawing…' : 'Withdraw bottle'}
            </button>
          </div>
        </Modal>
      )}
      {modal === 'report' && (
        <Modal title="Report" onClose={() => setModal(null)}>
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
                  run('Sending report…', async (stillHere) => {
                    await game.report(
                      view === 'play' ? active!.id : '',
                      view === 'card' ? selected : '',
                      reason,
                    );
                    if (stillHere()) {
                      setModal(null);
                      if (view === 'card' && ownership) navigate({ view: 'collection' });
                      setToast('Reported. Thank you for looking out.');
                    }
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
const appRoot = import.meta.hot?.data.driftRoot ?? createRoot(document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.data.driftRoot = appRoot;
appRoot.render(<App />);
