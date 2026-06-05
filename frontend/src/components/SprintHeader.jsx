import { useState } from 'react';
import { saveSprint } from '../services/api';

const FIELD_LABELS = {
  sprintPlanning: 'Sprint Planning',
  time: 'Time',
  dpo: 'DPO',
  sprintInicio: 'Sprint Início',
  notas: 'Notas da Planning',
};

export default function SprintHeader({ sprint, onChange }) {
  const [form, setForm] = useState(sprint || { id: '', sprintPlanning: '', time: '', dpo: '', sprintInicio: '', notas: '', encaixe: false });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!form.id) return;
    setSaving(true);
    try {
      const result = await saveSprint(form);
      setSaved(true);
      onChange?.(result);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-800">Dados da Sprint</h2>
        <button
          onClick={handleSave}
          disabled={saving || !form.id}
          className="px-4 py-1.5 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Salvando…' : saved ? 'Salvo ✓' : 'Salvar'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">ID da Sprint</label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.id}
            onChange={(e) => handleChange('id', e.target.value)}
            placeholder="ex: 26.2.2"
          />
        </div>

        {Object.entries(FIELD_LABELS).map(([field, label]) => (
          <div key={field} className={field === 'notas' ? 'col-span-2 sm:col-span-3' : ''}>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            {field === 'notas' ? (
              <textarea
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                value={form[field] || ''}
                onChange={(e) => handleChange(field, e.target.value)}
              />
            ) : (
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form[field] || ''}
                onChange={(e) => handleChange(field, e.target.value)}
              />
            )}
          </div>
        ))}

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="encaixe"
            checked={form.encaixe || false}
            onChange={(e) => handleChange('encaixe', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="encaixe" className="text-sm text-gray-700">É encaixe na sprint?</label>
        </div>
      </div>
    </div>
  );
}
