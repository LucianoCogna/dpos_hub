import { useState, useEffect, useRef } from 'react';
import StatusBadge from '../components/StatusBadge';
import KanbanIssueModal from '../components/KanbanIssueModal';
import { getMacroprocessos, transitionIssue } from '../services/api';

const JIRA_BASE = 'https://cogna.atlassian.net';

const STATUSES = [
  'Funil',
  'Backlog',
  'Refinamento',
  'Em Andamento',
  'Pronto',
  'Homologação',
  'Bloqueado',
  'Concluído',
  'Aceito',
];

const TYPE_CONFIG = {
  epic:  { label: 'Épico',    icon: '⚡', border: 'border-l-violet-400',  badge: 'bg-violet-100 text-violet-700' },
  story: { label: 'História', icon: '📋', border: 'border-l-sky-400',     badge: 'bg-sky-100 text-sky-700'      },
};

function EpicCard({ epic, onDragStart, transitioning, onClick }) {
  const cfg = TYPE_CONFIG[epic.type] || TYPE_CONFIG.story;
  return (
    <div
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart(e, epic); }}
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 border-l-4 ${cfg.border} p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow select-none ${
        transitioning ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-1 gap-1">
        <a
          href={`${JIRA_BASE}/browse/${epic.key}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-primary-600 dark:text-primary-400 hover:underline"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        >
          {epic.key}
        </a>
        <span className={`text-xs font-medium rounded-full px-1.5 py-0.5 flex-shrink-0 ${cfg.badge}`}>
          {cfg.icon} {cfg.label}
        </span>
      </div>
      <p className="text-sm text-gray-800 dark:text-gray-100 leading-snug mb-2" title={epic.summary}>
        {epic.summary}
      </p>
      {epic.type === 'story' && epic.parent_summary && (
        <p className="text-xs text-gray-400 truncate mb-1" title={epic.parent_summary}>
          ↳ {epic.parent_summary}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 mt-1">
        {epic.assignee && (
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-2 py-0.5 truncate">
            {epic.assignee}
          </span>
        )}
        {transitioning && (
          <span className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}
      </div>
    </div>
  );
}

function KanbanColumn({ status, epics, onDrop, onDragOver, onDragLeave, isDragOver, transitioning, onCardClick }) {
  return (
    <div className="flex flex-col min-w-[240px] max-w-[280px] flex-shrink-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <StatusBadge status={status} size="sm" />
        <span className="text-xs font-semibold text-gray-500">{epics.length}</span>
      </div>
      <div
        onDrop={(e) => onDrop(e, status)}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`flex flex-col gap-2 min-h-[80px] rounded-xl p-2 transition-colors ${
          isDragOver
            ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-dashed border-primary-300'
            : 'bg-gray-50 dark:bg-gray-900 border-2 border-transparent'
        }`}
      >
        {epics.map((epic) => (
          <EpicCard
            key={epic.key}
            epic={epic}
            transitioning={transitioning === epic.key}
            onClick={() => onCardClick(epic.key)}
            onDragStart={(e, ep) => {
              e.dataTransfer.setData('epicKey', ep.key);
              e.dataTransfer.effectAllowed = 'move';
            }}
          />
        ))}
        {epics.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-4">
            <span className="text-xs text-gray-300 italic">vazio</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Kanban() {
  const [epics, setEpics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const [transitioning, setTransitioning] = useState(null);
  const [transitionError, setTransitionError] = useState(null);
  const dragKey = useRef(null);

  const load = () => {
    setLoading(true);
    getMacroprocessos()
      .then(setEpics)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCardClick = (key) => setSelectedIssue(key);

  const handleModalStatusChange = (key, newStatus) => {
    setEpics((prev) => prev.map((e) => e.key === key ? { ...e, status: newStatus } : e));
  };

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    setDragOverStatus(null);
    const epicKey = e.dataTransfer.getData('epicKey') || dragKey.current;
    if (!epicKey) return;

    const epic = epics.find((ep) => ep.key === epicKey);
    if (!epic || epic.status === targetStatus) return;

    const prevStatus = epic.status;
    setTransitionError(null);
    setTransitioning(epicKey);

    // Atualiza localmente de imediato (optimistic)
    setEpics((prev) => prev.map((ep) => ep.key === epicKey ? { ...ep, status: targetStatus } : ep));

    try {
      await transitionIssue(epicKey, targetStatus);
    } catch (err) {
      // Reverte se falhar
      setEpics((prev) => prev.map((ep) => ep.key === epicKey ? { ...ep, status: prevStatus } : ep));
      const msg = err.response?.data?.error || err.message;
      const available = err.response?.data?.available;
      setTransitionError(`${epicKey}: ${msg}${available ? ` (disponíveis: ${available.join(', ')})` : ''}`);
    } finally {
      setTransitioning(null);
      dragKey.current = null;
    }
  };

  const assignees = [...new Set(epics.map((e) => e.assignee).filter(Boolean))].sort();

  const getProject = (key) => key?.split('-')[0] || '';

  const filtered = epics
    .filter((e) => !filterAssignee || e.assignee === filterAssignee)
    .filter((e) => !filterType     || e.type === filterType)
    .filter((e) => !filterProject  || getProject(e.key) === filterProject);

  const byStatus = STATUSES.reduce((acc, s) => {
    acc[s] = filtered.filter((e) => e.status === s);
    return acc;
  }, {});

  const others = filtered.filter((e) => !STATUSES.includes(e.status));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kanban — Macroprocessos</h1>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              Carregando…
            </>
          ) : (
            '↻ Atualizar'
          )}
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todos responsáveis</option>
          {assignees.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Épicos e Histórias</option>
          <option value="epic">⚡ Apenas Épicos</option>
          <option value="story">📋 Apenas Histórias</option>
        </select>

        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todos os projetos</option>
          <option value="DAPL">DAPL</option>
          <option value="DCOD">DCOD</option>
          <option value="DDPL">DDPL</option>
          <option value="DENA">DENA</option>
        </select>

        <span className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} itens</span>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm animate-pulse">
          Carregando épicos do Jira…
        </div>
      )}

      {transitionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start justify-between gap-3">
          <span><strong>Erro ao mover:</strong> {transitionError}</span>
          <button onClick={() => setTransitionError(null)} className="text-red-400 hover:text-red-700 text-lg leading-none flex-shrink-0">×</button>
        </div>
      )}

      {!loading && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                epics={byStatus[status]}
                transitioning={transitioning}
                isDragOver={dragOverStatus === status}
                onCardClick={handleCardClick}
                onDragOver={(e) => { handleDragOver(e); setDragOverStatus(status); }}
                onDragLeave={() => setDragOverStatus(null)}
                onDrop={handleDrop}
              />
            ))}
            {others.length > 0 && (
              <KanbanColumn
                status="Outros"
                epics={others}
                transitioning={transitioning}
                isDragOver={dragOverStatus === 'Outros'}
                onCardClick={handleCardClick}
                onDragOver={(e) => { handleDragOver(e); setDragOverStatus('Outros'); }}
                onDragLeave={() => setDragOverStatus(null)}
                onDrop={handleDrop}
              />
            )}
          </div>
        </div>
      )}

      {selectedIssue && (
        <KanbanIssueModal
          issueKey={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onStatusChange={handleModalStatusChange}
        />
      )}
    </div>
  );
}
