import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../components/StatusBadge';
import {
  getSprints,
  getDocumentacao,
  gerarDocumentacao,
  publishConfluence,
  sendEmailDoc,
  getDocHistorico,
} from '../services/api';

const JIRA_BASE = 'https://cogna.atlassian.net';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Sub-components ────────────────────────────────────────────────────────────

function CheckItem({ ok, label }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className={`text-base leading-none flex-shrink-0 ${ok ? 'text-green-500' : 'text-red-400'}`}>
        {ok ? '✅' : '❌'}
      </span>
      <span className={`text-sm ${ok ? 'text-gray-700' : 'text-gray-500'}`}>{label}</span>
    </div>
  );
}

function SectionHR({ num, title }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-2">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-700 text-white flex items-center justify-center text-xs font-bold">
        {num}
      </div>
      <h2 className="text-base font-bold text-gray-900 border-b-2 border-primary-700 flex-1 pb-1">{title}</h2>
    </div>
  );
}

function SubSection({ title }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mt-4 mb-2">{title}</p>
  );
}

function DocCardRow({ card }) {
  return (
    <div className="flex items-center gap-3 py-2 text-sm border-b last:border-0 border-gray-100">
      <a
        href={`${JIRA_BASE}/browse/${card.card}`}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-xs text-primary-600 hover:text-primary-800 flex-shrink-0"
      >
        {card.card}
      </a>
      <span className="flex-1 text-gray-700 truncate text-xs" title={card.tema}>{card.tema}</span>
      <div className="flex-shrink-0"><StatusBadge status={card.status_jira} /></div>
      {card.sprints_arrastando > 0 && (
        <span className="flex-shrink-0 text-xs text-orange-500 font-medium">×{card.sprints_arrastando}</span>
      )}
    </div>
  );
}

function BulletLines({ text }) {
  if (!text?.trim()) return <p className="text-xs italic text-gray-400">Nenhuma informação preenchida.</p>;
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="h-1" />;
        return (
          <div key={i} className="flex gap-2 text-xs text-gray-700">
            <span className="flex-shrink-0 text-gray-400">•</span>
            <span>{t.replace(/^[•\-]\s*/, '')}</span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyRow() {
  return (
    <p className="text-xs italic text-gray-400 py-1.5">Nenhum item nesta categoria.</p>
  );
}

function DocPreview({ doc }) {
  if (!doc) return null;
  const { planning, review, report, epics, sprint_id } = doc;
  const m  = review?.metricas;
  const d  = review?.delta;
  const pa = report?.manual?.proximas_atividades || {};
  const now = new Date().toLocaleDateString('pt-BR');

  const EPIC_COLOR = {
    Bloqueado: '#ef4444', 'Em Andamento': '#f59e0b', Homologação: '#f97316',
    Pronto: '#3b82f6', Concluído: '#22c55e', Aceito: '#22c55e', Backlog: '#9ca3af',
  };

  const sign = (n) => (n == null ? '' : n >= 0 ? `+${n}` : `${n}`);

  const PEND_ITEMS = [
    { title: 'Pendente com G&C (Homologação)',         cards: report?.pendencias?.homologacao,      dk: 'homologacao_data'  },
    { title: 'Produto de Dados — Refinamento (DAPL)',  cards: report?.pendencias?.refinamento_dapl, dk: 'refinamento_data'  },
    { title: 'Engenharia de Dados (DENA)',             cards: report?.pendencias?.engenharia_dena,  dk: 'engenharia_data'   },
    { title: 'Plataforma — Ingestão (DDPL)',           cards: report?.pendencias?.plataforma_ddpl,  dk: 'plataforma_data'   },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow text-sm text-gray-900 overflow-hidden doc-preview-print">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-900 to-primary-700 px-8 py-6">
        <p className="text-primary-300 text-xs font-semibold uppercase tracking-widest">Squad G&C e Captação</p>
        <h1 className="text-white text-2xl font-extrabold mt-1">Sprint {sprint_id} — Status Report</h1>
        <p className="text-primary-300 text-xs mt-1.5">Gerado em {now}</p>
      </div>

      {/* Metrics bar */}
      {m && (
        <div className="grid grid-cols-4 bg-primary-50 border-b border-primary-200">
          {[
            { n: `${m.taxaEntrega}%`, l: 'Taxa de Entrega', c: 'text-primary-800' },
            { n: `${m.concluidos}/${m.total}`, l: 'Concluídos',    c: 'text-gray-900'  },
            { n: m.transbordaram,              l: 'Transbordaram', c: 'text-red-600'   },
            { n: m.bloqueados,                 l: 'Bloqueados',    c: 'text-amber-600' },
          ].map(({ n, l, c }) => (
            <div key={l} className="text-center py-4 px-2">
              <p className={`text-2xl font-extrabold ${c}`}>{n}</p>
              <p className="text-xs text-gray-500 uppercase font-semibold mt-0.5">{l}</p>
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="p-8 space-y-8">

        {/* ── 1. Planning ── */}
        <section>
          <SectionHR num={1} title="Resumo da Planning" />
          <p className="text-xs text-gray-600 mb-3">
            <span className="font-semibold">Total de cards planejados:</span> {planning?.total}
          </p>

          <SubSection title="Por Time" />
          <div className="rounded-lg border border-gray-100 overflow-hidden mb-4">
            {Object.entries(planning?.byTime || {})
              .sort(([, a], [, b]) => b - a)
              .map(([time, n], i) => (
                <div key={time} className={`flex items-center justify-between px-4 py-2.5 text-xs ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <span className="text-gray-700">{time}</span>
                  <span className="font-semibold text-gray-900">{n} card{n > 1 ? 's' : ''}</span>
                </div>
              ))}
          </div>

          <SubSection title="Cards Planejados" />
          <div className="rounded-lg border border-gray-100 overflow-hidden">
            {(planning?.cards || []).map((c) => (
              <div key={c.card} className="flex items-center gap-3 px-4 py-2 text-xs border-b last:border-0 border-gray-100 even:bg-gray-50">
                <a href={`${JIRA_BASE}/browse/${c.card}`} target="_blank" rel="noreferrer"
                  className="font-mono text-primary-600 hover:text-primary-800 flex-shrink-0">{c.card}</a>
                <span className="flex-1 text-gray-700 truncate" title={c.tema}>{c.tema}</span>
                <span className="text-gray-500 flex-shrink-0 hidden sm:block">{c.time}</span>
                <span className="text-gray-400 flex-shrink-0">{c.sprint_inicio}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 2. Review ── */}
        <section>
          <SectionHR num={2} title="Resumo da Review" />

          {d && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 mb-4 text-xs">
              <span className="font-semibold text-gray-600">vs Sprint {d.sprint_anterior}: </span>
              {[
                { l: 'Total', v: d.total, dir: 'neutral' },
                { l: 'Taxa', v: `${sign(d.taxa_entrega)}%`, dir: 'up', raw: d.taxa_entrega },
                { l: 'Transbordamentos', v: d.transbordamentos, dir: 'down' },
                { l: 'Bloqueados', v: d.bloqueados, dir: 'down' },
              ].map(({ l, v, dir, raw }) => {
                const val  = raw ?? v;
                const color = typeof val === 'number' && val !== 0
                  ? (dir === 'up' ? (val > 0 ? 'text-green-600' : 'text-red-500') :
                     dir === 'down' ? (val < 0 ? 'text-green-600' : 'text-red-500') : 'text-primary-600')
                  : 'text-gray-500';
                return (
                  <span key={l} className="mr-4">
                    {l}: <span className={`font-bold ${color}`}>{typeof v === 'number' ? sign(v) : v}</span>
                  </span>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: '✅', label: `Entregues (${review?.entregues?.length || 0})`,      cards: review?.entregues },
              { icon: '⚠️', label: `Transbordaram (${review?.transbordaram?.length || 0})`, cards: review?.transbordaram },
              { icon: '🚫', label: `Bloqueados (${review?.bloqueados?.length || 0})`,    cards: review?.bloqueados },
            ].map(({ icon, label, cards }) => (
              <div key={label} className="rounded-lg border border-gray-100 overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-600">
                  {icon} {label}
                </div>
                <div className="px-3 py-1">
                  {cards?.length ? cards.map((c) => <DocCardRow key={c.card} card={c} />) : <EmptyRow />}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 3. Status Report ── */}
        <section>
          <SectionHR num={3} title="Status Report" />

          <SubSection title="3.1 Atualizações / Evoluções" />
          <BulletLines text={report?.manual?.atualizacoes} />

          <SubSection title="3.2 Entregas da Sprint" />
          {[
            { label: 'Produto de Dados (DAPL)',          cards: report?.entregas?.dapl },
            { label: 'Plataforma — Ingestão (DDPL)',      cards: report?.entregas?.ddpl },
            { label: 'Engenharia de Dados (DENA)',        cards: report?.entregas?.dena },
          ].map(({ label, cards }) => (
            <div key={label} className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
              <div className="rounded-lg border border-gray-100 px-3">
                {cards?.length ? cards.map((c) => <DocCardRow key={c.card} card={c} />) : <EmptyRow />}
              </div>
            </div>
          ))}

          <SubSection title="3.3 Próximas Atividades / Pendências" />
          {PEND_ITEMS.map(({ title, cards, dk }) => (
            <div key={dk} className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1">{title}</p>
              <div className="rounded-lg border border-gray-100 px-3">
                {cards?.length ? cards.map((c) => <DocCardRow key={c.card} card={c} />) : <EmptyRow />}
              </div>
              {pa[dk] && (
                <p className="text-xs text-gray-500 mt-1 pl-1">📅 Data prevista: <span className="font-medium text-gray-700">{pa[dk]}</span></p>
              )}
            </div>
          ))}

          <SubSection title="3.4 Status por Épico" />
          {epics?.length ? (
            <div className="space-y-3">
              {epics.map((epic) => {
                const pct = epic.total > 0 ? Math.round((epic.done / epic.total) * 100) : 0;
                const color = EPIC_COLOR[epic.status] ?? '#9ca3af';
                return (
                  <div key={epic.key} className="rounded-lg border border-gray-100 px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <a href={`${JIRA_BASE}/browse/${epic.key}`} target="_blank" rel="noreferrer"
                          className="font-mono text-xs text-primary-600">{epic.key}</a>
                        <span className="text-xs text-gray-700 truncate max-w-xs" title={epic.summary}>{epic.summary}</span>
                        <StatusBadge status={epic.status} />
                      </div>
                      <span className="text-sm font-bold text-gray-700 flex-shrink-0">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{epic.done}/{epic.total} histórias</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs italic text-gray-400">
              Dados de épicos não disponíveis. Gere o documento para buscar do Jira.
            </p>
          )}

          <SubSection title="3.5 Riscos / Pontos de Atenção" />
          <BulletLines text={report?.manual?.riscos} />
        </section>
      </div>
    </div>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  const bg = toast.type === 'success' ? 'bg-green-600' : 'bg-red-600';
  return (
    <div className={`fixed bottom-6 right-6 z-50 ${bg} text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl max-w-sm`}>
      {toast.msg}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Documentacao() {
  const [sprints,  setSprints]  = useState([]);
  const [sprintId, setSprintId] = useState('');
  const [docData,  setDocData]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStep,    setGenStep]    = useState('');
  const [history,  setHistory]  = useState([]);
  const [toast,    setToast]    = useState(null);

  // Confluence modal
  const [showConf,    setShowConf]    = useState(false);
  const [confTitle,   setConfTitle]   = useState('');
  const [publishing,  setPublishing]  = useState(false);
  const [confResult,  setConfResult]  = useState(null);

  // Email modal
  const [showEmail,    setShowEmail]    = useState(false);
  const [emailTo,      setEmailTo]      = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const loadHistory = useCallback(() => {
    getDocHistorico('gc').then(setHistory).catch(() => {});
  }, []);

  useEffect(() => {
    getSprints().then((data) => {
      setSprints(data);
      if (data.length) setSprintId(data[data.length - 1].id);
    });
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!sprintId) return;
    setLoading(true);
    setDocData(null);
    getDocumentacao(sprintId)
      .then((data) => {
        setDocData(data);
        setConfTitle(`Sprint ${sprintId} — G&C — Status Report`);
        setEmailSubject(`[G&C] Status Report — Sprint ${sprintId}`);
        setEmailTo((data.email_destinatarios || []).join('\n'));
      })
      .catch(() => setDocData(null))
      .finally(() => setLoading(false));
  }, [sprintId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenStep('Buscando Planning…');
    const apiCall = gerarDocumentacao(sprintId);

    await delay(600);
    setGenStep('Buscando Review…');
    await delay(600);
    setGenStep('Compilando Report…');

    try {
      const data = await apiCall;
      setDocData(data);
      loadHistory();
      setGenStep('Pronto! ✓');
      setTimeout(() => { setGenerating(false); setGenStep(''); }, 1500);
    } catch {
      setGenStep('Erro ao gerar');
      setTimeout(() => { setGenerating(false); setGenStep(''); }, 2000);
    }
  };

  const handleConfluence = async () => {
    setPublishing(true);
    setConfResult(null);
    try {
      const result = await publishConfluence(sprintId, { title: confTitle });
      setConfResult(result);
      setDocData((prev) => prev ? { ...prev, meta: { ...prev.meta, status: 'publicado', confluence: { ...result, publicado: true } } } : prev);
      loadHistory();
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Erro ao publicar no Confluence');
      setShowConf(false);
    } finally {
      setPublishing(false);
    }
  };

  const handleEmail = async () => {
    const recipients = emailTo.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!recipients.length) return showToast('error', 'Adicione pelo menos um destinatário');
    setSendingEmail(true);
    try {
      await sendEmailDoc(sprintId, { destinatarios: recipients, assunto: emailSubject });
      showToast('success', `E-mail enviado para ${recipients.length} destinatário(s)`);
      setShowEmail(false);
      loadHistory();
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Erro ao enviar e-mail');
    } finally {
      setSendingEmail(false);
    }
  };

  const checks        = docData?.checks;
  const allOk         = docData?.allChecksOk;
  const confEnabled   = docData?.config?.confluence;
  const smtpEnabled   = docData?.config?.smtp;
  const wasGenerated  = !!docData?.meta?.gerado_em;
  const meta          = docData?.meta;

  const failedChecks  = checks
    ? Object.values(checks).filter((c) => !c.ok).map((c) => c.label)
    : [];

  const statusColor = (s) =>
    s === 'publicado' ? 'text-green-600' : s === 'rascunho' ? 'text-primary-500' : 'text-gray-400';
  const statusLabel = (s) =>
    s === 'publicado' ? '✅ Publicado' : s === 'rascunho' ? '📄 Rascunho' : '⏳ Pendente';

  // ── Render ──
  return (
    <div className="space-y-4">

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap no-print">
        <h1 className="text-2xl font-bold text-gray-900 mr-2">Documentação</h1>
        <select
          value={sprintId}
          onChange={(e) => setSprintId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>Sprint {s.id}</option>
          ))}
        </select>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-5 items-start">

        {/* ── LEFT PANEL ── */}
        <div className="w-72 flex-shrink-0 space-y-4 no-print">

          {/* Status checks */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Status da Documentação</p>
            {checks ? (
              <>
                {Object.values(checks).map((c) => (
                  <CheckItem key={c.label} ok={c.ok} label={c.label} />
                ))}
              </>
            ) : (
              <p className="text-xs text-gray-400 italic">Carregando…</p>
            )}

            <div className="mt-4 pt-3 border-t border-gray-100">
              <div
                title={!allOk && failedChecks.length ? `Pendente: ${failedChecks.join(', ')}` : ''}
                className={!allOk ? 'cursor-not-allowed' : ''}
              >
                <button
                  onClick={handleGenerate}
                  disabled={!allOk || generating || loading}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    allOk && !generating
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {generating ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {genStep}
                    </>
                  ) : '⚡ Gerar Documentação'}
                </button>
              </div>
              {!allOk && failedChecks.length > 0 && (
                <p className="text-xs text-red-400 mt-2">
                  Pendente: {failedChecks.join(' · ')}
                </p>
              )}
              {wasGenerated && meta && (
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Gerado em {new Date(meta.gerado_em).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>

          {/* Publish section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Publicar</p>

            <div className="space-y-2">
              {/* Confluence */}
              <div title={!confEnabled ? 'Configure as credenciais no .env para habilitar' : !wasGenerated ? 'Gere o documento primeiro' : ''}>
                <button
                  onClick={() => { setConfResult(null); setShowConf(true); }}
                  disabled={!confEnabled || !wasGenerated}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    confEnabled && wasGenerated
                      ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  <span>📘</span>
                  <span className="flex-1 text-left">Confluence</span>
                  {meta?.confluence?.publicado && <span className="text-xs text-green-500">✓</span>}
                </button>
              </div>

              {/* Email */}
              <div title={!smtpEnabled ? 'Configure as credenciais no .env para habilitar' : !wasGenerated ? 'Gere o documento primeiro' : ''}>
                <button
                  onClick={() => setShowEmail(true)}
                  disabled={!smtpEnabled || !wasGenerated}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    smtpEnabled && wasGenerated
                      ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  <span>📧</span>
                  <span className="flex-1 text-left">E-mail</span>
                  {meta?.email?.enviado && <span className="text-xs text-green-500">✓</span>}
                </button>
              </div>

              {/* PDF */}
              <button
                onClick={() => window.print()}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span>⬇️</span>
                <span className="flex-1 text-left">Exportar PDF</span>
              </button>
            </div>

            {/* Confluence link if published */}
            {meta?.confluence?.page_url && (
              <a
                href={meta.confluence.page_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800"
              >
                <span>🔗</span> Ver no Confluence
              </a>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Histórico</p>
              <div className="space-y-1">
                {history.map((h) => (
                  <div key={h.sprint_id}>
                    <button
                      onClick={() => setSprintId(h.sprint_id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors hover:bg-gray-50 ${
                        sprintId === h.sprint_id ? 'bg-primary-50 text-primary-700' : ''
                      }`}
                    >
                      <span className="text-xs font-medium text-gray-700">Sprint {h.sprint_id}</span>
                      <div className="flex items-center gap-1.5">
                        {h.confluence?.publicado && (
                          <a href={h.confluence.page_url} target="_blank" rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary-400 hover:text-primary-600 text-xs" title="Ver no Confluence">📘</a>
                        )}
                        {h.email?.enviado && <span className="text-xs text-green-400" title="E-mail enviado">📧</span>}
                        <span className={`text-xs font-medium ${statusColor(h.status)}`}>
                          {statusLabel(h.status)}
                        </span>
                      </div>
                    </button>
                    {h.gerado_em && (
                      <p className="text-xs text-gray-400 px-3 pb-1">
                        {new Date(h.gerado_em).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="flex-1 min-w-0">
          {loading && (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <p className="text-gray-400 animate-pulse text-sm">Carregando…</p>
            </div>
          )}
          {!loading && docData && <DocPreview doc={docData} />}
          {!loading && !docData && (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
              <p className="text-3xl mb-3">📄</p>
              <p className="text-gray-500 text-sm">Selecione uma sprint para visualizar o documento.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Confluence Modal ── */}
      {showConf && (
        <Modal title="📘 Publicar no Confluence" onClose={() => { setShowConf(false); setConfResult(null); }}>
          {confResult ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">🎉</div>
              <p className="text-green-600 font-semibold">Publicado com sucesso!</p>
              <a href={confResult.page_url} target="_blank" rel="noreferrer"
                className="inline-block text-sm text-primary-600 hover:text-primary-800 underline break-all">
                {confResult.page_url}
              </a>
              <button
                onClick={() => setShowConf(false)}
                className="block w-full mt-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
              >
                Fechar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Título da página</label>
                <input
                  value={confTitle}
                  onChange={(e) => setConfTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <p className="text-xs text-gray-500">
                O documento será publicado no espaço <code className="bg-gray-100 px-1 rounded">{'{CONFLUENCE_SPACE_KEY}'}</code> configurado no <code className="bg-gray-100 px-1 rounded">.env</code>.
                Se a página já existe, ela será atualizada.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowConf(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfluence}
                  disabled={publishing || !confTitle.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
                >
                  {publishing && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {publishing ? 'Publicando…' : 'Publicar'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ── Email Modal ── */}
      {showEmail && (
        <Modal title="📧 Enviar por E-mail" onClose={() => setShowEmail(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">
                Destinatários <span className="font-normal text-gray-400">(um por linha)</span>
              </label>
              <textarea
                rows={4}
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="email@cogna.com.br"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Assunto</label>
              <input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Preview */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Preview do conteúdo</label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 max-h-56 overflow-y-auto text-xs text-gray-600 space-y-2">
                <p className="font-bold text-gray-800">Sprint {sprintId} — Status Report</p>
                {docData?.review?.metricas && (
                  <p>
                    Taxa de entrega: <strong>{docData.review.metricas.taxaEntrega}%</strong> ·
                    Concluídos: <strong>{docData.review.metricas.concluidos}/{docData.review.metricas.total}</strong> ·
                    Transbordaram: <strong>{docData.review.metricas.transbordaram}</strong>
                  </p>
                )}
                <p className="text-gray-500 italic">
                  O e-mail incluirá atualizações, entregas, pendências e riscos conforme preenchido no Report.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowEmail(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEmail}
                disabled={sendingEmail || !emailTo.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
              >
                {sendingEmail && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {sendingEmail ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <Toast toast={toast} />
    </div>
  );
}
