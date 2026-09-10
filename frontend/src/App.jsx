import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import RouteLoading from './components/RouteLoading';
import { resetViewportScroll } from './hooks/useScrollToTopOnMount';
import { MODULE_ACCESS_PERMISSIONS } from './auth/modulePermissions';

const Login = lazy(() => import('./pages/Login/Login'));
const ChangePassword = lazy(() => import('./pages/Login/ChangePassword'));
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Configuracion = lazy(() => import('./pages/Configuracion/Configuracion'));
const Cuentas = lazy(() => import('./pages/Cuentas/Cuentas'));
const Inventario = lazy(() => import('./pages/Inventario/Inventario'));
const Personal = lazy(() => import('./pages/Personal/Personal'));
const Bitacoras = lazy(() => import('./pages/Bitacoras/Bitacoras'));

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
          <Suspense fallback={<RouteLoading />}>
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
          </Suspense>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
