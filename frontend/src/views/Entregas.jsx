import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
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

const CATEGORIAS = [
  { value: 'evolucao',    label: 'Evolução',              jiraLabel: 'Evolução',         color: '#2E7D32', bg: '#E8F5E9', accent: '#43A047' },
  { value: 'novo_produto',label: 'Novo Produto de Dados', jiraLabel: 'novo_produto_dado', color: '#E65100', bg: '#FFF3E0', accent: '#FB8C00' },
];

const STATUS_COLORS = {
  'Em produção': '#2E7D32',
  'Aceito':      '#1565C0',
  'Concluído':   '#6A1B9A',
};
const STATUS_PIE_COLORS = ['#43A047', '#1E88E5', '#8E24AA'];

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Seletor de área ────────────────────────────────────────────────────────────
function AreaPicker({ onSelect }) {
  return (
    <div>
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1a1a2e', margin: 0 }}>Entregas</h1>
        <p style={{ fontSize: 14, color: '#666', marginTop: 6 }}>
          Selecione a área para visualizar os gráficos de entregas
        </p>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 14,
      }}>
        {AREAS.map((a) => (
          <button
            key={a.value}
            onClick={() => onSelect(a)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 10, padding: '22px 14px',
              background: '#fff', border: '1.5px solid #e0e0e0',
              borderRadius: 14, cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,.06)',
              transition: 'all .15s',
              fontFamily: 'inherit',
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
            <span style={{ fontSize: 28 }}>{a.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', textAlign: 'center' }}>
              {a.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Gráfico de pizza — distribuição por status ────────────────────────────────
function StatusPie({ items }) {
  const counts = {};
  for (const it of items) {
    counts[it.status] = (counts[it.status] || 0) + 1;
  }
  const pieData = Object.entries(counts).map(([name, value]) => ({ name, value }));

  if (pieData.length === 0) {
    return <div style={{ color: '#bbb', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Sem dados</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
          {pieData.map((_, i) => (
            <Cell key={i} fill={STATUS_PIE_COLORS[i % STATUS_PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Gráfico de barras — Epic vs História ─────────────────────────────────────
function TypeBar({ items }) {
  const epics    = items.filter((i) => i.type === 'Epic').length;
  const historias = items.filter((i) => i.type !== 'Epic').length;
  const barData  = [
    { name: 'Épicos',    qtd: epics },
    { name: 'Histórias', qtd: historias },
  ];
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={barData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="qtd" fill="#5521B5" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Lista de itens ─────────────────────────────────────────────────────────────
function ItemList({ items }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 5);

  if (items.length === 0) {
    return <p style={{ color: '#bbb', fontSize: 12, fontStyle: 'italic' }}>Nenhum item</p>;
  }

  return (
    <div>
      {visible.map((it) => {
        const sc = STATUS_COLORS[it.status] || '#888';
        return (
          <div key={it.key} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 0', borderBottom: '1px solid #f5f5f5',
          }}>
            <a href={`${JIRA}/browse/${it.key}`} target="_blank" rel="noreferrer"
              style={{ fontSize: 11, fontWeight: 700, color: '#5521B5', textDecoration: 'none', flexShrink: 0 }}>
              {it.key}
            </a>
            <span style={{ fontSize: 12, color: '#333', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={it.summary}>{it.summary}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
              background: `${sc}18`, color: sc, flexShrink: 0 }}>
              {it.status}
            </span>
          </div>
        );
      })}
      {items.length > 5 && (
        <button onClick={() => setExpanded((v) => !v)}
          style={{ marginTop: 8, fontSize: 11, color: '#5521B5', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
          {expanded ? '▲ Ver menos' : `▼ Ver mais ${items.length - 5} itens`}
        </button>
      )}
    </div>
  );
}

// ── Painel de uma categoria ────────────────────────────────────────────────────
function CategoryPanel({ cat, items }) {
  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${cat.color}33`,
      borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,.06)',
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${cat.color}22, ${cat.bg})`,
        borderBottom: `1px solid ${cat.color}22`,
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: cat.color }}>{cat.label}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {items.length} {items.length === 1 ? 'entrega' : 'entregas'}
          </div>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#bbb', fontSize: 13 }}>
            Nenhuma entrega encontrada para esta categoria.
          </div>
        ) : (
          <>
            {/* Gráficos lado a lado */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8 }}>STATUS</div>
                <StatusPie items={items} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8 }}>TIPO</div>
                <TypeBar items={items} />
              </div>
            </div>

            {/* Lista */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8 }}>DEMANDAS</div>
              <ItemList items={items} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── View principal ─────────────────────────────────────────────────────────────
export default function Entregas() {
  const [selectedArea, setSelectedArea] = useState(null);
  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);

  useEffect(() => {
    if (!selectedArea) return;
    setLoading(true);
    setError(null);
    setData(null);
    getEntregas(selectedArea.value, 'TODAS')
      .then(setData)
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [selectedArea]);

  // Sem área selecionada → seletor
  if (!selectedArea) {
    return (
      <div style={{ fontFamily: 'Inter, sans-serif', maxWidth: 1000, margin: '0 auto' }}>
        <AreaPicker onSelect={setSelectedArea} />
      </div>
    );
  }

  // Separa por categoria
  const allItems  = data?.items || [];
  const byCategoria = {};
  for (const cat of CATEGORIAS) {
    byCategoria[cat.value] = allItems.filter((it) =>
      it.categorias.includes(cat.jiraLabel)
    );
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header com breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => { setSelectedArea(null); setData(null); }}
          style={{
            fontSize: 13, fontWeight: 600, color: '#5521B5',
            background: '#EDE7F6', border: 'none', borderRadius: 8,
            padding: '6px 14px', cursor: 'pointer',
          }}
        >
          ← Áreas
        </button>
        <span style={{ fontSize: 11, color: '#bbb' }}>›</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e' }}>
          {selectedArea.icon} {selectedArea.label}
        </span>
        {!loading && data && (
          <span style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>
            — {allItems.length} entregas no total
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#888', fontSize: 14 }}>
          Carregando dados...
        </div>
      )}

      {/* Erro */}
      {error && (
        <div style={{
          background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 10,
          padding: '12px 16px', color: '#C62828', fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Painéis por categoria */}
      {!loading && !error && data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {CATEGORIAS.map((cat) => (
            <CategoryPanel key={cat.value} cat={cat} items={byCategoria[cat.value]} />
          ))}
        </div>
      )}
    </div>
  );
}
