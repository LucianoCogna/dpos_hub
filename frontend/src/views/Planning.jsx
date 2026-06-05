import { useState, useEffect, useMemo, useCallback } from 'react';
import StatusBadge from '../components/StatusBadge';
import CardModal from '../components/CardModal';
import {
  getSprints,
  getSprint,
  addCard,
  updateCard,
  deleteCard,
  syncSprintJira,
  createSprint,
} from '../services/api';

const JIRA_BASE = 'https://cogna.atlassian.net';


const COL = [
  { key: '#',              label: '#',             sortable: false, w: 'w-8'   },
  { key: 'squad',          label: 'Squad',         w: 'min-w-[120px]'          },
  { key: 'sprint_planning',label: 'Sprint',        w: 'min-w-[80px]'           },
  { key: 'time',           label: 'Time',          w: 'min-w-[150px]'          },
  { key: 'dpo',            label: 'DPO',           w: 'min-w-[80px]'           },
  { key: 'sprint_inicio',  label: 'Sprint Início', w: 'min-w-[90px]'           },
  { key: 'card',           label: 'Card',          w: 'min-w-[90px]'           },
  { key: 'tema',           label: 'Tema',          w: 'min-w-[220px] max-w-xs' },
  { key: 'notas_planning', label: 'Notas',         w: 'min-w-[140px]'          },
  { key: 'encaixe_sprint', label: 'Encaixe?',      w: 'min-w-[80px]'           },
  { key: 'status',         label: 'Status',        w: 'min-w-[120px]'          },
  { key: 'acoes',          label: 'Ações',         sortable: false, w: 'w-16'  },
];

function SortTh({ col, label, sortCol, sortDir, onSort, className = '' }) {
  const active = sortCol === col;
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-gray-900 transition-colors ${className}`}
    >
      {label}
      <span className="ml-1 text-gray-300">{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </th>
  );
}

export default function Planning() {
  const [sprints, setSprints] = useState([]);
  const [sprintId, setSprintId] = useState('');
  const [sprint, setSprint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filterDpo, setFilterDpo] = useState('');
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [editingNotes, setEditingNotes] = useState(null);
  const [notesValue, setNotesValue] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [newSprintInput, setNewSprintInput] = useState('');

  useEffect(() => {
    getSprints()
      .then((data) => {
        setSprints(data);
        if (data.length > 0) setSprintId(data[0].id);
      })
      .catch(() => {});
  }, []);

  const loadSprint = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getSprint(id);
      setSprint(data);
      setLoading(false);
      if (data.cards?.length > 0) {
        setSyncing(true);
        syncSprintJira(id)
          .then((synced) => setSprint(synced))
          .catch(() => {})
          .finally(() => setSyncing(false));
      }
    } catch {
      setSprint({ id, cards: [] });
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSprint(sprintId);
  }, [sprintId, loadSprint]);

  const handleSync = async () => {
    if (!sprintId) return;
    setSyncing(true);
    try {
      const synced = await syncSprintJira(sprintId);
      setSprint(synced);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateSprint = async () => {
    const id = newSprintInput.trim();
    if (!id) return;
    await createSprint({ id });
    const updated = await getSprints();
    setSprints(updated);
    setSprintId(id);
    setNewSprintInput('');
  };

  const handleSort = (col) => {
    setSortCol((prev) => {
      if (prev === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else setSortDir('asc');
      return col;
    });
  };

  const cards = sprint?.cards || [];

  const dpos = useMemo(
    () => [...new Set(cards.map((c) => c.dpo).filter(Boolean))].sort(),
    [cards]
  );

  const filtered = filterDpo ? cards.filter((c) => c.dpo === filterDpo) : cards;

  const sorted = useMemo(() => {
    if (!sortCol || sortCol === '#') return filtered;
    return [...filtered].sort((a, b) => {
      const av = String(a[sortCol] ?? '');
      const bv = String(b[sortCol] ?? '');
      const cmp = av.localeCompare(bv, 'pt-BR');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const countsByTime = useMemo(
    () => cards.reduce((acc, c) => { acc[c.time] = (acc[c.time] || 0) + 1; return acc; }, {}),
    [cards]
  );

  const handleSaveNotes = async (cardKey) => {
    try {
      await updateCard(sprintId, cardKey, { notas_planning: notesValue });
      setSprint((prev) => ({
        ...prev,
        cards: prev.cards.map((c) =>
          c.card === cardKey ? { ...c, notas_planning: notesValue } : c
        ),
      }));
    } finally {
      setEditingNotes(null);
    }
  };

  const handleModalSave = async (form) => {
    if (editingCard) {
      await updateCard(sprintId, editingCard.card, form);
    } else {
      await addCard(sprintId, form);
    }
    await loadSprint(sprintId);
    setModalOpen(false);
    setEditingCard(null);
  };

  const handleDelete = async (cardKey) => {
    if (!window.confirm(`Remover o card ${cardKey}?`)) return;
    await deleteCard(sprintId, cardKey);
    setSprint((prev) => ({
      ...prev,
      cards: prev.cards.filter((c) => c.card !== cardKey),
    }));
  };

  const exportCsv = () => {
    const headers = [
      'Squad','Sprint Planning','Time','DPO','Sprint Início',
      'Card','Tema','Notas da Planning','É encaixe?','Status',
    ];
    const rows = cards.map((c) => [
      c.squad, c.sprint_planning, c.time, c.dpo, c.sprint_inicio,
      c.card, c.tema, c.notas_planning, c.encaixe_sprint ? 'Sim' : 'Não',
      c.status_jira || c.status_fim_sprint,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planning-${sprintId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Título */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Planning</h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {syncing ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              Sincronizando…
            </>
          ) : (
            '↻ Sincronizar Jira'
          )}
        </button>
      </div>

      {/* Barra de filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={sprintId}
          onChange={(e) => setSprintId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              Sprint {s.id}
            </option>
          ))}
        </select>

        <select
          value={filterDpo}
          onChange={(e) => setFilterDpo(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todos DPOs</option>
          {dpos.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        {/* Nova sprint inline */}
        <div className="flex items-center gap-1">
          <input
            value={newSprintInput}
            onChange={(e) => setNewSprintInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateSprint()}
            placeholder="Nova sprint (ex: 26.3.1)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handleCreateSprint}
            disabled={!newSprintInput.trim()}
            className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
          >
            +
          </button>
        </div>

        <div className="flex-1" />

        <button
          onClick={exportCsv}
          disabled={cards.length === 0}
          className="px-3 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          Exportar CSV
        </button>

        <button
          onClick={() => { setEditingCard(null); setModalOpen(true); }}
          className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Novo
        </button>
      </div>

      {/* Resumo da sprint */}
      {sprint && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 font-medium text-gray-800">
              <span>Sprint {sprint.id}</span>
              <span className="text-gray-300">—</span>
              <span className="text-gray-600">G&C</span>
              {filterDpo && (
                <>
                  <span className="text-gray-300">—</span>
                  <span className="text-gray-600">{filterDpo}</span>
                </>
              )}
            </div>
            <span className="text-gray-500">{filtered.length} cards</span>
          </div>
          {Object.keys(countsByTime).length > 0 && (
            <div className="flex flex-wrap gap-x-4 mt-1.5">
              {Object.entries(countsByTime).map(([time, count]) => (
                <span key={time} className="text-xs text-gray-500">
                  {time} ({count})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm animate-pulse">
          Carregando…
        </div>
      )}

      {/* Tabela */}
      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">
                  #
                </th>
                {COL.slice(1).map((col) =>
                  col.sortable === false ? (
                    <th
                      key={col.key}
                      className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ) : (
                    <SortTh
                      key={col.key}
                      col={col.key}
                      label={col.label}
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((c, idx) => (
                <tr key={c.card} className={idx % 2 === 1 ? 'bg-gray-50/60' : 'bg-white'}>
                  <td className="px-3 py-2.5 text-xs text-gray-400 text-center">{idx + 1}</td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{c.squad}</td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{c.sprint_planning}</td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{c.time}</td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{c.dpo}</td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{c.sprint_inicio}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <a
                      href={`${JIRA_BASE}/browse/${c.card}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-primary-600 hover:text-primary-800 hover:underline"
                    >
                      {c.card}
                    </a>
                  </td>
                  <td className="px-3 py-2.5 max-w-xs">
                    <span className="block truncate text-gray-700" title={c.tema}>
                      {c.tema || '—'}
                    </span>
                  </td>

                  {/* Notas com edição inline */}
                  <td
                    className="px-3 py-2.5 min-w-[140px] cursor-text"
                    onClick={() => {
                      if (editingNotes !== c.card) {
                        setEditingNotes(c.card);
                        setNotesValue(c.notas_planning || '');
                      }
                    }}
                  >
                    {editingNotes === c.card ? (
                      <input
                        autoFocus
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        onBlur={() => handleSaveNotes(c.card)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveNotes(c.card);
                          if (e.key === 'Escape') setEditingNotes(null);
                        }}
                        className="w-full border border-primary-400 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-gray-500 text-xs hover:text-gray-700 block truncate" title={c.notas_planning}>
                        {c.notas_planning || <span className="italic text-gray-300">clique para editar</span>}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    {c.encaixe_sprint ? (
                      <span className="text-green-600 text-xs">✅ Sim</span>
                    ) : (
                      <span className="text-gray-400 text-xs">❌ Não</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <StatusBadge status={c.status_jira || c.status_fim_sprint} />
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button
                        title="Editar"
                        onClick={() => { setEditingCard(c); setModalOpen(true); }}
                        className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                      >
                        ✏️
                      </button>
                      <button
                        title="Remover"
                        onClick={() => handleDelete(c.card)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {sorted.length === 0 && (
                <tr>
                  <td colSpan={COL.length} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Nenhum card encontrado. Use <strong>+ Novo</strong> para adicionar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <CardModal
          sprintId={sprintId}
          card={editingCard}
          dpos={dpos}
          onClose={() => { setModalOpen(false); setEditingCard(null); }}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
}
