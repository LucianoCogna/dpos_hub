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

const FIELDS = [
  'summary', 'status', 'issuetype', 'assignee',
  'priority', 'parent', 'labels', 'components',
  'customfield_10020', // sprint
];

function mapIssue(issue) {
  const f = issue.fields;
  return {
    key:      issue.key,
    summary:  f.summary || '',
    status:   f.status?.name || '',
    type:     f.issuetype?.name || '',
    assignee: f.assignee?.displayName || null,
    priority: f.priority?.name || 'Medium',
    parent:   f.parent ? { key: f.parent.key, summary: f.parent.fields?.summary || '' } : null,
    labels:   f.labels || [],
  };
}

// GET /api/plataforma — DDPLs em Backlog sem sprint, agrupados por épico
router.get('/plataforma', async (req, res) => {
  try {
    const jql = 'project = DDPL AND sprint is EMPTY AND status = Backlog ORDER BY key ASC';
    const raw = await fetchAll(jql, FIELDS);

    const items = raw.map(mapIssue);

    // Agrupa por épico pai
    const epicMap = {};
    const semEpico = [];

    for (const it of items) {
      if (it.parent) {
        const { key, summary } = it.parent;
        if (!epicMap[key]) epicMap[key] = { key, summary, items: [] };
        epicMap[key].items.push(it);
      } else {
        semEpico.push(it);
      }
    }

    const grupos = [
      ...Object.values(epicMap).sort((a, b) => a.key.localeCompare(b.key)),
      ...(semEpico.length ? [{ key: 'SEM_EPICO', summary: 'Sem Épico', items: semEpico }] : []),
    ];

    // Contagem por tipo
    const porTipo = items.reduce((acc, it) => {
      acc[it.type] = (acc[it.type] || 0) + 1;
      return acc;
    }, {});

    res.json({ total: items.length, por_tipo: porTipo, grupos });
  } catch (e) {
    console.error('Plataforma error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
