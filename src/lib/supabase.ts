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

// Con señal mala, una consulta puede quedarse esperando para siempre y la pantalla no avanza.
// Las consultas y la sesión se cortan a los 20 s (y se reintentan). Los archivos no tienen límite.
const LIMITE_MS = 20000;
const fetchConLimite: typeof fetch = (entrada, opciones) => {
  const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  if (!/\/(rest|auth)\/v1\//.test(url)) return fetch(entrada, opciones);
  const corte = new AbortController();
  const t = setTimeout(() => corte.abort(), LIMITE_MS);
  const externa = opciones?.signal;
  if (externa) {
    if (externa.aborted) corte.abort();
    else externa.addEventListener('abort', () => corte.abort(), { once: true });
  }
  return fetch(entrada, { ...opciones, signal: corte.signal }).finally(() => clearTimeout(t));
};

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
    global: { fetch: fetchConLimite },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
