import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './Login';
import LandingPage from './LandingPage';
import ClientConfirmation from './pages/ClientConfirmation';
import DutyTracker from './pages/DutyTracker';
import AdminLayout from './admin/AdminLayout';
import Dashboard from './admin/Dashboard';
import CRM from './admin/CRM';
import HR from './admin/HR';
import Clients from './admin/Clients';
import Billing from './admin/Billing';
import AccessControl from './admin/AccessControl';
import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="bottom-right" theme="light" />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/client/confirm-staff/:id" element={<ClientConfirmation />} />
          <Route path="/duty/:id" element={<DutyTracker />} />

          {/* Private Admin Dashboard */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            {/* Anyone with dashboard access can see the default index */}
            <Route index element={<Dashboard />} />

            {/* Role-Restricted Modules */}
            <Route
              path="crm"
              element={
                <ProtectedRoute requiredModule="crm">
                  <CRM />
                </ProtectedRoute>
              }
            />
            <Route
              path="clients"
              element={
                <ProtectedRoute requiredModule="clients">
                  <Clients />
                </ProtectedRoute>
              }
            />
            <Route
              path="hr"
              element={
                <ProtectedRoute requiredModule="hr">
                  <HR />
                </ProtectedRoute>
              }
            />
            <Route
              path="billing"
              element={
                <ProtectedRoute requiredModule="finance">
                  <Billing />
                </ProtectedRoute>
              }
            />

            {/* System Admin Only */}
            <Route
              path="settings"
              element={
                <ProtectedRoute>
                  <AccessControl />
                </ProtectedRoute>
              }
            />

            {/* Catch-all relative to /admin */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>

          {/* Global Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
