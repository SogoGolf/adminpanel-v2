import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TenantProvider, useTenant } from './contexts/TenantContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { GolferLookup } from './pages/GolferLookup';
import { Golfers } from './pages/Golfers';
import { GolferDetail } from './pages/GolferDetail';
import { Login } from './pages/Login';
import { ConfirmDialog } from './components/ConfirmDialog';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const tenant = useTenant();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: '/', label: 'Golfer Lookup' },
    { path: '/golfers', label: 'Golfers' },
  ];

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
        {user && (
          <div className="p-4 border-t border-white/20">
            <p className="text-sm text-white/70 truncate mb-2">{user.email}</p>
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
          <h2 className="text-xl font-semibold text-gray-800">{tenant.name}</h2>
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
          <ProtectedRoute>
            <Layout>
              <GolferLookup />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/golfers"
        element={
          <ProtectedRoute>
            <Layout>
              <Golfers />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/golfers/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <GolferDetail />
            </Layout>
          </ProtectedRoute>
        }
      />
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
