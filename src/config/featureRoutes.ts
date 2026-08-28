import type { AdminUser } from '../contexts/AuthContext';

// Map features to their routes
const featureRoutes: Record<string, string> = {
  'golfers': '/golfers',
  'rounds': '/rounds',
  'closed-comps': '/closed-comps',
  'notifications': '/notifications',
  'admin-users': '/admin/users',
};

// Settings is open to every authenticated admin, so it is the safe landing
// spot when none of the feature routes apply.
const FALLBACK_ROUTE = '/settings';

// Get the first route the user has access to
export function firstAccessibleRoute(adminUser: AdminUser | null): string {
  if (!adminUser) return '/login';
  for (const feature of adminUser.features) {
    if (featureRoutes[feature]) {
      return featureRoutes[feature];
    }
  }
  return FALLBACK_ROUTE;
}
