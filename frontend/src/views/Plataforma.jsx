import { useState, useEffect, useCallback } from 'react';
import { getPlataforma, getPrioridades, setPrioridade, deletePrioridade } from '../services/api';

const JIRA     = 'https://cogna.atlassian.net';
const DPO_LIST = ['Daniele', 'Luciano', 'Pauletti', 'Rosi'];

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
        <th className="px-3 py-2.5 text-left w-32">Tipo</th>
        <th className="px-3 py-2.5 text-left">Resumo</th>
        <th className="px-3 py-2.5 text-left w-36">Status do DDPL</th>
        <th className="px-3 py-2.5 text-left w-44">Etiquetas</th>
        <th className="px-3 py-2.5 text-center w-28">Criado há</th>
        <th className="px-3 py-2.5 text-center w-28">1ª Resposta</th>
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

      {/* Tipo */}
      <td className="px-3 py-2.5">
        <TypeBadge type={item.type} />
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

// ── Grupo por épico (agora como tbody dentro de uma tabela compartilhada) ─────

function EpicGroup({ grupo, byKey }) {
  const [open, setOpen] = useState(true);
  const isSemEpico = grupo.key === 'SEM_EPICO';

  return (
    <tbody>
      {/* Linha de cabeçalho do épico */}
      <tr
        className="bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <td colSpan={9} className="px-3 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs w-3">{open ? '▼' : '▶'}</span>

            {!isSemEpico && (
              <a
                href={`${JIRA}/browse/${grupo.key}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex-shrink-0"
              >
                {grupo.key}
              </a>
            )}

            <span className={`text-sm font-semibold truncate ${isSemEpico ? 'text-gray-400 italic' : 'text-gray-800 dark:text-gray-100'}`}>
              {grupo.summary}
            </span>

            <span className="ml-auto text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-full px-2.5 py-0.5 flex-shrink-0">
              {grupo.items.length} {grupo.items.length === 1 ? 'item' : 'itens'}
            </span>
          </div>
        </td>
      </tr>

      {/* Linhas de issues */}
      {open && grupo.items.map((it) => (
        <IssueRow key={it.key} item={it} />
      ))}
    </tbody>
  );
}

// ── Vista Backlog (tabela) ────────────────────────────────────────────────────

function BacklogView({ grupos, byKey }) {
  if (grupos.length === 0) {
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
        {grupos.map((g) => (
          <EpicGroup key={g.key} grupo={g} byKey={byKey} />
        ))}
      </table>
    </div>
  );
}

// ── Aba Priorização ────────────────────────────────────────────────────────────

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
      {formError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <span className="flex-1">{formError}</span>
          <button onClick={() => setFormError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

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
              <input type="text" placeholder="Ex: 1, 2.1" value={addForm.prioridade}
                onChange={(e) => setAddForm((f) => ({ ...f, prioridade: e.target.value }))}
                className={`${inputCls} w-36`} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Responsável</label>
              <input type="text" placeholder="Nome" value={addForm.responsavel}
                onChange={(e) => setAddForm((f) => ({ ...f, responsavel: e.target.value }))}
                className={`${inputCls} w-44`} />
            </div>
            <button onClick={handleAdd} disabled={saving || !addForm.key || !addForm.prioridade.trim()}
              className="px-4 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors">
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

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
                <tr key={item.key} className={`hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors ${isOwner ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                  <td className="text-center px-4 py-3">
                    {isEditing ? (
                      <input type="text" value={editForm.prioridade}
                        onChange={(e) => setEditForm((f) => ({ ...f, prioridade: e.target.value }))}
                        className="w-16 border border-blue-300 dark:border-blue-600 rounded px-2 py-1 text-center text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200" />
                    ) : (
                      <span className="text-lg font-black text-primary-600 dark:text-primary-400">{item.prioridade}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <a href={`${JIRA}/browse/${item.key}`} target="_blank" rel="noreferrer"
                       className="font-mono text-xs text-primary-600 dark:text-primary-400 hover:underline">
                      {item.key}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-100 max-w-xs">
                    <span className="line-clamp-2">{bi?.summary || item.atividade}</span>
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {fmtDate(bi?.created) || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={bi?.status || '—'} />
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input type="text" value={editForm.responsavel}
                        onChange={(e) => setEditForm((f) => ({ ...f, responsavel: e.target.value }))}
                        className="border border-blue-300 dark:border-blue-600 rounded px-2 py-1 text-sm w-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200" />
                    ) : (
                      <span className="text-gray-700 dark:text-gray-300">{item.responsavel || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isOwner ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                      {item.dpo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isOwner ? (
                      isEditing ? (
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => handleSaveEdit(item.key)} disabled={saving}
                            className="text-xs px-2.5 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg">✓</button>
                          <button onClick={() => { setEditKey(null); setFormError(null); }}
                            className="text-xs px-2.5 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg">✕</button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => { setEditKey(item.key); setEditForm({ prioridade: item.prioridade, responsavel: item.responsavel }); setFormError(null); }}
                            className="text-xs px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg">Editar</button>
                          <button onClick={() => handleDelete(item.key)} disabled={saving}
                            className="text-xs px-2.5 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg">✕</button>
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

// ── Componente principal ───────────────────────────────────────────────────────

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

  const allItems = (data?.grupos || []).flatMap((g) => g.items);

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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Plataforma — Backlog</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            DDPLs sem sprint definida · [Dados] Plataforma
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Você é:</label>
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
          { id: 'backlog',     label: 'Backlog' },
          { id: 'priorizacao', label: 'Priorização', badge: prios.items.length || null },
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
          {(search || filterType) && (
            <span className="text-sm text-gray-500 dark:text-gray-400">{totalFiltrado} resultado{totalFiltrado !== 1 ? 's' : ''}</span>
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
        <BacklogView grupos={grupos} byKey={prios.byKey} />
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
