import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';

const API_BASE = import.meta.env.VITE_MONGODB_API_URL || 'https://mongo-api-613362712202.australia-southeast1.run.app';

// Available features for admin users
const AVAILABLE_FEATURES = [
  { id: 'golfer-lookup', label: 'Golfer Lookup' },
  { id: 'golfers', label: 'Golfers' },
  { id: 'rounds', label: 'Rounds' },
  { id: 'closed-comps', label: 'Closed Comps' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'admin-users', label: 'Admin Users' },
];

interface AdminUserData {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'club_admin';
  clubIds: string[];
  features: string[];
  isActive: boolean;
  logoUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface AdminUserFormData {
  email: string;
  name: string;
  role: 'super_admin' | 'club_admin';
  clubIds: string;
  features: string[];
  logoUrl: string;
}

// API functions
async function fetchAdminUsers(requestingUserEmail: string): Promise<AdminUserData[]> {
  const response = await fetch(
    `${API_BASE}/admin/users?requestingUserEmail=${encodeURIComponent(requestingUserEmail)}`
  );
  if (!response.ok) {
    throw new Error('Failed to fetch admin users');
  }
  return response.json();
}

async function createAdminUser(
  requestingUserEmail: string,
  data: Omit<AdminUserData, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>
): Promise<AdminUserData> {
  const response = await fetch(
    `${API_BASE}/admin/users?requestingUserEmail=${encodeURIComponent(requestingUserEmail)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to create admin user' }));
    throw new Error(error.message || 'Failed to create admin user');
  }
  return response.json();
}

async function updateAdminUser(
  requestingUserEmail: string,
  id: string,
  data: Partial<AdminUserData>
): Promise<AdminUserData> {
  const response = await fetch(
    `${API_BASE}/admin/users/${id}?requestingUserEmail=${encodeURIComponent(requestingUserEmail)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to update admin user' }));
    throw new Error(error.message || 'Failed to update admin user');
  }
  return response.json();
}

async function deactivateAdminUser(
  requestingUserEmail: string,
  id: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/admin/users/${id}?requestingUserEmail=${encodeURIComponent(requestingUserEmail)}`,
    {
      method: 'DELETE',
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to deactivate admin user' }));
    throw new Error(error.message || 'Failed to deactivate admin user');
  }
}

// Form Modal Component
function AdminUserModal({
  isOpen,
  onClose,
  onSave,
  user,
  isSaving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: AdminUserFormData) => void;
  user?: AdminUserData;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<AdminUserFormData>({
    email: '',
    name: '',
    role: 'club_admin',
    clubIds: '',
    features: [],
    logoUrl: '',
  });
  const [error, setError] = useState<string | null>(null);

  // Update form data when user prop changes (for edit mode)
  useEffect(() => {
    if (isOpen) {
      setFormData({
        email: user?.email || '',
        name: user?.name || '',
        role: user?.role || 'club_admin',
        clubIds: user?.clubIds.join(', ') || '',
        features: user?.features || [],
        logoUrl: user?.logoUrl || '',
      });
      setError(null);
    }
  }, [isOpen, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (formData.features.length === 0) {
      setError('At least one feature must be selected');
      return;
    }

    onSave(formData);
  };

  const toggleFeature = (featureId: string) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.includes(featureId)
        ? prev.features.filter((f) => f !== featureId)
        : [...prev.features, featureId],
    }));
  };

  const selectAllFeatures = () => {
    setFormData((prev) => ({
      ...prev,
      features: AVAILABLE_FEATURES.map((f) => f.id),
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {user ? 'Edit Admin User' : 'Create Admin User'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                disabled={!!user}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="admin@example.com"
              />
              {user && (
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="John Smith"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value as 'super_admin' | 'club_admin' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="club_admin">Club Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Super Admins can access all data and manage other admin users
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Club IDs (comma separated)
              </label>
              <input
                type="text"
                value={formData.clubIds}
                onChange={(e) => setFormData((prev) => ({ ...prev, clubIds: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="20315, 20316"
              />
              <p className="text-xs text-gray-500 mt-1">
                5-digit club prefixes. Leave empty for Super Admins to access all clubs.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Logo URL
              </label>
              <input
                type="url"
                value={formData.logoUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, logoUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional logo to display in the sidebar for this admin.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Features
                </label>
                <button
                  type="button"
                  onClick={selectAllFeatures}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Select All
                </button>
              </div>
              <div className="space-y-2">
                {AVAILABLE_FEATURES.map((feature) => (
                  <label key={feature.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.features.includes(feature.id)}
                      onChange={() => toggleFeature(feature.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{feature.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {user ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AdminUsers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserData | undefined>();
  const [userToDeactivate, setUserToDeactivate] = useState<AdminUserData | null>(null);
  const [userToReactivate, setUserToReactivate] = useState<AdminUserData | null>(null);

  const userEmail = user?.email || '';

  // Fetch admin users
  const { data: adminUsers, isLoading, error } = useQuery({
    queryKey: ['adminUsers', userEmail],
    queryFn: () => fetchAdminUsers(userEmail),
    enabled: !!userEmail,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Omit<AdminUserData, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>) =>
      createAdminUser(userEmail, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setIsModalOpen(false);
      setEditingUser(undefined);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AdminUserData> }) =>
      updateAdminUser(userEmail, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setIsModalOpen(false);
      setEditingUser(undefined);
    },
  });

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateAdminUser(userEmail, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setUserToDeactivate(null);
    },
  });

  // Reactivate mutation
  const reactivateMutation = useMutation({
    mutationFn: (id: string) => updateAdminUser(userEmail, id, { isActive: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setUserToReactivate(null);
    },
  });

  const handleSave = (formData: AdminUserFormData) => {
    const clubIds = formData.clubIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    const data = {
      email: formData.email,
      name: formData.name,
      role: formData.role,
      clubIds,
      features: formData.features,
      logoUrl: formData.logoUrl || undefined,
    };

    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openCreateModal = () => {
    setEditingUser(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (adminUser: AdminUserData) => {
    setEditingUser(adminUser);
    setIsModalOpen(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">
          Error loading admin users: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  const activeUsers = adminUsers?.filter((u) => u.isActive) || [];
  const inactiveUsers = adminUsers?.filter((u) => !u.isActive) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Users</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage admin access to the panel
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Add Admin User
        </button>
      </div>

      {/* Active Users */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Active Users ({activeUsers.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Club IDs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Features
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeUsers.map((adminUser) => (
                <tr key={adminUser.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{adminUser.name}</p>
                      <p className="text-sm text-gray-500">{adminUser.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        adminUser.role === 'super_admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {adminUser.role === 'super_admin' ? 'Super Admin' : 'Club Admin'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {adminUser.clubIds.length === 0 ? (
                      <span className="text-gray-400 italic">All clubs</span>
                    ) : (
                      adminUser.clubIds.join(', ')
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {adminUser.features.map((feature) => (
                        <span
                          key={feature}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                        >
                          {AVAILABLE_FEATURES.find((f) => f.id === feature)?.label || feature}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(adminUser.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openEditModal(adminUser)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    {adminUser.email !== userEmail && (
                      <button
                        onClick={() => setUserToDeactivate(adminUser)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {activeUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No active admin users
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inactive Users */}
      {inactiveUsers.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-500">
              Inactive Users ({inactiveUsers.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inactiveUsers.map((adminUser) => (
                  <tr key={adminUser.id} className="bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-gray-500">{adminUser.name}</p>
                        <p className="text-sm text-gray-400">{adminUser.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        {adminUser.role === 'super_admin' ? 'Super Admin' : 'Club Admin'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setUserToReactivate(adminUser)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Reactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <AdminUserModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUser(undefined);
        }}
        onSave={handleSave}
        user={editingUser}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />

      {/* Deactivate Confirmation Dialog */}
      <ConfirmDialog
        open={!!userToDeactivate}
        title="Deactivate Admin User"
        message={`Are you sure you want to deactivate ${userToDeactivate?.name}? They will no longer be able to access the admin panel.`}
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (userToDeactivate) {
            deactivateMutation.mutate(userToDeactivate.id);
          }
        }}
        onCancel={() => setUserToDeactivate(null)}
      />

      {/* Reactivate Confirmation Dialog */}
      <ConfirmDialog
        open={!!userToReactivate}
        title="Reactivate Admin User"
        message={`Are you sure you want to reactivate ${userToReactivate?.name}? They will regain access to the admin panel.`}
        confirmLabel="Reactivate"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (userToReactivate) {
            reactivateMutation.mutate(userToReactivate.id);
          }
        }}
        onCancel={() => setUserToReactivate(null)}
      />

      {/* Error notifications */}
      {(createMutation.error || updateMutation.error || deactivateMutation.error || reactivateMutation.error) && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-md">
          <p className="text-red-700 text-sm">
            {(createMutation.error || updateMutation.error || deactivateMutation.error || reactivateMutation.error) instanceof Error
              ? (createMutation.error || updateMutation.error || deactivateMutation.error || reactivateMutation.error)?.message
              : 'An error occurred'}
          </p>
        </div>
      )}
    </div>
  );
}
