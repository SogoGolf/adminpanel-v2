import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../firebase';
import { adminFetch } from '../api/adminAuth';
import { useQueryClient } from '@tanstack/react-query';


// Admin user permissions from MongoDB
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'club_admin';
  clubIds: string[];
  features: string[];
  isActive: boolean;
  logoUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  adminUser: AdminUser | null;
  loading: boolean;
  permissionsLoading: boolean;
  permissionsError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasFeature: (feature: string) => boolean;
  isSuperAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    let revision = 0;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const current = ++revision;
      queryClient.removeQueries({ predicate: (query) =>
        ['clubNotifications', 'auditLogs', 'adminUsers'].includes(String(query.queryKey[0]))
      });
      setUser(firebaseUser);
      setAdminUser(null);
      setPermissionsError(null);
      setPermissionsLoading(!!firebaseUser);
      if (!firebaseUser) {
        setLoading(false);
        return;
      }
      try {
        const response = await adminFetch('/admin/me', {}, firebaseUser.uid);
        if (response.status === 403 || response.status === 404) {
          throw new Error('You do not have admin access. Please contact an administrator.');
        }
        if (!response.ok) throw new Error('Failed to load permissions. Please try again.');
        const admin: AdminUser = await response.json();
        if (current === revision && admin.isActive) setAdminUser(admin);
      } catch (error) {
        if (current === revision) setPermissionsError(error instanceof Error ? error.message : 'Failed to load permissions.');
      } finally {
        if (current === revision) {
          setPermissionsLoading(false);
          setLoading(false);
        }
      }
    });

    return () => {
      revision++;
      unsubscribe();
    };
  }, [queryClient]);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setAdminUser(null);
    setPermissionsError(null);
  };

  const hasFeature = (feature: string): boolean => {
    if (!adminUser) return false;
    return (feature === 'notifications' && adminUser.role === 'super_admin') || adminUser.features.includes(feature);
  };

  const isSuperAdmin = (): boolean => {
    return adminUser?.role === 'super_admin';
  };

  return (
    <AuthContext.Provider value={{
      user,
      adminUser,
      loading,
      permissionsLoading,
      permissionsError,
      signIn,
      signOut,
      hasFeature,
      isSuperAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
