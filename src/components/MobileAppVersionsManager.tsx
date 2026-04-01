import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMobileAppVersionConfig,
  updateMobileAppVersionConfig,
} from '../api/mongodb';
import type {
  MobileAppVersionConfig,
  MobileAppVersionPlatformSettings,
  UpdateMobileAppVersionConfigRequest,
} from '../types';

type PlatformKey = 'ios' | 'android';

const PLATFORM_LABELS: Record<PlatformKey, string> = {
  ios: 'iOS',
  android: 'Android',
};

const EMPTY_PLATFORM_SETTINGS: MobileAppVersionPlatformSettings = {
  minimumRequiredVersion: '',
  optionalUpdatePromptEnabled: false,
  forceUpdateEnabled: false,
  updateMessage: '',
};

const EMPTY_CONFIG: MobileAppVersionConfig = {
  id: '',
  versionString: '',
  ios: { ...EMPTY_PLATFORM_SETTINGS },
  android: { ...EMPTY_PLATFORM_SETTINGS },
  updatedAt: null,
  updatedBy: '',
};

function cloneConfig(config: MobileAppVersionConfig): MobileAppVersionConfig {
  return {
    ...config,
    ios: { ...config.ios },
    android: {
      ...config.android,
      optionalUpdatePromptEnabled: false,
    },
  };
}

function getConfigSignature(config: MobileAppVersionConfig): string {
  return JSON.stringify({
    ios: config.ios,
    android: config.android,
  });
}

function isValidVersionString(version: string): boolean {
  if (!version.trim()) return true;

  const parts = version.trim().split('.');
  if (parts.length === 0 || parts.length > 4) return false;

  return parts.every((part) => /^\d+$/.test(part));
}

function validateConfig(config: MobileAppVersionConfig): string | null {
  const platforms: PlatformKey[] = ['ios', 'android'];

  for (const platform of platforms) {
    const settings = config[platform];
    const label = PLATFORM_LABELS[platform];

    if (!isValidVersionString(settings.minimumRequiredVersion)) {
      return `${label} minimum required version must look like 1.2.3`;
    }

    const requiresMinimumVersion =
      settings.forceUpdateEnabled ||
      (platform === 'ios' && settings.optionalUpdatePromptEnabled);

    if (requiresMinimumVersion && !settings.minimumRequiredVersion.trim()) {
      return `${label} minimum required version is required when an update prompt is enabled`;
    }
  }

  return null;
}

export function MobileAppVersionsManager({
  requestingUserEmail,
  updatedBy,
}: {
  requestingUserEmail?: string;
  updatedBy?: string;
}) {
  const queryClient = useQueryClient();
  const [editedConfig, setEditedConfig] = useState<MobileAppVersionConfig | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastSavedSignatureRef = useRef<string>('');
  const saveTimerRef = useRef<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['mobileAppVersionConfig', requestingUserEmail],
    queryFn: () => getMobileAppVersionConfig(requestingUserEmail!),
    enabled: Boolean(requestingUserEmail),
  });

  const updateMutation = useMutation({
    mutationFn: (config: UpdateMobileAppVersionConfigRequest) =>
      updateMobileAppVersionConfig(requestingUserEmail!, config),
    onSuccess: (savedConfig) => {
      queryClient.setQueryData(['mobileAppVersionConfig', requestingUserEmail], savedConfig);
      const savedSignature = getConfigSignature(savedConfig);
      lastSavedSignatureRef.current = savedSignature;
      setEditedConfig((currentConfig) => {
        if (!currentConfig) {
          return cloneConfig(savedConfig);
        }

        return getConfigSignature(currentConfig) === savedSignature
          ? cloneConfig(savedConfig)
          : currentConfig;
      });
      setValidationError(null);
      setSaveState('saved');
    },
    onError: () => {
      setSaveState('error');
    },
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    const savedSignature = getConfigSignature(data);
    lastSavedSignatureRef.current = savedSignature;

    setEditedConfig((currentConfig) => {
      if (currentConfig === null) {
        return cloneConfig(data);
      }

      return currentConfig;
    });
  }, [data]);

  useEffect(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (!editedConfig || !requestingUserEmail) {
      return;
    }

    const errorMessage = validateConfig(editedConfig);
    if (errorMessage) {
      setValidationError(errorMessage);
      setSaveState('idle');
      return;
    }

    const currentSignature = getConfigSignature(editedConfig);
    if (currentSignature === lastSavedSignatureRef.current) {
      if (saveState !== 'saved') {
        setSaveState('idle');
      }
      return;
    }

    if (updateMutation.isPending) {
      return;
    }

    setValidationError(null);
    setSaveState('idle');

    saveTimerRef.current = window.setTimeout(() => {
      setSaveState('saving');
      updateMutation.mutate({
        ios: editedConfig.ios,
        android: editedConfig.android,
        updatedBy: updatedBy ?? requestingUserEmail,
      });
    }, 700);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [editedConfig, requestingUserEmail, updatedBy, updateMutation, updateMutation.isPending, saveState]);

  if (!requestingUserEmail) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-sm text-red-600 dark:text-red-400">
          Unable to load app version settings because the current admin email is unavailable.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((item) => (
              <div key={item} className="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-red-600 dark:text-red-400">
          Failed to load mobile app version configuration.
        </p>
      </div>
    );
  }

  const config = editedConfig ?? data ?? EMPTY_CONFIG;

  const updatePlatform = (
    platform: PlatformKey,
    field: keyof MobileAppVersionPlatformSettings,
    value: string | boolean,
  ) => {
    const nextConfig = cloneConfig(config);
    nextConfig[platform] = {
      ...nextConfig[platform],
      [field]: value,
    };
    setEditedConfig(nextConfig);
    setValidationError(null);
    setSaveState('idle');
  };

  const mutationError =
    updateMutation.error instanceof Error
      ? updateMutation.error.message
      : 'Failed to save mobile app version configuration';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Mobile App Versions</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Set the minimum supported versions for the native apps and choose whether updates are optional or required.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            iOS supports optional prompts and force updates. Android uses Google Play flexible updates by default and switches to immediate updates when force update is enabled.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            iOS optional prompts are remembered on-device when a user taps Later. They reappear once the minimum version moves to a new major or minor version, for example 3.3.x to 3.4.x or 4.0.x.
          </p>
          {data?.updatedAt && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Last updated{' '}
              {new Date(data.updatedAt).toLocaleString('en-AU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {data.updatedBy ? ` by ${data.updatedBy}` : ''}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {saveState === 'saving' && (
            <p className="text-sm text-blue-600 dark:text-blue-400">Saving...</p>
          )}
          {saveState === 'saved' && !validationError && !updateMutation.isError && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved</p>
          )}
          {saveState === 'idle' && !validationError && !updateMutation.isError && (
            <p className="text-sm text-gray-400 dark:text-gray-500">Autosaves after changes</p>
          )}
        </div>
      </div>

      {(validationError || updateMutation.isError) && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {validationError ?? mutationError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(['ios', 'android'] as PlatformKey[]).map((platform) => (
          <PlatformVersionCard
            key={platform}
            platform={platform}
            label={PLATFORM_LABELS[platform]}
            settings={config[platform]}
            onChange={(field, value) => updatePlatform(platform, field, value)}
          />
        ))}
      </div>
    </div>
  );
}

function PlatformVersionCard({
  platform,
  label,
  settings,
  onChange,
}: {
  platform: PlatformKey;
  label: string;
  settings: MobileAppVersionPlatformSettings;
  onChange: (field: keyof MobileAppVersionPlatformSettings, value: string | boolean) => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="font-medium text-gray-900 dark:text-white">{label}</h3>
        {platform === 'ios' && (
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={settings.optionalUpdatePromptEnabled}
              onChange={(event) => onChange('optionalUpdatePromptEnabled', event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Optional prompt
          </label>
        )}
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={settings.forceUpdateEnabled}
            onChange={(event) => onChange('forceUpdateEnabled', event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Force update
        </label>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Minimum Required Version
          </label>
          <input
            type="text"
            value={settings.minimumRequiredVersion}
            onChange={(event) => onChange('minimumRequiredVersion', event.target.value)}
            placeholder="e.g. 3.2.1"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Update Message
          </label>
          <textarea
            value={settings.updateMessage}
            onChange={(event) => onChange('updateMessage', event.target.value)}
            rows={3}
            placeholder="Optional message shown to users when an update prompt is displayed."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>
    </section>
  );
}
