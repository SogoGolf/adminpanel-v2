import type { TodayVersionCount } from '../types';

/** One chip under the Rounds page's "today" counts. */
export interface VersionChip {
  /** Unique within one list: `${platform}|${version}` with platform lower-cased, e.g. "android|3.8.1 (39)". */
  key: string;
  platformLabel: 'iOS' | 'Android';
  version: string;
  count: number;
}

type PlatformCode = 'ios' | 'android';

interface ReadEntry {
  platform: PlatformCode;
  version: string;
  count: number;
}

/** Normalises a platform to 'ios' or 'android', or returns null when it is neither. */
function platformCode(platform: unknown): PlatformCode | null {
  if (typeof platform !== 'string') return null;
  const code = platform.trim().toLowerCase();
  if (code === 'ios') return 'ios';
  if (code === 'android') return 'android';
  return null;
}

function labelOf(code: PlatformCode): VersionChip['platformLabel'] {
  return code === 'ios' ? 'iOS' : 'Android';
}

/** Returns the trimmed version label, or null when it is missing or blank. */
function versionLabel(version: unknown): string | null {
  if (typeof version !== 'string') return null;
  const trimmed = version.trim();
  return trimmed === '' ? null : trimmed;
}

/** Reads one API entry, or returns null when it is not a usable row. */
function readEntry(entry: unknown): ReadEntry | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const fields = entry as { platform?: unknown; version?: unknown; count?: unknown };
  const platform = platformCode(fields.platform);
  const version = versionLabel(fields.version);
  const count = fields.count;
  if (platform === null || version === null) return null;
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return null;
  return { platform, version, count };
}

/** Turns one of the API's today-by-version lists into chips, keeping the API's order. */
export function versionChips(list: readonly TodayVersionCount[] | null | undefined): VersionChip[] {
  if (!Array.isArray(list)) return [];
  // A Map keeps insertion order, so a repeated key adds to its first chip without moving it.
  const chipsByKey = new Map<string, VersionChip>();
  for (const entry of list as readonly unknown[]) {
    const row = readEntry(entry);
    if (row === null) continue;
    const key = `${row.platform}|${row.version}`;
    const existing = chipsByKey.get(key);
    if (existing) {
      existing.count += row.count;
      continue;
    }
    chipsByKey.set(key, {
      key,
      platformLabel: labelOf(row.platform),
      version: row.version,
      count: row.count,
    });
  }
  return [...chipsByKey.values()];
}
