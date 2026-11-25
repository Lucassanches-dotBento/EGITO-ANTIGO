import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GithubAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
export const microsoftProvider = new OAuthProvider('microsoft.com');

export const BOOTSTRAPPED_ADMINS: { name: string; email: string }[] = [
  { name: 'Lucas', email: '20261ac0080020@estudantes.ifpr.edu.br' },
  { name: 'Bento', email: '20261ac0080019@estudantes.ifpr.edu.br' },
  { name: 'Mikael', email: '20261ac0080070@estudantes.ifpr.edu.br' },
];

export function isBootstrappedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return BOOTSTRAPPED_ADMINS.some((admin) => admin.email === normalized);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export type UserRole = 'admin' | 'player';

export interface UserProfileData {
  uid: string;
  displayName: string;
  cartoucheName: string;
  email: string;
  role: UserRole;
  bestScore: number;
  chambersClearedMax: number;
  gamesPlayed: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ExpeditionRunData {
  id: string;
  uid: string;
  cartoucheName: string;
  score: number;
  chambersCleared: number;
  combos: number;
  relicCount: number;
  victory: boolean;
  createdAt?: Timestamp;
}

function sanitizeDisplayName(raw: string): string {
  const trimmed = raw.trim().slice(0, 60);
  return trimmed || 'Explorador';
}

function sanitizeCartoucheName(raw: string): string {
  const trimmed = raw.trim().slice(0, 18);
  return trimmed || 'FARAÓ';
}

export async function ensureUserProfile(params: {
  uid: string;
  displayName: string;
  cartoucheName: string;
  email: string;
}): Promise<void> {
  const userPath = `users/${params.uid}`;
  const adminPath = `admins/${params.uid}`;
  const ref = doc(db, 'users', params.uid);
  const isBootstrapAdmin = isBootstrappedAdminEmail(params.email);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: params.uid,
        displayName: sanitizeDisplayName(params.displayName),
        cartoucheName: sanitizeCartoucheName(params.cartoucheName),
        email: params.email.trim().slice(0, 160),
        role: isBootstrapAdmin ? 'admin' : 'player',
        bestScore: 0,
        chambersClearedMax: 0,
        gamesPlayed: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (isBootstrapAdmin && snap.data()?.role !== 'admin') {
      await updateDoc(ref, {
        role: 'admin',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  if (isBootstrapAdmin) {
    try {
      const adminRef = doc(db, 'admins', params.uid);
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        await setDoc(adminRef, {
          uid: params.uid,
          email: params.email.trim().slice(0, 160),
          grantedBy: 'bootstrap',
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, adminPath);
    }
  }
}

export async function updateProfileCartouche(
  uid: string,
  displayName: string,
  cartoucheName: string
): Promise<void> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  try {
    await updateDoc(ref, {
      displayName: sanitizeDisplayName(displayName),
      cartoucheName: sanitizeCartoucheName(cartoucheName),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function recordExpeditionRun(params: {
  uid: string;
  cartoucheName: string;
  score: number;
  chambersCleared: number;
  combos: number;
  relicCount: number;
  victory: boolean;
  currentProfile: UserProfileData | null;
}): Promise<void> {
  const safeCartouche = sanitizeCartoucheName(params.cartoucheName);
  const safeScore = Math.max(0, Math.min(10000000, Math.floor(params.score)));
  const safeChambers = Math.max(0, Math.min(5, Math.floor(params.chambersCleared)));
  const safeCombos = Math.max(0, Math.min(100, Math.floor(params.combos)));
  const safeRelics = Math.max(0, Math.min(10, Math.floor(params.relicCount)));

  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const runPath = `users/${params.uid}/runs/${runId}`;
  const userPath = `users/${params.uid}`;

  try {
    await setDoc(doc(db, 'users', params.uid, 'runs', runId), {
      uid: params.uid,
      cartoucheName: safeCartouche,
      score: safeScore,
      chambersCleared: safeChambers,
      combos: safeCombos,
      relicCount: safeRelics,
      victory: Boolean(params.victory),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, runPath);
  }

  try {
    const prevBest = params.currentProfile?.bestScore ?? 0;
    const prevMaxChambers = params.currentProfile?.chambersClearedMax ?? 0;
    const prevGames = params.currentProfile?.gamesPlayed ?? 0;

    await updateDoc(doc(db, 'users', params.uid), {
      bestScore: Math.max(prevBest, safeScore),
      chambersClearedMax: Math.max(prevMaxChambers, safeChambers),
      gamesPlayed: Math.min(1000000, prevGames + 1),
      cartoucheName: safeCartouche,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfileData | null) => void
): () => void {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfileData) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeUserRuns(
  uid: string,
  onData: (runs: ExpeditionRunData[]) => void
): () => void {
  const path = `users/${uid}/runs`;
  const q = query(
    collection(db, 'users', uid, 'runs'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(10)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: ExpeditionRunData[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ExpeditionRunData, 'id'>),
      }));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ==================== ADMIN HELPERS ====================

export function subscribeAllUsers(
  onData: (users: UserProfileData[]) => void
): () => void {
  const path = 'users';
  const q = query(collection(db, 'users'), orderBy('bestScore', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as UserProfileData));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function adminSetUserRole(params: {
  targetUser: UserProfileData;
  nextRole: UserRole;
  grantedByUid: string;
}): Promise<void> {
  if (isBootstrappedAdminEmail(params.targetUser.email) && params.nextRole !== 'admin') {
    return;
  }
  const userPath = `users/${params.targetUser.uid}`;
  const adminPath = `admins/${params.targetUser.uid}`;

  try {
    await updateDoc(doc(db, 'users', params.targetUser.uid), {
      role: params.nextRole,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }

  try {
    if (params.nextRole === 'admin') {
      await setDoc(doc(db, 'admins', params.targetUser.uid), {
        uid: params.targetUser.uid,
        email: params.targetUser.email,
        grantedBy: params.grantedByUid,
        createdAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(doc(db, 'admins', params.targetUser.uid));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, adminPath);
  }
}

export async function adminResetUserStats(targetUid: string): Promise<void> {
  const path = `users/${targetUid}`;
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      bestScore: 0,
      chambersClearedMax: 0,
      gamesPlayed: 0,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
