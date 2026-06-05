import { useState, useEffect, useCallback, useMemo } from 'react';
import StatusBadge from '../components/StatusBadge';
import { getSprints, getReport, saveReport, syncReport, getStories } from '../services/api';

const JIRA_BASE = 'https://cogna.atlassian.net';
const DONE = ['Concluído', 'Aceito'];

const EPIC_ORDER = { Bloqueado: 0, 'Em Andamento': 1, Homologação: 2, Pronto: 3, Concluído: 4, Aceito: 4, Backlog: 5 };
const EPIC_COLOR = {
  Bloqueado: '#ef4444', 'Em Andamento': '#f59e0b', Homologação: '#f97316',
  Pronto: '#3b82f6', Concluído: '#22c55e', Aceito: '#22c55e', Backlog: '#9ca3af',
};

const EMPTY_FORM = {
  atualizacoes: '',
  proximas_atividades: {
    homologacao_data: '', homologacao_extra: '',
    refinamento_data: '', refinamento_extra: '',
    engenharia_data:  '', engenharia_extra:  '',
    plataforma_data:  '', plataforma_extra:  '',
  },
  riscos: '',
};

// ── styling helpers ─────────────────────────────────────────────────────────

function theme(dk) {
  return {
    root:        dk ? 'bg-gray-950 text-gray-100' : '',
    block:       dk ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200',
    header:      dk ? 'bg-gray-800 border-gray-700 hover:bg-gray-750' : 'bg-gray-50 border-gray-200 hover:bg-gray-100',
    text:        dk ? 'text-gray-100' : 'text-gray-900',
    sub:         dk ? 'text-gray-300' : 'text-gray-700',
    muted:       dk ? 'text-gray-400' : 'text-gray-500',
    divider:     dk ? 'border-gray-800' : 'border-gray-100',
    track:       dk ? 'bg-gray-800' : 'bg-gray-100',
    input:       dk ? 'bg-gray-800 text-gray-100 border-gray-600 placeholder-gray-500 focus:ring-primary-400 focus:border-primary-400'
                    : 'bg-white text-gray-900 border-gray-300 focus:ring-primary-500 focus:border-primary-500',
    link:        dk ? 'text-primary-400 hover:text-primary-300' : 'text-primary-600 hover:text-primary-800',
    metricCard:  dk ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200',
    btnPrimary:  dk ? 'bg-primary-600 text-white hover:bg-primary-500' : 'bg-primary-600 text-white hover:bg-primary-700',
    btnSecondary:dk ? 'bg-gray-700 text-gray-100 border-gray-600 hover:bg-gray-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
  };
}

// ── sub-components ──────────────────────────────────────────────────────────

function Bloco({ id, icon, title, collapsed, onToggle, C, children, className = '' }) {
  return (
    <div className={`rounded-xl border overflow-hidden report-block ${C.block} ${className}`}>
      <button
        onClick={() => onToggle(id)}
        className={`w-full flex items-center justify-between px-6 py-4 text-left border-b transition-colors report-block-header ${C.header}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl leading-none">{icon}</span>
          <span className={`font-semibold text-base ${C.text}`}>{title}</span>
        </div>
        <span className={`text-xs ${C.muted}`}>{collapsed ? '▶' : '▼'}</span>
      </button>
      {!collapsed && (
        <div className="px-6 py-5 report-block-body">{children}</div>
      )}
    </div>
  );
}

function BulletText({ text, C, placeholder = 'Nenhuma informação preenchida.' }) {
  if (!text?.trim()) {
    return <p className={`italic text-sm ${C.muted}`}>{placeholder}</p>;
  }
  return (
    <div className={`space-y-1.5 text-sm leading-relaxed ${C.sub}`}>
      {text.split('\n').map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="h-1.5" />;
        if (t.startsWith('•') || t.startsWith('-')) {
          return (
            <div key={i} className="flex gap-2">
              <span className="flex-shrink-0 mt-0.5 text-base leading-none">•</span>
              <span>{t.replace(/^[•\-]\s*/, '')}</span>
            </div>
          );
        }
        return <p key={i}>{t}</p>;
      })}
    </div>
  );
}

function CardItem({ card, C }) {
  const icon = DONE.includes(card.status_jira) ? '🟢'
    : card.status_jira === 'Bloqueado'    ? '🔴'
    : card.status_jira === 'Homologação'  ? '🟠'
    : card.status_jira === 'Em Andamento' ? '🟡' : '🔵';
  return (
    <div className={`flex items-center gap-3 py-2.5 text-sm border-b last:border-0 ${C.divider}`}>
      <span className="text-base flex-shrink-0 leading-none">{icon}</span>
      <a
        href={`${JIRA_BASE}/browse/${card.card}`}
        target="_blank"
        rel="noreferrer"
        className={`font-mono text-xs flex-shrink-0 ${C.link}`}
      >
        {card.card}
      </a>
      <span className={`flex-1 truncate ${C.sub}`} title={card.tema}>{card.tema}</span>
      <div className="flex-shrink-0"><StatusBadge status={card.status_jira} /></div>
    </div>
  );
}

function EmptyCards({ C }) {
  return <p className={`text-sm italic py-2 ${C.muted}`}>Nenhuma entrega nesta sprint.</p>;
}

function MetricCard({ label, value, sub, vsLabel, vsDelta, positiveDir = 'neutral', C, dk }) {
  let deltaColor = C.muted;
  if (vsDelta !== undefined && vsDelta !== null && vsDelta !== 0) {
    if (positiveDir === 'up')   deltaColor = vsDelta > 0 ? 'text-green-400' : 'text-red-400';
    if (positiveDir === 'down') deltaColor = vsDelta < 0 ? 'text-green-400' : 'text-red-400';
    if (positiveDir === 'neutral') deltaColor = dk ? 'text-primary-400' : 'text-primary-600';
  }
  const sign = vsDelta > 0 ? '+' : '';
  return (
    <div className={`rounded-xl border p-4 ${C.metricCard}`}>
      <p className={`text-xs font-medium uppercase tracking-wide mb-2 ${C.muted}`}>{label}</p>
      <p className={`text-3xl font-bold mb-1 ${C.text}`}>{value}</p>
      {sub && <div className="mb-2">{sub}</div>}
      {vsLabel !== undefined && vsDelta !== undefined && (
        <p className={`text-xs ${C.muted}`}>
          vs {vsLabel}:{' '}
          <span className={`font-semibold ${deltaColor}`}>
            {sign}{vsDelta}
          </span>
        </p>
      )}
    </div>
  );
}

function ProgressBar({ progress, color, animated, C }) {
  return (
    <div className={`h-3 rounded-full overflow-hidden progress-track ${C.track}`}>
      <div
        className="h-full rounded-full"
        style={{
          width: animated ? `${progress}%` : '0%',
          backgroundColor: color,
          transition: 'width 0.8s ease-out',
        }}
      />
    </div>
  );
}

const inputCls = (C) =>
  `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${C.input}`;
const textareaCls = (C) =>
  `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none ${C.input}`;

// ── main component ──────────────────────────────────────────────────────────

export default function Report() {
  const [sprints, setSprints] = useState([]);
  const [sprintId, setSprintId] = useState('');
  const [reportData, setReportData] = useState(null);
  const [epicsData, setEpicsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formDirty, setFormDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [animated, setAnimated] = useState(false);
  const [collapsed, setCollapsed] = useState({
    indicadores: false, atualizacoes: false, entregas: false,
    pendencias: false, epicos: false, riscos: false,
  });

  const dk = !editMode;
  const C = theme(dk);

  // Load sprints
  useEffect(() => {
    getSprints().then((data) => {
      setSprints(data);
      if (data.length > 0) setSprintId(data[data.length - 1].id);
    });
  }, []);

  // Load report when sprint changes
  useEffect(() => {
    if (!sprintId) return;
    setLoading(true);
    setAnimated(false);
    Promise.all([getReport(sprintId), getStories()])
      .then(([rpt, epics]) => {
        setReportData(rpt);
        setEpicsData(epics || []);
        setForm({
          atualizacoes: rpt.manual?.atualizacoes ?? '',
          proximas_atividades: { ...EMPTY_FORM.proximas_atividades, ...(rpt.manual?.proximas_atividades ?? {}) },
          riscos: rpt.manual?.riscos ?? '',
        });
        setFormDirty(false);
        setTimeout(() => setAnimated(true), 200);
      })
      .catch(() => setReportData(null))
      .finally(() => setLoading(false));
  }, [sprintId]);

  // Autosave debounce (2s)
  useEffect(() => {
    if (!formDirty || !editMode || !sprintId) return;
    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await saveReport(sprintId, form);
        setSaveStatus('saved');
        setFormDirty(false);
      } catch {
        setSaveStatus('error');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [form, formDirty, editMode, sprintId]);

  const handleSync = async () => {
    setSyncing(true);
    setAnimated(false);
    try {
      const data = await syncReport(sprintId);
      setReportData(data);
      setTimeout(() => setAnimated(true), 200);
    } finally {
      setSyncing(false);
    }
  };

  const toggleBlock = (id) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormDirty(true);
    setSaveStatus(null);
  };

  const setPA = (key, value) => {
    setForm((prev) => ({
      ...prev,
      proximas_atividades: { ...prev.proximas_atividades, [key]: value },
    }));
    setFormDirty(true);
    setSaveStatus(null);
  };

  const sortedEpics = useMemo(
    () => [...epicsData].sort((a, b) => (EPIC_ORDER[a.status] ?? 6) - (EPIC_ORDER[b.status] ?? 6)),
    [epicsData]
  );

  const m = reportData?.metricas;
  const d = reportData?.delta;
  const { entregas, pendencias } = reportData ?? { entregas: {}, pendencias: {} };

  const lastSync = reportData?.sincronizado_em
    ? new Date(reportData.sincronizado_em).toLocaleString('pt-BR')
    : null;

  // ── render ──────────────────────────────────────────────────────────────

  return (
    <div className={`report-root -mx-6 -mt-8 px-6 py-8 min-h-full ${C.root}`}>

      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6 no-print">
        <h1 className={`text-2xl font-bold mr-2 ${C.text}`}>Report</h1>

        <select
          value={sprintId}
          onChange={(e) => setSprintId(e.target.value)}
          className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${C.input}`}
        >
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>Sprint {s.id}</option>
          ))}
        </select>

        <div className="flex-1" />

        {saveStatus && (
          <span className={`text-xs ${saveStatus === 'saved' ? 'text-green-400' : saveStatus === 'saving' ? C.muted : 'text-red-400'}`}>
            {saveStatus === 'saving' ? '💾 Salvando…' : saveStatus === 'saved' ? '✓ Salvo' : '✗ Erro ao salvar'}
          </span>
        )}

        <button
          onClick={() => setEditMode((v) => !v)}
          className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
            editMode ? C.btnPrimary : C.btnSecondary
          }`}
        >
          {editMode ? '👁 Apresentação' : '✏️ Editar'}
        </button>

        <button
          onClick={handleSync}
          disabled={syncing || !sprintId}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 ${C.btnSecondary}`}
        >
          {syncing && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
          🔄 Sincronizar
        </button>

        <button
          onClick={() => window.print()}
          className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${C.btnSecondary}`}
        >
          🖨️ PDF
        </button>
      </div>

      {/* ── Report header ── */}
      {reportData && (
        <div className={`rounded-xl border px-6 py-4 mb-6 ${C.block}`}>
          <div className={`flex items-center justify-between flex-wrap gap-2`}>
            <div>
              <p className={`text-lg font-bold ${C.text}`}>
                Squad G&C e Captação &nbsp;•&nbsp; Sprint {sprintId}
              </p>
              <p className={`text-sm ${C.muted}`}>
                Gerado em {new Date().toLocaleDateString('pt-BR')}
                {lastSync && <> &nbsp;•&nbsp; Sync: {lastSync}</>}
              </p>
            </div>
            {m && (
              <div className={`text-right text-sm ${C.muted}`}>
                {m.concluidos}/{m.total} cards entregues &nbsp;•&nbsp;
                <span className="font-semibold">{m.taxaEntrega}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {loading && (
        <p className={`text-center py-16 ${C.muted} animate-pulse`}>Carregando…</p>
      )}

      {!loading && reportData && (
        <div className="space-y-4">

          {/* ══ BLOCO 1 — Indicadores ══ */}
          <Bloco id="indicadores" icon="📊" title="Indicadores Rápidos"
            collapsed={collapsed.indicadores} onToggle={toggleBlock} C={C}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricCard
                label="Total de Cards" value={m.total}
                vsLabel={d?.sprint_anterior} vsDelta={d?.total}
                positiveDir="neutral" C={C} dk={dk}
              />
              <MetricCard
                label="Taxa de Entrega" value={`${m.taxaEntrega}%`}
                sub={
                  <div className={`h-2 rounded-full overflow-hidden ${C.track}`}>
                    <div className="h-full rounded-full bg-green-500 transition-all duration-700"
                      style={{ width: animated ? `${m.taxaEntrega}%` : '0%' }} />
                  </div>
                }
                vsLabel={d?.sprint_anterior} vsDelta={d?.taxa_entrega}
                positiveDir="up" C={C} dk={dk}
              />
              <MetricCard
                label="Transbordaram" value={m.transbordaram}
                vsLabel={d?.sprint_anterior} vsDelta={d?.transbordamentos}
                positiveDir="down" C={C} dk={dk}
              />
              <MetricCard
                label="Bloqueados" value={m.bloqueados}
                vsLabel={d?.sprint_anterior} vsDelta={d?.bloqueados}
                positiveDir="down" C={C} dk={dk}
              />
            </div>
          </Bloco>

          {/* ══ BLOCO 2 — Atualizações ══ */}
          <Bloco id="atualizacoes" icon="📋" title="Atualizações / Evoluções"
            collapsed={collapsed.atualizacoes} onToggle={toggleBlock} C={C}>
            {editMode ? (
              <textarea
                rows={6}
                value={form.atualizacoes}
                onChange={(e) => setField('atualizacoes', e.target.value)}
                className={textareaCls(C)}
                placeholder="Use • para bullet points"
              />
            ) : (
              <BulletText text={form.atualizacoes} C={C} />
            )}
          </Bloco>

          {/* ══ BLOCO 3 — Entregas ══ */}
          <Bloco id="entregas" icon="✅" title="Entregas da Sprint"
            collapsed={collapsed.entregas} onToggle={toggleBlock} C={C}>
            <div className="space-y-5">

              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${C.muted}`}>
                  Produto de Dados (DAPL)
                </p>
                {entregas?.dapl?.length
                  ? entregas.dapl.map((c) => <CardItem key={c.card} card={c} C={C} />)
                  : <EmptyCards C={C} />}
              </div>

              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${C.muted}`}>
                  Plataforma de Dados — Ingestão (DDPL)
                </p>
                {entregas?.ddpl?.length
                  ? entregas.ddpl.map((c) => <CardItem key={c.card} card={c} C={C} />)
                  : <EmptyCards C={C} />}
              </div>

              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${C.muted}`}>
                  Engenharia de Dados (DENA)
                </p>
                {entregas?.dena?.length
                  ? entregas.dena.map((c) => <CardItem key={c.card} card={c} C={C} />)
                  : <EmptyCards C={C} />}
              </div>

            </div>
          </Bloco>

          {/* ══ BLOCO 4 — Pendências ══ */}
          <Bloco id="pendencias" icon="⏳" title="Próximas Atividades / Pendências"
            collapsed={collapsed.pendencias} onToggle={toggleBlock} C={C}>
            <div className="space-y-6">

              {/* 4.1 Homologação */}
              <PendSection
                title="Pendente com Time de G&C (Homologação)" accent="🟠"
                cards={pendencias?.homologacao} dateKey="homologacao_data"
                extraKey="homologacao_extra" form={form} setPA={setPA}
                editMode={editMode} C={C}
              />

              {/* 4.2 Refinamento DAPL */}
              <PendSection
                title="Produto de Dados — Refinamento/Discovery (DAPL)" accent="🔵"
                cards={pendencias?.refinamento_dapl} dateKey="refinamento_data"
                extraKey="refinamento_extra" form={form} setPA={setPA}
                editMode={editMode} C={C}
              />

              {/* 4.3 Engenharia DENA */}
              <PendSection
                title="Engenharia de Dados — Desenvolvimento (DENA)" accent="🟡"
                cards={pendencias?.engenharia_dena} dateKey="engenharia_data"
                extraKey="engenharia_extra" form={form} setPA={setPA}
                editMode={editMode} C={C}
              />

              {/* 4.4 Plataforma DDPL */}
              <PendSection
                title="Plataforma de Dados — Ingestão (DDPL)" accent="🟡"
                cards={pendencias?.plataforma_ddpl} dateKey="plataforma_data"
                extraKey="plataforma_extra" form={form} setPA={setPA}
                editMode={editMode} C={C}
              />

            </div>
          </Bloco>

          {/* ══ BLOCO 5 — Épicos ══ */}
          <Bloco id="epicos" icon="📈" title="Status por Épico"
            collapsed={collapsed.epicos} onToggle={toggleBlock} C={C}>
            {sortedEpics.length === 0 ? (
              <p className={`text-sm italic ${C.muted}`}>Nenhum épico encontrado.</p>
            ) : (
              <div className="space-y-4">
                {sortedEpics.map((epic) => {
                  const progress = epic.total > 0 ? Math.round((epic.done / epic.total) * 100) : 0;
                  const color = EPIC_COLOR[epic.status] ?? '#9ca3af';
                  return (
                    <div key={epic.key} className={`border-b pb-4 last:border-0 last:pb-0 ${C.divider}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <a href={`${JIRA_BASE}/browse/${epic.key}`} target="_blank" rel="noreferrer"
                              className={`font-mono text-xs flex-shrink-0 ${C.link}`}>{epic.key}</a>
                            <StatusBadge status={epic.status} />
                          </div>
                          <p className={`text-sm font-medium ${C.sub}`}>{epic.summary}</p>
                        </div>
                        <span className={`text-xl font-bold flex-shrink-0 ${C.text}`}>{progress}%</span>
                      </div>
                      <ProgressBar progress={progress} color={color} animated={animated} C={C} />
                      <p className={`text-xs mt-1.5 ${C.muted}`}>
                        {epic.done}/{epic.total} histórias concluídas
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Bloco>

          {/* ══ BLOCO 6 — Riscos ══ */}
          <Bloco id="riscos" icon="⚠️" title="Riscos / Pontos de Atenção"
            collapsed={collapsed.riscos} onToggle={toggleBlock} C={C}>
            {editMode ? (
              <div className="space-y-2">
                <textarea
                  rows={5}
                  value={form.riscos}
                  onChange={(e) => setField('riscos', e.target.value)}
                  className={textareaCls(C)}
                  placeholder="Use • para bullet points"
                />
                <button
                  onClick={() => setField('riscos', form.riscos + '\n• ')}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${C.btnSecondary}`}
                >
                  + Adicionar risco
                </button>
              </div>
            ) : (
              <BulletText text={form.riscos} C={C} placeholder="Nenhum risco registrado." />
            )}
          </Bloco>

        </div>
      )}

      {/* ── Save bar (edit mode) ── */}
      {editMode && (
        <div className={`fixed bottom-0 left-0 right-0 px-6 py-3 flex items-center justify-between border-t no-print ${
          dk ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
        } shadow-lg`}>
          <span className={`text-xs ${C.muted}`}>
            {saveStatus === 'saving' ? '💾 Salvando…'
              : saveStatus === 'saved' ? '✓ Salvo automaticamente'
              : saveStatus === 'error' ? '✗ Erro ao salvar'
              : 'Modo de edição — alterações salvas automaticamente'}
          </span>
          <button
            onClick={async () => {
              setSaveStatus('saving');
              await saveReport(sprintId, form);
              setSaveStatus('saved');
              setFormDirty(false);
            }}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg ${C.btnPrimary}`}
          >
            Salvar agora
          </button>
        </div>
      )}
    </div>
  );
}

// ── PendSection sub-component ───────────────────────────────────────────────

function PendSection({ title, accent, cards, dateKey, extraKey, form, setPA, editMode, C }) {
  const date = form.proximas_atividades[dateKey];
  const extra = form.proximas_atividades[extraKey];

  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${C.muted}`}>
        {accent} {title}
      </p>

      {cards?.length
        ? cards.map((c) => (
            <div key={c.card} className={`flex items-center gap-3 py-2.5 text-sm border-b last:border-0 ${C.divider}`}>
              <a href={`https://cogna.atlassian.net/browse/${c.card}`} target="_blank" rel="noreferrer"
                className={`font-mono text-xs flex-shrink-0 ${C.link}`}>{c.card}</a>
              <span className={`flex-1 truncate ${C.sub}`} title={c.tema}>{c.tema}</span>
              <div className="flex-shrink-0"><StatusBadge status={c.status_jira} /></div>
            </div>
          ))
        : <p className={`text-sm italic py-1 ${C.muted}`}>Nenhum item nesta categoria.</p>
      }

      <div className="mt-3 flex flex-wrap items-start gap-3">
        {editMode ? (
          <>
            <div className="flex items-center gap-2">
              <label className={`text-xs ${C.muted}`}>Data prevista:</label>
              <input
                value={date}
                onChange={(e) => setPA(dateKey, e.target.value)}
                placeholder="ex: 13/05"
                className={`rounded border px-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 ${C.input}`}
              />
            </div>
            <input
              value={extra}
              onChange={(e) => setPA(extraKey, e.target.value)}
              placeholder="Observações adicionais…"
              className={`flex-1 rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1 ${C.input}`}
            />
          </>
        ) : (
          <>
            {date && (
              <span className={`text-xs ${C.muted}`}>
                📅 Data prevista: <span className={`font-medium ${C.sub}`}>{date}</span>
              </span>
            )}
            {extra && <span className={`text-xs ${C.sub}`}>{extra}</span>}
          </>
        )}
      </div>
    </div>
  );
}
