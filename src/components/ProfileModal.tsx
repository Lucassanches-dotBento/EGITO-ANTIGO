import { linkWithPopup, User } from 'firebase/auth';
import { Eye, EyeOff, KeyRound, LogOut, RefreshCw, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import {
  ExpeditionRunData,
  googleProvider,
  isBootstrappedAdminEmail,
  UserProfileData,
} from '../firebase';
import { Language, translateToHieroglyphs } from '../game/data';
import { setPasswordWithFirebaseToken, updateServerPassword } from '../lib/serverAuth';

interface ProfileModalProps {
  lang: Language;
  authMode: 'firebase' | 'server';
  firebaseUser?: User | null;
  serverToken?: string | null;
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
    changePasswordBtn: string;
    setPasswordBtn: string;
    currentPasswordLabel: string;
    newPasswordLabel: string;
    confirmNewPasswordLabel: string;
    passwordMismatch: string;
    savePasswordBtn: string;
    passwordUpdated: string;
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
    changePasswordBtn: 'Alterar Senha',
    setPasswordBtn: 'Definir / Alterar Senha',
    currentPasswordLabel: 'Senha Atual',
    newPasswordLabel: 'Nova Senha (mín. 6 caracteres)',
    confirmNewPasswordLabel: 'Confirmar Nova Senha',
    passwordMismatch: 'As senhas não conferem.',
    savePasswordBtn: 'Salvar Senha',
    passwordUpdated: 'Senha salva com sucesso! Agora você também pode entrar usando seu e-mail e essa senha.',
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
    changePasswordBtn: 'Change Password',
    setPasswordBtn: 'Set / Change Password',
    currentPasswordLabel: 'Current Password',
    newPasswordLabel: 'New Password (min. 6 chars)',
    confirmNewPasswordLabel: 'Confirm New Password',
    passwordMismatch: 'Passwords do not match.',
    savePasswordBtn: 'Save Password',
    passwordUpdated: 'Password saved! You can now also sign in with your email and this password.',
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
    changePasswordBtn: 'Cambiar Contraseña',
    setPasswordBtn: 'Definir / Cambiar Contraseña',
    currentPasswordLabel: 'Contraseña Actual',
    newPasswordLabel: 'Nueva Contraseña (mín. 6 caracteres)',
    confirmNewPasswordLabel: 'Confirmar Nueva Contraseña',
    passwordMismatch: 'Las contraseñas no coinciden.',
    savePasswordBtn: 'Guardar Contraseña',
    passwordUpdated: '¡Contraseña guardada! Ahora también puedes entrar con tu correo y esta contraseña.',
  },
};

export function ProfileModal({
  lang,
  authMode,
  firebaseUser,
  serverToken,
  profile,
  runs,
  onRefreshVerification,
  onResendVerification,
  onSignOut,
  onClose,
}: ProfileModalProps) {
  const c = PROFILE_COPY[lang];
  const [linkErr, setLinkErr] = useState('');
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPwdChars, setShowPwdChars] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  const isAnonymous =
    authMode === 'firebase' ? Boolean(firebaseUser?.isAnonymous) : !profile?.email;
  const email = profile?.email || firebaseUser?.email || '';
  const emailVerified =
    authMode === 'server' ? true : Boolean(firebaseUser?.emailVerified);
  const displayName =
    profile?.displayName ||
    firebaseUser?.displayName ||
    (isAnonymous ? c.anonName : 'Explorador');
  const cartouche =
    profile?.cartoucheName || (isAnonymous ? 'VIAJANTE' : displayName.slice(0, 18));
  const isAdmin = profile?.role === 'admin' || isBootstrappedAdminEmail(email);
  const canManagePassword =
    !isAnonymous &&
    ((authMode === 'server' && Boolean(serverToken)) ||
      (authMode === 'firebase' && Boolean(firebaseUser) && emailVerified));

  async function handleLinkGoogle() {
    if (!firebaseUser) return;
    setLinkErr('');
    try {
      await linkWithPopup(firebaseUser, googleProvider);
      await onRefreshVerification();
    } catch (err) {
      setLinkErr(err instanceof Error ? err.message : 'Erro ao vincular conta.');
    }
  }

  async function handlePasswordUpdate(e: FormEvent) {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (authMode === 'firebase') {
      if (!firebaseUser) return;
      if (newPassword !== confirmNewPassword) {
        setPwdError(c.passwordMismatch);
        return;
      }
      setPwdBusy(true);
      try {
        const idToken = await firebaseUser.getIdToken();
        await setPasswordWithFirebaseToken(idToken, {
          newPassword,
          displayName,
          cartoucheName: cartouche,
        });
        setNewPassword('');
        setConfirmNewPassword('');
        setPwdSuccess(c.passwordUpdated);
      } catch (err) {
        setPwdError(err instanceof Error ? err.message : 'Erro ao salvar senha.');
      } finally {
        setPwdBusy(false);
      }
      return;
    }

    if (!serverToken) return;
    setPwdBusy(true);
    try {
      await updateServerPassword(serverToken, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPwdSuccess(c.passwordUpdated);
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Erro ao atualizar senha.');
    } finally {
      setPwdBusy(false);
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
                {email || c.anonName} ·{' '}
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

          {authMode === 'firebase' && isAnonymous && firebaseUser && (
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

          {authMode === 'firebase' && !isAnonymous && !emailVerified && (
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

          {canManagePassword && showPwdForm && (
            <form
              onSubmit={handlePasswordUpdate}
              className="rounded-xl border border-amber-500/25 bg-[#191108] p-4 space-y-3"
            >
              <div className="grid sm:grid-cols-2 gap-3">
                {authMode === 'server' && (
                  <div>
                    <label className="block text-[11px] font-medium text-amber-200/80 mb-1">
                      {c.currentPasswordLabel}
                    </label>
                    <input
                      type={showPwdChars ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full rounded-lg border border-amber-500/30 bg-[#120C06] px-3 py-2 text-xs text-amber-50 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-medium text-amber-200/80 mb-1">
                    {c.newPasswordLabel}
                  </label>
                  <div className="relative">
                    <input
                      type={showPwdChars ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-amber-500/30 bg-[#120C06] pl-3 pr-8 py-2 text-xs text-amber-50 focus:border-amber-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwdChars((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-300/60 hover:text-amber-200 cursor-pointer"
                      aria-label="Toggle password visibility"
                    >
                      {showPwdChars ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                {authMode === 'firebase' && (
                  <div>
                    <label className="block text-[11px] font-medium text-amber-200/80 mb-1">
                      {c.confirmNewPasswordLabel}
                    </label>
                    <input
                      type={showPwdChars ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-amber-500/30 bg-[#120C06] px-3 py-2 text-xs text-amber-50 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>
              {pwdError && <p className="text-xs text-red-300">{pwdError}</p>}
              {pwdSuccess && <p className="text-xs text-emerald-300">{pwdSuccess}</p>}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={pwdBusy}
                  className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-stone-950 hover:bg-amber-400 cursor-pointer disabled:opacity-50"
                >
                  {c.savePasswordBtn}
                </button>
              </div>
            </form>
          )}

          <div className="flex items-center justify-between pt-2 gap-3">
            {canManagePassword ? (
              <button
                type="button"
                onClick={() => {
                  setShowPwdForm((prev) => !prev);
                  setPwdError('');
                  setPwdSuccess('');
                }}
                className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-[#1B1208] px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/15 cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>{authMode === 'firebase' ? c.setPasswordBtn : c.changePasswordBtn}</span>
              </button>
            ) : (
              <div />
            )}

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
