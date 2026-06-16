import { useState, useEffect, useRef, useCallback } from 'react';
import html2pdf from 'html2pdf.js';
import { getStatusReport } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — paleta clara/moderna
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  // backgrounds
  pageBg:      'linear-gradient(145deg, #F0EBFF 0%, #EBF0FF 40%, #F8F5FF 100%)',
  surface:     'rgba(255,255,255,0.82)',
  surfaceHov:  'rgba(255,255,255,0.96)',
  surfaceSol:  '#ffffff',

  // borders & shadows
  border:      'rgba(82,25,161,0.10)',
  borderHov:   'rgba(82,25,161,0.22)',
  shadow:      '0 4px 24px rgba(82,25,161,0.08)',
  shadowHov:   '0 8px 32px rgba(82,25,161,0.15)',

  // brand
  purple:      '#5219A1',
  purpleMid:   '#7B3FD4',
  purpleLight: '#EDE5F5',
  purpleSoft:  'rgba(123,63,212,0.10)',
  purpleGlow:  'rgba(82,25,161,0.20)',

  yellow:      '#FFAD01',
  yellowLight: '#FFF8E7',
  yellowGlow:  'rgba(255,173,1,0.20)',

  green:       '#00A850',
  greenLight:  '#E6F9EE',
  greenGlow:   'rgba(0,168,80,0.18)',

  orange:      '#F58220',
  orangeLight: '#FEF0E6',
  orangeGlow:  'rgba(245,130,32,0.18)',

  red:         '#E53935',
  redLight:    '#FDECEA',
  redGlow:     'rgba(229,57,53,0.18)',

  // text
  textPrim:    '#1A0B3D',
  textSec:     '#4A3880',
  textMut:     '#9B8EC4',
  white:       '#ffffff',
};

const JIRA  = 'https://cogna.atlassian.net';
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

// Animated counter hook
function useCounter(target, duration = 800) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (typeof target !== 'number') return;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(ease * target));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS Animations (injetado via <style>)
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1);    }
  }
  @keyframes barFill {
    from { width: 0%; }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,173,1,0.4); }
    50%       { box-shadow: 0 0 0 8px rgba(255,173,1,0);  }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  .sr2-card {
    transition: box-shadow 0.22s ease, transform 0.22s ease, border-color 0.22s ease;
  }
  .sr2-card:hover {
    box-shadow: 0 8px 32px rgba(82,25,161,0.14) !important;
    transform: translateY(-2px);
    border-color: rgba(82,25,161,0.22) !important;
  }
  .sr2-item {
    transition: background 0.15s ease, transform 0.12s ease;
  }
  .sr2-item:hover {
    background: rgba(123,63,212,0.07) !important;
    transform: translateX(3px);
  }
  .sr2-tab {
    transition: all 0.2s ease;
  }
  .sr2-tab:hover {
    background: rgba(82,25,161,0.07) !important;
  }
  .sr2-tab.active {
    animation: scaleIn 0.2s ease;
  }
  .sr2-bar-fill {
    animation: barFill 0.9s cubic-bezier(0.22,1,0.36,1) both;
  }
  .sr2-fade-up {
    animation: fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both;
  }
  .sr2-fade-in {
    animation: fadeIn 0.35s ease both;
  }
  .sr2-spin { animation: spin 1s linear infinite; }
  .sr2-pulse { animation: pulse 2s ease-in-out infinite; }

  .sr2-skeleton {
    background: linear-gradient(90deg, #ede9f7 25%, #ddd5f5 50%, #ede9f7 75%);
    background-size: 400px 100%;
    animation: shimmer 1.4s ease infinite;
    border-radius: 8px;
  }

  @media print {
    .no-print { display: none !important; }
    .sr2-page { page-break-after: always; }
    body { background: white !important; }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

function Card({ children, style = {}, delay = 0, glow, className = '' }) {
  return (
    <div
      className={`sr2-card sr2-fade-up ${className}`}
      style={{
        background: T.surface,
        border: `1.5px solid ${T.border}`,
        borderRadius: 18,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: glow
          ? `${T.shadow}, 0 0 0 1px ${glow}40, 0 4px 20px ${glow}`
          : T.shadow,
        animationDelay: `${delay}ms`,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Chip({ text, color, bg, size = 11, bold = true }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: bg || `${color}18`,
      color,
      border: `1px solid ${color}30`,
      borderRadius: 20,
      padding: '2px 10px',
      fontSize: size,
      fontWeight: bold ? 700 : 500,
      whiteSpace: 'nowrap',
      letterSpacing: 0.2,
    }}>{text}</span>
  );
}

function AnimatedNumber({ value, color = T.textPrim, size = 40 }) {
  const displayed = useCounter(value);
  return (
    <span style={{
      fontSize: size, fontWeight: 900, color, lineHeight: 1, letterSpacing: -1,
      display: 'block',
    }}>{displayed}</span>
  );
}

function StatCard({ label, value, color, glow, icon, sub, delay = 0 }) {
  return (
    <Card delay={delay} glow={glow} style={{ padding: '20px 22px', flex: 1, minWidth: 140 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10, color: T.textMut, fontWeight: 700, letterSpacing: 1.2,
            textTransform: 'uppercase', marginBottom: 8,
          }}>{label}</div>
          <AnimatedNumber value={value} color={color} size={38} />
          {sub && (
            <div style={{ fontSize: 10.5, color: T.textMut, marginTop: 6, lineHeight: 1.4 }}>{sub}</div>
          )}
        </div>
        {icon && (
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: `${color}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>{icon}</div>
        )}
      </div>
      {/* accent bottom border */}
      <div style={{
        height: 3, borderRadius: '0 0 18px 18px',
        background: `linear-gradient(90deg, ${color}, ${color}44)`,
        margin: '16px -22px -20px',
      }} />
    </Card>
  );
}

function SectionLabel({ text, color = T.purpleMid, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
      <div style={{ width: 3, height: 14, background: color, borderRadius: 2, flexShrink: 0 }} />
      {icon && <span style={{ fontSize: 12 }}>{icon}</span>}
      <span style={{ fontSize: 10.5, fontWeight: 700, color: T.textMut, letterSpacing: 1.2, textTransform: 'uppercase' }}>
        {text}
      </span>
    </div>
  );
}

function ItemRow({ item, badge, badgeColor, accent, extra, extraColor, bg, delay = 0 }) {
  return (
    <a
      href={`${JIRA}/browse/${item.key}`} target="_blank" rel="noreferrer"
      className="sr2-item"
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', marginBottom: 3, borderRadius: 9,
        background: bg || 'transparent',
        borderLeft: `3px solid ${accent || T.purpleMid}`,
        textDecoration: 'none', cursor: 'pointer',
        animationDelay: `${delay}ms`,
      }}
    >
      <span style={{ color: T.purpleMid, fontWeight: 800, fontSize: 10, flexShrink: 0, minWidth: 64 }}>
        {item.key}
      </span>
      <span style={{
        color: T.textSec, fontSize: 11, flex: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }} title={item.summary}>{item.summary}</span>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {extra  && <Chip text={extra}  color={extraColor || T.orange} />}
        {badge  && <Chip text={badge}  color={badgeColor || T.purpleMid} />}
      </div>
    </a>
  );
}

function Empty({ label = 'Nenhum item' }) {
  return (
    <div style={{ color: T.textMut, fontSize: 11, fontStyle: 'italic', padding: '5px 12px', opacity: 0.7 }}>
      {label}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────────────────────────────────────
function Skeleton({ h = 80, mb = 12, br = 12 }) {
  return <div className="sr2-skeleton" style={{ height: h, marginBottom: mb, borderRadius: br }} />;
}

function LoadingState() {
  return (
    <div className="sr2-fade-in" style={{ padding: '0 0 24px' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[1,2,3,4].map((i) => <Skeleton key={i} h={110} mb={0} br={18} />)}
      </div>
      <Skeleton h={48} br={14} />
      <div style={{ display: 'flex', gap: 14, marginTop: 16 }}>
        <Skeleton h={380} br={18} />
        <Skeleton h={380} br={18} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TabBar
// ─────────────────────────────────────────────────────────────────────────────
function TabBar({ active, onChange, tabs }) {
  return (
    <div style={{
      display: 'inline-flex', gap: 4,
      background: 'rgba(255,255,255,0.6)',
      border: `1.5px solid ${T.border}`,
      borderRadius: 14, padding: 4,
      backdropFilter: 'blur(8px)',
      boxShadow: T.shadow,
    }}>
      {tabs.map(({ id, label, icon }) => {
        const active_ = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`sr2-tab${active_ ? ' active' : ''}`}
            style={{
              padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: active_
                ? `linear-gradient(135deg, ${T.purple}, ${T.purpleMid})`
                : 'transparent',
              color: active_ ? T.white : T.textSec,
              fontWeight: active_ ? 700 : 500, fontSize: 13,
              boxShadow: active_ ? `0 4px 14px ${T.purpleGlow}` : 'none',
              letterSpacing: 0.2,
            }}
          >
            <span style={{ marginRight: 6 }}>{icon}</span>{label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress bar
// ─────────────────────────────────────────────────────────────────────────────
function ProgressBar({ pct, color, h = 6 }) {
  return (
    <div style={{ height: h, background: `${color}20`, borderRadius: h, overflow: 'hidden' }}>
      <div
        className="sr2-bar-fill"
        style={{
          height: '100%', width: `${pct}%`, borderRadius: h,
          background: `linear-gradient(90deg, ${color}cc, ${color})`,
          boxShadow: `0 0 8px ${color}60`,
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sprint Column (Página 1)
// ─────────────────────────────────────────────────────────────────────────────
function SprintCol({ title, accentGrad, items_data, sprintsCalendar, currentSprint, delay = 0 }) {
  return (
    <Card delay={delay} style={{ flex: 1, minWidth: 0 }}>
      {/* Header com gradiente */}
      <div style={{
        padding: '14px 18px',
        background: accentGrad,
        borderBottom: `1px solid ${T.border}`,
      }}>
        <span style={{ color: T.white, fontWeight: 800, fontSize: 14, letterSpacing: -0.3 }}>{title}</span>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {items_data.map(({ sectionTitle, items, kind, color }) => {
          const cal = sprintsCalendar?.[currentSprint];
          return (
            <div key={sectionTitle} style={{ marginBottom: 16 }}>
              <SectionLabel text={`${sectionTitle} · ${items.length}`} color={color} />
              {items.length === 0
                ? <Empty />
                : items.map((it, i) => {
                    let badge, badgeColor, extra, extraColor, accent, bg;

                    if (kind === 'upstream') {
                      badge = cal ? `até ${fmtDate(cal.end)}` : 'UP';
                      badgeColor = T.purpleMid; accent = T.yellow;
                    } else if (kind === 'downstream') {
                      badge = it.end ? fmtDate(it.end) : 'DN';
                      badgeColor = T.purpleMid; accent = T.purpleMid;
                      if (it._atraso) { extra = `↻ ${it._atraso}d`; extraColor = T.orange; }
                    } else if (kind === 'homolog') {
                      const d = it._dias_homolog;
                      badge = d != null ? (d > 15 ? `⚠ ${d}d` : `${d}d`) : 'Hom.';
                      badgeColor = d > 15 ? T.red : T.orange; accent = T.orange;
                    } else if (kind === 'done') {
                      badge = it.implant ? fmtFull(it.implant) : '✓';
                      badgeColor = T.green; accent = T.green; bg = T.greenLight;
                    } else if (kind === 'next_homolog') {
                      badge = it._badge || 'Hom.'; badgeColor = T.orange; accent = T.orange;
                    }

                    return (
                      <ItemRow key={it.key + kind} item={it}
                        badge={badge} badgeColor={badgeColor}
                        accent={accent} extra={extra} extraColor={extraColor}
                        bg={bg} delay={i * 30}
                      />
                    );
                  })}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sprint Calendar (rodapé pág 1)
// ─────────────────────────────────────────────────────────────────────────────
function CalendarStrip({ sprintsCalendar, currentSprint, nextSprint }) {
  const visible = ['26.2.4','26.2.5','26.2.6','26.3.1','26.3.2','26.3.3','26.3.4','26.3.5','26.3.6']
    .filter((sp) => sprintsCalendar[sp]);

  const piSprints = { '26.2': [], '26.3': [] };
  visible.forEach((sp) => { const p = sp.slice(0,4); if (piSprints[p]) piSprints[p].push(sp); });

  return (
    <Card delay={300} style={{ padding: '14px 16px', marginTop: 14 }}>
      <SectionLabel text="Calendário PI 26.2 → 26.3" color={T.purple} icon="📅" />
      <div style={{ display: 'flex', gap: 4 }}>
        {visible.map((sp, idx) => {
          const isCur = sp === currentSprint;
          const isNxt = sp === nextSprint;
          const cal   = sprintsCalendar[sp];
          const pi    = sp.slice(0,4);
          const col   = pi === '26.2' ? T.purple : T.purpleMid;

          return (
            <div
              key={sp}
              className="sr2-fade-up"
              style={{
                flex: 1, borderRadius: 10, padding: '8px 4px', textAlign: 'center',
                background: isCur
                  ? `linear-gradient(135deg, ${T.purple}, ${T.purpleMid})`
                  : isNxt ? T.yellowLight
                  : T.purpleLight,
                border: isCur
                  ? 'none'
                  : `1.5px solid ${isNxt ? T.yellow+'44' : col+'20'}`,
                boxShadow: isCur
                  ? `0 4px 16px ${T.purpleGlow}`
                  : isNxt ? `0 2px 8px ${T.yellowGlow}` : 'none',
                position: 'relative',
                animationDelay: `${idx * 40}ms`,
                transition: 'transform 0.15s ease',
              }}
            >
              <div style={{
                fontSize: 9.5, fontWeight: 800,
                color: isCur ? T.white : isNxt ? T.yellow : col,
              }}>{sp}</div>
              {cal && (
                <div style={{ fontSize: 8, color: isCur ? 'rgba(255,255,255,0.65)' : T.textMut, marginTop: 2 }}>
                  {fmtDate(cal.start)}-{fmtDate(cal.end)}
                </div>
              )}
              {isCur && (
                <div className="sr2-pulse" style={{
                  position: 'absolute', top: 5, right: 5, width: 7, height: 7,
                  borderRadius: '50%', background: T.yellow,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PI Metrics sidebar (pág 2)
// ─────────────────────────────────────────────────────────────────────────────
function PiSidebar({ piMetrics, cls, delay = 0 }) {
  const piList = ['26.1','26.2','26.3','26.4'];
  const piColors = { '26.1': T.textMut, '26.2': T.purple, '26.3': T.purpleMid, '26.4': '#9B59B6' };

  return (
    <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {piList.map((pi, i) => {
        const [ent, plan] = piMetrics?.[pi] || [0,0];
        const pct = plan > 0 ? Math.min(100, Math.round((ent/plan)*100)) : (ent > 0 ? 100 : 0);
        const color = piColors[pi];
        return (
          <Card key={pi} delay={delay + i * 60} style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ color: T.textSec, fontSize: 12, fontWeight: 700 }}>PI {pi}</span>
              <span style={{ color, fontWeight: 800, fontSize: 14 }}>
                {pi === '26.1' ? `${ent}` : `${ent}/${plan}`}
              </span>
            </div>
            <ProgressBar pct={pct} color={color} h={7} />
            {pi !== '26.1' && (
              <div style={{ fontSize: 10, color: T.textMut, marginTop: 5 }}>{pct}% entregue</div>
            )}
          </Card>
        );
      })}

      <Card delay={delay + 280} style={{ padding: '14px 16px' }}>
        <SectionLabel text="Visão Geral" color={T.purple} />
        {[
          ['Finalizados',       cls.finalizados.length,              T.green],
          ['Sem priorização',   cls.sem_priorizacao.length,          T.red],
          ['Backlog planejado', cls.backlog_planejado?.length || 0,  T.yellow],
        ].map(([l, v, c], i) => (
          <div key={l} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 10, gap: 8,
          }}>
            <span style={{ fontSize: 11, color: T.textSec }}>{l}</span>
            <AnimatedNumber value={v} color={c} size={20} />
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gantt moderno
// ─────────────────────────────────────────────────────────────────────────────
function ModernGantt({ items, sprintsCalendar, sprintOrder, currentSprint, nextSprint, today }) {
  if (!items?.length) return <Empty label="Nenhum épico no cronograma." />;

  const curIdx = sprintOrder.indexOf(currentSprint);
  let endIdx   = curIdx + 5;
  for (const it of items) {
    if (!it.end) continue;
    const endD = new Date(it.end);
    for (let i = curIdx; i < sprintOrder.length; i++) {
      if (endD <= new Date(sprintsCalendar[sprintOrder[i]]?.end)) {
        endIdx = Math.max(endIdx, i + 1); break;
      }
    }
  }
  endIdx  = Math.min(endIdx, sprintOrder.length - 1);
  const visible = sprintOrder.slice(curIdx, endIdx + 1);

  const piColors = { '26.2': T.purple, '26.3': T.purpleMid, '26.4': '#9B59B6' };
  const piGroups = [];
  let lastPi = null;
  for (const sp of visible) {
    const pi = sp.slice(0,4);
    if (pi !== lastPi) { piGroups.push({ pi, count: 1 }); lastPi = pi; }
    else piGroups[piGroups.length-1].count++;
  }

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

  // Linha HOJE
  const todayD   = new Date(today);
  const curCal   = sprintsCalendar[currentSprint];
  const curVisIdx = visible.indexOf(currentSprint);
  let todayPct   = null;
  if (curCal && curVisIdx >= 0) {
    const frac = Math.min(1, Math.max(0,
      (todayD - new Date(curCal.start)) / (new Date(curCal.end) - new Date(curCal.start))
    ));
    todayPct = ((curVisIdx + frac) / visible.length) * 100;
  }

  const LABEL_W = 72;
  const rowH    = Math.max(22, Math.min(28, 300 / items.length));

  const barStyle = {
    UP: { bg: `linear-gradient(90deg, ${T.purple}, ${T.purpleMid})`, shadow: T.purpleGlow },
    DN: { bg: `linear-gradient(90deg, ${T.purpleMid}, #9B59B6)`,     shadow: T.purpleGlow },
    HM: { bg: `linear-gradient(90deg, ${T.orange}, #FFAB00)`,        shadow: T.orangeGlow },
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* PI header */}
      <div style={{ display: 'flex', marginLeft: LABEL_W, gap: 2, marginBottom: 3 }}>
        {piGroups.map(({ pi, count }) => (
          <div key={pi} style={{
            flex: count, textAlign: 'center', padding: '4px 0',
            fontSize: 10, fontWeight: 700, color: T.white,
            background: piColors[pi] || T.textMut,
            borderRadius: '6px 6px 0 0',
          }}>PI {pi}</div>
        ))}
      </div>

      {/* Sprint headers */}
      <div style={{ display: 'flex', marginLeft: LABEL_W, borderBottom: `2px solid ${T.border}` }}>
        {visible.map((sp) => (
          <div key={sp} style={{
            flex: 1, textAlign: 'center', padding: '4px 2px', fontSize: 9.5,
            color: sp === currentSprint ? T.purple : T.textMut,
            fontWeight: sp === currentSprint ? 800 : 400,
            background: sp === currentSprint ? T.purpleLight
              : sp === nextSprint ? T.yellowLight : 'transparent',
          }}>{sp}</div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ position: 'relative' }}>
        {todayPct !== null && (
          <div style={{
            position: 'absolute', top: 0, bottom: 0, zIndex: 3,
            left: `calc(${LABEL_W}px + ${todayPct}%)`,
            borderLeft: `2px dashed ${T.red}80`,
            pointerEvents: 'none',
          }}>
            <span style={{
              position: 'absolute', top: -18, left: 4,
              fontSize: 9, color: T.red, fontWeight: 700, whiteSpace: 'nowrap',
              background: T.redLight, padding: '1px 5px', borderRadius: 4,
            }}>HOJE</span>
          </div>
        )}

        {items.map((it, rowIdx) => {
          const si = colOf(it.start);
          const ei = colOf(it.end);
          return (
            <div key={it.key} className="sr2-fade-up" style={{
              display: 'flex', height: rowH, alignItems: 'center',
              borderBottom: `1px solid ${T.border}`,
              animationDelay: `${rowIdx * 25}ms`,
            }}>
              <div style={{
                width: LABEL_W, flexShrink: 0, paddingRight: 8, textAlign: 'right',
              }}>
                <a href={`${JIRA}/browse/${it.key}`} target="_blank" rel="noreferrer"
                  style={{ color: T.purpleMid, fontSize: 10, fontWeight: 700, textDecoration: 'none' }}>
                  {it.key}
                </a>
              </div>

              {visible.map((sp, i) => {
                const isCur = sp === currentSprint;
                const isNxt = sp === nextSprint;
                let cellBg = isCur ? T.purpleLight : isNxt ? T.yellowLight : 'transparent';
                let bar    = null;

                if (si !== null && i === si) bar = 'UP';
                if (ei !== null) {
                  const dnStart = (si !== null && ei > si) ? si+1 : (si ?? ei);
                  if (i >= dnStart && i <= ei) bar = 'DN';
                  if (i === ei+1 && i < visible.length) bar = 'HM';
                }

                return (
                  <div key={sp} style={{
                    flex: 1, height: '100%', background: cellBg,
                    borderRight: `1px solid ${T.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '3px 2px',
                  }}>
                    {bar && (
                      <div className="sr2-bar-fill" style={{
                        width: '88%', height: rowH * 0.52,
                        background: barStyle[bar].bg,
                        borderRadius: 5,
                        boxShadow: `0 2px 8px ${barStyle[bar].shadow}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {rowH >= 18 && (
                          <span style={{ color: T.white, fontSize: 8, fontWeight: 800 }}>{bar}</span>
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

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
        {Object.entries(barStyle).map(([key, { bg }]) => {
          const labels = { UP:'Upstream', DN:'Downstream', HM:'Homologação' };
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 22, height: 8, background: bg, borderRadius: 3 }} />
              <span style={{ fontSize: 10.5, color: T.textSec }}>{key} — {labels[key]}</span>
            </div>
          );
        })}
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
  const BAR_H = 90;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: BAR_H + 44, paddingTop: 20 }}>
      {sprints.map((sp, idx) => {
        const items  = bySprintData[sp] || [];
        const total  = items.length;
        const res    = items.filter((i) => i.termino_dt).length;
        const open   = total - res;
        const isCur  = sp === currentSprint;
        const resH   = total ? (res  / maxTotal) * BAR_H : 0;
        const openH  = open  ? Math.max(8, (open / maxTotal) * BAR_H) : 0;
        const pct    = total ? Math.round((open/total)*100) : 0;

        return (
          <div key={sp} className="sr2-fade-up" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', animationDelay: `${idx*60}ms` }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: T.textPrim, marginBottom: 4 }}>{total}</span>
            <div style={{
              width: '68%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
              height: BAR_H, borderRadius: 8, overflow: 'hidden',
              outline: isCur ? `2.5px solid ${T.purple}` : 'none',
              outlineOffset: 2,
              boxShadow: isCur ? `0 4px 16px ${T.purpleGlow}` : T.shadow,
            }}>
              {openH > 0 && (
                <div className="sr2-bar-fill" style={{
                  background: `linear-gradient(180deg, ${T.orange}, ${T.orange}bb)`,
                  height: openH,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {openH >= 14 && <span style={{ color: T.white, fontSize: 9, fontWeight: 700 }}>{pct}%</span>}
                </div>
              )}
              {resH > 0 && (
                <div className="sr2-bar-fill" style={{
                  background: `linear-gradient(180deg, ${T.green}, ${T.green}bb)`,
                  height: resH,
                }} />
              )}
            </div>
            <span style={{
              fontSize: 9.5, marginTop: 6,
              color: isCur ? T.purple : T.textMut,
              fontWeight: isCur ? 800 : 400,
            }}>{sp}</span>
          </div>
        );
      })}

      {/* Legenda */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 22, gap: 6, flexShrink: 0 }}>
        {[[T.green,'Resolvidos'],[T.orange,'Em aberto']].map(([c,l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, background: c, borderRadius: 3 }} />
            <span style={{ fontSize: 10, color: T.textSec }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Incident table
// ─────────────────────────────────────────────────────────────────────────────
function IncidentTable({ incidents, currentSprint }) {
  const rows = incidents
    .filter((i) => i.sprints.includes(currentSprint))
    .sort((a,b) => new Date(b.created_dt||0) - new Date(a.created_dt||0));

  if (!rows.length) return <Empty label="Nenhum incidente na sprint atual." />;

  const cols = [
    {l:'Incidente',    w:'10%'}, {l:'Sprint',      w:'8%'},
    {l:'Criado',       w:'11%'}, {l:'Término Real', w:'11%'},
    {l:'Tempo Res.',   w:'8%' }, {l:'SLA',          w:'6%'},
    {l:'Descrição',    w:'36%'}, {l:'Status',       w:'10%'},
  ];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: T.purpleLight }}>
            {cols.map((c) => (
              <th key={c.l} style={{
                width: c.w, padding: '9px 10px', textAlign: 'left',
                color: T.purple, fontWeight: 700, fontSize: 10, letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}>{c.l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((inc, idx) => {
            const isDragged = inc.sprints.length > 1 && inc.sprints[0] !== currentSprint;
            const spLabel = isDragged ? `⚑ ${inc.sprints.at(-1)||'-'}` : (inc.sprints.at(-1)||'-');
            let tempo = '-';
            if (inc.created_dt && inc.termino_dt) {
              const hrs = (new Date(inc.termino_dt) - new Date(inc.created_dt)) / 3600000;
              tempo = `${hrs.toFixed(1)}h`;
            }
            return (
              <tr key={inc.key} className="sr2-item" style={{
                background: isDragged ? T.redLight : idx%2===0 ? 'rgba(82,25,161,0.025)' : 'transparent',
                borderBottom: `1px solid ${T.border}`,
              }}>
                <td style={{ padding:'8px 10px', fontWeight:700, fontSize:10 }}>
                  <a href={`${JIRA}/browse/${inc.key}`} target="_blank" rel="noreferrer"
                    style={{ color: T.purpleMid, textDecoration:'none' }}>
                    {inc.sn_id || inc.key}
                  </a>
                </td>
                <td style={{ padding:'8px 10px', color: isDragged ? T.red : T.textSec, fontSize:10 }}>{spLabel}</td>
                <td style={{ padding:'8px 10px', color:T.textSec, fontSize:10 }}>{fmtDT(inc.created_dt)}</td>
                <td style={{ padding:'8px 10px', color:T.textSec, fontSize:10 }}>{fmtDT(inc.termino_dt)}</td>
                <td style={{ padding:'8px 10px', color:T.textSec, fontSize:10 }}>{tempo}</td>
                <td style={{ padding:'8px 10px' }}>
                  {inc.sla_met === true  && <Chip text="✓ OK"    color={T.green}  />}
                  {inc.sla_met === false && <Chip text="✗ Viola" color={T.red}    />}
                  {inc.sla_met === null  && <span style={{color:T.textMut}}>—</span>}
                </td>
                <td style={{ padding:'8px 10px', color:T.textSec, maxWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {inc.summary}
                </td>
                <td style={{ padding:'8px 10px' }}>
                  <Chip text={inc.status} color={T.purpleMid} size={10} bold={false} />
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
// Main
// ─────────────────────────────────────────────────────────────────────────────
export default function StatusReportV2() {
  const [area,       setArea]       = useState('G&C');
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [tab,        setTab]        = useState('sprint');
  const [pdfLoading, setPdfLoading] = useState(false);
  const reportRef = useRef(null);

  const load = useCallback(async (a) => {
    setLoading(true); setError(null); setData(null);
    try { setData(await getStatusReport(a)); }
    catch (e) { setError(e.response?.data?.error || e.message || 'Erro ao carregar'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(area); }, [area]);

  const downloadPdf = async () => {
    if (!reportRef.current) return;
    setPdfLoading(true);
    try {
      await html2pdf().set({
        margin: 0,
        filename: `StatusReport_v2_${area}_${data?.today?.replace(/-/g,'') || 'export'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      }).from(reportRef.current).save();
    } finally { setPdfLoading(false); }
  };

  const { classification:cls, current_sprint, next_sprint, today,
    sprints_calendar, sprint_order, pi_metrics,
    incidents, incidents_summary, incidents_by_sprint, has_incidents_page } = data || {};

  const tabs = [
    { id:'sprint',     label:'Sprint',     icon:'⚡' },
    { id:'cronograma', label:'Cronograma', icon:'📈' },
    ...(has_incidents_page ? [{ id:'incidentes', label:'Incidentes', icon:'🚨' }] : []),
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: T.pageBg,
      margin: '-32px -24px',
      padding: '28px 28px 48px',
      fontFamily: "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif",
      color: T.textPrim,
    }}>
      <style>{STYLES}</style>

      {/* ── Header ── */}
      <div className="no-print sr2-fade-in" style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24, flexWrap:'wrap' }}>
        <div>
          <div style={{
            fontSize: 26, fontWeight: 900, letterSpacing: -0.8,
            background: `linear-gradient(135deg, ${T.purple}, ${T.purpleMid})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Status Report
          </div>
          <div style={{ fontSize: 11, color: T.textMut, marginTop: 1, letterSpacing: 0.3 }}>
            Versão Moderna · Cogna Educação
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Area select */}
        <select value={area} onChange={(e) => setArea(e.target.value)} style={{
          background: T.surfaceSol, color: T.textPrim,
          border: `1.5px solid ${T.border}`, borderRadius: 11,
          padding: '9px 14px', fontSize: 13, outline: 'none', cursor: 'pointer',
          boxShadow: T.shadow,
        }}>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        {/* Atualizar */}
        <button onClick={() => load(area)} disabled={loading} style={{
          background: `linear-gradient(135deg, ${T.purple}, ${T.purpleMid})`,
          color: T.white, border: 'none', borderRadius: 11, padding: '9px 18px',
          fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: `0 4px 16px ${T.purpleGlow}`, opacity: loading ? 0.7 : 1,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span className={loading ? 'sr2-spin' : ''} style={{ display: 'inline-block' }}>🔄</span>
          {loading ? 'Carregando…' : 'Atualizar'}
        </button>

        {/* PDF */}
        <button onClick={downloadPdf} disabled={!data || pdfLoading} style={{
          background: T.surfaceSol, color: T.textSec,
          border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '9px 18px',
          fontSize: 13, fontWeight: 600, cursor: !data || pdfLoading ? 'not-allowed' : 'pointer',
          boxShadow: T.shadow, opacity: !data || pdfLoading ? 0.55 : 1,
        }}>
          {pdfLoading ? '⏳ Gerando…' : '⬇️ Baixar PDF'}
        </button>

        {data && (
          <div style={{
            fontSize: 12, color: T.textSec, background: T.surfaceSol,
            padding: '8px 14px', borderRadius: 10,
            border: `1.5px solid ${T.border}`, boxShadow: T.shadow,
          }}>
            Sprint <strong style={{ color: T.purple }}>{current_sprint}</strong>
            <span style={{ margin:'0 6px', color: T.textMut }}>·</span>
            {today}
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="sr2-fade-up" style={{
          background: T.redLight, border: `1.5px solid ${T.red}44`,
          borderRadius: 14, padding: '14px 18px', marginBottom: 20, color: T.red, fontSize: 13,
        }}>⚠️ {error}</div>
      )}

      {/* ── Loading ── */}
      {loading && <LoadingState />}

      {/* ── Content ── */}
      {data && (
        <div ref={reportRef}>
          {/* Metric cards */}
          <div className="sr2-page" style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
            <StatCard delay={0}   label="Upstream"     value={cls.current_upstream.length + cls.next_upstream.length}
              color={T.yellow}  glow={T.yellowGlow} icon="🔼"
              sub={`${cls.current_upstream.length} atual · ${cls.next_upstream.length} próxima`} />
            <StatCard delay={60}  label="Downstream"   value={cls.current_downstream.length + cls.next_downstream.length}
              color={T.purpleMid} glow={T.purpleGlow} icon="🔽"
              sub={`${cls.current_downstream.length} atual · ${cls.next_downstream.length} próxima`} />
            <StatCard delay={120} label="Homologação"  value={cls.current_homolog.length}
              color={T.orange}  glow={T.orangeGlow} icon="🧪"
              sub={`${cls.next_homolog.length} prevista na próxima`} />
            <StatCard delay={180} label="Entregues"    value={cls.current_done.length}
              color={T.green}   glow={T.greenGlow}  icon="✅"
              sub={`${cls.finalizados.length} finalizados no total`} />
            {has_incidents_page && (
              <StatCard delay={240} label="Incidentes" value={incidents_summary.total}
                color={T.red}   glow={T.redGlow}    icon="🚨"
                sub={`${incidents_summary.aberto} em aberto · ${incidents_summary.sla_violado} SLA violado`} />
            )}
          </div>

          {/* Tabs */}
          <div className="no-print sr2-fade-up" style={{ marginBottom: 18, animationDelay:'280ms' }}>
            <TabBar active={tab} onChange={setTab} tabs={tabs} />
          </div>

          {/* ──── Tab: Sprint ──── */}
          {tab === 'sprint' && (
            <div className="sr2-page">
              <div style={{ display:'flex', gap:14, marginBottom:14 }}>
                <SprintCol
                  title={`⚡ Sprint Atual — ${current_sprint}`}
                  accentGrad={`linear-gradient(135deg, ${T.purple}, ${T.purpleMid})`}
                  sprintsCalendar={sprints_calendar}
                  currentSprint={current_sprint}
                  delay={0}
                  items_data={[
                    { sectionTitle:'Upstream',  items:cls.current_upstream,   kind:'upstream',    color:T.yellow     },
                    { sectionTitle:'Downstream',items:cls.current_downstream, kind:'downstream',  color:T.purpleMid  },
                    { sectionTitle:'Homologação',items:cls.current_homolog,   kind:'homolog',     color:T.orange     },
                    { sectionTitle:'Concluídos',items:cls.current_done,       kind:'done',        color:T.green      },
                  ]}
                />
                <SprintCol
                  title={`🔮 Próxima Sprint — ${next_sprint}`}
                  accentGrad={`linear-gradient(135deg, ${T.purpleMid}, #9B59B6)`}
                  sprintsCalendar={sprints_calendar}
                  currentSprint={current_sprint}
                  delay={80}
                  items_data={[
                    { sectionTitle:'Upstream',       items:cls.next_upstream,   kind:'upstream',     color:T.yellow  },
                    { sectionTitle:'Downstream',     items:cls.next_downstream, kind:'downstream',   color:T.purpleMid },
                    { sectionTitle:'Hom. Prevista',  items:cls.next_homolog,    kind:'next_homolog', color:T.orange  },
                  ]}
                />
              </div>
              <CalendarStrip sprintsCalendar={sprints_calendar} currentSprint={current_sprint} nextSprint={next_sprint} />
            </div>
          )}

          {/* ──── Tab: Cronograma ──── */}
          {tab === 'cronograma' && (
            <div className="sr2-page" style={{ display:'flex', gap:14 }}>
              <PiSidebar piMetrics={pi_metrics} cls={cls} delay={0} />
              <Card delay={100} style={{ flex:1, padding:18 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.textPrim, marginBottom:14 }}>
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
              </Card>
            </div>
          )}

          {/* ──── Tab: Incidentes ──── */}
          {tab === 'incidentes' && has_incidents_page && (
            <div className="sr2-page">
              <div style={{ display:'flex', gap:12, marginBottom:16 }}>
                <StatCard delay={0}   label="Total Sprint"  value={incidents_summary.total}       color={T.textSec}  icon="📋" />
                <StatCard delay={60}  label="Em Aberto"     value={incidents_summary.aberto}      color={T.red}    glow={T.redGlow}    icon="🔴" />
                <StatCard delay={120} label="Resolvidos"    value={incidents_summary.resolvidos}  color={T.green}  glow={T.greenGlow}  icon="✅" />
                <StatCard delay={180} label="SLA Violado"   value={incidents_summary.sla_violado} color={T.orange} glow={T.orangeGlow} icon="⏱️" />
              </div>

              <div style={{ display:'flex', gap:14 }}>
                <Card delay={100} style={{ width:260, flexShrink:0, padding:18 }}>
                  <SectionLabel text="Histórico por Sprint" color={T.red} icon="📊" />
                  <IncidentChart
                    bySprintData={incidents_by_sprint || {}}
                    currentSprint={current_sprint}
                    sprintOrder={sprint_order}
                  />
                </Card>

                <Card delay={160} style={{ flex:1, padding:18 }}>
                  <SectionLabel text={`Incidentes da Sprint Atual — ${current_sprint}`} color={T.red} icon="🚨" />
                  <IncidentTable incidents={incidents || []} currentSprint={current_sprint} />
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
