import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { safeMarkDelivered, safeTouchLastSeen } from '../lib/rpc';
import type { Profile } from '../types/database';
import { desactivarBloqueo } from '../lib/bloqueo';
import { vaciarMemoria } from '../lib/memoria';
import { vaciarStickers } from '../lib/stickers';
import { borrarSesionLocal, borrarTodoLocal, guardarSesionLocal, leerSesionLocal } from '../lib/offline';

// Sin internet: recuperar el usuario guardado por Supabase en el celular
function usuarioGuardado(): User | null {
  try {
    const k = Object.keys(localStorage).find((x) => x.startsWith('sb-') && x.endsWith('-auth-token'));
    if (!k) return null;
    const v = JSON.parse(localStorage.getItem(k) || 'null');
    return (v?.user as User) ?? null;
  } catch {
    return null;
  }
}

const delCache = (userId: string) => {
  const s = leerSesionLocal();
  return s && s.userId === userId ? s : null;
};

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
        return delCache(userId)?.profile ?? null;
      }
      guardarSesionLocal({ userId, profile: data as Profile });
      return data as Profile;
    } catch (err) {
      console.warn('[Auth] Error de conexión al cargar perfil:', err);
      return delCache(userId)?.profile ?? null;
    }
  };

  // Verifica si el usuario actual es administrador mediante la RPC 'is_admin'
  const checkIsAdmin = async (userId?: string): Promise<boolean> => {
    const guardado = userId ? !!delCache(userId)?.isAdmin : false;
    try {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) {
        console.warn('[Auth] Error al verificar rol administrador:', error.message);
        return guardado;
      }
      if (userId) guardarSesionLocal({ userId, isAdmin: !!data });
      return !!data;
    } catch (err) {
      console.warn('[Auth] Excepción al verificar rol administrador:', err);
      return guardado;
    }
  };

  // Para invitados: obtiene el ID de su único chat
  const getMySingleChatId = async (): Promise<string | null> => {
    const guardado = leerSesionLocal()?.chatId ?? null;
    if (guardado) {
      // Al instante con lo guardado; se confirma con el servidor por detrás
      buscarChatId(guardado);
      return guardado;
    }
    return buscarChatId(null);
  };

  const buscarChatId = async (guardado: string | null): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('chat_members')
        .select('chat_id')
        .limit(1);

      if (error) return guardado;
      if (!data || data.length === 0) return null;
      const u = leerSesionLocal();
      if (u) guardarSesionLocal({ userId: u.userId, chatId: data[0].chat_id });
      return data[0].chat_id;
    } catch {
      return guardado;
    }
  };

  // Inicialización de la sesión
  useEffect(() => {
    let mounted = true;

    // El usuario y el perfil se cambian solo si de verdad cambiaron.
    // (Antes, cada renovación automática de la sesión hacía recargar las pantallas abiertas.)
    const fijarUsuario = (u: User | null) => setUser((prev) => (prev?.id === u?.id ? prev : u));
    const fijarPerfil = (p: Profile | null) =>
      setProfile((prev) => (JSON.stringify(prev) === JSON.stringify(p) ? prev : p));

    const refrescarPerfil = async (userId: string) => {
      const [userProfile, adminFlag] = await Promise.all([loadProfile(userId), checkIsAdmin(userId)]);
      if (!mounted) return;
      fijarPerfil(userProfile);
      setIsAdmin(adminFlag);
    };

    const initAuth = async () => {
      // 1) Entrada instantánea: si ya se había iniciado sesión en este celular, se usa lo guardado
      const previo = usuarioGuardado();
      const cache = previo ? delCache(previo.id) : null;
      if (previo && cache?.profile) {
        fijarUsuario(previo);
        fijarPerfil(cache.profile);
        setIsAdmin(!!cache.isAdmin);
        setLoading(false);
      }

      // 2) Luego se confirma con el servidor, sin bloquear la pantalla
      try {
        const { data: { session } } = await supabase.auth.getSession();
        // Sin internet la sesión puede no renovarse: se usa el usuario guardado en el celular
        const usuario = session?.user ?? usuarioGuardado();
        if (mounted) {
          setSession(session);
          fijarUsuario(usuario);
          if (usuario) await refrescarPerfil(usuario.id);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      // Sin internet, un fallo al renovar la sesión no debe sacar a la persona de la app
      if (!currentSession && event !== 'SIGNED_OUT' && usuarioGuardado()) return;
      setSession(currentSession);
      fijarUsuario(currentSession?.user ?? null);

      if (!currentSession?.user) {
        setProfile(null);
        setIsAdmin(false);
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // La renovación automática (TOKEN_REFRESHED) no necesita volver a pedir el perfil
        setTimeout(() => refrescarPerfil(currentSession.user.id), 0);
      }
      setLoading(false);
    });

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

    guardarSesionLocal({ userId: data.user.id });
    const [userProfile, adminFlag] = await Promise.all([
      loadProfile(data.user.id),
      checkIsAdmin(data.user.id),
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
    if (user) desactivarBloqueo(user.id);
    try {
      await supabase.auth.signOut();
    } finally {
      borrarSesionLocal();
      vaciarMemoria();
      vaciarStickers();
      await borrarTodoLocal();
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
