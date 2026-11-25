import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../firebase';

const API_BASE = import.meta.env.VITE_MONGODB_API_URL || 'https://mongo-api-613362712202.australia-southeast1.run.app';

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

async function fetchAdminUser(email: string): Promise<AdminUser | null> {
  try {
    const response = await fetch(`${API_BASE}/admin/me?email=${encodeURIComponent(email)}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch admin permissions');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching admin user:', error);
    throw error;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser?.email) {
        setPermissionsLoading(true);
        setPermissionsError(null);
        try {
          const admin = await fetchAdminUser(firebaseUser.email);
          if (admin) {
            setAdminUser(admin);
          } else {
            setAdminUser(null);
            setPermissionsError('You do not have admin access. Please contact an administrator.');
          }
        } catch {
          setAdminUser(null);
          setPermissionsError('Failed to load permissions. Please try again.');
        } finally {
          setPermissionsLoading(false);
        }
      } else {
        setAdminUser(null);
        setPermissionsError(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

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
    return adminUser.features.includes(feature);
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
