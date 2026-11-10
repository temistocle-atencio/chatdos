import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { revisarLlaveLocal } from '../lib/crypto';
import { memoria } from '../lib/memoria';

const revisados = new Set<string>();

/**
 * Una vez por sesión revisa que la llave de cifrado de este celular sea la de la cuenta.
 * Si no lo es (se creó otra en otro lugar), guarda esta como anterior y pide la contraseña de respaldo.
 */
export const RevisarLlave: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || revisados.has(user.id)) return;
    let vivo = true;
    const revisar = () => {
      if (!navigator.onLine || revisados.has(user.id)) return;
      revisarLlaveLocal(user.id).then((r) => {
        if (r === 'desconocido') return; // sin internet o sin llave aquí: se intenta otra vez luego
        revisados.add(user.id);
        if (r === 'distinta' && vivo) {
          memoria.llaveLista.delete(user.id);
          memoria.llaves.clear(); // las llaves de chat calculadas con la llave anterior ya no sirven
          navigate('/llave/recuperar', { replace: true, state: { llaveCambiada: true } });
        }
      });
    };
    revisar();
    window.addEventListener('online', revisar);
    return () => {
      vivo = false;
      window.removeEventListener('online', revisar);
    };
  }, [user, navigate]);

  return null;
};
