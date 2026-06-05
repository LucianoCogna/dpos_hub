import { useState, useEffect } from 'react';
import { getJiraCard } from '../services/api';

const DROPDOWNS = {
  squads: ['Squad G&C e Captação'],
  times: [
    'Plataforma (Okabe)',
    'Engenharia (Anderson)',
    'Produto - Upstream',
    'Produto - Homologar',
    'DataViz',
    'Governança (Renata)',
  ],
};

const EMPTY = {
  squad: 'Squad G&C e Captação',
  sprint_planning: '',
  time: '',
  dpo: '',
  sprint_inicio: '',
  card: '',
  tema: '',
  notas_planning: '',
  encaixe_sprint: false,
  status_fim_sprint: 'Backlog',
  status_jira: null,
};

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

function Field({ label, children, error }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Dropdown({ value, onChange, options, placeholder = 'Selecionar…' }) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export default function CardModal({ sprintId, card, onClose, onSave, dpos = [] }) {
  const [form, setForm] = useState(
    card ? { ...card } : { ...EMPTY, sprint_planning: sprintId || '' }
  );
  const [searching, setSearching] = useState(false);
  const [cardError, setCardError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // Busca automática ao digitar key do card
  useEffect(() => {
    const key = form.card.trim().toUpperCase();
    if (!/^[A-Z]+-\d+$/.test(key)) return;

    setCardError(null);
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await getJiraCard(key);
        setForm((prev) => ({ ...prev, tema: data.summary, status_jira: data.status }));
      } catch {
        setCardError('Card não encontrado no Jira');
      } finally {
        setSearching(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [form.card]);

  const handleSave = async () => {
    if (!form.card) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {card ? 'Editar Card' : 'Novo Card'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field label="Squad">
            <Dropdown value={form.squad} onChange={(v) => set('squad', v)} options={DROPDOWNS.squads} />
          </Field>

          <Field label="Sprint Planning">
            <input
              className={inputCls}
              value={form.sprint_planning}
              onChange={(e) => set('sprint_planning', e.target.value)}
              placeholder="ex: 26.2.2"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Time">
              <Dropdown value={form.time} onChange={(v) => set('time', v)} options={DROPDOWNS.times} />
            </Field>
            <Field label="DPO">
              <input
                list="dpo-suggestions"
                className={inputCls}
                value={form.dpo}
                onChange={(e) => set('dpo', e.target.value)}
                placeholder="Nome do DPO"
                autoComplete="off"
              />
              <datalist id="dpo-suggestions">
                {dpos.map((d) => <option key={d} value={d} />)}
              </datalist>
            </Field>
          </div>

          <Field label="Sprint Início">
            <input
              className={inputCls}
              value={form.sprint_inicio}
              onChange={(e) => set('sprint_inicio', e.target.value)}
              placeholder="ex: 26.2.1"
            />
          </Field>

          <Field label="Card Jira" error={cardError}>
            <div className="relative">
              <input
                className={`${inputCls} pr-9 font-mono uppercase`}
                value={form.card}
                onChange={(e) => set('card', e.target.value.toUpperCase())}
                placeholder="ex: DENA-954"
                disabled={!!card}
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </Field>

          <Field label="Tema">
            <input
              className={`${inputCls} bg-gray-50`}
              value={form.tema}
              onChange={(e) => set('tema', e.target.value)}
              placeholder="Preenchido automaticamente via Jira"
            />
          </Field>

          <Field label="Notas da Planning">
            <textarea
              className={inputCls}
              rows={3}
              value={form.notas_planning}
              onChange={(e) => set('notas_planning', e.target.value)}
            />
          </Field>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => set('encaixe_sprint', !form.encaixe_sprint)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                form.encaixe_sprint ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  form.encaixe_sprint ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-700">É encaixe na sprint?</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.card}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
