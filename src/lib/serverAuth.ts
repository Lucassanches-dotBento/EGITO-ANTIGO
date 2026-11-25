import type { ExpeditionRunData, UserProfileData, UserRole } from '../firebase';

export interface ServerPublicAccount {
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

export interface ServerRunRecord {
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

export interface ServerAuthSession {
  token: string;
  user: ServerPublicAccount;
  runs: ServerRunRecord[];
}

export class ServerApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = 'SERVER_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function apiRequest<T>(
  url: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new ServerApiError(
      data.error || 'Erro ao comunicar com o servidor.',
      res.status,
      data.code || 'SERVER_ERROR'
    );
  }

  return data as T;
}

export async function getServerAuthConfig(): Promise<{ adminPasscodeRequired: boolean }> {
  return apiRequest<{ adminPasscodeRequired: boolean }>('/api/auth/config');
}

export async function registerWithServer(params: {
  email: string;
  password: string;
  displayName: string;
  cartoucheName: string;
  adminPasscode?: string;
}): Promise<ServerAuthSession> {
  return apiRequest<ServerAuthSession>('/api/auth/register', {
    method: 'POST',
    body: params,
  });
}

export async function loginWithServer(params: {
  email: string;
  password: string;
}): Promise<ServerAuthSession> {
  return apiRequest<ServerAuthSession>('/api/auth/login', {
    method: 'POST',
    body: params,
  });
}

export async function loginAnonymousWithServer(): Promise<ServerAuthSession> {
  return apiRequest<ServerAuthSession>('/api/auth/anonymous', {
    method: 'POST',
  });
}

export async function updateServerCartouche(
  token: string,
  params: { displayName: string; cartoucheName: string }
): Promise<{ user: ServerPublicAccount }> {
  return apiRequest<{ user: ServerPublicAccount }>('/api/auth/cartouche', {
    method: 'PATCH',
    token,
    body: params,
  });
}

export async function updateServerPassword(
  token: string,
  params: { currentPassword: string; newPassword: string }
): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>('/api/auth/password', {
    method: 'PATCH',
    token,
    body: params,
  });
}

export async function setPasswordWithFirebaseToken(
  firebaseIdToken: string,
  params: { newPassword: string; displayName?: string; cartoucheName?: string }
): Promise<{ ok: boolean; email: string }> {
  return apiRequest<{ ok: boolean; email: string }>('/api/auth/firebase-set-password', {
    method: 'POST',
    token: firebaseIdToken,
    body: params,
  });
}

export async function recordServerRun(
  token: string,
  params: {
    cartoucheName: string;
    score: number;
    chambersCleared: number;
    combos: number;
    relicCount: number;
    victory: boolean;
  }
): Promise<{ user: ServerPublicAccount; runs: ServerRunRecord[] }> {
  return apiRequest<{ user: ServerPublicAccount; runs: ServerRunRecord[] }>('/api/runs', {
    method: 'POST',
    token,
    body: params,
  });
}

export async function listServerUsers(token: string): Promise<{ users: ServerPublicAccount[] }> {
  return apiRequest<{ users: ServerPublicAccount[] }>('/api/admin/users', {
    method: 'GET',
    token,
  });
}

export async function setServerUserRole(
  token: string,
  uid: string,
  role: UserRole
): Promise<{ user: ServerPublicAccount }> {
  return apiRequest<{ user: ServerPublicAccount }>(`/api/admin/users/${encodeURIComponent(uid)}/role`, {
    method: 'PATCH',
    token,
    body: { role },
  });
}

export async function resetServerUserStats(
  token: string,
  uid: string
): Promise<{ user: ServerPublicAccount }> {
  return apiRequest<{ user: ServerPublicAccount }>(`/api/admin/users/${encodeURIComponent(uid)}/reset`, {
    method: 'POST',
    token,
  });
}

export function serverAccountToProfile(account: ServerPublicAccount): UserProfileData {
  return {
    uid: account.uid,
    displayName: account.displayName,
    cartoucheName: account.cartoucheName,
    email: account.email,
    role: account.role,
    bestScore: account.bestScore,
    chambersClearedMax: account.chambersClearedMax,
    gamesPlayed: account.gamesPlayed,
  };
}

export function serverRunsToExpeditionRuns(runs: ServerRunRecord[]): ExpeditionRunData[] {
  return runs.map((r) => ({
    id: r.id,
    uid: r.uid,
    cartoucheName: r.cartoucheName,
    score: r.score,
    chambersCleared: r.chambersCleared,
    combos: r.combos,
    relicCount: r.relicCount,
    victory: r.victory,
  }));
}
