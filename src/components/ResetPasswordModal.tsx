import { useState } from 'react';
import type { FormEvent } from 'react';
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '../utils/passwordReset';

export interface ResetPasswordModalProps {
  userName: string;
  userEmail: string;
  isSelf: boolean; // true when the signed-in admin is resetting their own password
  isSaving: boolean; // request in flight
  serverError: string | null;
  onClose: () => void;
  onSubmit: (newPassword: string) => void;
}

// Dialog for a Super Admin to set another Super Admin's (or their own) password, with a confirm field and show/hide toggles.
export function ResetPasswordModal({ userName, userEmail, isSelf, isSaving, serverError, onClose, onSubmit }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const shownError = localError ?? serverError;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validateNewPassword(password, confirm);
    if (problem) {
      setLocalError(problem);
      return;
    }
    setLocalError(null);
    onSubmit(password);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="reset-password-title" className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 id="reset-password-title" className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Reset Password</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Set a new password for {userName} ({userEmail}).</p>
          {isSelf && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-2 rounded text-sm mb-4">
              This is your own account. You'll be signed out after the change and will need to sign in with the new password.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {shownError !== null && (
              <div role="alert" className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-2 rounded text-sm">{shownError}</div>
            )}
            <div>
              <label htmlFor="reset-new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New password</label>
              <div className="relative">
                <input
                  id="reset-new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setLocalError(null);
                  }}
                  disabled={isSaving}
                  className="w-full pl-3 pr-16 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  aria-label="Show new password"
                  className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">At least {MIN_PASSWORD_LENGTH} characters.</p>
            </div>
            <div>
              <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm new password</label>
              <div className="relative">
                <input
                  id="reset-confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setLocalError(null);
                  }}
                  disabled={isSaving}
                  className="w-full pl-3 pr-16 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-pressed={showConfirm}
                  aria-label="Show confirm password"
                  className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {showConfirm ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                Reset Password
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
