import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
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

const CATEGORIAS = [
  {
    value:     'evolucao',
    label:     'Evolução',
    jiraLabel: 'Evolução',
    color:     '#2E7D32',
    bg:        '#E8F5E9',
    barColor:  '#43A047',
  },
  {
    value:     'novo_produto',
    label:     'Novo Produto de Dados',
    jiraLabel: 'novo_produto_dado',
    color:     '#E65100',
    bg:        '#FFF3E0',
    barColor:  '#FB8C00',
  },
];

const STATUS_COLORS = ['#43A047', '#1E88E5', '#8E24AA', '#00897B'];

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Gráfico de status (pizza) ──────────────────────────────────────────────────
function StatusPie({ items, color }) {
  const counts = {};
  for (const it of items) counts[it.status] = (counts[it.status] || 0) + 1;
  const pieData = Object.entries(counts).map(([name, value]) => ({ name, value }));

  if (!pieData.length) return (
    <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 12 }}>
      Sem dados
    </div>
  );

  return (
    <PieChart width={260} height={180}>
      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
        {pieData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
      </Pie>
      <Tooltip formatter={(v, n) => [v, n]} />
    </PieChart>
  );
}

// ── Gráfico de tipo (barras) ───────────────────────────────────────────────────
function TypeBar({ items, barColor }) {
  const epics    = items.filter((i) => i.type === 'Epic').length;
  const historias = items.filter((i) => i.type !== 'Epic').length;
  const barData  = [{ name: 'Épicos', qtd: epics }, { name: 'Histórias', qtd: historias }];

  return (
    <BarChart width={220} height={180} data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
      <Tooltip />
      <Bar dataKey="qtd" fill={barColor} radius={[4, 4, 0, 0]} />
    </BarChart>
  );
}

// ── Lista de demandas ──────────────────────────────────────────────────────────
function ItemList({ items, color }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 5);

  if (!items.length) return (
    <p style={{ color: '#bbb', fontSize: 12, fontStyle: 'italic', margin: 0 }}>Nenhum item</p>
  );

  return (
    <div>
      {visible.map((it) => (
        <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
          <a href={`${JIRA}/browse/${it.key}`} target="_blank" rel="noreferrer"
            style={{ fontSize: 11, fontWeight: 700, color, textDecoration: 'none', flexShrink: 0 }}>
            {it.key}
          </a>
          <span style={{ fontSize: 12, color: '#333', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={it.summary}>{it.summary}</span>
          <span style={{ fontSize: 10, color: '#888', flexShrink: 0 }}>{fmtDate(it.end)}</span>
        </div>
      ))}
      {items.length > 5 && (
        <button onClick={() => setExpanded(v => !v)}
          style={{ marginTop: 6, fontSize: 11, color, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
          {expanded ? '▲ Ver menos' : `▼ Ver mais ${items.length - 5} itens`}
        </button>
      )}
    </div>
  );
}

// ── Painel de uma categoria ────────────────────────────────────────────────────
function CategoryPanel({ cat, items }) {
  return (
    <div style={{ border: `1.5px solid ${cat.color}33`, borderRadius: 14, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: cat.bg, borderBottom: `1px solid ${cat.color}22`, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: cat.color }}>{cat.label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: cat.color, background: `${cat.color}18`, padding: '2px 10px', borderRadius: 20 }}>
          {items.length} {items.length === 1 ? 'entrega' : 'entregas'}
        </span>
      </div>

      <div style={{ padding: 18, background: '#fff' }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#bbb', fontSize: 13 }}>
            Nenhuma entrega encontrada.
          </div>
        ) : (
          <>
            {/* Gráficos lado a lado — larguras fixas para Recharts funcionar */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#999', marginBottom: 4, textAlign: 'center' }}>STATUS</div>
                <StatusPie items={items} color={cat.color} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#999', marginBottom: 4, textAlign: 'center' }}>TIPO</div>
                <TypeBar items={items} barColor={cat.barColor} />
              </div>
            </div>

            {/* Lista */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#999', marginBottom: 8 }}>DEMANDAS</div>
              <ItemList items={items} color={cat.color} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────────
function EntregasModal({ area, onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getEntregas(area.value, 'TODAS')
      .then(setData)
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [area.value]);

  // Fecha com ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const allItems = data?.items || [];
  const byCategoria = {};
  for (const cat of CATEGORIAS) {
    byCategoria[cat.value] = allItems.filter((it) => it.categorias.includes(cat.jiraLabel));
  }

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000 }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 'min(960px, 95vw)', maxHeight: '90vh',
        background: '#F8F7FF', borderRadius: 18,
        boxShadow: '0 20px 60px rgba(0,0,0,.25)',
        zIndex: 1001, display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', background: '#fff',
          borderBottom: '1px solid #e8e0f8',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{area.icon}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>{area.label}</div>
              {!loading && data && (
                <div style={{ fontSize: 12, color: '#888' }}>{allItems.length} entregas encontradas</div>
              )}
            </div>
          </div>
          <button onClick={onClose}
            style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#888', lineHeight: 1, padding: '4px 8px' }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#888', fontSize: 14 }}>
              Carregando dados...
            </div>
          )}

          {error && (
            <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 10, padding: '12px 16px', color: '#C62828', fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          {!loading && !error && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {CATEGORIAS.map((cat) => (
                <CategoryPanel key={cat.value} cat={cat} items={byCategoria[cat.value]} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── View principal (grade de áreas) ───────────────────────────────────────────
export default function Entregas() {
  const [selectedArea, setSelectedArea] = useState(null);
  const handleClose = useCallback(() => setSelectedArea(null), []);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e', margin: 0 }}>Entregas</h1>
        <p style={{ fontSize: 13, color: '#666', marginTop: 6 }}>
          Selecione uma área para ver os gráficos de entregas por categoria
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
        {AREAS.map((a) => (
          <button
            key={a.value}
            onClick={() => setSelectedArea(a)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 10, padding: '24px 14px',
              background: '#fff', border: '1.5px solid #e0e0e0',
              borderRadius: 14, cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,.06)',
              transition: 'all .15s', fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#5521B5';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(85,33,181,.15)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e0e0e0';
              e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span style={{ fontSize: 30 }}>{a.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', textAlign: 'center' }}>
              {a.label}
            </span>
          </button>
        ))}
      </div>

      {selectedArea && (
        <EntregasModal area={selectedArea} onClose={handleClose} />
      )}
    </div>
  );
}
