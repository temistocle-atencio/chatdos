import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasLocalPrivateKey } from '../lib/crypto';
import { Logo } from './Logo';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, adminOnly = false }) => {
  const { user, profile, isAdmin, loading } = useAuth();
  const location = useLocation();

  const [checkingKey, setCheckingKey] = useState(true);
  const [keyRedirect, setKeyRedirect] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const verifyKeyStatus = async () => {
      if (!user) {
        if (isMounted) setCheckingKey(false);
        return;
      }

      // Si ya estamos en las pantallas de creación o recuperación de llave, o en prueba-cifrado, no redirigir
      const isKeyScreen =
        location.pathname === '/llave/crear' ||
        location.pathname === '/llave/recuperar' ||
        location.pathname === '/prueba-cifrado';

      if (isKeyScreen) {
        if (isMounted) setCheckingKey(false);
        return;
      }

      // Verificar si la llave privada ya está en IndexedDB / memoria
      const hasKey = await hasLocalPrivateKey(user.id);
      if (hasKey) {
        if (isMounted) {
          setKeyRedirect(null);
          setCheckingKey(false);
        }
        return;
      }

      // Si falta la llave privada en este dispositivo:
      // Si profiles.public_key es null -> primer inicio de sesión: ir a /llave/crear
      // Si profiles.public_key ya existe -> dispositivo nuevo: ir a /llave/recuperar
      if (!profile?.public_key) {
        if (isMounted) setKeyRedirect('/llave/crear');
      } else {
        if (isMounted) setKeyRedirect('/llave/recuperar');
      }

      if (isMounted) setCheckingKey(false);
    };

    verifyKeyStatus();

    return () => {
      isMounted = false;
    };
  }, [user, profile, location.pathname]);

  if (loading || checkingKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F2F4F7] dark:bg-[#1F2933]">
        <Logo variant="color" layout="vertical" cubeHeight={44} className="mb-4 animate-pulse" />
        <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
          Verificando seguridad...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (keyRedirect && location.pathname !== keyRedirect) {
    return <Navigate to={keyRedirect} replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, loading, getMySingleChatId } = useAuth();
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const [checkingChat, setCheckingChat] = useState(false);

  useEffect(() => {
    if (!user) return;

    if (isAdmin) {
      setTargetPath('/chats');
      return;
    }

    setCheckingChat(true);
    getMySingleChatId().then((chatId) => {
      setCheckingChat(false);
      if (chatId) {
        setTargetPath(`/chat/${chatId}`);
      } else {
        setTargetPath('/perfil');
      }
    });
  }, [user, isAdmin]);

  if (loading || checkingChat) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F2F4F7] dark:bg-[#1F2933]">
        <Logo variant="color" layout="vertical" cubeHeight={44} className="mb-4 animate-pulse" />
      </div>
    );
  }

  if (user && targetPath) {
    return <Navigate to={targetPath} replace />;
  }

  return <>{children}</>;
};
