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
  'created',
  'reporter',
  'customfield_10034', // date of first response
  'story_points',      // classic projects
  'customfield_10016', // next-gen projects
  'customfield_10028', // older configs
];

const ALLOWED_REPORTERS = [
  'luciano de oliveira santos',
  'daniele',
  'erika',
  'rosilaine',
  'karla',
  'pauletti',
  'carol',
  'gilson',
];

function isAllowedReporter(displayName) {
  if (!displayName) return false;
  const lower = displayName.toLowerCase();
  return ALLOWED_REPORTERS.some((name) => lower.includes(name));
}

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
    labels:         f.labels || [],
    created:        f.created           ? f.created.slice(0, 10)           : null,
    reporter:       f.reporter?.displayName || null,
    first_response: f.customfield_10034 ? f.customfield_10034.slice(0, 10) : null,
    story_points:   f.story_points ?? f.customfield_10016 ?? f.customfield_10028 ?? null,
  };
}

// GET /api/plataforma — DDPLs em Backlog sem sprint, agrupados por épico
router.get('/plataforma', async (req, res) => {
  try {
    const jql = 'project = DDPL AND issuetype in ("História", "História (M)", Story, "Tarefa", Task, "Sub-tarefa", Subtask) AND status in ("Backlog", "Em Andamento", "Refinamento", "Bloqueado", "Blocked", "Impedido") ORDER BY key ASC';
    const raw = await fetchAll(jql, FIELDS);

    const items = raw
      .map(mapIssue)
      .filter((it) => isAllowedReporter(it.reporter));

    const porTipo = items.reduce((acc, it) => {
      acc[it.type] = (acc[it.type] || 0) + 1;
      return acc;
    }, {});

    res.json({ total: items.length, por_tipo: porTipo, items });
  } catch (e) {
    console.error('Plataforma error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
