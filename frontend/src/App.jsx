import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login/Login';
import ChangePassword from './pages/Login/ChangePassword';
import Dashboard from './pages/Dashboard/Dashboard';
import Cuentas from './pages/Cuentas/Cuentas';
import Inventario from './pages/Inventario/Inventario';
import Personal from './pages/Personal/Personal';
import Usuarios from './pages/Usuarios/Usuarios';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/cuentas" element={<ProtectedRoute requiredPermission="cuentas"><Cuentas /></ProtectedRoute>} />
            <Route path="/inventario" element={<ProtectedRoute requiredPermission="inventario"><Inventario /></ProtectedRoute>} />
            <Route path="/personal" element={<ProtectedRoute requiredPermission="personal"><Personal /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute requiredPermission="usuarios"><Usuarios /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
