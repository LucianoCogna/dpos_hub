import { useState, useEffect } from 'react';
import { getPlataforma } from '../services/api';

const JIRA = 'https://cogna.atlassian.net';

const TYPE_STYLE = {
  'Épico':                  { icon: '⚡', bg: 'bg-violet-100', text: 'text-violet-700' },
  'História':               { icon: '📋', bg: 'bg-sky-100',    text: 'text-sky-700'    },
  'Subtarefa':              { icon: '↳',  bg: 'bg-gray-100',   text: 'text-gray-600'   },
  'Bug':                    { icon: '🐛', bg: 'bg-red-100',    text: 'text-red-700'    },
  'Problema':               { icon: '⚠️', bg: 'bg-red-100',    text: 'text-red-700'    },
  'Débito Técnico':         { icon: '🔧', bg: 'bg-orange-100', text: 'text-orange-700' },
  'Solicitação de Serviço': { icon: '📥', bg: 'bg-teal-100',   text: 'text-teal-700'   },
  'Incidente':              { icon: '🚨', bg: 'bg-orange-100', text: 'text-orange-700' },
};

const PRIORITY_STYLE = {
  'Highest': { dot: 'bg-red-500',    label: 'Highest' },
  'High':    { dot: 'bg-red-400',    label: 'High'    },
  'Medium':  { dot: 'bg-yellow-400', label: 'Medium'  },
  'Low':     { dot: 'bg-green-400',  label: 'Low'     },
  'Lowest':  { dot: 'bg-green-300',  label: 'Lowest'  },
};

function TypeBadge({ type }) {
  const s = TYPE_STYLE[type] || { icon: '📄', bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text} whitespace-nowrap`}>
      {s.icon} {type}
    </span>
  );
}

function PriorityDot({ priority }) {
  const s = PRIORITY_STYLE[priority] || PRIORITY_STYLE['Medium'];
  return (
    <span title={s.label} className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
  );
}

function IssueRow({ item }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors">
      <PriorityDot priority={item.priority} />

      <a
        href={`${JIRA}/browse/${item.key}`}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-xs text-primary-600 dark:text-primary-400 hover:underline flex-shrink-0 w-24"
      >
        {item.key}
      </a>

      <TypeBadge type={item.type} />

      <span
        className="flex-1 text-sm text-gray-800 dark:text-gray-100 truncate"
        title={item.summary}
      >
        {item.summary}
      </span>

      {item.assignee ? (
        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-2 py-0.5 flex-shrink-0 max-w-[140px] truncate">
          {item.assignee}
        </span>
      ) : (
        <span className="text-xs text-gray-300 dark:text-gray-600 flex-shrink-0">— sem responsável</span>
      )}
    </div>
  );
}

function EpicGroup({ grupo, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  const isSemEpico = grupo.key === 'SEM_EPICO';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors text-left"
      >
        <span className="text-gray-400 text-xs w-4 flex-shrink-0">{open ? '▼' : '▶'}</span>

        {!isSemEpico && (
          <a
            href={`${JIRA}/browse/${grupo.key}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs text-primary-600 dark:text-primary-400 hover:underline flex-shrink-0"
          >
            {grupo.key}
          </a>
        )}

        <span className={`text-sm font-semibold flex-1 truncate ${isSemEpico ? 'text-gray-400 italic' : 'text-gray-800 dark:text-gray-100'}`}>
          {grupo.summary}
        </span>

        <span className="text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-full px-2.5 py-0.5 flex-shrink-0">
          {grupo.items.length} {grupo.items.length === 1 ? 'item' : 'itens'}
        </span>
      </button>

      {open && (
        <div>
          {grupo.items.map((it) => (
            <IssueRow key={it.key} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Plataforma() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [search,  setSearch]  = useState('');
  const [filterType, setFilterType] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    getPlataforma()
      .then(setData)
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Filtra itens dentro de cada grupo
  const grupos = (data?.grupos || []).map((g) => ({
    ...g,
    items: g.items.filter((it) => {
      const matchSearch = !search ||
        it.summary.toLowerCase().includes(search.toLowerCase()) ||
        it.key.toLowerCase().includes(search.toLowerCase());
      const matchType = !filterType || it.type === filterType;
      return matchSearch && matchType;
    }),
  })).filter((g) => g.items.length > 0);

  const totalFiltrado = grupos.reduce((s, g) => s + g.items.length, 0);

  const tipos = data ? Object.keys(data.por_tipo).sort() : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Plataforma — Backlog</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            DDPLs sem sprint definida · [Dados] Plataforma
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {loading
            ? <><span className="w-3.5 h-3.5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /> Carregando…</>
            : '↻ Atualizar'}
        </button>
      </div>

      {/* Stats */}
      {data && (
        <div className="flex flex-wrap gap-3">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-3 shadow-sm">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Total no Backlog</div>
            <div className="text-3xl font-black text-primary-600 dark:text-primary-400">{data.total}</div>
          </div>
          {Object.entries(data.por_tipo).sort((a, b) => b[1] - a[1]).map(([tipo, qtd]) => {
            const s = TYPE_STYLE[tipo] || { icon: '📄', bg: 'bg-gray-100', text: 'text-gray-600' };
            return (
              <div key={tipo} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.icon} {tipo}</span>
                <span className="text-2xl font-black text-gray-800 dark:text-gray-100">{qtd}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por chave ou título…"
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[240px]"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {(search || filterType) && (
          <span className="text-sm text-gray-500 dark:text-gray-400">{totalFiltrado} resultado{totalFiltrado !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <strong>Erro:</strong> {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      )}

      {/* Groups */}
      {!loading && grupos.length > 0 && (
        <div className="space-y-3">
          {grupos.map((g, i) => (
            <EpicGroup key={g.key} grupo={g} defaultOpen={i < 5} />
          ))}
        </div>
      )}

      {!loading && data && grupos.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 text-sm">
          Nenhum item encontrado com os filtros atuais.
        </div>
      )}
    </div>
  );
}
