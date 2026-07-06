const express = require('express');
const axios   = require('axios');
const router  = express.Router();

function getHeaders() {
  const token = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString('base64');
  return { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };
}

async function fetchByKeys(keys, fields) {
  const jql = `issueKey in (${keys.join(',')}) ORDER BY key ASC`;
  const url  = `${process.env.JIRA_BASE_URL}/rest/api/3/search/jql`;
  const { data } = await axios.post(url, { jql, fields, maxResults: 200 }, { headers: getHeaders(), timeout: 20000 });
  return data.issues || [];
}

// ── Issues hardcodadas por engenheiro ─────────────────────────────────────────
const CONFIG = {
  CRPR: {
    name: 'Pricing',
    engineers: {
      'Glauber':         ['CRPR-12', 'CRPR-4',  'CRPR-5'],
      'Josielho Canuto': ['CRPR-14', 'CRPR-12', 'CRPR-8'],
    },
  },
  CRMI: {
    name: 'Mídia',
    engineers: {
      'Samuel Alexandre': ['CRMI-122', 'CRMI-124', 'CRMI-144'],
    },
  },
  CRVE: {
    name: 'Conversão',
    engineers: {
      'Iago': ['CRVE-69',  'CRVE-44'],
      'Yuir': ['CRVE-122', 'CRVE-123'],
    },
  },
};

const DONE_STATUSES = new Set(['Concluído', 'Done', 'Aceito', 'Closed', 'Resolvido']);

const FIELDS = ['summary', 'status', 'issuetype', 'assignee', 'priority', 'created', 'updated'];

// GET /api/indicadores
router.get('/indicadores', async (req, res) => {
  try {
    // Coleta todas as chaves únicas
    const allKeys = [];
    for (const proj of Object.values(CONFIG)) {
      for (const keys of Object.values(proj.engineers)) {
        for (const k of keys) {
          if (!allKeys.includes(k)) allKeys.push(k);
        }
      }
    }

    const raw = await fetchByKeys(allKeys, FIELDS);

    // Indexa por chave para lookup rápido
    const byKey = {};
    for (const issue of raw) {
      byKey[issue.key] = issue;
    }

    // Monta resultado agrupado
    const result = {};
    for (const [projKey, projCfg] of Object.entries(CONFIG)) {
      const byAssignee = {};

      for (const [eng, keys] of Object.entries(projCfg.engineers)) {
        byAssignee[eng] = keys
          .map((k) => {
            const issue = byKey[k];
            if (!issue) return null;
            const f      = issue.fields;
            const status = f.status?.name || '';
            if (DONE_STATUSES.has(status)) return null; // exclui concluídas
            return {
              key:      issue.key,
              summary:  f.summary || '',
              status,
              type:     f.issuetype?.name || '',
              priority: f.priority?.name || 'Medium',
              assignee: f.assignee?.displayName || null,
              created:  f.created ? f.created.slice(0, 10) : null,
              updated:  f.updated ? f.updated.slice(0, 10) : null,
            };
          })
          .filter(Boolean);
      }

      const total = Object.values(byAssignee).reduce((s, arr) => s + arr.length, 0);
      result[projKey] = { name: projCfg.name, byAssignee, outros: [], total };
    }

    res.json(result);
  } catch (e) {
    console.error('Indicadores error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
