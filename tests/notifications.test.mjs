import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

// Exercise the real route, session changes, React Query cache, composer and history.
// Replace Firebase sign-in and HTTP at the browser boundary. No external network is used.
let bundle;
before(async () => {
  const modules = {
    authSdk: `
      export const onAuthStateChanged = (_, callback) => window.testSession.subscribe(callback);
      export const signInWithEmailAndPassword = async () => {};
      export const signOut = async () => window.testSession.select(null);
    `,
    firebase: 'export const auth = window.testSession.auth;',
    axios: `
      export default {
        create: () => ({ get: async path => {
          if (path !== '/clubs') throw Error('Unexpected directory request: ' + path);
          return { data: [{glClubId: 134, name: 'Golden Creek'}, {glClubId: 535, name: 'Other club'}] };
        }}),
        isAxiosError: () => false
      };
    `,
  };
  const result = await build({
    entryPoints: ['src/main.tsx'], bundle: true, write: false, format: 'iife', outdir: 'out',
    jsx: 'automatic', loader: { '.css': 'empty', '.png': 'dataurl' },
    define: {
      'import.meta.env': JSON.stringify({ VITE_MONGODB_API_URL: 'https://api.example.test' }),
      'process.env.NODE_ENV': '"production"',
    },
    plugins: [{
      name: 'local-test-services',
      setup(builder) {
        builder.onResolve({ filter: /^firebase\/auth$/ }, () => ({ path: 'authSdk', namespace: 'fixture' }));
        builder.onResolve({ filter: /^\.\.\/firebase$/ }, () => ({ path: 'firebase', namespace: 'fixture' }));
        builder.onResolve({ filter: /^axios$/ }, () => ({ path: 'axios', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path] }));
      },
    }],
  });
  bundle = result.outputFiles.find(file => file.path.endsWith('.js')).text;
});

function campaign(clubId, title) {
  return {
    notificationId: clubId + '-campaign', title, message: title + ' body', audienceType: 'club', clubId,
    createdAt: new Date().toISOString(), senderEmail: 'sender@example.test', recipientCount: 2, deviceCount: 3,
    status: 'queued', acceptedCount: 0, failedCount: 0, skippedCount: 0, unknownCount: 0, pendingCount: 3,
  };
}

function mount(t, firstUser) {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', {
    url: 'https://portal.example.test/notifications', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  t.after(() => dom.window.close());
  const win = dom.window;
  Object.defineProperty(win, 'crypto', { value: webcrypto });
  Object.assign(win, { Headers, Request, Response, TextEncoder });
  win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const user = uid => ({ uid, email: uid + '@example.test', getIdToken: async () => 'test-' + uid });
  const callbacks = new Set();
  const auth = { currentUser: user(firstUser) };
  win.testSession = {
    auth,
    subscribe(cb) {
      callbacks.add(cb);
      win.setTimeout(() => cb(auth.currentUser), 0);
      return () => callbacks.delete(cb);
    },
    select(uid) {
      auth.currentUser = uid ? user(uid) : null;
      for (const cb of callbacks) cb(auth.currentUser);
    },
  };
  const records = {
    '00134': [], '00535': [campaign('00535', 'Private B push')],
    sogo: [campaign('sogo', 'Private SOGO push')],
  };
  const assignments = { a: ['134'], b: ['535'], multi: ['134', '535'], empty: [], headOffice: [] };
  const sent = [];
  const requests = [];
  const failures = [];
  const respond = (data, status = 200) => new Response(JSON.stringify(data), { status });
  win.fetch = async (url, options) => {
    try {
      const { origin, pathname, searchParams } = new URL(url);
      assert.equal(origin, 'https://api.example.test');
      const uid = auth.currentUser.uid;
      assert.equal(options.headers.get('Authorization'), 'Bearer test-' + uid);
      assert.equal(options.cache, 'no-store');
      assert(!searchParams.has('requestingUserEmail') && !searchParams.has('email'));
      if (pathname === '/admin/me') {
        return respond({ id: uid, email: uid + '@example.test', isActive: true, features: ['notifications'],
          role: uid === 'headOffice' ? 'super_admin' : 'club_admin', clubIds: assignments[uid] });
      }
      const payload = options.body ? JSON.parse(options.body) : null;
      const clubId = payload?.clubId ?? searchParams.get('clubId');
      if (uid !== 'headOffice') assert(assignments[uid].some(id => id.padStart(5, '0') === clubId));
      requests.push({ uid, pathname, clubId, audienceType: payload?.audienceType ?? searchParams.get('audienceType') });
      if (pathname === '/notifications/audience-count') return respond({ count: 2, deviceCount: 3 });
      if (pathname === '/notifications/send') {
        sent.push(payload);
        if (sent.length === 1) return Promise.reject(Error('Synthetic connection loss'));
        const record = { ...campaign(clubId, payload.title), ...payload };
        records[clubId].push(record);
        return respond(record, 202);
      }
      if (pathname === '/notifications/history') {
        return respond({ items: records[clubId], page: 1, pageSize: 25, totalCount: records[clubId].length });
      }
      const match = pathname.match(/^\/notifications\/history\/([^/]+)(\/recipients)?$/);
      const item = records[clubId].find(row => row.notificationId === match?.[1]);
      assert(item, 'Expected an owned campaign detail');
      if (!match[2]) return respond(item);
      return respond({ items: [{ golferId: 'golfer-1', golflinkNo: clubId + '00001', deviceCount: 1,
        pendingCount: 0, acceptedCount: 1, failedCount: 0, skippedCount: 0, unknownCount: 0 }], totalCount: 1, page: 1, pageSize: 25 });
    } catch (error) {
      failures.push(error);
      throw error;
    }
  };
  t.after(() => assert.deepEqual(failures, [], 'Unexpected API operation'));
  win.eval(bundle);
  const doc = win.document;
  const button = label => [...doc.querySelectorAll('button')].find(el => !el.closest('[hidden]') && el.textContent.trim() === label);
  const wait = async (fn, expected) => {
    for (let i = 0; i < 150; i++) { if (fn()) return; await delay(20); }
    assert.fail('Timed out waiting for ' + expected + ' – ' + doc.body.textContent);
  };
  function change(label, value) {
    const field = [...doc.querySelectorAll('label')].find(el => el.firstChild?.textContent.trim() === label)
      .querySelector('input, textarea, select');
    const select = field.tagName === 'SELECT';
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set.call(field, value);
    field.dispatchEvent(new win.Event(select ? 'change' : 'input', { bubbles: true }));
  }
  return { win, doc, button, wait, change, sent, requests, body: () => doc.body.textContent };
}

test('a club can retry its draft, see recipient outcomes and safely switch accounts in the same browser', async t => {
  const { win, doc, button, wait, change, sent, requests, body } = mount(t, 'a');
  await wait(() => button('Preview audience'), 'club A composer');
  const senderOptions = () => [...doc.querySelector('select').options].map(option => option.value);
  assert.deepEqual(senderOptions(), ['', '00134']);
  button('Preview audience').click();
  await wait(() => body().includes('2 eligible golfers'), 'audience preview');
  change('Title', 'Private A push');
  change('Message', 'Private A message');
  await wait(() => !button('Send notification').disabled, 'send button');
  button('Send notification').click();
  await wait(() => button('Send'), 'confirmation');
  button('Send').click();
  await wait(() => body().includes('Synthetic connection loss'), 'unknown submission result');

  button('History').click();
  await wait(() => body().includes('No notifications have been recorded'), 'empty club A history');
  button('Compose').click();
  await wait(() => button('Send notification'), 'saved draft');
  button('Send notification').click();
  await wait(() => button('Send'), 'retry confirmation');
  button('Send').click();
  await wait(() => doc.querySelector('li button')?.textContent.includes('Private A push'), 'submitted history entry');
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0], sent[1], 'An ambiguous retry must reuse the same idempotency key');
  doc.querySelector('li button').click();
  await wait(() => body().includes('Private A message'), 'club A detail');
  button('View recipients').click();
  await wait(() => body().includes('0013400001'), 'GA number in recipient drilldown');

  // The portal persister has a one-second write throttle.
  await delay(1100);
  assert(!/Private A|0013400001|test-a/.test(JSON.stringify(win.localStorage)));
  win.testSession.select('b');
  await wait(() => doc.querySelector('select')?.value === '00535', 'club B session');
  assert.deepEqual(senderOptions(), ['', '00535']);
  assert(!/Private A|0013400001/.test(body()));
  button('History').click();
  await wait(() => body().includes('Private B push'), 'club B history');
  assert(!/Private A|Private SOGO|0013400001/.test(body()));
  assert(!requests.some(r => r.uid === 'b' && r.clubId !== '00535'));
});

test('a club admin without assignments has no history or send access', async t => {
  const { wait, body, button, requests } = mount(t, 'empty');
  await wait(() => body().includes('No clubs are assigned'), 'empty assignments');
  assert.equal(button('History'), undefined);
  assert.equal(button('Preview audience'), undefined);
  assert.deepEqual(requests, []);
});

test('system-wide access requires the super admin to choose the SOGO sender explicitly', async t => {
  const { wait, body, button, requests, change, doc } = mount(t, 'headOffice');
  await wait(() => doc.querySelector('option[value="sogo"]'), 'SOGO sender option');
  assert.equal(doc.querySelector('select').value, '');
  assert.equal(button('Preview audience'), undefined);
  change('Sender', 'sogo');
  await wait(() => button('Preview audience'), 'SOGO composer');
  button('Preview audience').click();
  await wait(() => body().includes('2 eligible golfers'), 'system preview');
  assert(requests.some(r => r.clubId === 'sogo' && r.audienceType === 'all'));
  button('History').click();
  await wait(() => body().includes('Private SOGO push'), 'system history');
  change('Sender', '00134');
  await wait(() => button('Preview audience'), 'club composer for super admin');
  assert(!body().includes('Private SOGO push'));
  button('History').click();
  await wait(() => body().includes('No notifications have been recorded for this club'), 'club-only history');
});

test('changing club on a multi-club login clears the open history detail and recipient list', async t => {
  const { wait, button, requests, change, doc, body } = mount(t, 'multi');
  await wait(() => doc.querySelector('option[value="00535"]'), 'both assigned clubs');
  assert.equal(doc.querySelector('select').value, '');
  assert.equal(doc.querySelector('option[value="sogo"]'), null);
  change('Sender', '00535');
  await wait(() => button('History'), 'club B selection');
  button('History').click();
  await wait(() => doc.querySelector('li button'), 'club B campaign');
  doc.querySelector('li button').click();
  await wait(() => button('View recipients'), 'club B detail');
  button('View recipients').click();
  await wait(() => body().includes('0053500001'), 'club B recipient');
  change('Sender', '00134');
  await wait(() => button('Preview audience'), 'club A selection');
  assert(!body().includes('0053500001') && !body().includes('Private B'));
  button('History').click();
  await wait(() => body().includes('No notifications have been recorded for this club'), 'club A history');
  assert.equal(requests.at(-1).clubId, '00134');
});
