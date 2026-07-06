import { useState, useEffect } from 'react';
import { getIndicadores } from '../services/api';

const JIRA = 'https://cogna.atlassian.net';

// ── Cores por status ──────────────────────────────────────────────────────────
const STATUS_CFG = {
  'Backlog':       { bg: 'bg-gray-100 dark:bg-gray-700',     text: 'text-gray-600 dark:text-gray-300'   },
  'Em Andamento':  { bg: 'bg-blue-100 dark:bg-blue-900/40',  text: 'text-blue-700 dark:text-blue-300'   },
  'In Progress':   { bg: 'bg-blue-100 dark:bg-blue-900/40',  text: 'text-blue-700 dark:text-blue-300'   },
  'Homologação':   { bg: 'bg-amber-100 dark:bg-amber-900/40',text: 'text-amber-700 dark:text-amber-300' },
  'Code Review':   { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300' },
  'Concluído':     { bg: 'bg-green-100 dark:bg-green-900/40',text: 'text-green-700 dark:text-green-300' },
  'Done':          { bg: 'bg-green-100 dark:bg-green-900/40',text: 'text-green-700 dark:text-green-300' },
  'Aceito':        { bg: 'bg-green-100 dark:bg-green-900/40',text: 'text-green-700 dark:text-green-300' },
  'Bloqueado':     { bg: 'bg-red-100 dark:bg-red-900/40',    text: 'text-red-700 dark:text-red-300'     },
};

// Cores de acento por projeto
const PROJ_ACCENT = {
  CRPR: { bar: 'bg-violet-500', badge: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  CRMI: { bar: 'bg-sky-500',    badge: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',             dot: 'bg-sky-500'    },
  CRVE: { bar: 'bg-emerald-500',badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
};

const PRIORITY_DOT = {
  Highest: 'bg-red-500', High: 'bg-red-400', Medium: 'bg-amber-400', Low: 'bg-green-400', Lowest: 'bg-green-300',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = STATUS_CFG[status] || { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-400' };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${s.bg} ${s.text}`}>
      {status}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${String(y).slice(2)}`;
}

// ── Linha de issue ────────────────────────────────────────────────────────────

function IssueRow({ item }) {
  const dot = PRIORITY_DOT[item.priority] || PRIORITY_DOT.Medium;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700/50 last:border-0 transition-colors group">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} title={item.priority} />

      <a
        href={`${JIRA}/browse/${item.key}`}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex-shrink-0 w-24"
      >
        {item.key}
      </a>

      <span className="flex-1 text-sm text-gray-800 dark:text-gray-100 truncate" title={item.summary}>
        {item.summary}
      </span>

      <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 hidden sm:block tabular-nums">
        {fmtDate(item.updated)}
      </span>

      <StatusBadge status={item.status} />
    </div>
  );
}

// ── Card de engenheiro ────────────────────────────────────────────────────────

function EngineerCard({ name, issues, projKey }) {
  const [open, setOpen] = useState(true);
  const accent = PROJ_ACCENT[projKey] || PROJ_ACCENT.CRPR;

  const statusCount = issues.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});

  const done = issues.filter((i) =>
    ['Concluído', 'Done', 'Aceito'].includes(i.status)
  ).length;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors"
      >
        <span className="text-base">👤</span>
        <span className="font-semibold text-sm text-gray-800 dark:text-gray-100 flex-1">{name}</span>

        {/* Mini status pills */}
        <div className="hidden sm:flex items-center gap-1.5 mr-2">
          {Object.entries(statusCount).slice(0, 4).map(([s, n]) => (
            <span key={s} className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${(STATUS_CFG[s] || {bg:'bg-gray-100 dark:bg-gray-700',text:'text-gray-500'}).bg} ${(STATUS_CFG[s] || {bg:'',text:'text-gray-500'}).text}`}>
              {n} {s}
            </span>
          ))}
        </div>

        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${accent.badge} flex-shrink-0`}>
          {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
        </span>

        {done > 0 && (
          <span className="text-xs text-green-600 dark:text-green-400 flex-shrink-0 hidden md:block">
            ✓ {done} concluído{done > 1 ? 's' : ''}
          </span>
        )}

        <span className="text-gray-400 text-xs w-4 flex-shrink-0">{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <div>
          {issues.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Sem issues abertas.</p>
          ) : (
            issues.map((it) => <IssueRow key={it.key} item={it} />)
          )}
        </div>
      )}
    </div>
  );
}

// ── Seção de projeto ──────────────────────────────────────────────────────────

function ProjectSection({ projKey, data }) {
  const [open, setOpen] = useState(true);
  const accent = PROJ_ACCENT[projKey] || PROJ_ACCENT.CRPR;

  const engineers = Object.entries(data.byAssignee);
  const hasOthers = data.outros && data.outros.length > 0;

  return (
    <div className="space-y-2">
      {/* Project header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 py-2 text-left group"
      >
        <span className={`w-1 h-6 rounded-full flex-shrink-0 ${accent.dot}`} />
        <span className="text-base font-black text-gray-900 dark:text-gray-100 tracking-tight">
          {data.name}
        </span>
        <span className="font-mono text-xs text-gray-400 dark:text-gray-500">({projKey})</span>
        <span className={`ml-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${accent.badge}`}>
          {data.total} issues
        </span>
        <span className="text-gray-400 text-xs ml-auto">{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <div className="pl-4 space-y-2">
          {engineers.map(([eng, issues]) => (
            <EngineerCard key={eng} name={eng} issues={issues} projKey={projKey} />
          ))}
          {hasOthers && (
            <EngineerCard name="Outros / Sem atribuição" issues={data.outros} projKey={projKey} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

const PROJ_ORDER = ['CRPR', 'CRMI', 'CRVE'];

export default function Indicadores() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState('TODOS');
  const [search,  setSearch]  = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    getIndicadores()
      .then(setData)
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Stats globais
  const totalGlobal = data
    ? PROJ_ORDER.reduce((s, k) => s + (data[k]?.total || 0), 0)
    : 0;

  // Aplica filtro de projeto e busca por texto
  const projsToShow = PROJ_ORDER.filter((k) => {
    if (filter !== 'TODOS' && filter !== k) return false;
    if (!data?.[k]) return false;
    return true;
  });

  // Filtra issues dentro dos projetos por texto
  function filterData(projData) {
    if (!search) return projData;
    const q = search.toLowerCase();
    const filterIssues = (issues) =>
      issues.filter((i) =>
        i.key.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q)
      );
    const byAssignee = {};
    for (const [eng, issues] of Object.entries(projData.byAssignee)) {
      byAssignee[eng] = filterIssues(issues);
    }
    return {
      ...projData,
      byAssignee,
      outros: filterIssues(projData.outros || []),
      total: Object.values(byAssignee).reduce((s, a) => s + a.length, 0) + filterIssues(projData.outros || []).length,
    };
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Indicadores</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Demandas ativas por engenheiro · Pricing · Mídia · Conversão
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro de projeto */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
            {['TODOS', 'CRPR', 'CRMI', 'CRVE'].map((k) => {
              const labels = { TODOS: 'Todos', CRPR: 'Pricing', CRMI: 'Mídia', CRVE: 'Conversão' };
              const active = filter === k;
              const accent = k !== 'TODOS' ? PROJ_ACCENT[k] : null;
              return (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors border-r border-gray-200 dark:border-gray-700 last:border-0 ${
                    active
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {labels[k]}
                  {!active && data?.[k] && (
                    <span className="ml-1 text-gray-400 dark:text-gray-500">({data[k].total})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Busca */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar issue ou título…"
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-48"
          />

          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading
              ? <><span className="w-3.5 h-3.5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />Carregando…</>
              : '↻ Atualizar'}
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      {data && (
        <div className="flex flex-wrap gap-3">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-3 shadow-sm">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Total Ativas</div>
            <div className="text-3xl font-black text-gray-900 dark:text-gray-100">{totalGlobal}</div>
          </div>
          {PROJ_ORDER.map((k) => {
            if (!data[k]) return null;
            const accent = PROJ_ACCENT[k];
            return (
              <div
                key={k}
                onClick={() => setFilter(filter === k ? 'TODOS' : k)}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-sm flex items-center gap-3 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${accent.dot}`} />
                <div>
                  <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide leading-none mb-0.5">
                    {data[k].name}
                  </div>
                  <div className="text-2xl font-black text-gray-900 dark:text-gray-100 leading-none">
                    {data[k].total}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Erro ── */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <strong>Erro ao carregar:</strong> {error}
        </div>
      )}

      {/* ── Skeleton ── */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-8 w-48 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
              <div className="h-32 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* ── Projetos ── */}
      {!loading && data && (
        <div className="space-y-6">
          {projsToShow.map((k) => (
            <ProjectSection key={k} projKey={k} data={filterData(data[k])} />
          ))}
        </div>
      )}

      {!loading && data && projsToShow.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 text-sm">
          Nenhum dado encontrado.
        </div>
      )}
    </div>
  );
}
