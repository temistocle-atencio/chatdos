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
    <div className="fixed bottom-16 left-4 right-4 z-50 max-w-md mx-auto p-2.5 rounded-[5px] bg-[#FDEBD3] text-[#8A4B00] shadow-[0_2px_8px_rgba(0,0,0,0.1)] flex items-center justify-between text-xs font-['Inter']">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-[#8A4B00] shrink-0" strokeWidth={2} />
        <span>Sin conexión. Los mensajes se guardarán para enviarse al reconectar.</span>
      </div>
    </div>
  );
};
