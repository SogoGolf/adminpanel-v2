import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { versionChips } from '../src/utils/todayVersionChips.ts';
import type { TodayVersionCount } from '../src/types/index.ts';

describe('versionChips', () => {
  it('returns an empty list for null, undefined and non-array values', () => {
    assert.deepEqual(versionChips(null), []);
    assert.deepEqual(versionChips(undefined), []);
    assert.deepEqual(versionChips({} as never), []);
    assert.deepEqual(versionChips('x' as never), []);
  });

  it('returns an empty list for an empty array', () => {
    assert.deepEqual(versionChips([]), []);
  });

  it('keeps the API order and labels the platforms, using a real prod snapshot', () => {
    const input: TodayVersionCount[] = [
      { platform: 'ios', version: '3.8.0 (37)', count: 107 },
      { platform: 'android', version: '3.8.1 (39)', count: 9 },
      { platform: 'android', version: '3.8.0 (37)', count: 37 },
    ];
    assert.deepEqual(versionChips(input), [
      { key: 'ios|3.8.0 (37)', platformLabel: 'iOS', version: '3.8.0 (37)', count: 107 },
      { key: 'android|3.8.1 (39)', platformLabel: 'Android', version: '3.8.1 (39)', count: 9 },
      { key: 'android|3.8.0 (37)', platformLabel: 'Android', version: '3.8.0 (37)', count: 37 },
    ]);
  });

  it('does not re-sort: android first stays android first', () => {
    const input: TodayVersionCount[] = [
      { platform: 'android', version: '3.8.1 (39)', count: 2 },
      { platform: 'ios', version: '3.8.0 (37)', count: 5 },
    ];
    assert.deepEqual(versionChips(input), [
      { key: 'android|3.8.1 (39)', platformLabel: 'Android', version: '3.8.1 (39)', count: 2 },
      { key: 'ios|3.8.0 (37)', platformLabel: 'iOS', version: '3.8.0 (37)', count: 5 },
    ]);
  });

  it('matches the platform case-insensitively and ignores surrounding spaces', () => {
    assert.deepEqual(versionChips([{ platform: ' Android ', version: '3.8.1 (39)', count: 1 }]), [
      { key: 'android|3.8.1 (39)', platformLabel: 'Android', version: '3.8.1 (39)', count: 1 },
    ]);
    assert.deepEqual(versionChips([{ platform: 'IOS', version: '3.8.1 (39)', count: 1 }]), [
      { key: 'ios|3.8.1 (39)', platformLabel: 'iOS', version: '3.8.1 (39)', count: 1 },
    ]);
  });

  it('trims the version, including in the key', () => {
    assert.deepEqual(versionChips([{ platform: 'ios', version: '  3.8.0 (37) ', count: 3 }]), [
      { key: 'ios|3.8.0 (37)', platformLabel: 'iOS', version: '3.8.0 (37)', count: 3 },
    ]);
  });

  it('keeps "Unknown" as a normal version', () => {
    assert.deepEqual(versionChips([{ platform: 'ios', version: 'Unknown', count: 2 }]), [
      { key: 'ios|Unknown', platformLabel: 'iOS', version: 'Unknown', count: 2 },
    ]);
  });

  describe('skips bad entries', () => {
    const good: TodayVersionCount = { platform: 'android', version: '3.8.1 (39)', count: 4 };
    const goodChip = {
      key: 'android|3.8.1 (39)',
      platformLabel: 'Android',
      version: '3.8.1 (39)',
      count: 4,
    };

    const badEntries: [string, unknown][] = [
      ['platform web', { platform: 'web', version: '3.8.0 (37)', count: 1 }],
      ['platform missing', { version: '3.8.0 (37)', count: 1 }],
      ['version empty', { platform: 'ios', version: '', count: 1 }],
      ['version blank', { platform: 'ios', version: '   ', count: 1 }],
      ['version not a string', { platform: 'ios', version: 5, count: 1 }],
      ['count 0', { platform: 'ios', version: '3.8.0 (37)', count: 0 }],
      ['count -1', { platform: 'ios', version: '3.8.0 (37)', count: -1 }],
      ['count NaN', { platform: 'ios', version: '3.8.0 (37)', count: NaN }],
      ['count Infinity', { platform: 'ios', version: '3.8.0 (37)', count: Infinity }],
      ['count as a string', { platform: 'ios', version: '3.8.0 (37)', count: '3' }],
      ['null entry', null],
    ];

    for (const [label, bad] of badEntries) {
      it(`skips ${label} and keeps the good entry`, () => {
        assert.deepEqual(versionChips([bad as never, good]), [goodChip]);
        assert.deepEqual(versionChips([good, bad as never]), [goodChip]);
      });
    }
  });

  describe('merges duplicates', () => {
    it('merges duplicate platform+version entries into the first position, adding counts', () => {
      const input: TodayVersionCount[] = [
        { platform: 'ios', version: '3.8.0 (37)', count: 5 },
        { platform: 'android', version: '3.8.1 (39)', count: 1 },
        { platform: 'ios', version: '3.8.0 (37)', count: 2 },
      ];
      assert.deepEqual(versionChips(input), [
        { key: 'ios|3.8.0 (37)', platformLabel: 'iOS', version: '3.8.0 (37)', count: 7 },
        { key: 'android|3.8.1 (39)', platformLabel: 'Android', version: '3.8.1 (39)', count: 1 },
      ]);
    });

    it('merges " iOS " and "ios" with the same version', () => {
      const input: TodayVersionCount[] = [
        { platform: ' iOS ', version: '3.8.0 (37)', count: 5 },
        { platform: 'ios', version: '3.8.0 (37)', count: 2 },
      ];
      assert.deepEqual(versionChips(input), [
        { key: 'ios|3.8.0 (37)', platformLabel: 'iOS', version: '3.8.0 (37)', count: 7 },
      ]);
    });
  });

  it('does not mutate the input', () => {
    const input: TodayVersionCount[] = [
      { platform: ' iOS ', version: '  3.8.0 (37) ', count: 5 },
      { platform: 'ios', version: '3.8.0 (37)', count: 2 },
      { platform: 'android', version: '3.8.1 (39)', count: 1 },
    ];
    const copy = structuredClone(input);
    versionChips(input);
    assert.deepEqual(input, copy);
  });
});
