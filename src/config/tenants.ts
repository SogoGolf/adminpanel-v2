import type { TenantConfig } from '../types';

export const tenants: Record<string, TenantConfig> = {
  masseypark: {
    clubId: 'masseypark',
    subdomain: 'masseypark',
    name: 'Massey Park Golf Club',
    logo: '/logos/masseypark.png',
    primaryColor: '#1e5c3a',
    features: {
      canAddTokens: true,
      canViewRounds: true,
    },
  },
  goldencreek: {
    clubId: 'goldencreek',
    subdomain: 'goldencreek',
    name: 'Golden Creek Golf Club',
    logo: '/logos/goldencreek.png',
    primaryColor: '#b8860b',
    features: {
      canAddTokens: true,
      canViewRounds: false,
    },
  },
};

export const defaultTenant: TenantConfig = {
  clubId: 'default',
  subdomain: 'default',
  name: 'GolfApp Admin',
  logo: '',
  primaryColor: '#1f2937',
  features: {
    canAddTokens: true,
    canViewRounds: true,
  },
};

export function getTenantBySubdomain(subdomain: string): TenantConfig {
  return tenants[subdomain] || defaultTenant;
}

export function getSubdomain(): string {
  const hostname = window.location.hostname;

  // Local development - check localStorage or query param
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const params = new URLSearchParams(window.location.search);
    const tenantParam = params.get('tenant');
    if (tenantParam) {
      localStorage.setItem('dev-tenant', tenantParam);
      return tenantParam;
    }
    return localStorage.getItem('dev-tenant') || 'default';
  }

  // Production: masseypark.admin-panel.app → "masseypark"
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }

  return 'default';
}
