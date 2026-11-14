import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, X, MoreHorizontal, SquarePlus, Compass, Copy, Check } from 'lucide-react';

// En el iPhone, Apple no deja que una página se instale sola con un botón: solo se puede desde
// el menú Compartir de Safari. Aquí se guía paso a paso y, si se abrió dentro de otra app
// (Telegram, WhatsApp…), se ayuda a pasar a Safari.

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
export const esIOS =
  /iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
export const estaInstalada = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;
// Chrome, Firefox y Edge del iPhone también pueden instalar; los navegadores dentro de otras apps no
const esOtroNavegador = /CriOS|FxiOS|EdgiOS/i.test(ua);
const dentroDeOtraApp = esIOS && !esOtroNavegador && !/Safari\//i.test(ua);

const ENLACE = 'https://temistocle-atencio.github.io/chatdos/';
const CLAVE_CERRADO = 'chatdos-instalar-cerrado';

const abrirGuia = new Set<() => void>();
/** Abre la guía de instalación desde cualquier botón "Instalar". */
export const mostrarGuiaIOS = () => abrirGuia.forEach((f) => f());

// Icono de Compartir de Apple (cuadro con flecha hacia arriba)
const IconoCompartir: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M12 15V3" />
    <path d="M8 7l4-4 4 4" />
    <path d="M7 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
  </svg>
);

const Paso: React.FC<{ n: number; icono: React.ReactNode; children: React.ReactNode }> = ({ n, icono, children }) => (
  <li className="flex items-center gap-3">
    <span className="w-7 h-7 shrink-0 rounded-full bg-[#005198] text-white font-['Poppins'] font-bold text-sm flex items-center justify-center">{n}</span>
    <span className="flex-1 text-sm font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] leading-snug">{children}</span>
    <span className="w-10 h-10 shrink-0 rounded-[8px] bg-[#F2F4F7] dark:bg-[#1F2933] text-[#005198] dark:text-white flex items-center justify-center">{icono}</span>
  </li>
);

export const InstalarIOS: React.FC = () => {
  const { pathname } = useLocation();
  const [guia, setGuia] = useState(false);
  const [enSafari, setEnSafari] = useState(!dentroDeOtraApp);
  const [copiado, setCopiado] = useState(false);
  const [cerrado, setCerrado] = useState(() => {
    try {
      return Date.now() - Number(localStorage.getItem(CLAVE_CERRADO) || 0) < 3 * 24 * 3600 * 1000;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const f = () => setGuia(true);
    abrirGuia.add(f);
    return () => {
      abrirGuia.delete(f);
    };
  }, []);

  if (!esIOS || estaInstalada()) return null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(ENLACE);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* nada */
    }
  };

  const enListaOLogin = pathname === '/login' || pathname === '/chats';

  return (
    <>
      {enListaOLogin && !cerrado && !guia && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 px-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-md mx-auto flex items-center gap-3 p-3 rounded-[12px] bg-[#003A73] text-white shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
            <Download className="w-6 h-6 shrink-0" strokeWidth={2} />
            <div className="flex-1 min-w-0">
              <p className="font-['Poppins'] font-semibold text-sm leading-tight">Instala ChatDos</p>
              <p className="font-['Inter'] text-[11px] text-[#E3E7EC] leading-tight">Sin volver a iniciar sesión y con notificaciones</p>
            </div>
            <button
              type="button"
              onClick={() => setGuia(true)}
              className="h-9 px-4 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-xs shrink-0"
            >
              Instalar
            </button>
            <button
              type="button"
              onClick={() => {
                setCerrado(true);
                try {
                  localStorage.setItem(CLAVE_CERRADO, String(Date.now()));
                } catch {
                  /* nada */
                }
              }}
              className="p-1 -mr-1 text-[#E3E7EC]"
              aria-label="Ahora no"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {guia && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-end justify-center" onClick={() => setGuia(false)}>
          <div
            className="w-full max-w-md bg-white dark:bg-[#253240] rounded-t-[16px] p-5"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-['Poppins'] font-bold text-lg text-[#003A73] dark:text-white">Instalar ChatDos</h3>
              <button type="button" onClick={() => setGuia(false)} className="p-2 -mr-2 text-[#5B6670] dark:text-[#E3E7EC]" aria-label="Cerrar">
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {!enSafari ? (
              <>
                <p className="text-sm font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] leading-relaxed mb-4">
                  Abriste ChatDos dentro de otra app. En el iPhone solo se puede instalar desde <strong>Safari</strong>.
                </p>
                <a
                  href={`x-safari-${ENLACE}`}
                  className="w-full h-12 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <Compass className="w-5 h-5" strokeWidth={2} />
                  <span>Abrir en Safari</span>
                </a>
                <p className="mt-3 text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] leading-relaxed">
                  ¿No se abrió? Copia el enlace, abre Safari y pégalo arriba.
                </p>
                <button
                  type="button"
                  onClick={copiar}
                  className="mt-2 w-full h-11 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] text-[#005198] dark:text-white font-['Poppins'] font-semibold text-xs flex items-center justify-center gap-2"
                >
                  {copiado ? <Check className="w-4 h-4 text-[#1E7A44]" strokeWidth={2} /> : <Copy className="w-4 h-4" strokeWidth={2} />}
                  <span>{copiado ? 'Enlace copiado' : 'Copiar enlace'}</span>
                </button>
                <button type="button" onClick={() => setEnSafari(true)} className="mt-3 w-full text-xs font-['Inter'] text-[#005198] dark:text-[#E3E7EC] underline underline-offset-2">
                  Ya estoy en Safari
                </button>
              </>
            ) : (
              <>
                <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] mb-4">Son 3 toques. Solo se hace una vez.</p>
                <ol className="space-y-3">
                  <Paso n={1} icono={<IconoCompartir className="w-5 h-5" />}>
                    Toca <strong>Compartir</strong> en la barra de {esOtroNavegador ? 'arriba' : 'abajo'}.
                    <span className="block text-[11px] text-[#5B6670] dark:text-[#E3E7EC]">
                      Si no lo ves, toca primero los tres puntos <MoreHorizontal className="inline w-3.5 h-3.5" strokeWidth={2} />.
                    </span>
                  </Paso>
                  <Paso n={2} icono={<SquarePlus className="w-5 h-5" strokeWidth={2} />}>
                    Baja y toca <strong>Agregar a inicio</strong>.
                    <span className="block text-[11px] text-[#5B6670] dark:text-[#E3E7EC]">También puede decir «Añadir a pantalla de inicio».</span>
                  </Paso>
                  <Paso n={3} icono={<Check className="w-5 h-5" strokeWidth={2.5} />}>
                    Toca <strong>Agregar</strong> arriba a la derecha.
                  </Paso>
                </ol>
                <p className="mt-4 p-3 rounded-[5px] bg-[#F2F4F7] dark:bg-[#1F2933] text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] leading-relaxed">
                  Luego abre ChatDos desde el <strong>ícono nuevo</strong> de tu pantalla de inicio e inicia sesión ahí una sola vez.
                </p>
                <button type="button" onClick={() => setEnSafari(false)} className="mt-3 w-full text-xs font-['Inter'] text-[#005198] dark:text-[#E3E7EC] underline underline-offset-2">
                  No me aparece «Agregar a inicio»
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
