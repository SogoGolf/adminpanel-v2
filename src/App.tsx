import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TenantProvider, useTenant } from './contexts/TenantContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { GolferLookup } from './pages/GolferLookup';
import { Golfers } from './pages/Golfers';
import { GolferDetail } from './pages/GolferDetail';
import { Rounds } from './pages/Rounds';
import { Notifications } from './pages/Notifications';
import { AdminUsers } from './pages/AdminUsers';
import { Login } from './pages/Login';
import { ConfirmDialog } from './components/ConfirmDialog';
import './index.css';

// Map features to menu items
const allMenuItems = [
  { path: '/', label: 'Golfer Lookup', feature: 'golfer-lookup' },
  { path: '/golfers', label: 'Golfers', feature: 'golfers' },
  { path: '/rounds', label: 'Rounds', feature: 'rounds' },
  { path: '/notifications', label: 'Notifications', feature: 'notifications' },
  { path: '/admin/users', label: 'Admin Users', feature: 'admin-users' },
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function Layout({ children }: { children: React.ReactNode }) {
  const { user, adminUser, signOut, hasFeature } = useAuth();
  const tenant = useTenant();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filter menu items based on user's features
  const menuItems = allMenuItems.filter(item => hasFeature(item.feature));

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 text-white flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ backgroundColor: tenant.primaryColor }}
      >
        <div className="p-4 border-b border-white/20 flex justify-between items-center">
          {tenant.logo ? (
            <img src={tenant.logo} alt={tenant.name} className="h-8" />
          ) : (
            <h1 className="text-xl font-bold">{tenant.name}</h1>
          )}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 hover:bg-white/10 rounded"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className="block px-4 py-2 rounded hover:bg-white/10 transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {user && adminUser && (
          <div className="p-4 border-t border-white/20">
            <p className="text-sm font-medium text-white truncate">{adminUser.name}</p>
            <p className="text-xs text-white/60 truncate mb-1">{user.email}</p>
            <p className="text-xs text-white/40 capitalize mb-2">
              {adminUser.role.replace('_', ' ')}
            </p>
            <button
              onClick={() => setShowSignOutDialog(true)}
              className="text-sm text-red-300 hover:text-red-200 transition-colors"
            >
              Sign Out
            </button>
          </div>
        )}
      </aside>

      <ConfirmDialog
        open={showSignOutDialog}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
        onConfirm={() => {
          setShowSignOutDialog(false);
          signOut();
        }}
        onCancel={() => setShowSignOutDialog(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white shadow-sm px-4 sm:px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 hover:bg-gray-100 rounded"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {adminUser?.role === 'super_admin' ? (
            <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5.25 3.4 10.15 8 11.5 4.6-1.35 8-6.25 8-11.5V6l-8-4z" fill="url(#shieldGradient)" stroke="#991b1b" strokeWidth="1"/>
              <path d="M10 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="shieldGradient" x1="12" y1="2" x2="12" y2="19.5" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#ef4444"/>
                  <stop offset="1" stopColor="#991b1b"/>
                </linearGradient>
              </defs>
            </svg>
          ) : adminUser?.logoUrl ? (
            <img src={adminUser.logoUrl} alt={adminUser.name} className="h-10" />
          ) : null}
          <h2 className={`text-2xl font-bold ${adminUser?.role === 'super_admin' ? 'text-red-700' : 'text-blue-700'}`}>
            {adminUser?.name || tenant.name}
          </h2>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute requiredFeature="golfer-lookup">
            <Layout>
              <GolferLookup />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/golfers"
        element={
          <ProtectedRoute requiredFeature="golfers">
            <Layout>
              <Golfers />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/golfers/:id"
        element={
          <ProtectedRoute requiredFeature="golfers">
            <Layout>
              <GolferDetail />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rounds"
        element={
          <ProtectedRoute requiredFeature="rounds">
            <Layout>
              <Rounds />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute requiredFeature="notifications">
            <Layout>
              <Notifications />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute requiredFeature="admin-users">
            <Layout>
              <AdminUsers />
            </Layout>
          </ProtectedRoute>
        }
      />
      {/* Redirect unknown routes to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <TenantProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </TenantProvider>
  );
}

export default App;
