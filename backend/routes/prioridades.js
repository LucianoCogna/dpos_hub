const express = require('express');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();

const DATA_FILE = path.join(__dirname, '../data/prioridades.json');

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return {}; }
}

function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// GET /api/prioridades
router.get('/prioridades', (req, res) => {
  const data  = load();
  const items = Object.entries(data)
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => parseFloat(a.prioridade) - parseFloat(b.prioridade));
  res.json({ items, byKey: data });
});

// POST /api/prioridades/:key — define ou atualiza prioridade
router.post('/prioridades/:key', (req, res) => {
  const { key } = req.params;
  const { dpo, prioridade, responsavel, atividade } = req.body;

  if (!dpo || prioridade === undefined || String(prioridade).trim() === '') {
    return res.status(400).json({ error: 'dpo e prioridade são obrigatórios' });
  }

  const data = load();

  // Prioridade já em uso por outro item?
  const conflito = Object.entries(data).find(
    ([k, v]) => k !== key && String(v.prioridade) === String(prioridade).trim()
  );
  if (conflito) {
    return res.status(409).json({
      error: `Prioridade ${prioridade} já está sendo usada por ${conflito[0]}`,
    });
  }

  // Item já travado por outro DPO?
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

  save(data);
  res.json({ ok: true, item: { key, ...data[key] } });
});

// DELETE /api/prioridades/:key — remove prioridade (somente o DPO dono)
router.delete('/prioridades/:key', (req, res) => {
  const { key }      = req.params;
  const { dpo }      = req.body;
  const data         = load();
  const existing     = data[key];

  if (!existing) return res.status(404).json({ error: 'Priorização não encontrada' });
  if (existing.dpo !== dpo) {
    return res.status(403).json({
      error: `Esta priorização foi definida por ${existing.dpo} e não pode ser removida por você.`,
    });
  }

  delete data[key];
  save(data);
  res.json({ ok: true });
});

module.exports = router;
