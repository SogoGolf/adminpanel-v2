import type { ReleaseTarget } from '../types';

/** One row of the Release Manager header tiles: a platform name and its minimum version. */
export interface PlatformVersionRow {
  platform: 'iOS' | 'Android';
  version: string;
}

const EMPTY_VERSION = '—';

function show(version: string | null | undefined): string {
  const trimmed = (version ?? '').trim();
  return trimmed === '' ? EMPTY_VERSION : trimmed;
}

/**
 * "Live now" always lists both platforms, whichever one is being edited,
 * so it is clear which platform is on which version.
 */
export function liveVersionRows(
  iosVersion: string | null | undefined,
  androidVersion: string | null | undefined
): PlatformVersionRow[] {
  return [
    { platform: 'iOS', version: show(iosVersion) },
    { platform: 'Android', version: show(androidVersion) },
  ];
}

/**
 * "Editing" lists the platform(s) the form will publish to. For a single platform the
 * form keeps that platform's version in `minimumRequiredVersion`; for both, iOS is in
 * `minimumRequiredVersion` and Android in `androidMinimumRequiredVersion`.
 */
export function editingVersionRows(
  target: ReleaseTarget,
  minimumRequiredVersion: string | null | undefined,
  androidMinimumRequiredVersion: string | null | undefined
): PlatformVersionRow[] {
  if (target === 'ios') return [{ platform: 'iOS', version: show(minimumRequiredVersion) }];
  if (target === 'android') return [{ platform: 'Android', version: show(minimumRequiredVersion) }];
  return liveVersionRows(minimumRequiredVersion, androidMinimumRequiredVersion);
}
