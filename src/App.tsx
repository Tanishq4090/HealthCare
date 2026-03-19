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

// 99 Care Public Pages
import Layout from './components/layout/Layout';
import HomePage from './pages/public/HomePage';
import AboutPage from './pages/public/AboutPage';
import ServicesPage from './pages/public/ServicesPage';
import ServiceDetailPage from './pages/public/ServiceDetailPage';
import BlogPage from './pages/public/BlogPage';
import BlogDetailPage from './pages/public/BlogDetailPage';
import ContactPage from './pages/public/ContactPage';
import AppointmentPage from './pages/public/AppointmentPage';
import AppointmentConfirmedPage from './pages/public/AppointmentConfirmedPage';
import NotFoundPage from './pages/NotFoundPage';
import { APP_MODE } from './config/appMode';
import { useEffect } from 'react';

import './App.css';

function AppMeta() {
  const mode = APP_MODE;

  useEffect(() => {
    // Ensure OS pages never get indexed if deployed accidentally on public domain.
    if (typeof document === 'undefined') return;

    document.title =
      mode === 'os'
        ? 'HealthFirst OS — Private Client Portal'
        : '99 Care — Home Healthcare Services in Surat';

    const existing = document.querySelector('meta[name="robots"]');
    if (mode === 'os') {
      const meta = existing ?? document.createElement('meta');
      meta.setAttribute('name', 'robots');
      meta.setAttribute('content', 'noindex,nofollow,noarchive');
      if (!existing) document.head.appendChild(meta);
    } else if (existing) {
      existing.remove();
    }
  }, [mode]);

  return null;
}

function AppContent() {
  const location = useLocation();
  const mode = APP_MODE;
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {mode === 'public' ? (
          <>
            {/* 99 Care Public Routes - Wrapped in Layout */}
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/services/:slug" element={<ServiceDetailPage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/blog/:slug" element={<BlogDetailPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/appointment" element={<AppointmentPage />} />
              <Route path="/appointment/confirmed" element={<AppointmentConfirmedPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </>
        ) : (
          <>
            {/* OS Mode: root goes to login */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Auth / Client utility routes */}
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
              <Route index element={<Dashboard />} />
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
              <Route
                path="settings"
                element={
                  <ProtectedRoute>
                    <AccessControl />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/admin" replace />} />
          </>
        )}
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ScrollToTop />
        <AppMeta />
        <Toaster position="bottom-right" theme="light" />
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
