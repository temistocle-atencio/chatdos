import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Download, Loader2, Lock, ImageOff, Images } from 'lucide-react';
import '../index.css';

// Página pública para ver y descargar fotos compartidas con un enlace de ChatDos.
// No necesita cuenta. Las fotos llegan cifradas y se abren aquí mismo con la llave que va en el enlace
// (después del #, que nunca se envía a ningún servidor).

interface Archivo {
  ruta: string;
  key: string;
  mime: string;
}
interface Indice {
  v: 1;
  creado: number;
  fotos: { nombre: string; mime: string; size: number; original: Archivo; previa?: Archivo }[];
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://snebetxlyehjggjcvkac.supabase.co';
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const desdeBase64 = (b64: string) => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64.length / 4) * 4, '='));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function descifrar(datos: ArrayBuffer, llave64: string, mime: string): Promise<Blob> {
  const llave = await crypto.subtle.importKey('raw', desdeBase64(llave64) as BufferSource, { name: 'AES-GCM' }, false, ['decrypt']);
  const iv = new Uint8Array(datos, 0, 12);
  const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, llave, new Uint8Array(datos, 12) as BufferSource);
  return new Blob([plano], { type: mime });
}

async function bajar(url: string, alAvanzar?: (p: number) => void): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error(r.status === 404 ? 'Esta foto ya no está disponible.' : 'No se pudo bajar la foto.');
  const total = Number(r.headers.get('content-length')) || 0;
  const lector = r.body.getReader();
  const partes: Uint8Array[] = [];
  let llevamos = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done || !value) break;
    partes.push(value);
    llevamos += value.length;
    if (total) alAvanzar?.(Math.round((llevamos / total) * 100));
  }
  return new Blob(partes as BlobPart[]).arrayBuffer();
}

const peso = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function guardar(blob: Blob, nombre: string) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 60_000);
}

const Foto: React.FC<{ f: Indice['fotos'][number]; urls: Record<string, string> }> = ({ f, urls }) => {
  const [vista, setVista] = useState<string | null>(null);
  const [sinVista, setSinVista] = useState(false);
  const [bajando, setBajando] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const p = f.previa;
    if (!p || !urls[p.ruta]) {
      setSinVista(true);
      return;
    }
    bajar(urls[p.ruta])
      .then((d) => descifrar(d, p.key, p.mime))
      .then((b) => vivo && setVista(URL.createObjectURL(b)))
      .catch(() => vivo && setSinVista(true));
    return () => {
      vivo = false;
    };
  }, [f, urls]);

  const descargar = async () => {
    const u = urls[f.original.ruta];
    if (!u) return setError('Esta foto ya no está disponible.');
    setError(null);
    setBajando(0);
    try {
      const d = await bajar(u, setBajando);
      guardar(await descifrar(d, f.original.key, f.mime), f.nombre);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descargar.');
    } finally {
      setBajando(null);
    }
  };

  return (
    <div className="rounded-[10px] overflow-hidden bg-white dark:bg-[#253240] shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex flex-col">
      <div className="aspect-[4/3] bg-[#E3E7EC] dark:bg-[#1F2933] flex items-center justify-center">
        {vista ? (
          <img src={vista} alt={f.nombre} className="w-full h-full object-cover" />
        ) : sinVista ? (
          <ImageOff className="w-8 h-8 text-[#5B6670]" strokeWidth={1.5} />
        ) : (
          <Loader2 className="w-6 h-6 animate-spin text-[#5B6670]" strokeWidth={2} />
        )}
      </div>
      <div className="p-2.5 flex items-center gap-2">
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-['Inter'] text-[#1F2933] dark:text-white truncate">{f.nombre}</span>
          <span className="block text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#C9CFD6]">{peso(f.size)} · original</span>
        </span>
        <button
          type="button"
          onClick={() => void descargar()}
          disabled={bajando !== null}
          className="h-9 px-3 rounded-full bg-[#F28C1B] text-[#1F2933] text-xs font-['Poppins'] font-semibold flex items-center gap-1.5 disabled:opacity-70"
        >
          {bajando !== null ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} /> {bajando}%
            </>
          ) : (
            <>
              <Download className="w-4 h-4" strokeWidth={2} /> Descargar
            </>
          )}
        </button>
      </div>
      {error && <p className="px-2.5 pb-2 text-[11px] text-[#B03030]">{error}</p>}
    </div>
  );
};

const Pagina: React.FC = () => {
  const [estado, setEstado] = useState<
    { tipo: 'cargando' } | { tipo: 'error'; texto: string } | { tipo: 'listo'; indice: Indice; urls: Record<string, string>; expira: string }
  >({ tipo: 'cargando' });
  const [todas, setTodas] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [id, llave] = location.hash.slice(1).split('.');
      if (!id || !llave) return setEstado({ tipo: 'error', texto: 'El enlace está incompleto. Pide que te lo envíen otra vez.' });
      const r = await fetch(`${SUPABASE_URL}/functions/v1/notificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ accion: 'compartido_ver', id }),
      }).catch(() => null);
      const d = (await r?.json().catch(() => null)) as { manifiesto?: string; urls?: Record<string, string>; expira?: string; error?: string } | null;
      if (!d || d.error || !d.manifiesto || !d.urls) return setEstado({ tipo: 'error', texto: d?.error || 'No se pudo abrir el enlace. Revisa tu conexión.' });
      try {
        const indice = JSON.parse(await (await descifrar(await bajar(d.manifiesto), llave, 'application/json')).text()) as Indice;
        setEstado({ tipo: 'listo', indice, urls: d.urls, expira: d.expira ?? '' });
      } catch {
        setEstado({ tipo: 'error', texto: 'No se pudieron abrir las fotos. Revisa que el enlace esté completo.' });
      }
    })();
  }, []);

  const descargarTodas = async () => {
    if (estado.tipo !== 'listo') return;
    const fotos = estado.indice.fotos;
    for (let i = 0; i < fotos.length; i++) {
      const f = fotos[i];
      const u = estado.urls[f.original.ruta];
      if (!u) continue;
      setTodas(`Descargando ${i + 1} de ${fotos.length}…`);
      try {
        guardar(await descifrar(await bajar(u), f.original.key, f.mime), f.nombre);
      } catch {
        /* sigue con las demás */
      }
    }
    setTodas(null);
  };

  return (
    <div className="min-h-dvh bg-[#F2F4F7] dark:bg-[#1F2933]">
      <header className="bg-[#003A73] text-white px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Images className="w-7 h-7 text-[#F28C1B]" strokeWidth={2} />
          <div>
            <h1 className="font-['Poppins'] font-semibold text-lg leading-tight">Fotos compartidas</h1>
            <p className="text-xs font-['Inter'] text-white/80">En calidad original, enviadas con ChatDos</p>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto p-4">
        {estado.tipo === 'cargando' && (
          <div className="py-20 flex flex-col items-center gap-3 text-sm font-['Inter'] text-[#5B6670]">
            <Loader2 className="w-8 h-8 animate-spin" strokeWidth={2} /> Abriendo las fotos…
          </div>
        )}
        {estado.tipo === 'error' && (
          <div className="py-16 text-center text-sm font-['Inter'] text-[#1F2933] dark:text-white">
            <ImageOff className="w-10 h-10 mx-auto mb-3 text-[#5B6670]" strokeWidth={1.5} />
            {estado.texto}
          </div>
        )}
        {estado.tipo === 'listo' && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <p className="flex-1 min-w-[200px] text-xs font-['Inter'] text-[#5B6670] dark:text-[#C9CFD6]">
                {estado.indice.fotos.length} foto{estado.indice.fotos.length > 1 ? 's' : ''} ·{' '}
                {peso(estado.indice.fotos.reduce((t, f) => t + f.size, 0))}
                {estado.expira &&
                  ` · Disponible hasta el ${new Date(estado.expira).toLocaleDateString('es', { day: 'numeric', month: 'long' })}`}
              </p>
              {estado.indice.fotos.length > 1 && (
                <button
                  type="button"
                  onClick={() => void descargarTodas()}
                  disabled={!!todas}
                  className="h-10 px-4 rounded-full bg-[#005198] text-white text-sm font-['Poppins'] font-semibold flex items-center gap-2 disabled:opacity-70"
                >
                  {todas ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} /> : <Download className="w-4 h-4" strokeWidth={2} />}
                  {todas || 'Descargar todas'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {estado.indice.fotos.map((f, i) => (
                <Foto key={i} f={f} urls={estado.urls} />
              ))}
            </div>
          </>
        )}
        <p className="mt-8 flex items-center justify-center gap-1.5 text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#C9CFD6] text-center">
          <Lock className="w-3.5 h-3.5" strokeWidth={2} /> Las fotos están cifradas: solo se pueden abrir con este enlace.
        </p>
      </main>
    </div>
  );
};

// Si cambia el enlace (otro # en la misma pestaña), se vuelve a abrir
window.addEventListener('hashchange', () => location.reload());

createRoot(document.getElementById('root')!).render(<Pagina />);
