import { useState, useEffect, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import { getStatusReport } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:         '#0B0719',
  surface:    'rgba(255,255,255,0.04)',
  surfaceHov: 'rgba(255,255,255,0.07)',
  border:     'rgba(255,255,255,0.08)',
  purple:     '#7B3FD4',
  purpleDeep: '#5219A1',
  purpleGlow: 'rgba(123,63,212,0.25)',
  yellow:     '#FFAD01',
  yellowGlow: 'rgba(255,173,1,0.2)',
  green:      '#00E676',
  greenGlow:  'rgba(0,230,118,0.2)',
  orange:     '#FF7043',
  orangeGlow: 'rgba(255,112,67,0.2)',
  red:        '#FF5252',
  redGlow:    'rgba(255,82,82,0.2)',
  textPrim:   '#F0EAFF',
  textSec:    '#9B8EC4',
  textMut:    '#5C5278',
  white:      '#ffffff',
};

const JIRA = 'https://cogna.atlassian.net';
const AREAS = [
  'G&C','CAPTACAO_ANALITICA','REVENUE','ROTINAS_FINANCEIRAS',
  'DMC','REVENUE_STRATEGY','RVV','REPASSE',
  'ALIANCA_1_SOMOS','ALIANCA_1_SABER','Plurall',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmtDate = (s) => s ? new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : '-';
const fmtFull = (s) => s ? new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '-';
const fmtDT   = (s) => s ? new Date(s).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-';

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

function GlassCard({ children, style = {}, glow }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      backdropFilter: 'blur(12px)',
      boxShadow: glow ? `0 0 24px ${glow}` : '0 2px 12px rgba(0,0,0,0.4)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function Pill({ text, color, glow, size = 11 }) {
  return (
    <span style={{
      background: `${color}22`, color, border: `1px solid ${color}44`,
      borderRadius: 20, padding: '2px 10px', fontSize: size, fontWeight: 700,
      boxShadow: glow ? `0 0 8px ${glow}` : 'none', whiteSpace: 'nowrap',
    }}>{text}</span>
  );
}

function StatCard({ label, value, color, glow, icon, sub }) {
  return (
    <GlassCard glow={glow} style={{ padding: '18px 20px', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: T.textSec, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 38, fontWeight: 900, color, lineHeight: 1, letterSpacing: -1 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: T.textMut, marginTop: 4 }}>{sub}</div>}
        </div>
        {icon && <div style={{ fontSize: 28, opacity: 0.6 }}>{icon}</div>}
      </div>
    </GlassCard>
  );
}

function SectionLabel({ text, color = T.purple }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{ width: 3, height: 16, background: color, borderRadius: 2 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: T.textSec, letterSpacing: 1.5, textTransform: 'uppercase' }}>{text}</span>
    </div>
  );
}

function ItemCard({ item, badge, badgeColor, badgeGlow, accent, extra, extraColor, bg }) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={`${JIRA}/browse/${item.key}`} target="_blank" rel="noreferrer"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
        borderRadius: 8, marginBottom: 4, textDecoration: 'none',
        background: hover ? T.surfaceHov : (bg || 'transparent'),
        border: `1px solid ${hover ? T.border : 'transparent'}`,
        borderLeft: `3px solid ${accent || T.purple}`,
        transition: 'all 0.15s ease',
        cursor: 'pointer',
      }}
    >
      <span style={{ color: T.purple, fontWeight: 700, fontSize: 10, flexShrink: 0, minWidth: 64 }}>{item.key}</span>
      <span style={{ color: T.textSec, fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={item.summary}>{item.summary}</span>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {extra && <Pill text={extra} color={extraColor || T.orange} />}
        {badge && <Pill text={badge} color={badgeColor || T.purple} glow={badgeGlow} />}
      </div>
    </a>
  );
}

function Empty({ label = 'Nenhum item' }) {
  return (
    <div style={{ color: T.textMut, fontSize: 11, fontStyle: 'italic', padding: '6px 10px' }}>{label}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gantt moderno
// ─────────────────────────────────────────────────────────────────────────────

function ModernGantt({ items, sprintsCalendar, sprintOrder, currentSprint, nextSprint, today }) {
  if (!items?.length) return <Empty label="Nenhum épico no cronograma." />;

  const curIdx = sprintOrder.indexOf(currentSprint);
  let endIdx = curIdx + 5;
  for (const it of items) {
    if (!it.end) continue;
    const endD = new Date(it.end);
    for (let i = curIdx; i < sprintOrder.length; i++) {
      if (endD <= new Date(sprintsCalendar[sprintOrder[i]]?.end)) {
        endIdx = Math.max(endIdx, i + 1); break;
      }
    }
  }
  endIdx = Math.min(endIdx, sprintOrder.length - 1);
  const visible = sprintOrder.slice(curIdx, endIdx + 1);

  const piColors = { '26.2': T.purpleDeep, '26.3': T.purple, '26.4': '#9B59B6' };
  const piGroups = [];
  let lastPi = null;
  for (const sp of visible) {
    const pi = sp.slice(0, 4);
    if (pi !== lastPi) { piGroups.push({ pi, count: 1 }); lastPi = pi; }
    else piGroups[piGroups.length - 1].count++;
  }

  const rowH = Math.max(22, Math.min(30, 300 / items.length));

  function colOf(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    for (let i = 0; i < visible.length; i++) {
      const cal = sprintsCalendar[visible[i]];
      if (!cal) continue;
      if (d >= new Date(cal.start) && d <= new Date(cal.end)) return i;
    }
    if (d < new Date(sprintsCalendar[visible[0]]?.start)) return 0;
    return visible.length - 1;
  }

  const todayD = new Date(today);
  const curCal = sprintsCalendar[currentSprint];
  const curVisIdx = visible.indexOf(currentSprint);
  let todayPct = null;
  if (curCal && curVisIdx >= 0) {
    const frac = Math.min(1, Math.max(0, (todayD - new Date(curCal.start)) / (new Date(curCal.end) - new Date(curCal.start))));
    todayPct = ((curVisIdx + frac) / visible.length) * 100;
  }

  const LABEL_W = 72;

  const barGradients = {
    UP: `linear-gradient(90deg, ${T.purpleDeep}, ${T.purple})`,
    DN: `linear-gradient(90deg, ${T.purple}, #9B59B6)`,
    HM: `linear-gradient(90deg, ${T.orange}, #FFAB00)`,
  };

  return (
    <div style={{ overflowX: 'auto', fontSize: 11 }}>
      {/* PI header */}
      <div style={{ display: 'flex', marginLeft: LABEL_W }}>
        {piGroups.map(({ pi, count }) => (
          <div key={pi} style={{
            flex: count, textAlign: 'center', padding: '4px 0', fontSize: 10, fontWeight: 700,
            color: T.white, background: piColors[pi] || T.purple,
            borderRadius: '6px 6px 0 0', margin: '0 1px',
          }}>PI {pi}</div>
        ))}
      </div>

      {/* Sprint headers */}
      <div style={{ display: 'flex', marginLeft: LABEL_W, borderBottom: `1px solid ${T.border}` }}>
        {visible.map((sp) => (
          <div key={sp} style={{
            flex: 1, textAlign: 'center', padding: '3px 2px', fontSize: 9,
            color: sp === currentSprint ? T.yellow : T.textSec,
            fontWeight: sp === currentSprint ? 700 : 400,
            background: sp === currentSprint ? `${T.yellow}10`
              : sp === nextSprint ? `${T.purple}10` : 'transparent',
          }}>{sp}</div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ position: 'relative' }}>
        {todayPct !== null && (
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `calc(${LABEL_W}px + ${todayPct}%)`, width: 1, zIndex: 3,
            background: `linear-gradient(180deg, ${T.red}, transparent)`,
            borderLeft: `1px dashed ${T.red}55`,
          }}>
            <span style={{
              position: 'absolute', top: -16, left: 4,
              fontSize: 9, color: T.red, fontWeight: 700, whiteSpace: 'nowrap',
            }}>HOJE</span>
          </div>
        )}

        {items.map((it) => {
          const si = colOf(it.start);
          const ei = colOf(it.end);
          return (
            <div key={it.key} style={{
              display: 'flex', height: rowH, alignItems: 'center',
              borderBottom: `1px solid ${T.border}`,
            }}>
              <div style={{ width: LABEL_W, flexShrink: 0, paddingRight: 8, textAlign: 'right' }}>
                <a href={`${JIRA}/browse/${it.key}`} target="_blank" rel="noreferrer"
                  style={{ color: T.purple, fontSize: 10, fontWeight: 700, textDecoration: 'none' }}>
                  {it.key}
                </a>
              </div>
              {visible.map((sp, i) => {
                const isCur = sp === currentSprint;
                const isNxt = sp === nextSprint;
                let bg = isCur ? `${T.yellow}08` : isNxt ? `${T.purple}08` : 'transparent';
                let barGrad = null;
                let barLabel = null;

                if (si !== null && i === si) { barGrad = barGradients.UP; barLabel = 'UP'; }
                if (ei !== null) {
                  const dnStart = (si !== null && ei > si) ? si + 1 : (si ?? ei);
                  if (i >= dnStart && i <= ei) { barGrad = barGradients.DN; barLabel = 'DN'; }
                  if (i === ei + 1 && i < visible.length) { barGrad = barGradients.HM; barLabel = 'HM'; }
                }

                return (
                  <div key={sp} style={{
                    flex: 1, height: '100%', background: bg,
                    borderRight: `1px solid ${T.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '4px 2px',
                  }}>
                    {barGrad && (
                      <div style={{
                        width: '88%', height: rowH * 0.5,
                        background: barGrad, borderRadius: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: barLabel === 'HM' ? `0 0 6px ${T.orangeGlow}` : `0 0 6px ${T.purpleGlow}`,
                      }}>
                        {rowH >= 16 && (
                          <span style={{ color: T.white, fontSize: 8, fontWeight: 800 }}>{barLabel}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, padding: '0 4px' }}>
        {[['UP — Upstream', barGradients.UP], ['DN — Downstream', barGradients.DN], ['HM — Homologação', barGradients.HM]]
          .map(([l, g]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 24, height: 8, background: g, borderRadius: 3 }} />
              <span style={{ fontSize: 10, color: T.textSec }}>{l}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bar chart incidentes
// ─────────────────────────────────────────────────────────────────────────────

function IncidentChart({ bySprintData, currentSprint, sprintOrder }) {
  const sprints = sprintOrder.filter((sp) => bySprintData[sp]).slice(-6);
  if (!sprints.length) return <Empty label="Sem dados de incidentes." />;
  const maxTotal = Math.max(1, ...sprints.map((sp) => bySprintData[sp]?.length || 0));
  const BAR_H = 80;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: BAR_H + 40, paddingTop: 20 }}>
      {sprints.map((sp) => {
        const items = bySprintData[sp] || [];
        const total = items.length;
        const res = items.filter((i) => i.termino_dt).length;
        const open = total - res;
        const isCur = sp === currentSprint;
        const resH = total ? (res / maxTotal) * BAR_H : 0;
        const openH = open ? Math.max(6, (open / maxTotal) * BAR_H) : 0;
        const pct = total ? Math.round((open / total) * 100) : 0;

        return (
          <div key={sp} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.textPrim, marginBottom: 4 }}>{total}</span>
            <div style={{
              width: '65%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
              height: BAR_H, borderRadius: 6, overflow: 'hidden',
              outline: isCur ? `2px dashed ${T.yellow}` : 'none',
              outlineOffset: 2,
              boxShadow: isCur ? `0 0 12px ${T.yellowGlow}` : 'none',
            }}>
              {openH > 0 && (
                <div style={{
                  background: `linear-gradient(180deg, ${T.orange}, ${T.orange}88)`,
                  height: openH, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {openH >= 12 && <span style={{ color: T.white, fontSize: 8, fontWeight: 700 }}>{pct}%</span>}
                </div>
              )}
              {resH > 0 && (
                <div style={{ background: `linear-gradient(180deg, ${T.green}, ${T.green}88)`, height: resH }} />
              )}
            </div>
            <span style={{ fontSize: 9, color: isCur ? T.yellow : T.textMut, marginTop: 6, fontWeight: isCur ? 700 : 400 }}>{sp}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sprint Column (page 1)
// ─────────────────────────────────────────────────────────────────────────────

function SprintCol({ title, accent, items_data, sprintsCalendar, currentSprint }) {
  return (
    <GlassCard style={{ flex: 1, overflow: 'hidden' }}>
      <div style={{
        padding: '10px 14px', background: `linear-gradient(135deg, ${accent}33, ${accent}11)`,
        borderBottom: `1px solid ${T.border}`,
      }}>
        <span style={{ color: T.white, fontWeight: 800, fontSize: 13, letterSpacing: -0.3 }}>{title}</span>
      </div>
      <div style={{ padding: '12px 14px' }}>
        {items_data.map(({ sectionTitle, items, kind, accentColor }) => (
          <div key={sectionTitle} style={{ marginBottom: 14 }}>
            <SectionLabel text={`${sectionTitle} (${items.length})`} color={accentColor} />
            {items.length === 0
              ? <Empty />
              : items.map((it) => {
                  const cal = sprintsCalendar?.[currentSprint];
                  let badge, badgeColor, badgeGlow, extra, extraColor, itAccent, bg;

                  if (kind === 'upstream') {
                    badge = cal ? `até ${fmtDate(cal.end)}` : 'UP';
                    badgeColor = T.purple; badgeGlow = T.purpleGlow; itAccent = T.yellow;
                  } else if (kind === 'downstream') {
                    badge = it.end ? fmtDate(it.end) : 'DN';
                    badgeColor = T.purple; itAccent = T.purple;
                    if (it._atraso) { extra = `↻ ${it._atraso}d`; extraColor = T.orange; }
                  } else if (kind === 'homolog') {
                    const d = it._dias_homolog;
                    badge = d != null ? (d > 15 ? `⚠ ${d}d` : `${d}d`) : 'Hom.';
                    badgeColor = (d > 15) ? T.red : T.orange;
                    badgeGlow = (d > 15) ? T.redGlow : T.orangeGlow;
                    itAccent = T.orange;
                  } else if (kind === 'done') {
                    badge = it.implant ? fmtFull(it.implant) : '✓';
                    badgeColor = T.green; badgeGlow = T.greenGlow; itAccent = T.green;
                    bg = `${T.green}08`;
                  } else if (kind === 'next_homolog') {
                    badge = it._badge || 'Hom.'; badgeColor = T.orange; itAccent = T.orange;
                  }

                  return (
                    <ItemCard key={it.key + kind} item={it}
                      badge={badge} badgeColor={badgeColor} badgeGlow={badgeGlow}
                      accent={itAccent} extra={extra} extraColor={extraColor} bg={bg} />
                  );
                })}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page tabs
// ─────────────────────────────────────────────────────────────────────────────

function TabBar({ active, onChange, tabs }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: T.surface, borderRadius: 12, padding: 4, border: `1px solid ${T.border}` }}>
      {tabs.map(({ id, label, icon }) => {
        const isActive = active === id;
        return (
          <button key={id} onClick={() => onChange(id)} style={{
            flex: 1, padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: isActive ? `linear-gradient(135deg, ${T.purpleDeep}, ${T.purple})` : 'transparent',
            color: isActive ? T.white : T.textSec,
            fontWeight: isActive ? 700 : 500, fontSize: 13,
            boxShadow: isActive ? `0 0 16px ${T.purpleGlow}` : 'none',
            transition: 'all 0.2s ease',
          }}>
            <span style={{ marginRight: 6 }}>{icon}</span>{label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar strip
// ─────────────────────────────────────────────────────────────────────────────

function CalendarStrip({ sprintsCalendar, currentSprint, nextSprint }) {
  const visible = ['26.2.4','26.2.5','26.2.6','26.3.1','26.3.2','26.3.3','26.3.4','26.3.5','26.3.6']
    .filter((sp) => sprintsCalendar[sp]);

  return (
    <GlassCard style={{ padding: '12px 16px', marginTop: 12 }}>
      <div style={{ fontSize: 10, color: T.textSec, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
        Calendário PI 26.2 → 26.3
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {visible.map((sp) => {
          const isCur = sp === currentSprint;
          const isNxt = sp === nextSprint;
          const cal = sprintsCalendar[sp];
          const pi = sp.slice(0, 4);
          const piColor = pi === '26.2' ? T.purpleDeep : T.purple;

          return (
            <div key={sp} style={{
              flex: 1, borderRadius: 8, padding: '8px 4px', textAlign: 'center',
              background: isCur
                ? `linear-gradient(135deg, ${T.purpleDeep}, ${T.purple})`
                : isNxt ? `${T.yellow}15` : `${piColor}15`,
              border: isCur ? 'none' : `1px solid ${isCur || isNxt ? T.yellow : piColor}33`,
              position: 'relative',
              boxShadow: isCur ? `0 0 16px ${T.purpleGlow}` : 'none',
            }}>
              <div style={{
                fontSize: 9, fontWeight: 800, color: isCur ? T.white : isNxt ? T.yellow : T.textSec,
              }}>{sp}</div>
              {cal && (
                <div style={{ fontSize: 7.5, color: isCur ? 'rgba(255,255,255,0.6)' : T.textMut, marginTop: 2 }}>
                  {fmtDate(cal.start)}-{fmtDate(cal.end)}
                </div>
              )}
              {isCur && (
                <div style={{
                  position: 'absolute', top: 4, right: 4, width: 6, height: 6,
                  borderRadius: '50%', background: T.yellow,
                  boxShadow: `0 0 6px ${T.yellow}`,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Incident table (page 3)
// ─────────────────────────────────────────────────────────────────────────────

function IncidentTable({ incidents, currentSprint }) {
  const rows = incidents
    .filter((i) => i.sprints.includes(currentSprint))
    .sort((a, b) => new Date(b.created_dt || 0) - new Date(a.created_dt || 0));

  if (!rows.length) return <Empty label="Nenhum incidente na sprint atual." />;

  const cols = [
    { label: 'Incidente',    w: '10%' }, { label: 'Sprint',      w: '9%' },
    { label: 'Criado',       w: '11%' }, { label: 'Término Real', w: '11%' },
    { label: 'Tempo',        w: '8%'  }, { label: 'SLA',          w: '6%' },
    { label: 'Descrição',    w: '35%' }, { label: 'Status',       w: '10%'},
  ];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.label} style={{
                width: c.w, padding: '8px 10px', textAlign: 'left', fontWeight: 700,
                color: T.textSec, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase',
                borderBottom: `1px solid ${T.border}`,
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((inc, idx) => {
            const isDragged = inc.sprints.length > 1 && inc.sprints[0] !== currentSprint;
            const spLabel = isDragged ? `⚑ ${inc.sprints.at(-1) || '-'}` : (inc.sprints.at(-1) || '-');
            let tempo = '-';
            if (inc.created_dt && inc.termino_dt) {
              const hrs = (new Date(inc.termino_dt) - new Date(inc.created_dt)) / 3600000;
              tempo = `${hrs.toFixed(1)}h`;
            }
            return (
              <tr key={inc.key} style={{
                background: isDragged ? `${T.red}08` : idx % 2 === 0 ? T.surface : 'transparent',
                transition: 'background 0.15s',
              }}>
                <td style={{ padding: '8px 10px', fontWeight: 700, color: T.textPrim, fontSize: 10 }}>
                  <a href={`${JIRA}/browse/${inc.key}`} target="_blank" rel="noreferrer"
                    style={{ color: T.purple, textDecoration: 'none' }}>
                    {inc.sn_id || inc.key}
                  </a>
                </td>
                <td style={{ padding: '8px 10px', color: isDragged ? T.red : T.textSec, fontSize: 10 }}>{spLabel}</td>
                <td style={{ padding: '8px 10px', color: T.textSec, fontSize: 10 }}>{fmtDT(inc.created_dt)}</td>
                <td style={{ padding: '8px 10px', color: T.textSec, fontSize: 10 }}>{fmtDT(inc.termino_dt)}</td>
                <td style={{ padding: '8px 10px', color: T.textSec, fontSize: 10 }}>{tempo}</td>
                <td style={{ padding: '8px 10px' }}>
                  {inc.sla_met === true  && <Pill text="✓ OK"    color={T.green}  />}
                  {inc.sla_met === false && <Pill text="✗ Viola" color={T.red}    />}
                  {inc.sla_met === null  && <span style={{ color: T.textMut }}>—</span>}
                </td>
                <td style={{ padding: '8px 10px', color: T.textSec, maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>
                  {inc.summary}
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <Pill text={inc.status} color={T.purple} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function StatusReportV2() {
  const [area, setArea]         = useState('G&C');
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [tab, setTab]           = useState('sprint');
  const [pdfLoading, setPdfLoading] = useState(false);
  const reportRef = useRef(null);

  const load = async (a) => {
    setLoading(true); setError(null); setData(null);
    try { setData(await getStatusReport(a)); }
    catch (e) { setError(e.response?.data?.error || e.message || 'Erro ao carregar'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(area); }, [area]);

  const downloadPdf = async () => {
    if (!reportRef.current) return;
    setPdfLoading(true);
    try {
      await html2pdf().set({
        margin: 0,
        filename: `StatusReport_v2_${area}_${data?.today?.replace(/-/g,'') || 'export'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: T.bg },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      }).from(reportRef.current).save();
    } finally { setPdfLoading(false); }
  };

  const { classification: cls, current_sprint, next_sprint, today,
    sprints_calendar, sprint_order, pi_metrics,
    incidents, incidents_summary, incidents_by_sprint, has_incidents_page } = data || {};

  const tabs = [
    { id: 'sprint',     label: 'Sprint',     icon: '⚡' },
    { id: 'cronograma', label: 'Cronograma', icon: '📈' },
    ...(data?.has_incidents_page ? [{ id: 'incidentes', label: 'Incidentes', icon: '🚨' }] : []),
  ];

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      margin: '-32px -24px', padding: '28px 28px 40px',
      fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      color: T.textPrim,
    }}>
      {/* ── Header ── */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, background: `linear-gradient(135deg, ${T.white}, ${T.purple})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: -0.5 }}>
            Status Report
          </div>
          <div style={{ fontSize: 11, color: T.textMut, marginTop: 2 }}>Versão Moderna · Cogna Educação</div>
        </div>

        <div style={{ flex: 1 }} />

        <select value={area} onChange={(e) => setArea(e.target.value)} style={{
          background: T.surface, color: T.textPrim, border: `1px solid ${T.border}`,
          borderRadius: 10, padding: '8px 14px', fontSize: 13, outline: 'none', cursor: 'pointer',
        }}>
          {AREAS.map((a) => <option key={a} value={a} style={{ background: '#1a1030' }}>{a}</option>)}
        </select>

        <button onClick={() => load(area)} disabled={loading} style={{
          background: loading ? T.surface : `linear-gradient(135deg, ${T.purpleDeep}, ${T.purple})`,
          color: T.white, border: 'none', borderRadius: 10, padding: '8px 16px',
          fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: loading ? 'none' : `0 0 16px ${T.purpleGlow}`,
        }}>
          {loading ? '⏳ Carregando…' : '🔄 Atualizar'}
        </button>

        <button onClick={downloadPdf} disabled={!data || pdfLoading} style={{
          background: T.surface, color: T.textPrim, border: `1px solid ${T.border}`,
          borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600,
          cursor: !data || pdfLoading ? 'not-allowed' : 'pointer', opacity: !data || pdfLoading ? 0.5 : 1,
        }}>
          {pdfLoading ? '⏳ Gerando…' : '⬇️ Baixar PDF'}
        </button>

        {data && (
          <div style={{ fontSize: 11, color: T.textMut, background: T.surface, padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.border}` }}>
            <span style={{ color: T.yellow, fontWeight: 700 }}>{current_sprint}</span>
            <span style={{ margin: '0 6px' }}>·</span>
            {today}
          </div>
        )}
      </div>

      {error && (
        <GlassCard glow={T.redGlow} style={{ padding: 16, marginBottom: 20, border: `1px solid ${T.red}44` }}>
          <span style={{ color: T.red }}>⚠️ {error}</span>
        </GlassCard>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 80, color: T.textMut }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 14 }}>Buscando dados do Jira…</div>
        </div>
      )}

      {data && (
        <div ref={reportRef} style={{ background: T.bg }}>
          {/* Metric cards row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <StatCard label="Upstream" value={cls.current_upstream.length + cls.next_upstream.length}
              color={T.yellow} glow={T.yellowGlow} icon="🔼"
              sub={`${cls.current_upstream.length} atual · ${cls.next_upstream.length} próxima`} />
            <StatCard label="Downstream" value={cls.current_downstream.length + cls.next_downstream.length}
              color={T.purple} glow={T.purpleGlow} icon="🔽"
              sub={`${cls.current_downstream.length} atual · ${cls.next_downstream.length} próxima`} />
            <StatCard label="Homologação" value={cls.current_homolog.length}
              color={T.orange} glow={T.orangeGlow} icon="🧪"
              sub={`${cls.next_homolog.length} prevista na próxima sprint`} />
            <StatCard label="Entregues" value={cls.current_done.length}
              color={T.green} glow={T.greenGlow} icon="✅"
              sub={`${cls.finalizados.length} finalizados no total`} />
            {has_incidents_page && (
              <StatCard label="Incidentes" value={incidents_summary.total}
                color={T.red} glow={T.redGlow} icon="🚨"
                sub={`${incidents_summary.aberto} em aberto`} />
            )}
          </div>

          {/* Tabs */}
          <div className="no-print" style={{ marginBottom: 16 }}>
            <TabBar active={tab} onChange={setTab} tabs={tabs} />
          </div>

          {/* ── Tab: Sprint ── */}
          {tab === 'sprint' && (
            <div>
              <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                <SprintCol
                  title={`⚡ Sprint Atual — ${current_sprint}`}
                  accent={T.purple}
                  sprintsCalendar={sprints_calendar}
                  currentSprint={current_sprint}
                  items_data={[
                    { sectionTitle: 'Upstream',            items: cls.current_upstream,   kind: 'upstream',    accentColor: T.yellow  },
                    { sectionTitle: 'Downstream',          items: cls.current_downstream, kind: 'downstream',  accentColor: T.purple  },
                    { sectionTitle: 'Homologação',         items: cls.current_homolog,    kind: 'homolog',     accentColor: T.orange  },
                    { sectionTitle: 'Concluídos',          items: cls.current_done,       kind: 'done',        accentColor: T.green   },
                  ]}
                />
                <SprintCol
                  title={`🔮 Próxima Sprint — ${next_sprint}`}
                  accent={T.purpleDeep}
                  sprintsCalendar={sprints_calendar}
                  currentSprint={current_sprint}
                  items_data={[
                    { sectionTitle: 'Upstream',            items: cls.next_upstream,   kind: 'upstream',     accentColor: T.yellow },
                    { sectionTitle: 'Downstream',          items: cls.next_downstream, kind: 'downstream',   accentColor: T.purple },
                    { sectionTitle: 'Hom. Prevista',       items: cls.next_homolog,    kind: 'next_homolog', accentColor: T.orange },
                  ]}
                />
              </div>
              <CalendarStrip sprintsCalendar={sprints_calendar} currentSprint={current_sprint} nextSprint={next_sprint} />
            </div>
          )}

          {/* ── Tab: Cronograma ── */}
          {tab === 'cronograma' && (
            <div style={{ display: 'flex', gap: 14 }}>
              {/* Sidebar PI metrics */}
              <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['26.1','26.2','26.3','26.4'].map((pi) => {
                  const [ent, plan] = pi_metrics?.[pi] || [0, 0];
                  const ratio = plan > 0 ? Math.min(1, ent / plan) : (ent > 0 ? 1 : 0);
                  return (
                    <GlassCard key={pi} style={{ padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ color: T.textSec, fontSize: 11, fontWeight: 700 }}>PI {pi}</span>
                        <span style={{ color: T.textPrim, fontWeight: 800 }}>
                          {pi === '26.1' ? `${ent} ent.` : `${ent}/${plan}`}
                        </span>
                      </div>
                      <div style={{ height: 6, background: `${T.purple}22`, borderRadius: 3 }}>
                        <div style={{
                          height: '100%', width: `${ratio * 100}%`, borderRadius: 3,
                          background: `linear-gradient(90deg, ${T.purpleDeep}, ${T.green})`,
                          boxShadow: `0 0 8px ${T.purpleGlow}`,
                          transition: 'width 0.8s ease',
                        }} />
                      </div>
                    </GlassCard>
                  );
                })}

                <GlassCard style={{ padding: 14 }}>
                  <SectionLabel text="Situação" color={T.yellow} />
                  {[
                    ['Finalizados', cls.finalizados.length, T.green],
                    ['Sem priorização', cls.sem_priorizacao.length, T.red],
                    ['Backlog planejado', cls.backlog_planejado?.length || 0, T.yellow],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: T.textSec }}>{l}</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: c }}>{v}</span>
                    </div>
                  ))}
                </GlassCard>
              </div>

              {/* Gantt */}
              <GlassCard style={{ flex: 1, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.textPrim, marginBottom: 12 }}>
                  Cronograma — Épicos Ativos e Backlog Planejado
                </div>
                <ModernGantt
                  items={cls.gantt_full}
                  sprintsCalendar={sprints_calendar}
                  sprintOrder={sprint_order}
                  currentSprint={current_sprint}
                  nextSprint={next_sprint}
                  today={today}
                />
              </GlassCard>
            </div>
          )}

          {/* ── Tab: Incidentes ── */}
          {tab === 'incidentes' && has_incidents_page && (
            <div>
              {/* KPI row */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <StatCard label="Total na Sprint"  value={incidents_summary.total}      color={T.textPrim} icon="📋" />
                <StatCard label="Em Aberto"        value={incidents_summary.aberto}     color={T.red}    glow={T.redGlow}   icon="🔴" />
                <StatCard label="Resolvidos"       value={incidents_summary.resolvidos} color={T.green}  glow={T.greenGlow} icon="✅" />
                <StatCard label="SLA Violado"      value={incidents_summary.sla_violado} color={T.orange} glow={T.orangeGlow} icon="⏱️" />
              </div>

              <div style={{ display: 'flex', gap: 14 }}>
                <GlassCard style={{ width: 260, flexShrink: 0, padding: 16 }}>
                  <SectionLabel text="Histórico por Sprint" color={T.red} />
                  <IncidentChart
                    bySprintData={incidents_by_sprint || {}}
                    currentSprint={current_sprint}
                    sprintOrder={sprint_order}
                  />
                </GlassCard>

                <GlassCard style={{ flex: 1, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.textPrim, marginBottom: 10 }}>
                    INCIDENTES DA SPRINT ATUAL — {current_sprint}
                  </div>
                  <IncidentTable incidents={incidents || []} currentSprint={current_sprint} />
                </GlassCard>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
