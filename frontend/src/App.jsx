import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login/Login';
import ChangePassword from './pages/Login/ChangePassword';
import Dashboard from './pages/Dashboard/Dashboard';
import Configuracion from './pages/Configuracion/Configuracion';
import Cuentas from './pages/Cuentas/Cuentas';
import Inventario from './pages/Inventario/Inventario';
import Personal from './pages/Personal/Personal';
import Bitacoras from './pages/Bitacoras/Bitacoras';
import { resetViewportScroll } from './hooks/useScrollToTopOnMount';
import { MODULE_ACCESS_PERMISSIONS } from './auth/modulePermissions';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  React.useLayoutEffect(() => {
    resetViewportScroll();
  }, [pathname]);

  return null;
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/change-password"
              element={
                <ProtectedRoute>
                  <ChangePassword />
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bitacoras"
              element={
                <ProtectedRoute requiredPermission={MODULE_ACCESS_PERMISSIONS.bitacoras}>
                  <Bitacoras />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cuentas"
              element={
                <ProtectedRoute requiredPermission={MODULE_ACCESS_PERMISSIONS.cuentas}>
                  <Cuentas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracion"
              element={
                <ProtectedRoute requiredPermission={MODULE_ACCESS_PERMISSIONS.configuracion}>
                  <Configuracion />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventario"
              element={
                <ProtectedRoute requiredPermission={MODULE_ACCESS_PERMISSIONS.inventario}>
                  <Inventario />
                </ProtectedRoute>
              }
            />
            <Route
              path="/personal"
              element={
                <ProtectedRoute requiredPermission={MODULE_ACCESS_PERMISSIONS.personal}>
                  <Personal />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
