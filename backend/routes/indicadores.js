const express = require('express');
const axios   = require('axios');
const router  = express.Router();

function getHeaders() {
  const token = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString('base64');
  return { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };
}

async function fetchAll(jql, fields, maxPages = 30) {
  const url    = `${process.env.JIRA_BASE_URL}/rest/api/3/search/jql`;
  const issues = [];
  let nextPageToken;
  let page = 0;
  while (page < maxPages) {
    const payload = { jql, fields, maxResults: 100 };
    if (nextPageToken) payload.nextPageToken = nextPageToken;
    const { data } = await axios.post(url, payload, { headers: getHeaders(), timeout: 20000 });
    issues.push(...(data.issues || []));
    if (data.isLast || !data.nextPageToken || (data.issues || []).length === 0) break;
    nextPageToken = data.nextPageToken;
    page++;
  }
  return issues;
}

const PROJECTS = {
  CRPR: { name: 'Pricing',   engineers: ['Glauber', 'Josielho Canuto'] },
  CRMI: { name: 'Mídia',     engineers: ['Samuel Alexandre']           },
  CRVE: { name: 'Conversão', engineers: ['Iago', 'Yuir']               },
};

const FIELDS = ['summary', 'status', 'issuetype', 'assignee', 'priority', 'created', 'updated'];

function matchEngineer(displayName, engineerList) {
  if (!displayName) return null;
  const lower = displayName.toLowerCase();
  return engineerList.find((e) => {
    const parts = e.toLowerCase().split(' ');
    return parts.some((part) => lower.includes(part));
  }) || null;
}

// GET /api/indicadores
router.get('/indicadores', async (req, res) => {
  try {
    const jql = `project in (CRPR, CRMI, CRVE) AND status != "Cancelado" ORDER BY updated DESC`;
    const raw = await fetchAll(jql, FIELDS);

    const result = {};
    for (const [key, cfg] of Object.entries(PROJECTS)) {
      result[key] = {
        name:       cfg.name,
        engineers:  cfg.engineers,
        byAssignee: {},
        outros:     [],
        total:      0,
      };
      // Garante ordem dos engenheiros
      for (const eng of cfg.engineers) {
        result[key].byAssignee[eng] = [];
      }
    }

    for (const issue of raw) {
      const proj = issue.key.split('-')[0];
      if (!result[proj]) continue;

      const f           = issue.fields;
      const displayName = f.assignee?.displayName || null;
      const matched     = matchEngineer(displayName, result[proj].engineers);

      const item = {
        key:      issue.key,
        summary:  f.summary || '',
        status:   f.status?.name || '',
        type:     f.issuetype?.name || '',
        priority: f.priority?.name || 'Medium',
        assignee: displayName,
        created:  f.created ? f.created.slice(0, 10) : null,
        updated:  f.updated ? f.updated.slice(0, 10) : null,
      };

      if (matched) {
        result[proj].byAssignee[matched].push(item);
      } else {
        result[proj].outros.push(item);
      }
      result[proj].total++;
    }

    res.json(result);
  } catch (e) {
    console.error('Indicadores error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
