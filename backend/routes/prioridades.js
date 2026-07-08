const express = require('express');
const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');
const router  = express.Router();

const DATA_FILE = process.env.VERCEL
  ? '/tmp/prioridades.json'
  : path.join(__dirname, '../data/prioridades.json');

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return {}; }
}

function save(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Erro ao salvar prioridades:', err.message);
    throw err;
  }
}

function getHeaders() {
  const token = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString('base64');
  return { Authorization: `Basic ${token}`, 'Content-Type': 'application/json' };
}

// Remove da priorização itens que já entraram em andamento no Jira
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
      const status = issue.fields.status?.name || '';
      if (status === 'Em Andamento') {
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
    let data = load();
    data = await cleanupEmAndamento(data);

    const items = Object.entries(data)
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => parseFloat(a.prioridade) - parseFloat(b.prioridade));

    res.json({ items, byKey: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/prioridades/:key — define ou atualiza prioridade
router.post('/prioridades/:key', (req, res) => {
  const { key } = req.params;
  const { dpo, prioridade, responsavel, atividade } = req.body;

  if (!dpo || prioridade === undefined || String(prioridade).trim() === '') {
    return res.status(400).json({ error: 'dpo e prioridade são obrigatórios' });
  }

  let data;
  try { data = load(); } catch { data = {}; }

  const conflito = Object.entries(data).find(
    ([k, v]) => k !== key && String(v.prioridade) === String(prioridade).trim()
  );
  if (conflito) {
    return res.status(409).json({
      error: `Prioridade ${prioridade} já está sendo usada por ${conflito[0]}`,
    });
  }

  const existing = data[key];
  if (existing && existing.dpo !== dpo) {
    return res.status(403).json({
      error: `Esta priorização foi definida por ${existing.dpo} e não pode ser alterada.`,
    });
  }

  data[key] = {
    prioridade:  String(prioridade).trim(),
    dpo,
    responsavel: responsavel || '',
    atividade:   atividade || key,
    locked_at:   existing?.locked_at || new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  };

  try {
    save(data);
    res.json({ ok: true, item: { key, ...data[key] } });
  } catch (err) {
    res.status(500).json({ error: 'Não foi possível salvar: ' + err.message });
  }
});

// DELETE /api/prioridades/:key
router.delete('/prioridades/:key', (req, res) => {
  const { key } = req.params;
  const { dpo } = req.body;

  let data;
  try { data = load(); } catch { data = {}; }

  const existing = data[key];
  if (!existing) return res.status(404).json({ error: 'Priorização não encontrada' });
  if (existing.dpo !== dpo) {
    return res.status(403).json({
      error: `Esta priorização foi definida por ${existing.dpo} e não pode ser removida por você.`,
    });
  }

  delete data[key];
  try {
    save(data);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Não foi possível salvar: ' + err.message });
  }
});

module.exports = router;
