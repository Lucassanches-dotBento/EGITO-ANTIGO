import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailLink,
  signOut,
  User,
} from 'firebase/auth';
import { BookOpen, Eye, LogIn, Pause, ShieldCheck, UserCircle2, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminPanelModal } from './components/AdminPanelModal';
import { AuthScreen, EMAIL_LINK_STORAGE_KEY } from './components/AuthScreen';
import { CodexModal } from './components/CodexModal';
import { ChamberClearModal, EndGameModal, PauseModal } from './components/GameModals';
import { ProfileModal } from './components/ProfileModal';
import {
  auth,
  ensureUserProfile,
  ExpeditionRunData,
  isBootstrappedAdminEmail,
  recordExpeditionRun,
  subscribeUserProfile,
  subscribeUserRuns,
  updateProfileCartouche,
  UserProfileData,
} from './firebase';
import { soundEngine } from './game/audio';
import {
  CHAMBERS,
  GODS,
  Language,
  letterToHieroglyph,
  RelicOption,
  translateToHieroglyphs,
  UI_TEXT,
} from './game/data';
import { GameMode, HudSnapshot, PyramidGameEngine } from './game/engine';
import {
  recordServerRun,
  serverAccountToProfile,
  ServerAuthSession,
  serverRunsToExpeditionRuns,
  updateServerCartouche,
} from './lib/serverAuth';

const INITIAL_HUD: HudSnapshot = {
  hp: 4,
  maxHp: 4,
  score: 0,
  chamberIndex: 0,
  godId: 'bastet',
  word: 'SOL',
  collectedMask: [false, false, false],
  nextGlyphIndex: 0,
  portalOpen: false,
  divineEnergy: 65,
  dashReadyRatio: 1,
  bossHp: 0,
  bossMaxHp: 0,
  combos: 0,
  activePowerTimer: 0,
};

function AnkhIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 28"
      className={`h-5 w-4 transition-opacity ${
        filled ? 'text-amber-400 opacity-100' : 'text-stone-600 opacity-45'
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <ellipse
        cx="12"
        cy="7.5"
        rx="4.2"
        ry="5"
        fill={filled ? 'currentColor' : 'none'}
        fillOpacity={filled ? 0.25 : 0}
      />
      <path d="M12 12.5V26" />
      <path d="M6.5 16H17.5" />
    </svg>
  );
}

function TitleEmblemSvg() {
  return (
    <svg
      viewBox="0 0 220 68"
      className="h-14 w-auto text-amber-400"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 32C42 22 68 22 88 30C68 34 44 37 16 32Z"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M204 32C178 22 152 22 132 30C152 34 176 37 204 32Z"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle
        cx="110"
        cy="30"
        r="14"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M110 19L121 38H99L110 19Z" fill="currentColor" />
      <path d="M40 54H180" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
      <circle cx="110" cy="54" r="3" fill="currentColor" />
    </svg>
  );
}

export default function App() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<PyramidGameEngine | null>(null);
  const [webglLost, setWebglLost] = useState(false);

  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [serverToken, setServerToken] = useState<string | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [recentRuns, setRecentRuns] = useState<ExpeditionRunData[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const [mode, setMode] = useState<GameMode>('TITLE_MENU');
  const [lang, setLang] = useState<Language>('pt');
  const [muted, setMuted] = useState(false);
  const [playerName, setPlayerName] = useState('FARAÓ');
  const [showCodex, setShowCodex] = useState(false);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [endStats, setEndStats] = useState({
    score: 0,
    chambersCleared: 0,
    combos: 0,
    relics: 0,
  });

  const relicCountRef = useRef(0);
  const modeRef = useRef<GameMode>('TITLE_MENU');
  modeRef.current = mode;

  const authUserRef = useRef<User | null>(null);
  authUserRef.current = authUser;
  const serverTokenRef = useRef<string | null>(null);
  serverTokenRef.current = serverToken;
  const userProfileRef = useRef<UserProfileData | null>(null);
  userProfileRef.current = userProfile;
  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;

  const t = UI_TEXT[lang];
  const cartouchePreview = useMemo(
    () => translateToHieroglyphs(playerName || 'FARAÓ'),
    [playerName]
  );

  // Complete Passwordless Magic Link sign-in if returning from email link
  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const savedEmail = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
      if (savedEmail) {
        signInWithEmailLink(auth, savedEmail, window.location.href)
          .then(() => {
            window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
            window.history.replaceState({}, document.title, window.location.pathname);
          })
          .catch((err) => {
            console.error('Magic link sign-in failed:', err);
          });
      }
    }
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (user) {
        setServerToken(null);
        setGuestMode(false);
        const fallbackCartouche = (user.displayName || 'FARAÓ').slice(0, 18).toUpperCase();
        setPlayerName((prev) => (prev === 'FARAÓ' && user.displayName ? fallbackCartouche : prev));
      } else if (!serverTokenRef.current) {
        setUserProfile(null);
        setRecentRuns([]);
      }
    });
    return () => unsub();
  }, []);

  // Firestore Profile & Runs subscription (only when verified)
  useEffect(() => {
    if (!authReady || !authUser || !authUser.emailVerified) {
      return;
    }

    let unsubProfile: (() => void) | undefined;
    let unsubRuns: (() => void) | undefined;
    let cancelled = false;

    const initProfile = async () => {
      await ensureUserProfile({
        uid: authUser.uid,
        displayName: authUser.displayName || 'Explorador',
        cartoucheName: (playerNameRef.current || authUser.displayName || 'FARAÓ').slice(0, 18),
        email: authUser.email || '',
      });
      if (cancelled) return;

      unsubProfile = subscribeUserProfile(authUser.uid, (prof) => {
        setUserProfile(prof);
        if (prof?.cartoucheName) {
          setPlayerName(prof.cartoucheName);
        }
      });

      unsubRuns = subscribeUserRuns(authUser.uid, (runs) => {
        setRecentRuns(runs);
      });
    };

    initProfile().catch((err) => {
      console.error('Failed to initialize profile:', err);
    });

    return () => {
      cancelled = true;
      if (unsubProfile) unsubProfile();
      if (unsubRuns) unsubRuns();
    };
  }, [authReady, authUser]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleServerAuthenticated = useCallback((session: ServerAuthSession) => {
    setServerToken(session.token);
    setGuestMode(false);
    setUserProfile(serverAccountToProfile(session.user));
    setRecentRuns(serverRunsToExpeditionRuns(session.runs));
    if (session.user.cartoucheName) {
      setPlayerName(session.user.cartoucheName);
    }
  }, []);

  const handleStartExpeditionAt = useCallback(
    (chamberIdx = 0) => {
      const engine = engineRef.current;
      if (!engine) return;
      relicCountRef.current = 0;
      setShowCodex(false);
      setShowProfile(false);
      setShowAdmin(false);

      if (serverToken) {
        updateServerCartouche(serverToken, {
          displayName: userProfile?.displayName || playerName || 'Explorador',
          cartoucheName: playerName || 'FARAÓ',
        })
          .then((res) => setUserProfile(serverAccountToProfile(res.user)))
          .catch((err) => console.error(err));
      } else if (authUser && authUser.emailVerified) {
        updateProfileCartouche(
          authUser.uid,
          authUser.displayName || playerName || 'Explorador',
          playerName || 'FARAÓ'
        ).catch((err) => console.error(err));
      }

      engine.startNewExpedition(chamberIdx);
      setMode('PLAYING');
    },
    [authUser, serverToken, userProfile, playerName]
  );

  const handleStartGame = useCallback(() => {
    handleStartExpeditionAt(0);
  }, [handleStartExpeditionAt]);

  const handlePauseToggle = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (modeRef.current === 'PLAYING') {
      engine.setMode('PAUSED');
      setMode('PAUSED');
    } else if (modeRef.current === 'PAUSED') {
      setShowCodex(false);
      engine.setMode('PLAYING');
      setMode('PLAYING');
    }
  }, []);

  const handleSelectRelic = useCallback((relicId: RelicOption['id']) => {
    const engine = engineRef.current;
    if (!engine) return;
    relicCountRef.current += 1;
    engine.applyRelicAndAdvance(relicId);
    setMode('PLAYING');
  }, []);

  const handleRestartChamber = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.restartCurrentChamber();
    setMode('PLAYING');
  }, []);

  const handleBackToTitle = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setShowCodex(false);
    engine.setMode('TITLE_MENU');
    setMode('TITLE_MENU');
  }, []);

  const handleSignOut = useCallback(async () => {
    setShowProfile(false);
    setShowAdmin(false);
    setGuestMode(false);
    setServerToken(null);
    setUserProfile(null);
    setRecentRuns([]);
    if (auth.currentUser) {
      await signOut(auth);
    }
  }, []);

  const handleRefreshVerification = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setAuthUser({ ...auth.currentUser } as User);
  }, []);

  const handleResendVerification = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Mount 3D Three.js Engine once
  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    const persistRun = (score: number, chambersCleared: number, combos: number, victory: boolean) => {
      const activeServerToken = serverTokenRef.current;
      if (activeServerToken) {
        recordServerRun(activeServerToken, {
          cartoucheName: playerNameRef.current || 'FARAÓ',
          score,
          chambersCleared,
          combos,
          relicCount: relicCountRef.current,
          victory,
        })
          .then((res) => {
            setUserProfile(serverAccountToProfile(res.user));
            setRecentRuns(serverRunsToExpeditionRuns(res.runs));
          })
          .catch((err) => console.error('Failed to record server run:', err));
        return;
      }

      const user = authUserRef.current;
      if (user && user.emailVerified) {
        recordExpeditionRun({
          uid: user.uid,
          cartoucheName: playerNameRef.current || 'FARAÓ',
          score,
          chambersCleared,
          combos,
          relicCount: relicCountRef.current,
          victory,
          currentProfile: userProfileRef.current,
        }).catch((err) => console.error('Failed to record run:', err));
      }
    };

    const engine = new PyramidGameEngine(container, {
      onHudUpdate: (snap) => setHud(snap),
      onChamberClear: (chamberIndex, score, combos) => {
        setEndStats({
          score,
          chambersCleared: chamberIndex + 1,
          combos,
          relics: relicCountRef.current,
        });
        setMode('CHAMBER_CLEAR');
      },
      onVictory: (score, combos) => {
        setEndStats({
          score,
          chambersCleared: CHAMBERS.length,
          combos,
          relics: relicCountRef.current,
        });
        setMode('VICTORY');
        persistRun(score, CHAMBERS.length, combos, true);
      },
      onGameOver: (score, chamberIndex, combos) => {
        setEndStats({
          score,
          chambersCleared: chamberIndex,
          combos,
          relics: relicCountRef.current,
        });
        setMode('GAME_OVER');
        persistRun(score, chamberIndex, combos, false);
      },
      onPauseToggle: () => {
        if (modeRef.current === 'PLAYING') {
          engine.setMode('PAUSED');
          setMode('PAUSED');
        } else if (modeRef.current === 'PAUSED') {
          setShowCodex(false);
          engine.setMode('PLAYING');
          setMode('PLAYING');
        }
      },
      onWebGLContextLost: () => setWebglLost(true),
    });

    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const isSignedIn = Boolean(authUser || serverToken);
  const authMode: 'firebase' | 'server' = serverToken ? 'server' : 'firebase';
  const activeEmail = userProfile?.email || authUser?.email || '';
  const activeUid = userProfile?.uid || authUser?.uid || '';
  const showAuthScreen = authReady && !isSignedIn && !guestMode && mode === 'TITLE_MENU';
  const isAdmin = Boolean(
    isSignedIn && (userProfile?.role === 'admin' || isBootstrappedAdminEmail(activeEmail))
  );

  // Enter / Space shortcut on Title Screen (only when Auth/Modals are closed)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode !== 'TITLE_MENU' || showCodex || showProfile || showAdmin || showAuthScreen || !authReady)
        return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON') {
        if (e.key === 'Enter' && tag === 'INPUT') {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }
      if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        handleStartGame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, showCodex, showProfile, showAdmin, showAuthScreen, authReady, handleStartGame]);

  const chamberDef = CHAMBERS[hud.chamberIndex] || CHAMBERS[0];
  const activeGod = GODS[hud.godId];

  const authActionLabel =
    lang === 'pt' ? 'Entrar / Cadastrar' : lang === 'es' ? 'Entrar / Registro' : 'Sign In / Up';
  const adminActionLabel =
    lang === 'pt' ? 'Painel Admin' : lang === 'es' ? 'Panel Admin' : 'Admin Panel';

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#090704] select-none">
      {/* Isolated 3D WebGL Viewport */}
      <div
        ref={viewportRef}
        className="h-full w-full cursor-crosshair"
        aria-label={t.gameTitle}
      />

      {webglLost && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#090704]/95 p-6 text-center">
          <div className="max-w-md rounded-xl border border-amber-500/40 bg-[#120C06] p-6 text-amber-100">
            <p className="font-display text-lg font-bold text-amber-300">{t.gameTitle}</p>
            <p className="mt-2 text-sm text-amber-100/80">
              {lang === 'pt'
                ? 'O contexto 3D WebGL foi interrompido. Recarregue a página para continuar.'
                : 'The 3D WebGL context was interrupted. Reload the page to continue.'}
            </p>
          </div>
        </div>
      )}

      {/* DEDICATED SIGNUP & LOGIN PAGE */}
      {showAuthScreen && (
        <AuthScreen
          lang={lang}
          onChangeLang={setLang}
          onContinueAsGuest={() => setGuestMode(true)}
          onAuthenticated={(preferredCartouche) => {
            if (preferredCartouche) setPlayerName(preferredCartouche);
            setGuestMode(false);
          }}
          onServerAuthenticated={handleServerAuthenticated}
        />
      )}

      {/* TITLE SCREEN OVERLAY */}
      {mode === 'TITLE_MENU' && !showAuthScreen && authReady && (
        <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 md:p-10 pointer-events-none">
          {/* Top Utility Bar */}
          <div className="flex flex-wrap items-center justify-end gap-3 pointer-events-auto">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAdmin(true)}
                className="flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-500/15 px-3.5 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition-colors cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4 text-amber-300" />
                <span className="whitespace-nowrap">{adminActionLabel}</span>
              </button>
            )}

            {isSignedIn ? (
              <button
                type="button"
                onClick={() => setShowProfile(true)}
                className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-[#120C06]/90 px-3.5 py-2 text-xs font-semibold text-amber-100 hover:border-amber-400/70 transition-colors cursor-pointer"
              >
                <UserCircle2 className="h-4 w-4 text-amber-400" />
                <span className="truncate max-w-[140px]">
                  {userProfile?.displayName ||
                    authUser?.displayName ||
                    authUser?.email ||
                    (lang === 'pt' ? 'Anônimo' : lang === 'es' ? 'Anónimo' : 'Anonymous')}
                </span>
                {userProfile && (
                  <span className="font-mono-tabular text-amber-300">
                    · {userProfile.bestScore}
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setGuestMode(false)}
                className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-[#120C06]/90 px-3.5 py-2 text-xs font-semibold text-amber-100 hover:border-amber-400/70 transition-colors cursor-pointer"
              >
                <LogIn className="h-4 w-4 text-amber-400" />
                <span className="whitespace-nowrap">{authActionLabel}</span>
              </button>
            )}

            <div className="flex items-center rounded-lg border border-amber-500/30 bg-[#120C06]/90 p-1">
              {(['pt', 'en', 'es'] as Language[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    lang === code
                      ? 'bg-amber-500 text-stone-950'
                      : 'text-amber-200/80 hover:text-amber-100'
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowCodex(true)}
              className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-[#120C06]/90 px-3.5 py-2 text-xs font-semibold text-amber-100 hover:border-amber-400/60 transition-colors cursor-pointer"
            >
              <BookOpen className="h-4 w-4 text-amber-400" />
              <span className="whitespace-nowrap">{t.codexButton}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleMute}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-[#120C06]/90 text-amber-200 hover:border-amber-400/60 transition-colors cursor-pointer"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>

          {/* Left-Aligned Title Lockup */}
          <div className="my-auto max-w-lg pointer-events-auto">
            <TitleEmblemSvg />

            <p className="mt-3 text-xs font-semibold tracking-[0.2em] text-amber-400 uppercase">
              {t.gameSubtitle}
            </p>
            <h1 className="font-display mt-1 text-4xl sm:text-5xl md:text-6xl font-extrabold text-amber-100 leading-tight [text-wrap:balance]">
              {t.gameTitle}
            </h1>

            {/* Hieroglyphic Cartouche Forge */}
            <div className="mt-6 rounded-xl border border-amber-500/35 bg-[#120C06]/90 p-4">
              <label
                htmlFor="cartouche-name"
                className="block text-xs font-semibold text-amber-300/90 mb-2"
              >
                {t.cartoucheLabel}
              </label>
              <input
                id="cartouche-name"
                type="text"
                maxLength={18}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={t.cartouchePlaceholder}
                className="w-full rounded-lg border border-amber-500/30 bg-[#1B1208] px-3.5 py-2.5 text-sm text-amber-50 placeholder:text-amber-200/40 focus:border-amber-400 focus:outline-none"
              />
              <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-500/20 bg-[#0D0803] px-3.5 py-2.5">
                <span className="text-[11px] font-medium text-amber-400/80">
                  {t.royalCartouche}
                </span>
                <span className="text-xl md:text-2xl text-amber-200 tracking-widest truncate ml-3">
                  {cartouchePreview}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button
                type="button"
                onClick={handleStartGame}
                className="px-7 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-base shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t.startButton}
              </button>
            </div>
          </div>

          <div className="text-center text-xs text-amber-200/70 tracking-wide">
            {t.controlsHint}
          </div>
        </div>
      )}

      {/* ACTIVE GAMEPLAY HUD */}
      {mode === 'PLAYING' && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="rounded-xl border border-amber-500/30 bg-[#120C06]/92 px-3.5 py-2.5">
              <div className="flex items-center gap-1.5" aria-label={`HP ${hud.hp}/${hud.maxHp}`}>
                {Array.from({ length: hud.maxHp }).map((_, i) => (
                  <AnkhIcon key={i} filled={i < hud.hp} />
                ))}
                <span className="ml-2 font-mono-tabular text-xs font-semibold text-amber-200">
                  {hud.hp}/{hud.maxHp}
                </span>
              </div>
              <div className="mt-1 text-xs font-medium text-amber-300/85">
                {chamberDef.chamberName[lang]}
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="rounded-xl border border-amber-500/35 bg-[#120C06]/92 px-4 py-2 text-center">
                {hud.portalOpen ? (
                  <span className="font-display text-xs sm:text-sm font-bold text-amber-300 tracking-wider">
                    {t.portalOpen}
                  </span>
                ) : (
                  <div className="flex items-center gap-2.5">
                    {hud.word.split('').map((ch, idx) => {
                      const collected = hud.collectedMask[idx];
                      const isNext = idx === hud.nextGlyphIndex;
                      return (
                        <div
                          key={idx}
                          className={`flex flex-col items-center px-1.5 py-0.5 rounded-md border ${
                            collected
                              ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                              : isNext
                                ? 'border-amber-300 bg-[#261909] text-amber-100'
                                : 'border-amber-500/20 text-amber-200/45'
                          }`}
                        >
                          <span className="text-lg leading-none">{letterToHieroglyph(ch)}</span>
                          <span className="font-mono-tabular text-[10px] mt-0.5">{ch}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {hud.bossMaxHp > 0 && hud.bossHp > 0 && (
                <div className="w-56 rounded-lg border border-pink-500/40 bg-[#120C06]/92 px-3 py-1.5">
                  <div className="flex justify-between text-[11px] font-semibold text-pink-300">
                    <span>{t.bossLabel}</span>
                    <span className="font-mono-tabular">
                      {hud.bossHp}/{hud.bossMaxHp}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-800">
                    <div
                      className="h-full bg-pink-500 transition-transform duration-150 origin-left"
                      style={{
                        transform: `scaleX(${Math.max(0, hud.bossHp / hud.bossMaxHp)})`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              <div className="rounded-xl border border-amber-500/30 bg-[#120C06]/92 px-3.5 py-2 text-right">
                <div className="text-[11px] text-amber-300/75">{t.scoreLabel}</div>
                <div className="font-mono-tabular text-base font-bold text-amber-100">
                  {hud.score}
                </div>
              </div>

              <button
                type="button"
                onClick={() => engineRef.current?.triggerDivinePower()}
                disabled={hud.divineEnergy < 100}
                className={`rounded-xl border px-3.5 py-2 text-left transition-colors cursor-pointer ${
                  hud.divineEnergy >= 100
                    ? 'border-amber-400 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
                    : 'border-amber-500/25 bg-[#120C06]/92 text-amber-200/60 cursor-default'
                }`}
              >
                <div className="text-[11px] font-semibold whitespace-nowrap">
                  {activeGod.powerName[lang]}
                </div>
                <div className="font-mono-tabular text-xs font-bold text-amber-300">
                  {hud.divineEnergy >= 100 ? t.ready : `${hud.divineEnergy}%`}
                </div>
              </button>

              <button
                type="button"
                onClick={() => engineRef.current?.toggleCameraView()}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-[#120C06]/92 text-amber-200 hover:border-amber-400/60 transition-colors cursor-pointer"
                title="Alternar Câmera 3D (V)"
                aria-label="Camera View"
              >
                <Eye className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={handleToggleMute}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-[#120C06]/92 text-amber-200 hover:border-amber-400/60 transition-colors cursor-pointer"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={handlePauseToggle}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-[#120C06]/92 text-amber-200 hover:border-amber-400/60 transition-colors cursor-pointer"
                aria-label={t.pausedTitle}
              >
                <Pause className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div className="grid grid-cols-3 gap-1.5 md:hidden pointer-events-auto">
              <div />
              <button
                type="button"
                onPointerDown={() => engineRef.current?.setTouchMove(0, -1)}
                onPointerUp={() => engineRef.current?.setTouchMove(0, 0)}
                onPointerLeave={() => engineRef.current?.setTouchMove(0, 0)}
                className="h-12 w-12 rounded-xl border border-amber-500/35 bg-[#120C06]/90 text-amber-200 font-bold"
              >
                ▲
              </button>
              <div />
              <button
                type="button"
                onPointerDown={() => engineRef.current?.setTouchMove(-1, 0)}
                onPointerUp={() => engineRef.current?.setTouchMove(0, 0)}
                onPointerLeave={() => engineRef.current?.setTouchMove(0, 0)}
                className="h-12 w-12 rounded-xl border border-amber-500/35 bg-[#120C06]/90 text-amber-200 font-bold"
              >
                ◀
              </button>
              <button
                type="button"
                onPointerDown={() => engineRef.current?.setTouchMove(0, 1)}
                onPointerUp={() => engineRef.current?.setTouchMove(0, 0)}
                onPointerLeave={() => engineRef.current?.setTouchMove(0, 0)}
                className="h-12 w-12 rounded-xl border border-amber-500/35 bg-[#120C06]/90 text-amber-200 font-bold"
              >
                ▼
              </button>
              <button
                type="button"
                onPointerDown={() => engineRef.current?.setTouchMove(1, 0)}
                onPointerUp={() => engineRef.current?.setTouchMove(0, 0)}
                onPointerLeave={() => engineRef.current?.setTouchMove(0, 0)}
                className="h-12 w-12 rounded-xl border border-amber-500/35 bg-[#120C06]/90 text-amber-200 font-bold"
              >
                ▶
              </button>
            </div>

            <div className="hidden md:block mx-auto text-[11px] text-amber-200/65 bg-[#120C06]/85 border border-amber-500/20 rounded-lg px-3 py-1">
              {t.glyphProgressHint}
            </div>

            <div className="flex gap-2 md:hidden pointer-events-auto">
              <button
                type="button"
                onClick={() => engineRef.current?.triggerDash()}
                className="h-12 px-4 rounded-xl border border-amber-500/35 bg-[#120C06]/90 text-xs font-bold text-amber-200"
              >
                Shift
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.triggerPulse()}
                className="h-12 px-4 rounded-xl bg-amber-500 text-xs font-bold text-stone-950"
              >
                ☀️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHAMBER CLEAR MODAL */}
      {mode === 'CHAMBER_CLEAR' && (
        <ChamberClearModal
          lang={lang}
          chamberIndex={hud.chamberIndex}
          score={endStats.score}
          onSelectRelicAndContinue={handleSelectRelic}
        />
      )}

      {/* PAUSE MODAL */}
      {mode === 'PAUSED' && !showCodex && (
        <PauseModal
          lang={lang}
          onResume={handlePauseToggle}
          onRestartChamber={handleRestartChamber}
          onOpenCodex={() => setShowCodex(true)}
          onBackToTitle={handleBackToTitle}
        />
      )}

      {/* VICTORY / GAME OVER MODAL */}
      {(mode === 'VICTORY' || mode === 'GAME_OVER') && (
        <EndGameModal
          lang={lang}
          isVictory={mode === 'VICTORY'}
          playerName={playerName}
          score={endStats.score}
          chambersCleared={endStats.chambersCleared}
          combos={endStats.combos}
          relicCount={endStats.relics}
          onPlayAgain={handleStartGame}
          onBackToTitle={handleBackToTitle}
        />
      )}

      {/* PROFILE MODAL */}
      {showProfile && isSignedIn && (
        <ProfileModal
          lang={lang}
          authMode={authMode}
          firebaseUser={authUser}
          serverToken={serverToken}
          profile={userProfile}
          runs={recentRuns}
          onRefreshVerification={handleRefreshVerification}
          onResendVerification={handleResendVerification}
          onSignOut={handleSignOut}
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* ADMIN PANEL MODAL */}
      {showAdmin && isSignedIn && isAdmin && (
        <AdminPanelModal
          lang={lang}
          authMode={authMode}
          currentUid={activeUid}
          currentEmail={activeEmail}
          currentEmailVerified={authMode === 'server' ? true : Boolean(authUser?.emailVerified)}
          serverToken={serverToken}
          onStartFromChamber={(chamberIdx) => handleStartExpeditionAt(chamberIdx)}
          onClose={() => setShowAdmin(false)}
        />
      )}

      {/* CODEX MODAL */}
      {showCodex && <CodexModal lang={lang} onClose={() => setShowCodex(false)} />}
    </div>
  );
}
