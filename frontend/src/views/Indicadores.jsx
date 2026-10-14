import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell, LabelList,
} from 'recharts';
import { getIndicadores } from '../services/api';

// ── Config de projeto ─────────────────────────────────────────────────────────
const PROJ = {
  CRPR: { name: 'Pricing', color: '#5521B5' },
  CRVE: { name: 'Vendas',  color: '#0ea5e9' },
  CRMI: { name: 'Mídia',   color: '#10b981' },
};
const PROJ_ORDER = ['CRPR', 'CRVE', 'CRMI'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const pct = (v) => `${(v * 100).toFixed(0)}%`;
const shortSprint = (name = '') => {
  const m = name.match(/\d{2}\.\d+\.\d+/);
  return m ? m[0] : name.split(' ').slice(-1)[0];
};
const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${String(y).slice(2)}`;
};

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

// ── Card container (chart/table wrapper) ─────────────────────────────────────
function Card({ title, color, children, span }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '18px 22px',
      border: `1.5px solid ${color}22`, boxShadow: '0 2px 8px rgba(0,0,0,.05)',
      gridColumn: span ? `span ${span}` : undefined,
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

// ── Burndown completo (progresso + gráfico por tipo + por pessoa) ─────────────
function BurndownSection({ burndown, color }) {
  if (!burndown) return <div style={{ color: '#bbb', fontSize: 13 }}>Sem sprint ativa.</div>;
  const { total, done, remaining, by_type = {}, by_type_done = {}, by_assignee = {} } = burndown;
  const pctDone = total > 0 ? done / total : 0;

  // dados por tipo: ordena por total desc, filtra tipos com 0
  const typeData = Object.entries(by_type)
    .map(([tipo, tot]) => ({
      tipo,
      Concluídos: by_type_done[tipo] || 0,
      Restantes:  tot - (by_type_done[tipo] || 0),
    }))
    .filter(d => d.Concluídos + d.Restantes > 0)
    .sort((a, b) => (b.Concluídos + b.Restantes) - (a.Concluídos + a.Restantes));

  // dados por pessoa (apenas com itens na sprint ativa)
  const personData = Object.entries(by_assignee)
    .map(([nome, c]) => ({
      nome: nome.split(' ')[0], // só primeiro nome para caber
      nomeCompleto: nome,
      Concluídos: c.done,
      Restantes:  c.total - c.done,
    }))
    .filter(d => d.Concluídos + d.Restantes > 0)
    .sort((a, b) => (b.Concluídos + b.Restantes) - (a.Concluídos + a.Restantes));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Barra de progresso geral */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 8 }}>
          <strong style={{ color: '#1a1a2e', fontSize: 13 }}>{burndown.sprint}</strong>
          <span>{done} / {total} concluídos ({pct(pctDone)})</span>
        </div>
        <div style={{ height: 10, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pctDone * 100}%`, background: color, borderRadius: 99, transition: 'width .5s' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
          <span style={{ color: '#10b981', fontWeight: 600 }}>✓ {done} concluídos</span>
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>↻ {remaining} restantes</span>
        </div>
      </div>

      {/* Gráficos lado a lado */}
      {(typeData.length > 0 || personData.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 14 }}>

          {/* Por tipo */}
          {typeData.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                Por Tipo de Item
              </div>
              <ResponsiveContainer width="100%" height={Math.max(120, typeData.length * 32)}>
                <BarChart data={typeData} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="tipo" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Concluídos" stackId="a" fill={color} radius={[0,0,0,0]} />
                  <Bar dataKey="Restantes"  stackId="a" fill="#e5e7eb" radius={[0,3,3,0]}>
                    <LabelList dataKey="Restantes" position="right" style={{ fontSize: 10, fill: '#999' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Por pessoa */}
          {personData.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                Por Desenvolvedor
              </div>
              <ResponsiveContainer width="100%" height={Math.max(120, personData.length * 32)}>
                <BarChart data={personData} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={70} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const row = personData.find(p => p.nome === label);
                      return (
                        <div style={{ background: '#1a1a2e', color: '#f9fafb', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>{row?.nomeCompleto || label}</div>
                          {payload.map(p => (
                            <div key={p.name} style={{ color: p.fill === '#e5e7eb' ? '#aaa' : color }}>
                              {p.name}: <strong>{p.value}</strong>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Concluídos" stackId="a" fill={color} />
                  <Bar dataKey="Restantes"  stackId="a" fill="#e5e7eb" radius={[0,3,3,0]}>
                    <LabelList dataKey="Restantes" position="right" style={{ fontSize: 10, fill: '#999' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ── Tabela de contribuição ────────────────────────────────────────────────────
function ContributorsTable({ contributors, color }) {
  if (!contributors?.length) return <div style={{ color: '#bbb', fontSize: 13 }}>Sem dados.</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #f0e8ff' }}>
            {['Desenvolvedor', 'Total', 'Concluídos', '% Contrib.', 'Sprint ativa'].map(h => (
              <th key={h} style={{
                padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#888',
                textAlign: h === 'Desenvolvedor' ? 'left' : 'center',
                whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '.04em',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contributors.map((c, i) => (
            <tr key={c.name} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff', borderBottom: '1px solid #f5f0ff' }}>
              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1a1a2e' }}>{c.name}</td>
              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#333' }}>{c.total}</td>
              <td style={{ padding: '8px 10px', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{c.done}</td>
              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                  <div style={{ height: 6, width: 56, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${c.pct * 100}%`, background: color, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#888', minWidth: 30 }}>{pct(c.pct)}</span>
                </div>
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                {c.active
                  ? <span style={{ background: '#E8F5E9', color: '#2E7D32', borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>✓ Sim</span>
                  : <span style={{ background: '#f5f5f5', color: '#aaa', borderRadius: 99, padding: '2px 10px', fontSize: 11 }}>Não</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tooltip customizado ───────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a1a2e', color: '#f9fafb', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color || '#f9fafb' }}>
          {p.name}: <strong>{typeof p.value === 'number' && p.value < 2 ? pct(p.value) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ── Seção de título ───────────────────────────────────────────────────────────
function SectionTitle({ label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ width: 4, height: 22, borderRadius: 2, background: color }} />
      <span style={{ fontSize: 16, fontWeight: 800, color }}>{label}</span>
    </div>
  );
}

// ── Aba de projeto ────────────────────────────────────────────────────────────
function ProjectTab({ projKey, data }) {
  const { color } = PROJ[projKey];
  const sprints = data.sprints || [];

  const closedSprints = sprints.filter(s => s.state === 'closed');
  const activeSprint  = sprints.find(s => s.state === 'active');
  const kpiSprint     = activeSprint || closedSprints[closedSprints.length - 1];

  const chartData = closedSprints.map(s => ({
    sprint:          shortSprint(s.name),
    Throughput:      s.throughput,
    'SP Entregues':  s.sp_done,
    'Taxa (%)':      +(s.completion_rate * 100).toFixed(0),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Sprint ativa */}
      {data.active_sprint && (
        <div style={{
          background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 12,
          padding: '12px 18px', fontSize: 13, color: '#166534',
        }}>
          <strong>Sprint ativa:</strong> {data.active_sprint.name}
          {data.active_sprint.start && ` · ${fmtDate(data.active_sprint.start)} → ${fmtDate(data.active_sprint.end)}`}
          {data.active_sprint.goal && (
            <div style={{ marginTop: 4, color: '#15803d', fontStyle: 'italic' }}>"{data.active_sprint.goal}"</div>
          )}
        </div>
      )}

      {/* KPIs */}
      {kpiSprint && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <KpiCard label="Throughput" value={kpiSprint.throughput} sub={`de ${kpiSprint.total} comprometidos`} color={color} />
          <KpiCard label="Taxa de Conclusão" value={pct(kpiSprint.completion_rate)} sub={kpiSprint.state === 'active' ? 'sprint ativa' : 'última sprint'} color={color} />
          <KpiCard label="SP Entregues" value={kpiSprint.sp_done} sub={`de ${kpiSprint.sp_total} SP`} color={color} />
          <KpiCard label="Sprints Analisadas" value={closedSprints.length + (activeSprint ? 1 : 0)} sub="fechadas + ativa" color="#888" />
        </div>
      )}

      {/* Gráficos */}
      {chartData.length > 0 && (
        <>
          <div>
            <SectionTitle label="Velocidade por Sprint" color={color} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 14 }}>

              <Card title="Throughput por Sprint" color={color}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                    <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Throughput" radius={[5, 5, 0, 0]}>
                      {chartData.map((_, i) => <Cell key={i} fill={color} fillOpacity={0.6 + (i / chartData.length) * 0.4} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Story Points Entregues" color={color}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                    <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="SP Entregues" radius={[5, 5, 0, 0]} fill={color} fillOpacity={0.65} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Taxa de Conclusão (%)" color={color}>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                    <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line dataKey="Taxa (%)" type="monotone" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

            </div>
          </div>
        </>
      )}

      {/* Burndown */}
      <div>
        <SectionTitle label="Burndown — Sprint Ativa" color={color} />
        <Card title="" color={color}>
          <BurndownSection burndown={data.burndown} color={color} />
        </Card>
      </div>

      {/* Contribuição */}
      <div>
        <SectionTitle label="Contribuição por Desenvolvedor" color={color} />
        <Card
          title={`ÚLTIMAS ${data.sprints?.length || 0} SPRINTS`}
          color={color}
        >
          <ContributorsTable contributors={data.contributors} color={color} />
        </Card>
      </div>

    </div>
  );
}

// ── Aba consolidada ────────────────────────────────────────────────────────────
function ConsolidadoTab({ data }) {
  const sprintMap = {};
  for (const key of PROJ_ORDER) {
    const proj = data[key];
    if (!proj) continue;
    for (const sp of (proj.sprints || [])) {
      const label = shortSprint(sp.name);
      if (!sprintMap[label]) sprintMap[label] = { sprint: label };
      sprintMap[label][PROJ[key].name] = sp.throughput;
    }
  }
  const chartData = Object.values(sprintMap).slice(-7);

  const kpiTotal = PROJ_ORDER.reduce((s, k) => {
    const active = data[k]?.sprints?.find(sp => sp.state === 'active') || data[k]?.sprints?.slice(-1)[0];
    return { throughput: s.throughput + (active?.throughput || 0), total: s.total + (active?.total || 0) };
  }, { throughput: 0, total: 0 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* KPIs por squad + total */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {PROJ_ORDER.map(k => {
          const { color, name } = PROJ[k];
          const sp = data[k]?.sprints?.find(s => s.state === 'active') || data[k]?.sprints?.slice(-1)[0];
          return (
            <div key={k} style={{
              flex: 1, minWidth: 160, background: '#fff', borderRadius: 14,
              padding: '18px 22px', border: `1.5px solid ${color}22`,
              boxShadow: '0 2px 8px rgba(0,0,0,.05)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{name}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color }}>{sp?.throughput ?? '—'}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>
                {sp ? `${pct(sp.completion_rate)} · ${sp.sp_done} SP` : 'sem dados'}
              </div>
            </div>
          );
        })}
        <KpiCard label="Total (3 squads)" value={kpiTotal.throughput} sub={`de ${kpiTotal.total} comprometidos`} color="#374151" />
      </div>

      {/* Throughput comparado */}
      {chartData.length > 0 && (
        <div>
          <SectionTitle label="Throughput Comparado por Sprint" color="#374151" />
          <Card title="" color="#374151">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {PROJ_ORDER.map(k => (
                  <Bar key={k} dataKey={PROJ[k].name} fill={PROJ[k].color} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Burndown por squad */}
      <div>
        <SectionTitle label="Burndown — Sprint Ativa" color="#374151" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {PROJ_ORDER.map(k => (
            <Card key={k} title={PROJ[k].name.toUpperCase()} color={PROJ[k].color}>
              <BurndownSection burndown={data[k]?.burndown} color={PROJ[k].color} />
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
        <button
          onClick={load} disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#5521B5', color: '#fff', border: 'none',
            borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1,
            boxShadow: '0 2px 8px rgba(85,33,181,.25)',
          }}
        >
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
            <button
              key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '9px 20px', fontSize: 13, fontWeight: 700,
                border: 'none', borderBottom: active ? `2.5px solid ${t.color}` : '2.5px solid transparent',
                background: 'transparent', color: active ? t.color : '#aaa',
                cursor: 'pointer', marginBottom: -2, transition: 'color .15s',
              }}
            >
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
          {[80, 200, 200].map((h, i) => (
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
