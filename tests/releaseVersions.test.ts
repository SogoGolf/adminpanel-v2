import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { editingVersionRows, liveVersionRows } from '../src/utils/releaseVersions.ts';

describe('liveVersionRows', () => {
  it('labels each platform with its own version', () => {
    assert.deepEqual(liveVersionRows('3.8.0', '3.8.1'), [
      { platform: 'iOS', version: '3.8.0' },
      { platform: 'Android', version: '3.8.1' },
    ]);
  });

  it('still lists both platforms when they are on the same version', () => {
    assert.deepEqual(liveVersionRows('3.8.1', '3.8.1'), [
      { platform: 'iOS', version: '3.8.1' },
      { platform: 'Android', version: '3.8.1' },
    ]);
  });

  it('shows a dash for a missing version', () => {
    assert.deepEqual(liveVersionRows(undefined, null), [
      { platform: 'iOS', version: '—' },
      { platform: 'Android', version: '—' },
    ]);
  });

  it('shows a dash for an empty or blank version and trims others', () => {
    assert.deepEqual(liveVersionRows('', '  3.9.0 '), [
      { platform: 'iOS', version: '—' },
      { platform: 'Android', version: '3.9.0' },
    ]);
    assert.deepEqual(liveVersionRows('   ', '3.8.1'), [
      { platform: 'iOS', version: '—' },
      { platform: 'Android', version: '3.8.1' },
    ]);
  });
});

describe('editingVersionRows', () => {
  it('both platforms: iOS from minimumRequiredVersion, Android from androidMinimumRequiredVersion', () => {
    assert.deepEqual(editingVersionRows('both', '3.8.0', '3.8.1'), [
      { platform: 'iOS', version: '3.8.0' },
      { platform: 'Android', version: '3.8.1' },
    ]);
  });

  it('iOS only: one iOS row from minimumRequiredVersion, ignoring the Android field', () => {
    assert.deepEqual(editingVersionRows('ios', '3.8.0', '9.9.9'), [
      { platform: 'iOS', version: '3.8.0' },
    ]);
  });

  it('Android only: one Android row from minimumRequiredVersion, ignoring the Android field', () => {
    assert.deepEqual(editingVersionRows('android', '3.8.1', '9.9.9'), [
      { platform: 'Android', version: '3.8.1' },
    ]);
  });

  it('single platform with no version shows a dash', () => {
    assert.deepEqual(editingVersionRows('android', '', ''), [
      { platform: 'Android', version: '—' },
    ]);
    assert.deepEqual(editingVersionRows('ios', undefined, undefined), [
      { platform: 'iOS', version: '—' },
    ]);
  });

  it('both platforms with one version missing', () => {
    assert.deepEqual(editingVersionRows('both', '3.8.0', ''), [
      { platform: 'iOS', version: '3.8.0' },
      { platform: 'Android', version: '—' },
    ]);
  });
});
