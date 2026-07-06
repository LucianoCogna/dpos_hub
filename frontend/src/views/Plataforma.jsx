import { useState, useEffect, useCallback } from 'react';
import { getPlataforma, getPrioridades, setPrioridade, deletePrioridade } from '../services/api';

const JIRA     = 'https://cogna.atlassian.net';
const DPO_LIST = ['Daniele', 'Luciano', 'Pauletti', 'Rosi'];

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
  Highest: { dot: 'bg-red-500'    },
  High:    { dot: 'bg-red-400'    },
  Medium:  { dot: 'bg-yellow-400' },
  Low:     { dot: 'bg-green-400'  },
  Lowest:  { dot: 'bg-green-300'  },
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
  const s = PRIORITY_STYLE[priority] || PRIORITY_STYLE.Medium;
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/* ─── Backlog: row individual ────────────────────────────────── */
function IssueRow({ item, prio }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors">
      <PriorityDot priority={item.priority} />

      {prio ? (
        <span
          title={`Prioridade ${prio.prioridade} · DPO: ${prio.dpo}`}
          className="text-xs font-bold w-8 text-center text-primary-600 dark:text-primary-400 flex-shrink-0"
        >
          #{prio.prioridade}
        </span>
      ) : (
        <span className="w-8 flex-shrink-0" />
      )}

      <a
        href={`${JIRA}/browse/${item.key}`}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-xs text-primary-600 dark:text-primary-400 hover:underline flex-shrink-0 w-24"
      >
        {item.key}
      </a>

      <TypeBadge type={item.type} />

      <span className="flex-1 text-sm text-gray-800 dark:text-gray-100 truncate" title={item.summary}>
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

/* ─── Backlog: grupo por épico ───────────────────────────────── */
function EpicGroup({ grupo, byKey, defaultOpen }) {
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
            <IssueRow key={it.key} item={it} prio={byKey[it.key]} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Aba Priorização ────────────────────────────────────────── */
function PriorizacaoView({ prios, backlogItems, dpo, onRefreshPrios }) {
  const [addMode,   setAddMode]   = useState(false);
  const [addForm,   setAddForm]   = useState({ key: '', prioridade: '', responsavel: '' });
  const [editKey,   setEditKey]   = useState(null);
  const [editForm,  setEditForm]  = useState({});
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState(null);

  const prioritizedKeys = new Set(prios.items.map((i) => i.key));
  const unprioritized   = backlogItems.filter((i) => !prioritizedKeys.has(i.key));

  const handleAdd = async () => {
    if (!addForm.key || !addForm.prioridade.trim()) return;
    setSaving(true); setFormError(null);
    try {
      const bi = backlogItems.find((i) => i.key === addForm.key);
      await setPrioridade(addForm.key, {
        dpo,
        prioridade:  addForm.prioridade.trim(),
        responsavel: addForm.responsavel.trim(),
        atividade:   bi?.summary || addForm.key,
      });
      setAddMode(false);
      setAddForm({ key: '', prioridade: '', responsavel: '' });
      await onRefreshPrios();
    } catch (e) {
      setFormError(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (key) => {
    setSaving(true); setFormError(null);
    try {
      const bi = backlogItems.find((i) => i.key === key);
      await setPrioridade(key, {
        dpo,
        prioridade:  editForm.prioridade.trim(),
        responsavel: editForm.responsavel.trim(),
        atividade:   bi?.summary || key,
      });
      setEditKey(null);
      await onRefreshPrios();
    } catch (e) {
      setFormError(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key) => {
    if (!window.confirm(`Remover priorização de ${key}?`)) return;
    setSaving(true); setFormError(null);
    try {
      await deletePrioridade(key, dpo);
      await onRefreshPrios();
    } catch (e) {
      setFormError(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {formError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <span className="flex-1">{formError}</span>
          <button onClick={() => setFormError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {prios.items.length > 0
            ? `${prios.items.length} item${prios.items.length !== 1 ? 's' : ''} priorizados`
            : 'Nenhum item priorizado ainda'}
        </p>
        {dpo ? (
          <button
            onClick={() => { setAddMode((m) => !m); setFormError(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            {addMode ? '✕ Cancelar' : '+ Adicionar priorização'}
          </button>
        ) : (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
            Selecione seu nome no campo "Você é:" para priorizar itens.
          </p>
        )}
      </div>

      {/* Formulário de adição */}
      {addMode && dpo && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Nova priorização — DPO: {dpo}</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Item (DDPL)</label>
              <select
                value={addForm.key}
                onChange={(e) => setAddForm((f) => ({ ...f, key: e.target.value }))}
                className={`${inputCls} min-w-[300px]`}
              >
                <option value="">Selecione o item…</option>
                {unprioritized.map((i) => (
                  <option key={i.key} value={i.key}>
                    {i.key} — {i.summary.length > 60 ? i.summary.slice(0, 60) + '…' : i.summary}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Ordem de prioridade</label>
              <input
                type="text"
                placeholder="Ex: 1, 2.1, 3"
                value={addForm.prioridade}
                onChange={(e) => setAddForm((f) => ({ ...f, prioridade: e.target.value }))}
                className={`${inputCls} w-36`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Responsável</label>
              <input
                type="text"
                placeholder="Nome do responsável"
                value={addForm.responsavel}
                onChange={(e) => setAddForm((f) => ({ ...f, responsavel: e.target.value }))}
                className={`${inputCls} w-44`}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={saving || !addForm.key || !addForm.prioridade.trim()}
              className="px-4 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Tabela de prioridades */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
              <th className="text-center px-4 py-3 w-20">Ordem</th>
              <th className="text-left   px-4 py-3 w-28">DDPL</th>
              <th className="text-left   px-4 py-3">Atividade</th>
              <th className="text-left   px-4 py-3 w-28">Dt Criação</th>
              <th className="text-left   px-4 py-3 w-28">Status</th>
              <th className="text-left   px-4 py-3 w-36">Responsável</th>
              <th className="text-left   px-4 py-3 w-28">DPO</th>
              <th className="text-center px-4 py-3 w-28">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {prios.items.map((item) => {
              const isOwner  = !!dpo && item.dpo === dpo;
              const isEditing = editKey === item.key;
              const bi       = backlogItems.find((i) => i.key === item.key);

              return (
                <tr
                  key={item.key}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors ${isOwner ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                >
                  {/* Ordem */}
                  <td className="text-center px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.prioridade}
                        onChange={(e) => setEditForm((f) => ({ ...f, prioridade: e.target.value }))}
                        className="w-16 border border-blue-300 dark:border-blue-600 rounded px-2 py-1 text-center text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    ) : (
                      <span className="text-lg font-black text-primary-600 dark:text-primary-400">{item.prioridade}</span>
                    )}
                  </td>

                  {/* DDPL key */}
                  <td className="px-4 py-3">
                    <a
                      href={`${JIRA}/browse/${item.key}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {item.key}
                    </a>
                  </td>

                  {/* Atividade */}
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-100 max-w-xs">
                    <span className="line-clamp-2">{bi?.summary || item.atividade}</span>
                  </td>

                  {/* Dt Criação */}
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs tabular-nums">
                    {fmtDate(bi?.created)}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5">
                      {bi?.status || '—'}
                    </span>
                  </td>

                  {/* Responsável */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.responsavel}
                        onChange={(e) => setEditForm((f) => ({ ...f, responsavel: e.target.value }))}
                        className="border border-blue-300 dark:border-blue-600 rounded px-2 py-1 text-sm w-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    ) : (
                      <span className="text-gray-700 dark:text-gray-300">{item.responsavel || '—'}</span>
                    )}
                  </td>

                  {/* DPO */}
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isOwner ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                      {item.dpo}
                    </span>
                  </td>

                  {/* Ações */}
                  <td className="px-4 py-3 text-center">
                    {isOwner ? (
                      isEditing ? (
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => handleSaveEdit(item.key)}
                            disabled={saving}
                            className="text-xs px-2.5 py-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => { setEditKey(null); setFormError(null); }}
                            className="text-xs px-2.5 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => {
                              setEditKey(item.key);
                              setEditForm({ prioridade: item.prioridade, responsavel: item.responsavel });
                              setFormError(null);
                            }}
                            className="text-xs px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/40 rounded-lg transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(item.key)}
                            disabled={saving}
                            className="text-xs px-2.5 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/40 rounded-lg transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      )
                    ) : (
                      <span title={`Travado por ${item.dpo}`} className="text-gray-300 dark:text-gray-600 text-lg select-none">🔒</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {prios.items.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400 dark:text-gray-600 text-sm">
                  Nenhum item priorizado. {dpo ? 'Clique em "+ Adicionar priorização" para começar.' : 'Selecione seu nome para começar.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Componente principal ───────────────────────────────────── */
export default function Plataforma() {
  const [dpo,        setDpo]        = useState(() => localStorage.getItem('plataforma_dpo') || '');
  const [tab,        setTab]        = useState('backlog');
  const [data,       setData]       = useState(null);
  const [prios,      setPrios]      = useState({ items: [], byKey: {} });
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [search,     setSearch]     = useState('');
  const [filterType, setFilterType] = useState('');

  const loadPrios = useCallback(
    () => getPrioridades().then(setPrios).catch(() => {}),
    []
  );

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([getPlataforma(), getPrioridades()])
      .then(([d, p]) => { setData(d); setPrios(p); })
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDpoChange = (name) => {
    setDpo(name);
    localStorage.setItem('plataforma_dpo', name);
  };

  // Todos os itens em lista plana (para a aba de priorização)
  const allItems = (data?.grupos || []).flatMap((g) => g.items);

  // Grupos filtrados para a aba Backlog
  const grupos = (data?.grupos || [])
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        const matchSearch = !search ||
          it.summary.toLowerCase().includes(search.toLowerCase()) ||
          it.key.toLowerCase().includes(search.toLowerCase());
        const matchType = !filterType || it.type === filterType;
        return matchSearch && matchType;
      }),
    }))
    .filter((g) => g.items.length > 0);

  const totalFiltrado = grupos.reduce((s, g) => s + g.items.length, 0);
  const tipos = data ? Object.keys(data.por_tipo).sort() : [];

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Plataforma — Backlog</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            DDPLs sem sprint definida · [Dados] Plataforma
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Você é:
            </label>
            <input
              list="dpo-list"
              value={dpo}
              onChange={(e) => handleDpoChange(e.target.value)}
              placeholder="Selecione seu nome"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-44"
            />
            <datalist id="dpo-list">
              {DPO_LIST.map((n) => <option key={n} value={n} />)}
            </datalist>
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
      </div>

      {/* ── Stats ── */}
      {data && (
        <div className="flex flex-wrap gap-3">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-3 shadow-sm">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Total no Backlog</div>
            <div className="text-3xl font-black text-primary-600 dark:text-primary-400">{data.total}</div>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-3 shadow-sm">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Priorizados</div>
            <div className="text-3xl font-black text-green-600 dark:text-green-400">{prios.items.length}</div>
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

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'backlog',      label: 'Backlog'      },
          { id: 'priorizacao',  label: 'Priorização', badge: prios.items.length || null },
        ].map(({ id, label, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 -mb-px ${
              tab === id
                ? 'border-primary-600 text-primary-700 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {label}
            {badge != null && (
              <span className="text-xs bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-full px-1.5 py-0.5 font-semibold">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Filtros (só no Backlog) ── */}
      {tab === 'backlog' && (
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
            {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {(search || filterType) && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {totalFiltrado} resultado{totalFiltrado !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* ── Erro global ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <strong>Erro:</strong> {error}
        </div>
      )}

      {/* ── Skeleton ── */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Conteúdo das abas ── */}
      {!loading && tab === 'backlog' && (
        <>
          {grupos.length > 0 ? (
            <div className="space-y-3">
              {grupos.map((g, i) => (
                <EpicGroup key={g.key} grupo={g} byKey={prios.byKey} defaultOpen={i < 5} />
              ))}
            </div>
          ) : data && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 text-sm">
              Nenhum item encontrado com os filtros atuais.
            </div>
          )}
        </>
      )}

      {!loading && tab === 'priorizacao' && (
        <PriorizacaoView
          prios={prios}
          backlogItems={allItems}
          dpo={dpo}
          onRefreshPrios={loadPrios}
        />
      )}
    </div>
  );
}
