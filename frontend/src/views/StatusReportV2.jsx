import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { getStatusReport } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  pageBg:      'linear-gradient(145deg,#F0EBFF 0%,#EBF0FF 40%,#F8F5FF 100%)',
  surface:     'rgba(255,255,255,0.82)',
  surfaceHov:  'rgba(255,255,255,0.96)',
  surfaceSol:  '#ffffff',
  border:      'rgba(82,25,161,0.10)',
  borderHov:   'rgba(82,25,161,0.22)',
  shadow:      '0 4px 24px rgba(82,25,161,0.08)',
  shadowHov:   '0 8px 32px rgba(82,25,161,0.15)',
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
  textPrim:    '#1A0B3D',
  textSec:     '#4A3880',
  textMut:     '#9B8EC4',
  white:       '#ffffff',
};

const JIRA  = 'https://cogna.atlassian.net';
const AREAS = [
  'G&C','CAPTACAO_ANALITICA','REVENUE','ROTINAS_FINANCEIRAS',
  'DMC','REVENUE_STRATEGY','RVV','REPASSE',
  'ALIANCA_1_SOMOS','ALIANCA_1_SABER','Plurall','MACROPROCESSO','ESG',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmtDate = (s) => s ? new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : '-';
const fmtFull = (s) => s ? new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '-';
const fmtDT   = (s) => s ? new Date(s).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-';

function useCounter(target, duration = 800) {
  const [v, setV] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (typeof target !== 'number') return;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      setV(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS animations
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes fadeUp   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes scaleIn  { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
  @keyframes barFill  { from{width:0%} }
  @keyframes shimmer  { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
  @keyframes pulse    { 0%,100%{box-shadow:0 0 0 0 rgba(255,173,1,.4)} 50%{box-shadow:0 0 0 8px rgba(255,173,1,0)} }
  @keyframes spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes slideRight { from{opacity:0;transform:translateX(32px)} to{opacity:1;transform:translateX(0)} }
  @keyframes slideLeft  { from{opacity:0;transform:translateX(-32px)} to{opacity:1;transform:translateX(0)} }
  @keyframes toastIn  { from{opacity:0;transform:translateY(12px) scale(.95)} to{opacity:1;transform:translateY(0) scale(1)} }

  .sr2-card { transition: box-shadow .22s ease, transform .22s ease, border-color .22s ease; }
  .sr2-card:hover { box-shadow:0 8px 32px rgba(82,25,161,.14)!important; transform:translateY(-2px); border-color:rgba(82,25,161,.22)!important; }
  .sr2-item { transition: background .15s ease, transform .12s ease; }
  .sr2-item:hover { background:rgba(123,63,212,.07)!important; transform:translateX(3px); }
  .sr2-tab  { transition: all .2s ease; }
  .sr2-tab:hover { background:rgba(82,25,161,.07)!important; }
  .sr2-fade-up    { animation: fadeUp  .45s cubic-bezier(.22,1,.36,1) both; }
  .sr2-fade-in    { animation: fadeIn  .35s ease both; }
  .sr2-scale-in   { animation: scaleIn .25s cubic-bezier(.22,1,.36,1) both; }
  .sr2-bar-fill   { animation: barFill .9s cubic-bezier(.22,1,.36,1) both; }
  .sr2-spin       { animation: spin 1s linear infinite; }
  .sr2-pulse      { animation: pulse 2s ease-in-out infinite; }
  .sr2-skeleton   { background:linear-gradient(90deg,#ede9f7 25%,#ddd5f5 50%,#ede9f7 75%); background-size:400px 100%; animation:shimmer 1.4s ease infinite; border-radius:8px; }
  .sr2-slide-r    { animation: slideRight .3s cubic-bezier(.22,1,.36,1) both; }
  .sr2-slide-l    { animation: slideLeft  .3s cubic-bezier(.22,1,.36,1) both; }
  .sr2-toast      { animation: toastIn .3s cubic-bezier(.22,1,.36,1) both; }

  /* Gantt filter toggle */
  .gantt-toggle { cursor:pointer; transition: all .15s ease; border:none; border-radius:20px; padding:4px 12px; font-size:11px; font-weight:700; }
  .gantt-toggle:hover { transform:scale(1.04); }

  /* Presentation nav arrow */
  .pres-arrow { cursor:pointer; transition: all .18s ease; background:rgba(255,255,255,.15); border:1.5px solid rgba(255,255,255,.25); border-radius:50%; width:48px; height:48px; display:flex; align-items:center; justify-content:center; font-size:20px; color:#fff; backdrop-filter:blur(8px); }
  .pres-arrow:hover { background:rgba(255,255,255,.3); transform:scale(1.1); }
  .pres-arrow:disabled { opacity:.3; cursor:not-allowed; transform:none; }

  /* Share button pulse on copy */
  .share-copied { animation: scaleIn .2s ease; }

  @media print {
    .no-print { display:none!important; }
    body { background:white!important; }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────
function Card({ children, style={}, delay=0, glow, className='' }) {
  return (
    <div className={`sr2-card sr2-fade-up ${className}`} style={{
      background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:18,
      backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
      boxShadow: glow ? `${T.shadow},0 0 0 1px ${glow}40,0 4px 20px ${glow}` : T.shadow,
      animationDelay:`${delay}ms`, overflow:'hidden', ...style,
    }}>{children}</div>
  );
}

function Chip({ text, color, bg, size=11, bold=true }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center',
      background: bg||`${color}18`, color,
      border:`1px solid ${color}30`, borderRadius:20,
      padding:'2px 10px', fontSize:size, fontWeight:bold?700:500, whiteSpace:'nowrap',
    }}>{text}</span>
  );
}

function AnimatedNumber({ value, color=T.textPrim, size=40 }) {
  const v = useCounter(value);
  return <span style={{ fontSize:size, fontWeight:900, color, lineHeight:1, letterSpacing:-1, display:'block' }}>{v}</span>;
}

function StatCard({ label, value, color, glow, icon, sub, delay=0 }) {
  return (
    <Card delay={delay} glow={glow} style={{ padding:'20px 22px', flex:1, minWidth:140 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, color:T.textMut, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', marginBottom:8 }}>{label}</div>
          <AnimatedNumber value={value} color={color} size={38} />
          {sub && <div style={{ fontSize:10.5, color:T.textMut, marginTop:6, lineHeight:1.4 }}>{sub}</div>}
        </div>
        {icon && <div style={{ width:42,height:42,borderRadius:12,background:`${color}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0 }}>{icon}</div>}
      </div>
      <div style={{ height:3,borderRadius:'0 0 18px 18px',background:`linear-gradient(90deg,${color},${color}44)`,margin:'16px -22px -20px' }} />
    </Card>
  );
}

function SectionLabel({ text, color=T.purpleMid, icon }) {
  return (
    <div style={{ display:'flex',alignItems:'center',gap:7,marginBottom:8 }}>
      <div style={{ width:3,height:14,background:color,borderRadius:2,flexShrink:0 }} />
      {icon && <span style={{ fontSize:12 }}>{icon}</span>}
      <span style={{ fontSize:10.5,fontWeight:700,color:T.textMut,letterSpacing:1.2,textTransform:'uppercase' }}>{text}</span>
    </div>
  );
}

const PROJ_COLORS = {
  DDPL: { color:'#0052CC', bg:'#E3F2FD' },
  DENA: { color:'#E53935', bg:'#FDECEA' },
};

function LinkedSubRow({ li }) {
  const pc = PROJ_COLORS[li.project] || { color:T.textSec, bg:T.purpleLight };
  const isDone = ['Resolvido','Fechado','Done','Concluído','Em produção'].includes(li.status);
  return (
    <a href={`${JIRA}/browse/${li.key}`} target="_blank" rel="noreferrer"
      className="sr2-item"
      style={{ display:'flex', alignItems:'center', gap:7, padding:'4px 10px 4px 14px',
        marginBottom:2, borderRadius:7, background:pc.bg+'88',
        borderLeft:`2px solid ${pc.color}55`, textDecoration:'none' }}>
      <span style={{ fontSize:9, fontWeight:800, color:T.white, background:pc.color,
        padding:'1px 6px', borderRadius:4, flexShrink:0 }}>{li.project}</span>
      <span style={{ color:pc.color, fontWeight:700, fontSize:10, flexShrink:0 }}>{li.key}</span>
      <span style={{ color:T.textSec, fontSize:10.5, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
        title={li.summary}>{li.summary}</span>
      <span style={{ fontSize:9.5, color:isDone?T.green:T.textMut, fontWeight:600, flexShrink:0 }}>{li.status}</span>
    </a>
  );
}

function ItemRow({ item, badge, badgeColor, accent, extra, extraColor, bg, delay=0 }) {
  const [expanded, setExpanded] = useState(false);
  const links = item.linked_issues || [];
  const hasLinks = links.length > 0;

  return (
    <div style={{ marginBottom:3, animationDelay:`${delay}ms` }}>
      <div className="sr2-item"
        style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:9,
          background:bg||'transparent', borderLeft:`3px solid ${accent||T.purpleMid}` }}>
        {/* Expand toggle */}
        {hasLinks ? (
          <button onClick={() => setExpanded((v)=>!v)} style={{
            background:'none', border:'none', cursor:'pointer', padding:0,
            color:T.purpleMid, fontSize:11, fontWeight:800, flexShrink:0, width:14,
          }}>{expanded ? '▾' : '▸'}</button>
        ) : (
          <span style={{ width:14, flexShrink:0 }} />
        )}
        <a href={`${JIRA}/browse/${item.key}`} target="_blank" rel="noreferrer"
          style={{ display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0,textDecoration:'none' }}>
          <span style={{ color:T.purpleMid,fontWeight:800,fontSize:10,flexShrink:0,minWidth:60 }}>{item.key}</span>
          <span style={{ color:T.textSec,fontSize:11,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}
            title={item.summary}>{item.summary}</span>
        </a>
        <div style={{ display:'flex',gap:4,flexShrink:0 }}>
          {extra && <Chip text={extra}  color={extraColor||T.orange} />}
          {badge && <Chip text={badge}  color={badgeColor||T.purpleMid} />}
          {hasLinks && (
            <span style={{ fontSize:9, color:T.textMut, background:T.purpleLight,
              padding:'1px 6px', borderRadius:10, fontWeight:600 }}>
              {links.length} link{links.length>1?'s':''}
            </span>
          )}
        </div>
      </div>
      {/* Sub-itens expandidos */}
      {expanded && hasLinks && (
        <div className="sr2-fade-in" style={{ marginLeft:22, marginTop:2 }}>
          {links.map((li) => <LinkedSubRow key={li.key} li={li} />)}
        </div>
      )}
    </div>
  );
}

function Empty({ label='Nenhum item' }) {
  return <div style={{ color:T.textMut,fontSize:11,fontStyle:'italic',padding:'5px 12px',opacity:.7 }}>{label}</div>;
}

function Skeleton({ h=80, mb=12, br=12 }) {
  return <div className="sr2-skeleton" style={{ height:h,marginBottom:mb,borderRadius:br }} />;
}

function LoadingState() {
  return (
    <div className="sr2-fade-in" style={{ padding:'0 0 24px' }}>
      <div style={{ display:'flex',gap:12,marginBottom:20 }}>
        {[1,2,3,4].map((i) => <Skeleton key={i} h={110} mb={0} br={18} />)}
      </div>
      <Skeleton h={48} br={14} />
      <div style={{ display:'flex',gap:14,marginTop:16 }}>
        <Skeleton h={380} br={18} /><Skeleton h={380} br={18} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────────────────────
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="sr2-toast" style={{
      position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)',
      background:T.purple, color:T.white, padding:'10px 22px', borderRadius:24,
      fontSize:13, fontWeight:600, zIndex:9999, boxShadow:`0 8px 32px ${T.purpleGlow}`,
      pointerEvents:'none', whiteSpace:'nowrap',
    }}>{message}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TabBar
// ─────────────────────────────────────────────────────────────────────────────
function TabBar({ active, onChange, tabs }) {
  return (
    <div style={{ display:'inline-flex',gap:4,background:'rgba(255,255,255,.6)',border:`1.5px solid ${T.border}`,borderRadius:14,padding:4,backdropFilter:'blur(8px)',boxShadow:T.shadow }}>
      {tabs.map(({ id, label, icon }) => {
        const on = active === id;
        return (
          <button key={id} onClick={() => onChange(id)} className={`sr2-tab${on?' active':''}`} style={{
            padding:'8px 20px', borderRadius:10, border:'none', cursor:'pointer',
            background: on ? `linear-gradient(135deg,${T.purple},${T.purpleMid})` : 'transparent',
            color: on ? T.white : T.textSec, fontWeight: on?700:500, fontSize:13,
            boxShadow: on ? `0 4px 14px ${T.purpleGlow}` : 'none', letterSpacing:.2,
          }}><span style={{ marginRight:6 }}>{icon}</span>{label}</button>
        );
      })}
    </div>
  );
}

function ProgressBar({ pct, color, h=6 }) {
  return (
    <div style={{ height:h,background:`${color}20`,borderRadius:h,overflow:'hidden' }}>
      <div className="sr2-bar-fill" style={{ height:'100%',width:`${pct}%`,borderRadius:h,background:`linear-gradient(90deg,${color}cc,${color})`,boxShadow:`0 0 8px ${color}60` }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gantt Filters
// ─────────────────────────────────────────────────────────────────────────────
function GanttFilters({ filters, onChange }) {
  const opts = [
    { key:'UP', label:'Upstream',    color:T.purple },
    { key:'DN', label:'Downstream',  color:T.purpleMid },
    { key:'HM', label:'Homologação', color:T.orange },
  ];
  return (
    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
      <span style={{ fontSize:10.5,color:T.textMut,fontWeight:600,marginRight:4 }}>Mostrar:</span>
      {opts.map(({ key, label, color }) => {
        const on = filters[key];
        return (
          <button key={key} className="gantt-toggle" onClick={() => onChange(key)} style={{
            background: on ? `${color}18` : 'rgba(0,0,0,0.04)',
            color: on ? color : T.textMut,
            border: `1.5px solid ${on ? color+'44' : 'transparent'}`,
            opacity: on ? 1 : .55,
          }}>
            <span style={{ marginRight:4 }}>{on ? '●' : '○'}</span>{label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gantt moderno
// ─────────────────────────────────────────────────────────────────────────────
function ModernGantt({ items, sprintsCalendar, sprintOrder, currentSprint, nextSprint, today, filters }) {
  if (!items?.length) return <Empty label="Nenhum épico no cronograma." />;

  const curIdx = sprintOrder.indexOf(currentSprint);
  let endIdx = curIdx + 5;
  for (const it of items) {
    if (!it.end) continue;
    const endD = new Date(it.end);
    for (let i = curIdx; i < sprintOrder.length; i++) {
      if (endD <= new Date(sprintsCalendar[sprintOrder[i]]?.end)) { endIdx = Math.max(endIdx, i+1); break; }
    }
  }
  endIdx = Math.min(endIdx, sprintOrder.length - 1);
  const visible = sprintOrder.slice(curIdx, endIdx + 1);

  const piColors = { '26.2':T.purple, '26.3':T.purpleMid, '26.4':'#9B59B6' };
  const piGroups = [];
  let lastPi = null;
  for (const sp of visible) {
    const pi = sp.slice(0,4);
    if (pi !== lastPi) { piGroups.push({ pi, count:1 }); lastPi = pi; }
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

  const todayD = new Date(today);
  const curCal = sprintsCalendar[currentSprint];
  const curVisIdx = visible.indexOf(currentSprint);
  let todayPct = null;
  if (curCal && curVisIdx >= 0) {
    const frac = Math.min(1, Math.max(0, (todayD - new Date(curCal.start)) / (new Date(curCal.end) - new Date(curCal.start))));
    todayPct = ((curVisIdx + frac) / visible.length) * 100;
  }

  const LABEL_W = 72;
  const rowH = Math.max(22, Math.min(28, 300 / items.length));
  const barStyle = {
    UP: { bg:`linear-gradient(90deg,${T.purple},${T.purpleMid})`, shadow:T.purpleGlow },
    DN: { bg:`linear-gradient(90deg,${T.purpleMid},#9B59B6)`,     shadow:T.purpleGlow },
    HM: { bg:`linear-gradient(90deg,${T.orange},#FFAB00)`,        shadow:T.orangeGlow },
  };

  return (
    <div style={{ overflowX:'auto' }}>
      {/* PI header */}
      <div style={{ display:'flex', marginLeft:LABEL_W, gap:2, marginBottom:3 }}>
        {piGroups.map(({ pi, count }) => (
          <div key={pi} style={{ flex:count,textAlign:'center',padding:'4px 0',fontSize:10,fontWeight:700,color:T.white,background:piColors[pi]||T.textMut,borderRadius:'6px 6px 0 0' }}>PI {pi}</div>
        ))}
      </div>

      {/* Sprint headers */}
      <div style={{ display:'flex', marginLeft:LABEL_W, borderBottom:`2px solid ${T.border}` }}>
        {visible.map((sp) => (
          <div key={sp} style={{ flex:1,textAlign:'center',padding:'4px 2px',fontSize:9.5,
            color: sp===currentSprint?T.purple:T.textMut,
            fontWeight: sp===currentSprint?800:400,
            background: sp===currentSprint?T.purpleLight: sp===nextSprint?T.yellowLight:'transparent',
          }}>{sp}</div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ position:'relative' }}>
        {todayPct !== null && (
          <div style={{ position:'absolute',top:0,bottom:0,zIndex:3,left:`calc(${LABEL_W}px + ${todayPct}%)`,borderLeft:`2px dashed ${T.red}80`,pointerEvents:'none' }}>
            <span style={{ position:'absolute',top:-18,left:4,fontSize:9,color:T.red,fontWeight:700,whiteSpace:'nowrap',background:T.redLight,padding:'1px 5px',borderRadius:4 }}>HOJE</span>
          </div>
        )}
        {items.map((it, rowIdx) => {
          const si = colOf(it.start);
          const ei = colOf(it.end);
          return (
            <div key={it.key} className="sr2-fade-up" style={{ display:'flex',height:rowH,alignItems:'center',borderBottom:`1px solid ${T.border}`,animationDelay:`${rowIdx*25}ms` }}>
              <div style={{ width:LABEL_W,flexShrink:0,paddingRight:8,textAlign:'right' }}>
                <a href={`${JIRA}/browse/${it.key}`} target="_blank" rel="noreferrer"
                  style={{ color:T.purpleMid,fontSize:10,fontWeight:700,textDecoration:'none' }}>{it.key}</a>
              </div>
              {visible.map((sp, i) => {
                const isCur = sp===currentSprint, isNxt = sp===nextSprint;
                const cellBg = isCur?T.purpleLight: isNxt?T.yellowLight:'transparent';
                let bar = null;
                if (filters.UP && si !== null && i === si) bar = 'UP';
                if (ei !== null) {
                  const dnStart = (si !== null && ei > si) ? si+1 : (si ?? ei);
                  if (filters.DN && i >= dnStart && i <= ei) bar = 'DN';
                  if (filters.HM && i === ei+1 && i < visible.length) bar = 'HM';
                }
                return (
                  <div key={sp} style={{ flex:1,height:'100%',background:cellBg,borderRight:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'center',padding:'3px 2px' }}>
                    {bar && (
                      <div className="sr2-bar-fill" style={{ width:'88%',height:rowH*.52,background:barStyle[bar].bg,borderRadius:5,boxShadow:`0 2px 8px ${barStyle[bar].shadow}`,display:'flex',alignItems:'center',justifyContent:'center' }}>
                        {rowH >= 18 && <span style={{ color:T.white,fontSize:8,fontWeight:800 }}>{bar}</span>}
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
      <div style={{ display:'flex',gap:16,marginTop:10,flexWrap:'wrap' }}>
        {Object.entries(barStyle).map(([key, { bg }]) => {
          const labels = { UP:'Upstream', DN:'Downstream', HM:'Homologação' };
          return (
            <div key={key} style={{ display:'flex',alignItems:'center',gap:6,opacity:filters[key]?1:.35,transition:'opacity .2s' }}>
              <div style={{ width:22,height:8,background:bg,borderRadius:3 }} />
              <span style={{ fontSize:10.5,color:T.textSec }}>{key} — {labels[key]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Presentation Mode Overlay
// ─────────────────────────────────────────────────────────────────────────────
function PresentationMode({ slides, onExit }) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState('r'); // 'r' | 'l'
  const [key, setKey] = useState(0);

  const go = useCallback((delta) => {
    setDir(delta > 0 ? 'r' : 'l');
    setIdx((i) => Math.min(Math.max(i + delta, 0), slides.length - 1));
    setKey((k) => k + 1);
  }, [slides.length]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [go, onExit]);

  // Try fullscreen
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => { if (document.fullscreenElement) document.exitFullscreen?.(); };
  }, []);

  const slide = slides[idx];
  const animClass = dir === 'r' ? 'sr2-slide-r' : 'sr2-slide-l';

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9000,
      background: T.pageBg,
      display:'flex', flexDirection:'column',
      fontFamily:"'Inter','Helvetica Neue',Helvetica,Arial,sans-serif",
    }}>
      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'14px 24px', background:'rgba(255,255,255,0.6)',
        borderBottom:`1px solid ${T.border}`, backdropFilter:'blur(12px)' }}>

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontSize:20, fontWeight:900, background:`linear-gradient(135deg,${T.purple},${T.purpleMid})`,
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            Status Report
          </div>
          <Chip text={slide.label} color={T.purple} size={12} />
        </div>

        {/* Slide dots */}
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {slides.map((s, i) => (
            <button key={i} onClick={() => { setDir(i>idx?'r':'l'); setIdx(i); setKey(k=>k+1); }}
              style={{
                width: i===idx ? 24 : 8, height:8, borderRadius:4, border:'none', cursor:'pointer',
                background: i===idx ? T.purple : `${T.purple}30`,
                transition:'all .25s ease', padding:0,
              }} />
          ))}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:12, color:T.textMut }}>
            {idx+1} / {slides.length} &nbsp;·&nbsp; ← → para navegar &nbsp;·&nbsp; ESC para sair
          </span>
          <button onClick={onExit} style={{
            background:`${T.red}18`, color:T.red, border:`1px solid ${T.red}30`,
            borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer',
          }}>✕ Sair</button>
        </div>
      </div>

      {/* Slide content */}
      <div style={{ flex:1, overflow:'auto', padding:'24px 32px' }}>
        <div key={key} className={animClass}>
          {slide.content}
        </div>
      </div>

      {/* Bottom arrows */}
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:20,
        padding:'16px 0', background:'rgba(255,255,255,0.5)', backdropFilter:'blur(8px)',
        borderTop:`1px solid ${T.border}` }}>
        <button className="pres-arrow" onClick={() => go(-1)} disabled={idx===0}
          style={{ background:T.surface, color:T.purple, border:`1.5px solid ${T.border}`,
            width:48, height:48, borderRadius:'50%', cursor: idx===0?'not-allowed':'pointer',
            fontSize:18, display:'flex', alignItems:'center', justifyContent:'center',
            opacity: idx===0?.3:1, transition:'all .18s ease' }}>
          ←
        </button>
        <span style={{ fontSize:12, color:T.textMut, minWidth:80, textAlign:'center' }}>
          {slide.label}
        </span>
        <button className="pres-arrow" onClick={() => go(1)} disabled={idx===slides.length-1}
          style={{ background: idx===slides.length-1?T.surface:`linear-gradient(135deg,${T.purple},${T.purpleMid})`,
            color: idx===slides.length-1?T.textMut:T.white,
            border:`1.5px solid ${idx===slides.length-1?T.border:T.purple}`,
            width:48, height:48, borderRadius:'50%',
            cursor: idx===slides.length-1?'not-allowed':'pointer',
            fontSize:18, display:'flex', alignItems:'center', justifyContent:'center',
            opacity: idx===slides.length-1?.3:1, transition:'all .18s ease',
            boxShadow: idx===slides.length-1?'none':`0 4px 14px ${T.purpleGlow}` }}>
          →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-views (reutilizados em tabs e em slides)
// ─────────────────────────────────────────────────────────────────────────────
function SprintCol({ title, accentGrad, items_data, sprintsCalendar, currentSprint, sprintKey, delay=0 }) {
  const colSprint = sprintKey || currentSprint;
  const colCal    = sprintsCalendar?.[colSprint];
  const dateRange = colCal ? ` (${fmtDate(colCal.start)} até ${fmtDate(colCal.end)})` : '';
  return (
    <Card delay={delay} style={{ flex:1, minWidth:0 }}>
      <div style={{ padding:'14px 18px', background:accentGrad, borderBottom:`1px solid ${T.border}` }}>
        <div style={{ color:T.white, fontWeight:800, fontSize:14, letterSpacing:-.3 }}>{title}</div>
        {dateRange && <div style={{ color:'rgba(255,255,255,0.75)', fontSize:11, marginTop:2 }}>{dateRange}</div>}
      </div>
      <div style={{ padding:'14px 16px' }}>
        {items_data.map(({ sectionTitle, items, kind, color }) => {
          const cal = colCal;
          return (
            <div key={sectionTitle} style={{ marginBottom:16 }}>
              <SectionLabel text={`${sectionTitle} · ${items.length}`} color={color} />
              {items.length===0 ? <Empty /> : items.map((it, i) => {
                let badge,badgeColor,extra,extraColor,accent,bg;
                if (kind==='upstream')      { accent=T.yellow; extra=it.status; extraColor=T.textSec; }
                else if (kind==='downstream') { badge=it.end?fmtDate(it.end):'DN'; badgeColor=T.purpleMid; accent=T.purpleMid; if(it._atraso){extra=`↻ ${it._atraso}d`;extraColor=T.orange;} }
                else if (kind==='homolog')  { const d=it._dias_homolog; badge=d!=null?(d>15?`⚠ ${d}d`:`${d}d`):'Hom.'; badgeColor=d>15?T.red:T.orange; accent=T.orange; }
                else if (kind==='blocked')  { accent=T.red; bg=T.redLight; }
                else if (kind==='done')     { badge=it.implant?fmtFull(it.implant):'✓'; badgeColor=T.green; accent=T.green; bg=T.greenLight; }
                else if (kind==='next_homolog') { badge=it._badge||'Hom.'; badgeColor=T.orange; accent=T.orange; }
                return <ItemRow key={it.key+kind} item={it} badge={badge} badgeColor={badgeColor} accent={accent} extra={extra} extraColor={extraColor} bg={bg} delay={i*30} />;
              })}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function CalendarStrip({ sprintsCalendar, currentSprint, nextSprint }) {
  const visible = ['26.2.4','26.2.5','26.2.6','26.3.1','26.3.2','26.3.3','26.3.4','26.3.5','26.3.6'].filter((sp) => sprintsCalendar[sp]);
  return (
    <Card delay={300} style={{ padding:'14px 16px', marginTop:14 }}>
      <SectionLabel text="Calendário PI 26.2 → 26.3" color={T.purple} icon="📅" />
      <div style={{ display:'flex', gap:4 }}>
        {visible.map((sp, idx) => {
          const isCur=sp===currentSprint, isNxt=sp===nextSprint, cal=sprintsCalendar[sp], col=sp.slice(0,4)==='26.2'?T.purple:T.purpleMid;
          return (
            <div key={sp} className="sr2-fade-up" style={{ flex:1,borderRadius:10,padding:'8px 4px',textAlign:'center',
              background:isCur?`linear-gradient(135deg,${T.purple},${T.purpleMid})`:isNxt?T.yellowLight:T.purpleLight,
              border:isCur?'none':`1.5px solid ${isNxt?T.yellow+'44':col+'20'}`,
              boxShadow:isCur?`0 4px 16px ${T.purpleGlow}`:isNxt?`0 2px 8px ${T.yellowGlow}`:'none',
              position:'relative', animationDelay:`${idx*40}ms` }}>
              <div style={{ fontSize:9.5,fontWeight:800,color:isCur?T.white:isNxt?T.yellow:col }}>{sp}</div>
              {cal && <div style={{ fontSize:8,color:isCur?'rgba(255,255,255,.65)':T.textMut,marginTop:2 }}>{fmtDate(cal.start)}-{fmtDate(cal.end)}</div>}
              {isCur && <div className="sr2-pulse" style={{ position:'absolute',top:5,right:5,width:7,height:7,borderRadius:'50%',background:T.yellow }} />}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PiSidebar({ piMetrics, cls, delay=0 }) {
  const piColors = { '26.1':T.textMut, '26.2':T.purple, '26.3':T.purpleMid, '26.4':'#9B59B6' };
  return (
    <div style={{ width:200, flexShrink:0, display:'flex', flexDirection:'column', gap:10 }}>
      {['26.1','26.2','26.3','26.4'].map((pi, i) => {
        const [ent,plan]=piMetrics?.[pi]||[0,0];
        const pct=plan>0?Math.min(100,Math.round((ent/plan)*100)):(ent>0?100:0);
        return (
          <Card key={pi} delay={delay+i*60} style={{ padding:'14px 16px' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
              <span style={{ color:T.textSec,fontSize:12,fontWeight:700 }}>PI {pi}</span>
              <span style={{ color:piColors[pi],fontWeight:800,fontSize:14 }}>{pi==='26.1'?`${ent}` : `${ent}/${plan}`}</span>
            </div>
            <ProgressBar pct={pct} color={piColors[pi]} h={7} />
            {pi!=='26.1' && <div style={{ fontSize:10,color:T.textMut,marginTop:5 }}>{pct}% entregue</div>}
          </Card>
        );
      })}
      <Card delay={delay+280} style={{ padding:'14px 16px' }}>
        <SectionLabel text="Visão Geral" color={T.purple} />
        {[['Finalizados',cls.finalizados.length,T.green],['Sem priorização',cls.sem_priorizacao.length,T.red],['Backlog planejado',cls.backlog_planejado?.length||0,T.yellow]].map(([l,v,c]) => (
          <div key={l} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,gap:8 }}>
            <span style={{ fontSize:11,color:T.textSec }}>{l}</span>
            <AnimatedNumber value={v} color={c} size={20} />
          </div>
        ))}
      </Card>
    </div>
  );
}

function IncidentChart({ bySprintData, currentSprint, sprintOrder }) {
  const sprints = sprintOrder.filter((sp) => bySprintData[sp]).slice(-6);
  if (!sprints.length) return <Empty label="Sem dados de incidentes." />;
  const maxTotal = Math.max(1, ...sprints.map((sp) => bySprintData[sp]?.length||0));
  const BAR_H = 90;
  return (
    <div style={{ display:'flex',alignItems:'flex-end',gap:8,height:BAR_H+44,paddingTop:20 }}>
      {sprints.map((sp, idx) => {
        const items=bySprintData[sp]||[], total=items.length, res=items.filter((i)=>i.termino_dt).length, open=total-res;
        const isCur=sp===currentSprint, resH=total?(res/maxTotal)*BAR_H:0, openH=open?Math.max(8,(open/maxTotal)*BAR_H):0, pct=total?Math.round((open/total)*100):0;
        return (
          <div key={sp} className="sr2-fade-up" style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',animationDelay:`${idx*60}ms` }}>
            <span style={{ fontSize:11,fontWeight:800,color:T.textPrim,marginBottom:4 }}>{total}</span>
            <div style={{ width:'68%',display:'flex',flexDirection:'column',justifyContent:'flex-end',height:BAR_H,borderRadius:8,overflow:'hidden',outline:isCur?`2.5px solid ${T.purple}`:'none',outlineOffset:2,boxShadow:isCur?`0 4px 16px ${T.purpleGlow}`:T.shadow }}>
              {openH>0 && <div className="sr2-bar-fill" style={{ background:`linear-gradient(180deg,${T.orange},${T.orange}bb)`,height:openH,display:'flex',alignItems:'center',justifyContent:'center' }}>{openH>=14&&<span style={{ color:T.white,fontSize:9,fontWeight:700 }}>{pct}%</span>}</div>}
              {resH>0 && <div className="sr2-bar-fill" style={{ background:`linear-gradient(180deg,${T.green},${T.green}bb)`,height:resH }} />}
            </div>
            <span style={{ fontSize:9.5,marginTop:6,color:isCur?T.purple:T.textMut,fontWeight:isCur?800:400 }}>{sp}</span>
          </div>
        );
      })}
      <div style={{ display:'flex',flexDirection:'column',justifyContent:'flex-end',paddingBottom:22,gap:6,flexShrink:0 }}>
        {[[T.green,'Resolvidos'],[T.orange,'Em aberto']].map(([c,l]) => (
          <div key={l} style={{ display:'flex',alignItems:'center',gap:5 }}>
            <div style={{ width:10,height:10,background:c,borderRadius:3 }} />
            <span style={{ fontSize:10,color:T.textSec }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IncidentTable({ incidents, currentSprint }) {
  const rows = incidents.filter((i)=>i.sprints.includes(currentSprint)).sort((a,b)=>new Date(b.created_dt||0)-new Date(a.created_dt||0));
  if (!rows.length) return <Empty label="Nenhum incidente na sprint atual." />;
  const cols = [{l:'Incidente',w:'10%'},{l:'Sprint',w:'8%'},{l:'Criado',w:'11%'},{l:'Término Real',w:'11%'},{l:'Tempo Res.',w:'8%'},{l:'SLA',w:'6%'},{l:'Descrição',w:'36%'},{l:'Status',w:'10%'}];
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%',borderCollapse:'collapse',fontSize:11 }}>
        <thead>
          <tr style={{ background:T.purpleLight }}>
            {cols.map((c)=>(<th key={c.l} style={{ width:c.w,padding:'9px 10px',textAlign:'left',color:T.purple,fontWeight:700,fontSize:10,letterSpacing:.6,textTransform:'uppercase' }}>{c.l}</th>))}
          </tr>
        </thead>
        <tbody>
          {rows.map((inc,idx)=>{
            const isDragged=inc.sprints.length>1&&inc.sprints[0]!==currentSprint;
            const spLabel=isDragged?`⚑ ${inc.sprints.at(-1)||'-'}`:(inc.sprints.at(-1)||'-');
            let tempo='-';
            if(inc.created_dt&&inc.termino_dt){const hrs=(new Date(inc.termino_dt)-new Date(inc.created_dt))/3600000;tempo=`${hrs.toFixed(1)}h`;}
            return (
              <tr key={inc.key} className="sr2-item" style={{ background:isDragged?T.redLight:idx%2===0?'rgba(82,25,161,.025)':'transparent',borderBottom:`1px solid ${T.border}` }}>
                <td style={{ padding:'8px 10px',fontWeight:700,fontSize:10 }}><a href={`${JIRA}/browse/${inc.key}`} target="_blank" rel="noreferrer" style={{ color:T.purpleMid,textDecoration:'none' }}>{inc.sn_id||inc.key}</a></td>
                <td style={{ padding:'8px 10px',color:isDragged?T.red:T.textSec,fontSize:10 }}>{spLabel}</td>
                <td style={{ padding:'8px 10px',color:T.textSec,fontSize:10 }}>{fmtDT(inc.created_dt)}</td>
                <td style={{ padding:'8px 10px',color:T.textSec,fontSize:10 }}>{fmtDT(inc.termino_dt)}</td>
                <td style={{ padding:'8px 10px',color:T.textSec,fontSize:10 }}>{tempo}</td>
                <td style={{ padding:'8px 10px' }}>
                  {inc.sla_met===true&&<Chip text="✓ OK" color={T.green} />}
                  {inc.sla_met===false&&<Chip text="✗ Viola" color={T.red} />}
                  {inc.sla_met===null&&<span style={{ color:T.textMut }}>—</span>}
                </td>
                <td style={{ padding:'8px 10px',color:T.textSec,maxWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{inc.summary}</td>
                <td style={{ padding:'8px 10px' }}><Chip text={inc.status} color={T.purpleMid} size={10} bold={false} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF-safe card (sem backdrop-filter nem rgba)
// ─────────────────────────────────────────────────────────────────────────────
function PC({ children, style = {} }) {
  return (
    <div style={{
      background:'#ffffff', border:'1.5px solid #e0d8f0', borderRadius:14,
      boxShadow:'0 2px 8px rgba(82,25,161,0.07)', overflow:'hidden', ...style,
    }}>{children}</div>
  );
}

function PdfRow({ item, accent, badge, badgeColor, extra, extraColor }) {
  const links = item.linked_issues || [];
  return (
    <div style={{ marginBottom:4 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px',
        borderRadius:8, borderLeft:`3px solid ${accent||T.purpleMid}`,
        background:'rgba(82,25,161,0.02)' }}>
        <span style={{ color:T.purpleMid, fontWeight:800, fontSize:10, flexShrink:0, minWidth:64 }}>{item.key}</span>
        <span style={{ color:T.textSec, fontSize:11, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.summary}</span>
        {extra && (
          <span style={{ background:`${extraColor||T.textSec}18`, color:extraColor||T.textSec, border:`1px solid ${extraColor||T.textSec}25`,
            borderRadius:20, padding:'2px 9px', fontSize:10, fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>{extra}</span>
        )}
        {badge && (
          <span style={{ background:`${badgeColor||T.purpleMid}18`, color:badgeColor||T.purpleMid, border:`1px solid ${badgeColor||T.purpleMid}30`,
            borderRadius:20, padding:'2px 9px', fontSize:10, fontWeight:700, whiteSpace:'nowrap', flexShrink:0 }}>{badge}</span>
        )}
      </div>
      {links.map((li) => {
        const pc = PROJ_COLORS[li.project] || { color:T.textSec, bg:T.purpleLight };
        return (
          <div key={li.key} style={{ display:'flex', alignItems:'center', gap:7,
            marginLeft:16, marginTop:2, padding:'3px 10px',
            borderRadius:6, background:pc.bg+'88', borderLeft:`2px solid ${pc.color}55` }}>
            <span style={{ fontSize:8, fontWeight:800, color:'#fff', background:pc.color, padding:'1px 5px', borderRadius:3, flexShrink:0 }}>{li.project}</span>
            <span style={{ color:pc.color, fontWeight:700, fontSize:9, flexShrink:0 }}>{li.key}</span>
            <span style={{ color:T.textSec, fontSize:9.5, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{li.summary}</span>
            <span style={{ fontSize:9, color:T.textMut, flexShrink:0 }}>{li.status}</span>
          </div>
        );
      })}
    </div>
  );
}

function PdfSprintBlock({ title, color, items_data, sprintsCalendar, currentSprint, sprintKey }) {
  const cal      = sprintsCalendar?.[sprintKey || currentSprint];
  const dateRange = cal ? ` (${fmtDate(cal.start)} até ${fmtDate(cal.end)})` : '';
  return (
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ background:`linear-gradient(135deg,${color},${color}cc)`, padding:'10px 14px', borderRadius:'14px 14px 0 0' }}>
        <div style={{ color:'#fff', fontWeight:800, fontSize:13 }}>{title}</div>
        {dateRange && <div style={{ color:'rgba(255,255,255,0.75)', fontSize:10, marginTop:2 }}>{dateRange}</div>}
      </div>
      <PC style={{ borderRadius:'0 0 14px 14px', padding:'12px 14px' }}>
        {items_data.map(({ sectionTitle, items, kind, color:c }) => (
          <div key={sectionTitle} style={{ marginBottom:12 }}>
            <div style={{ fontSize:9.5, fontWeight:700, color:T.textMut, letterSpacing:1.1, textTransform:'uppercase', marginBottom:5 }}>
              {sectionTitle} · {items.length}
            </div>
            {items.length === 0
              ? <div style={{ color:T.textMut, fontSize:10, fontStyle:'italic', padding:'2px 10px' }}>Nenhum item</div>
              : items.map((it) => {
                  let badge, badgeColor, accent, extra, extraColor;
                  if (kind==='upstream')      { accent=T.yellow; extra=it.status; extraColor=T.textSec; }
                  else if (kind==='downstream') { badge=it.end?fmtDate(it.end):'DN'; badgeColor=T.purpleMid; accent=T.purpleMid; }
                  else if (kind==='homolog')  { const d=it._dias_homolog; badge=d!=null?(d>15?`⚠ ${d}d`:`${d}d`):'Hom.'; badgeColor=d>15?T.red:T.orange; accent=T.orange; }
                  else if (kind==='blocked')  { accent=T.red; }
                  else if (kind==='done')     { badge=it.implant?fmtFull(it.implant):'✓'; badgeColor=T.green; accent=T.green; }
                  else if (kind==='next_homolog') { badge='Hom.'; badgeColor=T.orange; accent=T.orange; }
                  return <PdfRow key={it.key+kind} item={it} accent={accent} badge={badge} badgeColor={badgeColor} extra={extra} extraColor={extraColor} />;
                })
            }
          </div>
        ))}
      </PC>
    </div>
  );
}

function PdfStatChip({ label, value, color }) {
  return (
    <div style={{ flex:1, background:'#ffffff', border:`1.5px solid ${color}30`, borderRadius:12,
      padding:'11px 13px', position:'relative', overflow:'hidden', minWidth:110 }}>
      <div style={{ fontSize:9, color:T.textMut, fontWeight:700, letterSpacing:1.1, textTransform:'uppercase', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:30, fontWeight:900, color, lineHeight:1 }}>{value}</div>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${color},${color}44)` }} />
    </div>
  );
}

function PdfContainer({ pdfRef, data, area, ganttFilters }) {
  const { classification:cls, current_sprint, next_sprint, today,
    sprints_calendar, sprint_order, pi_metrics,
    incidents, incidents_summary, incidents_by_sprint, has_incidents_page } = data;

  return (
    <div ref={pdfRef} style={{
      position:'fixed', left:'-2200px', top:0,
      width:1060, background:'#f8f5ff',
      fontFamily:"Inter,'Helvetica Neue',Helvetica,Arial,sans-serif",
      color:T.textPrim, fontSize:11,
    }}>
      {/* ── Estilos para page-break ── */}
      <style>{`.pdf-break{page-break-before:always;}`}</style>

      {/* ════════════════════════════════════════════
          PÁGINA 1 — Sprint Atual
      ════════════════════════════════════════════ */}
      <div style={{ padding:'20px 24px 24px', background:'#f8f5ff' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          marginBottom:16, paddingBottom:12, borderBottom:`2.5px solid ${T.purple}` }}>
          <div>
            <div style={{ fontSize:22, fontWeight:900, color:T.purple, lineHeight:1 }}>Status Report V2</div>
            <div style={{ fontSize:11, color:T.textMut, marginTop:3 }}>{area} · Gerado em {today}</div>
          </div>
          <div style={{ fontSize:15, fontWeight:800, color:'#fff', background:`linear-gradient(135deg,${T.purple},${T.purpleMid})`,
            padding:'8px 20px', borderRadius:10 }}>Sprint {current_sprint}</div>
        </div>

        {/* Stat chips */}
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          <PdfStatChip label="Upstream"    value={cls.current_upstream.length+cls.next_upstream.length}     color={T.yellow}    />
          <PdfStatChip label="Downstream"  value={cls.current_downstream.length+cls.next_downstream.length} color={T.purpleMid} />
          <PdfStatChip label="Homologação" value={cls.current_homolog.length}                               color={T.orange}    />
          <PdfStatChip label="Entregues"   value={cls.current_done.length}                                  color={T.green}     />
          {has_incidents_page && <PdfStatChip label="Incidentes" value={incidents_summary.total} color={T.red} />}
        </div>

        {/* Sprint columns */}
        <div style={{ display:'flex', gap:14, marginBottom:14 }}>
          <PdfSprintBlock
            title={`⚡ Sprint Atual — ${current_sprint}`} color={T.purple}
            sprintsCalendar={sprints_calendar} currentSprint={current_sprint} sprintKey={current_sprint}
            items_data={[
              {sectionTitle:'Upstream',    items:cls.current_upstream,   kind:'upstream',      color:T.yellow},
              {sectionTitle:'Downstream',  items:cls.current_downstream, kind:'downstream',    color:T.purpleMid},
              {sectionTitle:'Homologação', items:cls.current_homolog,    kind:'homolog',       color:T.orange},
              {sectionTitle:'Bloqueados',  items:cls.current_blocked,    kind:'blocked',       color:T.red},
              {sectionTitle:'Concluídos',  items:cls.current_done,       kind:'done',          color:T.green},
            ]}
          />
          <PdfSprintBlock
            title={`🔮 Próxima Sprint — ${next_sprint}`} color={T.purpleMid}
            sprintsCalendar={sprints_calendar} currentSprint={current_sprint} sprintKey={next_sprint}
            items_data={[
              {sectionTitle:'Upstream',       items:cls.next_upstream,   kind:'upstream',    color:T.yellow},
              {sectionTitle:'Downstream',     items:cls.next_downstream, kind:'downstream',  color:T.purpleMid},
              {sectionTitle:'Hom. Prevista',  items:cls.next_homolog,    kind:'next_homolog',color:T.orange},
            ]}
          />
        </div>

        {/* Calendar strip */}
        {(() => {
          const visible = ['26.2.4','26.2.5','26.2.6','26.3.1','26.3.2','26.3.3','26.3.4','26.3.5','26.3.6'].filter((sp) => sprints_calendar[sp]);
          return (
            <PC style={{ padding:'12px 16px' }}>
              <div style={{ fontSize:9.5, fontWeight:700, color:T.textMut, letterSpacing:1.2, textTransform:'uppercase', marginBottom:8 }}>Calendário PI 26.2 → 26.3</div>
              <div style={{ display:'flex', gap:4 }}>
                {visible.map((sp) => {
                  const isCur=sp===current_sprint, isNxt=sp===next_sprint, cal=sprints_calendar[sp], col=sp.slice(0,4)==='26.2'?T.purple:T.purpleMid;
                  return (
                    <div key={sp} style={{ flex:1, borderRadius:9, padding:'7px 3px', textAlign:'center',
                      background:isCur?`linear-gradient(135deg,${T.purple},${T.purpleMid})`:isNxt?T.yellowLight:T.purpleLight,
                      border:isCur?'none':`1.5px solid ${isNxt?T.yellow+'44':col+'20'}` }}>
                      <div style={{ fontSize:9, fontWeight:800, color:isCur?'#fff':isNxt?T.yellow:col }}>{sp}</div>
                      {cal && <div style={{ fontSize:7.5, color:isCur?'rgba(255,255,255,.65)':T.textMut, marginTop:1 }}>{fmtDate(cal.start)}-{fmtDate(cal.end)}</div>}
                    </div>
                  );
                })}
              </div>
            </PC>
          );
        })()}
      </div>

      {/* ════════════════════════════════════════════
          PÁGINA 2 — Cronograma / Gantt
      ════════════════════════════════════════════ */}
      <div className="pdf-break" style={{ padding:'20px 24px', background:'#f8f5ff' }}>

        <div style={{ fontSize:18, fontWeight:900, color:T.purple, marginBottom:14, paddingBottom:10, borderBottom:`2px solid ${T.purple}` }}>
          📈 Cronograma
        </div>

        <div style={{ display:'flex', gap:14 }}>
          {/* PI sidebar */}
          <div style={{ width:190, flexShrink:0 }}>
            {['26.1','26.2','26.3','26.4'].map((pi) => {
              const piColors = { '26.1':T.textMut, '26.2':T.purple, '26.3':T.purpleMid, '26.4':'#9B59B6' };
              const [ent,plan] = pi_metrics?.[pi]||[0,0];
              const pct = plan>0?Math.min(100,Math.round((ent/plan)*100)):(ent>0?100:0);
              return (
                <PC key={pi} style={{ padding:'12px 14px', marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <span style={{ color:T.textSec, fontSize:12, fontWeight:700 }}>PI {pi}</span>
                    <span style={{ color:piColors[pi], fontWeight:800, fontSize:13 }}>{pi==='26.1'?`${ent}`:`${ent}/${plan}`}</span>
                  </div>
                  <div style={{ height:6, background:`${piColors[pi]}20`, borderRadius:6, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg,${piColors[pi]}cc,${piColors[pi]})`, borderRadius:6 }} />
                  </div>
                  {pi!=='26.1'&&<div style={{ fontSize:9.5, color:T.textMut, marginTop:4 }}>{pct}% entregue</div>}
                </PC>
              );
            })}
          </div>

          {/* Gantt */}
          <PC style={{ flex:1, padding:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.textPrim, marginBottom:12 }}>Épicos Ativos e Backlog Planejado</div>
            <ModernGantt
              items={cls.gantt_full}
              sprintsCalendar={sprints_calendar}
              sprintOrder={sprint_order}
              currentSprint={current_sprint}
              nextSprint={next_sprint}
              today={today}
              filters={ganttFilters}
            />
          </PC>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          PÁGINA 3 — Incidentes (se houver)
      ════════════════════════════════════════════ */}
      {has_incidents_page && (
        <div className="pdf-break" style={{ padding:'20px 24px', background:'#f8f5ff' }}>
          <div style={{ fontSize:18, fontWeight:900, color:T.red, marginBottom:14, paddingBottom:10, borderBottom:`2px solid ${T.red}` }}>
            🚨 Incidentes
          </div>

          <div style={{ display:'flex', gap:10, marginBottom:16 }}>
            <PdfStatChip label="Total Sprint"  value={incidents_summary.total}       color={T.textSec} />
            <PdfStatChip label="Em Aberto"     value={incidents_summary.aberto}      color={T.red}     />
            <PdfStatChip label="Resolvidos"    value={incidents_summary.resolvidos}  color={T.green}   />
            <PdfStatChip label="SLA Violado"   value={incidents_summary.sla_violado} color={T.orange}  />
          </div>

          <PC style={{ padding:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.textPrim, marginBottom:10 }}>
              Incidentes da Sprint Atual — {current_sprint}
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10.5 }}>
              <thead>
                <tr style={{ background:T.purpleLight }}>
                  {['Incidente','Sprint','Criado','Término Real','Tempo Res.','SLA','Descrição','Status'].map((h) => (
                    <th key={h} style={{ padding:'8px 10px', textAlign:'left', color:T.purple, fontWeight:700, fontSize:9.5, letterSpacing:.5, textTransform:'uppercase', borderBottom:`2px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(incidents||[]).filter((i)=>i.sprints.includes(current_sprint)).map((inc,idx) => {
                  let tempo = '-';
                  if (inc.created_dt && inc.termino_dt) {
                    const hrs = (new Date(inc.termino_dt) - new Date(inc.created_dt)) / 3600000;
                    tempo = `${hrs.toFixed(1)}h`;
                  }
                  return (
                    <tr key={inc.key} style={{ background:idx%2===0?'rgba(82,25,161,.025)':'#fff', borderBottom:`1px solid ${T.border}` }}>
                      <td style={{ padding:'7px 10px', fontWeight:700, color:T.purpleMid }}>{inc.sn_id||inc.key}</td>
                      <td style={{ padding:'7px 10px', color:T.textSec }}>{inc.sprints.at(-1)||'-'}</td>
                      <td style={{ padding:'7px 10px', color:T.textSec }}>{fmtDT(inc.created_dt)}</td>
                      <td style={{ padding:'7px 10px', color:T.textSec }}>{fmtDT(inc.termino_dt)}</td>
                      <td style={{ padding:'7px 10px', color:T.textSec }}>{tempo}</td>
                      <td style={{ padding:'7px 10px' }}>
                        {inc.sla_met===true  && <span style={{ color:T.green,  fontWeight:700 }}>✓ OK</span>}
                        {inc.sla_met===false && <span style={{ color:T.red,    fontWeight:700 }}>✗ Viola</span>}
                        {inc.sla_met===null  && <span style={{ color:T.textMut }}>—</span>}
                      </td>
                      <td style={{ padding:'7px 10px', color:T.textSec, maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inc.summary}</td>
                      <td style={{ padding:'7px 10px', color:T.purpleMid }}>{inc.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </PC>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function StatusReportV2() {
  const [searchParams, setSearchParams] = useSearchParams();

  // State sincronizado com URL
  const [area,    setAreaState]   = useState(searchParams.get('area')   || 'G&C');
  const [sprint,  setSprintState] = useState(searchParams.get('sprint') || '');

  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [tab,          setTab]          = useState('sprint');
  const [pdfLoading,   setPdfLoading]   = useState(false);
  const [presentation, setPresentation] = useState(false);
  const [toast,        setToast]        = useState(null);
  const [ganttFilters, setGanttFilters] = useState({ UP:true, DN:true, HM:true });
  const reportRef = useRef(null);
  const pdfRef    = useRef(null);

  // Sync state → URL
  const setArea = (v) => {
    setAreaState(v);
    setSearchParams((p) => { p.set('area', v); if (sprint) p.set('sprint', sprint); else p.delete('sprint'); return p; });
  };
  const setSprint = (v) => {
    setSprintState(v);
    setSearchParams((p) => { p.set('area', area); if (v) p.set('sprint', v); else p.delete('sprint'); return p; });
  };

  const load = useCallback(async (a, s) => {
    setLoading(true); setError(null); setData(null);
    try { setData(await getStatusReport(a, s||null)); }
    catch (e) { setError(e.response?.data?.error || e.message || 'Erro ao carregar'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(area, sprint); }, [area, sprint]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setToast('🔗 Link copiado!');
    }).catch(() => {
      setToast('❌ Não foi possível copiar');
    });
  };

  const downloadPdf = async () => {
    if (!pdfRef.current || !data) return;
    setPdfLoading(true);

    const el = pdfRef.current;
    // Move para viewport (browser só pinta o que está na tela)
    // O overlay de loading cobre o elemento durante a captura
    el.style.position = 'fixed';
    el.style.left     = '0px';
    el.style.top      = '0px';
    el.style.zIndex   = '-1'; // atrás do overlay

    // Aguarda 2 frames para o browser pintar antes de capturar
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    try {
      await html2pdf().set({
        margin: [12, 10, 12, 10],
        filename: `StatusReport_v2_${area}_${data.today?.replace(/-/g,'') || 'export'}.pdf`,
        image: { type:'jpeg', quality:0.97 },
        html2canvas: { scale:2, useCORS:true, logging:false, windowWidth:1060, width:1060, allowTaint:true },
        jsPDF: { unit:'mm', format:'a4', orientation:'landscape' },
        pagebreak: { mode:'css', before:'.pdf-break' },
      }).from(el).save();
    } finally {
      // Devolve para fora da tela
      el.style.left   = '-2200px';
      el.style.zIndex = '';
      setPdfLoading(false);
    }
  };

  const toggleGantt = (key) => setGanttFilters((f) => ({ ...f, [key]:!f[key] }));

  const { classification:cls, current_sprint, next_sprint, today,
    sprints_calendar, sprint_order, pi_metrics,
    incidents, incidents_summary, incidents_by_sprint, has_incidents_page } = data || {};

  const tabs = [
    { id:'sprint',     label:'Sprint',     icon:'⚡' },
    { id:'cronograma', label:'Cronograma', icon:'📈' },
    ...(has_incidents_page ? [{ id:'incidentes', label:'Incidentes', icon:'🚨' }] : []),
  ];

  // Conteúdo de cada slide de apresentação
  const buildSlides = () => {
    if (!data) return [];
    const slides = [
      {
        label: `⚡ Sprint ${current_sprint}`,
        content: (
          <div>
            <div style={{ display:'flex',gap:12,marginBottom:16,flexWrap:'wrap' }}>
              <StatCard delay={0}   label="Upstream"    value={cls.current_upstream.length+cls.next_upstream.length}       color={T.yellow}    glow={T.yellowGlow}  icon="🔼" sub={`${cls.current_upstream.length} atual · ${cls.next_upstream.length} próxima`} />
              <StatCard delay={60}  label="Downstream"  value={cls.current_downstream.length+cls.next_downstream.length}   color={T.purpleMid} glow={T.purpleGlow}  icon="🔽" sub={`${cls.current_downstream.length} atual · ${cls.next_downstream.length} próxima`} />
              <StatCard delay={120} label="Homologação" value={cls.current_homolog.length}                                  color={T.orange}    glow={T.orangeGlow}  icon="🧪" sub={`${cls.next_homolog.length} prevista próxima`} />
              <StatCard delay={180} label="Entregues"   value={cls.current_done.length}                                    color={T.green}     glow={T.greenGlow}   icon="✅" sub={`${cls.finalizados.length} finalizados total`} />
              {cls.current_blocked.length > 0 && <StatCard delay={240} label="Bloqueados" value={cls.current_blocked.length} color={T.red} glow={T.redGlow} icon="🔴" />}
            </div>
            <div style={{ display:'flex',gap:14 }}>
              <SprintCol title={`Sprint Atual — ${current_sprint}`} accentGrad={`linear-gradient(135deg,${T.purple},${T.purpleMid})`} sprintsCalendar={sprints_calendar} currentSprint={current_sprint} sprintKey={current_sprint} delay={0}
                items_data={[{sectionTitle:'Upstream',items:cls.current_upstream,kind:'upstream',color:T.yellow},{sectionTitle:'Downstream',items:cls.current_downstream,kind:'downstream',color:T.purpleMid},{sectionTitle:'Homologação',items:cls.current_homolog,kind:'homolog',color:T.orange},{sectionTitle:'Bloqueados',items:cls.current_blocked,kind:'blocked',color:T.red},{sectionTitle:'Concluídos',items:cls.current_done,kind:'done',color:T.green}]}
              />
              <SprintCol title={`Próxima Sprint — ${next_sprint}`} accentGrad={`linear-gradient(135deg,${T.purpleMid},#9B59B6)`} sprintsCalendar={sprints_calendar} currentSprint={current_sprint} sprintKey={next_sprint} delay={80}
                items_data={[{sectionTitle:'Upstream',items:cls.next_upstream,kind:'upstream',color:T.yellow},{sectionTitle:'Downstream',items:cls.next_downstream,kind:'downstream',color:T.purpleMid},{sectionTitle:'Hom. Prevista',items:cls.next_homolog,kind:'next_homolog',color:T.orange}]}
              />
            </div>
            <CalendarStrip sprintsCalendar={sprints_calendar} currentSprint={current_sprint} nextSprint={next_sprint} />
          </div>
        ),
      },
      {
        label: '📈 Cronograma',
        content: (
          <div style={{ display:'flex',gap:14 }}>
            <PiSidebar piMetrics={pi_metrics} cls={cls} delay={0} />
            <Card delay={100} style={{ flex:1,padding:18 }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
                <div style={{ fontSize:13,fontWeight:700,color:T.textPrim }}>Cronograma — Épicos Ativos e Backlog Planejado</div>
                <GanttFilters filters={ganttFilters} onChange={toggleGantt} />
              </div>
              <ModernGantt items={cls.gantt_full} sprintsCalendar={sprints_calendar} sprintOrder={sprint_order} currentSprint={current_sprint} nextSprint={next_sprint} today={today} filters={ganttFilters} />
            </Card>
          </div>
        ),
      },
    ];
    if (has_incidents_page) slides.push({
      label: '🚨 Incidentes',
      content: (
        <div>
          <div style={{ display:'flex',gap:12,marginBottom:16 }}>
            <StatCard delay={0}   label="Total Sprint"  value={incidents_summary.total}       color={T.textSec}  icon="📋" />
            <StatCard delay={60}  label="Em Aberto"     value={incidents_summary.aberto}      color={T.red}    glow={T.redGlow}    icon="🔴" />
            <StatCard delay={120} label="Resolvidos"    value={incidents_summary.resolvidos}  color={T.green}  glow={T.greenGlow}  icon="✅" />
            <StatCard delay={180} label="SLA Violado"   value={incidents_summary.sla_violado} color={T.orange} glow={T.orangeGlow} icon="⏱️" />
          </div>
          <div style={{ display:'flex',gap:14 }}>
            <Card delay={100} style={{ width:260,flexShrink:0,padding:18 }}>
              <SectionLabel text="Histórico por Sprint" color={T.red} icon="📊" />
              <IncidentChart bySprintData={incidents_by_sprint||{}} currentSprint={current_sprint} sprintOrder={sprint_order} />
            </Card>
            <Card delay={160} style={{ flex:1,padding:18 }}>
              <SectionLabel text={`Incidentes da Sprint Atual — ${current_sprint}`} color={T.red} icon="🚨" />
              <IncidentTable incidents={incidents||[]} currentSprint={current_sprint} />
            </Card>
          </div>
        </div>
      ),
    });
    return slides;
  };

  return (
    <div style={{ minHeight:'100vh',background:T.pageBg,margin:'-32px -24px',padding:'28px 28px 48px',fontFamily:"'Inter','Helvetica Neue',Helvetica,Arial,sans-serif",color:T.textPrim }}>
      <style>{STYLES}</style>

      {/* Overlay durante geração de PDF */}
      {pdfLoading && (
        <div style={{ position:'fixed', inset:0, background:'rgba(248,245,255,0.94)',
          zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center',
          backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)' }}>
          <div style={{ textAlign:'center', color:T.purple }}>
            <div className="sr2-spin" style={{ fontSize:36, marginBottom:14, display:'inline-block' }}>⏳</div>
            <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>Gerando PDF…</div>
            <div style={{ fontSize:12, color:T.textMut }}>Aguarde um momento</div>
          </div>
        </div>
      )}

      {/* Modo apresentação */}
      {presentation && data && (
        <PresentationMode slides={buildSlides()} onExit={() => setPresentation(false)} />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* ── Header ── */}
      <div className="no-print sr2-fade-in" style={{ display:'flex',alignItems:'center',gap:12,marginBottom:24,flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:26,fontWeight:900,letterSpacing:-.8,background:`linear-gradient(135deg,${T.purple},${T.purpleMid})`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' }}>
            Status Report
          </div>
          <div style={{ fontSize:11,color:T.textMut,marginTop:1 }}>Versão Moderna · Cogna Educação</div>
        </div>

        <div style={{ flex:1 }} />

        {/* Area */}
        <select value={area} onChange={(e) => setArea(e.target.value)} style={{ background:T.surfaceSol,color:T.textPrim,border:`1.5px solid ${T.border}`,borderRadius:11,padding:'9px 14px',fontSize:13,outline:'none',cursor:'pointer',boxShadow:T.shadow }}>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        {/* Sprint selector */}
        {sprint_order && (
          <select value={sprint} onChange={(e) => setSprint(e.target.value)} style={{ background:T.surfaceSol,color:T.textPrim,border:`1.5px solid ${T.border}`,borderRadius:11,padding:'9px 14px',fontSize:13,outline:'none',cursor:'pointer',boxShadow:T.shadow }}>
            <option value="">Sprint atual (auto)</option>
            {sprint_order.slice().reverse().map((sp) => (
              <option key={sp} value={sp}>{sp}{sp===current_sprint?' ← atual':''}</option>
            ))}
          </select>
        )}

        {/* Atualizar */}
        <button onClick={() => load(area,sprint)} disabled={loading} style={{ background:`linear-gradient(135deg,${T.purple},${T.purpleMid})`,color:T.white,border:'none',borderRadius:11,padding:'9px 16px',fontSize:13,fontWeight:700,cursor:loading?'not-allowed':'pointer',boxShadow:`0 4px 16px ${T.purpleGlow}`,opacity:loading?.7:1,display:'flex',alignItems:'center',gap:6 }}>
          <span className={loading?'sr2-spin':''} style={{ display:'inline-block' }}>🔄</span>
          {loading?'Carregando…':'Atualizar'}
        </button>

        {/* Apresentação */}
        <button onClick={() => setPresentation(true)} disabled={!data} title="Modo apresentação (fullscreen)" style={{ background:data?T.yellowLight:'rgba(0,0,0,.04)',color:T.yellow,border:`1.5px solid ${T.yellow}44`,borderRadius:11,padding:'9px 16px',fontSize:13,fontWeight:700,cursor:data?'pointer':'not-allowed',opacity:data?1:.5,boxShadow:data?`0 2px 10px ${T.yellowGlow}`:'none' }}>
          🖥️ Apresentar
        </button>

        {/* Compartilhar */}
        <button onClick={copyLink} disabled={!data} title="Copiar link com área e sprint" style={{ background:T.surfaceSol,color:T.purpleMid,border:`1.5px solid ${T.border}`,borderRadius:11,padding:'9px 16px',fontSize:13,fontWeight:600,cursor:data?'pointer':'not-allowed',boxShadow:T.shadow,opacity:data?1:.5 }}>
          🔗 Copiar Link
        </button>

        {/* PDF */}
        <button onClick={downloadPdf} disabled={!data||pdfLoading} style={{ background:T.surfaceSol,color:T.textSec,border:`1.5px solid ${T.border}`,borderRadius:11,padding:'9px 16px',fontSize:13,fontWeight:600,cursor:!data||pdfLoading?'not-allowed':'pointer',boxShadow:T.shadow,opacity:!data||pdfLoading?.55:1 }}>
          {pdfLoading?'⏳ Gerando…':'⬇️ Baixar PDF'}
        </button>

        {data && (
          <div style={{ fontSize:12,color:T.textSec,background:T.surfaceSol,padding:'8px 14px',borderRadius:10,border:`1.5px solid ${T.border}`,boxShadow:T.shadow }}>
            Sprint <strong style={{ color:T.purple }}>{current_sprint}</strong>
            <span style={{ margin:'0 6px',color:T.textMut }}>·</span>
            {today}
          </div>
        )}
      </div>

      {error && (
        <div className="sr2-fade-up" style={{ background:T.redLight,border:`1.5px solid ${T.red}44`,borderRadius:14,padding:'14px 18px',marginBottom:20,color:T.red,fontSize:13 }}>⚠️ {error}</div>
      )}

      {loading && <LoadingState />}

      {/* ── Container dedicado ao PDF – sempre renderizado fora da tela ── */}
      {data && <PdfContainer pdfRef={pdfRef} data={data} area={area} ganttFilters={ganttFilters} />}

      {data && (
        <div ref={reportRef}>
          {/* Metric cards */}
          <div style={{ display:'flex',gap:12,marginBottom:20,flexWrap:'wrap' }}>
            <StatCard delay={0}   label="Upstream"    value={cls.current_upstream.length+cls.next_upstream.length}     color={T.yellow}    glow={T.yellowGlow}  icon="🔼" sub={`${cls.current_upstream.length} atual · ${cls.next_upstream.length} próxima`} />
            <StatCard delay={60}  label="Downstream"  value={cls.current_downstream.length+cls.next_downstream.length} color={T.purpleMid} glow={T.purpleGlow}  icon="🔽" sub={`${cls.current_downstream.length} atual · ${cls.next_downstream.length} próxima`} />
            <StatCard delay={120} label="Homologação" value={cls.current_homolog.length}                                color={T.orange}    glow={T.orangeGlow}  icon="🧪" sub={`${cls.next_homolog.length} prevista próxima`} />
            <StatCard delay={180} label="Entregues"   value={cls.current_done.length}                                  color={T.green}     glow={T.greenGlow}   icon="✅" sub={`${cls.finalizados.length} finalizados total`} />
            {cls.current_blocked.length > 0 && <StatCard delay={220} label="Bloqueados" value={cls.current_blocked.length} color={T.red} glow={T.redGlow} icon="🔴" />}
            {has_incidents_page && <StatCard delay={260} label="Incidentes" value={incidents_summary.total} color={T.red} glow={T.redGlow} icon="🚨" sub={`${incidents_summary.aberto} em aberto`} />}
          </div>

          {/* Tabs */}
          <div className="no-print sr2-fade-up" style={{ marginBottom:18,animationDelay:'280ms' }}>
            <TabBar active={tab} onChange={setTab} tabs={tabs} />
          </div>

          {/* Tab: Sprint */}
          {tab==='sprint' && (
            <div>
              <div style={{ display:'flex',gap:14,marginBottom:14 }}>
                <SprintCol title={`⚡ Sprint Atual — ${current_sprint}`} accentGrad={`linear-gradient(135deg,${T.purple},${T.purpleMid})`} sprintsCalendar={sprints_calendar} currentSprint={current_sprint} sprintKey={current_sprint} delay={0}
                  items_data={[{sectionTitle:'Upstream',items:cls.current_upstream,kind:'upstream',color:T.yellow},{sectionTitle:'Downstream',items:cls.current_downstream,kind:'downstream',color:T.purpleMid},{sectionTitle:'Homologação',items:cls.current_homolog,kind:'homolog',color:T.orange},{sectionTitle:'Bloqueados',items:cls.current_blocked,kind:'blocked',color:T.red},{sectionTitle:'Concluídos',items:cls.current_done,kind:'done',color:T.green}]}
                />
                <SprintCol title={`🔮 Próxima Sprint — ${next_sprint}`} accentGrad={`linear-gradient(135deg,${T.purpleMid},#9B59B6)`} sprintsCalendar={sprints_calendar} currentSprint={current_sprint} sprintKey={next_sprint} delay={80}
                  items_data={[{sectionTitle:'Upstream',items:cls.next_upstream,kind:'upstream',color:T.yellow},{sectionTitle:'Downstream',items:cls.next_downstream,kind:'downstream',color:T.purpleMid},{sectionTitle:'Hom. Prevista',items:cls.next_homolog,kind:'next_homolog',color:T.orange}]}
                />
              </div>
              <CalendarStrip sprintsCalendar={sprints_calendar} currentSprint={current_sprint} nextSprint={next_sprint} />
            </div>
          )}

          {/* Tab: Cronograma */}
          {tab==='cronograma' && (
            <div>
              <div style={{ display:'flex',gap:14,marginBottom:14 }}>
                <PiSidebar piMetrics={pi_metrics} cls={cls} delay={0} />
                <Card delay={100} style={{ flex:1,padding:18 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8 }}>
                    <div style={{ fontSize:13,fontWeight:700,color:T.textPrim }}>Cronograma — Épicos Ativos e Backlog Planejado</div>
                    <GanttFilters filters={ganttFilters} onChange={toggleGantt} />
                  </div>
                  <ModernGantt items={cls.gantt_full} sprintsCalendar={sprints_calendar} sprintOrder={sprint_order} currentSprint={current_sprint} nextSprint={next_sprint} today={today} filters={ganttFilters} />
                </Card>
              </div>

              {/* Sem Priorização */}
              <Card delay={200} style={{ padding:18 }}>
                <SectionLabel text={`Sem Priorização · ${cls.sem_priorizacao.length}`} color={T.red} icon="⚠️" />
                <div style={{ fontSize:11,color:T.textMut,marginBottom:12,marginTop:-4 }}>itens em Backlog ou Funil sem data de início nem fim</div>
                {cls.sem_priorizacao.length === 0
                  ? <Empty label="Nenhum item sem priorização" />
                  : (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:'2px 14px' }}>
                      {cls.sem_priorizacao.map((it, i) => (
                        <ItemRow key={it.key} item={it}
                          accent={T.red} bg={T.redLight}
                          badge={it.status} badgeColor={T.red}
                          delay={i * 15} />
                      ))}
                    </div>
                  )
                }
              </Card>
            </div>
          )}

          {/* Tab: Incidentes */}
          {tab==='incidentes' && has_incidents_page && (
            <div>
              <div style={{ display:'flex',gap:12,marginBottom:16 }}>
                <StatCard delay={0}   label="Total Sprint"  value={incidents_summary.total}       color={T.textSec}  icon="📋" />
                <StatCard delay={60}  label="Em Aberto"     value={incidents_summary.aberto}      color={T.red}    glow={T.redGlow}    icon="🔴" />
                <StatCard delay={120} label="Resolvidos"    value={incidents_summary.resolvidos}  color={T.green}  glow={T.greenGlow}  icon="✅" />
                <StatCard delay={180} label="SLA Violado"   value={incidents_summary.sla_violado} color={T.orange} glow={T.orangeGlow} icon="⏱️" />
              </div>
              <div style={{ display:'flex',gap:14 }}>
                <Card delay={100} style={{ width:260,flexShrink:0,padding:18 }}>
                  <SectionLabel text="Histórico por Sprint" color={T.red} icon="📊" />
                  <IncidentChart bySprintData={incidents_by_sprint||{}} currentSprint={current_sprint} sprintOrder={sprint_order} />
                </Card>
                <Card delay={160} style={{ flex:1,padding:18 }}>
                  <SectionLabel text={`Incidentes da Sprint Atual — ${current_sprint}`} color={T.red} icon="🚨" />
                  <IncidentTable incidents={incidents||[]} currentSprint={current_sprint} />
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
