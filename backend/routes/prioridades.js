const express = require('express');
const axios   = require('axios');
const router  = express.Router();

// ── Clientes ──────────────────────────────────────────────────────────────────

const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

// Fallback em memória para desenvolvimento local
let memStore = {};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getHeaders() {
  const token = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString('base64');
  return { Authorization: `Basic ${token}`, 'Content-Type': 'application/json' };
}

// Retorna { 'DDPL-X': { prioridade, atividade, locked_at, updated_at }, ... }
async function load() {
  if (USE_SUPABASE) {
    const { data, error } = await getSupabase()
      .from('prioridades')
      .select('*')
      .order('prioridade');
    if (error) throw new Error(`Supabase load: ${error.message}`);
    const result = {};
    for (const row of data || []) {
      result[row.key] = {
        prioridade: String(row.prioridade),
        atividade:  row.atividade || row.key,
        locked_at:  row.locked_at,
        updated_at: row.updated_at,
      };
    }
    return result;
  }
  return memStore;
}

async function cleanupEmAndamento(data) {
  const keys = Object.keys(data);
  if (!keys.length) return data;
  try {
    const { data: jira } = await axios.post(
      `${process.env.JIRA_BASE_URL}/rest/api/3/search/jql`,
      { jql: `issueKey in (${keys.join(',')})`, fields: ['status'], maxResults: 200 },
      { headers: getHeaders(), timeout: 10000 }
    );
    const toRemove = (jira.issues || [])
      .filter((i) => (i.fields.status?.name || '') === 'Em Andamento')
      .map((i) => i.key);

    if (toRemove.length > 0) {
      if (USE_SUPABASE) {
        await getSupabase().from('prioridades').delete().in('key', toRemove);
      }
      toRemove.forEach((k) => delete data[k]);
    }
  } catch (e) {
    console.error('Cleanup Em Andamento falhou:', e.message);
  }
  return data;
}

// ── GET /api/prioridades ──────────────────────────────────────────────────────

router.get('/prioridades', async (req, res) => {
  try {
    let data = await load();
    data = await cleanupEmAndamento(data);
    const items = Object.entries(data)
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => parseFloat(a.prioridade) - parseFloat(b.prioridade));
    res.json({ items, byKey: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/prioridades/:key — upsert de UMA linha apenas ──────────────────

router.post('/prioridades/:key', async (req, res) => {
  const { key } = req.params;
  const { prioridade, atividade } = req.body;

  if (!prioridade || String(prioridade).trim() === '') {
    return res.status(400).json({ error: 'prioridade é obrigatória' });
  }

  try {
    if (USE_SUPABASE) {
      const sb = getSupabase();

      // Preserva locked_at se o item já existe
      const { data: existing } = await sb
        .from('prioridades')
        .select('locked_at')
        .eq('key', key)
        .maybeSingle();

      const { error } = await sb.from('prioridades').upsert({
        key,
        prioridade: parseInt(String(prioridade).trim(), 10) || 999,
        atividade:  atividade || key,
        locked_at:  existing?.locked_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

      if (error) throw new Error(`Supabase upsert: ${error.message}`);
    } else {
      memStore[key] = {
        prioridade:  String(prioridade).trim(),
        atividade:   atividade || key,
        locked_at:   memStore[key]?.locked_at || new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      };
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/prioridades/reorder — atualiza só a coluna prioridade ────────────

router.put('/prioridades/reorder', async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order deve ser array' });

  try {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      // Upsert em lote: só prioridade + updated_at; atividade/locked_at ficam intactos
      const { error } = await sb.from('prioridades').upsert(
        order.map((item, idx) => ({
          key:        item.key,
          prioridade: idx + 1,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'key' }
      );
      if (error) throw new Error(`Supabase reorder: ${error.message}`);
    } else {
      order.forEach((item, idx) => {
        if (memStore[item.key]) {
          memStore[item.key].prioridade = String(idx + 1);
          memStore[item.key].updated_at = new Date().toISOString();
        }
      });
    }

    const data  = await load();
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
    if (USE_SUPABASE) {
      const { error } = await getSupabase()
        .from('prioridades')
        .delete()
        .eq('key', key);
      if (error) throw new Error(`Supabase delete: ${error.message}`);
    } else {
      delete memStore[key];
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
