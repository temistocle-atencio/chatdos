import { createClient } from '@supabase/supabase-js';

// Leemos las credenciales desde las variables de entorno de Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://snebetxlyehjggjcvkac.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.warn(
    '[ChatDos] VITE_SUPABASE_ANON_KEY no está configurada aún en el archivo .env. ' +
    'Configúrala para conectar con tu proyecto de Supabase.'
  );
}

// Inicialización del cliente oficial de Supabase
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
