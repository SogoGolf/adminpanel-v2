import { adminFetch } from './adminAuth';

export type AudienceType = 'all' | 'rounds-in-progress' | 'gender' | 'club' | 'state' | 'single';

export interface Audience {
  clubId: string;
  audienceType: AudienceType;
  gender?: string;
  state?: string;
  golflinkNo?: string;
}

export interface AudienceCount {
  count: number;
  deviceCount: number;
}

export interface NotificationRequest extends Audience {
  title: string;
  message: string;
  idempotencyKey: string;
}

export interface SendReceipt {
  notificationId: string;
  recipientCount: number;
  deviceCount: number;
  status: string;
}

export interface DeviceOutcomes {
  acceptedCount: number;
  failedCount: number;
  skippedCount: number;
  unknownCount: number;
  pendingCount: number;
}

export interface NotificationRecord extends SendReceipt, DeviceOutcomes {
  clubId: string;
  title: string;
  message: string;
  audienceType: AudienceType;
  audience?: Pick<Audience, 'gender' | 'state' | 'golflinkNo'>;
  senderEmail: string;
  createdAt: string;
}

export interface Recipient extends DeviceOutcomes {
  golferId: string;
  golflinkNo: string;
  deviceCount: number;
}

export interface ResultPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

async function request<T>(uid: string, path: string, init?: RequestInit): Promise<T> {
  const response = await adminFetch(`/notifications/${path}`, init, uid);
  if (!response.ok) {
    switch (response.status) {
      case 400: throw new Error('Check the club, audience and message.');
      case 401: throw new Error('Your session has expired. Sign in again.');
      case 403: throw new Error('Your account does not have access to this club action.');
      case 404: throw new Error('This notification or club is unavailable.');
      case 409: throw new Error('This request has already been used. Refresh the history before sending again.');
      case 503: throw new Error('Notifications are temporarily unavailable. Try again later.');
      default: throw new Error(`The notification request failed (HTTP ${response.status}).`);
    }
  }
  return response.json() as Promise<T>;
}

export function countAudience(uid: string, audience: Audience, signal: AbortSignal) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(audience)) {
    if (value) params.set(key, value);
  }
  return request<AudienceCount>(uid, `audience-count?${params}`, { signal });
}

export function sendNotification(uid: string, payload: NotificationRequest) {
  return request<SendReceipt>(uid, 'send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getHistory(uid: string, clubId: string, page: number, signal: AbortSignal) {
  const params = new URLSearchParams({ clubId, page: String(page), pageSize: '25' });
  const result = await request<ResultPage<NotificationRecord>>(uid, `history?${params}`, { signal });
  if (result.items.some((item) => item.clubId !== clubId)) throw new Error('Could not verify the club history.');
  return result;
}

export async function getNotification(uid: string, clubId: string, id: string, signal: AbortSignal) {
  const params = new URLSearchParams({ clubId });
  const item = await request<NotificationRecord>(uid, `history/${encodeURIComponent(id)}?${params}`, { signal });
  if (item.clubId !== clubId || item.notificationId !== id) throw new Error('Could not verify the notification.');
  return item;
}


export function getRecipients(uid: string, clubId: string, id: string, page: number, signal: AbortSignal) {
  const params = new URLSearchParams({ clubId, page: String(page), pageSize: '25' });
  return request<ResultPage<Recipient>>(uid, `history/${encodeURIComponent(id)}/recipients?${params}`, { signal });
}
