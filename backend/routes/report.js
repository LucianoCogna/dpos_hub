const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const SPRINTS_FILE = path.join(__dirname, '../data/sprints.json');
const REPORTS_FILE = path.join(__dirname, '../data/reports.json');
const DONE = ['Concluído', 'Aceito'];

function loadSprints() {
  if (!fs.existsSync(SPRINTS_FILE)) return {};
  return JSON.parse(fs.readFileSync(SPRINTS_FILE, 'utf-8'));
}
function saveSprints(data) {
  fs.writeFileSync(SPRINTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
function loadReports() {
  if (!fs.existsSync(REPORTS_FILE)) return {};
  return JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf-8'));
}
function saveReports(data) {
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
function getHeaders() {
  const token = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString('base64');
  return { Authorization: `Basic ${token}`, Accept: 'application/json' };
}
async function fetchStatus(key) {
  const url = `${process.env.JIRA_BASE_URL}/rest/api/3/issue/${key}?fields=status`;
  const res = await axios.get(url, { headers: getHeaders() });
  return res.data.fields.status.name;
}

const pfx = (key) => key?.split('-')[0] || '';

function calcMetricas(cards) {
  const total = cards.length;
  const concluidos = cards.filter((c) => DONE.includes(c.status_jira)).length;
  const bloqueados = cards.filter((c) => c.status_jira === 'Bloqueado').length;
  const emAndamento = cards.filter((c) => c.status_jira === 'Em Andamento').length;
  const transbordaram = total - concluidos;
  const taxaEntrega = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  return { total, concluidos, transbordaram, bloqueados, emAndamento, taxaEntrega };
}

function groupCards(cards) {
  const done = cards.filter((c) => DONE.includes(c.status_jira));
  const pending = cards.filter((c) => !DONE.includes(c.status_jira));

  return {
    entregas: {
      dapl: done.filter((c) => pfx(c.card) === 'DAPL'),
      ddpl: done.filter((c) => pfx(c.card) === 'DDPL'),
      dena: done.filter((c) => pfx(c.card) === 'DENA'),
    },
    pendencias: {
      homologacao: pending.filter((c) => c.status_jira === 'Homologação'),
      refinamento_dapl: pending.filter(
        (c) => ['Refinamento', 'Funil', 'Backlog'].includes(c.status_jira) && pfx(c.card) === 'DAPL'
      ),
      engenharia_dena: pending.filter((c) => pfx(c.card) === 'DENA'),
      plataforma_ddpl: pending.filter((c) => pfx(c.card) === 'DDPL'),
    },
  };
}

function buildReport(sprintId, allSprints, reports) {
  const sprint = allSprints[sprintId];
  if (!sprint) return null;

  const cards = sprint.cards || [];
  const grouped = groupCards(cards);
  const metricas = calcMetricas(cards);
  const manual = reports[sprintId] || {
    atualizacoes: '',
    proximas_atividades: {},
    riscos: '',
    atualizado_em: null,
  };

  // Auto-detect previous sprint
  const sortedIds = Object.keys(allSprints).sort();
  const currentIdx = sortedIds.indexOf(sprintId);
  const prevId = currentIdx > 0 ? sortedIds[currentIdx - 1] : null;

  let delta = null;
  if (prevId) {
    const prev = calcMetricas(allSprints[prevId].cards || []);
    delta = {
      sprint_anterior: prevId,
      total: metricas.total - prev.total,
      taxa_entrega: metricas.taxaEntrega - prev.taxaEntrega,
      transbordamentos: metricas.transbordaram - prev.transbordaram,
      bloqueados: metricas.bloqueados - prev.bloqueados,
    };
  }

  return {
    sprint_id: sprintId,
    metricas,
    delta,
    ...grouped,
    manual,
    sincronizado_em: sprint.sincronizado_em || null,
  };
}

// GET /api/report/:sprintId
router.get('/report/:sprintId', (req, res) => {
  const report = buildReport(req.params.sprintId, loadSprints(), loadReports());
  if (!report) return res.status(404).json({ error: 'Sprint não encontrada' });
  res.json(report);
});

// POST /api/report/:sprintId — salva textos manuais
router.post('/report/:sprintId', (req, res) => {
  const reports = loadReports();
  const existing = reports[req.params.sprintId] || {};
  reports[req.params.sprintId] = {
    ...existing,
    sprint_id: req.params.sprintId,
    atualizacoes: req.body.atualizacoes ?? existing.atualizacoes ?? '',
    proximas_atividades: req.body.proximas_atividades ?? existing.proximas_atividades ?? {},
    riscos: req.body.riscos ?? existing.riscos ?? '',
    atualizado_em: new Date().toISOString(),
  };
  saveReports(reports);
  res.json(reports[req.params.sprintId]);
});

// POST /api/report/:sprintId/sincronizar — atualiza status do Jira
router.post('/report/:sprintId/sincronizar', async (req, res) => {
  const allSprints = loadSprints();
  const sprint = allSprints[req.params.sprintId];
  if (!sprint) return res.status(404).json({ error: 'Sprint não encontrada' });

  const results = await Promise.allSettled(
    (sprint.cards || []).map((c) => fetchStatus(c.card))
  );
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') sprint.cards[i].status_jira = r.value;
  });
  sprint.sincronizado_em = new Date().toISOString();
  allSprints[req.params.sprintId] = sprint;
  saveSprints(allSprints);

  const report = buildReport(req.params.sprintId, allSprints, loadReports());
  res.json(report);
});

module.exports = router;
