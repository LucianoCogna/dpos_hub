import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import StatusBadge from '../components/StatusBadge';
import { getSprints, getReview, syncReview, getComparacao } from '../services/api';

const JIRA_BASE = 'https://cogna.atlassian.net';
const DONE = ['Concluído', 'Aceito'];

// ── helpers ────────────────────────────────────────────────────────────────

const pct = (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0);

const SITUACAO = {
  entregue:    { label: '✅ Entregue',      bg: '#dcfce7', color: '#15803d' },
  bloqueado:   { label: '🚫 Bloqueado',     bg: '#fee2e2', color: '#b91c1c' },
  em_andamento:{ label: '🔄 Em andamento',  bg: '#fef3c7', color: '#b45309' },
  transbordou: { label: '⚠️ Transbordou',   bg: '#ffedd5', color: '#c2410c' },
};

// ── sub-components ──────────────────────────────────────────────────────────

function SituacaoBadge({ situacao }) {
  const s = SITUACAO[situacao] ?? SITUACAO.transbordou;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function MetricCard({ label, value, sub, accent }) {
  const accentCls = {
    green:  'border-t-4 border-green-500',
    red:    'border-t-4 border-red-500',
    yellow: 'border-t-4 border-amber-400',
    blue:   'border-t-4 border-primary-500',
  }[accent] ?? '';
  return (
    <div className={`bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1 ${accentCls}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-sm text-gray-500">{sub}</p>}
    </div>
  );
}

function Delta({ value, positiveDir = 'up' }) {
  if (value === 0) return <span className="text-gray-400 text-sm font-semibold">— 0</span>;
  const isGood = positiveDir === 'up' ? value > 0 : value < 0;
  const color = isGood ? 'text-green-600' : 'text-red-600';
  const arrow = value > 0 ? '▲' : '▼';
  return (
    <span className={`text-sm font-semibold ${color}`}>
      {value > 0 ? '+' : ''}{value} {arrow}
    </span>
  );
}

function DeltaCard({ label, current, previous, delta, positiveDir = 'neutral', unit = '' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex justify-between text-sm text-gray-700 mb-1">
        <span>Sprint atual</span>
        <span className="font-semibold">{current}{unit}</span>
      </div>
      <div className="flex justify-between text-sm text-gray-500 mb-2">
        <span>Sprint ant.</span>
        <span>{previous}{unit}</span>
      </div>
      <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-2">
        <span className="text-gray-400">Delta</span>
        {positiveDir === 'neutral'
          ? <span className="text-primary-600 font-semibold text-sm">{delta > 0 ? '+' : ''}{delta}</span>
          : <Delta value={delta} positiveDir={positiveDir} />
        }
      </div>
    </div>
  );
}

// ── main component ──────────────────────────────────────────────────────────

export default function Review() {
  const [sprints, setSprints] = useState([]);
  const [sprintId, setSprintId] = useState('');
  const [prevSprintId, setPrevSprintId] = useState('');
  const [reviewData, setReviewData] = useState(null);
  const [comparacao, setComparacao] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [collapsed, setCollapsed] = useState(new Set());
  const [compLoading, setCompLoading] = useState(false);

  // Load sprint list
  useEffect(() => {
    getSprints().then((data) => {
      setSprints(data);
      if (data.length > 0) {
        setSprintId(data[data.length - 1].id);
        if (data.length > 1) setPrevSprintId(data[data.length - 2].id);
      }
    });
  }, []);

  // Load review when sprint changes
  useEffect(() => {
    if (!sprintId) return;
    setLoading(true);
    getReview(sprintId)
      .then(setReviewData)
      .catch(() => setReviewData(null))
      .finally(() => setLoading(false));
  }, [sprintId]);

  // Load comparação when either sprint changes
  useEffect(() => {
    if (!sprintId || !prevSprintId || sprintId === prevSprintId) {
      setComparacao(null);
      return;
    }
    setCompLoading(true);
    getComparacao(sprintId, prevSprintId)
      .then(setComparacao)
      .catch(() => setComparacao(null))
      .finally(() => setCompLoading(false));
  }, [sprintId, prevSprintId]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const data = await syncReview(sprintId);
      setReviewData(data);
    } finally {
      setSyncing(false);
    }
  };

  const toggleGroup = (time) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(time) ? next.delete(time) : next.add(time);
      return next;
    });

  // Group cards by time
  const groups = useMemo(() => {
    const g = {};
    (reviewData?.cards || []).forEach((c) => {
      if (!g[c.time]) g[c.time] = [];
      g[c.time].push(c);
    });
    return g;
  }, [reviewData]);

  // Bar chart data
  const barData = useMemo(
    () =>
      Object.entries(reviewData?.metricas?.porTime || {}).map(([time, d]) => ({
        time,
        Entregue: d.concluidos,
        Transbordou: d.total - d.concluidos - d.bloqueados,
        Bloqueado: d.bloqueados,
      })),
    [reviewData]
  );

  // Donut chart data
  const pieData = comparacao
    ? [
        { name: `Novos (${comparacao.cards_novos_esta_sprint.length})`, value: comparacao.cards_novos_esta_sprint.length },
        { name: `Arrastados (${comparacao.cards_transbordados_da_anterior.length})`, value: comparacao.cards_transbordados_da_anterior.length },
      ]
    : [];

  const m = reviewData?.metricas;
  const total = m?.total ?? 0;

  const lastSync = reviewData?.sincronizado_em
    ? new Date(reviewData.sincronizado_em).toLocaleString('pt-BR')
    : null;

  const alertCards = (comparacao?.cards_transbordados_da_anterior || []).filter(
    (c) => c.sprints_arrastando >= 3
  );

  const exportCsv = () => {
    const headers = ['Card','Tema','Time','DPO','Sprint Início','Encaixe?','Status Jira','Situação','Sprints Arrastando'];
    const rows = (reviewData?.cards || []).map((c) => [
      c.card, c.tema, c.time, c.dpo, c.sprint_inicio,
      c.encaixe_sprint ? 'Sim' : 'Não',
      c.status_jira || '',
      SITUACAO[c.situacao]?.label || c.situacao,
      comparacao?.cards_transbordados_da_anterior?.find((t) => t.card === c.card)?.sprints_arrastando ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `review-${sprintId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">

      {/* ── Header / Filtros ── */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900 mr-2">Review</h1>

        <select
          value={sprintId}
          onChange={(e) => setSprintId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>Sprint {s.id}</option>
          ))}
        </select>

        <div className="flex-1" />

        {lastSync && (
          <span className="text-xs text-gray-400">Sync: {lastSync}</span>
        )}

        <button
          onClick={exportCsv}
          disabled={!reviewData}
          className="px-3 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          Exportar CSV
        </button>

        <button
          onClick={handleSync}
          disabled={syncing || !sprintId}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {syncing ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sincronizando…
            </>
          ) : (
            '🔄 Sincronizar Jira'
          )}
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="text-center py-12 text-gray-400 animate-pulse">Carregando…</div>
      )}

      {!loading && reviewData && (
        <>
          {/* ══════════════════════════════════════════
              SEÇÃO 1 — Sprint Atual
          ══════════════════════════════════════════ */}
          <section className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-800">
              Sprint Atual — {sprintId}
            </h2>

            {/* 1.1 Metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <MetricCard label="Total Cards"  value={total}              accent="blue" />
              <MetricCard label="Concluídos"   value={m.concluidos}       sub={`${m.taxaEntrega}%`}                      accent="green"  />
              <MetricCard label="Transbordaram" value={m.transbordaram}   sub={`${pct(m.transbordaram, total)}%`}        accent="red"    />
              <MetricCard label="Bloqueados"   value={m.bloqueados}       sub={`${pct(m.bloqueados, total)}%`}           accent="red"    />
              <MetricCard label="Em Andamento" value={m.emAndamento}      sub={`${pct(m.emAndamento, total)}%`}         accent="yellow" />
            </div>

            {/* 1.2 Tabela agrupada por Time */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {Object.entries(groups).map(([time, cards]) => {
                const entregues = cards.filter((c) => c.situacao === 'entregue').length;
                const transb    = cards.filter((c) => c.situacao === 'transbordou').length;
                const isOpen    = !collapsed.has(time);

                return (
                  <div key={time}>
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(time)}
                      className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{isOpen ? '▼' : '▶'}</span>
                        <span className="font-medium text-gray-800 text-sm">{time}</span>
                        <span className="text-xs text-gray-500">
                          {cards.length} {cards.length === 1 ? 'card' : 'cards'}
                          {entregues > 0 && ` | ${entregues} entregue${entregues > 1 ? 's' : ''}`}
                          {transb    > 0 && ` | ${transb} transbordou${transb > 1 ? 'ram' : ''}`}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {entregues > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>
                            {entregues}✅
                          </span>
                        )}
                        {transb > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#ffedd5', color: '#c2410c' }}>
                            {transb}⚠️
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Group rows */}
                    {isOpen && (
                      <div className="divide-y divide-gray-50">
                        {cards.map((c, idx) => (
                          <div
                            key={c.card}
                            className={`flex items-center gap-3 px-5 py-3 text-sm ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}
                          >
                            <a
                              href={`${JIRA_BASE}/browse/${c.card}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-primary-600 hover:text-primary-800 hover:underline w-24 flex-shrink-0"
                            >
                              {c.card}
                            </a>
                            <span className="flex-1 text-gray-700 truncate" title={c.tema}>
                              {c.tema}
                            </span>
                            <span className="text-xs text-gray-400 hidden md:block w-24 flex-shrink-0">
                              {c.sprint_inicio}
                            </span>
                            <span className="w-16 flex-shrink-0 text-center text-xs">
                              {c.encaixe_sprint ? '✅ Sim' : <span className="text-gray-400">❌ Não</span>}
                            </span>
                            <div className="w-28 flex-shrink-0">
                              <StatusBadge status={c.status_jira} />
                            </div>
                            <div className="w-36 flex-shrink-0">
                              <SituacaoBadge situacao={c.situacao} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 1.3 Gráfico de barras por Time */}
            {barData.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Breakdown por Time</h3>
                <ResponsiveContainer width="100%" height={barData.length * 52 + 50}>
                  <BarChart layout="vertical" data={barData} margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="time" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Entregue"    stackId="a" fill="#15803d" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Transbordou" stackId="a" fill="#f97316" />
                    <Bar dataKey="Bloqueado"   stackId="a" fill="#b91c1c" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* ══════════════════════════════════════════
              SEÇÃO 2 — Comparação com sprint anterior
          ══════════════════════════════════════════ */}
          <section className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-800">
                Comparação com sprint anterior
              </h2>
              <select
                value={prevSprintId}
                onChange={(e) => setPrevSprintId(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Selecionar sprint anterior…</option>
                {sprints
                  .filter((s) => s.id !== sprintId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>Sprint {s.id}</option>
                  ))}
              </select>
            </div>

            {!prevSprintId && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
                Selecione uma sprint anterior para ver a comparação.
              </div>
            )}

            {prevSprintId && compLoading && (
              <div className="text-center py-8 text-gray-400 animate-pulse text-sm">Carregando comparação…</div>
            )}

            {prevSprintId && !compLoading && comparacao && (
              <>
                {/* Alerta cards 3+ sprints */}
                {alertCards.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-orange-800 mb-2">
                      ⚠️ Cards arrastando há 3 ou mais sprints
                    </p>
                    <ul className="space-y-1">
                      {alertCards.map((c) => (
                        <li key={c.card} className="text-sm text-orange-700">
                          <a
                            href={`${JIRA_BASE}/browse/${c.card}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono hover:text-primary-800 hover:underline"
                          >
                            {c.card}
                          </a>
                          {' '}— {c.tema}{' '}
                          <span className="font-semibold">({c.sprints_arrastando} sprints)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 2.1 Delta cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <DeltaCard
                    label="Total de Cards"
                    current={comparacao.metricas_atual.total}
                    previous={comparacao.metricas_anterior.total}
                    delta={comparacao.delta_total_cards}
                    positiveDir="neutral"
                  />
                  <DeltaCard
                    label="Taxa de Entrega"
                    current={comparacao.metricas_atual.taxaEntrega}
                    previous={comparacao.metricas_anterior.taxaEntrega}
                    delta={comparacao.delta_taxa_entrega}
                    positiveDir="up"
                    unit="%"
                  />
                  <DeltaCard
                    label="Transbordamentos"
                    current={comparacao.metricas_atual.transbordaram}
                    previous={comparacao.metricas_anterior.transbordaram}
                    delta={comparacao.delta_transbordamentos}
                    positiveDir="down"
                  />
                  {Object.entries(comparacao.delta_por_time)
                    .slice(0, 2)
                    .map(([time, delta]) => (
                      <DeltaCard
                        key={time}
                        label={`Cards — ${time.split(' ')[0]}`}
                        current={comparacao.metricas_atual.porTime[time]?.total ?? 0}
                        previous={comparacao.metricas_anterior.porTime[time]?.total ?? 0}
                        delta={delta}
                        positiveDir="neutral"
                      />
                    ))}
                </div>

                {/* 2.2 Cards que transbordaram da sprint anterior */}
                {comparacao.cards_transbordados_da_anterior.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-orange-50 border-b border-orange-100">
                      <h3 className="text-sm font-semibold text-orange-800">
                        Cards que transbordaram da sprint {prevSprintId}
                        <span className="ml-2 font-normal text-orange-600">
                          ({comparacao.cards_transbordados_da_anterior.length})
                        </span>
                      </h3>
                    </div>
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="px-4 py-2.5 text-left">Card</th>
                          <th className="px-4 py-2.5 text-left">Tema</th>
                          <th className="px-4 py-2.5 text-left">Time</th>
                          <th className="px-4 py-2.5 text-center">Sprints arrastando</th>
                          <th className="px-4 py-2.5 text-left">Status atual</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {comparacao.cards_transbordados_da_anterior.map((c) => (
                          <tr key={c.card} className={c.sprints_arrastando >= 3 ? 'bg-orange-50/40' : ''}>
                            <td className="px-4 py-2.5">
                              <a
                                href={`${JIRA_BASE}/browse/${c.card}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-primary-600 hover:text-primary-800 hover:underline"
                              >
                                {c.card}
                              </a>
                            </td>
                            <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate" title={c.tema}>
                              {c.tema}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{c.time}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`text-xs font-semibold ${c.sprints_arrastando >= 3 ? 'text-orange-600' : 'text-gray-600'}`}>
                                {c.sprints_arrastando} {c.sprints_arrastando >= 3 ? '🔴' : ''}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <StatusBadge status={c.status_jira} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 2.3 Novos vs Arrastados */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Donut */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">
                      Origem dos cards — Sprint {sprintId}
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">Novos vs arrastados da sprint anterior</p>
                    {pieData.every((d) => d.value === 0) ? (
                      <p className="text-sm text-gray-400 text-center py-8">Sem dados suficientes.</p>
                    ) : (
                      <div className="flex items-center gap-4">
                        <PieChart width={160} height={160}>
                          <Pie
                            data={pieData}
                            innerRadius={50}
                            outerRadius={72}
                            dataKey="value"
                            paddingAngle={2}
                          >
                            <Cell fill="#8629ff" />
                            <Cell fill="#f97316" />
                          </Pie>
                          <Tooltip />
                        </PieChart>
                        <ul className="space-y-2 text-sm">
                          {pieData.map((d, i) => (
                            <li key={d.name} className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: i === 0 ? '#8629ff' : '#f97316' }}
                              />
                              <span className="text-gray-700">{d.name}</span>
                              <span className="text-gray-400">
                                ({pct(d.value, total)}%)
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Lista de cards novos */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Cards novos nesta sprint
                      <span className="ml-2 font-normal text-gray-400">
                        ({comparacao.cards_novos_esta_sprint.length})
                      </span>
                    </h3>
                    {comparacao.cards_novos_esta_sprint.length === 0 ? (
                      <p className="text-sm text-gray-400">Todos os cards vieram da sprint anterior.</p>
                    ) : (
                      <ul className="space-y-2">
                        {comparacao.cards_novos_esta_sprint.map((c) => (
                          <li key={c.card} className="flex items-center gap-3 text-sm">
                            <a
                              href={`${JIRA_BASE}/browse/${c.card}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-primary-600 hover:text-primary-800 hover:underline flex-shrink-0"
                            >
                              {c.card}
                            </a>
                            <span className="text-gray-600 truncate flex-1" title={c.tema}>
                              {c.tema}
                            </span>
                            <StatusBadge status={c.status_jira} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}

      {!loading && !reviewData && (
        <div className="text-center py-16 text-gray-400">
          Nenhuma sprint encontrada. Crie uma sprint na aba Planning.
        </div>
      )}
    </div>
  );
}
