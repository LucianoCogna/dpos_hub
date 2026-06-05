const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch { /* not installed */ }

// ── File paths ───────────────────────────────────────────────────────────────
const SPRINTS_FILE  = path.join(__dirname, '../data/sprints.json');
const REPORTS_FILE  = path.join(__dirname, '../data/reports.json');
const DOCS_FILE     = path.join(__dirname, '../data/documentacao.json');
const PROJETOS_FILE = path.join(__dirname, '../data/projetos.json');

// ── Helpers ──────────────────────────────────────────────────────────────────
function loadJSON(file, def = {}) {
  if (!fs.existsSync(file)) return def;
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return def; }
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Domain constants ─────────────────────────────────────────────────────────
const DONE = ['Concluído', 'Aceito'];
const pfx  = (key) => key?.split('-')[0] || '';

// ── Shared logic ─────────────────────────────────────────────────────────────
function calcSituacao(status) {
  if (DONE.includes(status)) return 'entregue';
  if (status === 'Bloqueado') return 'bloqueado';
  if (['Em Andamento', 'Homologação'].includes(status)) return 'em_andamento';
  return 'transbordou';
}
function calcMetricas(cards) {
  const total        = cards.length;
  const concluidos   = cards.filter((c) => DONE.includes(c.status_jira)).length;
  const bloqueados   = cards.filter((c) => c.status_jira === 'Bloqueado').length;
  const emAndamento  = cards.filter((c) => c.status_jira === 'Em Andamento').length;
  const transbordaram = total - concluidos;
  const taxaEntrega  = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  return { total, concluidos, transbordaram, bloqueados, emAndamento, taxaEntrega };
}
function calcSprintsArrastando(cardKey, currentSprintId, allSprints) {
  const sorted = Object.keys(allSprints).sort();
  const idx    = sorted.indexOf(currentSprintId);
  let count    = 0;
  for (let i = idx - 1; i >= 0; i--) {
    const found = (allSprints[sorted[i]].cards || []).find((c) => c.card === cardKey);
    if (!found || DONE.includes(found.status_jira)) break;
    count++;
  }
  return count;
}
function groupCards(cards) {
  const done    = cards.filter((c) => DONE.includes(c.status_jira));
  const pending = cards.filter((c) => !DONE.includes(c.status_jira));
  return {
    entregas: {
      dapl: done.filter((c) => pfx(c.card) === 'DAPL'),
      ddpl: done.filter((c) => pfx(c.card) === 'DDPL'),
      dena: done.filter((c) => pfx(c.card) === 'DENA'),
    },
    pendencias: {
      homologacao:      pending.filter((c) => c.status_jira === 'Homologação'),
      refinamento_dapl: pending.filter((c) => ['Refinamento', 'Funil', 'Backlog'].includes(c.status_jira) && pfx(c.card) === 'DAPL'),
      engenharia_dena:  pending.filter((c) => pfx(c.card) === 'DENA'),
      plataforma_ddpl:  pending.filter((c) => pfx(c.card) === 'DDPL'),
    },
  };
}

// ── Jira ─────────────────────────────────────────────────────────────────────
function jiraHeaders() {
  const token = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString('base64');
  return { Authorization: `Basic ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' };
}
async function fetchAll(jql, fields) {
  let nextPageToken = null;
  const items = [];
  do {
    const payload = { jql, fields, maxResults: 100 };
    if (nextPageToken) payload.nextPageToken = nextPageToken;
    const res = await axios.post(
      `${process.env.JIRA_BASE_URL}/rest/api/3/search/jql`,
      payload,
      { headers: jiraHeaders() }
    );
    items.push(...(res.data.issues || []));
    nextPageToken = res.data.isLast ? null : (res.data.nextPageToken || null);
  } while (nextPageToken);
  return items;
}
async function fetchEpicsData() {
  if (!process.env.JIRA_BASE_URL || !process.env.JIRA_TOKEN) return [];
  const [epicIssues, storyIssues] = await Promise.all([
    fetchAll('labels = "G&C" AND issuetype = Épico', ['summary', 'status']),
    fetchAll('labels = "G&C" AND issuetype = "História (M)"', ['summary', 'status', 'customfield_10014', 'parent']),
  ]);
  const epicMap = {};
  epicIssues.forEach((e) => {
    epicMap[e.key] = { key: e.key, summary: e.fields.summary, status: e.fields.status.name, total: 0, done: 0 };
  });
  storyIssues.forEach((s) => {
    const epicKey = s.fields.customfield_10014 || s.fields.parent?.key;
    if (epicKey && epicMap[epicKey]) {
      epicMap[epicKey].total++;
      if (DONE.includes(s.fields.status.name)) epicMap[epicKey].done++;
    }
  });
  return Object.values(epicMap);
}

// ── Core doc builder (sync) ───────────────────────────────────────────────────
function buildDocSync(sprintId) {
  const allSprints = loadJSON(SPRINTS_FILE);
  const reports    = loadJSON(REPORTS_FILE);
  const sprint     = allSprints[sprintId];
  if (!sprint) return null;

  const cards    = sprint.cards || [];
  const metricas = calcMetricas(cards);
  const manual   = reports[sprintId] || {};
  const grouped  = groupCards(cards);

  const enriched = cards.map((c) => ({
    ...c,
    situacao:           calcSituacao(c.status_jira),
    sprints_arrastando: calcSprintsArrastando(c.card, sprintId, allSprints),
  }));

  const sortedIds = Object.keys(allSprints).sort();
  const idx       = sortedIds.indexOf(sprintId);
  const prevId    = idx > 0 ? sortedIds[idx - 1] : null;
  let delta       = null;
  if (prevId) {
    const prev = calcMetricas(allSprints[prevId].cards || []);
    delta = {
      sprint_anterior:  prevId,
      total:            metricas.total        - prev.total,
      taxa_entrega:     metricas.taxaEntrega   - prev.taxaEntrega,
      transbordamentos: metricas.transbordaram - prev.transbordaram,
      bloqueados:       metricas.bloqueados    - prev.bloqueados,
    };
  }

  const byTime = cards.reduce((acc, c) => {
    acc[c.time] = (acc[c.time] || 0) + 1;
    return acc;
  }, {});

  const checks = {
    planning: { ok: cards.length > 0,                                          label: 'Planning registrada'          },
    review:   { ok: !!sprint.sincronizado_em,                                  label: 'Review sincronizada com Jira' },
    report:   { ok: !!(manual.atualizacoes?.trim() && manual.riscos?.trim()),  label: 'Status Report preenchido'     },
  };

  return {
    sprint_id:   sprintId,
    checks,
    allChecksOk: Object.values(checks).every((c) => c.ok),
    config: {
      confluence: !!(process.env.CONFLUENCE_BASE_URL && process.env.CONFLUENCE_TOKEN),
      smtp:       !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    },
    planning: { total: cards.length, byTime, cards },
    review: {
      metricas,
      delta,
      entregues:    enriched.filter((c) => c.situacao === 'entregue'),
      transbordaram: enriched.filter((c) => !['entregue', 'bloqueado'].includes(c.situacao)),
      bloqueados:   enriched.filter((c) => c.situacao === 'bloqueado'),
      sincronizado_em: sprint.sincronizado_em || null,
    },
    report: { ...grouped, manual },
    epics: [],
  };
}

// ── HTML: Confluence Storage Format ──────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildConfluenceHtml(doc, sprintId) {
  const { planning, review, report } = doc;
  const m   = review.metricas;
  const d   = review.delta;
  const pa  = report.manual?.proximas_atividades || {};
  const now = new Date().toLocaleDateString('pt-BR');
  const JIRA = process.env.JIRA_BASE_URL || 'https://cogna.atlassian.net';

  const link = (key) => `<a href="${JIRA}/browse/${esc(key)}">${esc(key)}</a>`;
  const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);

  const tbl = (cards, showSprints = false) => {
    if (!cards?.length) return '<p><em>Nenhum item.</em></p>';
    return `<table><tbody>
<tr><th>Card</th><th>Tema</th><th>Status</th>${showSprints ? '<th>Sprints</th>' : ''}</tr>
${cards.map((c) => `<tr><td>${link(c.card)}</td><td>${esc(c.tema)}</td><td>${esc(c.status_jira)}</td>${showSprints ? `<td>${c.sprints_arrastando > 0 ? `${c.sprints_arrastando}x` : '—'}</td>` : ''}</tr>`).join('')}
</tbody></table>`;
  };

  const bullets = (text) => {
    if (!text?.trim()) return '<p><em>Nenhuma informação preenchida.</em></p>';
    return '<ul>' + text.split('\n').filter((l) => l.trim())
      .map((l) => `<li>${esc(l.replace(/^[•\-]\s*/, ''))}</li>`).join('') + '</ul>';
  };

  const pendSec = (label, cards, dateKey) =>
    `<p><strong>${esc(label)}</strong></p>${tbl(cards)}${pa[dateKey] ? `<p>📅 Data prevista: <strong>${esc(pa[dateKey])}</strong></p>` : ''}`;

  const epicRows = doc.epics?.length
    ? `<table><tbody>
<tr><th>Épico</th><th>Título</th><th>Status</th><th>Progresso</th></tr>
${doc.epics.map((e) => {
  const pct = e.total > 0 ? Math.round((e.done / e.total) * 100) : 0;
  return `<tr><td>${link(e.key)}</td><td>${esc(e.summary)}</td><td>${esc(e.status)}</td><td>${e.done}/${e.total} (${pct}%)</td></tr>`;
}).join('')}
</tbody></table>`
    : '<p><em>Consulte a aba Report para status atualizado dos épicos.</em></p>';

  return `<h1>Squad G&amp;C e Captação — Sprint ${esc(sprintId)}</h1>
<p>Gerado em: ${esc(now)}</p>
<hr/>
<h2>1. Resumo da Planning — Sprint ${esc(sprintId)}</h2>
<p><strong>Total de cards planejados:</strong> ${planning.total}</p>

<h3>Por Time</h3>
<table><tbody>
<tr><th>Time</th><th>Cards</th></tr>
${Object.entries(planning.byTime).map(([t, n]) => `<tr><td>${esc(t)}</td><td>${n}</td></tr>`).join('')}
</tbody></table>

<h3>Cards Planejados</h3>
<table><tbody>
<tr><th>Card</th><th>Tema</th><th>Time</th><th>Sprint Início</th></tr>
${planning.cards.map((c) => `<tr><td>${link(c.card)}</td><td>${esc(c.tema)}</td><td>${esc(c.time)}</td><td>${esc(c.sprint_inicio)}</td></tr>`).join('')}
</tbody></table>
<hr/>

<h2>2. Resumo da Review — Sprint ${esc(sprintId)}</h2>
<p>
  <strong>Taxa de entrega:</strong> ${m.taxaEntrega}% (${m.concluidos} de ${m.total} cards)<br/>
  <strong>Transbordaram:</strong> ${m.transbordaram}<br/>
  <strong>Bloqueados:</strong> ${m.bloqueados}
</p>
${d ? `<p><strong>vs Sprint ${esc(d.sprint_anterior)}:</strong> Cards ${sign(d.total)} | Taxa ${sign(d.taxa_entrega)}% | Transbordamentos ${sign(d.transbordamentos)}</p>` : ''}

<h3>&#x2705; Entregues (${review.entregues.length})</h3>
${tbl(review.entregues)}

<h3>&#x26A0;&#xFE0F; Transbordaram (${review.transbordaram.length})</h3>
${tbl(review.transbordaram, true)}

<h3>&#x1F6AB; Bloqueados (${review.bloqueados.length})</h3>
${tbl(review.bloqueados)}
<hr/>

<h2>3. Status Report — Sprint ${esc(sprintId)}</h2>

<h3>3.1 Atualizações / Evoluções</h3>
${bullets(report.manual?.atualizacoes)}

<h3>3.2 Entregas da Sprint</h3>
<p><strong>Produto de Dados (DAPL)</strong></p>${tbl(report.entregas?.dapl)}
<p><strong>Plataforma — Ingestão (DDPL)</strong></p>${tbl(report.entregas?.ddpl)}
<p><strong>Engenharia de Dados (DENA)</strong></p>${tbl(report.entregas?.dena)}

<h3>3.3 Próximas Atividades / Pendências</h3>
${pendSec('Pendente com G&C (Homologação)',                report.pendencias?.homologacao,      'homologacao_data')}
${pendSec('Produto de Dados — Refinamento (DAPL)',         report.pendencias?.refinamento_dapl, 'refinamento_data')}
${pendSec('Engenharia de Dados — Desenvolvimento (DENA)',  report.pendencias?.engenharia_dena,  'engenharia_data')}
${pendSec('Plataforma de Dados — Ingestão (DDPL)',         report.pendencias?.plataforma_ddpl,  'plataforma_data')}

<h3>3.4 Status por Épico</h3>
${epicRows}

<h3>3.5 Riscos / Pontos de Atenção</h3>
${bullets(report.manual?.riscos)}`.trim();
}

// ── HTML: Email template ──────────────────────────────────────────────────────
function buildEmailHtml(doc, sprintId, confluenceUrl) {
  const { review, report } = doc;
  const m   = review.metricas;
  const now = new Date().toLocaleDateString('pt-BR');
  const JIRA = process.env.JIRA_BASE_URL || 'https://cogna.atlassian.net';

  const e = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const bullets = (text) => {
    if (!text?.trim()) return '<p style="color:#6b7280;font-style:italic;margin:0">Nenhuma informação preenchida.</p>';
    return text.split('\n').filter((l) => l.trim())
      .map((l) => `<p style="margin:3px 0;padding-left:12px;border-left:3px solid #dbeafe">• ${e(l.replace(/^[•\-]\s*/, ''))}</p>`)
      .join('');
  };

  const cardRows = (cards) => {
    if (!cards?.length) return '<tr><td colspan="3" style="padding:8px;color:#9ca3af;font-style:italic;font-size:12px">Nenhum item.</td></tr>';
    return cards.map((c) => `<tr>
      <td style="padding:5px 8px;border-bottom:1px solid #f3f4f6"><a href="${JIRA}/browse/${e(c.card)}" style="color:#2563eb;font-family:monospace;font-size:11px">${e(c.card)}</a></td>
      <td style="padding:5px 8px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151">${e(c.tema)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280">${e(c.status_jira)}</td>
    </tr>`).join('');
  };

  const cardTbl = (cards) => `<table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <thead><tr>
      <th style="text-align:left;padding:5px 8px;font-size:10px;color:#9ca3af;border-bottom:1px solid #e5e7eb">Card</th>
      <th style="text-align:left;padding:5px 8px;font-size:10px;color:#9ca3af;border-bottom:1px solid #e5e7eb">Tema</th>
      <th style="text-align:left;padding:5px 8px;font-size:10px;color:#9ca3af;border-bottom:1px solid #e5e7eb">Status</th>
    </tr></thead>
    <tbody>${cardRows(cards)}</tbody>
  </table>`;

  const subLabel = (t) => `<p style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:12px 0 4px">${e(t)}</p>`;

  const sec = (title, body) => `
    <div style="margin-bottom:24px">
      <h3 style="font-size:13px;font-weight:700;color:#111827;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin:0 0 10px">${e(title)}</h3>
      ${body}
    </div>`;

  const PEND_ITEMS = [
    { label: 'Pendente com G&C (Homologação)',         cards: report.pendencias?.homologacao,      dk: 'homologacao_data'  },
    { label: 'Produto de Dados — Refinamento (DAPL)',  cards: report.pendencias?.refinamento_dapl, dk: 'refinamento_data'  },
    { label: 'Engenharia de Dados (DENA)',             cards: report.pendencias?.engenharia_dena,  dk: 'engenharia_data'   },
    { label: 'Plataforma — Ingestão (DDPL)',           cards: report.pendencias?.plataforma_ddpl,  dk: 'plataforma_data'   },
  ];

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f9fafb;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">

  <div style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);padding:28px 32px">
    <p style="margin:0;color:#93c5fd;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase">Squad G&amp;C e Captação</p>
    <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:800">Sprint ${e(sprintId)} — Status Report</h1>
    <p style="margin:6px 0 0;color:#bfdbfe;font-size:11px">Gerado em ${e(now)}</p>
  </div>

  <div style="background:#eff6ff;border-bottom:1px solid #bfdbfe;padding:16px 32px">
    <table style="width:100%;border-collapse:collapse"><tbody><tr>
      <td style="text-align:center;width:25%"><p style="margin:0;font-size:22px;font-weight:800;color:#1e40af">${m.taxaEntrega}%</p><p style="margin:2px 0 0;font-size:10px;color:#3b82f6;text-transform:uppercase;font-weight:600">Taxa de Entrega</p></td>
      <td style="text-align:center;width:25%"><p style="margin:0;font-size:22px;font-weight:800;color:#111827">${m.concluidos}/${m.total}</p><p style="margin:2px 0 0;font-size:10px;color:#6b7280;text-transform:uppercase;font-weight:600">Concluídos</p></td>
      <td style="text-align:center;width:25%"><p style="margin:0;font-size:22px;font-weight:800;color:#dc2626">${m.transbordaram}</p><p style="margin:2px 0 0;font-size:10px;color:#ef4444;text-transform:uppercase;font-weight:600">Transbordaram</p></td>
      <td style="text-align:center;width:25%"><p style="margin:0;font-size:22px;font-weight:800;color:#d97706">${m.bloqueados}</p><p style="margin:2px 0 0;font-size:10px;color:#f59e0b;text-transform:uppercase;font-weight:600">Bloqueados</p></td>
    </tr></tbody></table>
  </div>

  <div style="padding:28px 32px">
    ${sec('Atualizações / Evoluções', bullets(report.manual?.atualizacoes))}

    ${sec('Entregas da Sprint',
      [['Produto de Dados (DAPL)', report.entregas?.dapl], ['Plataforma — Ingestão (DDPL)', report.entregas?.ddpl], ['Engenharia de Dados (DENA)', report.entregas?.dena]]
        .map(([label, cards]) => subLabel(label) + cardTbl(cards)).join('')
    )}

    ${sec('Próximas Atividades / Pendências',
      PEND_ITEMS.map(({ label, cards, dk }) => {
        const date = report.manual?.proximas_atividades?.[dk];
        return subLabel(label) + cardTbl(cards) + (date ? `<p style="font-size:11px;color:#6b7280;margin:2px 0 10px">📅 Data prevista: <strong>${e(date)}</strong></p>` : '');
      }).join('')
    )}

    ${sec('Riscos / Pontos de Atenção', bullets(report.manual?.riscos))}

    ${confluenceUrl ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px;margin-top:4px">
      <p style="margin:0;font-size:12px;color:#15803d">📘 Documento completo: <a href="${e(confluenceUrl)}" style="color:#166534;font-weight:700">${e(confluenceUrl)}</a></p>
    </div>` : ''}
  </div>

  <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:14px 32px;text-align:center">
    <p style="margin:0;font-size:10px;color:#9ca3af">Sprint App — G&amp;C e Captação · Cogna</p>
  </div>
</div>
</body></html>`;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// NOTE: /historico route is defined before /:sprint_id to avoid path collision
router.get('/documentacao/historico/:projeto_id', (req, res) => {
  const docs = loadJSON(DOCS_FILE);
  const history = Object.values(docs)
    .sort((a, b) => (b.sprint_id > a.sprint_id ? 1 : -1))
    .map(({ sprint_id, status, gerado_em, confluence, email }) => ({ sprint_id, status, gerado_em, confluence, email }));
  res.json(history);
});

router.get('/documentacao/:sprint_id', async (req, res) => {
  const { sprint_id } = req.params;
  const doc = buildDocSync(sprint_id);
  if (!doc) return res.status(404).json({ error: 'Sprint não encontrada' });

  const epics    = await fetchEpicsData().catch(() => []);
  doc.epics      = epics;
  const docs     = loadJSON(DOCS_FILE);
  const projetos = loadJSON(PROJETOS_FILE);
  res.json({ ...doc, meta: docs[sprint_id] || null, email_destinatarios: projetos['gc']?.email_destinatarios || [] });
});

router.post('/documentacao/:sprint_id/gerar', async (req, res) => {
  const { sprint_id } = req.params;
  const doc = buildDocSync(sprint_id);
  if (!doc) return res.status(404).json({ error: 'Sprint não encontrada' });

  const epics    = await fetchEpicsData().catch(() => []);
  doc.epics      = epics;
  const docs     = loadJSON(DOCS_FILE);
  const existing = docs[sprint_id] || {};
  docs[sprint_id] = {
    ...existing,
    sprint_id,
    status:    existing.status === 'publicado' ? 'publicado' : 'rascunho',
    gerado_em: new Date().toISOString(),
    confluence: existing.confluence || { publicado: false },
    email:      existing.email      || { enviado: false },
  };
  saveJSON(DOCS_FILE, docs);
  const projetos = loadJSON(PROJETOS_FILE);
  res.json({ ...doc, meta: docs[sprint_id], email_destinatarios: projetos['gc']?.email_destinatarios || [] });
});

router.post('/documentacao/:sprint_id/confluence', async (req, res) => {
  const { sprint_id } = req.params;
  const { title: reqTitle } = req.body;
  const { CONFLUENCE_BASE_URL, CONFLUENCE_EMAIL, CONFLUENCE_TOKEN, CONFLUENCE_SPACE_KEY, CONFLUENCE_PARENT_PAGE_ID } = process.env;
  if (!CONFLUENCE_BASE_URL || !CONFLUENCE_TOKEN) return res.status(400).json({ error: 'Confluence não configurado no .env' });

  const doc = buildDocSync(sprint_id);
  if (!doc) return res.status(404).json({ error: 'Sprint não encontrada' });
  const epics = await fetchEpicsData().catch(() => []);
  doc.epics   = epics;

  const authHeader = `Basic ${Buffer.from(`${CONFLUENCE_EMAIL}:${CONFLUENCE_TOKEN}`).toString('base64')}`;
  const headers    = { Authorization: authHeader, 'Content-Type': 'application/json', Accept: 'application/json' };
  const title      = reqTitle || `Sprint ${sprint_id} — G&C — Status Report`;
  const htmlBody   = buildConfluenceHtml(doc, sprint_id);

  const docs          = loadJSON(DOCS_FILE);
  const existing      = docs[sprint_id] || {};
  const existingPageId = existing.confluence?.page_id;

  try {
    let pageUrl, pageId;
    if (existingPageId) {
      const pageRes = await axios.get(`${CONFLUENCE_BASE_URL}/api/v2/pages/${existingPageId}`, { headers });
      const version = (pageRes.data.version?.number || 1) + 1;
      await axios.put(
        `${CONFLUENCE_BASE_URL}/api/v2/pages/${existingPageId}`,
        { id: existingPageId, status: 'current', title, body: { representation: 'storage', value: htmlBody }, version: { number: version } },
        { headers }
      );
      pageId  = existingPageId;
      pageUrl = existing.confluence.page_url;
    } else {
      const spaceRes = await axios.get(`${CONFLUENCE_BASE_URL}/api/v2/spaces?keys=${CONFLUENCE_SPACE_KEY}`, { headers });
      const spaceId  = spaceRes.data.results?.[0]?.id;
      if (!spaceId) return res.status(400).json({ error: `Espaço '${CONFLUENCE_SPACE_KEY}' não encontrado` });

      const payload = { spaceId, status: 'current', title, body: { representation: 'storage', value: htmlBody } };
      if (CONFLUENCE_PARENT_PAGE_ID) payload.parentId = CONFLUENCE_PARENT_PAGE_ID;

      const createRes = await axios.post(`${CONFLUENCE_BASE_URL}/api/v2/pages`, payload, { headers });
      pageId  = createRes.data.id;
      pageUrl = createRes.data._links?.webui
        ? `${CONFLUENCE_BASE_URL}${createRes.data._links.webui}`
        : `${CONFLUENCE_BASE_URL}/spaces/${CONFLUENCE_SPACE_KEY}/pages/${pageId}`;
    }

    docs[sprint_id] = {
      ...existing, sprint_id, status: 'publicado',
      gerado_em:  existing.gerado_em || new Date().toISOString(),
      confluence: { publicado: true, page_id: pageId, page_url: pageUrl, publicado_em: new Date().toISOString() },
      email:      existing.email || { enviado: false },
    };
    saveJSON(DOCS_FILE, docs);
    res.json({ page_url: pageUrl, page_id: pageId });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

router.post('/documentacao/:sprint_id/email', async (req, res) => {
  const { sprint_id } = req.params;
  const { destinatarios, assunto } = req.body;

  if (!nodemailer) return res.status(500).json({ error: 'Nodemailer não instalado. Execute: npm install nodemailer' });
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return res.status(400).json({ error: 'SMTP não configurado no .env' });

  const doc = buildDocSync(sprint_id);
  if (!doc) return res.status(404).json({ error: 'Sprint não encontrada' });
  const epics = await fetchEpicsData().catch(() => []);
  doc.epics   = epics;

  const docs        = loadJSON(DOCS_FILE);
  const existing    = docs[sprint_id] || {};
  const htmlContent = buildEmailHtml(doc, sprint_id, existing.confluence?.page_url);

  const transporter = nodemailer.createTransporter({
    host: SMTP_HOST, port: parseInt(SMTP_PORT || '587'),
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transporter.sendMail({
    from:    EMAIL_FROM || SMTP_USER,
    to:      (destinatarios || []).join(', '),
    subject: assunto || `[G&C] Status Report — Sprint ${sprint_id}`,
    html:    htmlContent,
  });

  docs[sprint_id] = {
    ...existing, sprint_id,
    status:    existing.confluence?.publicado ? 'publicado' : 'rascunho',
    gerado_em: existing.gerado_em || new Date().toISOString(),
    confluence: existing.confluence || { publicado: false },
    email: { enviado: true, destinatarios, enviado_em: new Date().toISOString() },
  };
  saveJSON(DOCS_FILE, docs);
  res.json({ ok: true, enviado_para: destinatarios });
});

module.exports = router;
