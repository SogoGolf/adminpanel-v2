import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Map features to their routes
const featureRoutes: Record<string, string> = {
  'golfer-lookup': '/',
  'golfers': '/golfers',
  'rounds': '/rounds',
  'notifications': '/notifications',
  'admin-users': '/admin/users',
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredFeature?: string;
}

export function ProtectedRoute({ children, requiredFeature }: ProtectedRouteProps) {
  const { user, adminUser, loading, permissionsLoading, permissionsError, hasFeature, signOut } = useAuth();

  // Get the first route the user has access to
  const getFirstAccessibleRoute = (): string => {
    if (!adminUser) return '/login';
    for (const feature of adminUser.features) {
      if (featureRoutes[feature]) {
        return featureRoutes[feature];
      }
    }
    return '/login';
  };

  // Show loading while Firebase auth is initializing
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Show loading while fetching permissions
  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading permissions...</div>
      </div>
    );
  }

  // Show error if user doesn't have admin access
  if (permissionsError || !adminUser) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            {permissionsError || 'You do not have permission to access this application.'}
          </p>
          <button
            onClick={() => signOut()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Check feature access if required
  if (requiredFeature && !hasFeature(requiredFeature)) {
    // Redirect to the first feature the user has access to
    const firstAccessibleRoute = getFirstAccessibleRoute();
    return <Navigate to={firstAccessibleRoute} replace />;
  }

  return <>{children}</>;
}
