import { useState, useEffect } from 'react';
import { getEntregas } from '../services/api';

const JIRA = 'https://cogna.atlassian.net';

const AREAS = [
  { value: 'TODAS',              label: 'Todas as áreas' },
  { value: 'G&C',                label: 'G&C' },
  { value: 'ESG',                label: 'ESG' },
  { value: 'CAPTACAO_ANALITICA', label: 'Captação Analítica' },
  { value: 'REVENUE',            label: 'Revenue' },
  { value: 'ROTINAS_FINANCEIRAS',label: 'Rotinas Financeiras' },
  { value: 'DMC',                label: 'DMC' },
  { value: 'REVENUE_STRATEGY',   label: 'Revenue Strategy' },
  { value: 'RVV',                label: 'RVV' },
  { value: 'REPASSE',            label: 'Repasse' },
  { value: 'ALIANCA_1_SOMOS',    label: 'Aliança 1 Somos' },
  { value: 'ALIANCA_1_SABER',    label: 'Aliança 1 Saber' },
  { value: 'Plurall',            label: 'Plurall' },
  { value: 'MACROPROCESSO',      label: 'Macroprocesso' },
];

const CATEGORIAS = [
  { value: 'TODAS',        label: 'Todas' },
  { value: 'evolucao',     label: 'Evolução' },
  { value: 'novo_produto', label: 'Novo Produto de Dados' },
];

const STATUS_COLOR = {
  'Em produção':  { bg: '#E8F5E9', color: '#2E7D32' },
  'Em Andamento': { bg: '#E3F2FD', color: '#1565C0' },
  'Homologação':  { bg: '#FFF3E0', color: '#E65100' },
  'Refinamento':  { bg: '#F3E5F5', color: '#6A1B9A' },
  'Bloqueado':    { bg: '#FFEBEE', color: '#B71C1C' },
  'Backlog':      { bg: '#ECEFF1', color: '#455A64' },
  'Funil':        { bg: '#ECEFF1', color: '#455A64' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function StatusBadge({ status }) {
  const s = STATUS_COLOR[status] || { bg: '#F5F5F5', color: '#757575' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      {status || '—'}
    </span>
  );
}

function TypeBadge({ type }) {
  const isEpic = type === 'Epic';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      background: isEpic ? '#EDE7F6' : '#E3F2FD',
      color: isEpic ? '#512DA8' : '#1565C0',
      whiteSpace: 'nowrap',
    }}>
      {type}
    </span>
  );
}

export default function Entregas() {
  const [area,      setArea]      = useState('TODAS');
  const [categoria, setCategoria] = useState('TODAS');
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getEntregas(area, categoria)
      .then(setData)
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [area, categoria]);

  const items = data?.items || [];

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', margin: 0 }}>
          Entregas
        </h1>
        <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
          Épicos e histórias por área e categoria
        </p>
      </div>

      {/* Filtros */}
      <div style={{
        display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap',
        background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12,
        padding: '16px 20px', marginBottom: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
      }}>
        {/* Área */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#555', display: 'block', marginBottom: 5 }}>
            ÁREA
          </label>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            style={{
              fontSize: 13, padding: '7px 12px', borderRadius: 8,
              border: '1.5px solid #d0d0d0', outline: 'none',
              background: '#fafafa', cursor: 'pointer', minWidth: 200,
            }}
          >
            {AREAS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {/* Categoria */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#555', display: 'block', marginBottom: 5 }}>
            CATEGORIA
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {CATEGORIAS.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategoria(c.value)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8,
                  border: categoria === c.value ? '1.5px solid #5521B5' : '1.5px solid #d0d0d0',
                  background: categoria === c.value ? '#5521B5' : '#fafafa',
                  color: categoria === c.value ? '#fff' : '#444',
                  cursor: 'pointer', transition: 'all .15s',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contagem */}
        {!loading && data && (
          <div style={{ marginLeft: 'auto', fontSize: 13, color: '#888', alignSelf: 'center' }}>
            {items.length} {items.length === 1 ? 'item' : 'itens'}
          </div>
        )}
      </div>

      {/* Estado de loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#888', fontSize: 14 }}>
          Carregando...
        </div>
      )}

      {/* Erro */}
      {error && (
        <div style={{
          background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 10,
          padding: '12px 16px', color: '#C62828', fontSize: 13, marginBottom: 16,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Tabela */}
      {!loading && !error && (
        <div style={{
          background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12,
          overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)',
        }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa', fontSize: 14 }}>
              Nenhum item encontrado para os filtros selecionados.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8F7FF', borderBottom: '2px solid #e0e0e0' }}>
                  <th style={th}>#</th>
                  <th style={th}>Tipo</th>
                  <th style={{ ...th, textAlign: 'left' }}>Título</th>
                  <th style={th}>Status</th>
                  <th style={th}>Categoria</th>
                  <th style={th}>Área(s)</th>
                  <th style={th}>Previsão de fim</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr
                    key={it.key}
                    style={{
                      borderBottom: '1px solid #f0f0f0',
                      background: i % 2 === 0 ? '#fff' : '#FAFAFA',
                    }}
                  >
                    <td style={{ ...td, fontWeight: 700 }}>
                      <a
                        href={`${JIRA}/browse/${it.key}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#5521B5', textDecoration: 'none', fontSize: 12 }}
                      >
                        {it.key}
                      </a>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <TypeBadge type={it.type} />
                    </td>
                    <td style={{ ...td, maxWidth: 360 }}>
                      <span
                        style={{ fontSize: 13, color: '#1a1a2e' }}
                        title={it.summary}
                      >
                        {it.summary}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <StatusBadge status={it.status} />
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {it.categorias.length === 0 && <span style={{ color: '#bbb', fontSize: 11 }}>—</span>}
                        {it.categorias.map((c) => (
                          <span key={c} style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                            background: c === 'Evolução' ? '#E8F5E9' : '#FFF3E0',
                            color: c === 'Evolução' ? '#2E7D32' : '#E65100',
                          }}>
                            {c === 'novo_produto_dado' ? 'Novo Produto' : c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {it.areas.map((a) => (
                          <span key={a} style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                            background: '#EDE7F6', color: '#512DA8',
                          }}>
                            {a}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'center', fontSize: 12, color: '#666' }}>
                      {fmtDate(it.end)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const th = {
  padding: '10px 14px',
  fontSize: 11,
  fontWeight: 700,
  color: '#555',
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

const td = {
  padding: '10px 14px',
  verticalAlign: 'middle',
};
