const express = require('express');
const axios   = require('axios');
const router  = express.Router();

const AREAS = [
  'G&C', 'CAPTACAO_ANALITICA', 'REVENUE', 'ROTINAS_FINANCEIRAS',
  'DMC', 'REVENUE_STRATEGY', 'RVV', 'REPASSE',
  'ALIANCA_1_SOMOS', 'ALIANCA_1_SABER', 'Plurall', 'MACROPROCESSO', 'ESG',
];

// chave interna → label exata no Jira
const CATEGORIA_MAP = {
  evolucao:      'Evolução',
  novo_produto:  'novo_produto_dado',
};

const FIELDS = [
  'summary', 'status', 'issuetype', 'labels',
  'duedate',
  'customfield_10015', // Story start date
  'customfield_10401', // Implantation date
  'customfield_11164', // Epic start date
  'customfield_11165', // Epic end date
];

function getHeaders() {
  const token = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString('base64');
  return { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };
}

async function fetchAll(jql, fields, maxPages = 20) {
  const url = `${process.env.JIRA_BASE_URL}/rest/api/3/search/jql`;
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

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s.slice(0, 10));
  return isNaN(d) ? null : d;
}

function toISO(d) {
  return d ? d.toISOString().slice(0, 10) : null;
}

function mapItem(issue) {
  const f    = issue.fields;
  const type = f.issuetype?.name?.toLowerCase().includes('epic') ? 'Epic' : 'História';
  const start = type === 'Epic' ? parseDate(f.customfield_11164) : parseDate(f.customfield_10015);
  const end   = type === 'Epic' ? parseDate(f.customfield_11165) : parseDate(f.duedate);

  const catValues = Object.values(CATEGORIA_MAP);
  const areas     = (f.labels || []).filter((l) => AREAS.includes(l));
  const categorias = (f.labels || []).filter((l) => catValues.includes(l));

  return {
    key:       issue.key,
    type,
    status:    f.status?.name || '',
    summary:   f.summary || '',
    start:     toISO(start),
    end:       toISO(end),
    implant:   toISO(parseDate(f.customfield_10401)),
    areas,
    categorias,
  };
}

router.get('/entregas', async (req, res) => {
  try {
    const { area } = req.query;

    const areaClause = (area && area !== 'TODAS')
      ? `labels = "${area}"`
      : `labels in (${AREAS.map((a) => `"${a}"`).join(', ')})`;

    const jql = `project = DAPL AND ${areaClause} AND status in ("Em produção", "Aceito", "Concluído") AND issuetype in (Epic, "História (M)", História, Story) ORDER BY key ASC`;

    const issues = await fetchAll(jql, FIELDS);
    const items  = issues.map(mapItem);

    res.json({ items, total: items.length });
  } catch (e) {
    console.error('Entregas error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
