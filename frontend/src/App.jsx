/**
 * App.jsx — Componente raíz y definición de rutas
 *
 * Envuelve la aplicación en AuthProvider para que todos los componentes
 * tengan acceso al contexto de autenticación. Define el árbol de rutas:
 *
 *  /login             → Página de inicio de sesión (pública).
 *  /change-password   → Formulario de cambio de contraseña (primer login).
 *  /                  → Dashboard principal (requiere autenticación).
 *  /cuentas           → Módulo Cuentas por Cobrar (permiso: 'cuentas').
 *  /inventario        → Módulo Inventario (permiso: 'inventario').
 *  /personal          → Módulo Personal (permiso: 'personal').
 *  /usuarios          → Módulo Usuarios (permiso: 'usuarios', solo gerente).
 *  *                  → Redirige al dashboard.
 *
 * Cada ruta protegida se envuelve en <ProtectedRoute> que verifica
 * autenticación, primer_login y permisos antes de renderizar el componente.
 */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
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
      <Router>
        <Routes>
          {/* Ruta de login */}
          <Route path="/login" element={<Login />} />
          
          {/* Ruta de cambio de contraseña (primer login) */}
          <Route 
            path="/change-password" 
            element={
              <ProtectedRoute>
                <ChangePassword />
              </ProtectedRoute>
            } 
          />
          
          {/* Dashboard principal */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Módulo de Cuentas */}
          <Route 
            path="/cuentas" 
            element={
              <ProtectedRoute requiredPermission="cuentas">
                <Cuentas />
              </ProtectedRoute>
            } 
          />
          
          {/* Módulo de Inventario */}
          <Route 
            path="/inventario" 
            element={
              <ProtectedRoute requiredPermission="inventario">
                <Inventario />
              </ProtectedRoute>
            } 
          />
          
          {/* Módulo de Personal */}
          <Route 
            path="/personal" 
            element={
              <ProtectedRoute requiredPermission="personal">
                <Personal />
              </ProtectedRoute>
            } 
          />
          
          {/* Módulo de Usuarios (solo gerente) */}
          <Route 
            path="/usuarios" 
            element={
              <ProtectedRoute requiredPermission="usuarios">
                <Usuarios />
              </ProtectedRoute>
            } 
          />
          
          {/* Ruta por defecto: redirigir a dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
