import React, { useEffect, useState } from 'react';
import { X, Loader2, MapPin, Phone, Copy, Check, UserRound } from 'lucide-react';
import type { MessagePayload } from '../types/chat';
import { IconoContactoColor, IconoUbicacionColor } from './Iconos';
import { DURACIONES_VIVO, useUbicacionVivo } from '../lib/ubicacionVivo';

type Ubicacion = NonNullable<MessagePayload['ubicacion']>;
type Contacto = NonNullable<MessagePayload['contacto']>;

export const enlaceMapa = (u: { lat: number; lng: number }) => `https://www.google.com/maps/search/?api=1&query=${u.lat},${u.lng}`;

// ---------- Mapa pequeño (cuadros de OpenStreetMap, sin llaves ni cuentas) ----------
export const MapaMini: React.FC<{ lat: number; lng: number; ancho: number; alto: number; zoom?: number }> = ({
  lat,
  lng,
  ancho,
  alto,
  zoom = 16,
}) => {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const px = x * 256;
  const py = y * 256;
  const cuadros: { tx: number; ty: number }[] = [];
  const x0 = Math.floor((px - ancho / 2) / 256);
  const x1 = Math.floor((px + ancho / 2) / 256);
  const y0 = Math.floor((py - alto / 2) / 256);
  const y1 = Math.floor((py + alto / 2) / 256);
  for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) cuadros.push({ tx, ty });
  return (
    <div className="relative overflow-hidden bg-[#E3E7EC]" style={{ width: ancho, height: alto }}>
      {cuadros.map(({ tx, ty }) => (
        <img
          key={`${tx}-${ty}`}
          src={`https://tile.openstreetmap.org/${zoom}/${((tx % n) + n) % n}/${ty}.png`}
          alt=""
          draggable={false}
          onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
          className="absolute max-w-none select-none"
          style={{ width: 256, height: 256, left: tx * 256 - px + ancho / 2, top: ty * 256 - py + alto / 2 }}
        />
      ))}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)]">
        <IconoUbicacionColor className="w-9 h-9" />
      </span>
      <span className="absolute bottom-0 right-0 px-1 bg-white/80 text-[9px] font-['Inter'] text-[#1F2933]">© OpenStreetMap</span>
    </div>
  );
};

// ---------- Burbujas ----------
const haceCuanto = (ms: number) => {
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return `hace ${h} h`;
};
const hora = (ms: number) => new Date(ms).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });

export const BurbujaUbicacion: React.FC<{
  u: Ubicacion;
  messageId: string;
  isMine: boolean;
  metadata: React.ReactNode;
  onDejar?: () => void;
}> = ({ u, messageId, isMine, metadata, onDejar }) => {
  const vivo = useUbicacionVivo(messageId);
  const enVivo = !!u.vivo;
  const fin = vivo?.terminaAt ?? u.vivo?.hasta ?? 0;
  const activa = enVivo && fin > Date.now();
  const pos = vivo ?? u;
  const suave = isMine ? 'text-white/85' : 'text-[#5B6670] dark:text-[#E3E7EC]';
  return (
    <div className="w-[240px] -mx-1 -mt-0.5">
      <a
        href={enlaceMapa(pos)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`block rounded-[6px] overflow-hidden relative ${enVivo && !activa ? 'grayscale opacity-80' : ''}`}
        aria-label="Abrir la ubicación en el mapa"
      >
        <MapaMini lat={pos.lat} lng={pos.lng} ancho={240} alto={140} />
        {activa && (
          <span className="absolute top-2 left-2 px-2 h-6 rounded-full bg-[#1E9E5A] text-white text-[11px] font-['Inter'] font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> En vivo
          </span>
        )}
      </a>
      <div className="flex items-end gap-2 px-1 pt-1.5">
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1 text-sm font-['Inter'] font-medium">
            <MapPin className="w-4 h-4 shrink-0" strokeWidth={2} /> {enVivo ? 'Ubicación en vivo' : 'Ubicación'}
          </span>
          <span className={`block text-[11px] font-['Inter'] ${suave}`}>
            {enVivo
              ? activa
                ? `Hasta las ${hora(fin)}${vivo ? ` · ${haceCuanto(vivo.actualizado)}` : ''}`
                : 'Ya no se está compartiendo'
              : `Toca para abrirlo${u.precision ? ` · ±${Math.round(u.precision)} m` : ''}`}
          </span>
        </span>
        {metadata}
      </div>
      {isMine && activa && onDejar && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDejar();
          }}
          className="mt-1.5 -mb-1 w-full h-10 border-t border-white/25 text-sm font-['Poppins'] font-semibold text-white hover:bg-white/10"
        >
          Dejar de compartir
        </button>
      )}
    </div>
  );
};

export const BurbujaContacto: React.FC<{ c: Contacto; isMine: boolean; metadata: React.ReactNode }> = ({ c, isMine, metadata }) => {
  const [copiado, setCopiado] = useState(false);
  const tel = c.telefonos[0];
  const linea = isMine ? 'border-white/25' : 'border-[#E3E7EC] dark:border-white/15';
  const boton = `flex-1 h-10 flex items-center justify-center gap-1.5 text-sm font-['Poppins'] font-semibold ${
    isMine ? 'text-white hover:bg-white/10' : 'text-[#005198] dark:text-white hover:bg-[#F2F4F7] dark:hover:bg-white/10'
  }`;
  return (
    <div className="w-[240px] -mx-1">
      <div className="flex items-center gap-3 px-1 py-1">
        <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${isMine ? 'bg-white/20' : 'bg-[#F2F4F7] dark:bg-white/15'}`}>
          <UserRound className="w-6 h-6" strokeWidth={2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-['Inter'] font-semibold truncate">{c.nombre}</span>
          {c.telefonos.map((t) => (
            <span key={t} className={`block text-xs font-['Inter'] truncate ${isMine ? 'text-white/85' : 'text-[#5B6670] dark:text-[#E3E7EC]'}`}>
              {t}
            </span>
          ))}
          {c.correo && (
            <span className={`block text-xs font-['Inter'] truncate ${isMine ? 'text-white/85' : 'text-[#5B6670] dark:text-[#E3E7EC]'}`}>{c.correo}</span>
          )}
        </span>
      </div>
      <div className="flex justify-end px-1">{metadata}</div>
      {tel && (
        <div className={`mt-1 -mb-1 flex border-t ${linea}`}>
          <a href={`tel:${tel.replace(/[^\d+]/g, '')}`} onClick={(e) => e.stopPropagation()} className={boton}>
            <Phone className="w-4 h-4" strokeWidth={2} /> Llamar
          </a>
          <span className={`w-px ${isMine ? 'bg-white/25' : 'bg-[#E3E7EC] dark:bg-white/15'}`} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void navigator.clipboard?.writeText(tel).then(() => {
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1500);
              });
            }}
            className={boton}
          >
            {copiado ? <Check className="w-4 h-4" strokeWidth={2} /> : <Copy className="w-4 h-4" strokeWidth={2} />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}
    </div>
  );
};

// ---------- Ventanas para enviar ----------
const Hoja: React.FC<{ titulo: string; onCerrar: () => void; children: React.ReactNode }> = ({ titulo, onCerrar, children }) => (
  <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40" onClick={onCerrar}>
    <div
      className="w-full max-w-md bg-white dark:bg-[#253240] rounded-t-[16px] sm:rounded-[12px] shadow-[0_-2px_12px_rgba(0,0,0,0.15)] p-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={titulo}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-['Poppins'] font-semibold text-base text-[#003A73] dark:text-white">{titulo}</h3>
        <button type="button" onClick={onCerrar} className="p-2 -mr-2 text-[#5B6670] dark:text-[#E3E7EC]" aria-label="Cerrar">
          <X className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const botonPrincipal =
  "w-full h-12 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50";

export const EnviarUbicacion: React.FC<{ onEnviar: (u: Ubicacion, vivoSegundos?: number) => void; onCerrar: () => void }> = ({ onEnviar, onCerrar }) => {
  const [eligiendoVivo, setEligiendoVivo] = useState(false);
  const [u, setU] = useState<Ubicacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(true);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Este navegador no puede ver tu ubicación.');
      setBuscando(false);
      return;
    }
    setBuscando(true);
    setError(null);
    let vivo = true;
    // Primero una rápida y luego se afina mientras la ventana está abierta
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (!vivo) return;
        setU({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy });
        setBuscando(false);
      },
      (e) => {
        if (!vivo) return;
        setBuscando(false);
        setError(
          e.code === e.PERMISSION_DENIED
            ? 'No diste permiso para ver tu ubicación. Actívalo en los permisos del navegador para ChatDos y vuelve a intentar.'
            : 'No se pudo encontrar tu ubicación. Revisa que el GPS esté encendido.'
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );
    return () => {
      vivo = false;
      navigator.geolocation.clearWatch(id);
    };
  }, [intento]);

  return (
    <Hoja titulo="Enviar ubicación" onCerrar={onCerrar}>
      <div className="rounded-[8px] overflow-hidden mb-3 flex justify-center bg-[#F2F4F7] dark:bg-[#1F2933]" style={{ height: 180 }}>
        {u ? (
          <MapaMini lat={u.lat} lng={u.lng} ancho={448} alto={180} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-sm font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
            {buscando ? <Loader2 className="w-6 h-6 animate-spin" strokeWidth={2} /> : <IconoUbicacionColor className="w-10 h-10" />}
            {buscando ? 'Buscando dónde estás…' : 'Sin ubicación'}
          </div>
        )}
      </div>
      {u?.precision && (
        <p className="mb-3 text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">Precisión: unos {Math.round(u.precision)} metros</p>
      )}
      {error && <p className="mb-3 text-xs font-['Inter'] text-[#B03030]">{error}</p>}
      {error ? (
        <button type="button" onClick={() => setIntento((i) => i + 1)} className={botonPrincipal}>
          Intentar de nuevo
        </button>
      ) : (
        <>
          <button type="button" disabled={!u} onClick={() => u && onEnviar(u)} className={botonPrincipal}>
            <MapPin className="w-5 h-5" strokeWidth={2} /> Enviar mi ubicación actual
          </button>
          {!eligiendoVivo ? (
            <button
              type="button"
              disabled={!u}
              onClick={() => setEligiendoVivo(true)}
              className="mt-2 w-full h-12 rounded-[5px] border border-[#1E9E5A] text-[#1E9E5A] dark:text-[#4ADE80] font-['Poppins'] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" /> Compartir ubicación en tiempo real
            </button>
          ) : (
            <div className="mt-3">
              <p className="mb-2 text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
                ¿Por cuánto tiempo? Se actualiza mientras tengas ChatDos abierto en pantalla.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {DURACIONES_VIVO.map((d) => (
                  <button
                    key={d.seg}
                    type="button"
                    onClick={() => u && onEnviar(u, d.seg)}
                    className="h-11 rounded-[5px] bg-[#1E9E5A] text-white text-sm font-['Poppins'] font-semibold"
                  >
                    {d.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Hoja>
  );
};

interface SelectorContactos {
  select: (props: string[], opts?: { multiple?: boolean }) => Promise<{ name?: string[]; tel?: string[]; email?: string[] }[]>;
}

export const EnviarContacto: React.FC<{ onEnviar: (c: Contacto) => void; onCerrar: () => void }> = ({ onEnviar, onCerrar }) => {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const selector = (navigator as Navigator & { contacts?: SelectorContactos }).contacts;

  const deMisContactos = async () => {
    if (!selector) return;
    setError(null);
    try {
      const [c] = await selector.select(['name', 'tel', 'email'], { multiple: false });
      if (!c) return;
      const tels = (c.tel ?? []).map((t) => t.trim()).filter(Boolean);
      const nom = (c.name?.[0] || '').trim() || tels[0] || 'Contacto';
      if (!tels.length && !c.email?.length) {
        setError('Ese contacto no tiene número ni correo.');
        return;
      }
      onEnviar({ nombre: nom.slice(0, 80), telefonos: Array.from(new Set(tels)).slice(0, 3), ...(c.email?.[0] ? { correo: c.email[0] } : {}) });
    } catch {
      /* cerró la lista sin elegir */
    }
  };

  const campo =
    "w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-[16px] font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198]";
  const valido = nombre.trim() && telefono.replace(/\D/g, '').length >= 6;

  return (
    <Hoja titulo="Enviar contacto" onCerrar={onCerrar}>
      {selector && (
        <>
          <button type="button" onClick={() => void deMisContactos()} className={botonPrincipal}>
            <IconoContactoColor className="w-6 h-6" /> Elegir de mis contactos
          </button>
          <p className="my-3 text-center text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">o escríbelo</p>
        </>
      )}
      <div className="space-y-2">
        <input className={campo} placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value.slice(0, 80))} autoComplete="off" />
        <input
          className={campo}
          placeholder="Número de teléfono"
          inputMode="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value.slice(0, 30))}
          autoComplete="off"
        />
        <input
          className={campo}
          placeholder="Correo (opcional)"
          inputMode="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value.slice(0, 120))}
          autoComplete="off"
        />
      </div>
      {error && <p className="mt-2 text-xs font-['Inter'] text-[#B03030]">{error}</p>}
      <button
        type="button"
        disabled={!valido}
        onClick={() =>
          onEnviar({ nombre: nombre.trim(), telefonos: [telefono.trim()], ...(correo.trim() ? { correo: correo.trim() } : {}) })
        }
        className={`mt-3 ${
          selector
            ? "w-full h-12 rounded-[5px] border border-[#F28C1B] text-[#D46A00] dark:text-[#F28C1B] font-['Poppins'] font-semibold text-sm disabled:opacity-50"
            : botonPrincipal
        }`}
      >
        Enviar contacto
      </button>
    </Hoja>
  );
};
