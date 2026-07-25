// Feature icons for the Release Manager — 17×17 currentColor strokes matching
// the design handoff. The value stored in the config is the SF Symbol name;
// these web icons are only the admin-side preview of what the app renders.

export type FeatureIconKey =
  | 'flag'
  | 'chart'
  | 'down'
  | 'bolt'
  | 'person'
  | 'bell'
  | 'wrench'
  | 'check';

const iconProps = {
  width: 17,
  height: 17,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const FEATURE_ICONS: Record<FeatureIconKey, React.ReactNode> = {
  flag: <svg {...iconProps}><path d="M5 21V4m0 0 12 3-4 4 4 4-12 3" /></svg>,
  chart: <svg {...iconProps}><path d="M4 20h16M7 16v-5M12 16V6M17 16v-8" /></svg>,
  down: <svg {...iconProps}><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg>,
  bolt: <svg {...iconProps}><path d="M13 2 5 14h6l-1 8 8-12h-6l1-8Z" /></svg>,
  wrench: <svg {...iconProps}><path d="M14.5 6.5a3.5 3.5 0 0 0 4.6 4.6L21 13l-8 8-2-2 1.9-1.9a3.5 3.5 0 0 1-4.6-4.6L5 10l2-2Z" /></svg>,
  check: <svg {...iconProps}><path d="M20 6 9 17l-5-5" /></svg>,
  person: <svg {...iconProps}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /></svg>,
  bell: <svg {...iconProps}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0" /></svg>,
};

// Editor key → SF Symbol name shipped in the config (keep this mapping intact —
// the SF Symbol string is what the mobile apps render).
export const ICON_TO_SF: Record<FeatureIconKey, string> = {
  flag: 'flag.fill',
  chart: 'chart.bar.fill',
  down: 'arrow.down.circle.fill',
  bolt: 'bolt.fill',
  person: 'person.2.fill',
  bell: 'bell.badge.fill',
  wrench: 'wrench.fill',
  check: 'checkmark.circle.fill',
};

export const SF_TO_ICON: Record<string, FeatureIconKey> = Object.fromEntries(
  (Object.entries(ICON_TO_SF) as [FeatureIconKey, string][]).map(([key, sf]) => [sf, key]),
);

export const ICON_OPTIONS: { value: FeatureIconKey; label: string }[] = [
  { value: 'flag', label: 'Flag — on-course' },
  { value: 'chart', label: 'Chart — stats' },
  { value: 'down', label: 'Download — export' },
  { value: 'bolt', label: 'Bolt — speed' },
  { value: 'person', label: 'People — social' },
  { value: 'bell', label: 'Bell — alerts' },
  { value: 'wrench', label: 'Wrench — under the hood' },
  { value: 'check', label: 'Tick — fixed' },
];
