import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, validateNewPassword } from '../src/utils/passwordReset.ts';

describe('validateNewPassword', () => {
  it('rejects an empty password and empty confirmation', () => {
    assert.equal(validateNewPassword('', ''), 'Enter a new password.');
  });

  it('rejects an empty password even when the confirmation is filled in', () => {
    assert.equal(validateNewPassword('', 'something'), 'Enter a new password.');
  });

  it('rejects a password made only of spaces', () => {
    assert.equal(validateNewPassword('        ', '        '), 'Password cannot be only spaces.');
  });

  it('rejects a password shorter than the minimum length', () => {
    assert.equal(validateNewPassword('1234567', '1234567'), 'Password must be at least 8 characters.');
  });

  it('accepts a password of exactly the minimum length', () => {
    assert.equal(validateNewPassword('12345678', '12345678'), null);
  });

  it('accepts a password of exactly the maximum length', () => {
    assert.equal(validateNewPassword('x'.repeat(128), 'x'.repeat(128)), null);
  });

  it('rejects a password longer than the maximum length', () => {
    assert.equal(validateNewPassword('x'.repeat(129), 'x'.repeat(129)), 'Password must be 128 characters or fewer.');
  });

  it('asks for confirmation when the confirm field is empty', () => {
    assert.equal(validateNewPassword('goodpassword', ''), 'Confirm the new password.');
  });

  it('rejects a confirmation that differs in characters', () => {
    assert.equal(validateNewPassword('goodpassword', 'goodpasswrd'), 'Passwords do not match.');
  });

  it('rejects a confirmation that differs only in letter case', () => {
    assert.equal(validateNewPassword('goodpassword', 'GoodPassword'), 'Passwords do not match.');
  });

  it('rejects a confirmation with a trailing space (no trimming)', () => {
    assert.equal(validateNewPassword('goodpassword', 'goodpassword '), 'Passwords do not match.');
  });

  it('allows leading and trailing spaces when both fields match', () => {
    assert.equal(validateNewPassword(' padded pass ', ' padded pass '), null);
  });

  it('checks length before the match check', () => {
    assert.equal(validateNewPassword('short', 'different'), 'Password must be at least 8 characters.');
  });

  it('keeps the length limits equal to the API limits', () => {
    assert.equal(MIN_PASSWORD_LENGTH, 8);
    assert.equal(MAX_PASSWORD_LENGTH, 128);
  });
});
