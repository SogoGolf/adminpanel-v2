// Rules for the Admin Users "Reset Password" dialog. The API (POST /admin/users/{id}/password)
// enforces the same length limits, so keep these two numbers in step with it.
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

// Returns the first problem with the new password and its confirmation, or null when both are fine.
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password === '') return 'Enter a new password.';
  if (password.trim() === '') return 'Password cannot be only spaces.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  }
  if (confirm === '') return 'Confirm the new password.';
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}
