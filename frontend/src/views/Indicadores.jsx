import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ── Mock data ────────────────────────────────────────────────────────────────
const MOCK = {
  sprint: '26.2.2',
  total: 11,
  entregues: 4,
  transbordaram: 6,
  bloqueados: 1,
  taxa_entrega: 36,
  deltas: { total: +2, entregues: -1, transbordaram: +2, bloqueados: 0, taxa: -8 },
  por_dpo: [
    { nome: 'Luciano', total: 8, entregues: 3 },
    { nome: 'Erika',   total: 3, entregues: 1 },
  ],
  por_projeto: [
    { nome: 'G&C',  total: 7 },
    { nome: 'XPTO', total: 4 },
  ],
  evolucao: [
    { sprint: '26.1.4', taxa: 55 },
    { sprint: '26.1.5', taxa: 48 },
    { sprint: '26.1.6', taxa: 60 },
    { sprint: '26.2.1', taxa: 44 },
    { sprint: '26.2.2', taxa: 36 },
  ],
  por_status: [
    { status: 'Concluído',    total: 4 },
    { status: 'Em Andamento', total: 3 },
    { status: 'Backlog',      total: 2 },
    { status: 'Homologação',  total: 1 },
    { status: 'Bloqueado',    total: 1 },
  ],
};

// ── Colors ───────────────────────────────────────────────────────────────────
const STATUS_COLOR = {
  'Concluído':    '#22c55e',
  'Aceito':       '#22c55e',
  'Em Andamento': '#f59e0b',
  'Homologação':  '#f97316',
  'Bloqueado':    '#ef4444',
  'Backlog':      '#9ca3af',
};
const PROJ_COLORS  = ['#8629ff', '#ab62ff', '#f97316', '#22c55e'];
const BAR_COLORS   = { Entregues: '#22c55e', Transbordaram: '#f97316', Bloqueados: '#ef4444' };

// ── Sub-components ────────────────────────────────────────────────────────────

function Block({ title, icon, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100">
        <span className="text-base leading-none">{icon}</span>
        <span className="font-semibold text-sm text-gray-700">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function MetricCard({ label, value, delta, positiveDir = 'up' }) {
  const sign  = delta > 0 ? '+' : '';
  const color = delta === 0 || delta == null
    ? 'text-gray-400'
    : positiveDir === 'neutral'
      ? 'text-primary-500'
      : positiveDir === 'up'
        ? (delta > 0 ? 'text-green-500' : 'text-red-500')
        : (delta < 0 ? 'text-green-500' : 'text-red-500');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-3xl font-extrabold text-gray-900">{value}</p>
      {delta != null && (
        <p className={`text-xs font-semibold ${color}`}>
          {sign}{delta} vs sprint anterior
        </p>
      )}
    </div>
  );
}

function LineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-600 mb-0.5">{label}</p>
      <p className="text-primary-600 font-bold text-sm">{payload[0].value}%</p>
    </div>
  );
}

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-xs space-y-0.5">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: BAR_COLORS[p.dataKey] }}>
          {p.dataKey}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700">{name}</p>
      <p className="text-gray-500">{value} cards</p>
    </div>
  );
}

function CustomDot({ cx, cy, index, dataLength }) {
  if (index !== dataLength - 1) return null;
  return <circle cx={cx} cy={cy} r={6} fill="#8629ff" stroke="#fff" strokeWidth={2} />;
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Indicadores() {
  const [projeto, setProjeto] = useState('G&C');
  const [sprint,  setSprint]  = useState('26.2.2');

  const d = MOCK.deltas;

  // Stacked bar data for DPO
  const dpoBarData = MOCK.por_dpo.map((row, i) => {
    const bloqueados   = i === 0 ? MOCK.bloqueados : 0;
    const transbordaram = row.total - row.entregues - bloqueados;
    return { nome: row.nome, Entregues: row.entregues, Transbordaram: transbordaram, Bloqueados: bloqueados };
  });

  const totalCards = MOCK.por_projeto.reduce((s, p) => s + p.total, 0);

  return (
    <div className="space-y-5">

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 mr-2">Indicadores</h1>
        <select
          value={projeto}
          onChange={(e) => setProjeto(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          <option>G&C</option>
          <option>XPTO</option>
          <option>Todos</option>
        </select>
        <select
          value={sprint}
          onChange={(e) => setSprint(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          {MOCK.evolucao.map((e) => (
            <option key={e.sprint}>{e.sprint}</option>
          ))}
        </select>
        <span className="ml-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg font-medium">
          Dados mock — integração em breve
        </span>
      </div>

      {/* ── BLOCO 1: Metric cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard label="Total Sprint"  value={MOCK.total}        delta={d.total}        positiveDir="neutral" />
        <MetricCard label="Entregues"     value={MOCK.entregues}    delta={d.entregues}    positiveDir="up"      />
        <MetricCard label="Transbordaram" value={MOCK.transbordaram} delta={d.transbordaram} positiveDir="down"   />
        <MetricCard label="Bloqueados"    value={MOCK.bloqueados}   delta={d.bloqueados}   positiveDir="down"    />
        <MetricCard label="Taxa Entrega"  value={`${MOCK.taxa_entrega}%`} delta={`${d.taxa > 0 ? '+' : ''}${d.taxa}%`} positiveDir="up" />
      </div>

      {/* ── Row 2: DPO bars + Project donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* BLOCO 2 — DPO */}
        <Block icon="👤" title="Demandas por DPO" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={dpoBarData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: '#f9fafb' }} />
              <Bar dataKey="Entregues"    stackId="a" fill={BAR_COLORS.Entregues}    radius={[0, 0, 0, 0]} />
              <Bar dataKey="Transbordaram" stackId="a" fill={BAR_COLORS.Transbordaram} />
              <Bar dataKey="Bloqueados"   stackId="a" fill={BAR_COLORS.Bloqueados}   radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3">
            {Object.entries(BAR_COLORS).map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </Block>

        {/* BLOCO 3 — Project donut */}
        <Block icon="🗂️" title="Demandas por Projeto">
          <div className="relative">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={MOCK.por_projeto}
                  dataKey="total"
                  nameKey="nome"
                  cx="40%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={70}
                  paddingAngle={3}
                  startAngle={90}
                  endAngle={-270}
                >
                  {MOCK.por_projeto.map((_, i) => (
                    <Cell key={i} fill={PROJ_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center text */}
            <div className="absolute pointer-events-none" style={{ top: '50%', left: '40%', transform: 'translate(-50%, -50%)' }}>
              <p className="text-xl font-extrabold text-gray-900 text-center leading-tight">{totalCards}</p>
              <p className="text-xs text-gray-400 text-center">cards</p>
            </div>
            {/* Legend */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 space-y-2 pr-1">
              {MOCK.por_projeto.map((p, i) => (
                <div key={p.nome} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PROJ_COLORS[i] }} />
                  <div>
                    <p className="text-xs font-semibold text-gray-700 leading-none">{p.nome}</p>
                    <p className="text-xs text-gray-400">{p.total} cards · {Math.round(p.total / totalCards * 100)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Block>
      </div>

      {/* ── Row 3: Evolution line + Status pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* BLOCO 4 — Evolution line */}
        <Block icon="📈" title="Evolução da Taxa de Entrega" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={MOCK.evolucao} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="sprint" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<LineTooltip />} />
              <ReferenceLine y={50} stroke="#e5e7eb" strokeDasharray="4 4" label={{ value: 'Meta 50%', position: 'right', fontSize: 10, fill: '#d1d5db' }} />
              <Line
                type="monotone"
                dataKey="taxa"
                stroke="#8629ff"
                strokeWidth={2.5}
                dot={(props) => <CustomDot {...props} dataLength={MOCK.evolucao.length} />}
                activeDot={{ r: 5, fill: '#8629ff', stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between mt-2 px-1">
            <p className="text-xs text-gray-400">Últimas 5 sprints</p>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded bg-primary-500" />
              <span className="text-xs text-gray-500">Taxa de entrega</span>
            </div>
          </div>
        </Block>

        {/* BLOCO 5 — Status pie */}
        <Block icon="🥧" title="Status Geral">
          <div className="relative">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={MOCK.por_status}
                  dataKey="total"
                  nameKey="status"
                  cx="40%"
                  cy="50%"
                  outerRadius={70}
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                >
                  {MOCK.por_status.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLOR[entry.status] ?? '#9ca3af'} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 space-y-1.5 pr-1">
              {MOCK.por_status.map((s) => (
                <div key={s.status} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLOR[s.status] ?? '#9ca3af' }} />
                  <div>
                    <p className="text-xs font-medium text-gray-700 leading-none">{s.status}</p>
                    <p className="text-xs text-gray-400">{s.total} cards</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Block>
      </div>

    </div>
  );
}
