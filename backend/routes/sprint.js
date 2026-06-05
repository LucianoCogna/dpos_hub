const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_FILE = path.join(__dirname, '../data/sprints.json');

function load() {
  if (!fs.existsSync(DATA_FILE)) return {};
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getJiraAuth() {
  return {
    username: process.env.JIRA_EMAIL,
    password: process.env.JIRA_TOKEN,
  };
}

async function fetchCardFromJira(key) {
  const url = `${process.env.JIRA_BASE_URL}/rest/api/3/issue/${key}?fields=status,labels,parent`;
  const res = await axios.get(url, { auth: getJiraAuth() });
  return {
    status: res.data.fields.status.name,
    labels: res.data.fields.labels || [],
    epic_key: res.data.fields.parent?.key || null,
    epic_summary: res.data.fields.parent?.fields?.summary || null,
  };
}

// GET /api/sprints
router.get('/sprints', (req, res) => {
  const data = load();
  res.json(
    Object.keys(data).map((id) => ({ id, cardCount: data[id].cards?.length || 0 }))
  );
});

// GET /api/sprint/:id
router.get('/sprint/:id', (req, res) => {
  const data = load();
  const sprint = data[req.params.id];
  if (!sprint) return res.status(404).json({ error: 'Sprint não encontrada' });
  res.json(sprint);
});

// POST /api/sprint — cria sprint (sem cards)
router.post('/sprint', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Campo id é obrigatório' });
  const data = load();
  data[id] = { id, cards: [], ...data[id] };
  save(data);
  res.json(data[id]);
});

// POST /api/sprint/:id/cards — adiciona card
router.post('/sprint/:id/cards', (req, res) => {
  const data = load();
  if (!data[req.params.id]) {
    data[req.params.id] = { id: req.params.id, cards: [] };
  }
  const card = { status_jira: null, ...req.body };
  const existing = data[req.params.id].cards.findIndex((c) => c.card === card.card);
  if (existing >= 0) {
    return res.status(409).json({ error: `Card ${card.card} já existe nesta sprint` });
  }
  data[req.params.id].cards.push(card);
  save(data);
  res.status(201).json(card);
});

// PUT /api/sprint/:id/cards/:key — atualiza card
router.put('/sprint/:id/cards/:key', (req, res) => {
  const data = load();
  const sprint = data[req.params.id];
  if (!sprint) return res.status(404).json({ error: 'Sprint não encontrada' });
  const idx = sprint.cards.findIndex((c) => c.card === req.params.key);
  if (idx < 0) return res.status(404).json({ error: 'Card não encontrado' });
  sprint.cards[idx] = { ...sprint.cards[idx], ...req.body };
  save(data);
  res.json(sprint.cards[idx]);
});

// DELETE /api/sprint/:id/cards/:key — remove card
router.delete('/sprint/:id/cards/:key', (req, res) => {
  const data = load();
  const sprint = data[req.params.id];
  if (!sprint) return res.status(404).json({ error: 'Sprint não encontrada' });
  sprint.cards = sprint.cards.filter((c) => c.card !== req.params.key);
  save(data);
  res.json({ ok: true });
});

// POST /api/sprint/:id/sync — sincroniza status e labels do Jira para todos os cards
router.post('/sprint/:id/sync', async (req, res) => {
  const data = load();
  const sprint = data[req.params.id];
  if (!sprint) return res.status(404).json({ error: 'Sprint não encontrada' });

  const results = await Promise.allSettled(
    sprint.cards.map((c) => fetchCardFromJira(c.card))
  );

  const errors = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      sprint.cards[i].status_jira   = result.value.status;
      sprint.cards[i].labels        = result.value.labels;
      sprint.cards[i].epic_key      = result.value.epic_key;
      sprint.cards[i].epic_summary  = result.value.epic_summary;
    } else {
      errors.push({ card: sprint.cards[i].card, error: result.reason?.message || 'Erro desconhecido' });
      console.error(`[sync] Falha ao buscar ${sprint.cards[i].card}:`, result.reason?.response?.data || result.reason?.message);
    }
  });

  sprint.sincronizado_em = new Date().toISOString();
  data[req.params.id] = sprint;
  save(data);
  res.json({ ...sprint, _sync_errors: errors.length > 0 ? errors : undefined });
});

// GET /api/debug/jira/:key — testa retorno real do Jira para um card
router.get('/debug/jira/:key', async (req, res) => {
  try {
    const result = await fetchCardFromJira(req.params.key);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err.message,
      status: err.response?.status,
      jira_response: err.response?.data,
    });
  }
});

// GET /api/debug/env — mostra o que o processo tem em memória (mascarado)
router.get('/debug/env', (req, res) => {
  const email = process.env.JIRA_EMAIL || '';
  const token = process.env.JIRA_TOKEN || '';
  const url   = process.env.JIRA_BASE_URL || '';
  res.json({
    JIRA_BASE_URL: url || '(vazio)',
    JIRA_EMAIL:    email ? email.slice(0,3) + '...' + email.slice(-8) : '(vazio)',
    JIRA_TOKEN:    token ? '...' + token.slice(-6) + ' len=' + token.length : '(vazio)',
  });
});

// GET /api/debug/jira-auth — verifica quem está autenticado no Jira
router.get('/debug/jira-auth', async (req, res) => {
  try {
    const url = `${process.env.JIRA_BASE_URL}/rest/api/3/myself`;
    const response = await axios.get(url, { auth: getJiraAuth() });
    res.json({
      ok: true,
      accountId: response.data.accountId,
      displayName: response.data.displayName,
      emailAddress: response.data.emailAddress,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
      status: err.response?.status,
      jira_response: err.response?.data,
    });
  }
});

module.exports = router;
