import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { TenantConfig, TenantFeatures } from '../types';
import { getSubdomain, getTenantBySubdomain } from '../config/tenants';

interface TenantContextType {
  tenant: TenantConfig;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const subdomain = getSubdomain();
    const tenantConfig = getTenantBySubdomain(subdomain);
    setTenant(tenantConfig);
    setLoading(false);
  }, []);

  if (loading || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <TenantContext.Provider value={{ tenant, loading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantConfig {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context.tenant;
}

export function useFeature<K extends keyof TenantFeatures>(feature: K): TenantFeatures[K] {
  const tenant = useTenant();
  return tenant.features[feature];
}
