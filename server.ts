import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

type UserRole = 'admin' | 'player';

interface StoredRun {
  id: string;
  uid: string;
  cartoucheName: string;
  score: number;
  chambersCleared: number;
  combos: number;
  relicCount: number;
  victory: boolean;
  createdAtMs: number;
}

interface StoredAccount {
  uid: string;
  email: string;
  displayName: string;
  cartoucheName: string;
  role: UserRole;
  isAnonymous: boolean;
  salt: string;
  passwordHash: string;
  bestScore: number;
  chambersClearedMax: number;
  gamesPlayed: number;
  createdAtMs: number;
  updatedAtMs: number;
  runs: StoredRun[];
}

export interface PublicAccount {
  uid: string;
  email: string;
  displayName: string;
  cartoucheName: string;
  role: UserRole;
  isAnonymous: boolean;
  bestScore: number;
  chambersClearedMax: number;
  gamesPlayed: number;
  createdAtMs: number;
  updatedAtMs: number;
}

interface PersistedStore {
  accounts: StoredAccount[];
}

interface TokenPayload {
  uid: string;
  iat: number;
  exp: number;
}

interface AuthedRequest extends Request {
  authAccount?: StoredAccount;
}

const PORT = Number(process.env.PORT) || 3000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const FOUNDING_ADMIN_EMAILS = new Set([
  '20261ac0080020@estudantes.ifpr.edu.br',
  '20261ac0080019@estudantes.ifpr.edu.br',
  '20261ac0080070@estudantes.ifpr.edu.br',
  '20261ac0080030@estudantes.ifpr.edu.br',
]);

const DATA_DIR = path.resolve(process.cwd(), '.data');
const ACCOUNTS_FILE = path.resolve(DATA_DIR, 'accounts.json');

function resolveConfinedPath(targetPath: string, baseDir: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error('Invalid storage path');
  }
  return resolvedTarget;
}

// Ephemeral in-memory fallback guarantees tokens remain unforgeable when no env secret is set.
const SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET && process.env.AUTH_SESSION_SECRET.length >= 16
    ? process.env.AUTH_SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

const accountsByUid = new Map<string, StoredAccount>();
const uidByEmail = new Map<string, string>();

function getFirebaseAdminAuth() {
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(cfgPath)) return null;
  const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { projectId?: string };
  const projectId = parsed?.projectId?.trim();
  if (!projectId || projectId === 'remixed-project-id') return null;
  const firebaseAdminApp = getApps().length ? getApp() : initializeApp({ projectId });
  return getAdminAuth(firebaseAdminApp);
}

function isFounderEmail(email: string): boolean {
  return FOUNDING_ADMIN_EMAILS.has(email.trim().toLowerCase());
}

function normalizeEmail(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().slice(0, 160);
}

function isValidEmail(email: string): boolean {
  if (!email || email.length > 160) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeDisplayName(raw: unknown): string {
  if (typeof raw !== 'string') return 'Explorador';
  const cleaned = raw.trim().slice(0, 60);
  return cleaned || 'Explorador';
}

function sanitizeCartoucheName(raw: unknown): string {
  if (typeof raw !== 'string') return 'FARAÓ';
  const cleaned = raw.trim().slice(0, 18).toUpperCase();
  return cleaned || 'FARAÓ';
}

function hashPassword(password: string, saltHex: string): string {
  return crypto.scryptSync(password, saltHex, 64).toString('hex');
}

function verifyPassword(password: string, saltHex: string, expectedHashHex: string): boolean {
  if (!saltHex || !expectedHashHex) return false;
  const derived = crypto.scryptSync(password, saltHex, 64);
  const expected = Buffer.from(expectedHashHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function constantTimeEquals(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function signSessionToken(uid: string): string {
  const now = Date.now();
  const payload: TokenPayload = {
    uid,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sigB64 = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sigB64}`;
}

function verifySessionToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sigB64, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed || typeof parsed.uid !== 'string' || typeof parsed.exp !== 'number') {
      return null;
    }
    if (parsed.exp <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function toPublicAccount(account: StoredAccount): PublicAccount {
  return {
    uid: account.uid,
    email: account.email,
    displayName: account.displayName,
    cartoucheName: account.cartoucheName,
    role: isFounderEmail(account.email) ? 'admin' : account.role,
    isAnonymous: account.isAnonymous,
    bestScore: account.bestScore,
    chambersClearedMax: account.chambersClearedMax,
    gamesPlayed: account.gamesPlayed,
    createdAtMs: account.createdAtMs,
    updatedAtMs: account.updatedAtMs,
  };
}

function loadStoreFromDisk(): void {
  try {
    const targetFile = resolveConfinedPath(ACCOUNTS_FILE, DATA_DIR);
    if (!fs.existsSync(targetFile)) return;
    const raw = fs.readFileSync(targetFile, 'utf8');
    const parsed = JSON.parse(raw) as PersistedStore;
    if (!parsed || !Array.isArray(parsed.accounts)) return;

    for (const acc of parsed.accounts) {
      if (!acc || typeof acc.uid !== 'string') continue;
      const role: UserRole = isFounderEmail(acc.email || '')
        ? 'admin'
        : acc.role === 'admin'
          ? 'admin'
          : 'player';
      const normalized: StoredAccount = {
        uid: acc.uid,
        email: typeof acc.email === 'string' ? acc.email : '',
        displayName: sanitizeDisplayName(acc.displayName),
        cartoucheName: sanitizeCartoucheName(acc.cartoucheName),
        role,
        isAnonymous: Boolean(acc.isAnonymous),
        salt: typeof acc.salt === 'string' ? acc.salt : '',
        passwordHash: typeof acc.passwordHash === 'string' ? acc.passwordHash : '',
        bestScore: Number.isFinite(acc.bestScore) ? Math.max(0, Math.floor(acc.bestScore)) : 0,
        chambersClearedMax: Number.isFinite(acc.chambersClearedMax)
          ? Math.max(0, Math.min(5, Math.floor(acc.chambersClearedMax)))
          : 0,
        gamesPlayed: Number.isFinite(acc.gamesPlayed) ? Math.max(0, Math.floor(acc.gamesPlayed)) : 0,
        createdAtMs: Number.isFinite(acc.createdAtMs) ? acc.createdAtMs : Date.now(),
        updatedAtMs: Number.isFinite(acc.updatedAtMs) ? acc.updatedAtMs : Date.now(),
        runs: Array.isArray(acc.runs) ? acc.runs.slice(0, 25) : [],
      };
      accountsByUid.set(normalized.uid, normalized);
      if (normalized.email) {
        uidByEmail.set(normalized.email.toLowerCase(), normalized.uid);
      }
    }
  } catch (err) {
    console.error('Failed to load local accounts store:', err);
  }
}

function saveStoreToDisk(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const targetFile = resolveConfinedPath(ACCOUNTS_FILE, DATA_DIR);
    const tmpFile = resolveConfinedPath(path.resolve(DATA_DIR, 'accounts.json.tmp'), DATA_DIR);
    const payload: PersistedStore = {
      accounts: Array.from(accountsByUid.values()),
    };
    fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmpFile, targetFile);
  } catch (err) {
    console.error('Failed to save local accounts store:', err);
  }
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sessão ausente ou expirada.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    return;
  }
  const account = accountsByUid.get(payload.uid);
  if (!account) {
    res.status(401).json({ error: 'Conta não encontrada.' });
    return;
  }
  req.authAccount = account;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const account = req.authAccount;
  if (!account || (account.role !== 'admin' && !isFounderEmail(account.email))) {
    res.status(403).json({ error: 'Acesso restrito a administradores.' });
    return;
  }
  next();
}

async function startServer(): Promise<void> {
  loadStoreFromDisk();

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/auth/config', (_req, res) => {
    const requiredPasscode = process.env.ADMIN_PASSCODE?.trim() || '';
    res.json({
      adminPasscodeRequired: requiredPasscode.length > 0,
    });
  });

  app.post('/api/auth/register', (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const displayName = sanitizeDisplayName(req.body?.displayName);
    const cartoucheName = sanitizeCartoucheName(req.body?.cartoucheName || displayName);
    const adminPasscode = typeof req.body?.adminPasscode === 'string' ? req.body.adminPasscode : '';

    if (!isValidEmail(email)) {
      res.status(400).json({ code: 'INVALID_EMAIL', error: 'Informe um e-mail válido.' });
      return;
    }
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({
        code: 'INVALID_PASSWORD',
        error: 'A senha deve ter entre 6 e 128 caracteres.',
      });
      return;
    }

    if (uidByEmail.has(email)) {
      res.status(409).json({
        code: 'EMAIL_IN_USE',
        error: 'Este e-mail já está cadastrado. Use a aba Entrar.',
      });
      return;
    }

    const founder = isFounderEmail(email);
    const configuredPasscode = process.env.ADMIN_PASSCODE?.trim() || '';
    if (founder && configuredPasscode.length > 0) {
      if (!adminPasscode || !constantTimeEquals(adminPasscode.trim(), configuredPasscode)) {
        res.status(403).json({
          code: 'ADMIN_PASSCODE_REQUIRED',
          error: 'Informe o código administrativo válido para registrar este e-mail.',
        });
        return;
      }
    }

    const now = Date.now();
    const uid = `srv_${crypto.randomUUID()}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    const account: StoredAccount = {
      uid,
      email,
      displayName,
      cartoucheName,
      role: founder ? 'admin' : 'player',
      isAnonymous: false,
      salt,
      passwordHash,
      bestScore: 0,
      chambersClearedMax: 0,
      gamesPlayed: 0,
      createdAtMs: now,
      updatedAtMs: now,
      runs: [],
    };

    accountsByUid.set(uid, account);
    uidByEmail.set(email, uid);
    saveStoreToDisk();

    const token = signSessionToken(uid);
    res.status(201).json({
      token,
      user: toPublicAccount(account),
      runs: [],
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email) || password.length < 1 || password.length > 128) {
      res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'E-mail ou senha inválidos.' });
      return;
    }

    const uid = uidByEmail.get(email);
    const account = uid ? accountsByUid.get(uid) : undefined;
    if (!account || account.isAnonymous || !verifyPassword(password, account.salt, account.passwordHash)) {
      res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'E-mail ou senha inválidos.' });
      return;
    }

    if (isFounderEmail(account.email) && account.role !== 'admin') {
      account.role = 'admin';
      account.updatedAtMs = Date.now();
      saveStoreToDisk();
    }

    const token = signSessionToken(account.uid);
    res.json({
      token,
      user: toPublicAccount(account),
      runs: account.runs.slice(0, 10),
    });
  });

  app.post('/api/auth/anonymous', (_req, res) => {
    const now = Date.now();
    const uid = `anon_${crypto.randomUUID()}`;
    const account: StoredAccount = {
      uid,
      email: '',
      displayName: 'Viajante Anônimo',
      cartoucheName: 'VIAJANTE',
      role: 'player',
      isAnonymous: true,
      salt: '',
      passwordHash: '',
      bestScore: 0,
      chambersClearedMax: 0,
      gamesPlayed: 0,
      createdAtMs: now,
      updatedAtMs: now,
      runs: [],
    };

    accountsByUid.set(uid, account);
    saveStoreToDisk();

    const token = signSessionToken(uid);
    res.status(201).json({
      token,
      user: toPublicAccount(account),
      runs: [],
    });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    const account = req.authAccount!;
    res.json({
      user: toPublicAccount(account),
      runs: account.runs.slice(0, 10),
    });
  });

  app.patch('/api/auth/cartouche', requireAuth, (req: AuthedRequest, res) => {
    const account = req.authAccount!;
    if (typeof req.body?.displayName === 'string') {
      account.displayName = sanitizeDisplayName(req.body.displayName);
    }
    if (typeof req.body?.cartoucheName === 'string') {
      account.cartoucheName = sanitizeCartoucheName(req.body.cartoucheName);
    }
    account.updatedAtMs = Date.now();
    saveStoreToDisk();
    res.json({ user: toPublicAccount(account) });
  });

  app.patch('/api/auth/password', requireAuth, (req: AuthedRequest, res) => {
    const account = req.authAccount!;
    if (account.isAnonymous) {
      res.status(400).json({ error: 'Contas anônimas não possuem senha.' });
      return;
    }
    const currentPassword =
      typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!verifyPassword(currentPassword, account.salt, account.passwordHash)) {
      res.status(401).json({ error: 'Senha atual incorreta.' });
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      res.status(400).json({ error: 'A nova senha deve ter entre 6 e 128 caracteres.' });
      return;
    }

    const nextSalt = crypto.randomBytes(16).toString('hex');
    account.salt = nextSalt;
    account.passwordHash = hashPassword(newPassword, nextSalt);
    account.updatedAtMs = Date.now();
    saveStoreToDisk();
    res.json({ ok: true });
  });

  app.post('/api/auth/firebase-set-password', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token Firebase ausente.' });
      return;
    }
    const idToken = authHeader.slice(7).trim();
    const adminAuth = getFirebaseAdminAuth();
    if (!adminAuth) {
      res.status(503).json({ error: 'Configuração do Firebase indisponível no servidor.' });
      return;
    }

    let decodedEmail = '';
    let decodedName = '';
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      if (decoded.email_verified !== true || typeof decoded.email !== 'string') {
        res.status(403).json({ error: 'E-mail não verificado na sessão atual.' });
        return;
      }
      decodedEmail = normalizeEmail(decoded.email);
      decodedName = typeof decoded.name === 'string' ? decoded.name : '';
    } catch {
      res.status(401).json({ error: 'Sessão Google expirada ou inválida. Entre novamente.' });
      return;
    }

    if (!isValidEmail(decodedEmail)) {
      res.status(400).json({ error: 'E-mail inválido na conta.' });
      return;
    }

    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (newPassword.length < 6 || newPassword.length > 128) {
      res.status(400).json({ error: 'A nova senha deve ter entre 6 e 128 caracteres.' });
      return;
    }

    const now = Date.now();
    const nextSalt = crypto.randomBytes(16).toString('hex');
    const nextHash = hashPassword(newPassword, nextSalt);
    const existingUid = uidByEmail.get(decodedEmail);
    const existingAccount = existingUid ? accountsByUid.get(existingUid) : undefined;

    if (existingAccount) {
      existingAccount.salt = nextSalt;
      existingAccount.passwordHash = nextHash;
      if (isFounderEmail(decodedEmail)) {
        existingAccount.role = 'admin';
      }
      existingAccount.updatedAtMs = now;
      saveStoreToDisk();
      res.json({ ok: true, email: decodedEmail });
      return;
    }

    const displayName = sanitizeDisplayName(req.body?.displayName || decodedName || 'Explorador');
    const cartoucheName = sanitizeCartoucheName(req.body?.cartoucheName || displayName);
    const uid = `srv_${crypto.randomUUID()}`;
    const newAccount: StoredAccount = {
      uid,
      email: decodedEmail,
      displayName,
      cartoucheName,
      role: isFounderEmail(decodedEmail) ? 'admin' : 'player',
      isAnonymous: false,
      salt: nextSalt,
      passwordHash: nextHash,
      bestScore: 0,
      chambersClearedMax: 0,
      gamesPlayed: 0,
      createdAtMs: now,
      updatedAtMs: now,
      runs: [],
    };
    accountsByUid.set(uid, newAccount);
    uidByEmail.set(decodedEmail, uid);
    saveStoreToDisk();
    res.json({ ok: true, email: decodedEmail });
  });

  app.post('/api/runs', requireAuth, (req: AuthedRequest, res) => {
    const account = req.authAccount!;
    const rawScore = Number(req.body?.score);
    const rawChambers = Number(req.body?.chambersCleared);
    const rawCombos = Number(req.body?.combos);
    const rawRelics = Number(req.body?.relicCount);
    const victory = Boolean(req.body?.victory);

    if (
      !Number.isFinite(rawScore) ||
      !Number.isFinite(rawChambers) ||
      !Number.isFinite(rawCombos) ||
      !Number.isFinite(rawRelics)
    ) {
      res.status(400).json({ error: 'Dados da expedição inválidos.' });
      return;
    }

    const safeScore = Math.max(0, Math.min(10_000_000, Math.floor(rawScore)));
    const safeChambers = Math.max(0, Math.min(5, Math.floor(rawChambers)));
    const safeCombos = Math.max(0, Math.min(100, Math.floor(rawCombos)));
    const safeRelics = Math.max(0, Math.min(10, Math.floor(rawRelics)));
    const safeCartouche = sanitizeCartoucheName(req.body?.cartoucheName || account.cartoucheName);

    const run: StoredRun = {
      id: `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      uid: account.uid,
      cartoucheName: safeCartouche,
      score: safeScore,
      chambersCleared: safeChambers,
      combos: safeCombos,
      relicCount: safeRelics,
      victory,
      createdAtMs: Date.now(),
    };

    account.runs = [run, ...account.runs].slice(0, 25);
    account.bestScore = Math.max(account.bestScore, safeScore);
    account.chambersClearedMax = Math.max(account.chambersClearedMax, safeChambers);
    account.gamesPlayed = Math.min(1_000_000, account.gamesPlayed + 1);
    account.cartoucheName = safeCartouche;
    account.updatedAtMs = Date.now();
    saveStoreToDisk();

    res.status(201).json({
      user: toPublicAccount(account),
      runs: account.runs.slice(0, 10),
    });
  });

  app.get('/api/admin/users', requireAuth, requireAdmin, (_req: AuthedRequest, res) => {
    const list = Array.from(accountsByUid.values())
      .filter((acc) => !acc.isAnonymous)
      .sort((a, b) => b.bestScore - a.bestScore)
      .slice(0, 50)
      .map(toPublicAccount);

    res.json({ users: list });
  });

  app.patch('/api/admin/users/:uid/role', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const targetUid = typeof req.params.uid === 'string' ? req.params.uid.trim().slice(0, 128) : '';
    const nextRole = req.body?.role;
    if (!targetUid || (nextRole !== 'admin' && nextRole !== 'player')) {
      res.status(400).json({ error: 'Parâmetros inválidos.' });
      return;
    }

    const target = accountsByUid.get(targetUid);
    if (!target || target.isAnonymous) {
      res.status(404).json({ error: 'Explorador não encontrado.' });
      return;
    }

    if (isFounderEmail(target.email) && nextRole !== 'admin') {
      res.status(403).json({ error: 'Administradores fundadores não podem ser rebaixados.' });
      return;
    }

    target.role = nextRole;
    target.updatedAtMs = Date.now();
    saveStoreToDisk();
    res.json({ user: toPublicAccount(target) });
  });

  app.post('/api/admin/users/:uid/reset', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const targetUid = typeof req.params.uid === 'string' ? req.params.uid.trim().slice(0, 128) : '';
    const target = accountsByUid.get(targetUid);
    if (!target) {
      res.status(404).json({ error: 'Explorador não encontrado.' });
      return;
    }

    target.bestScore = 0;
    target.chambersClearedMax = 0;
    target.gamesPlayed = 0;
    target.runs = [];
    target.updatedAtMs = Date.now();
    saveStoreToDisk();
    res.json({ user: toPublicAccount(target) });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (err instanceof SyntaxError && 'status' in err) {
      res.status(400).json({ error: 'JSON inválido.' });
      return;
    }
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
