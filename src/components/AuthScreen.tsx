import {
  AuthProvider,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { Eye, EyeOff, KeyRound, Lock, Mail, Sparkles, User } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  auth,
  githubProvider,
  googleProvider,
  isBootstrappedAdminEmail,
  microsoftProvider,
} from '../firebase';
import { Language, translateToHieroglyphs } from '../game/data';
import {
  getServerAuthConfig,
  loginAnonymousWithServer,
  loginWithServer,
  registerWithServer,
  ServerApiError,
  ServerAuthSession,
} from '../lib/serverAuth';

export const EMAIL_LINK_STORAGE_KEY = 'egito_magic_link_email';

interface AuthScreenProps {
  lang: Language;
  onChangeLang: (lang: Language) => void;
  onContinueAsGuest: () => void;
  onAuthenticated: (preferredCartouche?: string) => void;
  onServerAuthenticated: (session: ServerAuthSession) => void;
}

const AUTH_COPY: Record<
  Language,
  {
    subtitle: string;
    title: string;
    tabLogin: string;
    tabSignup: string;
    tabMagic: string;
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
    magicButton: string;
    magicHint: string;
    magicSent: string;
    forgotPassword: string;
    anonButton: string;
    guestButton: string;
    orDivider: string;
    resetSent: string;
    errEmailRequiredForReset: string;
    errPasswordMismatch: string;
    errPasswordLength: string;
    errEmailInUse: string;
    errInvalidCreds: string;
    errAccountExistsDiffCred: string;
    errOperationNotAllowed: string;
    errPopupClosed: string;
    errGeneric: string;
    adminPasscodeLabel: string;
    adminPasscodePlaceholder: string;
    resetUnavailableLocal: string;
  }
> = {
  pt: {
    subtitle: 'Portal do Templo',
    title: 'O Império do Egito',
    tabLogin: 'Entrar',
    tabSignup: 'Criar Conta',
    tabMagic: 'Link Mágico',
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
    magicButton: 'Enviar Link de Acesso',
    magicHint: 'Receba um link único no seu e-mail para entrar ou criar conta sem senha.',
    magicSent: 'Link de acesso enviado! Abra o link no seu e-mail para entrar automaticamente.',
    forgotPassword: 'Esqueci a senha',
    anonButton: 'Entrar como Anônimo',
    guestButton: 'Continuar sem conta',
    orDivider: 'ou use seu e-mail',
    resetSent: 'Enviamos um link de redefinição de senha para o seu e-mail.',
    errEmailRequiredForReset: 'Informe seu e-mail acima para redefinir a senha.',
    errPasswordMismatch: 'As senhas informadas não conferem.',
    errPasswordLength: 'A senha deve ter pelo menos 6 caracteres.',
    errEmailInUse: 'Este e-mail já está cadastrado. Tente entrar na aba Entrar.',
    errInvalidCreds: 'E-mail ou senha inválidos.',
    errAccountExistsDiffCred:
      'Já existe uma conta com este e-mail usando outro método (ex: Google). Entre com esse provedor.',
    errOperationNotAllowed:
      'Este provedor externo ainda não está ativado no Console do Firebase. Use E-mail e Senha ou Google.',
    errPopupClosed: 'A janela de autenticação foi fechada antes de concluir.',
    errGeneric: 'Não foi possível concluir a autenticação. Tente novamente.',
    adminPasscodeLabel: 'Código Administrativo',
    adminPasscodePlaceholder: 'Código de fundador',
    resetUnavailableLocal:
      'Para contas criadas por e-mail e senha no templo, altere sua senha após entrar no Perfil do Explorador.',
  },
  en: {
    subtitle: 'Temple Gateway',
    title: 'Empire of Egypt',
    tabLogin: 'Sign In',
    tabSignup: 'Create Account',
    tabMagic: 'Magic Link',
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
    magicButton: 'Send Sign-In Link',
    magicHint: 'Receive a one-time email link to sign in or register without a password.',
    magicSent: 'Sign-in link sent! Open the link in your email to enter automatically.',
    forgotPassword: 'Forgot password',
    anonButton: 'Anonymous Sign-In',
    guestButton: 'Continue as guest',
    orDivider: 'or use email',
    resetSent: 'Password reset link sent to your email.',
    errEmailRequiredForReset: 'Enter your email above to reset your password.',
    errPasswordMismatch: 'Passwords do not match.',
    errPasswordLength: 'Password must be at least 6 characters.',
    errEmailInUse: 'This email is already registered. Try signing in.',
    errInvalidCreds: 'Invalid email or password.',
    errAccountExistsDiffCred:
      'An account already exists with this email using another provider (e.g. Google).',
    errOperationNotAllowed:
      'This external provider is not enabled yet in Firebase Console. Use Email & Password or Google.',
    errPopupClosed: 'Sign-in popup was closed before completing.',
    errGeneric: 'Authentication failed. Please try again.',
    adminPasscodeLabel: 'Admin Passcode',
    adminPasscodePlaceholder: 'Founder passcode',
    resetUnavailableLocal:
      'For temple Email & Password accounts, you can update your password inside Explorer Profile after signing in.',
  },
  es: {
    subtitle: 'Portal del Templo',
    title: 'El Imperio de Egipto',
    tabLogin: 'Iniciar Sesión',
    tabSignup: 'Crear Cuenta',
    tabMagic: 'Enlace Mágico',
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
    magicButton: 'Enviar Enlace de Acceso',
    magicHint: 'Recibe un enlace único en tu correo para entrar o registrarte sin contraseña.',
    magicSent: '¡Enlace enviado! Abre el enlace en tu correo para entrar automáticamente.',
    forgotPassword: 'Olvidé mi contraseña',
    anonButton: 'Acceso Anónimo',
    guestButton: 'Continuar sin cuenta',
    orDivider: 'o usa tu correo',
    resetSent: 'Enviamos un enlace de recuperación a tu correo.',
    errEmailRequiredForReset: 'Ingresa tu correo arriba para restablecer la contraseña.',
    errPasswordMismatch: 'Las contraseñas no coinciden.',
    errPasswordLength: 'La contraseña debe tener al menos 6 caracteres.',
    errEmailInUse: 'Este correo ya está registrado. Intenta iniciar sesión.',
    errInvalidCreds: 'Correo o contraseña inválidos.',
    errAccountExistsDiffCred:
      'Ya existe una cuenta con este correo usando otro proveedor (ej. Google).',
    errOperationNotAllowed:
      'Este proveedor externo aún no está habilitado en Firebase Console. Usa Correo y Contraseña o Google.',
    errPopupClosed: 'Se cerró la ventana de autenticación antes de completar.',
    errGeneric: 'No se pudo completar la autenticación. Inténtalo de nuevo.',
    adminPasscodeLabel: 'Código Administrativo',
    adminPasscodePlaceholder: 'Código de fundador',
    resetUnavailableLocal:
      'Para cuentas de correo y contraseña del templo, cambia tu contraseña en el Perfil del Explorador al iniciar sesión.',
  },
};

export function AuthScreen({
  lang,
  onChangeLang,
  onContinueAsGuest,
  onAuthenticated,
  onServerAuthenticated,
}: AuthScreenProps) {
  const c = AUTH_COPY[lang];
  const [tab, setTab] = useState<'login' | 'signup' | 'magic'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminPasscodeRequired, setAdminPasscodeRequired] = useState(false);
  const [forceShowPasscode, setForceShowPasscode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  useEffect(() => {
    getServerAuthConfig()
      .then((cfg) => setAdminPasscodeRequired(cfg.adminPasscodeRequired))
      .catch(() => {
        // Ignore if config check fails silently
      });
  }, []);

  const showAdminPasscodeInput =
    tab === 'signup' &&
    (forceShowPasscode || (adminPasscodeRequired && isBootstrappedAdminEmail(email)));

  const cartouchePreview = useMemo(
    () => translateToHieroglyphs((name || 'FARAÓ').slice(0, 18)),
    [name]
  );

  function mapAuthError(err: unknown): string {
    if (err instanceof ServerApiError) {
      if (err.code === 'EMAIL_IN_USE') return c.errEmailInUse;
      if (err.code === 'INVALID_CREDENTIALS') return c.errInvalidCreds;
      if (err.code === 'INVALID_PASSWORD') return c.errPasswordLength;
      return err.message;
    }
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
    if (code === 'auth/account-exists-with-different-credential') {
      return c.errAccountExistsDiffCred;
    }
    if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
      return c.errOperationNotAllowed;
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return c.errPopupClosed;
    }
    return c.errGeneric;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (tab === 'magic') {
      setLoading(true);
      try {
        const cleanEmail = email.trim();
        await sendSignInLinkToEmail(auth, cleanEmail, {
          url: window.location.origin + window.location.pathname,
          handleCodeInApp: true,
        });
        window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, cleanEmail);
        setInfoMsg(c.magicSent);
      } catch (err) {
        setErrorMsg(mapAuthError(err));
      } finally {
        setLoading(false);
      }
      return;
    }

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
      const cleanEmail = email.trim();
      if (tab === 'login') {
        try {
          const session = await loginWithServer({
            email: cleanEmail,
            password,
          });
          onServerAuthenticated(session);
          return;
        } catch (srvErr) {
          if (srvErr instanceof ServerApiError && srvErr.code === 'INVALID_CREDENTIALS') {
            try {
              await signInWithEmailAndPassword(auth, cleanEmail, password);
              onAuthenticated();
              return;
            } catch {
              throw srvErr;
            }
          }
          throw srvErr;
        }
      } else {
        const cleanName = name.trim().slice(0, 60) || 'Explorador';
        const cleanCartouche = cleanName.slice(0, 18).toUpperCase();
        const session = await registerWithServer({
          email: cleanEmail,
          password,
          displayName: cleanName,
          cartoucheName: cleanCartouche,
          adminPasscode: adminPasscode.trim() || undefined,
        });
        onServerAuthenticated(session);
      }
    } catch (err) {
      if (err instanceof ServerApiError && err.code === 'ADMIN_PASSCODE_REQUIRED') {
        setForceShowPasscode(true);
      }
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleProviderPopup(provider: AuthProvider) {
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      await signInWithPopup(auth, provider);
      onAuthenticated();
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleAnonymousLogin() {
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      await signInAnonymously(auth);
      onAuthenticated('VIAJANTE');
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
        try {
          const session = await loginAnonymousWithServer();
          onServerAuthenticated(session);
          return;
        } catch (srvErr) {
          setErrorMsg(mapAuthError(srvErr));
          return;
        }
      }
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
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
        setInfoMsg(c.resetUnavailableLocal);
      } else {
        setErrorMsg(mapAuthError(err));
      }
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

      {/* Auth Card */}
      <div className="my-auto w-full max-w-md mx-auto md:mx-0 md:ml-8 rounded-2xl border border-amber-500/35 bg-[#120C06]/95 p-6 sm:p-7 shadow-2xl">
        <p className="text-xs font-semibold tracking-[0.18em] text-amber-400 uppercase">
          {c.subtitle}
        </p>
        <h1 className="font-display mt-1 text-2xl sm:text-3xl font-bold text-amber-100">
          {c.title}
        </h1>

        {/* OAuth Providers Row: Google, GitHub, Microsoft */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleProviderPopup(googleProvider)}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-[#1D1409] hover:bg-amber-500/15 py-2.5 px-3 text-xs font-semibold text-amber-100 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#FBBF24"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
              />
            </svg>
            <span>Google</span>
          </button>

          <button
            type="button"
            onClick={() => handleProviderPopup(githubProvider)}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-[#1D1409] hover:bg-amber-500/15 py-2.5 px-3 text-xs font-semibold text-amber-100 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
              />
            </svg>
            <span>GitHub</span>
          </button>

          <button
            type="button"
            onClick={() => handleProviderPopup(microsoftProvider)}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-[#1D1409] hover:bg-amber-500/15 py-2.5 px-3 text-xs font-semibold text-amber-100 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 22 22" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" fill="#F59E0B" />
              <rect x="12" y="1" width="9" height="9" fill="#FCD34D" />
              <rect x="1" y="12" width="9" height="9" fill="#D97706" />
              <rect x="12" y="12" width="9" height="9" fill="#FBBF24" />
            </svg>
            <span>Microsoft</span>
          </button>
        </div>

        <div className="my-4 flex items-center gap-3 text-xs text-amber-300/60">
          <div className="h-px flex-1 bg-amber-500/20" />
          <span>{c.orDivider}</span>
          <div className="h-px flex-1 bg-amber-500/20" />
        </div>

        {/* Segmented Tabs: Entrar | Criar Conta | Link Mágico */}
        <div
          className="grid grid-cols-3 gap-1 rounded-xl border border-amber-500/25 bg-[#1A1107] p-1"
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
            className={`py-2 px-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
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
            className={`py-2 px-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'signup'
                ? 'bg-amber-500 text-stone-950'
                : 'text-amber-200/80 hover:text-amber-100'
            }`}
          >
            {c.tabSignup}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'magic'}
            onClick={() => {
              setTab('magic');
              setErrorMsg('');
              setInfoMsg('');
            }}
            className={`py-2 px-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'magic'
                ? 'bg-amber-500 text-stone-950'
                : 'text-amber-200/80 hover:text-amber-100'
            }`}
          >
            {c.tabMagic}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
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

          {tab === 'magic' && (
            <p className="text-xs text-amber-200/75 leading-relaxed flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{c.magicHint}</span>
            </p>
          )}

          {tab !== 'magic' && (
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
          )}

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

          {showAdminPasscodeInput && (
            <div>
              <label
                htmlFor="auth-admin-passcode"
                className="block text-xs font-medium text-amber-300 mb-1"
              >
                {c.adminPasscodeLabel}
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400/70" />
                <input
                  id="auth-admin-passcode"
                  type="password"
                  required
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                  placeholder={c.adminPasscodePlaceholder}
                  className="w-full rounded-xl border border-amber-500/40 bg-[#1B1208] pl-9 pr-3.5 py-2.5 text-sm text-amber-50 placeholder:text-amber-200/35 focus:border-amber-400 focus:outline-none"
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
            {tab === 'login'
              ? c.loginButton
              : tab === 'signup'
                ? c.signupButton
                : c.magicButton}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-center gap-3 text-xs">
          <button
            type="button"
            onClick={handleAnonymousLogin}
            disabled={loading}
            className="font-medium text-amber-300/80 hover:text-amber-100 underline underline-offset-4 cursor-pointer disabled:opacity-50"
          >
            {c.anonButton}
          </button>
          <span className="text-amber-500/40" aria-hidden="true">
            ·
          </span>
          <button
            type="button"
            onClick={onContinueAsGuest}
            className="font-medium text-amber-300/80 hover:text-amber-100 underline underline-offset-4 cursor-pointer"
          >
            {c.guestButton}
          </button>
        </div>
      </div>

      <div />
    </div>
  );
}
