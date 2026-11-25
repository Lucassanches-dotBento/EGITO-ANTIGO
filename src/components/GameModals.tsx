import { useState } from 'react';
import {
  CHAMBERS,
  GODS,
  Language,
  RELIC_POOL,
  RelicOption,
  translateToHieroglyphs,
  UI_TEXT,
} from '../game/data';

interface ChamberClearModalProps {
  lang: Language;
  chamberIndex: number;
  score: number;
  onSelectRelicAndContinue: (relicId: RelicOption['id']) => void;
}

export function ChamberClearModal({
  lang,
  chamberIndex,
  score,
  onSelectRelicAndContinue,
}: ChamberClearModalProps) {
  const t = UI_TEXT[lang];
  const chamber = CHAMBERS[chamberIndex];
  const nextChamber = CHAMBERS[chamberIndex + 1];
  const god = GODS[chamber.godId];

  // Deterministic 2 relic choices per chamber
  const choiceA = RELIC_POOL[chamberIndex % RELIC_POOL.length];
  const choiceB = RELIC_POOL[(chamberIndex + 2) % RELIC_POOL.length];
  const choices = [choiceA, choiceB];

  const [selectedRelic, setSelectedRelic] = useState<RelicOption['id']>(choiceA.id);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-amber-500/40 bg-[#120C06] p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-stretch">
          <div className="h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-amber-500/35 bg-[#1B1208]">
            {!imgFailed ? (
              <img
                src={god.portrait}
                alt={god.name[lang]}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl text-amber-300">
                ☥
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="text-xs font-medium text-amber-400">
              {t.chamberClearedTitle} · <span className="font-mono-tabular">{score}</span> {t.scoreLabel}
            </div>
            <h2 className="font-display text-2xl font-bold text-amber-100 mt-1">
              {t.blessingGranted}: {god.name[lang]}
            </h2>
            <p className="mt-2 text-sm text-amber-100/80 leading-relaxed">{god.lore[lang]}</p>
          </div>
        </div>

        <div className="mt-6 border-t border-amber-500/20 pt-5">
          <p className="text-xs font-semibold text-amber-300 mb-3">{t.chooseRelic}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {choices.map((relic) => {
              const active = selectedRelic === relic.id;
              return (
                <button
                  key={relic.id}
                  type="button"
                  onClick={() => setSelectedRelic(relic.id)}
                  className={`text-left rounded-xl p-4 border transition-colors cursor-pointer ${
                    active
                      ? 'border-amber-400 bg-amber-500/15'
                      : 'border-amber-500/20 bg-[#191108] hover:border-amber-400/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl" aria-hidden="true">
                      {relic.symbol}
                    </span>
                    <span className="font-semibold text-amber-100 text-sm">
                      {relic.name[lang]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-amber-200/75">{relic.desc[lang]}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          {nextChamber && (
            <span className="text-xs text-amber-200/70">
              {nextChamber.chamberName[lang]} · {GODS[nextChamber.godId].powerName[lang]}
            </span>
          )}
          <button
            type="button"
            onClick={() => onSelectRelicAndContinue(selectedRelic)}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            {t.nextChamber}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PauseModalProps {
  lang: Language;
  onResume: () => void;
  onRestartChamber: () => void;
  onOpenCodex: () => void;
  onBackToTitle: () => void;
}

export function PauseModal({
  lang,
  onResume,
  onRestartChamber,
  onOpenCodex,
  onBackToTitle,
}: PauseModalProps) {
  const t = UI_TEXT[lang];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl border border-amber-500/35 bg-[#120C06] p-6 text-center shadow-2xl">
        <h2 className="font-display text-2xl font-bold text-amber-200">{t.pausedTitle}</h2>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm transition-colors cursor-pointer"
          >
            {t.resumeButton}
          </button>
          <button
            type="button"
            onClick={onRestartChamber}
            className="w-full py-3 px-5 rounded-xl border border-amber-500/30 bg-[#1B1208] hover:bg-amber-500/15 text-amber-100 font-semibold text-sm transition-colors cursor-pointer"
          >
            {t.restartButton}
          </button>
          <button
            type="button"
            onClick={onOpenCodex}
            className="w-full py-3 px-5 rounded-xl border border-amber-500/30 bg-[#1B1208] hover:bg-amber-500/15 text-amber-100 font-semibold text-sm transition-colors cursor-pointer"
          >
            {t.codexButton}
          </button>
          <button
            type="button"
            onClick={onBackToTitle}
            className="w-full py-2.5 px-5 rounded-xl text-amber-300/80 hover:text-amber-100 text-sm transition-colors cursor-pointer"
          >
            {t.backToTitle}
          </button>
        </div>
      </div>
    </div>
  );
}

interface EndGameModalProps {
  lang: Language;
  isVictory: boolean;
  playerName: string;
  score: number;
  chambersCleared: number;
  combos: number;
  relicCount: number;
  onPlayAgain: () => void;
  onBackToTitle: () => void;
}

export function EndGameModal({
  lang,
  isVictory,
  playerName,
  score,
  chambersCleared,
  combos,
  relicCount,
  onPlayAgain,
  onBackToTitle,
}: EndGameModalProps) {
  const t = UI_TEXT[lang];
  const displayName = playerName.trim() || 'FARAÓ';
  const cartouche = translateToHieroglyphs(displayName);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-[#120C06] p-7 text-center shadow-2xl">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-amber-400/50 bg-amber-500/10 text-2xl text-amber-300">
          {isVictory ? '☀️' : '⚖️'}
        </div>

        <h2 className="font-display text-2xl md:text-3xl font-bold text-amber-100">
          {isVictory ? t.victoryTitle : t.gameOverTitle}
        </h2>
        <p className="mt-2 text-sm text-amber-100/80 leading-relaxed">
          {isVictory ? t.victorySubtitle : t.gameOverSubtitle}
        </p>

        <div className="mt-5 rounded-xl border border-amber-500/30 bg-[#1B1208] px-5 py-4">
          <p className="text-xs text-amber-400/85">
            {t.royalCartouche} · {displayName.toUpperCase()}
          </p>
          <p className="mt-1.5 text-2xl md:text-3xl text-amber-200 tracking-widest">
            {cartouche}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-b border-amber-500/20 py-4">
          <div>
            <p className="text-xs text-amber-300/75">{t.scoreLabel}</p>
            <p className="font-mono-tabular text-xl font-bold text-amber-100 mt-0.5">{score}</p>
          </div>
          <div>
            <p className="text-xs text-amber-300/75">{t.chambersClearedStat}</p>
            <p className="font-mono-tabular text-xl font-bold text-amber-100 mt-0.5">
              {chambersCleared}/5
            </p>
          </div>
          <div>
            <p className="text-xs text-amber-300/75">{t.maatCombosStat}</p>
            <p className="font-mono-tabular text-xl font-bold text-amber-100 mt-0.5">
              {combos} · {relicCount} {t.relicsStat.toLowerCase()}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={onPlayAgain}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            {t.playAgain}
          </button>
          <button
            type="button"
            onClick={onBackToTitle}
            className="px-6 py-3 rounded-xl border border-amber-500/30 bg-[#1B1208] hover:bg-amber-500/15 text-amber-100 font-semibold text-sm whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            {t.backToTitle}
          </button>
        </div>
      </div>
    </div>
  );
}
