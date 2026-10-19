import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell, LabelList, PieChart, Pie,
} from 'recharts';
import { getIndicadores } from '../services/api';

// ── Config ────────────────────────────────────────────────────────────────────
const PROJ = {
  CRPR: { name: 'Pricing', color: '#5521B5' },
  CRVE: { name: 'Vendas',  color: '#0ea5e9' },
  CRMI: { name: 'Mídia',   color: '#10b981' },
};
const PROJ_ORDER = ['CRPR', 'CRVE', 'CRMI'];

const PRICING_SQUADS = [
  { key: 'dev_pricing',   label: 'Dev',   color: '#5521B5' },
  { key: 'dados_pricing', label: 'Dados', color: '#7c3aed' },
  { key: 'DS_pricing',    label: 'DS',    color: '#a78bfa' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const pct  = (v) => `${(v * 100).toFixed(0)}%`;
const pctN = (v) => `${v.toFixed(0)}%`;
const shortSprint = (name = '') => {
  const m = name.match(/\d{2}\.\d+\.\d+/);
  return m ? m[0] : name.split(' ').slice(-1)[0];
};
const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${String(y).slice(2)}`;
};
const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

const completionColor = (v) =>
  v >= 90 ? '#16a34a' : v >= 75 ? '#ca8a04' : '#dc2626';
const completionBg = (v) =>
  v >= 90 ? '#f0fdf4' : v >= 75 ? '#fefce8' : '#fef2f2';

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = '#5521B5' }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '18px 22px',
      border: `1.5px solid ${color}22`, flex: 1, minWidth: 150,
      boxShadow: '0 2px 8px rgba(0,0,0,.05)',
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value ?? '—'}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ title, color, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '18px 22px',
      border: `1.5px solid ${color}22`, boxShadow: '0 2px 8px rgba(0,0,0,.05)',
    }}>
      {title && (
        <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Título de seção ───────────────────────────────────────────────────────────
function SectionTitle({ label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ width: 4, height: 22, borderRadius: 2, background: color }} />
      <span style={{ fontSize: 16, fontWeight: 800, color }}>{label}</span>
    </div>
  );
}

// ── Tooltip customizado ───────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a1a2e', color: '#f9fafb', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map(p => p.value != null && (
        <div key={p.name} style={{ color: p.color || '#f9fafb' }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ── Burndown line chart (ideal / real / projeção) ─────────────────────────────
function BurndownLineChart({ burndown, color }) {
  if (!burndown) return <div style={{ color: '#bbb', fontSize: 13 }}>Sem sprint ativa.</div>;

  const { total, done, remaining, start, end } = burndown;

  const startMs  = start ? new Date(start).getTime() : null;
  const endMs    = end   ? new Date(end).getTime()   : null;
  const todayMs  = new Date().setHours(0, 0, 0, 0);
  const totalDays = (startMs && endMs) ? Math.round((endMs - startMs) / 86400000) : 14;
  const dayNow    = startMs ? Math.min(Math.max(0, Math.round((todayMs - startMs) / 86400000)), totalDays) : 0;
  const burnedPerDay = dayNow > 0 ? (total - remaining) / dayNow : 0;

  const chartData = Array.from({ length: totalDays + 1 }, (_, i) => {
    const ideal = +(total * (1 - i / totalDays)).toFixed(0);
    const real  = i <= dayNow
      ? (dayNow === 0 ? total : +(total - (total - remaining) * (i / dayNow)).toFixed(0))
      : null;
    const proj  = i >= dayNow
      ? Math.max(0, +(remaining - burnedPerDay * (i - dayNow)).toFixed(0))
      : null;
    return { dia: `D${i}`, Ideal: ideal, Real: real, 'Projeção': proj };
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 8 }}>
        <strong style={{ color: '#1a1a2e', fontSize: 13 }}>{burndown.sprint}</strong>
        <span>
          {start && end && `${fmtDate(start)} → ${fmtDate(end)} · `}
          {done} / {total} concluídos · dia {dayNow}/{totalDays}
        </span>
      </div>
      <div style={{ height: 8, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ height: '100%', width: `${total > 0 ? (done / total) * 100 : 0}%`, background: color, borderRadius: 99, transition: 'width .5s' }} />
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
          <XAxis dataKey="dia" tick={{ fontSize: 10 }} interval={1} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line dataKey="Ideal"     type="linear"   stroke="#d1d5db" strokeDasharray="6 4" strokeWidth={1.5} dot={false} />
          <Line dataKey="Real"      type="monotone" stroke={color}   strokeWidth={2.5}     dot={{ r: 3, fill: color }} connectNulls={false} />
          <Line dataKey="Projeção"  type="monotone" stroke={color}   strokeDasharray="3 4" strokeWidth={1.5} dot={false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
        <span style={{ color: '#10b981', fontWeight: 600 }}>✓ {done} concluídos</span>
        <span style={{ color: '#f59e0b', fontWeight: 600 }}>↻ {remaining} restantes</span>
        {burnedPerDay > 0 && <span style={{ color: '#888' }}>~{burnedPerDay.toFixed(1)} itens/dia</span>}
      </div>
    </div>
  );
}

// ── Breakdown por tipo (mini gráfico no burndown) ─────────────────────────────
function BurndownByType({ burndown, color }) {
  const { by_type = {}, by_type_done = {}, by_assignee = {} } = burndown;

  const typeData = Object.entries(by_type)
    .map(([tipo, tot]) => ({ tipo, Concluídos: by_type_done[tipo] || 0, Restantes: tot - (by_type_done[tipo] || 0) }))
    .filter(d => d.Concluídos + d.Restantes > 0)
    .sort((a, b) => (b.Concluídos + b.Restantes) - (a.Concluídos + a.Restantes));

  const personData = Object.entries(by_assignee)
    .map(([nome, c]) => ({ nome: nome.split(' ')[0], nomeCompleto: nome, Concluídos: c.done, Restantes: c.total - c.done }))
    .filter(d => d.Concluídos + d.Restantes > 0)
    .sort((a, b) => (b.Concluídos + b.Restantes) - (a.Concluídos + a.Restantes));

  if (!typeData.length && !personData.length) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 14, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f5f5f5' }}>
      {typeData.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Por Tipo</div>
          <ResponsiveContainer width="100%" height={Math.max(100, typeData.length * 28)}>
            <BarChart data={typeData} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 4 }}>
              <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
              <YAxis type="category" dataKey="tipo" tick={{ fontSize: 9 }} width={80} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="Concluídos" stackId="a" fill={color} />
              <Bar dataKey="Restantes"  stackId="a" fill="#e5e7eb" radius={[0, 3, 3, 0]}>
                <LabelList dataKey="Restantes" position="right" style={{ fontSize: 9, fill: '#999' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {personData.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Por Desenvolvedor</div>
          <ResponsiveContainer width="100%" height={Math.max(100, personData.length * 28)}>
            <BarChart data={personData} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 4 }}>
              <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 9 }} width={65} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = personData.find(p => p.nome === label);
                  return (
                    <div style={{ background: '#1a1a2e', color: '#f9fafb', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{row?.nomeCompleto || label}</div>
                      {payload.map(p => <div key={p.name} style={{ color: p.fill === '#e5e7eb' ? '#aaa' : color }}>{p.name}: <strong>{p.value}</strong></div>)}
                    </div>
                  );
                }}
              />
              <Bar dataKey="Concluídos" stackId="a" fill={color} />
              <Bar dataKey="Restantes"  stackId="a" fill="#e5e7eb" radius={[0, 3, 3, 0]}>
                <LabelList dataKey="Restantes" position="right" style={{ fontSize: 9, fill: '#999' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Heatmap histórico de sprints ──────────────────────────────────────────────
function SprintHistoryTable({ sprints, color }) {
  const closed = [...sprints]
    .filter(s => s.state === 'closed')
    .sort((a, b) => shortSprint(a.name).localeCompare(shortSprint(b.name)));
  if (!closed.length) return <div style={{ color: '#bbb', fontSize: 13 }}>Sem sprints fechadas.</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #f0e8ff' }}>
            {['Sprint', 'Total', 'Entregues', 'Conclusão', 'SP Total', 'SP Entregues'].map(h => (
              <th key={h} style={{ padding: '7px 10px', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.04em', textAlign: h === 'Sprint' ? 'left' : 'center', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {closed.map((s, i) => {
            const rate = +(s.completion_rate * 100).toFixed(0);
            return (
              <tr key={s.id} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff', borderBottom: '1px solid #f5f0ff' }}>
                <td style={{ padding: '8px 10px', fontWeight: 700, color }}>
                  {shortSprint(s.name)}
                  {s.start && <span style={{ fontWeight: 400, color: '#999', fontSize: 10, marginLeft: 6 }}>{fmtDate(s.start)}</span>}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#555' }}>{s.total}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#10b981' }}>{s.done}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <span style={{
                    background: completionBg(rate), color: completionColor(rate),
                    borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                  }}>{rate}%</span>
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#555' }}>{s.sp_total || 0}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                    <div style={{ height: 6, width: 44, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${s.sp_total > 0 ? (s.sp_done / s.sp_total) * 100 : 0}%`, background: color, borderRadius: 99 }} />
                    </div>
                    <span style={{ fontWeight: 700, color }}>{s.sp_done || 0}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Distribuição por tipo (gráfico pizza) ─────────────────────────────────────
function IssueTypeDonut({ sprints, color }) {
  const closed = sprints.filter(s => s.state === 'closed');
  if (!closed.length) return null;

  const totals = {};
  const dones  = {};
  for (const sp of closed) {
    for (const [t, v] of Object.entries(sp.by_type || {})) {
      totals[t] = (totals[t] || 0) + v;
    }
    for (const [t, v] of Object.entries(sp.by_type_done || {})) {
      dones[t] = (dones[t] || 0) + v;
    }
  }

  const data = Object.entries(totals)
    .map(([tipo, total]) => ({ tipo, total, done: dones[tipo] || 0, rate: total > 0 ? +((dones[tipo] || 0) / total * 100).toFixed(0) : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const COLORS = [color, '#818cf8', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#67e8f9', '#fca5a5'];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'center' }}>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} dataKey="total" nameKey="tipo" cx="50%" cy="50%" outerRadius={72} innerRadius={36}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v, name) => [v, name]} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((d, i) => (
          <div key={d.tipo} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#555', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.tipo}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#333', minWidth: 24 }}>{d.total}</span>
            <span style={{ fontSize: 10, color: completionColor(d.rate), background: completionBg(d.rate), borderRadius: 99, padding: '1px 6px', fontWeight: 600 }}>{d.rate}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SP acumulado ──────────────────────────────────────────────────────────────
function CumulativeSpChart({ sprints, color }) {
  const closed = [...sprints]
    .filter(s => s.state === 'closed')
    .sort((a, b) => shortSprint(a.name).localeCompare(shortSprint(b.name)));
  if (!closed.length) return null;

  let cumSp = 0;
  let cumThr = 0;
  const data = closed.map(s => {
    cumSp  += s.sp_done || 0;
    cumThr += s.done || 0;
    return { sprint: shortSprint(s.name), 'SP Sprint': s.sp_done || 0, 'SP Acum.': cumSp, 'Itens Acum.': cumThr };
  });

  return (
    <ResponsiveContainer width="100%" height={190}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
        <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="SP Sprint" fill={`${color}55`} />
        <Line dataKey="SP Acum." type="monotone" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Squads Pricing ────────────────────────────────────────────────────────────
function PricingSquadsSection({ data, color }) {
  const [activeSquad, setActiveSquad] = useState(PRICING_SQUADS[0].key);
  const squad = PRICING_SQUADS.find(s => s.key === activeSquad);

  const sprints = data.sprints || [];
  const closedSprints = [...sprints.filter(s => s.state === 'closed')]
    .sort((a, b) => shortSprint(a.name).localeCompare(shortSprint(b.name)));

  // Chart: throughput comparado entre squads
  const compData = closedSprints.map(s => {
    const row = { sprint: shortSprint(s.name) };
    for (const sq of PRICING_SQUADS) {
      row[sq.label] = s.by_label?.[sq.key] != null
        ? (s.by_label_done?.[sq.key] || 0)
        : null;
    }
    return row;
  });

  // Métricas do squad selecionado
  const squadCumulative = closedSprints.reduce((s, sp) => s + (sp.by_label_done?.[activeSquad] || 0), 0);
  const squadAvgThr     = avg(closedSprints.map(s => s.by_label_done?.[activeSquad] || 0));
  const squadTotal      = closedSprints.reduce((s, sp) => s + (sp.by_label?.[activeSquad] || 0), 0);
  const squadRate       = squadTotal > 0 ? +((squadCumulative / squadTotal) * 100).toFixed(0) : 0;

  const activeSprint    = sprints.find(s => s.state === 'active');
  const activeSquadThr  = activeSprint?.by_label_done?.[activeSquad] ?? null;
  const activeSquadTot  = activeSprint?.by_label?.[activeSquad] ?? null;

  // Sprint history por squad
  const squadSprintData = closedSprints.map(s => ({
    sprint: shortSprint(s.name),
    total:  s.by_label?.[activeSquad] || 0,
    done:   s.by_label_done?.[activeSquad] || 0,
    rate:   (s.by_label?.[activeSquad] || 0) > 0
      ? +((s.by_label_done?.[activeSquad] || 0) / s.by_label[activeSquad] * 100).toFixed(0)
      : 0,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Sub-tabs squad */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid #f3f4f6' }}>
        {PRICING_SQUADS.map(sq => {
          const active = sq.key === activeSquad;
          return (
            <button key={sq.key} onClick={() => setActiveSquad(sq.key)} style={{
              padding: '7px 16px', fontSize: 12, fontWeight: 700, border: 'none',
              borderBottom: active ? `2.5px solid ${sq.color}` : '2.5px solid transparent',
              background: 'transparent', color: active ? sq.color : '#aaa',
              cursor: 'pointer', marginBottom: -2,
            }}>
              {sq.label}
            </button>
          );
        })}
      </div>

      {/* KPIs do squad */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiCard label="Itens entregues (acum.)" value={squadCumulative} sub="sprints fechadas" color={squad.color} />
        <KpiCard label="Throughput médio"         value={squadAvgThr}    sub="itens/sprint"     color={squad.color} />
        <KpiCard label="Taxa de conclusão"        value={`${squadRate}%`} sub="acumulado"        color={squad.color} />
        {activeSquadThr != null && (
          <KpiCard label="Sprint ativa — entregues" value={activeSquadThr} sub={activeSquadTot != null ? `de ${activeSquadTot} comprometidos` : ''} color={squad.color} />
        )}
      </div>

      {/* Throughput comparado */}
      <Card title="Throughput por Squad — Histórico" color={color}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={compData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
            <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {PRICING_SQUADS.map(sq => (
              <Line key={sq.key} dataKey={sq.label} type="monotone" stroke={sq.color} strokeWidth={2.5} dot={{ r: 3, fill: sq.color }} activeDot={{ r: 5 }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Histórico do squad selecionado */}
      {squadSprintData.some(d => d.total > 0) && (
        <Card title={`Histórico Sprint — ${squad.label}`} color={squad.color}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0e8ff' }}>
                  {['Sprint', 'Comprometido', 'Entregues', 'Taxa'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.04em', textAlign: h === 'Sprint' ? 'left' : 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {squadSprintData.map((row, i) => (
                  <tr key={row.sprint} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff', borderBottom: '1px solid #f5f0ff' }}>
                    <td style={{ padding: '7px 10px', fontWeight: 700, color: squad.color }}>{row.sprint}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: '#555' }}>{row.total || '—'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700, color: '#10b981' }}>{row.done || '—'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      {row.total > 0
                        ? <span style={{ background: completionBg(row.rate), color: completionColor(row.rate), borderRadius: 99, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{row.rate}%</span>
                        : <span style={{ color: '#ddd' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </div>
  );
}

// ── Aba de projeto ────────────────────────────────────────────────────────────
function ProjectTab({ projKey, data }) {
  const { color } = PROJ[projKey];
  const sprints      = data.sprints || [];
  const closedSprints = sprints.filter(s => s.state === 'closed').sort((a, b) => shortSprint(a.name).localeCompare(shortSprint(b.name)));
  const activeSprint  = sprints.find(s => s.state === 'active');
  const kpiSprint     = activeSprint || closedSprints[closedSprints.length - 1];

  const chartData = closedSprints.map(s => ({
    sprint:         shortSprint(s.name),
    Throughput:     s.throughput,
    'SP Entregues': s.sp_done,
    'Taxa (%)':     +(s.completion_rate * 100).toFixed(0),
  }));

  const cumulative    = sprints.reduce((s, sp) => s + sp.throughput, 0);
  const avgThroughput = avg(closedSprints.map(s => s.throughput));
  const avgConclusao  = avg(closedSprints.map(s => +(s.completion_rate * 100).toFixed(0)));
  const totalSp       = sprints.reduce((s, sp) => s + (sp.sp_done || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Sprint ativa */}
      {data.active_sprint && (
        <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 12, padding: '12px 18px', fontSize: 13, color: '#166534' }}>
          <strong>Sprint ativa:</strong> {data.active_sprint.name}
          {data.active_sprint.start && ` · ${fmtDate(data.active_sprint.start)} → ${fmtDate(data.active_sprint.end)}`}
          {data.active_sprint.goal && <div style={{ marginTop: 4, color: '#15803d', fontStyle: 'italic' }}>"{data.active_sprint.goal}"</div>}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiCard label="Itens entregues (acum.)" value={cumulative}          sub="throughput total"                     color={color} />
        <KpiCard label="Throughput médio"         value={avgThroughput}       sub="itens / sprint (fechadas)"            color={color} />
        <KpiCard label="Conclusão média"          value={`${avgConclusao}%`}  sub="sprints fechadas"                     color={color} />
        <KpiCard label="SP entregues (acum.)"     value={totalSp}             sub="story points totais"                  color={color} />
        {kpiSprint && <KpiCard label={`Sprint ${shortSprint(kpiSprint.name)}`} value={`${+(kpiSprint.completion_rate * 100).toFixed(0)}%`} sub={`${kpiSprint.done}/${kpiSprint.total} concluídos`} color={color} />}
      </div>

      {/* Gráficos históricos */}
      {chartData.length > 0 && (
        <div>
          <SectionTitle label="Velocidade por Sprint" color={color} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 14 }}>

            <Card title="Throughput por Sprint" color={color}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line dataKey="Throughput" type="monotone" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Story Points Acumulados" color={color}>
              <CumulativeSpChart sprints={sprints} color={color} />
            </Card>

            <Card title="Taxa de Conclusão (%)" color={color}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
                  <YAxis domain={[50, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line dataKey="Taxa (%)" type="monotone" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

          </div>
        </div>
      )}

      {/* Distribuição por tipo */}
      {sprints.some(s => s.by_type && Object.keys(s.by_type).length > 0) && (
        <div>
          <SectionTitle label="Distribuição por Tipo de Issue" color={color} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 14 }}>
            <Card title="Tipos (acumulado sprints fechadas)" color={color}>
              <IssueTypeDonut sprints={sprints} color={color} />
            </Card>
            <Card title="Histórico de Sprints" color={color}>
              <SprintHistoryTable sprints={sprints} color={color} />
            </Card>
          </div>
        </div>
      )}

      {/* Pricing: breakdown por squad */}
      {projKey === 'CRPR' && (
        <div>
          <SectionTitle label="Breakdown por Squad" color={color} />
          <Card title="" color={color}>
            <PricingSquadsSection data={data} color={color} />
          </Card>
        </div>
      )}

      {/* Burndown */}
      <div>
        <SectionTitle label="Burndown — Sprint Ativa" color={color} />
        <Card title="" color={color}>
          <BurndownLineChart burndown={data.burndown} color={color} />
          {data.burndown && <BurndownByType burndown={data.burndown} color={color} />}
        </Card>
      </div>

    </div>
  );
}

// ── Quadro comparativo ────────────────────────────────────────────────────────
function ComparisonTable({ data }) {
  const tag = (v, thresholds = [95, 85]) => {
    const color = v >= thresholds[0] ? '#2E7D32' : v >= thresholds[1] ? '#b45309' : '#b91c1c';
    const bg    = v >= thresholds[0] ? '#E8F5E9' : v >= thresholds[1] ? '#fef3c7' : '#fef2f2';
    return <span style={{ background: bg, color, borderRadius: 99, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{v.toFixed(0)}%</span>;
  };

  const rows = PROJ_ORDER.map(k => {
    const sprints = data[k]?.sprints || [];
    const closed  = sprints.filter(s => s.state === 'closed').sort((a, b) => shortSprint(a.name).localeCompare(shortSprint(b.name)));
    const active  = sprints.find(s => s.state === 'active');
    const last    = closed[closed.length - 1];
    return {
      key:          k,
      name:         PROJ[k].name,
      color:        PROJ[k].color,
      cumulative:   sprints.reduce((s, sp) => s + sp.throughput, 0),
      avgThr:       avg(closed.map(s => s.throughput)),
      avgConc:      avg(closed.map(s => +(s.completion_rate * 100).toFixed(0))),
      lastConc:     last ? +(last.completion_rate * 100).toFixed(1) : null,
      activeConc:   active ? +(active.completion_rate * 100).toFixed(1) : null,
      activeTotal:  active?.total ?? null,
      spAcum:       sprints.reduce((s, sp) => s + (sp.sp_done || 0), 0),
      teamSize:     data[k]?.contributors?.length ?? 0,
    };
  });

  const cols = [
    { label: 'Throughput médio (fechadas)', fn: r => r.avgThr },
    { label: 'Itens entregues (acum.)',      fn: r => r.cumulative },
    { label: 'Conclusão média (fechadas)',   fn: r => tag(r.avgConc) },
    { label: 'Conclusão última sprint',      fn: r => r.lastConc != null ? tag(r.lastConc) : '—' },
    { label: 'Conclusão sprint ativa',       fn: r => r.activeConc != null ? tag(r.activeConc) : '—' },
    { label: 'Comprometido sprint ativa',    fn: r => r.activeTotal ?? '—' },
    { label: 'SP entregues (acum.)',         fn: r => r.spAcum },
    { label: 'Devs com itens',               fn: r => r.teamSize },
  ];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #f0e8ff' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.04em', minWidth: 200 }}>Dimensão</th>
            {rows.map(r => (
              <th key={r.key} style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 800, color: r.color, whiteSpace: 'nowrap' }}>
                {r.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cols.map(col => (
            <tr key={col.label} style={{ borderBottom: '1px solid #f5f0ff' }}>
              <td style={{ padding: '9px 12px', color: '#555', fontSize: 12 }}>{col.label}</td>
              {rows.map((r, i) => (
                <td key={r.key} style={{ padding: '9px 12px', textAlign: 'center', background: i % 2 === 0 ? '#fafafa' : '#fff', fontWeight: 600, color: '#1a1a2e' }}>
                  {col.fn(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Aba consolidada ────────────────────────────────────────────────────────────
function ConsolidadoTab({ data }) {
  const allLabels = [...new Set(
    PROJ_ORDER.flatMap(k => (data[k]?.sprints || []).map(s => shortSprint(s.name)))
  )].sort();

  const multiData = allLabels.map(label => {
    const row = { sprint: label };
    for (const k of PROJ_ORDER) {
      const sp = (data[k]?.sprints || []).find(s => shortSprint(s.name) === label);
      row[`thr_${k}`]  = sp?.throughput ?? null;
      row[`conc_${k}`] = sp ? +(sp.completion_rate * 100).toFixed(0) : null;
    }
    return row;
  });

  const kpiTotal = PROJ_ORDER.reduce((s, k) => {
    const active = data[k]?.sprints?.find(sp => sp.state === 'active') || data[k]?.sprints?.slice(-1)[0];
    return { throughput: s.throughput + (active?.throughput || 0), total: s.total + (active?.total || 0) };
  }, { throughput: 0, total: 0 });

  const totalAcum  = PROJ_ORDER.reduce((s, k) => s + (data[k]?.sprints || []).reduce((a, sp) => a + sp.throughput, 0), 0);
  const totalDevs  = new Set(PROJ_ORDER.flatMap(k => (data[k]?.contributors || []).map(c => c.name))).size;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* KPIs globais */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {PROJ_ORDER.map(k => {
          const { color, name } = PROJ[k];
          const sp = data[k]?.sprints?.find(s => s.state === 'active') || data[k]?.sprints?.slice(-1)[0];
          return (
            <div key={k} style={{ flex: 1, minWidth: 160, background: '#fff', borderRadius: 14, padding: '18px 22px', border: `1.5px solid ${color}22`, boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{name}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color }}>{sp?.throughput ?? '—'}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>{sp ? `${pctN(sp.completion_rate * 100)} · ${sp.sp_done} SP` : 'sem dados'}</div>
            </div>
          );
        })}
        <KpiCard label="Itens entregues (acum.)" value={totalAcum.toLocaleString('pt-BR')} sub={`${totalDevs} devs somados`} color="#374151" />
      </div>

      {/* Throughput comparado — linha */}
      <div>
        <SectionTitle label="Throughput Comparado por Sprint" color="#374151" />
        <Card title="" color="#374151">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={multiData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
              <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {PROJ_ORDER.map(k => (
                <Line key={k} dataKey={`thr_${k}`} name={PROJ[k].name} type="monotone" stroke={PROJ[k].color} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Taxa de conclusão comparada */}
      <div>
        <SectionTitle label="Taxa de Conclusão Comparada (%)" color="#374151" />
        <Card title="" color="#374151">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={multiData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
              <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
              <YAxis domain={[50, 105]} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {PROJ_ORDER.map(k => (
                <Line key={k} dataKey={`conc_${k}`} name={PROJ[k].name} type="monotone" stroke={PROJ[k].color} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Quadro comparativo */}
      <div>
        <SectionTitle label="Quadro Comparativo Executivo" color="#374151" />
        <Card title="" color="#374151">
          <ComparisonTable data={data} />
        </Card>
      </div>

      {/* Burndown por squad */}
      <div>
        <SectionTitle label="Burndown — Sprint Ativa" color="#374151" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {PROJ_ORDER.map(k => (
            <Card key={k} title={PROJ[k].name.toUpperCase()} color={PROJ[k].color}>
              <BurndownLineChart burndown={data[k]?.burndown} color={PROJ[k].color} />
              {data[k]?.burndown && <BurndownByType burndown={data[k].burndown} color={PROJ[k].color} />}
            </Card>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Indicadores() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [tab,     setTab]     = useState('CRVE');

  const load = () => {
    setLoading(true);
    setError(null);
    getIndicadores()
      .then(setData)
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const genAt = data?.generated_at
    ? new Date(data.generated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  const TABS = [
    { id: 'CONSOLIDADO', label: 'Consolidado', color: '#374151' },
    ...PROJ_ORDER.map(k => ({ id: k, label: PROJ[k].name, color: PROJ[k].color })),
  ];

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', margin: 0, letterSpacing: -.5 }}>Indicadores</h1>
          <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
            Pricing · Vendas · Mídia — velocidade por sprint via Jira
            {genAt && <span style={{ marginLeft: 8, color: '#ccc' }}>· atualizado {genAt}</span>}
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#5521B5', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1, boxShadow: '0 2px 8px rgba(85,33,181,.25)' }}>
          {loading
            ? <><span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Carregando…</>
            : '↻ Atualizar'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid #f3f4f6', marginBottom: 28 }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '9px 20px', fontSize: 13, fontWeight: 700, border: 'none', borderBottom: active ? `2.5px solid ${t.color}` : '2.5px solid transparent', background: 'transparent', color: active ? t.color : '#aaa', cursor: 'pointer', marginBottom: -2, transition: 'color .15s' }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Erro */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#b91c1c', marginBottom: 20 }}>
          <strong>Erro ao carregar dados:</strong> {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[80, 200, 200, 200].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 14, background: '#f3f4f6', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {/* Conteúdo */}
      {!loading && data && (
        tab === 'CONSOLIDADO'
          ? <ConsolidadoTab data={data} />
          : <ProjectTab projKey={tab} data={data[tab]} />
      )}

      {!loading && !data && !error && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb', fontSize: 14 }}>
          Clique em Atualizar para carregar os dados.
        </div>
      )}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.45; } }
      `}</style>
    </div>
  );
}
