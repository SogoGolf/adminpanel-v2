import { auth } from '../firebase';

const apiBase = import.meta.env.VITE_MONGODB_API_URL || 'https://mongo-api-613362712202.australia-southeast1.run.app';

export async function adminHeaders(expectedUid?: string) {
  const user = auth.currentUser;
  if (!user || (expectedUid && user.uid !== expectedUid)) throw new Error('Please sign in again.');
  const token = await user.getIdToken();
  if (auth.currentUser?.uid !== user.uid) throw new Error('Your session has changed.');
  return { Authorization: `Bearer ${token}` };
}

export async function adminFetch(path: string, init: RequestInit = {}, expectedUid?: string) {
  const headers = new Headers(init.headers);
  const { Authorization } = await adminHeaders(expectedUid);
  headers.set('Authorization', Authorization);
  return fetch(`${apiBase}${path}`, { ...init, headers, cache: 'no-store' });
}
