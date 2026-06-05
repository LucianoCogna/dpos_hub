const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_FILE = path.join(__dirname, '../data/sprints.json');
const DONE = ['Concluído', 'Aceito'];
const SITUACAO_ORDER = { bloqueado: 0, em_andamento: 1, transbordou: 2, entregue: 3 };

function load() {
  if (!fs.existsSync(DATA_FILE)) return {};
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}
function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
function getHeaders() {
  const token = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString('base64');
  return { Authorization: `Basic ${token}`, Accept: 'application/json' };
}
async function fetchStatusFromJira(key) {
  const url = `${process.env.JIRA_BASE_URL}/rest/api/3/issue/${key}?fields=status`;
  const res = await axios.get(url, { headers: getHeaders() });
  return res.data.fields.status.name;
}

function calcSituacao(status) {
  if (DONE.includes(status)) return 'entregue';
  if (status === 'Bloqueado') return 'bloqueado';
  if (status === 'Em Andamento') return 'em_andamento';
  return 'transbordou';
}

function calcMetricas(cards) {
  const total = cards.length;
  const concluidos = cards.filter((c) => DONE.includes(c.status_jira)).length;
  const bloqueados = cards.filter((c) => c.status_jira === 'Bloqueado').length;
  const emAndamento = cards.filter((c) => c.status_jira === 'Em Andamento').length;
  const transbordaram = total - concluidos;
  const taxaEntrega = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  const porTime = {};
  cards.forEach((c) => {
    if (!porTime[c.time]) porTime[c.time] = { total: 0, concluidos: 0, bloqueados: 0 };
    porTime[c.time].total++;
    if (DONE.includes(c.status_jira)) porTime[c.time].concluidos++;
    if (c.status_jira === 'Bloqueado') porTime[c.time].bloqueados++;
  });

  return { total, concluidos, transbordaram, bloqueados, emAndamento, taxaEntrega, porTime };
}

function calcSprintsArrastando(cardKey, currentSprintId, allSprints) {
  const sortedIds = Object.keys(allSprints).sort();
  const currentIdx = sortedIds.indexOf(currentSprintId);
  let count = 1;
  for (let i = currentIdx - 1; i >= 0; i--) {
    const sprint = allSprints[sortedIds[i]];
    const card = sprint.cards?.find((c) => c.card === cardKey);
    if (!card || DONE.includes(card.status_jira)) break;
    count++;
  }
  return count;
}

function enrichAndSort(cards) {
  return cards
    .map((c) => ({ ...c, situacao: calcSituacao(c.status_jira || c.status_fim_sprint) }))
    .sort((a, b) => SITUACAO_ORDER[a.situacao] - SITUACAO_ORDER[b.situacao]);
}

// GET /api/review/:sprintId
router.get('/review/:sprintId', (req, res) => {
  const data = load();
  const sprint = data[req.params.sprintId];
  if (!sprint) return res.status(404).json({ error: 'Sprint não encontrada' });

  const cards = enrichAndSort(sprint.cards || []);
  res.json({
    sprint_id: req.params.sprintId,
    cards,
    metricas: calcMetricas(cards),
    sincronizado_em: sprint.sincronizado_em || null,
  });
});

// POST /api/review/:sprintId/sincronizar
router.post('/review/:sprintId/sincronizar', async (req, res) => {
  const data = load();
  const sprint = data[req.params.sprintId];
  if (!sprint) return res.status(404).json({ error: 'Sprint não encontrada' });

  const results = await Promise.allSettled(
    (sprint.cards || []).map((c) => fetchStatusFromJira(c.card))
  );
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') sprint.cards[i].status_jira = r.value;
  });
  sprint.sincronizado_em = new Date().toISOString();
  data[req.params.sprintId] = sprint;
  save(data);

  const cards = enrichAndSort(sprint.cards);
  res.json({
    sprint_id: req.params.sprintId,
    cards,
    metricas: calcMetricas(cards),
    sincronizado_em: sprint.sincronizado_em,
  });
});

// GET /api/review/:sprintId/comparacao/:prevSprintId
router.get('/review/:sprintId/comparacao/:prevSprintId', (req, res) => {
  const data = load();
  const sprint = data[req.params.sprintId];
  const prevSprint = data[req.params.prevSprintId];
  if (!sprint) return res.status(404).json({ error: 'Sprint não encontrada' });
  if (!prevSprint) return res.status(404).json({ error: 'Sprint anterior não encontrada' });

  const currentCards = sprint.cards || [];
  const prevCards = prevSprint.cards || [];
  const prevKeys = new Set(prevCards.map((c) => c.card));

  const transbordadosDaAnterior = currentCards
    .filter((c) => prevKeys.has(c.card) && !DONE.includes(c.status_jira))
    .map((c) => ({
      ...c,
      situacao: calcSituacao(c.status_jira),
      sprints_arrastando: calcSprintsArrastando(c.card, req.params.sprintId, data),
    }));

  const novosEssaSprint = currentCards
    .filter((c) => !prevKeys.has(c.card))
    .map((c) => ({ ...c, situacao: calcSituacao(c.status_jira) }));

  const mAtual = calcMetricas(currentCards);
  const mAnterior = calcMetricas(prevCards);
  const allTimes = new Set([...Object.keys(mAtual.porTime), ...Object.keys(mAnterior.porTime)]);

  res.json({
    sprint_id: req.params.sprintId,
    sprint_anterior_id: req.params.prevSprintId,
    delta_total_cards: mAtual.total - mAnterior.total,
    delta_taxa_entrega: mAtual.taxaEntrega - mAnterior.taxaEntrega,
    delta_transbordamentos: mAtual.transbordaram - mAnterior.transbordaram,
    delta_por_time: Object.fromEntries(
      [...allTimes].map((t) => [
        t,
        (mAtual.porTime[t]?.total || 0) - (mAnterior.porTime[t]?.total || 0),
      ])
    ),
    cards_transbordados_da_anterior: transbordadosDaAnterior,
    cards_novos_esta_sprint: novosEssaSprint,
    metricas_atual: mAtual,
    metricas_anterior: mAnterior,
  });
});

module.exports = router;
