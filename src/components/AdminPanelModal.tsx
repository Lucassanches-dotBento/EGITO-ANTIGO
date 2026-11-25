import { User } from 'firebase/auth';
import { RotateCcw, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  adminResetUserStats,
  adminSetUserRole,
  BOOTSTRAPPED_ADMINS,
  isBootstrappedAdminEmail,
  subscribeAllUsers,
  UserProfileData,
} from '../firebase';
import { CHAMBERS, Language, translateToHieroglyphs } from '../game/data';

interface AdminPanelModalProps {
  lang: Language;
  currentUser: User;
  onStartFromChamber: (chamberIndex: number) => void;
  onClose: () => void;
}

const ADMIN_COPY: Record<
  Language,
  {
    title: string;
    subtitle: string;
    foundersTitle: string;
    registered: string;
    awaitingLogin: string;
    quickLaunchTitle: string;
    explorersTitle: string;
    totalExplorers: string;
    totalRuns: string;
    topScore: string;
    roleAdmin: string;
    rolePlayer: string;
    founderProtected: string;
    promoteBtn: string;
    demoteBtn: string;
    resetBtn: string;
    noExplorers: string;
  }
> = {
  pt: {
    title: 'Painel Administrativo do Templo',
    subtitle: 'Controle de administradores, estatísticas e teste rápido das câmaras',
    foundersTitle: 'Administradores Principais',
    registered: 'Ativo',
    awaitingLogin: 'Aguardando 1º login',
    quickLaunchTitle: 'Iniciar Diretamente em uma Câmara',
    explorersTitle: 'Exploradores Cadastrados',
    totalExplorers: 'Exploradores',
    totalRuns: 'Expedições Totais',
    topScore: 'Recorde de Ma’at',
    roleAdmin: 'Admin',
    rolePlayer: 'Jogador',
    founderProtected: 'Fundador',
    promoteBtn: 'Tornar Admin',
    demoteBtn: 'Tornar Jogador',
    resetBtn: 'Zerar Placar',
    noExplorers: 'Nenhum explorador registrado ainda.',
  },
  en: {
    title: 'Temple Admin Console',
    subtitle: 'Administrator access, explorer progression, and chamber testing',
    foundersTitle: 'Lead Administrators',
    registered: 'Active',
    awaitingLogin: 'Awaiting 1st sign-in',
    quickLaunchTitle: 'Launch Directly Into Chamber',
    explorersTitle: 'Registered Explorers',
    totalExplorers: 'Explorers',
    totalRuns: 'Total Expeditions',
    topScore: 'Top Ma’at Score',
    roleAdmin: 'Admin',
    rolePlayer: 'Player',
    founderProtected: 'Founder',
    promoteBtn: 'Make Admin',
    demoteBtn: 'Make Player',
    resetBtn: 'Reset Stats',
    noExplorers: 'No explorers registered yet.',
  },
  es: {
    title: 'Panel Administrativo del Templo',
    subtitle: 'Gestión de administradores, estadísticas y prueba rápida de cámaras',
    foundersTitle: 'Administradores Principales',
    registered: 'Activo',
    awaitingLogin: 'Esperando 1.er acceso',
    quickLaunchTitle: 'Iniciar Directamente en una Cámara',
    explorersTitle: 'Exploradores Registrados',
    totalExplorers: 'Exploradores',
    totalRuns: 'Expediciones Totales',
    topScore: 'Récord de Ma’at',
    roleAdmin: 'Admin',
    rolePlayer: 'Jugador',
    founderProtected: 'Fundador',
    promoteBtn: 'Hacer Admin',
    demoteBtn: 'Hacer Jugador',
    resetBtn: 'Reiniciar Puntos',
    noExplorers: 'Aún no hay exploradores registrados.',
  },
};

export function AdminPanelModal({
  lang,
  currentUser,
  onStartFromChamber,
  onClose,
}: AdminPanelModalProps) {
  const c = ADMIN_COPY[lang];
  const [users, setUsers] = useState<UserProfileData[]>([]);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const canListAll = isBootstrappedAdminEmail(currentUser.email) && currentUser.emailVerified;

  useEffect(() => {
    if (!canListAll) return;
    const unsub = subscribeAllUsers((list) => {
      setUsers(list);
    });
    return () => unsub();
  }, [canListAll]);

  const totalRuns = users.reduce((sum, u) => sum + (u.gamesPlayed || 0), 0);
  const topScore = users.reduce((max, u) => Math.max(max, u.bestScore || 0), 0);

  async function handleToggleRole(u: UserProfileData) {
    setBusyUid(u.uid);
    try {
      await adminSetUserRole({
        targetUser: u,
        nextRole: u.role === 'admin' ? 'player' : 'admin',
        grantedByUid: currentUser.uid,
      });
    } finally {
      setBusyUid(null);
    }
  }

  async function handleReset(u: UserProfileData) {
    setBusyUid(u.uid);
    try {
      await adminResetUserStats(u.uid);
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={c.title}
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-amber-500/40 bg-[#120C06] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-amber-500/20 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
              <h2 className="font-display text-xl font-bold text-amber-100">{c.title}</h2>
            </div>
            <p className="mt-0.5 text-xs text-amber-200/70">{c.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 text-amber-200 hover:bg-amber-500/15 cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          {/* Founding Admins Row */}
          <div>
            <h3 className="text-xs font-semibold text-amber-300 mb-2.5">{c.foundersTitle}</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              {BOOTSTRAPPED_ADMINS.map((founder) => {
                const matched = users.find(
                  (u) => u.email.toLowerCase() === founder.email.toLowerCase()
                );
                return (
                  <div
                    key={founder.email}
                    className="rounded-xl border border-amber-500/25 bg-[#191108] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-amber-100">
                        {founder.name}
                      </span>
                      <span className="text-[11px] font-medium text-amber-300">
                        {matched ? c.registered : c.awaitingLogin}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-amber-200/70 truncate" title={founder.email}>
                      {founder.email}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Chamber Launch for Admins */}
          <div>
            <h3 className="text-xs font-semibold text-amber-300 mb-2.5">{c.quickLaunchTitle}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {CHAMBERS.map((ch) => (
                <button
                  key={ch.index}
                  type="button"
                  onClick={() => onStartFromChamber(ch.index)}
                  className="rounded-xl border border-amber-500/30 bg-[#1B1208] hover:border-amber-400 hover:bg-amber-500/15 px-3 py-2.5 text-left transition-colors cursor-pointer"
                >
                  <div className="font-mono-tabular text-[11px] font-bold text-amber-400">
                    0{ch.index + 1} · {ch.word}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-amber-100 truncate">
                    {ch.chamberName[lang].split('·')[1]?.trim() || ch.chamberName[lang]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Aggregate Stats + Explorer Table */}
          {canListAll && (
            <>
              <div className="grid grid-cols-3 gap-3 border-y border-amber-500/20 py-4 text-center">
                <div>
                  <p className="text-xs text-amber-300/75">{c.totalExplorers}</p>
                  <p className="font-mono-tabular text-xl font-bold text-amber-100 mt-0.5">
                    {users.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-amber-300/75">{c.totalRuns}</p>
                  <p className="font-mono-tabular text-xl font-bold text-amber-100 mt-0.5">
                    {totalRuns}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-amber-300/75">{c.topScore}</p>
                  <p className="font-mono-tabular text-xl font-bold text-amber-100 mt-0.5">
                    {topScore}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-amber-300 mb-2.5">{c.explorersTitle}</h3>
                {users.length === 0 ? (
                  <p className="text-xs text-amber-200/70">{c.noExplorers}</p>
                ) : (
                  <div className="space-y-2">
                    {users.map((u) => {
                      const isFounder = isBootstrappedAdminEmail(u.email);
                      const isBusy = busyUid === u.uid;
                      return (
                        <div
                          key={u.uid}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-[#191108] px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-semibold text-amber-100 truncate">
                                {u.displayName}
                              </span>
                              <span className="text-amber-500/50">·</span>
                              <span className="text-amber-200 text-base">
                                {translateToHieroglyphs(u.cartoucheName)}
                              </span>
                              <span className="text-amber-500/50">·</span>
                              <span
                                className={`text-xs font-semibold ${
                                  u.role === 'admin' ? 'text-amber-400' : 'text-amber-200/70'
                                }`}
                              >
                                {u.role === 'admin' ? c.roleAdmin : c.rolePlayer}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-amber-200/65 truncate">
                              {u.email} · <span className="font-mono-tabular">{u.bestScore} Ma’at</span> ·{' '}
                              <span className="font-mono-tabular">{u.chambersClearedMax}/5</span> ·{' '}
                              <span className="font-mono-tabular">{u.gamesPlayed}x</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isFounder ? (
                              <span className="text-xs font-medium text-amber-400/80 px-2">
                                {c.founderProtected}
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleToggleRole(u)}
                                className="rounded-lg border border-amber-500/30 bg-[#120C06] hover:bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {u.role === 'admin' ? c.demoteBtn : c.promoteBtn}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleReset(u)}
                              className="flex items-center gap-1 rounded-lg border border-amber-500/25 bg-[#120C06] hover:border-red-400/50 hover:text-red-200 px-2.5 py-1.5 text-xs font-medium text-amber-200/80 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>{c.resetBtn}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
