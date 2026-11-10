import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  MoreVertical,
  User,
  Settings,
  MessageSquare,
  UserPlus,
  LogOut,
  Sun,
  Moon,
  Monitor,
  ChevronLeft,
} from 'lucide-react';
import { Logo } from './Logo';
import { PWAInstallButton } from './PWAInstallButton';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { iniciarEnLinea } from '../lib/enLinea';

export const AppLayout: React.FC = () => {
  const { user, isAdmin, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isLoginPage = location.pathname === '/login';
  const isChatRoute = location.pathname.startsWith('/chat/');
  const isSubPage =
    location.pathname === '/invitar' ||
    location.pathname.startsWith('/invitado/') ||
    location.pathname === '/perfil' ||
    location.pathname === '/ajustes';

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const themeIcon = () => {
    if (theme === 'dark') return <Moon className="w-4 h-4 text-white" strokeWidth={2} />;
    if (theme === 'light') return <Sun className="w-4 h-4 text-white" strokeWidth={2} />;
    return <Monitor className="w-4 h-4 text-white" strokeWidth={2} />;
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/login');
  };

  const handleBack = () => navigate('/chats');

  // Punto verde de "en línea": se avisa mientras la app esté abierta
  useEffect(() => {
    if (user) iniciarEnLinea(user.id);
  }, [user]);

  return (
    <div className={`${isChatRoute ? 'h-[100dvh] overflow-hidden' : 'min-h-screen'} flex flex-col bg-[#F2F4F7] dark:bg-[#1F2933] text-[#1F2933] dark:text-[#FFFFFF] transition-colors`}>
      {/* Cabecera oficial: Fondo Azul Profundo #003A73 (se oculta en /chat/:chatId para dejar una sola cabecera) */}
      {!isChatRoute && (
        <header className="sticky top-0 z-40 bg-[#003A73] text-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          <div className="max-w-md mx-auto px-3 h-14 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {!isLoginPage && isSubPage && (
                <button
                  onClick={handleBack}
                  className="p-1.5 -ml-1 rounded-[5px] hover:bg-white/10 text-white min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors"
                  title="Volver"
                  aria-label="Volver"
                >
                  <ChevronLeft className="w-6 h-6" strokeWidth={2} />
                </button>
              )}

              <Link to={user ? '/chats' : '/login'} className="flex items-center gap-2">
                <Logo variant="white" layout="horizontal" cubeHeight={28} />
              </Link>
            </div>

            <div className="flex items-center gap-1">
              <PWAInstallButton />

              <button
                onClick={cycleTheme}
                className="p-2 rounded-[5px] hover:bg-white/10 transition-colors flex items-center justify-center min-w-[40px] min-h-[40px]"
                title="Cambiar tema visual"
                aria-label="Cambiar tema"
              >
                {themeIcon()}
              </button>

              {user && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="p-2 rounded-[5px] hover:bg-white/10 text-white transition-colors flex items-center justify-center min-w-[40px] min-h-[40px]"
                    title="Opciones"
                    aria-label="Menú de opciones"
                  >
                    <MoreVertical className="w-5 h-5 text-white" strokeWidth={2} />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-[#253240] rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.15)] border border-[#E3E7EC] dark:border-[#003A73] py-1 z-50 animate-in fade-in duration-100">
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          navigate('/chats');
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] flex items-center gap-2.5 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
                        <span>Mis Chats</span>
                      </button>
                      {isAdmin && (
                        <>

                          <button
                            onClick={() => {
                              setMenuOpen(false);
                              navigate('/invitar');
                            }}
                            className="w-full px-4 py-2.5 text-left text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] flex items-center gap-2.5 transition-colors"
                          >
                            <UserPlus className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
                            <span>Nuevo Invitado</span>
                          </button>

                          <div className="my-1 border-t border-[#E3E7EC] dark:border-[#003A73]" />
                        </>
                      )}

                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          navigate('/perfil');
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] flex items-center gap-2.5 transition-colors"
                      >
                        <User className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
                        <span>Mi Perfil</span>
                      </button>

                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          navigate('/ajustes');
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] flex items-center gap-2.5 transition-colors"
                      >
                        <Settings className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
                        <span>Ajustes</span>
                      </button>

                      <div className="my-1 border-t border-[#E3E7EC] dark:border-[#003A73]" />

                      <button
                        onClick={handleSignOut}
                        className="w-full px-4 py-2.5 text-left text-xs font-['Inter'] text-[#B03030] hover:bg-[#FDEBD3]/40 flex items-center gap-2.5 transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-[#B03030]" strokeWidth={2} />
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Contenido principal: en chat ocupa todo el alto sin márgenes exteriores para cabecera limpia */}
      <main className={`flex-1 w-full mx-auto flex flex-col ${isChatRoute ? 'p-0 h-full min-h-0 overflow-hidden' : 'max-w-md px-4 py-4'}`}>
        <Outlet />
      </main>
    </div>
  );
};
