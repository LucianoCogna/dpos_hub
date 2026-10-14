import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { getIndicadores } from '../services/api';

// ── Config de projeto ─────────────────────────────────────────────────────────
const PROJ = {
  CRPR: { name: 'Pricing',  color: '#8b5cf6', light: '#ede9fe' },
  CRVE: { name: 'Rewired',  color: '#10b981', light: '#d1fae5' },
  CRMI: { name: 'Mídia',    color: '#0ea5e9', light: '#e0f2fe' },
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
function KpiCard({ label, value, sub, color = '#8b5cf6' }) {
  return (
    <div style={{ background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:14, padding:'16px 20px', minWidth:130, flex:1 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:32, fontWeight:900, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:'#9ca3af', marginTop:4 }}>{sub}</div>}
    </div>
  );
}

// ── Burndown bar ─────────────────────────────────────────────────────────────
function BurndownBar({ burndown, color }) {
  if (!burndown) return <div style={{ color:'#9ca3af', fontSize:13 }}>Sem sprint ativa.</div>;
  const { total, done, remaining } = burndown;
  const pctDone = total > 0 ? done / total : 0;
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#6b7280', marginBottom:6 }}>
        <span><strong style={{ color:'#111' }}>{burndown.sprint}</strong></span>
        <span>{done} / {total} concluídos ({pct(pctDone)})</span>
      </div>
      <div style={{ height:12, background:'#f3f4f6', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pctDone * 100}%`, background:color, borderRadius:99, transition:'width .5s' }} />
      </div>
      <div style={{ display:'flex', gap:16, marginTop:8, fontSize:12 }}>
        <span style={{ color:'#10b981' }}>✓ {done} concluídos</span>
        <span style={{ color:'#f59e0b' }}>↻ {remaining} restantes</span>
      </div>
    </div>
  );
}

// ── Tabela de contribuição ────────────────────────────────────────────────────
function ContributorsTable({ contributors, color }) {
  if (!contributors?.length) return <div style={{ color:'#9ca3af', fontSize:13 }}>Sem dados.</div>;
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead>
          <tr style={{ borderBottom:'2px solid #f3f4f6' }}>
            {['Desenvolvedor','Total','Concluídos','% Contrib.','Sprint ativa'].map(h => (
              <th key={h} style={{ padding:'8px 10px', textAlign: h === 'Desenvolvedor' ? 'left' : 'center', fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contributors.map((c, i) => (
            <tr key={c.name} style={{ borderBottom:'1px solid #f9fafb', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <td style={{ padding:'8px 10px', fontWeight:600, color:'#111' }}>{c.name}</td>
              <td style={{ padding:'8px 10px', textAlign:'center', fontWeight:700 }}>{c.total}</td>
              <td style={{ padding:'8px 10px', textAlign:'center', color:'#10b981', fontWeight:600 }}>{c.done}</td>
              <td style={{ padding:'8px 10px', textAlign:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'center' }}>
                  <div style={{ height:6, width:60, background:'#f3f4f6', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${c.pct * 100}%`, background:color, borderRadius:99 }} />
                  </div>
                  <span style={{ fontSize:11, color:'#6b7280', minWidth:32 }}>{pct(c.pct)}</span>
                </div>
              </td>
              <td style={{ padding:'8px 10px', textAlign:'center' }}>
                {c.active ? <span style={{ background:'#d1fae5', color:'#065f46', borderRadius:99, padding:'2px 10px', fontSize:11, fontWeight:700 }}>✓ Sim</span>
                           : <span style={{ background:'#f3f4f6', color:'#9ca3af', borderRadius:99, padding:'2px 10px', fontSize:11 }}>Não</span>}
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
    <div style={{ background:'#1f2937', color:'#f9fafb', borderRadius:10, padding:'10px 14px', fontSize:12 }}>
      <div style={{ fontWeight:700, marginBottom:4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color || '#f9fafb' }}>
          {p.name}: <strong>{typeof p.value === 'number' && p.value < 2 ? pct(p.value) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ── Aba de projeto ────────────────────────────────────────────────────────────
function ProjectTab({ projKey, data }) {
  const cfg    = PROJ[projKey];
  const color  = cfg.color;
  const sprints = data.sprints || [];

  // dados para gráficos (exclui ativa do histórico de barras fechadas)
  const closedSprints = sprints.filter(s => s.state === 'closed');
  const activeSprint  = sprints.find(s => s.state === 'active');

  const chartData = closedSprints.map(s => ({
    sprint:     shortSprint(s.name),
    Throughput: s.throughput,
    'SP Entregues': s.sp_done,
    'Taxa (%)': +(s.completion_rate * 100).toFixed(0),
  }));

  // KPIs da sprint mais recente
  const lastClosed = closedSprints[closedSprints.length - 1];
  const kpiSprint  = activeSprint || lastClosed;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

      {/* Sprint ativa */}
      {data.active_sprint && (
        <div style={{ background:'#f0fdf4', border:'1.5px solid #bbf7d0', borderRadius:12, padding:'12px 18px', fontSize:13, color:'#166534' }}>
          <strong>Sprint ativa:</strong> {data.active_sprint.name}
          {data.active_sprint.start && ` · ${fmtDate(data.active_sprint.start)} → ${fmtDate(data.active_sprint.end)}`}
          {data.active_sprint.goal && <div style={{ marginTop:4, color:'#15803d', fontStyle:'italic' }}>"{data.active_sprint.goal}"</div>}
        </div>
      )}

      {/* KPIs */}
      {kpiSprint && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
          <KpiCard label="Throughput" value={kpiSprint.throughput} sub={`de ${kpiSprint.total} comprometidos`} color={color} />
          <KpiCard label="Taxa Conclusão" value={pct(kpiSprint.completion_rate)} sub={kpiSprint.state === 'active' ? 'sprint ativa' : 'última sprint'} color={color} />
          <KpiCard label="SP Entregues" value={kpiSprint.sp_done} sub={`de ${kpiSprint.sp_total} SP`} color={color} />
          <KpiCard label="Sprints analisadas" value={closedSprints.length + (activeSprint ? 1 : 0)} sub="fechadas + ativa" color="#6b7280" />
        </div>
      )}

      {chartData.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px,1fr))', gap:16 }}>

          {/* Throughput */}
          <div style={{ background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:14, padding:'16px 20px' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:12 }}>Throughput por Sprint</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top:0, right:8, bottom:0, left:-20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="sprint" tick={{ fontSize:10 }} />
                <YAxis tick={{ fontSize:10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="Throughput" radius={[4,4,0,0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={color} fillOpacity={0.75 + i * 0.04} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Story Points */}
          <div style={{ background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:14, padding:'16px 20px' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:12 }}>Story Points Entregues</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top:0, right:8, bottom:0, left:-20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="sprint" tick={{ fontSize:10 }} />
                <YAxis tick={{ fontSize:10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="SP Entregues" radius={[4,4,0,0]} fill={color} fillOpacity={0.65} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Taxa de conclusão */}
          <div style={{ background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:14, padding:'16px 20px' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:12 }}>Taxa de Conclusão (%)</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top:0, right:8, bottom:0, left:-20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="sprint" tick={{ fontSize:10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize:10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Line dataKey="Taxa (%)" type="monotone" stroke={color} strokeWidth={2.5} dot={{ r:3, fill:color }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Burndown */}
      <div style={{ background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:14, padding:'16px 20px' }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:12 }}>Burndown — Sprint Ativa</div>
        <BurndownBar burndown={data.burndown} color={color} />
      </div>

      {/* Contribuição por dev */}
      <div style={{ background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:14, padding:'16px 20px' }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:12 }}>
          Contribuição por Desenvolvedor
          <span style={{ fontWeight:400, color:'#9ca3af', marginLeft:8, fontSize:11 }}>últimas {data.sprints?.length || 0} sprints</span>
        </div>
        <ContributorsTable contributors={data.contributors} color={color} />
      </div>
    </div>
  );
}

// ── Aba consolidada ────────────────────────────────────────────────────────────
function ConsolidadoTab({ data }) {
  // Throughput comparado: une sprints pelo nome curto
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
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

      {/* KPIs globais */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
        {PROJ_ORDER.map(k => {
          const proj = data[k];
          const sp = proj?.sprints?.find(s => s.state === 'active') || proj?.sprints?.slice(-1)[0];
          return (
            <div key={k} style={{ flex:1, minWidth:160, background:'#fff', border:`2px solid ${PROJ[k].color}33`, borderRadius:14, padding:'16px 20px' }}>
              <div style={{ fontSize:11, fontWeight:700, color: PROJ[k].color, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>{PROJ[k].name}</div>
              <div style={{ fontSize:28, fontWeight:900, color: PROJ[k].color }}>{sp?.throughput ?? '—'}</div>
              <div style={{ fontSize:11, color:'#9ca3af' }}>
                {sp ? `${pct(sp.completion_rate)} · ${sp.sp_done} SP` : 'sem dados'}
              </div>
            </div>
          );
        })}
        <KpiCard label="Total (3 times)" value={kpiTotal.throughput} sub={`de ${kpiTotal.total} comprometidos`} color="#374151" />
      </div>

      {/* Throughput comparado */}
      {chartData.length > 0 && (
        <div style={{ background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:14, padding:'16px 20px' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:12 }}>Throughput Comparado por Sprint</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top:0, right:8, bottom:0, left:-20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="sprint" tick={{ fontSize:10 }} />
              <YAxis tick={{ fontSize:10 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize:11 }} />
              {PROJ_ORDER.map(k => (
                <Bar key={k} dataKey={PROJ[k].name} fill={PROJ[k].color} radius={[3,3,0,0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Burndown de cada time */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px,1fr))', gap:16 }}>
        {PROJ_ORDER.map(k => (
          <div key={k} style={{ background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:14, padding:'16px 20px' }}>
            <div style={{ fontSize:12, fontWeight:700, color: PROJ[k].color, marginBottom:10 }}>{PROJ[k].name}</div>
            <BurndownBar burndown={data[k]?.burndown} color={PROJ[k].color} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Indicadores() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [tab,     setTab]     = useState('CRVE'); // Rewired como default

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
    ? new Date(data.generated_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : null;

  const TABS = [{ id:'CONSOLIDADO', label:'Consolidado' }, ...PROJ_ORDER.map(k => ({ id:k, label:PROJ[k].name }))];

  return (
    <div style={{ fontFamily:'Inter, system-ui, sans-serif', maxWidth:1100, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, color:'#111', margin:0, letterSpacing:-.5 }}>Indicadores</h1>
          <p style={{ fontSize:12, color:'#9ca3af', margin:'4px 0 0' }}>
            Pricing · Rewired · Mídia · velocidade por sprint via Jira
            {genAt && <span style={{ marginLeft:8, color:'#d1d5db' }}>· atualizado {genAt}</span>}
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{ display:'flex', alignItems:'center', gap:8, background:'#111', color:'#fff', border:'none', borderRadius:10, padding:'9px 18px', fontSize:13, fontWeight:700, cursor:loading?'not-allowed':'pointer', opacity:loading?.7:1 }}>
          {loading ? <><span style={{ display:'inline-block', width:13, height:13, border:'2px solid #fff', borderTopColor:'transparent', borderRadius:'50%', animation:'spin .8s linear infinite' }} />Carregando…</> : '↻ Atualizar'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, borderBottom:'2px solid #f3f4f6', marginBottom:24 }}>
        {TABS.map(t => {
          const color = t.id === 'CONSOLIDADO' ? '#374151' : PROJ[t.id]?.color;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:'8px 18px', fontSize:13, fontWeight:700, border:'none', borderBottom: active ? `2.5px solid ${color}` : '2.5px solid transparent', background:'transparent', color: active ? color : '#9ca3af', cursor:'pointer', marginBottom:-2, transition:'color .15s' }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Erro */}
      {error && (
        <div style={{ background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#b91c1c', marginBottom:20 }}>
          <strong>Erro:</strong> {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: i===1 ? 80 : 200, borderRadius:14, background:'#f3f4f6', animation:'pulse 1.5s ease-in-out infinite' }} />)}
        </div>
      )}

      {/* Conteúdo */}
      {!loading && data && (
        tab === 'CONSOLIDADO'
          ? <ConsolidadoTab data={data} />
          : <ProjectTab projKey={tab} data={data[tab]} />
      )}

      {!loading && !data && !error && (
        <div style={{ textAlign:'center', padding:'60px 0', color:'#9ca3af', fontSize:14 }}>Clique em Atualizar para carregar os dados.</div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
      `}</style>
    </div>
  );
}
