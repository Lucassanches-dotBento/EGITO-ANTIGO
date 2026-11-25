import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Language, translateToHieroglyphs } from '../game/data';
import { auth, googleProvider } from '../firebase';

interface AuthScreenProps {
  lang: Language;
  onChangeLang: (lang: Language) => void;
  onContinueAsGuest: () => void;
  onAuthenticated: (preferredCartouche?: string) => void;
}

const AUTH_COPY: Record<
  Language,
  {
    subtitle: string;
    title: string;
    tabLogin: string;
    tabSignup: string;
    nameLabel: string;
    namePlaceholder: string;
    cartoucheLabel: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    confirmPasswordLabel: string;
    loginButton: string;
    signupButton: string;
    googleButton: string;
    forgotPassword: string;
    guestButton: string;
    orDivider: string;
    resetSent: string;
    errEmailRequiredForReset: string;
    errPasswordMismatch: string;
    errPasswordLength: string;
    errEmailInUse: string;
    errInvalidCreds: string;
    errOperationNotAllowed: string;
    errPopupClosed: string;
    errGeneric: string;
  }
> = {
  pt: {
    subtitle: 'Portal do Templo',
    title: 'O Império do Egito',
    tabLogin: 'Entrar',
    tabSignup: 'Criar Conta',
    nameLabel: 'Nome do Explorador',
    namePlaceholder: 'Ex: Cleópatra',
    cartoucheLabel: 'Cartucho Real',
    emailLabel: 'E-mail',
    emailPlaceholder: 'seu@email.com',
    passwordLabel: 'Senha',
    passwordPlaceholder: 'Mínimo de 6 caracteres',
    confirmPasswordLabel: 'Confirmar Senha',
    loginButton: 'Entrar no Templo',
    signupButton: 'Criar Conta e Entrar',
    googleButton: 'Continuar com Google',
    forgotPassword: 'Esqueci a senha',
    guestButton: 'Continuar sem conta',
    orDivider: 'ou',
    resetSent: 'Enviamos um link de redefinição de senha para o seu e-mail.',
    errEmailRequiredForReset: 'Informe seu e-mail acima para redefinir a senha.',
    errPasswordMismatch: 'As senhas informadas não conferem.',
    errPasswordLength: 'A senha deve ter pelo menos 6 caracteres.',
    errEmailInUse: 'Este e-mail já está cadastrado. Tente entrar na aba Entrar.',
    errInvalidCreds: 'E-mail ou senha inválidos.',
    errOperationNotAllowed:
      'Login por e-mail/senha ainda não ativado no Console do Firebase (Authentication > Sign-in method). Use "Continuar com Google" ou ative o provedor no console.',
    errPopupClosed: 'A janela de login com Google foi fechada antes de concluir.',
    errGeneric: 'Não foi possível concluir a autenticação. Tente novamente.',
  },
  en: {
    subtitle: 'Temple Gateway',
    title: 'Empire of Egypt',
    tabLogin: 'Sign In',
    tabSignup: 'Create Account',
    nameLabel: 'Explorer Name',
    namePlaceholder: 'e.g. Cleopatra',
    cartoucheLabel: 'Royal Cartouche',
    emailLabel: 'Email',
    emailPlaceholder: 'you@email.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'At least 6 characters',
    confirmPasswordLabel: 'Confirm Password',
    loginButton: 'Enter the Temple',
    signupButton: 'Create Account',
    googleButton: 'Continue with Google',
    forgotPassword: 'Forgot password',
    guestButton: 'Continue as guest',
    orDivider: 'or',
    resetSent: 'Password reset link sent to your email.',
    errEmailRequiredForReset: 'Enter your email above to reset your password.',
    errPasswordMismatch: 'Passwords do not match.',
    errPasswordLength: 'Password must be at least 6 characters.',
    errEmailInUse: 'This email is already registered. Try signing in.',
    errInvalidCreds: 'Invalid email or password.',
    errOperationNotAllowed:
      'Email/Password sign-in is not yet enabled in Firebase Console (Authentication > Sign-in method). Use "Continue with Google" or enable it in the console.',
    errPopupClosed: 'Google sign-in popup was closed before completing.',
    errGeneric: 'Authentication failed. Please try again.',
  },
  es: {
    subtitle: 'Portal del Templo',
    title: 'El Imperio de Egipto',
    tabLogin: 'Iniciar Sesión',
    tabSignup: 'Crear Cuenta',
    nameLabel: 'Nombre del Explorador',
    namePlaceholder: 'Ej: Cleopatra',
    cartoucheLabel: 'Cartucho Real',
    emailLabel: 'Correo electrónico',
    emailPlaceholder: 'tu@correo.com',
    passwordLabel: 'Contraseña',
    passwordPlaceholder: 'Mínimo 6 caracteres',
    confirmPasswordLabel: 'Confirmar Contraseña',
    loginButton: 'Entrar al Templo',
    signupButton: 'Crear Cuenta',
    googleButton: 'Continuar con Google',
    forgotPassword: 'Olvidé mi contraseña',
    guestButton: 'Continuar sin cuenta',
    orDivider: 'o',
    resetSent: 'Enviamos un enlace de recuperación a tu correo.',
    errEmailRequiredForReset: 'Ingresa tu correo arriba para restablecer la contraseña.',
    errPasswordMismatch: 'Las contraseñas no coinciden.',
    errPasswordLength: 'La contraseña debe tener al menos 6 caracteres.',
    errEmailInUse: 'Este correo ya está registrado. Intenta iniciar sesión.',
    errInvalidCreds: 'Correo o contraseña inválidos.',
    errOperationNotAllowed:
      'El acceso por correo/contraseña aún no está habilitado en Firebase Console (Authentication > Sign-in method). Usa "Continuar con Google" o actívalo en la consola.',
    errPopupClosed: 'Se cerró la ventana de Google antes de completar.',
    errGeneric: 'No se pudo completar la autenticación. Inténtalo de nuevo.',
  },
};

export function AuthScreen({
  lang,
  onChangeLang,
  onContinueAsGuest,
  onAuthenticated,
}: AuthScreenProps) {
  const c = AUTH_COPY[lang];
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const cartouchePreview = useMemo(
    () => translateToHieroglyphs((name || 'FARAÓ').slice(0, 18)),
    [name]
  );

  function mapAuthError(err: unknown): string {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/email-already-in-use') return c.errEmailInUse;
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-email'
    ) {
      return c.errInvalidCreds;
    }
    if (code === 'auth/operation-not-allowed') return c.errOperationNotAllowed;
    if (code === 'auth/popup-closed-by-user') return c.errPopupClosed;
    return c.errGeneric;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (tab === 'signup') {
      if (password.length < 6) {
        setErrorMsg(c.errPasswordLength);
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg(c.errPasswordMismatch);
        return;
      }
    }

    setLoading(true);
    try {
      if (tab === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        onAuthenticated();
      } else {
        const cleanName = name.trim().slice(0, 60) || 'Explorador';
        const cleanCartouche = cleanName.slice(0, 18).toUpperCase();
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: cleanName });
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // Non-fatal if verification email rate-limited
        }
        onAuthenticated(cleanCartouche);
      }
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onAuthenticated();
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setErrorMsg('');
    setInfoMsg('');
    if (!email.trim()) {
      setErrorMsg(c.errEmailRequiredForReset);
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfoMsg(c.resetSent);
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-between p-4 sm:p-8 overflow-y-auto">
      {/* Top Language Switcher */}
      <div className="flex justify-end">
        <div className="flex items-center rounded-lg border border-amber-500/30 bg-[#120C06]/95 p-1">
          {(['pt', 'en', 'es'] as Language[]).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => onChangeLang(code)}
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
      </div>

      {/* Auth Card centered-left to preserve pyramid horizon vista */}
      <div className="my-auto w-full max-w-md mx-auto md:mx-0 md:ml-8 rounded-2xl border border-amber-500/35 bg-[#120C06]/95 p-6 sm:p-7 shadow-2xl">
        <p className="text-xs font-semibold tracking-[0.18em] text-amber-400 uppercase">
          {c.subtitle}
        </p>
        <h1 className="font-display mt-1 text-2xl sm:text-3xl font-bold text-amber-100">
          {c.title}
        </h1>

        {/* Segmented Tabs: Entrar | Criar Conta */}
        <div
          className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-amber-500/25 bg-[#1A1107] p-1"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            onClick={() => {
              setTab('login');
              setErrorMsg('');
              setInfoMsg('');
            }}
            className={`py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
              tab === 'login'
                ? 'bg-amber-500 text-stone-950'
                : 'text-amber-200/80 hover:text-amber-100'
            }`}
          >
            {c.tabLogin}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'signup'}
            onClick={() => {
              setTab('signup');
              setErrorMsg('');
              setInfoMsg('');
            }}
            className={`py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
              tab === 'signup'
                ? 'bg-amber-500 text-stone-950'
                : 'text-amber-200/80 hover:text-amber-100'
            }`}
          >
            {c.tabSignup}
          </button>
        </div>

        {/* Google Auth Primary Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl border border-amber-400/40 bg-[#1D1409] hover:bg-amber-500/15 py-2.5 px-4 text-sm font-semibold text-amber-100 transition-colors cursor-pointer disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#FBBF24"
              d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
            />
          </svg>
          <span>{c.googleButton}</span>
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-amber-300/60">
          <div className="h-px flex-1 bg-amber-500/20" />
          <span>{c.orDivider}</span>
          <div className="h-px flex-1 bg-amber-500/20" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {tab === 'signup' && (
            <div>
              <label htmlFor="auth-name" className="block text-xs font-medium text-amber-200/90 mb-1">
                {c.nameLabel}
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400/70" />
                <input
                  id="auth-name"
                  type="text"
                  required
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={c.namePlaceholder}
                  className="w-full rounded-xl border border-amber-500/30 bg-[#1B1208] pl-9 pr-3.5 py-2.5 text-sm text-amber-50 placeholder:text-amber-200/35 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div className="mt-2 flex items-center justify-between rounded-lg border border-amber-500/20 bg-[#0D0803] px-3 py-1.5">
                <span className="text-[11px] text-amber-400/80">{c.cartoucheLabel}</span>
                <span className="text-lg text-amber-200 tracking-widest truncate ml-2">
                  {cartouchePreview}
                </span>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-amber-200/90 mb-1">
              {c.emailLabel}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400/70" />
              <input
                id="auth-email"
                type="email"
                required
                maxLength={160}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={c.emailPlaceholder}
                className="w-full rounded-xl border border-amber-500/30 bg-[#1B1208] pl-9 pr-3.5 py-2.5 text-sm text-amber-50 placeholder:text-amber-200/35 focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="auth-password" className="block text-xs font-medium text-amber-200/90">
                {c.passwordLabel}
              </label>
              {tab === 'login' && (
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer"
                >
                  {c.forgotPassword}
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400/70" />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={c.passwordPlaceholder}
                className="w-full rounded-xl border border-amber-500/30 bg-[#1B1208] pl-9 pr-10 py-2.5 text-sm text-amber-50 placeholder:text-amber-200/35 focus:border-amber-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-300/60 hover:text-amber-200 cursor-pointer"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {tab === 'signup' && (
            <div>
              <label
                htmlFor="auth-confirm"
                className="block text-xs font-medium text-amber-200/90 mb-1"
              >
                {c.confirmPasswordLabel}
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400/70" />
                <input
                  id="auth-confirm"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={c.passwordPlaceholder}
                  className="w-full rounded-xl border border-amber-500/30 bg-[#1B1208] pl-9 pr-3.5 py-2.5 text-sm text-amber-50 placeholder:text-amber-200/35 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/40 bg-red-950/60 px-3.5 py-2.5 text-xs text-red-200 leading-relaxed"
            >
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-3.5 py-2.5 text-xs text-emerald-200 leading-relaxed">
              {infoMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-3 px-5 text-sm font-bold text-stone-950 transition-colors cursor-pointer disabled:opacity-50"
          >
            {tab === 'login' ? c.loginButton : c.signupButton}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onContinueAsGuest}
            className="text-xs font-medium text-amber-300/75 hover:text-amber-100 underline underline-offset-4 cursor-pointer"
          >
            {c.guestButton}
          </button>
        </div>
      </div>

      <div />
    </div>
  );
}
