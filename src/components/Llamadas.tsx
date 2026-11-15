import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, SwitchCamera, Settings2, Check, Signal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AvatarImage } from './AvatarImage';
import {
  useLlamada,
  escucharLlamadas,
  dejarDeEscucharLlamadas,
  contestar,
  rechazar,
  colgar,
  silenciar,
  camara,
  voltearCamara,
  elegirCalidad,
  type Calidad,
} from '../lib/llamadas';

const NOMBRE_CALIDAD: Record<Calidad, string> = { auto: 'Automática', '360': 'Ahorro 360p', '720': 'HD 720p', '1080': 'Full HD 1080p' };

const Video_: React.FC<{ stream: MediaStream | null; muted?: boolean; espejo?: boolean; className?: string }> = ({
  stream,
  muted,
  espejo,
  className,
}) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={className}
      style={espejo ? { transform: 'scaleX(-1)' } : undefined}
    />
  );
};

const Audio_: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline />;
};

const Boton: React.FC<{ onClick: () => void; activo?: boolean; rojo?: boolean; verde?: boolean; etiqueta: string; children: React.ReactNode }> = ({
  onClick,
  activo,
  rojo,
  verde,
  etiqueta,
  children,
}) => (
  <div className="flex flex-col items-center gap-1.5">
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className={`w-14 h-14 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
        rojo ? 'bg-[#E5484D] text-white' : verde ? 'bg-[#1E9E5A] text-white' : activo ? 'bg-white text-[#003A73]' : 'bg-white/15 text-white'
      }`}
    >
      {children}
    </button>
    <span className="text-[11px] font-['Inter'] text-white/85">{etiqueta}</span>
  </div>
);

function useReloj(inicio: number | null) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!inicio) return;
    const i = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, [inicio]);
  if (!inicio) return '';
  const s = Math.floor((Date.now() - inicio) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Pantalla de llamadas: entrante, saliente y en curso (encima de toda la app). */
export const Llamadas: React.FC = () => {
  const { user } = useAuth();
  const l = useLlamada();
  const reloj = useReloj(l?.estado === 'en_curso' ? l.inicio : null);
  const [menuCalidad, setMenuCalidad] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const arrastre = useRef<{ dx: number; dy: number } | null>(null);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    escucharLlamadas(userId);
    return () => dejarDeEscucharLlamadas();
  }, [userId]);

  if (!l) return null;

  const video = l.tipo === 'video';
  const conectado = l.estado === 'en_curso';
  const estadoTexto =
    l.estado === 'terminada'
      ? l.mensaje || 'Llamada terminada'
      : l.estado === 'sonando'
        ? video
          ? 'Videollamada entrante'
          : 'Llamada de voz entrante'
        : l.estado === 'llamando'
          ? l.timbrando
            ? 'Sonando…'
            : 'Llamando…'
          : l.estado === 'conectando'
            ? 'Conectando…'
            : reloj;

  const verVideoOtro = video && conectado && l.remota && l.camOtro;

  return (
    <div className="fixed inset-0 z-[150] bg-gradient-to-b from-[#003A73] to-[#001F3F] text-white flex flex-col select-none">
      {/* Video de la otra persona (pantalla completa) */}
      {verVideoOtro && <Video_ stream={l.remota} muted className="absolute inset-0 w-full h-full object-cover bg-black" />}
      {/* Audio de la otra persona (siempre por aquí, aunque apague la cámara) */}
      <Audio_ stream={l.remota} />

      {/* Mi cámara: grande mientras llama, chiquita y movible en la llamada */}
      {video && l.local && l.cam && (
        conectado ? (
          <div
            className="absolute z-10 w-28 h-40 sm:w-36 sm:h-52 rounded-[12px] overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.4)] border border-white/20 touch-none"
            style={pos ? { left: pos.x, top: pos.y } : { right: 16, top: 'calc(env(safe-area-inset-top) + 120px)' }}
            onPointerDown={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              arrastre.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!arrastre.current) return;
              setPos({
                x: Math.max(8, Math.min(window.innerWidth - 120, e.clientX - arrastre.current.dx)),
                y: Math.max(8, Math.min(window.innerHeight - 170, e.clientY - arrastre.current.dy)),
              });
            }}
            onPointerUp={() => (arrastre.current = null)}
          >
            <Video_ stream={l.local} muted espejo={l.frontal} className="w-full h-full object-cover bg-black" />
          </div>
        ) : (
          <Video_ stream={l.local} muted espejo={l.frontal} className="absolute inset-0 w-full h-full object-cover opacity-60" />
        )
      )}

      {/* Parte de arriba: nombre y estado */}
      <div
        className={`relative z-[5] flex flex-col items-center text-center px-6 ${verVideoOtro ? 'pt-4 pb-6 bg-gradient-to-b from-black/60 to-transparent' : 'pt-16'}`}
        style={{ paddingTop: verVideoOtro ? 'calc(env(safe-area-inset-top) + 12px)' : 'calc(env(safe-area-inset-top) + 64px)' }}
      >
        {!verVideoOtro && (
          <div className={`mb-5 rounded-full overflow-hidden ring-4 ring-white/15 ${l.estado === 'sonando' || l.estado === 'llamando' ? 'animate-pulse' : ''}`}>
            <AvatarImage avatarPath={l.otroFoto} name={l.otroNombre} size={112} />
          </div>
        )}
        <h2 className="font-['Poppins'] font-semibold text-2xl drop-shadow">{l.otroNombre}</h2>
        <p className="mt-1 font-['Inter'] text-sm text-white/85 drop-shadow">{estadoTexto}</p>
        {conectado && (
          <div className="mt-2 flex items-center gap-2 text-[11px] font-['Inter'] text-white/80">
            {l.senal && (
              <span className="flex items-center gap-1">
                <Signal className={`w-3.5 h-3.5 ${l.senal === 'buena' ? 'text-[#4ADE80]' : l.senal === 'regular' ? 'text-[#F28C1B]' : 'text-[#E5484D]'}`} strokeWidth={2.5} />
                Señal {l.senal}
              </span>
            )}
            {video && l.recibiendo && <span>· Recibiendo en {l.recibiendo}p</span>}
          </div>
        )}
        {video && conectado && !l.camOtro && <p className="mt-4 text-xs font-['Inter'] text-white/70">{l.otroNombre} apagó su cámara</p>}
      </div>

      <div className="flex-1" />

      {/* Menú de calidad */}
      {menuCalidad && (
        <div className="relative z-20 mx-auto mb-4 w-64 rounded-[12px] bg-[#001F3F]/95 border border-white/15 p-2 shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
          <p className="px-2 pt-1 pb-2 text-[11px] font-['Inter'] text-white/70">Cómo quieres ver a {l.otroNombre}</p>
          {(['auto', '360', '720', '1080'] as Calidad[]).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                elegirCalidad(q);
                setMenuCalidad(false);
              }}
              className="w-full h-10 px-2 rounded-[8px] flex items-center justify-between text-sm font-['Inter'] hover:bg-white/10"
            >
              <span>{NOMBRE_CALIDAD[q]}</span>
              {l.calidad === q && <Check className="w-4 h-4 text-[#F28C1B]" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      )}

      {/* Botones */}
      <div
        className={`relative z-[5] px-4 pt-6 ${verVideoOtro ? 'bg-gradient-to-t from-black/70 to-transparent' : ''}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}
      >
        {l.estado === 'sonando' ? (
          <div className="flex items-center justify-around max-w-xs mx-auto">
            <Boton onClick={rechazar} rojo etiqueta="Rechazar">
              <PhoneOff className="w-6 h-6" strokeWidth={2} />
            </Boton>
            <Boton onClick={() => void contestar()} verde etiqueta="Contestar">
              {video ? <Video className="w-6 h-6" strokeWidth={2} /> : <Phone className="w-6 h-6" strokeWidth={2} />}
            </Boton>
          </div>
        ) : l.estado === 'terminada' ? (
          <div className="h-20" />
        ) : (
          <div className="flex items-start justify-center gap-3 sm:gap-6">
            <Boton onClick={silenciar} activo={!l.mic} etiqueta={l.mic ? 'Silenciar' : 'Activar'}>
              {l.mic ? <Mic className="w-6 h-6" strokeWidth={2} /> : <MicOff className="w-6 h-6" strokeWidth={2} />}
            </Boton>
            {video && (
              <>
                <Boton onClick={camara} activo={!l.cam} etiqueta={l.cam ? 'Cámara' : 'Encender'}>
                  {l.cam ? <Video className="w-6 h-6" strokeWidth={2} /> : <VideoOff className="w-6 h-6" strokeWidth={2} />}
                </Boton>
                <Boton onClick={() => void voltearCamara()} etiqueta="Voltear">
                  <SwitchCamera className="w-6 h-6" strokeWidth={2} />
                </Boton>
                <Boton onClick={() => setMenuCalidad((v) => !v)} activo={menuCalidad} etiqueta="Calidad">
                  <Settings2 className="w-6 h-6" strokeWidth={2} />
                </Boton>
              </>
            )}
            <Boton onClick={colgar} rojo etiqueta="Colgar">
              <PhoneOff className="w-6 h-6" strokeWidth={2} />
            </Boton>
          </div>
        )}
      </div>
    </div>
  );
};
