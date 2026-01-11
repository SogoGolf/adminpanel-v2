import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getNotificationAudienceCount, sendNotification } from '../api/mongodb';
import type { AudienceCountResponse, SendNotificationResponse } from '../api/mongodb';
import { ConfirmDialog } from '../components/ConfirmDialog';

type AudienceType = 'rounds-in-progress' | 'gender' | 'club' | 'state' | 'single';

const stateOptions = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
const genderOptions = [
  { value: 'm', label: 'Male' },
  { value: 'f', label: 'Female' },
];

interface NotificationFormState {
  audienceType: AudienceType;
  gender: string;
  clubId: string;
  state: string;
  golflinkNo: string;
  title: string;
  message: string;
}

const initialFormState: NotificationFormState = {
  audienceType: 'rounds-in-progress',
  gender: '',
  clubId: '',
  state: '',
  golflinkNo: '',
  title: '',
  message: '',
};

export function Notifications() {
  const { user, adminUser } = useAuth();
  const [form, setForm] = useState<NotificationFormState>(initialFormState);
  const [audienceResult, setAudienceResult] = useState<AudienceCountResponse | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [sendResult, setSendResult] = useState<SendNotificationResponse | null>(null);

  const clubIds = adminUser?.clubIds;
  const requestingUserEmail = user?.email || '';
  const isSuperAdmin = adminUser?.role === 'super_admin';

  // Check if golflinkNo belongs to one of the admin's clubs
  const isGolferInAdminClubs = (golflinkNo: string): boolean => {
    if (isSuperAdmin) return true;
    if (!clubIds || clubIds.length === 0) return false;

    // Club ID is the prefix of golflinkNo (padded to 5 digits)
    const clubPrefixes = clubIds.map(id => id.padStart(5, '0'));
    return clubPrefixes.some(prefix => golflinkNo.startsWith(prefix));
  };

  const golferClubError = form.audienceType === 'single' && form.golflinkNo && !isSuperAdmin && !isGolferInAdminClubs(form.golflinkNo)
    ? 'This golfer is not from your club. You can only send notifications to golfers from your assigned clubs.'
    : null;

  const audienceCountMutation = useMutation({
    mutationFn: () => getNotificationAudienceCount({
      audienceType: form.audienceType,
      gender: form.gender || undefined,
      clubId: form.clubId || undefined,
      state: form.state || undefined,
      golflinkNo: form.golflinkNo || undefined,
      clubIds,
      requestingUserEmail,
    }),
    onSuccess: (data) => {
      setAudienceResult(data);
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: () => sendNotification({
      title: form.title,
      message: form.message,
      audienceType: form.audienceType,
      gender: form.gender || undefined,
      clubId: form.clubId || undefined,
      state: form.state || undefined,
      golflinkNo: form.golflinkNo || undefined,
      clubIds,
      requestingUserEmail,
    }),
    onSuccess: (data) => {
      setSendResult(data);
      // Reset form on success
      if (data.success) {
        setForm(initialFormState);
        setAudienceResult(null);
      }
    },
  });

  const handleAudienceTypeChange = (type: AudienceType) => {
    setForm({ ...form, audienceType: type });
    setAudienceResult(null);
    setSendResult(null);
  };

  const handleGetAudienceCount = () => {
    setSendResult(null);
    audienceCountMutation.mutate();
  };

  const handleSendNotification = () => {
    setShowConfirmDialog(true);
  };

  const confirmSend = () => {
    setShowConfirmDialog(false);
    sendNotificationMutation.mutate();
  };

  const isAudienceValid = () => {
    switch (form.audienceType) {
      case 'rounds-in-progress':
        return true;
      case 'gender':
        return !!form.gender;
      case 'club':
        return !!form.clubId;
      case 'state':
        return !!form.state;
      case 'single':
        return !!form.golflinkNo && !golferClubError;
      default:
        return false;
    }
  };

  const canSend = audienceResult && audienceResult.count > 0 && form.title.trim() && form.message.trim();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Send Notification</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Send push notifications to golfers</p>
      </div>

      {/* Audience Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Select Audience</h2>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="audienceType"
              value="rounds-in-progress"
              checked={form.audienceType === 'rounds-in-progress'}
              onChange={() => handleAudienceTypeChange('rounds-in-progress')}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-gray-900 dark:text-gray-100">Golfers with rounds in progress (today)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="audienceType"
              value="gender"
              checked={form.audienceType === 'gender'}
              onChange={() => handleAudienceTypeChange('gender')}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-gray-900 dark:text-gray-100">By Gender</span>
          </label>
          {form.audienceType === 'gender' && (
            <div className="ml-7">
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select gender...</option>
                {genderOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* By Club - Super Admin only */}
          {isSuperAdmin && (
            <>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="audienceType"
                  value="club"
                  checked={form.audienceType === 'club'}
                  onChange={() => handleAudienceTypeChange('club')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-900 dark:text-gray-100">By Club (all members)</span>
              </label>
              {form.audienceType === 'club' && (
                <div className="ml-7">
                  <input
                    type="text"
                    value={form.clubId}
                    onChange={(e) => setForm({ ...form, clubId: e.target.value })}
                    placeholder="Enter club ID (e.g., 50135)"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
              )}
            </>
          )}

          {/* By State - Super Admin only */}
          {isSuperAdmin && (
            <>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="audienceType"
                  value="state"
                  checked={form.audienceType === 'state'}
                  onChange={() => handleAudienceTypeChange('state')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-900 dark:text-gray-100">By State</span>
              </label>
              {form.audienceType === 'state' && (
                <div className="ml-7">
                  <select
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select state...</option>
                    {stateOptions.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="audienceType"
              value="single"
              checked={form.audienceType === 'single'}
              onChange={() => handleAudienceTypeChange('single')}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-gray-900 dark:text-gray-100">Single Golfer (by GA Number)</span>
          </label>
          {form.audienceType === 'single' && (
            <div className="ml-7">
              <input
                type="text"
                value={form.golflinkNo}
                onChange={(e) => setForm({ ...form, golflinkNo: e.target.value })}
                placeholder="Enter GA number"
                className={`px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${golferClubError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
              />
              {golferClubError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{golferClubError}</p>
              )}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleGetAudienceCount}
            disabled={!isAudienceValid() || audienceCountMutation.isPending}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {audienceCountMutation.isPending ? 'Loading...' : 'Get Audience Count'}
          </button>

          {audienceCountMutation.isError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              Error: {audienceCountMutation.error instanceof Error ? audienceCountMutation.error.message : 'Failed to get audience count'}
            </p>
          )}

          {audienceResult && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <p className="text-lg font-semibold text-blue-900 dark:text-blue-300">
                {audienceResult.count} golfer{audienceResult.count !== 1 ? 's' : ''} will receive this notification
              </p>
              {audienceResult.count === 0 && (
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                  No golfers match the selected criteria.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Message Composer */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Compose Message</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Notification title"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Message <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="Notification message"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            maxLength={500}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{form.message.length}/500 characters</p>
        </div>
      </div>

      {/* Send Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSendNotification}
          disabled={!canSend || sendNotificationMutation.isPending}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {sendNotificationMutation.isPending ? 'Sending...' : 'Send Notification'}
        </button>

        {!canSend && audienceResult && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {audienceResult.count === 0
              ? 'No recipients to send to'
              : !form.title.trim() || !form.message.trim()
              ? 'Please fill in title and message'
              : ''}
          </p>
        )}
      </div>

      {/* Send Result */}
      {sendNotificationMutation.isError && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">
            Error: {sendNotificationMutation.error instanceof Error ? sendNotificationMutation.error.message : 'Failed to send notification'}
          </p>
        </div>
      )}

      {sendResult && (
        <div className={`${sendResult.success ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'} border rounded-lg p-4`}>
          <p className={sendResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
            {sendResult.message}
          </p>
          {sendResult.success && sendResult.recipientCount > 0 && (
            <p className="text-green-600 dark:text-green-400 text-sm mt-1">
              Sent to {sendResult.recipientCount} recipient{sendResult.recipientCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showConfirmDialog}
        title="Send Notification"
        message={`Are you sure you want to send this notification to ${audienceResult?.count || 0} golfer${audienceResult?.count !== 1 ? 's' : ''}?`}
        confirmLabel="Send"
        cancelLabel="Cancel"
        onConfirm={confirmSend}
        onCancel={() => setShowConfirmDialog(false)}
      />
    </div>
  );
}
