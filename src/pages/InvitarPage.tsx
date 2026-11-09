import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export const InvitarPage: React.FC = () => {
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estado para la tarjeta de cuenta recién creada
  const [createdData, setCreatedData] = useState<{
    usuario: string;
    clave: string;
    nombre: string;
    chatId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Generador de contraseña segura y legible de 12 caracteres
  const generatePassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    let res = '';
    const array = new Uint32Array(12);
    crypto.getRandomValues(array);
    for (let i = 0; i < 12; i++) {
      res += chars[array[i] % chars.length];
    }
    setClave(res);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback manual si clipboard API no responde
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanNombre = nombre.trim();
    const cleanUser = usuario.trim().toLowerCase();

    if (!cleanNombre || cleanNombre.length > 40) {
      setErrorMsg('El nombre debe tener entre 1 y 40 caracteres.');
      return;
    }

    const userRegex = /^[a-z0-9._]{3,20}$/;
    if (!userRegex.test(cleanUser)) {
      setErrorMsg('El usuario debe tener entre 3 y 20 caracteres (solo letras minúsculas, números, punto o guion bajo).');
      return;
    }

    if (clave.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      // Llamada a la Edge Function admin-invitados según el contrato
      const { data, error } = await supabase.functions.invoke('admin-invitados', {
        body: {
          accion: 'crear',
          nombre: cleanNombre,
          usuario: cleanUser,
          clave,
        },
      });

      if (error) {
        // En caso de error de red o función
        setErrorMsg(error.message || 'Error al comunicarse con la función de administración.');
        return;
      }

      if (data?.error) {
        // Si la función responde con { error: 'mensaje en español' } se muestra tal cual
        setErrorMsg(data.error);
        return;
      }

      if (data?.ok) {
        setCreatedData({
          usuario: cleanUser,
          clave,
          nombre: cleanNombre,
          chatId: data.chat_id,
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Ocurrió un error inesperado al crear la cuenta.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-8">
      <div className="w-10 h-[3px] bg-[#F28C1B] mb-2"></div>
      <h1 className="font-['Poppins'] font-bold text-xl text-[#003A73] dark:text-white mb-1">
        Crear Cuenta de Invitado
      </h1>
      <p className="text-xs text-[#5B6670] dark:text-[#E3E7EC] font-['Inter'] mb-5">
        Genera el acceso para una nueva persona. Solo el administrador puede invitar.
      </p>

      {/* Si se acaba de crear, mostramos la tarjeta con los datos para copiar */}
      {createdData ? (
        <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73] space-y-4">
          <div className="flex items-center gap-2 text-[#1E7A44]">
            <ShieldCheck className="w-5 h-5 text-[#1E7A44]" strokeWidth={2} />
            <h2 className="font-['Poppins'] font-semibold text-sm">
              ¡Cuenta creada correctamente!
            </h2>
          </div>

          <p className="text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC]">
            Copia y comparte estos datos de acceso con <strong>{createdData.nombre}</strong>:
          </p>

          <div className="p-3.5 bg-[#F2F4F7] dark:bg-[#1F2933] rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] font-mono text-xs text-[#1F2933] dark:text-white space-y-2 select-all">
            <div>
              <span className="text-[#5B6670] dark:text-[#E3E7EC]">Usuario:</span>{' '}
              <span className="font-bold text-[#005198] dark:text-[#F28C1B]">{createdData.usuario}</span>
            </div>
            <div>
              <span className="text-[#5B6670] dark:text-[#E3E7EC]">Contraseña:</span>{' '}
              <span className="font-bold">{createdData.clave}</span>
            </div>
          </div>

          {/* Aviso según el manual de marca */}
          <div className="p-3 rounded-[5px] bg-[#FDEBD3] text-[#8A4B00] border border-[#F28C1B]/30 flex items-start gap-2 text-xs font-['Inter']">
            <AlertTriangle className="w-4 h-4 text-[#8A4B00] shrink-0 mt-0.5" strokeWidth={2} />
            <span>
              <strong>Importante:</strong> Esta contraseña no se vuelve a mostrar por motivos de seguridad. Cópiala ahora antes de salir.
            </span>
          </div>

          {/* Botones secundarios (azul) y botón principal (naranja) */}
          <div className="space-y-2 pt-2">
            <button
              onClick={() =>
                copyToClipboard(
                  `Tus datos de acceso a ChatDos:\nUsuario: ${createdData.usuario}\nContraseña: ${createdData.clave}`
                )
              }
              className="w-full h-11 rounded-[5px] bg-[#005198] text-white font-['Poppins'] font-semibold text-xs flex items-center justify-center gap-2 hover:bg-[#003A73] transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-white" strokeWidth={2} />
                  <span>¡Datos copiados al portapapeles!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-white" strokeWidth={2} />
                  <span>Copiar Datos de Acceso</span>
                </>
              )}
            </button>

            {/* Único botón naranja en esta pantalla de éxito */}
            <button
              onClick={() => navigate(`/chat/${createdData.chatId}`)}
              className="w-full h-12 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:brightness-105 transition-all"
            >
              <span>Ir al Chat con {createdData.nombre}</span>
              <ArrowRight className="w-4 h-4 text-[#1F2933]" strokeWidth={2} />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-[5px] bg-[#FDEBD3] text-[#B03030] border border-[#F28C1B]/30 text-xs font-['Inter']">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-['Poppins'] uppercase tracking-wider text-[#5B6670] dark:text-[#E3E7EC] mb-1 font-medium">
                Nombre de la Persona
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Ana Gómez"
                maxLength={40}
                disabled={loading}
                className="w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-['Poppins'] uppercase tracking-wider text-[#5B6670] dark:text-[#E3E7EC] mb-1 font-medium">
                Usuario (3-20 caracteres)
              </label>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                placeholder="ana.gomez"
                maxLength={20}
                disabled={loading}
                className="w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198] transition-all"
              />
              <p className="text-[11px] text-[#5B6670] dark:text-[#E3E7EC] mt-1 font-['Inter']">
                Solo minúsculas, números, puntos y guiones bajos.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-['Poppins'] uppercase tracking-wider text-[#5B6670] dark:text-[#E3E7EC] font-medium">
                  Contraseña (mínimo 8 caracteres)
                </label>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="text-xs text-[#005198] dark:text-[#F28C1B] hover:underline flex items-center gap-1 font-['Poppins'] font-semibold"
                >
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>Generar</span>
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  disabled={loading}
                  className="flex-1 h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-mono text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198] transition-all"
                />
                {clave && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(clave)}
                    className="px-3 h-11 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] text-[#5B6670] hover:text-[#005198] dark:text-[#E3E7EC] flex items-center justify-center transition-colors"
                    title="Copiar contraseña"
                  >
                    {copied ? <Check className="w-4 h-4 text-[#1E7A44]" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            {/* Único botón naranja en esta pantalla */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-4 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:brightness-105 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4 text-[#1F2933]" strokeWidth={2} />
              <span>{loading ? 'Creando cuenta...' : 'Crear Cuenta de Invitado'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
