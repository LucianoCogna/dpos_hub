import { useState, useEffect, useRef } from 'react';
import { getStatusReport } from '../services/api';

// ── Brand Cogna ──────────────────────────────────────────────────────────────
const C = {
  purple:     '#5219A1',
  purpleMid:  '#7B3FD4',
  purpleSoft: '#EDE5F5',
  yellow:     '#FFAD01',
  dark:       '#2F3136',
  gray:       '#D7DBDD',
  grayMid:    '#9AA0A6',
  grayDark:   '#5F6368',
  green:      '#01C949',
  greenSoft:  '#E6F9EE',
  greenDark:  '#1B7A3E',
  orange:     '#F58220',
  orangeSoft: '#FEF0E6',
  red:        '#E53935',
  redSoft:    '#FDECEA',
  bg:         '#F8F6FC',
  white:      '#ffffff',
};

const AREAS = [
  'G&C', 'CAPTACAO_ANALITICA', 'REVENUE', 'ROTINAS_FINANCEIRAS',
  'DMC', 'REVENUE_STRATEGY', 'RVV', 'REPASSE',
  'ALIANCA_1_SOMOS', 'ALIANCA_1_SABER', 'Plurall',
];

const JIRA_BASE = 'https://cogna.atlassian.net';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s) {
  if (!s) return '-';
  return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function fmtDateFull(s) {
  if (!s) return '-';
  return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function fmtDateTime(s) {
  if (!s) return '-';
  const d = new Date(s);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Sidebar({ color, children }) {
  return (
    <div className="no-print-break" style={{
      width: 150, minWidth: 150, background: color,
      borderRadius: '8px 0 0 8px', padding: '20px 14px',
      display: 'flex', flexDirection: 'column', gap: 0,
    }}>
      {children}
    </div>
  );
}

function SidebarTitle({ text }) {
  return (
    <div style={{ color: C.white, fontWeight: 700, fontSize: 8.5, marginBottom: 4, marginTop: 16 }}>
      {text}
    </div>
  );
}

function SidebarDivider({ color = 'rgba(255,255,255,0.25)' }) {
  return <div style={{ height: 1, background: color, margin: '2px 0 8px 0' }} />;
}

function SidebarIndicator({ label, value, dotColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <span style={{ color: C.white, fontSize: 7.5, flex: 1 }}>{label}</span>
      <span style={{ color: C.white, fontWeight: 700, fontSize: 9 }}>{value}</span>
    </div>
  );
}

function Badge({ text, bg = C.purpleMid, color = C.white, size = 7 }) {
  if (!text) return null;
  return (
    <span style={{
      background: bg, color, fontSize: size, fontWeight: 700,
      padding: '1px 6px', borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0,
    }}>{text}</span>
  );
}

function SectionHeader({ title, bg = C.purple }) {
  return (
    <div style={{
      background: bg, color: C.white, fontWeight: 700, fontSize: 8.5,
      padding: '3px 10px', borderRadius: 4, marginBottom: 4,
    }}>{title}</div>
  );
}

function SubHeader({ title, count }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, marginTop: 8 }}>
      <span style={{ color: C.grayDark, fontWeight: 700, fontSize: 8 }}>{title}</span>
      <span style={{ color: C.grayMid, fontSize: 7.5 }}>{count}</span>
    </div>
  );
}

function ItemRow({ item, badgeText, badgeBg, accentColor, extraBadge, extraBadgeBg, bg }) {
  const url = `${JIRA_BASE}/browse/${item.key}`;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 8px 4px 10px', marginBottom: 2, borderRadius: 3,
      background: bg || 'transparent',
      borderLeft: `3px solid ${accentColor || C.purpleMid}`,
      minHeight: 22,
    }}>
      <a href={url} target="_blank" rel="noreferrer"
        style={{ color: C.purpleMid, fontWeight: 700, fontSize: 8, flexShrink: 0, textDecoration: 'none' }}>
        {item.key}
      </a>
      <span style={{ color: C.grayDark, fontSize: 7.5, flex: 1, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.summary}>
        {item.summary}
      </span>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {extraBadge && <Badge text={extraBadge} bg={extraBadgeBg || C.orange} />}
        {badgeText && <Badge text={badgeText} bg={badgeBg || C.purpleMid} />}
      </div>
    </div>
  );
}

function EmptyRow({ label = 'Nenhum item' }) {
  return (
    <p style={{ color: C.grayMid, fontSize: 7.5, fontStyle: 'italic', padding: '4px 10px' }}>{label}</p>
  );
}

// ── Gantt chart ───────────────────────────────────────────────────────────────

function GanttChart({ items, sprintsCalendar, sprintOrder, currentSprint, nextSprint, today }) {
  if (!items || items.length === 0) {
    return <p style={{ color: C.grayMid, fontSize: 8, fontStyle: 'italic' }}>Nenhum épico no cronograma.</p>;
  }

  const curIdx = sprintOrder.indexOf(currentSprint);

  // range dinâmico: da sprint atual até cobrir última data de entrega
  let endIdx = curIdx + 5;
  for (const it of items) {
    if (!it.end) continue;
    const endD = new Date(it.end);
    for (let i = curIdx; i < sprintOrder.length; i++) {
      const sp = sprintOrder[i];
      const spEnd = new Date(sprintsCalendar[sp]?.end);
      if (endD <= spEnd) { endIdx = Math.max(endIdx, i + 1); break; }
    }
  }
  endIdx = Math.min(endIdx, sprintOrder.length - 1);
  const visibleSprints = sprintOrder.slice(curIdx, endIdx + 1);

  // PI groups
  const piGroups = [];
  let lastPi = null;
  for (const sp of visibleSprints) {
    const pi = sp.slice(0, 4);
    if (pi !== lastPi) { piGroups.push({ pi, count: 1 }); lastPi = pi; }
    else piGroups[piGroups.length - 1].count++;
  }
  const piColors = { '26.2': C.purple, '26.3': C.purpleMid, '26.4': '#B89AE8' };

  const colW = Math.max(44, Math.floor(340 / visibleSprints.length));
  const labelW = 60;

  function sprintIdxInView(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    for (let i = 0; i < visibleSprints.length; i++) {
      const sp = visibleSprints[i];
      const cal = sprintsCalendar[sp];
      if (!cal) continue;
      if (d >= new Date(cal.start) && d <= new Date(cal.end)) return i;
    }
    if (d < new Date(sprintsCalendar[visibleSprints[0]]?.start)) return 0;
    if (d > new Date(sprintsCalendar[visibleSprints[visibleSprints.length - 1]]?.end)) return visibleSprints.length - 1;
    return null;
  }

  // TODAY line position
  const todayD = new Date(today);
  let todayPct = null;
  const curSprintCal = sprintsCalendar[currentSprint];
  if (curSprintCal && sprintOrder.indexOf(currentSprint) >= curIdx) {
    const s = new Date(curSprintCal.start);
    const e = new Date(curSprintCal.end);
    const frac = Math.min(1, Math.max(0, (todayD - s) / (e - s)));
    const curVisIdx = visibleSprints.indexOf(currentSprint);
    todayPct = ((curVisIdx + frac) / visibleSprints.length) * 100;
  }

  const rowH = Math.max(14, Math.min(20, 280 / items.length));
  const fontSize = Math.max(5, Math.min(6.5, rowH * 0.5));

  return (
    <div style={{ fontSize: 7, overflowX: 'auto' }}>
      <div style={{ display: 'flex', minWidth: labelW + colW * visibleSprints.length }}>
        {/* PI header */}
        <div style={{ width: labelW, flexShrink: 0 }} />
        <div style={{ display: 'flex', flex: 1 }}>
          {piGroups.map(({ pi, count }) => (
            <div key={pi} style={{
              width: colW * count, background: piColors[pi] || C.grayMid,
              color: C.white, fontWeight: 700, fontSize: 6.5,
              textAlign: 'center', padding: '2px 0', borderRadius: '3px 3px 0 0',
            }}>PI {pi}</div>
          ))}
        </div>
      </div>

      {/* Sprint column headers */}
      <div style={{ display: 'flex', minWidth: labelW + colW * visibleSprints.length }}>
        <div style={{ width: labelW, flexShrink: 0 }} />
        {visibleSprints.map((sp) => (
          <div key={sp} style={{
            width: colW, fontSize: 5.5, textAlign: 'center', color: C.grayDark,
            padding: '1px 0', borderRight: `1px solid ${C.gray}`,
            background: sp === currentSprint ? C.purpleSoft : sp === nextSprint ? '#FFF3D6' : 'transparent',
          }}>{sp}</div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ position: 'relative' }}>
        {todayPct !== null && (
          <div style={{
            position: 'absolute', left: `calc(${labelW}px + ${todayPct}%)`,
            top: 0, bottom: 0, width: 1, background: C.red, zIndex: 2,
            borderLeft: '1px dashed ' + C.red,
          }} />
        )}

        {items.map((it) => {
          const si = sprintIdxInView(it.start);
          const ei = sprintIdxInView(it.end);

          return (
            <div key={it.key} style={{
              display: 'flex', height: rowH, alignItems: 'center',
              borderBottom: `1px solid ${C.gray}`,
              minWidth: labelW + colW * visibleSprints.length,
            }}>
              <div style={{
                width: labelW, flexShrink: 0, paddingLeft: 4,
                fontWeight: 700, fontSize: 6.5, color: C.dark,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                <a href={`${JIRA_BASE}/browse/${it.key}`} target="_blank" rel="noreferrer"
                  style={{ color: C.purpleMid, textDecoration: 'none' }}>{it.key}</a>
              </div>

              {visibleSprints.map((sp, i) => {
                const isCurrent = sp === currentSprint;
                const isNext = sp === nextSprint;
                let cellBg = isCurrent ? C.purpleSoft : isNext ? '#FFF3D6' : 'transparent';
                let barBg = null;
                let barLabel = null;

                if (si !== null && i === si) { barBg = C.purpleMid; barLabel = 'UP'; }
                if (ei !== null) {
                  const dnStart = si !== null && ei > si ? si + 1 : (si !== null ? si : ei);
                  if (i >= dnStart && i <= ei) { barBg = C.purple; barLabel = 'DN'; }
                  if (i === ei + 1 && i < visibleSprints.length) { barBg = C.orange; barLabel = 'HM'; }
                }

                return (
                  <div key={sp} style={{
                    width: colW, height: '100%', background: cellBg,
                    borderRight: `1px solid ${C.gray}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '2px',
                  }}>
                    {barBg && (
                      <div style={{
                        background: barBg, color: C.white,
                        borderRadius: 3, width: '90%', height: rowH * 0.6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize, fontWeight: 700,
                      }}>{rowH >= 12 ? barLabel : ''}</div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 6 }}>
        {[['UP - Upstream', C.purpleMid], ['DN - Downstream', C.purple], ['HM - Homologação', C.orange]].map(([l, col]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 8, background: col, borderRadius: 2 }} />
            <span style={{ color: C.dark }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bar chart (incidentes) ───────────────────────────────────────────────────

function IncidentBarChart({ bySprintData, currentSprint, sprintOrder }) {
  const sprints = [...sprintOrder]
    .filter((sp) => bySprintData[sp])
    .slice(-6);

  if (sprints.length === 0) return <p style={{ color: C.grayMid, fontSize: 8, fontStyle: 'italic' }}>Sem dados de incidentes.</p>;

  const maxTotal = Math.max(1, ...sprints.map((sp) => bySprintData[sp]?.length || 0));
  const barH = 80;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: barH + 30, paddingTop: 16 }}>
      {sprints.map((sp) => {
        const items = bySprintData[sp] || [];
        const total = items.length;
        const resolvidos = items.filter((i) => i.termino_dt).length;
        const aberto = total - resolvidos;
        const isCurrent = sp === currentSprint;
        const resolvedH = total > 0 ? (resolvidos / maxTotal) * barH : 0;
        const openH = total > 0 ? Math.max(aberto > 0 ? 6 : 0, (aberto / maxTotal) * barH) : 0;
        const pct = total > 0 ? Math.round((aberto / total) * 100) : 0;

        return (
          <div key={sp} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 7, fontWeight: 700, color: C.dark, marginBottom: 2 }}>{total}</span>
            <div style={{
              width: '70%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
              height: barH,
              outline: isCurrent ? `1.5px dashed ${C.purple}` : 'none',
              outlineOffset: 2,
            }}>
              {openH > 0 && (
                <div style={{
                  background: C.orange, height: openH, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {openH >= 10 && <span style={{ color: C.white, fontSize: 6, fontWeight: 700 }}>{pct}%</span>}
                </div>
              )}
              {resolvedH > 0 && (
                <div style={{ background: C.green, height: resolvedH }} />
              )}
            </div>
            <span style={{ fontSize: 6, color: C.grayDark, marginTop: 4 }}>{sp}</span>
          </div>
        );
      })}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 18, gap: 4 }}>
        {[['Resolvidos', C.green], ['Em aberto', C.orange]].map(([l, col]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, background: col }} />
            <span style={{ fontSize: 6, color: C.dark }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page sections ─────────────────────────────────────────────────────────────

function PageWrapper({ children, pageNum }) {
  return (
    <div className="status-page" style={{
      background: C.bg, borderRadius: 8, marginBottom: 24,
      overflow: 'hidden', display: 'flex', boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
      pageBreakAfter: 'always',
    }}>
      {children}
    </div>
  );
}

function PageContent({ children }) {
  return (
    <div style={{ flex: 1, padding: '12px 14px', overflow: 'hidden' }}>
      {children}
    </div>
  );
}

// ── Column builder for page 1 ─────────────────────────────────────────────────

function SprintColumn({ title, headerBg, items_data, sprintsCalendar, currentSprint }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        background: headerBg, color: C.white, fontWeight: 700, fontSize: 9,
        padding: '5px 10px', borderRadius: 4, marginBottom: 8,
      }}>{title}</div>

      {items_data.map(({ sectionTitle, items, kind }) => (
        <div key={sectionTitle} style={{ marginBottom: 10 }}>
          <SubHeader title={sectionTitle} count={items.length} />
          {items.length === 0
            ? <EmptyRow />
            : items.map((it) => {
                let badgeText = null;
                let badgeBg = C.purpleMid;
                let accentColor = C.purpleMid;
                let extraBadge = null;
                let extraBadgeBg = null;
                let bg = null;

                if (kind === 'upstream') {
                  const cal = sprintsCalendar[currentSprint];
                  badgeText = cal ? `até ${fmtDate(cal.end)}` : 'upstream';
                  badgeBg = C.purpleMid;
                  accentColor = C.yellow;
                } else if (kind === 'downstream') {
                  badgeText = it.end ? fmtDate(it.end) : 'DN';
                  badgeBg = C.purple;
                  accentColor = C.purple;
                  if (it._atraso) { extraBadge = `↻ Tombou ${it._atraso}d`; extraBadgeBg = C.orange; }
                } else if (kind === 'homolog') {
                  const d = it._dias_homolog;
                  if (d !== null && d !== undefined) {
                    badgeText = d > 15 ? `⚠ ${d}d` : `${d}d`;
                    badgeBg = d > 15 ? C.red : C.orange;
                  } else {
                    badgeText = 'em hom.'; badgeBg = C.orange;
                  }
                  accentColor = C.orange;
                } else if (kind === 'done') {
                  badgeText = it.implant ? fmtDateFull(it.implant) : '✓';
                  badgeBg = C.green; accentColor = C.green; bg = C.greenSoft;
                } else if (kind === 'next_homolog') {
                  badgeText = it._badge || 'Hom.';
                  badgeBg = C.orange; accentColor = C.orange;
                }

                return (
                  <ItemRow key={it.key + kind} item={it}
                    badgeText={badgeText} badgeBg={badgeBg}
                    accentColor={accentColor}
                    extraBadge={extraBadge} extraBadgeBg={extraBadgeBg}
                    bg={bg} />
                );
              })}
        </div>
      ))}
    </div>
  );
}

// ── Incidents table ───────────────────────────────────────────────────────────

function IncidentsTable({ incidents, currentSprint }) {
  const current = incidents
    .filter((i) => i.sprints.includes(currentSprint))
    .sort((a, b) => new Date(b.created_dt || 0) - new Date(a.created_dt || 0));

  if (current.length === 0) {
    return <p style={{ color: C.grayMid, fontSize: 8, fontStyle: 'italic', padding: '8px 0' }}>Nenhum incidente na sprint atual.</p>;
  }

  const cols = [
    { label: 'Incidente', w: '11%' }, { label: 'Sprint', w: '8%' },
    { label: 'Criado', w: '10%' },    { label: 'Término Real', w: '10%' },
    { label: 'Tempo Res.', w: '8%' }, { label: 'SLA', w: '6%' },
    { label: 'Descrição', w: '37%' }, { label: 'Status', w: '10%' },
  ];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 7 }}>
        <thead>
          <tr style={{ background: C.purpleSoft }}>
            {cols.map((col) => (
              <th key={col.label} style={{
                width: col.w, padding: '4px 6px', textAlign: 'left',
                color: C.purple, fontWeight: 700, fontSize: 6.5,
              }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {current.map((inc) => {
            const isDragged = inc.sprints.length > 1 && inc.sprints[0] !== currentSprint;
            const spLabel = isDragged ? `⚑ ${inc.sprints[inc.sprints.length - 1] || '-'}` : (inc.sprints[inc.sprints.length - 1] || '-');

            let tempoRes = '-';
            if (inc.created_dt && inc.termino_dt) {
              const hrs = (new Date(inc.termino_dt) - new Date(inc.created_dt)) / 3600000;
              tempoRes = `${hrs.toFixed(1)}h`;
            }

            return (
              <tr key={inc.key} style={{
                background: isDragged ? C.redSoft : 'transparent',
                borderBottom: `1px solid ${C.gray}`,
              }}>
                <td style={{ padding: '3px 6px', fontWeight: 700, color: C.dark }}>
                  {inc.sn_id || inc.key}
                </td>
                <td style={{ padding: '3px 6px', color: C.grayDark }}>{spLabel}</td>
                <td style={{ padding: '3px 6px', color: C.dark }}>{fmtDateTime(inc.created_dt)}</td>
                <td style={{ padding: '3px 6px', color: C.dark }}>{fmtDateTime(inc.termino_dt)}</td>
                <td style={{ padding: '3px 6px', color: C.dark }}>{tempoRes}</td>
                <td style={{ padding: '3px 6px' }}>
                  {inc.sla_met === true  && <Badge text="✓" bg={C.green} />}
                  {inc.sla_met === false && <Badge text="✗" bg={C.red} />}
                  {inc.sla_met === null  && <span style={{ color: C.grayMid }}>-</span>}
                </td>
                <td style={{ padding: '3px 6px', color: C.dark, maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inc.summary}
                </td>
                <td style={{ padding: '3px 6px', color: C.grayDark }}>{inc.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Sprint calendar footer ────────────────────────────────────────────────────

function SprintCalendar({ sprintsCalendar, currentSprint, nextSprint, sprintOrder }) {
  const visible = ['26.2.4','26.2.5','26.2.6','26.3.1','26.3.2','26.3.3','26.3.4','26.3.5','26.3.6']
    .filter((sp) => sprintsCalendar[sp]);

  const piGroups = [];
  let lastPi = null;
  for (const sp of visible) {
    const pi = sp.slice(0, 4);
    if (pi !== lastPi) { piGroups.push({ pi, count: 1 }); lastPi = pi; }
    else piGroups[piGroups.length - 1].count++;
  }

  return (
    <div style={{
      display: 'flex', border: `1px solid ${C.gray}`, borderRadius: 4,
      overflow: 'hidden', marginTop: 10,
    }}>
      {visible.map((sp) => {
        const isCurrent = sp === currentSprint;
        const isNext = sp === nextSprint;
        const cal = sprintsCalendar[sp];
        return (
          <div key={sp} style={{
            flex: 1, textAlign: 'center', padding: '4px 2px',
            background: isCurrent ? C.purple : isNext ? '#FFF3D6' : C.purpleSoft,
            borderRight: `1px solid ${C.gray}`,
            position: 'relative',
          }}>
            <div style={{ fontWeight: 700, fontSize: 6.5, color: isCurrent ? C.white : C.dark }}>{sp}</div>
            {cal && (
              <div style={{ fontSize: 5, color: isCurrent ? 'rgba(255,255,255,0.7)' : C.grayMid }}>
                {fmtDate(cal.start)}-{fmtDate(cal.end)}
              </div>
            )}
            {(isCurrent || isNext) && (
              <div style={{
                position: 'absolute', top: 3, right: 3, width: 5, height: 5,
                borderRadius: '50%', background: isCurrent ? C.yellow : C.purple,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StatusReport() {
  const [area, setArea] = useState('G&C');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async (a) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await getStatusReport(a);
      setData(result);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(area); }, [area]);

  const { classification: cls, current_sprint, next_sprint, today,
    sprints_calendar, sprint_order, pi_metrics,
    incidents, incidents_summary, incidents_by_sprint, has_incidents_page } = data || {};

  return (
    <div style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
      {/* Toolbar */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.purple, margin: 0 }}>Status Report</h2>
        <select value={area} onChange={(e) => setArea(e.target.value)}
          style={{ border: `1px solid ${C.gray}`, borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={() => load(area)} disabled={loading}
          style={{
            background: C.purple, color: C.white, border: 'none',
            borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer', opacity: loading ? 0.6 : 1,
          }}>
          {loading ? '⏳ Carregando…' : '🔄 Atualizar'}
        </button>
        <button onClick={() => window.print()}
          style={{
            background: 'white', color: C.dark, border: `1px solid ${C.gray}`,
            borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
          }}>
          🖨️ PDF
        </button>
        {data && (
          <span style={{ fontSize: 12, color: C.grayMid }}>
            Sprint atual: <strong>{current_sprint}</strong> &nbsp;·&nbsp; {today}
          </span>
        )}
      </div>

      {error && (
        <div style={{ background: C.redSoft, border: `1px solid ${C.red}`, borderRadius: 6, padding: 12, color: C.red, fontSize: 13, marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: C.grayMid, fontSize: 14 }}>
          Carregando dados do Jira…
        </div>
      )}

      {data && (
        <>
          {/* ══ PÁGINA 1 — Sprint Atual + Próxima ══ */}
          <PageWrapper pageNum={1}>
            {/* Sidebar */}
            <Sidebar color={C.purple}>
              <div style={{ color: C.white, fontWeight: 900, fontSize: 18, letterSpacing: -0.5 }}>cogna</div>
              <div style={{ color: C.white, fontSize: 6, letterSpacing: 3, marginBottom: 10 }}>EDUCAÇÃO</div>

              <Badge text={`SPRINT ${current_sprint}`} bg={C.yellow} color={C.dark} size={8} />
              {sprints_calendar?.[current_sprint] && (
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 6, marginTop: 4 }}>
                  {fmtDate(sprints_calendar[current_sprint].start)} → {fmtDate(sprints_calendar[current_sprint].end)}
                </div>
              )}

              <SidebarTitle text="SPRINT ATUAL" />
              <SidebarDivider />
              <SidebarIndicator label="Em upstream"    value={cls.current_upstream.length}   dotColor={C.yellow} />
              <SidebarIndicator label="Em downstream"  value={cls.current_downstream.length} dotColor={C.purpleMid} />
              <SidebarIndicator label="Em homologação" value={cls.current_homolog.length}    dotColor={C.orange} />
              <SidebarIndicator label="Entregues"      value={cls.current_done.length}       dotColor={C.green} />

              <SidebarTitle text={`PRÓXIMA SPRINT · ${next_sprint}`} />
              <SidebarDivider />
              <SidebarIndicator label="Em upstream"    value={cls.next_upstream.length}   dotColor={C.yellow} />
              <SidebarIndicator label="Em downstream"  value={cls.next_downstream.length} dotColor={C.purpleMid} />
              <SidebarIndicator label="Hom. prevista"  value={cls.next_homolog.length}    dotColor={C.orange} />

              {has_incidents_page && (
                <>
                  <SidebarTitle text="INCIDENTES DA SPRINT" />
                  <SidebarDivider />
                  <SidebarIndicator label="Total"    value={incidents_summary.total}  dotColor={C.white} />
                  <SidebarIndicator label="Em aberto" value={incidents_summary.aberto} dotColor={C.red} />
                </>
              )}
            </Sidebar>

            <PageContent>
              <div style={{ display: 'flex', gap: 12 }}>
                {/* Coluna 1 — Sprint Atual */}
                <SprintColumn
                  title={`SPRINT ATUAL — ${current_sprint}`}
                  headerBg={C.purple}
                  sprintsCalendar={sprints_calendar}
                  currentSprint={current_sprint}
                  items_data={[
                    { sectionTitle: 'UPSTREAM',               items: cls.current_upstream,   kind: 'upstream'   },
                    { sectionTitle: 'DOWNSTREAM',             items: cls.current_downstream, kind: 'downstream' },
                    { sectionTitle: 'HOMOLOGAÇÃO',            items: cls.current_homolog,    kind: 'homolog'    },
                    { sectionTitle: 'CONCLUÍDOS NESTA SPRINT', items: cls.current_done,      kind: 'done'       },
                  ]}
                />

                {/* Coluna 2 — Próxima Sprint */}
                <SprintColumn
                  title={`PRÓXIMA SPRINT — ${next_sprint}`}
                  headerBg={C.purpleMid}
                  sprintsCalendar={sprints_calendar}
                  currentSprint={current_sprint}
                  items_data={[
                    { sectionTitle: 'UPSTREAM',             items: cls.next_upstream,   kind: 'upstream'    },
                    { sectionTitle: 'DOWNSTREAM',           items: cls.next_downstream, kind: 'downstream'  },
                    { sectionTitle: 'HOMOLOGAÇÃO PREVISTA', items: cls.next_homolog,    kind: 'next_homolog' },
                  ]}
                />
              </div>

              {/* Calendário rodapé */}
              <SprintCalendar
                sprintsCalendar={sprints_calendar}
                currentSprint={current_sprint}
                nextSprint={next_sprint}
                sprintOrder={sprint_order}
              />
            </PageContent>
          </PageWrapper>

          {/* ══ PÁGINA 2 — Histórico e Gantt ══ */}
          <PageWrapper pageNum={2}>
            <Sidebar color={C.purple}>
              <div style={{ color: C.white, fontWeight: 900, fontSize: 18 }}>cogna</div>
              <div style={{ color: C.white, fontSize: 6, letterSpacing: 3, marginBottom: 12 }}>EDUCAÇÃO</div>

              <SidebarTitle text="ENTREGAS POR PI" />
              <SidebarDivider />
              {['26.1', '26.2', '26.3', '26.4'].map((pi) => {
                const [entregue, planejado] = pi_metrics?.[pi] || [0, 0];
                const ratio = planejado > 0 ? Math.min(1, entregue / planejado) : (entregue > 0 ? 1 : 0);
                return (
                  <div key={pi} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: C.white, fontSize: 8, fontWeight: 700 }}>
                      <span>PI {pi}</span>
                      <span>{pi === '26.1' ? `${entregue} entregues` : `${entregue}/${planejado}`}</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 4 }}>
                      <div style={{ height: '100%', width: `${ratio * 100}%`, background: C.green, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}

              <SidebarTitle text="TOTALIZADORES" />
              <SidebarDivider />
              <SidebarIndicator label="Total entregues" value={Object.values(pi_metrics || {}).reduce((s, [e]) => s + e, 0)} dotColor={C.green} />
              <SidebarIndicator label="Backlog ativo"   value={cls.backlog_planejado?.length || 0} dotColor={C.yellow} />
              <SidebarIndicator label="Sem priorização" value={cls.sem_priorizacao.length} dotColor={C.red} />
            </Sidebar>

            <PageContent>
              <div style={{ display: 'flex', gap: 12 }}>
                {/* Finalizados */}
                <div style={{ width: 200, flexShrink: 0 }}>
                  <SectionHeader title="FINALIZADOS" bg={C.greenDark} />
                  {cls.finalizados.length === 0
                    ? <EmptyRow label="Nenhum item finalizado." />
                    : cls.finalizados
                        .filter((it) => it.implant)
                        .sort((a, b) => new Date(a.implant) - new Date(b.implant))
                        .map((it) => (
                          <ItemRow key={it.key} item={it}
                            badgeText={fmtDateFull(it.implant)}
                            badgeBg={C.green} accentColor={C.green} bg={C.greenSoft} />
                        ))}

                  {cls.sem_priorizacao.length > 0 && (
                    <>
                      <div style={{ marginTop: 12 }}>
                        <SectionHeader title="SEM PRIORIZAÇÃO" bg={C.red} />
                        {cls.sem_priorizacao.map((it) => (
                          <ItemRow key={it.key} item={it}
                            badgeText="Não priorizado" badgeBg={C.red}
                            accentColor={C.red} bg={C.redSoft} />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Gantt */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <SectionHeader title="CRONOGRAMA — ÉPICOS ATIVOS E BACKLOG PLANEJADO" bg={C.purple} />
                  <GanttChart
                    items={cls.gantt_full}
                    sprintsCalendar={sprints_calendar}
                    sprintOrder={sprint_order}
                    currentSprint={current_sprint}
                    nextSprint={next_sprint}
                    today={today}
                  />
                </div>
              </div>
            </PageContent>
          </PageWrapper>

          {/* ══ PÁGINA 3 — Incidentes ══ */}
          {has_incidents_page && (
            <PageWrapper pageNum={3}>
              <Sidebar color={C.red}>
                <div style={{ color: C.white, fontWeight: 900, fontSize: 18 }}>cogna</div>
                <div style={{ color: C.white, fontSize: 6, letterSpacing: 3, marginBottom: 12 }}>EDUCAÇÃO</div>

                <div style={{ color: C.white, fontWeight: 700, fontSize: 8.5 }}>INCIDENTES · {current_sprint}</div>
                <SidebarDivider color="rgba(255,255,255,0.2)" />

                <SidebarIndicator label="Total"       value={incidents_summary.total}      dotColor={C.white} />
                <SidebarIndicator label="Em aberto"   value={incidents_summary.aberto}     dotColor={C.yellow} />
                <SidebarIndicator label="Resolvidos"  value={incidents_summary.resolvidos} dotColor={C.green} />
                <SidebarIndicator label="SLA violado" value={incidents_summary.sla_violado} dotColor={C.dark} />

                <SidebarTitle text="HISTÓRICO POR SPRINT" />
                <SidebarDivider color="rgba(255,255,255,0.2)" />
                {sprint_order
                  .filter((sp) => incidents_by_sprint?.[sp])
                  .slice(-6)
                  .map((sp) => {
                    const n = incidents_by_sprint[sp]?.length || 0;
                    const maxN = Math.max(1, ...Object.values(incidents_by_sprint || {}).map((v) => v.length));
                    return (
                      <div key={sp} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: C.white, fontSize: 6.5 }}>
                          <span>{sp}</span><span>{n}</span>
                        </div>
                        <div style={{ height: 5, background: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 2 }}>
                          <div style={{ height: '100%', width: `${(n / maxN) * 100}%`, background: C.white, borderRadius: 2 }} />
                        </div>
                      </div>
                    );
                  })}
              </Sidebar>

              <PageContent>
                <div style={{ color: C.red, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                  INCIDENTES DA SPRINT ATUAL — {current_sprint}
                </div>

                <SectionHeader title="INCIDENTES POR SPRINT" bg={C.purple} />
                <IncidentBarChart
                  bySprintData={incidents_by_sprint || {}}
                  currentSprint={current_sprint}
                  sprintOrder={sprint_order}
                />

                <div style={{ marginTop: 14 }}>
                  <SectionHeader title="INCIDENTES — DETALHAMENTO" bg={C.purple} />
                  <IncidentsTable incidents={incidents || []} currentSprint={current_sprint} />
                </div>
              </PageContent>
            </PageWrapper>
          )}
        </>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .status-page { page-break-after: always; box-shadow: none !important; margin-bottom: 0 !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
