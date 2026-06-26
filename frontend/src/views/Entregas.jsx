import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import { getEntregas } from '../services/api';

const JIRA = 'https://cogna.atlassian.net';

const AREAS = [
  { value: 'G&C',                label: 'G&C',                 icon: '📊' },
  { value: 'ESG',                label: 'ESG',                 icon: '🌱' },
  { value: 'CAPTACAO_ANALITICA', label: 'Captação Analítica',  icon: '🎯' },
  { value: 'REVENUE',            label: 'Revenue',             icon: '💰' },
  { value: 'ROTINAS_FINANCEIRAS',label: 'Rotinas Financeiras', icon: '🏦' },
  { value: 'DMC',                label: 'DMC',                 icon: '📦' },
  { value: 'REVENUE_STRATEGY',   label: 'Revenue Strategy',    icon: '📈' },
  { value: 'RVV',                label: 'RVV',                 icon: '🔄' },
  { value: 'REPASSE',            label: 'Repasse',             icon: '💸' },
  { value: 'ALIANCA_1_SOMOS',    label: 'Aliança 1 Somos',     icon: '🤝' },
  { value: 'ALIANCA_1_SABER',    label: 'Aliança 1 Saber',     icon: '📚' },
  { value: 'Plurall',            label: 'Plurall',             icon: '🎓' },
  { value: 'MACROPROCESSO',      label: 'Macroprocesso',       icon: '⚙️' },
];

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Data de entrega: preferência para implant, fallback para end
function deliveryDate(it) { return it.implant || it.end; }

// Gera os últimos N meses no formato { key: 'YYYY-MM', label: 'Mmm/YY' }
function lastNMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: `${MONTH_NAMES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` });
  }
  return months;
}

function monthKey(iso) {
  if (!iso) return null;
  return iso.slice(0, 7); // 'YYYY-MM'
}

function daysBetween(isoA, isoB) {
  if (!isoA || !isoB) return null;
  const diff = new Date(isoB) - new Date(isoA);
  return Math.round(diff / 86400000);
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Modal de seleção de área ──────────────────────────────────────────────────
function AreaModal({ onSelect }) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,5,30,.55)', zIndex: 1000 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 'min(680px, 94vw)', maxHeight: '85vh',
        background: '#fff', borderRadius: 20,
        boxShadow: '0 24px 64px rgba(0,0,0,.25)',
        zIndex: 1001, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '24px 28px 16px' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>Entregas</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#888' }}>
            Selecione a área para visualizar os gráficos
          </p>
        </div>
        <div style={{ overflowY: 'auto', padding: '8px 28px 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {AREAS.map((a) => (
              <button key={a.value} onClick={() => onSelect(a)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 8, padding: '20px 12px', background: '#FAFAFA',
                  border: '1.5px solid #e8e0f8', borderRadius: 12, cursor: 'pointer',
                  transition: 'all .15s', fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#5521B5'; e.currentTarget.style.background = '#F3EEF8'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e8e0f8'; e.currentTarget.style.background = '#FAFAFA'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <span style={{ fontSize: 26 }}>{a.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', textAlign: 'center', lineHeight: 1.3 }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#5521B5' }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '18px 22px',
      border: `1.5px solid ${color}22`, flex: 1, minWidth: 160,
      boxShadow: '0 2px 8px rgba(0,0,0,.05)',
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value ?? '—'}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Lista de produtos entregues ───────────────────────────────────────────────
function ProductList({ items }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 8);

  if (!items.length) return (
    <p style={{ color: '#bbb', fontSize: 13, fontStyle: 'italic', margin: 0 }}>Nenhum item encontrado</p>
  );

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #f0e8ff' }}>
            {['#', 'Tipo', 'Título', 'Status', 'Entrega', 'Duração'].map((h) => (
              <th key={h} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#888', textAlign: h === 'Título' ? 'left' : 'center', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((it, i) => {
            const dur = daysBetween(it.start, deliveryDate(it));
            return (
              <tr key={it.key} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff', borderBottom: '1px solid #f5f0ff' }}>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <a href={`${JIRA}/browse/${it.key}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, fontWeight: 700, color: '#5521B5', textDecoration: 'none' }}>{it.key}</a>
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                    background: it.type === 'Epic' ? '#EDE7F6' : '#E3F2FD',
                    color: it.type === 'Epic' ? '#512DA8' : '#1565C0' }}>{it.type}</span>
                </td>
                <td style={{ padding: '8px 10px', maxWidth: 320 }}>
                  <span style={{ color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                    title={it.summary}>{it.summary}</span>
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: '#E8F5E9', color: '#2E7D32' }}>{it.status}</span>
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#555', whiteSpace: 'nowrap' }}>
                  {fmtDate(deliveryDate(it))}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: dur !== null ? '#5521B5' : '#bbb', fontWeight: dur !== null ? 700 : 400 }}>
                  {dur !== null ? `${dur}d` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {items.length > 8 && (
        <button onClick={() => setExpanded(v => !v)}
          style={{ marginTop: 10, fontSize: 12, color: '#5521B5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          {expanded ? '▲ Ver menos' : `▼ Ver mais ${items.length - 8} itens`}
        </button>
      )}
    </div>
  );
}

// ── Seção de categoria (stats + gráfico + tabela) ────────────────────────────
function CategorySection({ title, jiraLabel, items, barColor, accentColor }) {
  const now      = new Date();
  const withDate = items.filter((it) => deliveryDate(it));

  const months = lastNMonths(12);
  const countByMonth = {};
  for (const it of withDate) {
    const k = monthKey(deliveryDate(it));
    if (k) countByMonth[k] = (countByMonth[k] || 0) + 1;
  }
  const barData = months.map(({ key, label }) => ({ label, qtd: countByMonth[key] || 0 }));

  const cutoff30  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const cutoff90  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
  const cutoff180 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 180);

  const last30  = withDate.filter((it) => new Date(deliveryDate(it)) >= cutoff30).length;
  const last90  = withDate.filter((it) => new Date(deliveryDate(it)) >= cutoff90).length;
  const last180 = withDate.filter((it) => new Date(deliveryDate(it)) >= cutoff180).length;

  const durations = items
    .map((it) => daysBetween(it.start, deliveryDate(it)))
    .filter((d) => d !== null && d > 0);
  const avgDays = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  const cumData = barData.reduce((acc, { label, qtd }) => {
    const prev = acc.length ? acc[acc.length - 1].acum : 0;
    acc.push({ label, acum: prev + qtd });
    return acc;
  }, []);

  const leadData = [
    { label: '0–15d',  qtd: durations.filter((d) => d < 15).length },
    { label: '15–30d', qtd: durations.filter((d) => d >= 15 && d < 30).length },
    { label: '30–60d', qtd: durations.filter((d) => d >= 30 && d < 60).length },
    { label: '60–90d', qtd: durations.filter((d) => d >= 60 && d < 90).length },
    { label: '90d+',   qtd: durations.filter((d) => d >= 90).length },
  ];

  return (
    <div style={{ marginBottom: 36 }}>
      {/* Título da seção */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 4, height: 22, borderRadius: 2, background: accentColor }} />
        <span style={{ fontSize: 16, fontWeight: 800, color: accentColor }}>{title}</span>
        <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>
          — {items.length} {items.length === 1 ? 'entrega' : 'entregas'}
        </span>
      </div>

      {items.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 14, padding: '36px 20px', textAlign: 'center',
          border: `1.5px solid ${accentColor}22`, color: '#bbb',
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 13 }}>Nenhuma entrega com a label <code style={{ background: '#f5f5f5', padding: '1px 6px', borderRadius: 3 }}>{jiraLabel}</code></div>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <StatCard label="Total" value={items.length} color={accentColor} />
            <StatCard label="Últimos 30 dias" value={last30} sub="entregas recentes" color="#1565C0" />
            <StatCard label="Últimos 3 meses" value={last90} sub="trimestre atual" color="#2E7D32" />
            <StatCard label="Últimos 6 meses" value={last180} sub="semestre atual" color="#E65100" />
            <StatCard label="Tempo médio" value={avgDays !== null ? `${avgDays}d` : '—'} sub="início à entrega" color="#6A1B9A" />
          </div>

          {/* Gráfico */}
          <div style={{
            background: '#fff', borderRadius: 14, padding: '18px 22px', marginBottom: 16,
            border: `1.5px solid ${accentColor}22`, boxShadow: '0 2px 8px rgba(0,0,0,.05)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 12 }}>
              ENTREGAS POR MÊS — ÚLTIMOS 12 MESES
            </div>
            <BarChart width={980} height={200} data={barData} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [`${v} entregas`]} />
              <Bar dataKey="qtd" fill={barColor} radius={[5, 5, 0, 0]} />
            </BarChart>
          </div>

          {/* Curva cumulativa + Histograma de lead time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div style={{
              background: '#fff', borderRadius: 14, padding: '18px 22px',
              border: `1.5px solid ${accentColor}22`, boxShadow: '0 2px 8px rgba(0,0,0,.05)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 12 }}>
                CURVA CUMULATIVA — ÚLTIMOS 12 MESES
              </div>
              <LineChart width={430} height={180} data={cumData} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} entregas acumuladas`]} />
                <Line type="monotone" dataKey="acum" stroke={accentColor} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </div>

            <div style={{
              background: '#fff', borderRadius: 14, padding: '18px 22px',
              border: `1.5px solid ${accentColor}22`, boxShadow: '0 2px 8px rgba(0,0,0,.05)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 12 }}>
                DISTRIBUIÇÃO DE LEAD TIME
              </div>
              <BarChart width={430} height={180} data={leadData} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} entregas`]} />
                <Bar dataKey="qtd" fill={accentColor} radius={[5, 5, 0, 0]} opacity={0.8} />
              </BarChart>
            </div>
          </div>

          {/* Tabela */}
          <div style={{
            background: '#fff', borderRadius: 14, padding: '18px 22px',
            border: `1.5px solid ${accentColor}22`, boxShadow: '0 2px 8px rgba(0,0,0,.05)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 12 }}>DEMANDAS</div>
            <ProductList items={items} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ area, items, onReset }) {
  const novoProduto = items.filter((it) => it.categorias.includes('NOVO_PRODUTO_DADO'));
  const evolucao    = items.filter((it) => it.categorias.includes('EVOLUÇÃO'));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <button onClick={onReset}
          style={{ fontSize: 13, fontWeight: 600, color: '#5521B5', background: '#EDE7F6', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer' }}>
          ← Trocar área
        </button>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1a2e' }}>{area.icon} {area.label}</span>
      </div>

      <CategorySection
        title="🚀 Novo Produto de Dados"
        jiraLabel="NOVO_PRODUTO_DADO"
        items={novoProduto}
        barColor="#5521B5"
        accentColor="#5521B5"
      />

      <div style={{ borderTop: '2px dashed #e8e0f8', marginBottom: 36 }} />

      <CategorySection
        title="🔄 Evolução"
        jiraLabel="EVOLUÇÃO"
        items={evolucao}
        barColor="#2E7D32"
        accentColor="#2E7D32"
      />
    </div>
  );
}

// ── View principal ────────────────────────────────────────────────────────────
export default function Entregas() {
  const [area,    setArea]    = useState(null);
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const handleSelect = (a) => {
    setArea(a);
    setItems([]);
    setLoading(true);
    setError(null);
    getEntregas(a.value)
      .then((d) => setItems(d.items || []))
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', maxWidth: 1060, margin: '0 auto' }}>
      {!area && <AreaModal onSelect={handleSelect} />}

      {area && loading && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#888', fontSize: 14 }}>
          Carregando entregas de {area.label}...
        </div>
      )}

      {area && error && (
        <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 10, padding: '14px 18px', color: '#C62828', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {area && !loading && !error && (
        <Dashboard area={area} items={items} onReset={() => setArea(null)} />
      )}
    </div>
  );
}
