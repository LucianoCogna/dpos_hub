import { useState, useEffect, useCallback, useRef } from 'react';
import { getPlataforma, getPrioridades, setPrioridade, reorderPrioridades, deletePrioridade } from '../services/api';

const JIRA = 'https://cogna.atlassian.net';

const TYPE_STYLE = {
  'Épico':                  { icon: '⚡', bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300' },
  'História':               { icon: '📋', bg: 'bg-sky-100 dark:bg-sky-900/40',       text: 'text-sky-700 dark:text-sky-300'       },
  'Subtarefa':              { icon: '↳',  bg: 'bg-gray-100 dark:bg-gray-700',        text: 'text-gray-600 dark:text-gray-300'     },
  'Bug':                    { icon: '🐛', bg: 'bg-red-100 dark:bg-red-900/40',       text: 'text-red-700 dark:text-red-300'       },
  'Problema':               { icon: '⚠️', bg: 'bg-red-100 dark:bg-red-900/40',       text: 'text-red-700 dark:text-red-300'       },
  'Débito Técnico':         { icon: '🔧', bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300' },
  'Solicitação de Serviço': { icon: '📥', bg: 'bg-teal-100 dark:bg-teal-900/40',     text: 'text-teal-700 dark:text-teal-300'     },
  'Incidente':              { icon: '🚨', bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300' },
};

const PRIORITY_STYLE = {
  Highest: { dot: 'bg-red-500'    },
  High:    { dot: 'bg-red-400'    },
  Medium:  { dot: 'bg-amber-400'  },
  Low:     { dot: 'bg-green-400'  },
  Lowest:  { dot: 'bg-green-300'  },
};

const STATUS_STYLE = {
  'Backlog':      { bg: 'bg-gray-100 dark:bg-gray-700',         text: 'text-gray-600 dark:text-gray-300'   },
  'Em Andamento': { bg: 'bg-blue-100 dark:bg-blue-900/40',      text: 'text-blue-700 dark:text-blue-300'   },
  'Homologação':  { bg: 'bg-amber-100 dark:bg-amber-900/40',    text: 'text-amber-700 dark:text-amber-300' },
  'Concluído':    { bg: 'bg-green-100 dark:bg-green-900/40',    text: 'text-green-700 dark:text-green-300' },
  'Bloqueado':    { bg: 'bg-red-100 dark:bg-red-900/40',        text: 'text-red-700 dark:text-red-300'     },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${String(y).slice(2)}`;
}

function daysSince(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / 86_400_000);
}

function TypeBadge({ type }) {
  const s = TYPE_STYLE[type] || { icon: '📄', bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text} whitespace-nowrap`}>
      {s.icon} {type}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-400' };
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${s.bg} ${s.text}`}>
      {status || '—'}
    </span>
  );
}

// ── Cabeçalho fixo da tabela ──────────────────────────────────────────────────

function TableHeader() {
  return (
    <thead>
      <tr className="bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        <th className="px-3 py-2.5 text-left w-6"></th>
        <th className="px-3 py-2.5 text-left w-28">Chave</th>
        <th className="px-3 py-2.5 text-left">Resumo</th>
        <th className="px-3 py-2.5 text-left w-36">Status do DDPL</th>
        <th className="px-3 py-2.5 text-left w-44">Etiquetas</th>
        <th className="px-3 py-2.5 text-center w-28">Criado há</th>
        <th className="px-3 py-2.5 text-center w-28">1ª Resposta</th>
        <th className="px-3 py-2.5 text-left w-36">Criador</th>
        <th className="px-3 py-2.5 text-left w-36">Responsável</th>
      </tr>
    </thead>
  );
}

// ── Linha de issue ────────────────────────────────────────────────────────────

function IssueRow({ item }) {
  const dot  = (PRIORITY_STYLE[item.priority] || PRIORITY_STYLE.Medium).dot;
  const dias = daysSince(item.created);

  return (
    <tr className="border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
      {/* Ponto de prioridade */}
      <td className="px-3 py-2.5">
        <span className={`inline-block w-2 h-2 rounded-full ${dot}`} title={item.priority} />
      </td>

      {/* Chave */}
      <td className="px-3 py-2.5">
        <a
          href={`${JIRA}/browse/${item.key}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
        >
          {item.key}
        </a>
      </td>

      {/* Resumo */}
      <td className="px-3 py-2.5 max-w-0">
        <span className="block text-sm text-gray-800 dark:text-gray-100 truncate" title={item.summary}>
          {item.summary}
        </span>
      </td>

      {/* Status do DDPL */}
      <td className="px-3 py-2.5">
        <StatusBadge status={item.status} />
      </td>

      {/* Etiquetas */}
      <td className="px-3 py-2.5">
        {item.labels && item.labels.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {item.labels.slice(0, 3).map((l) => (
              <span key={l} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded px-1.5 py-0.5 truncate max-w-[100px]" title={l}>
                {l}
              </span>
            ))}
            {item.labels.length > 3 && (
              <span className="text-xs text-gray-400">+{item.labels.length - 3}</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
        )}
      </td>

      {/* Criado há (dias) */}
      <td className="px-3 py-2.5 text-center">
        {dias !== null ? (
          <div className="flex flex-col items-center leading-tight">
            <span className={`text-sm font-bold tabular-nums ${
              dias > 60 ? 'text-red-600 dark:text-red-400' :
              dias > 30 ? 'text-amber-600 dark:text-amber-400' :
              'text-gray-700 dark:text-gray-300'
            }`}>
              {dias}d
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
              {fmtDate(item.created)}
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
        )}
      </td>

      {/* Data de 1ª resposta */}
      <td className="px-3 py-2.5 text-center">
        {item.first_response ? (
          <span className="text-xs tabular-nums text-gray-700 dark:text-gray-300">
            {fmtDate(item.first_response)}
          </span>
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
        )}
      </td>

      {/* Criador */}
      <td className="px-3 py-2.5">
        {item.reporter ? (
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-2 py-0.5 truncate max-w-[130px] block" title={item.reporter}>
            {item.reporter}
          </span>
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
        )}
      </td>

      {/* Responsável */}
      <td className="px-3 py-2.5">
        {item.assignee ? (
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-2 py-0.5 truncate max-w-[130px] block" title={item.assignee}>
            {item.assignee}
          </span>
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
        )}
      </td>
    </tr>
  );
}

// ── Vista Backlog (tabela plana) ──────────────────────────────────────────────

function BacklogView({ items }) {
  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 text-sm">
        Nenhum item encontrado com os filtros atuais.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm overflow-x-auto">
      <table className="w-full text-sm min-w-[900px] border-collapse">
        <TableHeader />
        <tbody>
          {items.map((it) => <IssueRow key={it.key} item={it} />)}
        </tbody>
      </table>
    </div>
  );
}

// ── Aba Priorização ────────────────────────────────────────────────────────────

function SearchableSelect({ options, value, onChange, placeholder = 'Selecione o item…' }) {
  const [search, setSearch] = useState('');
  const [open,   setOpen]   = useState(false);
  const ref                  = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(
    (o) => o.label.toLowerCase().includes(search.toLowerCase()) ||
           o.value.toLowerCase().includes(search.toLowerCase())
  );
  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative min-w-[340px]">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 text-left flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
        <span className={selected ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="text-gray-400 text-xs shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input autoFocus type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por chave ou título…"
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">Nenhum resultado</li>
            )}
            {filtered.map((o) => (
              <li key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30 ${
                  o.value === value ? 'bg-primary-50 dark:bg-primary-900/30 font-semibold' : ''
                }`}>
                {o.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PriorizacaoView({ prios, backlogItems, onRefreshPrios }) {
  const [addMode,   setAddMode]   = useState(false);
  const [addForm,   setAddForm]   = useState({ key: '', responsavel: '' });
  const [editKey,   setEditKey]   = useState(null);
  const [editForm,  setEditForm]  = useState({});
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState(null);
  const [dragKey,   setDragKey]   = useState(null);
  const [dragOver,  setDragOver]  = useState(null);

  const prioritizedKeys = new Set(prios.items.map((i) => i.key));
  const unprioritized   = backlogItems.filter((i) => !prioritizedKeys.has(i.key));

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  const handleDragStart = (e, key) => {
    setDragKey(key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, key) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (key !== dragOver) setDragOver(key);
  };

  const handleDragEnd = () => { setDragKey(null); setDragOver(null); };

  const handleDrop = async (e, targetKey) => {
    e.preventDefault();
    if (!dragKey || dragKey === targetKey) { handleDragEnd(); return; }
    setSaving(true); setFormError(null);
    try {
      const items    = [...prios.items];
      const fromIdx  = items.findIndex((i) => i.key === dragKey);
      const toIdx    = items.findIndex((i) => i.key === targetKey);
      const [moved]  = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      await reorderPrioridades(items.map((i) => ({ key: i.key })));
      await onRefreshPrios();
    } catch (err) {
      setFormError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
      handleDragEnd();
    }
  };

  // ── Adicionar ──────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!addForm.key) return;
    setSaving(true); setFormError(null);
    try {
      const bi       = backlogItems.find((i) => i.key === addForm.key);
      const nextPrio = String(prios.items.length + 1);
      await setPrioridade(addForm.key, {
        prioridade:  nextPrio,
        responsavel: addForm.responsavel.trim(),
        atividade:   bi?.summary || addForm.key,
      });
      setAddMode(false);
      setAddForm({ key: '', responsavel: '' });
      await onRefreshPrios();
    } catch (e) {
      setFormError(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Salvar edição ──────────────────────────────────────────────────────────
  const handleSaveEdit = async (key) => {
    setSaving(true); setFormError(null);
    try {
      const bi = backlogItems.find((i) => i.key === key);
      await setPrioridade(key, {
        prioridade:  prios.items.find((i) => i.key === key)?.prioridade || '0',
        responsavel: editForm.responsavel,
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

  // ── Remover ────────────────────────────────────────────────────────────────
  const handleDelete = async (key) => {
    if (!window.confirm(`Remover priorização de ${key}?`)) return;
    setSaving(true); setFormError(null);
    try {
      await deletePrioridade(key);
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
      {/* Erro */}
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
            ? `${prios.items.length} item${prios.items.length !== 1 ? 's' : ''} priorizados · arraste para reordenar`
            : 'Nenhum item priorizado ainda'}
        </p>
        <button
          onClick={() => { setAddMode((m) => !m); setFormError(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          {addMode ? '✕ Cancelar' : '+ Adicionar'}
        </button>
      </div>

      {/* Form de adição */}
      {addMode && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Nova priorização</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Item (DDPL)</label>
              <SearchableSelect
                value={addForm.key}
                onChange={(val) => setAddForm((f) => ({ ...f, key: val }))}
                options={unprioritized.map((i) => ({
                  value: i.key,
                  label: `${i.key} — ${i.summary.length > 70 ? i.summary.slice(0, 70) + '…' : i.summary}`,
                }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Responsável</label>
              <input type="text" placeholder="Nome" value={addForm.responsavel}
                onChange={(e) => setAddForm((f) => ({ ...f, responsavel: e.target.value }))}
                className={`${inputCls} w-44`} />
            </div>
            <button onClick={handleAdd} disabled={saving || !addForm.key}
              className="px-4 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors">
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
              <th className="px-3 py-3 w-8"></th>
              <th className="text-center px-3 py-3 w-16">#</th>
              <th className="text-left   px-3 py-3 w-28">DDPL</th>
              <th className="text-left   px-3 py-3">Atividade</th>
              <th className="text-left   px-3 py-3 w-28">Status</th>
              <th className="text-left   px-3 py-3">Etiquetas</th>
              <th className="text-center px-3 py-3 w-16">SP</th>
              <th className="text-left   px-3 py-3 w-36">Responsável</th>
              <th className="text-center px-3 py-3 w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {prios.items.map((item, idx) => {
              const isEditing = editKey === item.key;
              const bi        = backlogItems.find((i) => i.key === item.key);
              const isDragging  = dragKey  === item.key;
              const isDropTarget = dragOver === item.key;

              return (
                <tr
                  key={item.key}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.key)}
                  onDragOver={(e)  => handleDragOver(e, item.key)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e)      => handleDrop(e, item.key)}
                  className={`border-t border-gray-100 dark:border-gray-700 transition-all
                    ${isDragging   ? 'opacity-40 bg-blue-50 dark:bg-blue-900/20' : ''}
                    ${isDropTarget && !isDragging ? 'border-t-2 border-t-primary-500 bg-primary-50/40 dark:bg-primary-900/20' : ''}
                    ${!isDragging && !isDropTarget ? 'hover:bg-gray-50 dark:hover:bg-gray-800/60' : ''}
                  `}
                >
                  {/* Handle */}
                  <td className="px-3 py-3 text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing select-none text-base text-center">
                    ⠿
                  </td>

                  {/* Ordem */}
                  <td className="text-center px-3 py-3">
                    <span className="text-base font-black text-primary-600 dark:text-primary-400">{idx + 1}</span>
                  </td>

                  {/* Chave */}
                  <td className="px-3 py-3">
                    <a href={`${JIRA}/browse/${item.key}`} target="_blank" rel="noreferrer"
                       className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                      {item.key}
                    </a>
                  </td>

                  {/* Atividade */}
                  <td className="px-3 py-3 text-gray-800 dark:text-gray-100 max-w-xs">
                    <span className="line-clamp-2 text-sm">{bi?.summary || item.atividade}</span>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3">
                    <StatusBadge status={bi?.status || '—'} />
                  </td>

                  {/* Etiquetas */}
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(bi?.labels || []).length > 0
                        ? (bi.labels).map((l) => (
                            <span key={l} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                              {l}
                            </span>
                          ))
                        : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                      }
                    </div>
                  </td>

                  {/* Story Points (somente leitura — vem do Jira) */}
                  <td className="px-3 py-3 text-center">
                    {bi?.story_points != null ? (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-bold">
                        {bi.story_points}
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                    )}
                  </td>

                  {/* Responsável */}
                  <td className="px-3 py-3">
                    {isEditing ? (
                      <input type="text" value={editForm.responsavel}
                        onChange={(e) => setEditForm((f) => ({ ...f, responsavel: e.target.value }))}
                        className="border border-blue-300 dark:border-blue-600 rounded px-2 py-1 text-sm w-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200" />
                    ) : (
                      <span className="text-gray-700 dark:text-gray-300 text-sm">{item.responsavel || '—'}</span>
                    )}
                  </td>

                  {/* Ações */}
                  <td className="px-3 py-3 text-center">
                    {isEditing ? (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => handleSaveEdit(item.key)} disabled={saving}
                          className="text-xs px-2.5 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg">✓</button>
                        <button onClick={() => setEditKey(null)}
                          className="text-xs px-2.5 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg">✕</button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => { setEditKey(item.key); setEditForm({ responsavel: item.responsavel || '' }); setFormError(null); }}
                          className="text-xs px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 rounded-lg">
                          Editar
                        </button>
                        <button onClick={() => handleDelete(item.key)} disabled={saving}
                          className="text-xs px-2.5 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 rounded-lg">
                          ✕
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {prios.items.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-400 dark:text-gray-600 text-sm">
                  Nenhum item priorizado. Clique em "+ Adicionar" para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function Plataforma() {
  const [tab,        setTab]        = useState('backlog');
  const [data,       setData]       = useState(null);
  const [prios,      setPrios]      = useState({ items: [], byKey: {} });
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [search,       setSearch]       = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterLabel,  setFilterLabel]  = useState('');

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

  const allItems = data?.items || [];

  const itemsFiltrados = allItems.filter((it) => {
    const matchSearch = !search ||
      it.summary.toLowerCase().includes(search.toLowerCase()) ||
      it.key.toLowerCase().includes(search.toLowerCase());
    const matchType  = !filterType  || it.type === filterType;
    const matchLabel = !filterLabel || (it.labels || []).includes(filterLabel);
    return matchSearch && matchType && matchLabel;
  });

  const tipos  = data ? Object.keys(data.por_tipo).sort() : [];
  const labels = [...new Set(allItems.flatMap((it) => it.labels || []))].sort();

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
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {loading
              ? <><span className="w-3.5 h-3.5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /> Carregando…</>
              : '↻ Atualizar'}
          </button>
        </div>
      </div>

      {/* Stats */}
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
            const s = TYPE_STYLE[tipo] || { icon: '📄', bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' };
            return (
              <div key={tipo} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.icon} {tipo}</span>
                <span className="text-2xl font-black text-gray-800 dark:text-gray-100">{qtd}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'backlog',      label: 'Backlog' },
          { id: 'em-andamento', label: 'Em Andamento', badge: allItems.filter(i => i.status === 'Em Andamento').length || null },
          { id: 'bloqueadas',   label: 'Bloqueadas',   badge: allItems.filter(i => ['Bloqueado', 'Blocked', 'Impedido'].includes(i.status)).length || null },
          { id: 'priorizacao',  label: 'Priorização',  badge: prios.items.length || null },
        ].map(({ id, label, badge }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 -mb-px ${
              tab === id
                ? 'border-primary-600 text-primary-700 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}>
            {label}
            {badge != null && (
              <span className="text-xs bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-full px-1.5 py-0.5 font-semibold">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filtros (só Backlog) */}
      {tab === 'backlog' && (
        <div className="flex items-center gap-3 flex-wrap">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por chave ou título…"
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[240px]"
          />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">Todos os tipos</option>
            {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterLabel} onChange={(e) => setFilterLabel(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">Todas as etiquetas</option>
            {labels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          {(search || filterType || filterLabel) && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{itemsFiltrados.length} resultado{itemsFiltrados.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => { setSearch(''); setFilterType(''); setFilterLabel(''); }}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline"
              >
                limpar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <strong>Erro:</strong> {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      )}

      {/* Conteúdo das abas */}
      {!loading && tab === 'backlog' && (
        <BacklogView items={itemsFiltrados.filter(i => i.status === 'Backlog')} />
      )}

      {!loading && tab === 'em-andamento' && (
        <BacklogView items={allItems.filter(i => i.status === 'Em Andamento')} />
      )}

      {!loading && tab === 'bloqueadas' && (
        <BacklogView items={allItems.filter(i => ['Bloqueado', 'Blocked', 'Impedido'].includes(i.status))} />
      )}

      {!loading && tab === 'priorizacao' && (
        <PriorizacaoView
          prios={prios}
          backlogItems={allItems}
          onRefreshPrios={loadPrios}
        />
      )}
    </div>
  );
}
