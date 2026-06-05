import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

export default function ChatButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {/* Chat window */}
      <div
        className={`fixed right-6 z-50 w-[360px] h-[480px] rounded-2xl shadow-2xl overflow-hidden flex flex-col
          transition-all duration-300 origin-bottom-right
          ${open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
        style={{ bottom: '90px' }}
      >
        <div className="flex items-center justify-between px-5 py-4 bg-primary-600">
          <div className="flex items-center gap-2.5">
            <MessageCircle size={18} className="text-white" strokeWidth={2} />
            <span className="text-white font-semibold text-sm">Assistente DPOs</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-primary-200 hover:text-white transition-colors"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 bg-white flex items-center justify-center">
          <p className="text-sm text-gray-400 italic">Em breve…</p>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed z-50 flex items-center justify-center rounded-full shadow-lg transition-transform duration-200 hover:scale-110 active:scale-95"
        style={{ bottom: '24px', right: '24px', width: '56px', height: '56px', backgroundColor: '#8629ff' }}
        aria-label={open ? 'Fechar assistente' : 'Abrir assistente'}
      >
        <div className={`transition-transform duration-200 ${open ? 'rotate-90' : 'rotate-0'}`}>
          {open
            ? <X size={22} className="text-white" strokeWidth={2.5} />
            : <MessageCircle size={22} className="text-white" strokeWidth={2} />}
        </div>
      </button>
    </>
  );
}
