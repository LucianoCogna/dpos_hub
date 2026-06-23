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
  { value: 'evolucao',     label: 'Evolução',              jiraLabel: 'Evolução',          color: '#2E7D32', bg: '#E8F5E9', barColor: '#43A047', icon: '🔄' },
  { value: 'novo_produto', label: 'Novo Produto de Dados', jiraLabel: 'novo_produto_dado', color: '#E65100', bg: '#FFF3E0', barColor: '#FB8C00', icon: '🚀' },
];

const STATUS_COLORS = ['#43A047', '#1E88E5', '#8E24AA', '#00897B'];

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Modal de seleção de categoria ─────────────────────────────────────────────
function CategoriaModal({ area, onSelect, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000 }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 420, background: '#fff',
        borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.2)',
        zIndex: 1001, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: '#999', fontWeight: 600, marginBottom: 4 }}>ÁREA SELECIONADA</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{area.icon}</span> {area.label}
            </div>
          </div>
          <button onClick={onClose}
            style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: '0 4px', lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {/* Seleção de categoria */}
        <div style={{ padding: '20px 24px 28px' }}>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 16, fontWeight: 600 }}>
            Qual categoria deseja visualizar?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {CATEGORIAS.map((cat) => (
              <button
                key={cat.value}
                onClick={() => onSelect(cat)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 20px', borderRadius: 12,
                  border: `2px solid ${cat.color}44`,
                  background: cat.bg, cursor: 'pointer',
                  transition: 'all .15s', fontFamily: 'inherit', textAlign: 'left',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = cat.color; e.currentTarget.style.transform = 'translateX(4px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${cat.color}44`; e.currentTarget.style.transform = 'translateX(0)'; }}
              >
                <span style={{ fontSize: 26 }}>{cat.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: cat.color }}>{cat.label}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    Label Jira: <code style={{ background: '#f0f0f0', padding: '1px 5px', borderRadius: 3 }}>{cat.jiraLabel}</code>
                  </div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 18, color: cat.color }}>→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Gráfico pizza — status ────────────────────────────────────────────────────
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
      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85}
        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
        labelLine fontSize={11}>
        {pieData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
      </Pie>
      <Tooltip />
    </PieChart>
  );
}

// ── Gráfico barras — tipo ─────────────────────────────────────────────────────
function TypeBar({ items, barColor }) {
  const barData = [
    { name: 'Épicos',    qtd: items.filter((i) => i.type === 'Epic').length },
    { name: 'Histórias', qtd: items.filter((i) => i.type !== 'Epic').length },
  ];
  return (
    <BarChart width={280} height={220} data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
  const visible = expanded ? items : items.slice(0, 6);

  if (!items.length) return (
    <p style={{ color: '#bbb', fontSize: 13, fontStyle: 'italic', margin: 0 }}>Nenhum item</p>
  );

  return (
    <div>
      {visible.map((it, i) => (
        <div key={it.key} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px', borderRadius: 8,
          background: i % 2 === 0 ? '#fafafa' : '#fff',
        }}>
          <a href={`${JIRA}/browse/${it.key}`} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, fontWeight: 700, color, textDecoration: 'none', flexShrink: 0 }}>
            {it.key}
          </a>
          <span style={{ fontSize: 13, color: '#333', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={it.summary}>{it.summary}</span>
          <span style={{ fontSize: 11, color: '#999', flexShrink: 0 }}>{fmtDate(it.end)}</span>
        </div>
      ))}
      {items.length > 6 && (
        <button onClick={() => setExpanded(v => !v)}
          style={{ marginTop: 8, fontSize: 12, color, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          {expanded ? '▲ Ver menos' : `▼ Ver mais ${items.length - 6} itens`}
        </button>
      )}
    </div>
  );
}

// ── Dashboard de gráficos ─────────────────────────────────────────────────────
function Dashboard({ area, categoria, onReset }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getEntregas(area.value, categoria.value)
      .then(setData)
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [area.value, categoria.value]);

  const items = data?.items || [];

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={onReset}
          style={{ fontSize: 13, fontWeight: 600, color: '#5521B5', background: '#EDE7F6', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}>
          ← Áreas
        </button>
        <span style={{ color: '#ccc' }}>›</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{area.icon} {area.label}</span>
        <span style={{ color: '#ccc' }}>›</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: categoria.color }}>{categoria.icon} {categoria.label}</span>
        {!loading && data && (
          <span style={{ fontSize: 12, color: '#999', marginLeft: 4 }}>— {items.length} entregas</span>
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

      {!loading && !error && (
        <div>
          {items.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '80px 20px',
              background: '#fff', borderRadius: 16, border: '1px solid #e8e0f8',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>Nenhuma entrega encontrada</div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>
                Verifique se os itens possuem a label <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 4 }}>{categoria.jiraLabel}</code> no Jira.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Gráficos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{
                  background: '#fff', borderRadius: 14, padding: '20px 24px',
                  border: `1.5px solid ${categoria.color}33`,
                  boxShadow: '0 2px 8px rgba(0,0,0,.05)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 12 }}>DISTRIBUIÇÃO POR STATUS</div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <StatusPie items={items} />
                  </div>
                </div>

                <div style={{
                  background: '#fff', borderRadius: 14, padding: '20px 24px',
                  border: `1.5px solid ${categoria.color}33`,
                  boxShadow: '0 2px 8px rgba(0,0,0,.05)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 12 }}>ÉPICOS vs HISTÓRIAS</div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <TypeBar items={items} barColor={categoria.barColor} />
                  </div>
                </div>
              </div>

              {/* Lista */}
              <div style={{
                background: '#fff', borderRadius: 14, padding: '20px 24px',
                border: `1.5px solid ${categoria.color}33`,
                boxShadow: '0 2px 8px rgba(0,0,0,.05)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 12 }}>
                  DEMANDAS ENTREGUES
                </div>
                <ItemList items={items} color={categoria.color} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── View principal ─────────────────────────────────────────────────────────────
export default function Entregas() {
  const [pendingArea,  setPendingArea]  = useState(null);  // área aguardando seleção de categoria
  const [selectedArea, setSelectedArea] = useState(null);  // área confirmada
  const [selectedCat,  setSelectedCat]  = useState(null);  // categoria confirmada

  const handleAreaClick  = (area) => { setPendingArea(area); };
  const handleCatSelect  = (cat)  => { setSelectedArea(pendingArea); setSelectedCat(cat); setPendingArea(null); };
  const handleModalClose = ()     => { setPendingArea(null); };
  const handleReset      = ()     => { setSelectedArea(null); setSelectedCat(null); };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', maxWidth: 1060, margin: '0 auto' }}>

      {/* Grade de áreas — sempre visível quando não há seleção completa */}
      {!selectedArea && (
        <>
          <div style={{ marginBottom: 28, textAlign: 'center' }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e', margin: 0 }}>Entregas</h1>
            <p style={{ fontSize: 13, color: '#666', marginTop: 6 }}>
              Selecione uma área para visualizar os gráficos de entregas
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
            {AREAS.map((a) => (
              <button key={a.value} onClick={() => handleAreaClick(a)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 10, padding: '24px 14px', background: '#fff',
                  border: '1.5px solid #e0e0e0', borderRadius: 14, cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                  transition: 'all .15s', fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#5521B5'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(85,33,181,.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <span style={{ fontSize: 30 }}>{a.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', textAlign: 'center' }}>{a.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Modal de seleção de categoria */}
      {pendingArea && (
        <CategoriaModal area={pendingArea} onSelect={handleCatSelect} onClose={handleModalClose} />
      )}

      {/* Dashboard — aparece na própria aba após seleção */}
      {selectedArea && selectedCat && (
        <Dashboard area={selectedArea} categoria={selectedCat} onReset={handleReset} />
      )}
    </div>
  );
}
