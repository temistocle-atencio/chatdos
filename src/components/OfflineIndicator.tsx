import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 max-w-[92%] px-3 py-1.5 rounded-[5px] bg-[#FDEBD3] text-[#8A4B00] shadow-[0_2px_8px_rgba(0,0,0,0.1)] flex items-center gap-2 text-xs font-['Inter'] pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top) + 4rem)' }}
      role="status"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#8A4B00] shrink-0" strokeWidth={2} />
      <span>Sin conexión · lo que escribas se enviará al volver</span>
    </div>
  );
};
