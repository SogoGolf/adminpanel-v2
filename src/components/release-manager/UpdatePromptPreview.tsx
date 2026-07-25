import { useEffect, useRef, useState } from 'react';
import { FEATURE_ICONS, type FeatureIconKey } from './icons';
import sgLogo from '../../assets/simple_golf_logo.png';

export interface PreviewFeature {
  icon: FeatureIconKey;
  title: string;
  detail: string;
}

// ── iPhone bezel: simplified frame with dynamic island, status bar and home indicator ──
function PhoneFrame({ children, width = 360, height = 780 }: {
  children: React.ReactNode;
  width?: number;
  height?: number;
}) {
  const c = '#fff';
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 48,
        overflow: 'hidden',
        position: 'relative',
        background: '#000',
        boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
      }}
    >
      {/* dynamic island */}
      <div
        style={{
          position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
          width: 126, height: 37, borderRadius: 24, background: '#000', zIndex: 50,
        }}
      />
      {/* status bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '21px 24px 19px' }}>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontWeight: 590, fontSize: 17, lineHeight: '22px', color: c }}>9:41</span>
          </div>
          <div style={{ width: 126 }} />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <svg width="19" height="12" viewBox="0 0 19 12">
              <rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill={c} />
              <rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill={c} />
              <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill={c} />
              <rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill={c} />
            </svg>
            <svg width="27" height="13" viewBox="0 0 27 13">
              <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke={c} strokeOpacity="0.35" fill="none" />
              <rect x="2" y="2" width="20" height="9" rx="2" fill={c} />
              <path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill={c} fillOpacity="0.4" />
            </svg>
          </div>
        </div>
      </div>
      <div style={{ height: '100%' }}>{children}</div>
      {/* home indicator */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 60, height: 34,
          display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
          paddingBottom: 8, pointerEvents: 'none',
        }}
      >
        <div style={{ width: 139, height: 5, borderRadius: 100, background: 'rgba(255,255,255,0.7)' }} />
      </div>
    </div>
  );
}

// Home screen facsimile behind the prompt (blurred, matches the app's Home)
function HomeBehind() {
  return (
    <div className="u-home" aria-hidden="true">
      <div className="u-burger"><i /><i /><i /></div>
      <img className="logo-lg" src={sgLogo} alt="" />
      <div className="lets">
        <h2>Let's Play</h2>
        <p>Start a competition round, or open Leaderboards &amp; Stats for your rankings and round history</p>
      </div>
      <div className="btn-y">Start Home Club Competition Round</div>
      <div className="btn-o"><span className="tr">🏆</span> Leaderboards &amp; Stats</div>
      <img className="logo-sm" src={sgLogo} alt="" />
    </div>
  );
}

function FeatureList({ features }: { features: PreviewFeature[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () =>
      setMore(el.scrollHeight - el.clientHeight > 4 && el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    check();
    el.addEventListener('scroll', check);
    return () => el.removeEventListener('scroll', check);
  }, [features]);

  return (
    <>
      <div className={'u-feats' + (more ? ' scrolls' : '')} ref={ref}>
        {features.map((f, n) => (
          <div className="u-feat" key={f.title + n}>
            <span className="ic">{FEATURE_ICONS[f.icon] ?? FEATURE_ICONS.flag}</span>
            <span className="tx">
              <span className="ft">{f.title || 'Feature title'}</span>
              <div className="fd">{f.detail || 'One line describing what changed.'}</div>
            </span>
          </div>
        ))}
      </div>
      {more && <div className="u-scrollcue">Scroll for more ↓</div>}
    </>
  );
}

// The tiered "What's New" card — sections collapse when the config is thin.
export function WhatsNewCard({ isRequired, version, headline, message, features, fixRows, fixes, footnote }: {
  isRequired: boolean;
  version: string;
  headline: string;
  message: string;
  features: PreviewFeature[];
  fixRows: string[];
  fixes: string[];
  footnote: string;
}) {
  const thin = !features.length && !fixRows.length;
  return (
    <div className="u-scrim">
      <div className={'u-card ' + (thin ? 'tight' : '')} role="dialog" aria-modal="true">
        <div className="u-title">{headline}</div>
        <span className="u-vpill">VERSION {version}</span>
        {thin && message && <p className="u-msg">{message}</p>}
        {features.length > 0 && <FeatureList features={features} />}
        {fixRows.length > 0 && (
          <div className="u-feats">
            {fixRows.map((f, n) => (
              <div className="u-feat one" key={f + n}>
                <span className="ic">{FEATURE_ICONS.check}</span>
                <span className="tx"><span className="ft">{f || 'Fix description'}</span></span>
              </div>
            ))}
          </div>
        )}
        {fixes.length > 0 && (
          <div className="u-fixes">
            {fixes.map((f, n) => (
              <div className="u-fix" key={f + n}><span className="b">—</span><span>{f}</span></div>
            ))}
          </div>
        )}
        <div className="u-btns">
          {!isRequired && <button type="button" className="u-btn sec">Later</button>}
          <button type="button" className="u-btn pri">Update</button>
        </div>
        {footnote && <div className="u-foot">{footnote}</div>}
      </div>
    </div>
  );
}

export function UpdatePromptPreview(props: {
  isRequired: boolean;
  version: string;
  headline: string;
  message: string;
  features: PreviewFeature[];
  fixRows: string[];
  fixes: string[];
  footnote: string;
}) {
  return (
    <div className="ra-scale">
      <PhoneFrame width={360} height={780}>
        <div className="u-screen">
          <HomeBehind />
          <WhatsNewCard {...props} />
        </div>
      </PhoneFrame>
    </div>
  );
}
