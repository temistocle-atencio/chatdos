import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { safeMarkDelivered, safeTouchLastSeen } from '../lib/rpc';
import type { Profile } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ isAdmin: boolean; chatId?: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getMySingleChatId: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Carga el perfil del usuario actual desde la tabla 'profiles'
  const loadProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('[Auth] Error al cargar perfil:', error.message);
        return null;
      }
      return data as Profile;
    } catch (err) {
      console.warn('[Auth] Error de conexión al cargar perfil:', err);
      return null;
    }
  };

  // Verifica si el usuario actual es administrador mediante la RPC 'is_admin'
  const checkIsAdmin = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) {
        console.warn('[Auth] Error al verificar rol administrador:', error.message);
        return false;
      }
      return !!data;
    } catch (err) {
      console.warn('[Auth] Excepción al verificar rol administrador:', err);
      return false;
    }
  };

  // Para invitados: obtiene el ID de su único chat
  const getMySingleChatId = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('chat_members')
        .select('chat_id')
        .limit(1);

      if (error || !data || data.length === 0) {
        return null;
      }
      return data[0].chat_id;
    } catch {
      return null;
    }
  };

  // Inicialización de la sesión
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            const [userProfile, adminFlag] = await Promise.all([
              loadProfile(session.user.id),
              checkIsAdmin(),
            ]);
            if (mounted) {
              setProfile(userProfile);
              setIsAdmin(adminFlag);
            }
          }
        }
      } catch (err) {
        console.warn('[Auth] Error inicializando sesión:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Escucha cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          const [userProfile, adminFlag] = await Promise.all([
            loadProfile(currentSession.user.id),
            checkIsAdmin(),
          ]);
          setProfile(userProfile);
          setIsAdmin(adminFlag);
        } else {
          setProfile(null);
          setIsAdmin(false);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Mantener actualizado touch_last_seen() y mark_delivered() globalmente
  useEffect(() => {
    if (!user) return;

    safeMarkDelivered();
    safeTouchLastSeen();

    // Actualizar touch_last_seen() cada 60 s con la app visible
    const interval = setInterval(() => {
      if (!document.hidden) {
        safeTouchLastSeen();
      }
    }, 60000);

    const handleVisibility = () => {
      if (!document.hidden) {
        // Al volver a la app ('visible')
        safeTouchLastSeen();
        safeMarkDelivered();
      } else {
        // Al ocultar la app ('hidden')
        safeTouchLastSeen();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);

  // Inicio de sesión usando USUARIO y CONTRASEÑA
  // Regla del contrato: convertir a `${usuario.trim().toLowerCase()}@chatdos.invalid`
  const signIn = async (username: string, password: string) => {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      throw new Error('Por favor ingresa tu nombre de usuario.');
    }
    if (!password) {
      throw new Error('Por favor ingresa tu contraseña.');
    }

    const email = `${cleanUsername}@chatdos.invalid`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Manejo de errores amigable en español
      if (
        error.message.includes('Invalid login credentials') ||
        error.message.includes('invalid_grant') ||
        error.status === 400
      ) {
        throw new Error('Usuario o contraseña incorrectos.');
      }
      throw new Error(error.message || 'No fue posible iniciar sesión.');
    }

    if (!data.user) {
      throw new Error('No se recibió información de usuario.');
    }

    setUser(data.user);
    setSession(data.session);

    const [userProfile, adminFlag] = await Promise.all([
      loadProfile(data.user.id),
      checkIsAdmin(),
    ]);

    setProfile(userProfile);
    setIsAdmin(adminFlag);

    let singleChatId: string | null = null;
    if (!adminFlag) {
      singleChatId = await getMySingleChatId();
    }

    return { isAdmin: adminFlag, chatId: singleChatId };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsAdmin(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await loadProfile(user.id);
      setProfile(p);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        loading,
        signIn,
        signOut,
        refreshProfile,
        getMySingleChatId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};
