import { linkWithPopup, User } from 'firebase/auth';
import { LogOut, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import {
  ExpeditionRunData,
  googleProvider,
  isBootstrappedAdminEmail,
  UserProfileData,
} from '../firebase';
import { Language, translateToHieroglyphs } from '../game/data';

interface ProfileModalProps {
  lang: Language;
  user: User;
  profile: UserProfileData | null;
  runs: ExpeditionRunData[];
  onRefreshVerification: () => Promise<void>;
  onResendVerification: () => Promise<void>;
  onSignOut: () => void;
  onClose: () => void;
}

const PROFILE_COPY: Record<
  Language,
  {
    title: string;
    bestScore: string;
    chambersMax: string;
    expeditions: string;
    recentRuns: string;
    noRuns: string;
    victoryLabel: string;
    defeatLabel: string;
    verifyNotice: string;
    anonNotice: string;
    linkGoogleBtn: string;
    resendBtn: string;
    refreshBtn: string;
    signOutBtn: string;
    roleAdmin: string;
    rolePlayer: string;
    anonName: string;
  }
> = {
  pt: {
    title: 'Perfil do Explorador',
    bestScore: 'Melhor Ma’at',
    chambersMax: 'Câmaras Máx.',
    expeditions: 'Expedições',
    recentRuns: 'Últimas Expedições',
    noRuns: 'Nenhuma expedição registrada ainda. Inicie sua jornada no templo!',
    victoryLabel: 'Vitória',
    defeatLabel: 'Tentativa',
    verifyNotice:
      'Confirme seu e-mail para habilitar o salvamento automático na nuvem (ou entre com o Google).',
    anonNotice:
      'Você entrou com uma conta anônima temporária. Vincule ao Google para salvar seu progresso permanentemente na nuvem.',
    linkGoogleBtn: 'Vincular Conta Google',
    resendBtn: 'Reenviar confirmação',
    refreshBtn: 'Já confirmei',
    signOutBtn: 'Sair da Conta',
    roleAdmin: 'Administrador',
    rolePlayer: 'Explorador',
    anonName: 'Viajante Anônimo',
  },
  en: {
    title: 'Explorer Profile',
    bestScore: 'Best Ma’at',
    chambersMax: 'Max Chambers',
    expeditions: 'Expeditions',
    recentRuns: 'Recent Expeditions',
    noRuns: 'No expeditions recorded yet. Enter the temple to record your first run!',
    victoryLabel: 'Victory',
    defeatLabel: 'Attempt',
    verifyNotice:
      'Verify your email to enable cloud save sync (or sign in with Google).',
    anonNotice:
      'You are using a temporary anonymous account. Link a Google account to save progress permanently in the cloud.',
    linkGoogleBtn: 'Link Google Account',
    resendBtn: 'Resend email',
    refreshBtn: 'I verified',
    signOutBtn: 'Sign Out',
    roleAdmin: 'Administrator',
    rolePlayer: 'Explorer',
    anonName: 'Anonymous Traveler',
  },
  es: {
    title: 'Perfil del Explorador',
    bestScore: 'Mejor Ma’at',
    chambersMax: 'Cámaras Máx.',
    expeditions: 'Expediciones',
    recentRuns: 'Últimas Expediciones',
    noRuns: 'Aún no hay expediciones registradas. ¡Entra al templo para jugar!',
    victoryLabel: 'Victoria',
    defeatLabel: 'Intento',
    verifyNotice:
      'Confirma tu correo para activar el guardado en la nube (o entra con Google).',
    anonNotice:
      'Usas una cuenta anónima temporal. Vincúlala con Google para guardar tu progreso en la nube.',
    linkGoogleBtn: 'Vincular Cuenta Google',
    resendBtn: 'Reenviar correo',
    refreshBtn: 'Ya confirmé',
    signOutBtn: 'Cerrar Sesión',
    roleAdmin: 'Administrador',
    rolePlayer: 'Explorador',
    anonName: 'Viajero Anónimo',
  },
};

export function ProfileModal({
  lang,
  user,
  profile,
  runs,
  onRefreshVerification,
  onResendVerification,
  onSignOut,
  onClose,
}: ProfileModalProps) {
  const c = PROFILE_COPY[lang];
  const [linkErr, setLinkErr] = useState('');
  const displayName =
    profile?.displayName || user.displayName || (user.isAnonymous ? c.anonName : 'Explorador');
  const cartouche = profile?.cartoucheName || (user.isAnonymous ? 'VIAJANTE' : displayName.slice(0, 18));
  const isAdmin = profile?.role === 'admin' || isBootstrappedAdminEmail(user.email);

  async function handleLinkGoogle() {
    setLinkErr('');
    try {
      await linkWithPopup(user, googleProvider);
      await onRefreshVerification();
    } catch (err) {
      setLinkErr(err instanceof Error ? err.message : 'Erro ao vincular conta.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={c.title}
    >
      <div className="w-full max-w-xl rounded-2xl border border-amber-500/35 bg-[#120C06] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-amber-500/20 px-6 py-4">
          <h2 className="font-display text-xl font-bold text-amber-200">{c.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 text-amber-200 hover:bg-amber-500/15 cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-amber-100">{displayName}</h3>
              <p className="text-xs text-amber-300/75">
                {user.email || c.anonName} ·{' '}
                <span className={isAdmin ? 'text-amber-400 font-semibold' : ''}>
                  {isAdmin ? c.roleAdmin : c.rolePlayer}
                </span>
              </p>
            </div>
            <div className="rounded-lg border border-amber-500/25 bg-[#1B1208] px-3.5 py-2 text-right">
              <div className="text-[11px] text-amber-400/80">{cartouche.toUpperCase()}</div>
              <div className="text-lg text-amber-200 tracking-widest">
                {translateToHieroglyphs(cartouche)}
              </div>
            </div>
          </div>

          {user.isAnonymous && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-xs text-amber-100 space-y-3">
              <p>{c.anonNotice}</p>
              {linkErr && <p className="text-red-300">{linkErr}</p>}
              <button
                type="button"
                onClick={handleLinkGoogle}
                className="rounded-lg bg-amber-500 px-3.5 py-2 font-bold text-stone-950 hover:bg-amber-400 cursor-pointer"
              >
                {c.linkGoogleBtn}
              </button>
            </div>
          )}

          {!user.isAnonymous && !user.emailVerified && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-xs text-amber-100 space-y-3">
              <p>{c.verifyNotice}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onResendVerification}
                  className="rounded-lg border border-amber-400/40 bg-[#1B1208] px-3 py-1.5 font-semibold text-amber-200 hover:bg-amber-500/20 cursor-pointer"
                >
                  {c.resendBtn}
                </button>
                <button
                  type="button"
                  onClick={onRefreshVerification}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 font-bold text-stone-950 hover:bg-amber-400 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{c.refreshBtn}</span>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 border-y border-amber-500/20 py-4 text-center">
            <div>
              <p className="text-xs text-amber-300/75">{c.bestScore}</p>
              <p className="font-mono-tabular text-xl font-bold text-amber-100 mt-0.5">
                {profile?.bestScore ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-amber-300/75">{c.chambersMax}</p>
              <p className="font-mono-tabular text-xl font-bold text-amber-100 mt-0.5">
                {profile?.chambersClearedMax ?? 0}/5
              </p>
            </div>
            <div>
              <p className="text-xs text-amber-300/75">{c.expeditions}</p>
              <p className="font-mono-tabular text-xl font-bold text-amber-100 mt-0.5">
                {profile?.gamesPlayed ?? 0}
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-amber-300 mb-2.5">{c.recentRuns}</h4>
            {runs.length === 0 ? (
              <p className="text-xs text-amber-200/65 py-3">{c.noRuns}</p>
            ) : (
              <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                {runs.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-[#191108] px-3.5 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={r.victory ? 'text-amber-300 font-semibold' : 'text-amber-200/70'}>
                        {r.victory ? c.victoryLabel : c.defeatLabel}
                      </span>
                      <span className="text-amber-500/50">·</span>
                      <span className="text-amber-100 font-medium">{r.cartoucheName}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono-tabular text-amber-200">
                      <span>{r.chambersCleared}/5</span>
                      <span className="font-bold text-amber-300">{r.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-[#1B1208] px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/15 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{c.signOutBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
