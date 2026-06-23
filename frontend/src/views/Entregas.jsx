import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
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
  { value: 'evolucao',     label: 'Evolução',              jiraLabel: 'Evolução',          color: '#2E7D32', bg: '#E8F5E9', barColor: '#43A047' },
  { value: 'novo_produto', label: 'Novo Produto de Dados', jiraLabel: 'novo_produto_dado', color: '#E65100', bg: '#FFF3E0', barColor: '#FB8C00' },
];

const STATUS_COLORS = ['#43A047', '#1E88E5', '#8E24AA', '#00897B'];

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
                  gap: 8, padding: '20px 12px',
                  background: '#FAFAFA', border: '1.5px solid #e8e0f8',
                  borderRadius: 12, cursor: 'pointer',
                  transition: 'all .15s', fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#5521B5';
                  e.currentTarget.style.background = '#F3EEF8';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(85,33,181,.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e8e0f8';
                  e.currentTarget.style.background = '#FAFAFA';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <span style={{ fontSize: 26 }}>{a.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', textAlign: 'center', lineHeight: 1.3 }}>
                  {a.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Gráfico pizza ─────────────────────────────────────────────────────────────
function StatusPie({ items }) {
  const counts = {};
  for (const it of items) counts[it.status] = (counts[it.status] || 0) + 1;
  const pieData = Object.entries(counts).map(([name, value]) => ({ name, value }));

  if (!pieData.length) return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 13 }}>
      Sem dados
    </div>
  );

  return (
    <PieChart width={300} height={220}>
      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
        label={({ name, percent }) => `${name} · ${(percent * 100).toFixed(0)}%`}
        labelLine={true} fontSize={11}>
        {pieData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
      </Pie>
      <Tooltip />
    </PieChart>
  );
}

// ── Gráfico barras ────────────────────────────────────────────────────────────
function TypeBar({ items, barColor }) {
  const barData = [
    { name: 'Épicos',    qtd: items.filter((i) => i.type === 'Epic').length },
    { name: 'Histórias', qtd: items.filter((i) => i.type !== 'Epic').length },
  ];
  return (
    <BarChart width={260} height={220} data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
      <Tooltip />
      <Bar dataKey="qtd" fill={barColor} radius={[6, 6, 0, 0]} />
    </BarChart>
  );
}

// ── Lista de demandas ─────────────────────────────────────────────────────────
function ItemList({ items, color }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 5);

  if (!items.length) return (
    <p style={{ color: '#bbb', fontSize: 13, fontStyle: 'italic', margin: 0 }}>Nenhum item encontrado</p>
  );

  return (
    <div>
      {visible.map((it, i) => (
        <div key={it.key} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
          borderRadius: 7, background: i % 2 === 0 ? '#fafafa' : '#fff',
        }}>
          <a href={`${JIRA}/browse/${it.key}`} target="_blank" rel="noreferrer"
            style={{ fontSize: 11, fontWeight: 700, color, textDecoration: 'none', flexShrink: 0 }}>
            {it.key}
          </a>
          <span style={{ fontSize: 13, color: '#333', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={it.summary}>{it.summary}</span>
          <span style={{ fontSize: 11, color: '#999', flexShrink: 0 }}>{fmtDate(it.end)}</span>
        </div>
      ))}
      {items.length > 5 && (
        <button onClick={() => setExpanded(v => !v)}
          style={{ marginTop: 8, fontSize: 12, color, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          {expanded ? '▲ Ver menos' : `▼ Ver mais ${items.length - 5} itens`}
        </button>
      )}
    </div>
  );
}

// ── Painel de categoria ───────────────────────────────────────────────────────
function CategoriaPanel({ cat, items }) {
  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${cat.color}33`,
      borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,.06)',
    }}>
      <div style={{
        background: cat.bg, borderBottom: `1px solid ${cat.color}22`,
        padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: cat.color }}>{cat.label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: cat.color, background: `${cat.color}18`, padding: '3px 12px', borderRadius: 20 }}>
          {items.length} {items.length === 1 ? 'entrega' : 'entregas'}
        </span>
      </div>

      <div style={{ padding: 20 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#bbb' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: 13 }}>Nenhuma entrega encontrada</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              Verifique a label <code style={{ background: '#f5f5f5', padding: '1px 5px', borderRadius: 3 }}>{cat.jiraLabel}</code> no Jira
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#999', marginBottom: 6 }}>STATUS</div>
                <StatusPie items={items} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#999', marginBottom: 6 }}>TIPO</div>
                <TypeBar items={items} barColor={cat.barColor} />
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${cat.color}22`, paddingTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#999', marginBottom: 8 }}>DEMANDAS</div>
              <ItemList items={items} color={cat.color} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── View principal ────────────────────────────────────────────────────────────
export default function Entregas() {
  const [area,    setArea]    = useState(null);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const handleSelect = (a) => {
    setArea(a);
    setData(null);
    setLoading(true);
    setError(null);
    getEntregas(a.value, 'TODAS')
      .then(setData)
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  // Separa itens por categoria
  const allItems = data?.items || [];
  const byCategoria = {};
  for (const cat of CATEGORIAS) {
    byCategoria[cat.value] = allItems.filter((it) => it.categorias.includes(cat.jiraLabel));
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', maxWidth: 1060, margin: '0 auto' }}>

      {/* Modal sempre visível quando não há área selecionada */}
      {!area && <AreaModal onSelect={handleSelect} />}

      {/* Conteúdo da aba */}
      {area && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button onClick={() => setArea(null)}
              style={{ fontSize: 13, fontWeight: 600, color: '#5521B5', background: '#EDE7F6', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer' }}>
              ← Trocar área
            </button>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>
              {area.icon} {area.label}
            </span>
            {!loading && data && (
              <span style={{ fontSize: 12, color: '#999' }}>— {allItems.length} entregas no total</span>
            )}
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#888', fontSize: 14 }}>Carregando...</div>
          )}
          {error && (
            <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 10, padding: '14px 18px', color: '#C62828', fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          {!loading && !error && data && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {CATEGORIAS.map((cat) => (
                <CategoriaPanel key={cat.value} cat={cat} items={byCategoria[cat.value]} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
