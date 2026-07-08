const express = require('express');
const axios   = require('axios');
const router  = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// PRIORIDADES HARDCODADAS
// Edite aqui para salvar permanentemente. Formato:
// "DDPL-XXXX": { prioridade: "1", dpo: "Nome", responsavel: "Nome", atividade: "Título" }
// ─────────────────────────────────────────────────────────────────────────────
const HARDCODED = {
  // Exemplos (descomente e preencha):
  // "DDPL-7634": { prioridade: "1", dpo: "Luciano", responsavel: "", atividade: "" },
};

// Store em memória — inicializado a partir do hardcode e atualizado via UI.
// Persiste enquanto o servidor estiver ativo; ao reiniciar, volta ao HARDCODED.
let store = JSON.parse(JSON.stringify(HARDCODED));

function load() {
  return store;
}

function save(data) {
  store = data;
}

function getHeaders() {
  const token = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString('base64');
  return { Authorization: `Basic ${token}`, 'Content-Type': 'application/json' };
}

async function cleanupEmAndamento(data) {
  const keys = Object.keys(data);
  if (keys.length === 0) return data;
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

// POST /api/prioridades/:key
router.post('/prioridades/:key', (req, res) => {
  const { key } = req.params;
  const { dpo, prioridade, responsavel, atividade } = req.body;

  if (!dpo || prioridade === undefined || String(prioridade).trim() === '') {
    return res.status(400).json({ error: 'dpo e prioridade são obrigatórios' });
  }

  const data = { ...load() };

  const conflito = Object.entries(data).find(
    ([k, v]) => k !== key && String(v.prioridade) === String(prioridade).trim()
  );
  if (conflito) {
    return res.status(409).json({ error: `Prioridade ${prioridade} já está sendo usada por ${conflito[0]}` });
  }

  const existing = data[key];
  if (existing && existing.dpo !== dpo) {
    return res.status(403).json({ error: `Esta priorização foi definida por ${existing.dpo} e não pode ser alterada.` });
  }

  data[key] = {
    prioridade:  String(prioridade).trim(),
    dpo,
    responsavel: responsavel || '',
    atividade:   atividade || key,
    locked_at:   existing?.locked_at || new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  };

  save(data);
  res.json({ ok: true, item: { key, ...data[key] } });
});

// DELETE /api/prioridades/:key
router.delete('/prioridades/:key', (req, res) => {
  const { key } = req.params;
  const { dpo } = req.body;
  const data = { ...load() };
  const existing = data[key];

  if (!existing) return res.status(404).json({ error: 'Priorização não encontrada' });
  if (existing.dpo !== dpo) {
    return res.status(403).json({ error: `Esta priorização foi definida por ${existing.dpo} e não pode ser removida por você.` });
  }

  delete data[key];
  save(data);
  res.json({ ok: true });
});

module.exports = router;
