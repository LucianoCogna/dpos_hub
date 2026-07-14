import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import cognaLogo from './images/cogna-light.svg';
import Planning from './views/Planning';
import Review from './views/Review';
import Indicadores from './views/Indicadores';
import Kanban from './views/Kanban';
import StatusReportV2 from './views/StatusReportV2';
import Entregas from './views/Entregas';
import Plataforma from './views/Plataforma';

const NAV = [
  { to: '/planning',     label: 'Planning'     },
  { to: '/kanban',       label: 'Kanban'       },
  { to: '/review',       label: 'Review'       },
  { to: '/indicadores',  label: 'Rewired'      },
  { to: '/entregas',         label: 'Entregas'         },
  { to: '/plataforma',       label: 'Plataforma'       },
  { to: '/status-report-v2', label: 'Status Report' },
];

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [dark]);

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={cognaLogo} alt="Cogna" className="h-8 w-auto dark:invert" />
            </div>
            <nav className="flex gap-1">
              {NAV.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
            <button
              onClick={() => setDark((d) => !d)}
              title={dark ? 'Modo claro' : 'Modo escuro'}
              className="ml-4 p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800 transition-colors text-lg"
            >
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
          <Routes>
            <Route path="/"         element={<Planning />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/kanban"   element={<Kanban />}   />
            <Route path="/review"   element={<Review />}   />
            <Route path="/indicadores"  element={<Indicadores />} />
            <Route path="/entregas"         element={<Entregas />}        />
            <Route path="/plataforma"       element={<Plataforma />}    />
            <Route path="/status-report-v2" element={<StatusReportV2 />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
