const express = require('express');
const axios   = require('axios');
const router  = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// PRIORIDADES HARDCODADAS — edite aqui para salvar permanentemente.
// "DDPL-XXXX": { prioridade:"1", responsavel:"Nome", story_points:"5", atividade:"Título" }
// ─────────────────────────────────────────────────────────────────────────────
const HARDCODED = {};

let store = JSON.parse(JSON.stringify(HARDCODED));

function load()       { return store; }
function save(data)   { store = data; }

function getHeaders() {
  const token = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString('base64');
  return { Authorization: `Basic ${token}`, 'Content-Type': 'application/json' };
}

async function cleanupEmAndamento(data) {
  const keys = Object.keys(data);
  if (!keys.length) return data;
  try {
    const url = `${process.env.JIRA_BASE_URL}/rest/api/3/search/jql`;
    const { data: jira } = await axios.post(
      url,
      { jql: `issueKey in (${keys.join(',')})`, fields: ['status'], maxResults: 200 },
      { headers: getHeaders(), timeout: 10000 }
    );
    let changed = false;
    for (const issue of jira.issues || []) {
      if ((issue.fields.status?.name || '') === 'Em Andamento') {
        delete data[issue.key];
        changed = true;
      }
    }
    if (changed) save(data);
  } catch (e) {
    console.error('Cleanup Em Andamento falhou:', e.message);
  }
  return data;
}

// GET /api/prioridades
router.get('/prioridades', async (req, res) => {
  try {
    let data = { ...load() };
    data = await cleanupEmAndamento(data);
    const items = Object.entries(data)
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => parseFloat(a.prioridade) - parseFloat(b.prioridade));
    res.json({ items, byKey: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/prioridades/:key — sem lock por DPO
router.post('/prioridades/:key', (req, res) => {
  const { key } = req.params;
  const { prioridade, responsavel, atividade, story_points, dpo } = req.body;

  if (prioridade === undefined || String(prioridade).trim() === '') {
    return res.status(400).json({ error: 'prioridade é obrigatória' });
  }

  const data     = { ...load() };
  const existing = data[key];

  data[key] = {
    prioridade:   String(prioridade).trim(),
    responsavel:  responsavel  || '',
    story_points: story_points || '',
    atividade:    atividade    || key,
    dpo:          dpo          || existing?.dpo || '',
    locked_at:    existing?.locked_at || new Date().toISOString(),
    updated_at:   new Date().toISOString(),
  };

  save(data);
  res.json({ ok: true, item: { key, ...data[key] } });
});

// PUT /api/prioridades/reorder — reordena em lote após drag-and-drop
router.put('/prioridades/reorder', (req, res) => {
  const { order } = req.body; // [{ key, ...campos }]
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order deve ser array' });

  const data = { ...load() };
  order.forEach((item, idx) => {
    if (data[item.key]) {
      data[item.key].prioridade  = String(idx + 1);
      data[item.key].updated_at  = new Date().toISOString();
    }
  });
  save(data);

  const items = Object.entries(data)
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => parseFloat(a.prioridade) - parseFloat(b.prioridade));
  res.json({ ok: true, items });
});

// DELETE /api/prioridades/:key — qualquer um pode remover
router.delete('/prioridades/:key', (req, res) => {
  const { key } = req.params;
  const data     = { ...load() };
  if (!data[key]) return res.status(404).json({ error: 'Priorização não encontrada' });
  delete data[key];
  save(data);
  res.json({ ok: true });
});

module.exports = router;
