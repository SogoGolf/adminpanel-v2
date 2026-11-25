import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getClubs } from '../api/mongodb';
import { countAudience, getHistory, getNotification, getRecipients, sendNotification } from '../api/notifications';
import type { Audience, AudienceType, NotificationRecord, NotificationRequest, SendReceipt } from '../api/notifications';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';

const audienceNames: Record<AudienceType, string> = {
  all: 'All eligible SOGO golfers',
  club: 'All eligible club members',
  'rounds-in-progress': 'Members with a round in progress today',
  single: 'Individual member',
  gender: 'Members by gender',
  state: 'Members by state',
};
const stateOptions = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
const field = 'block mt-1 px-3 py-2 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-600 w-full';
const button = 'rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50';
const secondary = 'rounded-md border px-3 py-1 dark:border-gray-600 disabled:opacity-50';
const card = 'bg-white dark:bg-gray-800 p-5 rounded-lg shadow space-y-4';
const errorStyle = 'text-red-700 dark:text-red-400';
const freshQuery = { staleTime: 0, gcTime: 0, retry: false } as const;

function normaliseClubId(value: string | number): string {
  const id = String(value).trim();
  return /^\d{1,5}$/.test(id) ? id.padStart(5, '0') : '';
}

export function Notifications() {
  const { user, adminUser } = useAuth();
  if (!user || !adminUser) return null;
  return <ClubSelector key={user.uid} uid={user.uid} assigned={adminUser.clubIds} isSuperAdmin={adminUser.role === 'super_admin'} />;
}

function ClubSelector({ uid, assigned, isSuperAdmin }: { uid: string; assigned: string[]; isSuperAdmin: boolean }) {
  const [selection, setSelection] = useState('');
  const clubs = useQuery({ queryKey: ['clubs'], queryFn: getClubs });
  const names = new Map((clubs.data ?? []).map(club => [normaliseClubId(club.glClubId), club.name]));
  const ids = [...new Set((isSuperAdmin ? [...names.keys(), ...assigned] : assigned).map(normaliseClubId).filter(Boolean))];
  const canSelect = ids.includes(selection) || (isSuperAdmin && selection === 'sogo');
  const activeId = canSelect ? selection : !isSuperAdmin && ids.length === 1 ? ids[0] : '';
  const label = (id: string) => names.get(id) ? `${names.get(id)} (${id})` : `Club ${id}`;
  ids.sort((a, b) => label(a).localeCompare(label(b)));

  return (
    <div className="space-y-5 max-w-4xl text-gray-900 dark:text-gray-100">
      <h1 className="text-2xl font-bold">Push notifications</h1>
      {isSuperAdmin || ids.length > 0 ? (
        <label className="block max-w-md">
          Sender
          <select className={field} value={activeId} onChange={e => setSelection(e.target.value)}>
            <option value="" disabled>Select a sender</option>
            {isSuperAdmin && <option value="sogo">SOGO-wide</option>}
            {ids.map(id => <option key={id} value={id}>{label(id)}</option>)}
          </select>
        </label>
      ) : <p>No clubs are assigned to this account.</p>}
      {isSuperAdmin && clubs.isError && <button className={secondary} onClick={() => clubs.refetch()}>Reload clubs</button>}
      {activeId && <ClubNotifications key={activeId} uid={uid} clubId={activeId} clubLabel={activeId === 'sogo' ? 'SOGO-wide' : label(activeId)} isSuperAdmin={isSuperAdmin} />}
    </div>
  );
}

interface ClubProps { uid: string; clubId: string }

function ClubNotifications({ uid, clubId, clubLabel, isSuperAdmin }: ClubProps & { clubLabel: string; isSuperAdmin: boolean }) {
  const [tab, setTab] = useState<'send' | 'history'>('send');
  const [receipt, setReceipt] = useState<SendReceipt | null>(null);
  return (
    <>
      <nav aria-label="Notification views" className="flex gap-2">
        <button className={tab === 'send' ? button : secondary} aria-pressed={tab === 'send'} onClick={() => setTab('send')}>Compose</button>
        <button className={tab === 'history' ? button : secondary} aria-pressed={tab === 'history'} onClick={() => setTab('history')}>History</button>
      </nav>
      <section hidden={tab !== 'send'} aria-label="Compose notification">
        <Composer key={receipt?.notificationId ?? 'new'} uid={uid} clubId={clubId} clubLabel={clubLabel} isSuperAdmin={isSuperAdmin}
          onSent={data => { setReceipt(data); setTab('history'); }} />
      </section>
      {tab === 'history' && (
          <section aria-label="Club notification history">
            {receipt && <p role="status" className="mb-4">Request recorded for {receipt.recipientCount} golfers across {receipt.deviceCount} devices.</p>}
            <History uid={uid} clubId={clubId} />
          </section>
        )}
    </>
  );
}

function Composer({ uid, clubId, clubLabel, isSuperAdmin, onSent }: ClubProps & {
  clubLabel: string; isSuperAdmin: boolean; onSent: (receipt: SendReceipt) => void;
}) {
  const isSystem = clubId === 'sogo';
  const [audienceType, setAudienceType] = useState<AudienceType>(isSystem ? 'all' : 'club');
  const [filter, setFilter] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const audience: Audience = { clubId, audienceType };
  if (audienceType === 'single') audience.golflinkNo = filter;
  if (audienceType === 'state') audience.state = filter;
  if (audienceType === 'gender') audience.gender = filter;
  const validAudience = audienceType === 'single'
    ? /^\d{10}$/.test(filter) && (isSystem || filter.startsWith(clubId))
    : audienceType === 'state' || audienceType === 'gender' ? !!filter : true;

  const preview = useQuery({
    ...freshQuery,
    queryKey: ['clubNotifications', uid, clubId, 'preview', audience],
    queryFn: ({ signal }) => countAudience(uid, audience, signal),
    enabled: false,
  });
  const send = useMutation({
    mutationFn: (request: NotificationRequest) => sendNotification(uid, request),
    networkMode: 'always', retry: false, gcTime: 0,
    onSuccess: onSent,
  });
  const canSend = validAudience && preview.isSuccess && !preview.isFetching &&
    preview.data.count > 0 && preview.data.deviceCount > 0 && !!title.trim() && !!message.trim() && !send.isPending;
  const changeDraft = () => { setRequestKey(crypto.randomUUID()); send.reset(); };

  return (
    <fieldset disabled={send.isPending} className={card}>
      <h2 className="text-lg font-semibold">Compose a push</h2>
      <label className="block">Audience
        <select className={field} value={audienceType} onChange={e => {
          setAudienceType(e.target.value as AudienceType); setFilter(''); changeDraft();
        }}>
          {(Object.entries(audienceNames) as [AudienceType, string][]).filter(([type]) => type !== (isSystem ? 'club' : 'all') && (isSuperAdmin || type !== 'state'))
            .map(([type, label]) => <option key={type} value={type}>{label}</option>)}
        </select>
      </label>
      {audienceType === 'single' && <label className="block">GA number
        <input className={field} inputMode="numeric" maxLength={10} value={filter} onChange={e => { setFilter(e.target.value.trim()); changeDraft(); }} />
        {filter && !validAudience && <span>{isSystem ? 'Enter a ten-digit GA number.' : `Enter a ten-digit GA number belonging to club ${clubId}.`}</span>}
      </label>}
      {(audienceType === 'state' || audienceType === 'gender') &&
        <label className="block">{audienceType === 'state' ? 'State' : 'Gender'}
          <select className={field} value={filter} onChange={e => { setFilter(e.target.value); changeDraft(); }}>
            <option value="">Select…</option>
            {audienceType === 'state' ? stateOptions.map(state => <option key={state}>{state}</option>)
              : <><option value="m">Male</option><option value="f">Female</option></>}
          </select>
        </label>}
      <button className={secondary} disabled={!validAudience || preview.isFetching} onClick={() => preview.refetch()}>Preview audience</button>
      {preview.isError && <p role="alert" className={errorStyle}>{preview.error.message}</p>}
      {preview.isFetching && <p role="status">Checking eligible golfers…</p>}
      {preview.isSuccess && !preview.isFetching && <p role="status">{preview.data.count} eligible golfers · {preview.data.deviceCount} devices</p>}
      <label className="block">Title
        <input className={field} maxLength={120} value={title} onChange={e => { setTitle(e.target.value); changeDraft(); }} />
      </label>
      <label className="block">Message
        <textarea className={field} maxLength={500} rows={4} value={message} onChange={e => { setMessage(e.target.value); changeDraft(); }} />
      </label>
      <button className={button} disabled={!canSend} onClick={() => setConfirm(true)}>{send.isPending ? 'Submitting…' : 'Send notification'}</button>
      {send.isError && <p role="alert" className={errorStyle}>{send.error.message} You can check History or retry this draft.</p>}
      <ConfirmDialog open={confirm} title="Send notification?"
        message={`Send “${title.trim()}” from ${clubLabel}? The preview includes ${preview.data?.count ?? 0} eligible golfers.`}
        confirmLabel="Send" onCancel={() => setConfirm(false)} onConfirm={() => {
          setConfirm(false);
          if (canSend) send.mutate({ ...audience, title: title.trim(), message: message.trim(), idempotencyKey: requestKey });
        }} />
    </fieldset>
  );
}

function History({ uid, clubId }: ClubProps) {
  const [page, setPage] = useState(1);
  const [id, setId] = useState('');
  const list = useQuery({
    ...freshQuery, queryKey: ['clubNotifications', uid, clubId, 'history', page],
    queryFn: ({ signal }) => getHistory(uid, clubId, page, signal),
  });
  const detail = useQuery({
    ...freshQuery, queryKey: ['clubNotifications', uid, clubId, 'detail', id], enabled: !!id,
    queryFn: ({ signal }) => getNotification(uid, clubId, id, signal),
  });
  const item = detail.isSuccess ? detail.data : null;
  if (id) return (
    <div className={card}>
      <div className="flex justify-between gap-2">
        <button className={secondary} onClick={() => setId('')}>Back to history</button>
        <button className={secondary} disabled={detail.isFetching} onClick={() => detail.refetch()}>Refresh</button>
      </div>
      {detail.isLoading && <p>Loading notification…</p>}
      {detail.isError && <p role="alert" className={errorStyle}>{detail.error.message}</p>}
      {item && <>
        <h2 className="text-lg font-semibold break-words">{item.title}</h2>
        <p className="whitespace-pre-wrap break-words">{item.message}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt>Created</dt><dd>{new Date(item.createdAt).toLocaleString('en-AU')}</dd>
          <dt>Sent by</dt><dd>{item.senderEmail}</dd>
          <dt>Audience</dt><dd>{describeAudience(item)}</dd>
          <dt>Status</dt><dd>{statusLabel(item.status)}</dd>
          <dt>Targeted</dt><dd>{item.recipientCount} golfers · {item.deviceCount} devices</dd>
          <dt>Accepted by FCM</dt><dd>{item.acceptedCount} devices</dd>
          <dt>Pending</dt><dd>{item.pendingCount} devices</dd>
          <dt>Failed</dt><dd>{item.failedCount} devices</dd>
          <dt>Skipped</dt><dd>{item.skippedCount} devices</dd>
          <dt>Outcome unknown</dt><dd>{item.unknownCount} devices</dd>
        </dl>
        <Recipients uid={uid} clubId={clubId} id={id} />
      </>}
    </div>
  );
  return (
    <div className={card}>
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">{clubId === 'sogo' ? 'SOGO-wide notification history' : 'Club notification history'}</h2>
        <button className={secondary} disabled={list.isFetching} onClick={() => list.refetch()}>Refresh</button>
      </div>
      {list.isLoading && <p>Loading history…</p>}
      {list.isError && <p role="alert" className={errorStyle}>{list.error.message}</p>}
      {list.isSuccess && (list.data.items.length === 0 ? <p>{clubId === 'sogo' ? 'No SOGO-wide notifications have been recorded.' : 'No notifications have been recorded for this club.'}</p> : <>
        <ul className="divide-y dark:divide-gray-600">{list.data.items.map(row =>
          <li key={row.notificationId}>
            <button className="w-full py-3 text-left" onClick={() => setId(row.notificationId)}>
              <span className="block font-semibold text-blue-700 dark:text-blue-400 break-words">{row.title}</span>
              <span className="text-sm">{new Date(row.createdAt).toLocaleString('en-AU')} · {statusLabel(row.status)} · {row.recipientCount} golfers</span>
            </button>
          </li>)}</ul>
        <Pagination page={page} pageSize={list.data.pageSize} totalCount={list.data.totalCount} setPage={setPage} />
      </>)}
    </div>
  );
}

function describeAudience(item: NotificationRecord) {
  const { audienceType, audience } = item;
  if (audienceType === 'single' && audience?.golflinkNo) return `GA number ${audience.golflinkNo}`;
  if (audienceType === 'state' && audience?.state) return `Golfers in ${audience.state}`;
  if (audienceType === 'gender' && audience?.gender) {
    return audience.gender === 'f' ? 'Female golfers' : 'Male golfers';
  }
  return audienceNames[audienceType];
}

function statusLabel(status: string) {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1).replaceAll('_', ' ');
}

function Pagination({ page, pageSize, totalCount, setPage }: {
  page: number; pageSize: number; totalCount: number; setPage: (page: number) => void;
}) {
  if (totalCount <= pageSize) return null;
  return <div className="flex items-center gap-3">
    <button className={secondary} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
    <span>Page {page} of {Math.ceil(totalCount / pageSize)}</span>
    <button className={secondary} disabled={page * pageSize >= totalCount} onClick={() => setPage(page + 1)}>Next</button>
  </div>;
}

function Recipients({ uid, clubId, id }: ClubProps & { id: string }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const result = useQuery({
    ...freshQuery, queryKey: ['clubNotifications', uid, clubId, 'recipients', id, page],
    queryFn: ({ signal }) => getRecipients(uid, clubId, id, page, signal),
    enabled: open,
  });
  return <section className="space-y-3">
    <button className={secondary} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide recipients' : 'View recipients'}</button>
    {open && <>
      {result.isLoading && <p>Loading recipients…</p>}
      {result.isError && <p role="alert" className={errorStyle}>{result.error.message}</p>}
      {result.isSuccess && (result.data.totalCount === 0 ? <p>No recipients were recorded.</p> : <>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <caption className="text-left font-semibold mb-2">Device outcomes by golfer</caption>
            <thead><tr>{['GA number', 'Devices', 'Accepted by FCM', 'Pending', 'Failed', 'Skipped', 'Unknown'].map(label =>
              <th key={label} scope="col" className="pr-3 py-2">{label}</th>)}</tr></thead>
            <tbody className="divide-y dark:divide-gray-600">{result.data.items.map(row => <tr key={row.golferId}>
              <th scope="row" className="pr-3 py-2 font-medium">{row.golflinkNo || row.golferId}</th>
              {[row.deviceCount, row.acceptedCount, row.pendingCount, row.failedCount, row.skippedCount, row.unknownCount]
                .map((value, index) => <td key={index} className="pr-3 py-2">{value}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={result.data.pageSize} totalCount={result.data.totalCount} setPage={setPage} />
      </>)}
      <button className={secondary} disabled={result.isFetching} onClick={() => result.refetch()}>Refresh recipient outcomes</button>
    </>}
  </section>;
}
