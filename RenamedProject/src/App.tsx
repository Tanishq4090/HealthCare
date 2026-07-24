import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Login from './Login';
import ClientConfirmation from './pages/ClientConfirmation';
import DutyTracker from './pages/DutyTracker';
import AdminLayout from './admin/AdminLayout';
import Dashboard from './admin/Dashboard';
import CRM from './admin/CRM';
import HR from './admin/HR';
import Clients from './admin/Clients';
import Billing from './admin/Billing';
import AccessControl from './admin/AccessControl';
import PublicIDCard from './pages/public/PublicIDCard';
import NotFoundPage from './pages/NotFoundPage';

import { useAttendanceSocket } from './hooks/useAttendanceSocket';
import './App.css';

function AppMeta() {
  if (typeof document !== 'undefined') {
    document.title = 'Healthcare OS — Management Portal';
  }
  return null;
}

function AppContent() {
  useAttendanceSocket();
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/login" element={<Login />} />
        
        {/* Operations OS Protected Routes */}
        <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="crm" element={<ProtectedRoute requiredModule="crm"><CRM /></ProtectedRoute>} />
          <Route path="clients" element={<ProtectedRoute requiredModule="clients"><Clients /></ProtectedRoute>} />
          <Route path="hr" element={<ProtectedRoute requiredModule="hr"><HR /></ProtectedRoute>} />
          <Route path="billing" element={<ProtectedRoute requiredModule="finance"><Billing /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute><AccessControl /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        {/* Utilities */}
        <Route path="/client/confirm-staff/:id" element={<ClientConfirmation />} />
        <Route path="/duty/:id" element={<DutyTracker />} />
        <Route path="/id-card/:token" element={<PublicIDCard />} />
        
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AnimatePresence>
  );
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <ScrollToTop />
          <AppMeta />
          <Toaster position="bottom-right" theme="light" />
          <AppContent />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
