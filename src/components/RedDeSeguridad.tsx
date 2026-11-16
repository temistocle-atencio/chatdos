import React from 'react';

/**
 * Si algo falla al dibujar una pantalla, en vez de quedar la pantalla vacía (oscura)
 * se muestra un aviso con un botón para volver a abrir la app. El detalle ayuda a encontrar el error.
 */
export class RedDeSeguridad extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ChatDos] Falla en pantalla', error);
    // Si fue porque una parte de la app cambió con una versión nueva, recargar lo arregla (una sola vez)
    if (/dynamically imported module|Failed to fetch|Loading chunk|import/i.test(error.message) && !sessionStorage.getItem('chatdos:recargaFalla')) {
      sessionStorage.setItem('chatdos:recargaFalla', '1');
      location.reload();
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 px-6 text-center bg-[#F2F4F7] dark:bg-[#1F2933]">
        <p className="font-['Poppins'] font-semibold text-base text-[#003A73] dark:text-white">Algo no cargó bien</p>
        <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">Tus mensajes están a salvo. Toca el botón para abrir de nuevo.</p>
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem('chatdos:recargaFalla');
            location.hash = '#/chats';
            location.reload();
          }}
          className="h-11 px-6 rounded-[5px] bg-[#005198] text-white text-sm font-['Poppins'] font-semibold"
        >
          Abrir de nuevo
        </button>
        <p className="mt-2 text-[10px] font-mono text-[#5B6670] dark:text-[#9AA5B1] break-all max-w-xs">{this.state.error.message.slice(0, 160)}</p>
      </div>
    );
  }
}
