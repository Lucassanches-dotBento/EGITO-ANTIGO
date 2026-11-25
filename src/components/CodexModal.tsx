import { X } from 'lucide-react';
import { useState } from 'react';
import { GODS, GodId, Language, UI_TEXT } from '../game/data';

interface CodexModalProps {
  lang: Language;
  onClose: () => void;
}

const GOD_ORDER: GodId[] = ['bastet', 'anubis', 'osiris', 'horus', 'ra'];

export function CodexModal({ lang, onClose }: CodexModalProps) {
  const [selectedId, setSelectedId] = useState<GodId>('bastet');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const t = UI_TEXT[lang];
  const selected = GODS[selectedId];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t.codexTitle}
    >
      <div className="w-full max-w-4xl rounded-2xl border border-amber-500/35 bg-[#120C06] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-amber-500/20 px-6 py-4">
          <h2 className="font-display text-xl md:text-2xl font-bold text-amber-200 tracking-wide">
            {t.codexTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/30 text-amber-200 hover:bg-amber-500/15 transition-colors cursor-pointer"
            aria-label={t.closeButton}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label={t.codexTitle}>
            {GOD_ORDER.map((id) => {
              const g = GODS[id];
              const active = id === selectedId;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedId(id)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-stone-900/90 text-amber-200/80 border border-amber-500/20 hover:border-amber-400/50 hover:text-amber-100'
                  }`}
                >
                  {g.name[lang]}
                </button>
              );
            })}
          </div>

          <div className="grid md:grid-cols-[260px_1fr] gap-6 items-stretch">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-amber-500/30 bg-[#1B1208]">
              {!failedImages[selected.id] ? (
                <img
                  src={selected.portrait}
                  alt={selected.name[lang]}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setFailedImages((prev) => ({ ...prev, [selected.id]: true }))
                  }
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-amber-950 to-stone-950 p-4 text-center">
                  <span className="font-display text-3xl text-amber-300">☥</span>
                  <span className="mt-2 font-display text-lg text-amber-100">
                    {selected.name[lang]}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-amber-400/90 tracking-wide">
                  {selected.title[lang]}
                </p>
                <h3 className="font-display text-2xl md:text-3xl font-bold text-amber-100 mt-1">
                  {selected.name[lang]}
                </h3>
                <p className="mt-3 text-sm md:text-base leading-relaxed text-amber-100/85">
                  {selected.lore[lang]}
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/25 bg-[#1A1107] p-4">
                <p className="text-xs font-semibold text-amber-400">
                  {selected.powerName[lang]}
                </p>
                <p className="mt-1 text-sm text-amber-100/90">{selected.powerDesc[lang]}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
