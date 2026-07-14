const express = require('express');
const axios   = require('axios');
const router  = express.Router();

// ── Persistência: Supabase em prod, memória em dev ────────────────────────────

let memStore = {};

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

async function load() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('prioridades_store')
      .select('data')
      .eq('id', 'main')
      .single();
    if (error) throw new Error(`Supabase load: ${error.message}`);
    return data?.data || {};
  }
  return memStore;
}

async function save(payload) {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('prioridades_store')
      .upsert({ id: 'main', data: payload, updated_at: new Date().toISOString() });
    if (error) throw new Error(`Supabase save: ${error.message}`);
  } else {
    memStore = payload;
  }
}

// ── Jira helpers ──────────────────────────────────────────────────────────────

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
    if (changed) await save(data);
  } catch (e) {
    console.error('Cleanup Em Andamento falhou:', e.message);
  }
  return data;
}

// ── GET /api/prioridades ──────────────────────────────────────────────────────

router.get('/prioridades', async (req, res) => {
  try {
    let data = { ...(await load()) };
    data = await cleanupEmAndamento(data);
    const items = Object.entries(data)
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => parseFloat(a.prioridade) - parseFloat(b.prioridade));
    res.json({ items, byKey: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/prioridades/:key ────────────────────────────────────────────────

router.post('/prioridades/:key', async (req, res) => {
  const { key } = req.params;
  const { prioridade, responsavel, atividade, story_points } = req.body;

  if (prioridade === undefined || String(prioridade).trim() === '') {
    return res.status(400).json({ error: 'prioridade é obrigatória' });
  }

  try {
    const data     = { ...(await load()) };
    const existing = data[key];

    data[key] = {
      prioridade:   String(prioridade).trim(),
      responsavel:  responsavel  || '',
      story_points: story_points || '',
      atividade:    atividade    || key,
      locked_at:    existing?.locked_at || new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    };

    await save(data);
    res.json({ ok: true, item: { key, ...data[key] } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/prioridades/reorder ──────────────────────────────────────────────

router.put('/prioridades/reorder', async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order deve ser array' });

  try {
    const data = { ...(await load()) };
    order.forEach((item, idx) => {
      if (data[item.key]) {
        data[item.key].prioridade = String(idx + 1);
        data[item.key].updated_at = new Date().toISOString();
      }
    });
    await save(data);

    const items = Object.entries(data)
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => parseFloat(a.prioridade) - parseFloat(b.prioridade));
    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/prioridades/:key ──────────────────────────────────────────────

router.delete('/prioridades/:key', async (req, res) => {
  const { key } = req.params;
  try {
    const data = { ...(await load()) };
    if (!data[key]) return res.status(404).json({ error: 'Priorização não encontrada' });
    delete data[key];
    await save(data);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
