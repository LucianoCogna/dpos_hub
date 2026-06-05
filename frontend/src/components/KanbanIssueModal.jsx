import { useState, useEffect } from 'react';
import StatusBadge from './StatusBadge';
import {
  getIssueDetail,
  getProjectMembers,
  getIssueTransitions,
  updateIssue,
  transitionIssue,
} from '../services/api';

const JIRA_BASE = 'https://cogna.atlassian.net';

const TYPE_CONFIG = {
  'Épico':    { icon: '⚡', badge: 'bg-violet-100 text-violet-700' },
  'História': { icon: '📋', badge: 'bg-sky-100 text-sky-700'      },
};

export default function KanbanIssueModal({ issueKey, onClose, onStatusChange }) {
  const [issue, setIssue]           = useState(null);
  const [assignables, setAssignables] = useState([]);
  const [transitions, setTransitions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);

  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [selectedReporter, setSelectedReporter] = useState('');
  const [storyPoints, setStoryPoints]           = useState('');
  const [selectedStatus, setSelectedStatus]     = useState('');

  useEffect(() => {
    if (!issueKey) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getIssueDetail(issueKey),
      getProjectMembers(),
      getIssueTransitions(issueKey),
    ])
      .then(([detail, users, trans]) => {
        setIssue(detail);
        setAssignables(users);
        setTransitions(trans);
        setSelectedAssignee(detail.assignee?.accountId || '');
        setSelectedReporter(detail.reporter?.accountId || '');
        setStoryPoints(detail.story_points ?? '');
        setSelectedStatus(detail.status);
      })
      .catch(() => setError('Erro ao carregar os dados do issue.'))
      .finally(() => setLoading(false));
  }, [issueKey]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updates = {};
      if (selectedAssignee !== (issue.assignee?.accountId || ''))
        updates.assignee_account_id = selectedAssignee || null;
      if (String(storyPoints) !== String(issue.story_points ?? ''))
        updates.story_points = storyPoints;

      if (Object.keys(updates).length > 0)
        await updateIssue(issueKey, updates);

      if (selectedStatus !== issue.status) {
        await transitionIssue(issueKey, selectedStatus);
        onStatusChange?.(issueKey, selectedStatus);
      }

      setIssue((prev) => ({
        ...prev,
        status: selectedStatus,
        story_points: storyPoints === '' ? null : Number(storyPoints),
        assignee: selectedAssignee
          ? assignables.find((u) => u.accountId === selectedAssignee) || prev.assignee
          : null,
        reporter: selectedReporter
          ? assignables.find((u) => u.accountId === selectedReporter) || prev.reporter
          : null,
      }));
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const cfg = TYPE_CONFIG[issue?.type] || { icon: '📋', badge: 'bg-gray-100 text-gray-600' };

  const hasChanges =
    selectedAssignee !== (issue?.assignee?.accountId || '') ||
    selectedReporter !== (issue?.reporter?.accountId || '') ||
    String(storyPoints) !== String(issue?.story_points ?? '') ||
    selectedStatus !== issue?.status;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-gray-900 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {issue && (
                <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${cfg.badge}`}>
                  {cfg.icon} {issue.type}
                </span>
              )}
              <a
                href={`${JIRA_BASE}/browse/${issueKey}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                {issueKey} ↗
              </a>
            </div>
            {issue && (
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                {issue.summary}
              </h2>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading && (
            <div className="text-center text-gray-400 text-sm py-10 animate-pulse">
              Carregando…
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {issue && !loading && (
            <>
              {/* Épico pai */}
              {issue.parent_key && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Épico pai</p>
                  <a
                    href={`${JIRA_BASE}/browse/${issue.parent_key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {issue.parent_key} — {issue.parent_summary}
                  </a>
                </div>
              )}

              {/* Status */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Status</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={issue.status} size="lg" />
                  {transitions.length > 0 && (
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value={issue.status}>{issue.status} (atual)</option>
                      {transitions
                        .filter((t) => t.name !== issue.status)
                        .map((t) => (
                          <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Responsável */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Responsável</p>
                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Sem responsável</option>
                  {assignables.map((u) => (
                    <option key={u.accountId} value={u.accountId}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Responsável Técnico */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Responsável Técnico</p>
                <select
                  value={selectedReporter}
                  onChange={(e) => setSelectedReporter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Sem responsável técnico</option>
                  {assignables.map((u) => (
                    <option key={u.accountId} value={u.accountId}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Story Points */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Story Points</p>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={storyPoints}
                  onChange={(e) => setStoryPoints(e.target.value)}
                  placeholder="—"
                  className="w-32 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Descrição */}
              {issue.description && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Descrição</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700 max-h-48 overflow-y-auto">
                    {issue.description}
                  </p>
                </div>
              )}

              {/* Labels */}
              {issue.labels?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Etiquetas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {issue.labels.map((l) => (
                      <span key={l} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-2.5 py-0.5">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {issue && !loading && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Fechar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
