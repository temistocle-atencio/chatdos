import React, { lazy, useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { ChatsPage } from './pages/ChatsPage';

// Las pantallas menos usadas se cargan solo cuando se abren: así la app arranca más rápido.
// El chat se deja listo apenas la app abre (ver más abajo), para que entrar a una conversación sea inmediato.
// Si una parte de la app ya no existe (se publicó una versión nueva), se recarga una vez para traer la nueva
function conRecarga<T>(cargar: () => Promise<T>): () => Promise<T> {
  return () =>
    cargar().catch((e) => {
      if (!sessionStorage.getItem('chatdos:recargaParte')) {
        sessionStorage.setItem('chatdos:recargaParte', '1');
        location.reload();
        return new Promise<T>(() => {});
      }
      throw e;
    });
}
setTimeout(() => sessionStorage.removeItem('chatdos:recargaParte'), 10000);
const cargarChat = conRecarga(() => import('./pages/ChatPage'));
const ChatPage = lazy(() => cargarChat().then((m) => ({ default: m.ChatPage })));
const InvitarPage = lazy(() => conRecarga(() => import('./pages/InvitarPage'))().then((m) => ({ default: m.InvitarPage })));
const InvitadoDetallePage = lazy(() => conRecarga(() => import('./pages/InvitadoDetallePage'))().then((m) => ({ default: m.InvitadoDetallePage })));
const PerfilPage = lazy(() => conRecarga(() => import('./pages/PerfilPage'))().then((m) => ({ default: m.PerfilPage })));
const AjustesPage = lazy(() => conRecarga(() => import('./pages/AjustesPage'))().then((m) => ({ default: m.AjustesPage })));
const CrearLlavePage = lazy(() => conRecarga(() => import('./pages/CrearLlavePage'))().then((m) => ({ default: m.CrearLlavePage })));
const RecuperarLlavePage = lazy(() => conRecarga(() => import('./pages/RecuperarLlavePage'))().then((m) => ({ default: m.RecuperarLlavePage })));
const PruebaCifradoPage = lazy(() => conRecarga(() => import('./pages/PruebaCifradoPage'))().then((m) => ({ default: m.PruebaCifradoPage })));

// Apenas la app termina de abrir, se deja listo el chat por detrás
const listo = () => setTimeout(() => void cargarChat().catch(() => {}), 300);
if (document.readyState === 'complete') listo();
else addEventListener('load', listo, { once: true });
import { useParams } from 'react-router-dom';

// Cada chat abre su propia pantalla: así nunca se mezcla la llave de un chat con la de otro
// (por ejemplo, al reenviar y saltar directo de un chat a otro).
const ChatPorId: React.FC = () => {
  const { chatId } = useParams();
  return <ChatPage key={chatId} />;
};
import { OfflineIndicator } from './components/OfflineIndicator';
import { AppLock } from './components/AppLock';
import { AvisoClave } from './components/AvisoClave';
import { RevisarLlave } from './components/RevisarLlave';
import { InstalarIOS } from './components/InstalarIOS';
import { Llamadas } from './components/Llamadas';
import { AvisoNavegadorInterno } from './components/AvisoNavegadorInterno';
import { PantallaCarga } from './components/PantallaCarga';
import { RedDeSeguridad } from './components/RedDeSeguridad';
import { hasLocalPrivateKey } from './lib/crypto';
import { memoria } from './lib/memoria';

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
    const llave = memoria.llaveLista.has(user.id) ? Promise.resolve(true) : hasLocalPrivateKey(user.id);
    llave.then(async (hasKey) => {
      if (hasKey) memoria.llaveLista.add(user.id);
      if (!hasKey) {
        if (!profile?.public_key) {
          setDestination('/llave/crear');
        } else {
          setDestination('/llave/recuperar');
        }
        return;
      }

      // Si la llave ya está lista:
      setDestination('/chats');
    });
  }, [user, profile, isAdmin, loading]);

  if (loading || !destination) {
    return <PantallaCarga />;
  }

  return <Navigate to={destination} replace />;
};

export default function App() {
  return (
    <RedDeSeguridad>
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

              {/* Lista de conversaciones (administrador e invitados) */}
              <Route
                path="/chats"
                element={
                  <ProtectedRoute>
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
                    <ChatPorId />
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
          <AvisoClave />
          <RevisarLlave />
          <InstalarIOS />
          <AvisoNavegadorInterno />
          <Llamadas />
          <AppLock />
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
    </RedDeSeguridad>
  );
}
