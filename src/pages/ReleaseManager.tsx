import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  getReleaseManagerConfig,
  saveReleaseManagerDraft,
  publishReleaseManagerConfig,
} from '../api/mongodb';
import type {
  MobileAppVersionPlatformSettings,
  ReleaseManagerContentRequest,
  ReleasePlatform,
} from '../types';
import {
  FEATURE_ICONS,
  ICON_OPTIONS,
  ICON_TO_SF,
  SF_TO_ICON,
  type FeatureIconKey,
} from '../components/release-manager/icons';
import { UpdatePromptPreview } from '../components/release-manager/UpdatePromptPreview';
import sgLogo from '../assets/simple_golf_logo.png';
import '../components/release-manager/releaseManager.css';

const LIMITS = { title: 32, detail: 90, features: 5, fixRows: 4, fixes: 3, message: 160 };
const VERSION_RE = /^\d+\.\d+(\.\d+)?$/;

interface FormFeature {
  icon: FeatureIconKey;
  title: string;
  detail: string;
}

interface FormState {
  minimumRequiredVersion: string;
  forceUpdateEnabled: boolean;
  optionalUpdatePromptEnabled: boolean;
  updateMessage: string;
  features: FormFeature[];
  fixRows: string[];
  fixes: string[];
  footnote: string;
}

const EMPTY_FORM: FormState = {
  minimumRequiredVersion: '',
  forceUpdateEnabled: false,
  optionalUpdatePromptEnabled: false,
  updateMessage: '',
  features: [],
  fixRows: [],
  fixes: [],
  footnote: '',
};

function settingsToForm(settings: MobileAppVersionPlatformSettings | null | undefined): FormState {
  if (!settings) return EMPTY_FORM;
  return {
    minimumRequiredVersion: settings.minimumRequiredVersion ?? '',
    forceUpdateEnabled: Boolean(settings.forceUpdateEnabled),
    optionalUpdatePromptEnabled: Boolean(settings.optionalUpdatePromptEnabled),
    updateMessage: settings.updateMessage ?? '',
    features: (settings.features ?? []).map((f) => ({
      icon: SF_TO_ICON[f.icon] ?? 'flag',
      title: f.title ?? '',
      detail: f.detail ?? '',
    })),
    fixRows: settings.fixRows ?? [],
    fixes: settings.fixes ?? [],
    footnote: settings.footnote ?? '',
  };
}

function formToContent(form: FormState, updatedBy?: string): ReleaseManagerContentRequest {
  const content: ReleaseManagerContentRequest = {
    minimumRequiredVersion: form.minimumRequiredVersion.trim(),
    forceUpdateEnabled: form.forceUpdateEnabled,
    optionalUpdatePromptEnabled: form.optionalUpdatePromptEnabled,
    updateMessage: form.updateMessage.trim(),
    updatedBy,
  };
  if (form.features.length) {
    content.features = form.features.map((f) => ({
      icon: ICON_TO_SF[f.icon],
      title: f.title.trim(),
      detail: f.detail.trim(),
    }));
  }
  if (form.fixRows.length) content.fixRows = form.fixRows.map((r) => r.trim());
  if (form.fixes.length) content.fixes = form.fixes.map((r) => r.trim());
  if (form.footnote.trim()) content.footnote = form.footnote.trim();
  return content;
}

function validate(c: FormState): { errs: string[]; warns: string[] } {
  const errs: string[] = [];
  const warns: string[] = [];
  if (!VERSION_RE.test(c.minimumRequiredVersion)) errs.push('Minimum version must look like 2.4.0');
  if (c.forceUpdateEnabled && c.optionalUpdatePromptEnabled)
    warns.push("Force update wins — the optional prompt never shows while it's on");
  if (!c.forceUpdateEnabled && !c.optionalUpdatePromptEnabled)
    warns.push('Both prompts are off — golfers on older builds will see nothing');
  c.features.forEach((f, i) => {
    if (!f.title.trim()) errs.push(`Feature ${i + 1} needs a title`);
    if (!f.detail.trim()) errs.push(`Feature ${i + 1} needs a detail line`);
    if (f.title.length > LIMITS.title) errs.push(`Feature ${i + 1} title is ${f.title.length} chars (max ${LIMITS.title})`);
    if (f.detail.length > LIMITS.detail) errs.push(`Feature ${i + 1} detail is ${f.detail.length} chars (max ${LIMITS.detail})`);
  });
  c.fixRows.forEach((f, i) => { if (!f.trim()) errs.push(`Fix row ${i + 1} is empty`); });
  c.fixes.forEach((f, i) => { if (!f.trim()) errs.push(`Fix line ${i + 1} is empty`); });
  if (c.features.length && c.fixRows.length)
    warns.push('Features and ticked fix rows together read busy — use plain fix lines alongside features');
  if (c.features.length === 2)
    warns.push('Two features sits awkwardly between tiers — add a third or fold one into fixes');
  if (!c.updateMessage.trim()) errs.push('Fallback message is required — older app builds show only this');
  return { errs, warns };
}

function tierOf(c: FormState): { n: number; name: string } {
  if (c.features.length >= 3) return { n: 3, name: 'Feature release' };
  if (c.features.length >= 1) return { n: 2, name: 'One feature + fixes' };
  if (c.fixRows.length) return { n: 1, name: 'Fixes only' };
  return { n: 0, name: "Message only — today's card" };
}

function serverErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (error.response?.status === 401) return 'You are not authorised to change the app update prompt.';
    if (error.response?.status === 403) return 'Only release admins (super admins) can change the app update prompt.';
  }
  return 'The save failed — nothing was changed on the server. Check your connection and try again.';
}

function initialsOf(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?';
}

function formatAuditDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Small building blocks ──

function Field({ label, count, max, children }: {
  label: string;
  count?: number;
  max?: number;
  children: React.ReactNode;
}) {
  const over = count != null && max != null && count > max;
  return (
    <label className="ra-f">
      <span className="l">
        <span>{label}</span>
        {count != null && <span className={'cnt' + (over ? ' over' : '')}>{count}/{max}</span>}
      </span>
      {children}
    </label>
  );
}

function SwitchRow({ on, onChange, title, detail, danger }: {
  on: boolean;
  onChange: (value: boolean) => void;
  title: string;
  detail: string;
  danger?: boolean;
}) {
  return (
    <div
      className={'ra-sw' + (on ? ' on' : '') + (danger ? ' danger' : '')}
      onClick={() => onChange(!on)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onChange(!on);
        }
      }}
      role="switch"
      aria-checked={on}
      tabIndex={0}
    >
      <span className="track"><i /></span>
      <span className="tx">
        <div className="t">{title}</div>
        <div className="d">{detail}</div>
      </span>
    </div>
  );
}

function FeatureEditor({ items, onChange }: {
  items: FormFeature[];
  onChange: (items: FormFeature[]) => void;
}) {
  const set = (i: number, patch: Partial<FormFeature>) =>
    onChange(items.map((it, n) => (n === i ? { ...it, ...patch } : it)));
  const move = (i: number, d: number) => {
    const next = [...items];
    const [moved] = next.splice(i, 1);
    next.splice(i + d, 0, moved);
    onChange(next);
  };
  return (
    <div>
      {!items.length && (
        <div className="ra-empty">No features — the prompt drops to Tier 1 (fixes only) or Tier 0 (message only).</div>
      )}
      {items.map((f, i) => (
        <div className="ra-item" key={i}>
          <div className="top">
            <span className="ra-num">{i + 1}</span>
            <div className="ra-iconsel">
              <span className="ra-iconprev">{FEATURE_ICONS[f.icon]}</span>
              <select
                className="ra-in"
                style={{ width: 210 }}
                value={f.icon}
                onChange={(e) => set(i, { icon: e.target.value as FeatureIconKey })}
              >
                {ICON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <span className="sp" />
            <button type="button" className="ra-icobtn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
            <button type="button" className="ra-icobtn" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">↓</button>
            <button type="button" className="ra-icobtn del" onClick={() => onChange(items.filter((_, n) => n !== i))} aria-label="Remove">✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Title" count={f.title.length} max={LIMITS.title}>
              <input
                className={'ra-in' + (f.title.length > LIMITS.title ? ' err' : '')}
                value={f.title}
                onChange={(e) => set(i, { title: e.target.value })}
                placeholder="Hole-by-hole stats"
              />
            </Field>
            <Field label="One-line detail" count={f.detail.length} max={LIMITS.detail}>
              <input
                className={'ra-in' + (f.detail.length > LIMITS.detail ? ' err' : '')}
                value={f.detail}
                onChange={(e) => set(i, { detail: e.target.value })}
                placeholder="What the golfer can now do."
              />
            </Field>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="ra-add"
        onClick={() => onChange([...items, { icon: 'flag', title: '', detail: '' }])}
        disabled={items.length >= LIMITS.features}
      >
        + Add feature{items.length >= LIMITS.features ? ` — max ${LIMITS.features}` : ''}
      </button>
    </div>
  );
}

function LineEditor({ items, onChange, max, placeholder, addLabel, empty }: {
  items: string[];
  onChange: (items: string[]) => void;
  max: number;
  placeholder: string;
  addLabel: string;
  empty: string;
}) {
  return (
    <div>
      {!items.length && <div className="ra-empty">{empty}</div>}
      {items.map((value, i) => (
        <div className="ra-line" key={i}>
          <span className="ra-num">{i + 1}</span>
          <input
            className="ra-in"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((x, n) => (n === i ? e.target.value : x)))}
          />
          <button type="button" className="ra-icobtn del" onClick={() => onChange(items.filter((_, n) => n !== i))} aria-label="Remove">✕</button>
        </div>
      ))}
      <button
        type="button"
        className="ra-add"
        onClick={() => onChange([...items, ''])}
        disabled={items.length >= max}
      >
        + {addLabel}{items.length >= max ? ` — max ${max}` : ''}
      </button>
    </div>
  );
}

function SkeletonCard({ rows }: { rows: number }) {
  return (
    <div className="ra-card">
      <div className="hd"><span className="ra-skel" style={{ width: 120, height: 12 }} /></div>
      <div className="bd">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="ra-skel" style={{ height: 38, marginBottom: i === rows - 1 ? 0 : 12 }} />
        ))}
      </div>
    </div>
  );
}

// ── The screen ──

export default function ReleaseManager() {
  const { user, adminUser } = useAuth();
  const queryClient = useQueryClient();
  const adminEmail = user?.email ?? adminUser?.email ?? '';

  const [platform, setPlatform] = useState<ReleasePlatform>('ios');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saved, setSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [pendingPlatform, setPendingPlatform] = useState<ReleasePlatform | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const hydratedSigRef = useRef<string>(JSON.stringify(EMPTY_FORM));
  const pendingHydrateRef = useRef(true);

  const queryKey = ['releaseManagerConfig', platform, adminEmail];
  const { data, isLoading, error: loadError, refetch } = useQuery({
    queryKey,
    queryFn: () => getReleaseManagerConfig(adminEmail, platform),
    enabled: Boolean(adminEmail),
  });

  const sig = JSON.stringify(form);
  const isDirty = sig !== hydratedSigRef.current;
  const draftExists = Boolean(data?.draft);

  useEffect(() => {
    if (!data) return;
    if (!pendingHydrateRef.current && isDirty) return;
    const next = settingsToForm(data.draft ?? data.live);
    hydratedSigRef.current = JSON.stringify(next);
    pendingHydrateRef.current = false;
    setForm(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(null);
    setSaveError(null);
  };

  const { errs, warns } = useMemo(() => validate(form), [form]);
  const tier = tierOf(form);
  const headline = form.features.length
    ? "What's New"
    : form.fixRows.length
      ? "What's Fixed"
      : form.forceUpdateEnabled
        ? 'Update Required'
        : 'Update Available';

  const payload = useMemo(() => {
    const o: Record<string, unknown> = {
      platform,
      minimumRequiredVersion: form.minimumRequiredVersion,
      forceUpdateEnabled: form.forceUpdateEnabled,
      optionalUpdatePromptEnabled: form.optionalUpdatePromptEnabled,
      updateMessage: form.updateMessage,
    };
    if (form.features.length) {
      o.features = form.features.map((f) => ({ icon: ICON_TO_SF[f.icon], title: f.title, detail: f.detail }));
    }
    if (form.fixRows.length) o.fixRows = form.fixRows;
    if (form.fixes.length) o.fixes = form.fixes;
    if (form.footnote.trim()) o.footnote = form.footnote;
    return o;
  }, [form, platform]);

  const platformLabel = platform === 'ios' ? 'iOS' : 'Android';

  const draftMutation = useMutation({
    mutationFn: () => saveReleaseManagerDraft(adminEmail, platform, formToContent(form, adminEmail)),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKey, response);
      hydratedSigRef.current = JSON.stringify(settingsToForm(response.draft ?? response.live));
      setSaved('Draft saved');
      setSaveError(null);
    },
    onError: (error) => setSaveError(serverErrorMessage(error)),
  });

  const publishMutation = useMutation({
    mutationFn: () => publishReleaseManagerConfig(adminEmail, platform, formToContent(form, adminEmail)),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKey, response);
      const next = settingsToForm(response.live);
      hydratedSigRef.current = JSON.stringify(next);
      setForm(next);
      setSaved(`Published to ${platformLabel}`);
      setSaveError(null);
    },
    onError: (error) => setSaveError(serverErrorMessage(error)),
  });

  const busy = draftMutation.isPending || publishMutation.isPending;

  const requestPlatformSwitch = (next: ReleasePlatform) => {
    if (next === platform) return;
    if (isDirty) {
      setPendingPlatform(next);
    } else {
      switchPlatform(next);
    }
  };

  const switchPlatform = (next: ReleasePlatform) => {
    pendingHydrateRef.current = true;
    setPlatform(next);
    setSaved(null);
    setSaveError(null);
  };

  const startPublish = () => {
    if (errs.length || busy) return;
    if (form.forceUpdateEnabled) {
      setConfirmPublish(true);
    } else {
      publishMutation.mutate();
    }
  };

  const lastPublished = formatAuditDate(data?.live.updatedAt);
  const auditLine = lastPublished
    ? `Last published ${lastPublished} by ${data?.live.updatedBy || 'unknown'}`
    : 'Not published from this screen yet';

  const previewVersion = form.minimumRequiredVersion || '—';
  const mode = form.forceUpdateEnabled ? 'Forced' : form.optionalUpdatePromptEnabled ? 'Optional' : 'Off';

  return (
    <div className="rm-scope -m-4 sm:-m-6">
      {/* ── Header band ── */}
      <div className="ra-top">
        <div className="wrap">
          <div className="ra-topbar">
            <img className="logo" src={sgLogo} alt="SimpleGolf" />
            <span className="lbl">Admin · Release manager</span>
            <span className="sp" />
            <span className="who">
              <span className="avatar">{initialsOf(adminUser?.name)}</span>
              {adminUser?.name ?? adminEmail} · Release admin
            </span>
          </div>
          <div className="ra-head">
            <div>
              <h1>App update prompt</h1>
              <p>
                Controls what every golfer on an older build sees when they open the app.
                Changes take effect on their next foreground check — no app release needed.
              </p>
            </div>
            <div className="ra-live">
              <div>
                <div className="k">Live now</div>
                <div className="v num">{data?.live.minimumRequiredVersion || '—'}</div>
              </div>
              <div>
                <div className="k">Editing</div>
                <div className="v num">{form.minimumRequiredVersion || '—'}</div>
              </div>
              <div>
                <div className="k">Mode</div>
                <div className={'v' + (form.forceUpdateEnabled ? ' on' : '')}>{mode}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="wrap ra-main">
        <div>
          {isLoading ? (
            <>
              <SkeletonCard rows={3} />
              <SkeletonCard rows={5} />
            </>
          ) : loadError ? (
            <div className="ra-card">
              <div className="bd">
                <div className="ra-val bad">
                  <strong>Couldn't load the {platformLabel} config</strong>
                  <ul><li>{serverErrorMessage(loadError)}</li></ul>
                </div>
                <div style={{ paddingTop: 12 }}>
                  <button type="button" className="btn ghost" onClick={() => refetch()}>Try again</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="ra-card">
                <div className="hd"><span className="t">Version gate</span><span className="s">Who sees the prompt</span></div>
                <div className="bd">
                  <div className="ra-grid2" style={{ marginBottom: 14 }}>
                    <Field label="Platform">
                      <select
                        className="ra-in"
                        value={platform}
                        onChange={(e) => requestPlatformSwitch(e.target.value as ReleasePlatform)}
                      >
                        <option value="ios">iOS</option>
                        <option value="android">Android</option>
                      </select>
                    </Field>
                    <Field label="Minimum required version">
                      <input
                        className={'ra-in mono' + (VERSION_RE.test(form.minimumRequiredVersion) ? '' : ' err')}
                        value={form.minimumRequiredVersion}
                        onChange={(e) => set('minimumRequiredVersion', e.target.value)}
                        placeholder="2.4.0"
                      />
                    </Field>
                  </div>
                  <SwitchRow
                    on={form.forceUpdateEnabled}
                    onChange={(v) => set('forceUpdateEnabled', v)}
                    danger
                    title="Force update — blocks the app"
                    detail="No Later button. Golfers can't start a round until they update. Use only when an older build is genuinely broken."
                  />
                  <SwitchRow
                    on={form.optionalUpdatePromptEnabled}
                    onChange={(v) => set('optionalUpdatePromptEnabled', v)}
                    title="Optional prompt — dismissible"
                    detail="Later hides it until the next major.minor version, so it won't nag on every patch."
                  />
                </div>
              </div>

              <div className="ra-card">
                <div className="hd">
                  <span className="t">What's new</span>
                  <span className="ra-tier">Tier {tier.n} · {tier.name}</span>
                </div>
                <div className="bd">
                  <div style={{ marginBottom: 20 }}>
                    <div className="sec-title" style={{ marginBottom: 9 }}>
                      Features <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· icon + title + one line</span>
                    </div>
                    <FeatureEditor items={form.features} onChange={(v) => set('features', v)} />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <div className="sec-title" style={{ marginBottom: 9 }}>
                      Ticked fix rows <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· Tier 1, when there are no features</span>
                    </div>
                    <LineEditor
                      items={form.fixRows}
                      onChange={(v) => set('fixRows', v)}
                      max={LIMITS.fixRows}
                      placeholder="Leaderboard keeps your position when you rejoin a round"
                      addLabel="Add fix row"
                      empty="Empty — only used when a release has no features to show."
                    />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <div className="sec-title" style={{ marginBottom: 9 }}>
                      Plain fix lines <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· shown under features</span>
                    </div>
                    <LineEditor
                      items={form.fixes}
                      onChange={(v) => set('fixes', v)}
                      max={LIMITS.fixes}
                      placeholder="Putts now save if the app is backgrounded mid-hole"
                      addLabel="Add fix line"
                      empty="Optional — small print under the feature rows."
                    />
                  </div>
                  <Field label="Footnote">
                    <input
                      className="ra-in"
                      value={form.footnote}
                      onChange={(e) => set('footnote', e.target.value)}
                      placeholder="Plus scorecard fixes and speed improvements."
                    />
                  </Field>
                </div>
              </div>

              <div className="ra-card">
                <div className="hd"><span className="t">Fallback message</span><span className="s">Older builds show only this</span></div>
                <div className="bd">
                  <Field label="Update message" count={form.updateMessage.length} max={LIMITS.message}>
                    <textarea
                      className={'ra-in' + (form.updateMessage.length > LIMITS.message ? ' err' : '')}
                      value={form.updateMessage}
                      onChange={(e) => set('updateMessage', e.target.value)}
                    />
                  </Field>
                  <div className="ra-empty" style={{ paddingTop: 10 }}>
                    Builds shipped before the tiered card can't render feature rows, so they fall back to this string.
                    Keep it true for every release.
                  </div>
                </div>
              </div>

              <div className="ra-card">
                <div className="bd">
                  {draftExists && (
                    <div className="ra-val draft">
                      <strong>Unpublished draft</strong> — this form shows staged {platformLabel} changes that are not live.
                      Publish to make them live.
                    </div>
                  )}
                  {saveError && (
                    <div className="ra-val bad" style={{ marginBottom: 10 }}>
                      <strong>Save failed</strong>
                      <ul><li>{saveError}</li></ul>
                    </div>
                  )}
                  <div className={'ra-val ' + (errs.length ? 'bad' : 'ok')}>
                    {errs.length ? (
                      <>
                        <strong>{errs.length} problem{errs.length > 1 ? 's' : ''} to fix before publishing</strong>
                        <ul>{errs.map((e) => <li key={e}>{e}</li>)}</ul>
                      </>
                    ) : (
                      <strong>✓ Ready to publish — Tier {tier.n}, {tier.name.toLowerCase()}</strong>
                    )}
                    {warns.length > 0 && (
                      <ul style={{ marginTop: 8, opacity: .95 }}>{warns.map((w) => <li key={w}>⚠ {w}</li>)}</ul>
                    )}
                  </div>
                </div>
                <div className="ra-actions">
                  <span className="audit">{auditLine}</span>
                  <span className="sp" />
                  {saved && <span className="ra-saved">✓ {saved}</span>}
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => draftMutation.mutate()}
                    disabled={busy}
                  >
                    {draftMutation.isPending ? 'Saving…' : 'Save draft'}
                  </button>
                  <button
                    type="button"
                    className="btn blue"
                    disabled={errs.length > 0 || busy}
                    onClick={startPublish}
                  >
                    {publishMutation.isPending ? 'Publishing…' : 'Publish'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Right rail ── */}
        <div className="ra-rail">
          <div className="ra-card ra-preview">
            <div className="ra-pvhead">
              <span className="sec-title">Live preview</span>
              <div className="seg mini">
                <button
                  type="button"
                  className={!form.forceUpdateEnabled ? 'on' : ''}
                  onClick={() => {
                    setForm((prev) => ({ ...prev, forceUpdateEnabled: false, optionalUpdatePromptEnabled: true }));
                    setSaved(null);
                    setSaveError(null);
                  }}
                >
                  Optional
                </button>
                <button
                  type="button"
                  className={form.forceUpdateEnabled ? 'on' : ''}
                  onClick={() => set('forceUpdateEnabled', true)}
                >
                  Forced
                </button>
              </div>
            </div>
            {isLoading ? (
              <div className="ra-skel" style={{ width: 310, height: 560, borderRadius: 40 }} />
            ) : (
              <UpdatePromptPreview
                isRequired={form.forceUpdateEnabled}
                version={previewVersion}
                headline={headline}
                message={form.updateMessage}
                features={form.features}
                fixRows={form.fixRows}
                fixes={form.fixes}
                footnote={form.footnote}
              />
            )}
          </div>
          <div className="ra-card">
            <div className="hd" style={{ cursor: 'pointer' }} onClick={() => setShowJson((s) => !s)}>
              <span className="t">Config payload</span>
              <span className="s">{showJson ? 'Hide ▲' : 'Show ▼'}</span>
            </div>
            {showJson && (
              <div className="bd">
                <pre className="ra-json">{JSON.stringify(payload, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Reference: what has to change to run this ── */}
      <div className="ra-spec">
        <h2>What has to change to run this</h2>
        <p className="sub">Everything below is additive — omit the new fields and the app behaves exactly as it does today.</p>
        <table className="ra-t">
          <thead><tr><th>Where</th><th>Change</th><th>Effort</th></tr></thead>
          <tbody>
            <tr>
              <td className="w">Mongo — <code>mobileAppVersion</code></td>
              <td>Optional <code>features[]</code> (<code>icon</code>, <code>title</code>, <code>detail</code>), <code>fixRows[]</code>, <code>fixes[]</code>, <code>footnote</code> on each platform config, plus audit fields <code>updatedBy</code>, <code>updatedAt</code> and a <code>draft</code> sub-document so a release can be staged before publishing.</td>
              <td><span className="ra-eff s">Done</span></td>
            </tr>
            <tr>
              <td className="w">Admin API</td>
              <td><code>GET</code> / <code>PUT /mobileAppVersionConfig/admin/:platform</code>, role-gated to release admins. Server-side validation of the same limits this screen enforces, so a bad payload can't reach a phone.</td>
              <td><span className="ra-eff s">Done</span></td>
            </tr>
            <tr>
              <td className="w">Public config endpoint</td>
              <td>Returns the new fields on the existing platform-config response. No shape change — the mobile decoders ignore what they don't know, so older builds are unaffected.</td>
              <td><span className="ra-eff s">Done</span></td>
            </tr>
            <tr>
              <td className="w">iOS app</td>
              <td>Decode the new arrays in <code>MobileAppVersionPlatformConfig</code>; replace <code>ForceUpdateView</code>'s body with the tiered card. <code>UpdateManager</code> logic is unchanged — same version compare, same dismissal bucket.</td>
              <td><span className="ra-eff m">Medium</span></td>
            </tr>
            <tr>
              <td className="w">Android app</td>
              <td>Same card in Compose against the same config, so one edit here covers both platforms.</td>
              <td><span className="ra-eff m">Medium</span></td>
            </tr>
            <tr>
              <td className="w">Release process</td>
              <td>One step added to the checklist: fill this in, publish, check it on a device. Copy changes never need an app release.</td>
              <td><span className="ra-eff s">Small</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingPlatform !== null}
        title="Discard unsaved changes?"
        message={`You have unsaved ${platformLabel} changes. Switching platform will discard them.`}
        confirmLabel="Discard and switch"
        cancelLabel="Keep editing"
        variant="warning"
        onConfirm={() => {
          if (pendingPlatform) switchPlatform(pendingPlatform);
          setPendingPlatform(null);
        }}
        onCancel={() => setPendingPlatform(null)}
      />

      <ConfirmDialog
        open={confirmPublish}
        title={`Force update — ${platformLabel}`}
        message={`This publishes with force update ON. Every golfer on a ${platformLabel} build older than ${form.minimumRequiredVersion || '?'} will be locked out of the app until they update. Publish?`}
        confirmLabel={`Publish to ${platformLabel}`}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setConfirmPublish(false);
          publishMutation.mutate();
        }}
        onCancel={() => setConfirmPublish(false)}
      />
    </div>
  );
}
