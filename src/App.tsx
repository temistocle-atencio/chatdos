import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { ChatsPage } from './pages/ChatsPage';
import { InvitarPage } from './pages/InvitarPage';
import { InvitadoDetallePage } from './pages/InvitadoDetallePage';
import { ChatPage } from './pages/ChatPage';
import { PerfilPage } from './pages/PerfilPage';
import { AjustesPage } from './pages/AjustesPage';
import { CrearLlavePage } from './pages/CrearLlavePage';
import { RecuperarLlavePage } from './pages/RecuperarLlavePage';
import { PruebaCifradoPage } from './pages/PruebaCifradoPage';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Logo } from './components/Logo';
import { hasLocalPrivateKey } from './lib/crypto';

// Redirección inteligente de la ruta raíz '/' según el rol y el estado de la llave
const RootRedirect: React.FC = () => {
  const { user, profile, isAdmin, loading, getMySingleChatId } = useAuth();
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setDestination('/login');
      return;
    }

    // Comprobar si la llave local ya existe
    hasLocalPrivateKey(user.id).then(async (hasKey) => {
      if (!hasKey) {
        if (!profile?.public_key) {
          setDestination('/llave/crear');
        } else {
          setDestination('/llave/recuperar');
        }
        return;
      }

      // Si la llave ya está lista:
      if (isAdmin) {
        setDestination('/chats');
      } else {
        const chatId = await getMySingleChatId();
        if (chatId) {
          setDestination(`/chat/${chatId}`);
        } else {
          setDestination('/perfil');
        }
      }
    });
  }, [user, profile, isAdmin, loading]);

  if (loading || !destination) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F2F4F7] dark:bg-[#1F2933]">
        <Logo variant="color" layout="vertical" cubeHeight={44} className="mb-4 animate-pulse" />
      </div>
    );
  }

  return <Navigate to={destination} replace />;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            {/* Ruta pública de acceso */}
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              }
            />

            {/* Rutas con el layout oficial de la aplicación */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<RootRedirect />} />

              {/* Rutas de gestión de llaves criptográficas */}
              <Route
                path="/llave/crear"
                element={
                  <ProtectedRoute>
                    <CrearLlavePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/llave/recuperar"
                element={
                  <ProtectedRoute>
                    <RecuperarLlavePage />
                  </ProtectedRoute>
                }
              />

              {/* Página oculta de verificación criptográfica */}
              <Route
                path="/prueba-cifrado"
                element={
                  <ProtectedRoute>
                    <PruebaCifradoPage />
                  </ProtectedRoute>
                }
              />

              {/* Rutas exclusivas del administrador */}
              <Route
                path="/chats"
                element={
                  <ProtectedRoute adminOnly>
                    <ChatsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invitar"
                element={
                  <ProtectedRoute adminOnly>
                    <InvitarPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invitado/:id"
                element={
                  <ProtectedRoute adminOnly>
                    <InvitadoDetallePage />
                  </ProtectedRoute>
                }
              />

              {/* Rutas para cualquier usuario autenticado (admin o invitado) */}
              <Route
                path="/chat/:chatId"
                element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/perfil"
                element={
                  <ProtectedRoute>
                    <PerfilPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ajustes"
                element={
                  <ProtectedRoute>
                    <AjustesPage />
                  </ProtectedRoute>
                }
              />

              {/* Redirección por defecto a la raíz */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          <OfflineIndicator />
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
