const express = require('express');
const axios = require('axios');
const router = express.Router();

function getHeaders() {
  const token = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString('base64');
  return {
    Authorization: `Basic ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

const JIRA_URL = () => `${process.env.JIRA_BASE_URL}/rest/api/3/search/jql`;

async function fetchAll(jql, fields) {
  const issues = [];
  let nextPageToken = undefined;

  while (true) {
    const payload = { jql, fields, maxResults: 100 };
    if (nextPageToken) payload.nextPageToken = nextPageToken;

    const response = await axios.post(JIRA_URL(), payload, { headers: getHeaders() });
    const { issues: page, nextPageToken: token, isLast } = response.data;

    issues.push(...page);
    if (isLast || !token || page.length === 0) break;
    nextPageToken = token;
  }

  return issues;
}

const STORY_FIELDS = [
  'summary', 'status', 'labels', 'parent',
  'customfield_10014',
  'assignee',
  'customfield_10020',
];

// GET /api/stories — histórias agrupadas por épico
router.get('/stories', async (req, res) => {
  try {
    const base = process.env.JIRA_BASE_URL;

    const [stories, gcEpics] = await Promise.all([
      fetchAll('issuetype = "História (M)" AND labels = "G&C"', STORY_FIELDS),
      fetchAll('labels = "G&C" AND issuetype = Epic', ['summary', 'status', 'assignee']),
    ]);

    const epicMap = new Map(gcEpics.map((e) => [e.key, e]));

    let allStories = [...stories];
    if (gcEpics.length > 0) {
      const epicKeys = gcEpics.map((e) => e.key).join(', ');
      const childStories = await fetchAll(
        `issuetype = "História (M)" AND parent in (${epicKeys})`,
        STORY_FIELDS
      );
      allStories.push(...childStories);
    }

    const unique = [...new Map(allStories.map((i) => [i.key, i])).values()];

    const grouped = {};
    unique.forEach((story) => {
      const f = story.fields;
      const epicKey = f.customfield_10014 || f.parent?.key || 'SEM_EPICO';
      const epic = epicMap.get(epicKey);

      if (!grouped[epicKey]) {
        grouped[epicKey] = {
          key: epicKey,
          summary: epic?.fields?.summary || epicKey,
          status: epic?.fields?.status?.name || '—',
          assignee: epic?.fields?.assignee?.displayName || null,
          link: epicKey !== 'SEM_EPICO' ? `${base}/browse/${epicKey}` : null,
          stories: [],
        };
      }

      grouped[epicKey].stories.push({
        key: story.key,
        summary: f.summary,
        status: f.status.name,
        assignee: f.assignee?.displayName || null,
        sprint: f.customfield_10020?.length ? f.customfield_10020.at(-1).name : null,
        labels: f.labels || [],
        link: `${base}/browse/${story.key}`,
      });
    });

    const epics = Object.values(grouped).map((epic) => {
      const total = epic.stories.length;
      const done = epic.stories.filter((h) => ['Concluído', 'Aceito'].includes(h.status)).length;
      return { ...epic, total, done, progress: total > 0 ? Math.round((done / total) * 100) : 0 };
    });

    res.json(epics);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao buscar dados do Jira' });
  }
});

// GET /api/epics
router.get('/epics', async (req, res) => {
  try {
    const base = process.env.JIRA_BASE_URL;
    const epics = await fetchAll(
      'labels = "G&C" AND issuetype = Epic',
      ['summary', 'status', 'assignee']
    );

    res.json(
      epics.map((e) => ({
        key: e.key,
        summary: e.fields.summary,
        status: e.fields.status.name,
        assignee: e.fields.assignee?.displayName || null,
        link: `${base}/browse/${e.key}`,
      }))
    );
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao buscar épicos do Jira' });
  }
});

// GET /api/macroprocessos — todos os tipos com label MACROPROCESSO
router.get('/macroprocessos', async (req, res) => {
  try {
    const base = process.env.JIRA_BASE_URL;
    const fields = ['summary', 'status', 'assignee', 'reporter', 'issuetype', 'parent'];

    const allIssues = await fetchAll('labels = "MACROPROCESSO" ORDER BY key ASC', fields);

    const format = (issue) => {
      const rawType = issue.fields.issuetype?.name || '';
      const lower   = rawType.toLowerCase();
      const type    = (lower.includes('epic') || lower.includes('épico')) ? 'epic' : 'story';
      return {
        key:                issue.key,
        summary:            issue.fields.summary,
        status:             issue.fields.status.name,
        assignee:           issue.fields.assignee?.displayName || null,
        reporter:           issue.fields.reporter?.displayName || null,
        reporter_account_id: issue.fields.reporter?.accountId || null,
        type,
        issuetype:          rawType,
        parent_key:         issue.fields.parent?.key || null,
        parent_summary:     issue.fields.parent?.fields?.summary || null,
        link:               `${base}/browse/${issue.key}`,
      };
    };

    res.json(allIssues.map(format));
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao buscar macroprocessos do Jira' });
  }
});

// GET /api/debug-macroprocessos — lista chaves e tipos para debug
router.get('/debug-macroprocessos', async (req, res) => {
  try {
    const issues = await fetchAll('labels = "MACROPROCESSO" ORDER BY key ASC', ['summary', 'issuetype', 'status']);
    res.json(issues.map((i) => ({ key: i.key, type: i.fields.issuetype?.name, status: i.fields.status?.name })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/jira/issue/:key/transition — altera status via workflow do Jira
router.post('/jira/issue/:key/transition', async (req, res) => {
  try {
    const base = process.env.JIRA_BASE_URL;
    const { key } = req.params;
    const { targetStatus } = req.body;

    if (!targetStatus) return res.status(400).json({ error: 'targetStatus é obrigatório' });

    // 1. Busca transições disponíveis para o issue
    const tRes = await axios.get(
      `${base}/rest/api/3/issue/${key}/transitions`,
      { headers: getHeaders() }
    );

    const transition = tRes.data.transitions.find(
      (t) => t.to.name.toLowerCase() === targetStatus.toLowerCase()
    );

    if (!transition) {
      const available = tRes.data.transitions.map((t) => t.to.name);
      return res.status(400).json({
        error: `Transição para "${targetStatus}" não disponível`,
        available,
      });
    }

    // 2. Executa a transição
    await axios.post(
      `${base}/rest/api/3/issue/${key}/transitions`,
      { transition: { id: transition.id } },
      { headers: getHeaders() }
    );

    res.json({ ok: true, key, status: targetStatus });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao executar transição no Jira' });
  }
});

// GET /api/jira/card/:key — busca um card específico pelo key
router.get('/jira/card/:key', async (req, res) => {
  try {
    const base = process.env.JIRA_BASE_URL;
    const url = `${base}/rest/api/3/issue/${req.params.key}?fields=summary,status,parent`;
    const response = await axios.get(url, { headers: getHeaders() });
    const { key, fields } = response.data;
    res.json({
      key,
      summary: fields.summary,
      status: fields.status.name,
      parent_key: fields.parent?.key || null,
      parent_summary: fields.parent?.fields?.summary || null,
      url: `${base}/browse/${key}`,
    });
  } catch (error) {
    const status = error.response?.status;
    if (status === 404) return res.status(404).json({ error: 'Card não encontrado no Jira' });
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao buscar card no Jira' });
  }
});

// GET /api/jira/issue/:key/detail — detalhes completos para o modal
router.get('/jira/issue/:key/detail', async (req, res) => {
  try {
    const base = process.env.JIRA_BASE_URL;
    const fields = 'summary,status,assignee,reporter,issuetype,parent,customfield_10026,description,labels';
    const { data } = await axios.get(`${base}/rest/api/3/issue/${req.params.key}?fields=${fields}`, { headers: getHeaders() });
    const f = data.fields;

    // Descrição: extrai texto plano do ADF
    const extractText = (node) => {
      if (!node) return '';
      if (node.type === 'text') return node.text || '';
      return (node.content || []).map(extractText).join('');
    };

    res.json({
      key: data.key,
      summary: f.summary,
      status: f.status.name,
      assignee: f.assignee ? { accountId: f.assignee.accountId, displayName: f.assignee.displayName } : null,
      reporter: f.reporter ? { accountId: f.reporter.accountId, displayName: f.reporter.displayName } : null,
      type: f.issuetype.name,
      parent_key: f.parent?.key || null,
      parent_summary: f.parent?.fields?.summary || null,
      story_points: f.customfield_10026 ?? null,
      description: extractText(f.description),
      labels: f.labels || [],
      link: `${base}/browse/${data.key}`,
    });
  } catch (error) {
    const status = error.response?.status;
    if (status === 404) return res.status(404).json({ error: 'Issue não encontrado' });
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao buscar detalhes do issue' });
  }
});

// GET /api/jira/project-members — busca os membros fixos do projeto por nome
const PROJECT_MEMBER_NAMES = [
  'Daniele Santana de brito',
  'Gilson dos santos',
  'Karla ynonye zucchini',
  'Erika Andressa de Souza silva',
];

router.get('/jira/project-members', async (req, res) => {
  try {
    const base = process.env.JIRA_BASE_URL;
    const results = await Promise.all(
      PROJECT_MEMBER_NAMES.map((name) =>
        axios
          .get(`${base}/rest/api/3/user/search?query=${encodeURIComponent(name)}&maxResults=1`, { headers: getHeaders() })
          .then((r) => r.data[0] || null)
          .catch(() => null)
      )
    );
    const members = results
      .filter(Boolean)
      .map((u) => ({ accountId: u.accountId, displayName: u.displayName }));
    res.json(members);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao buscar membros do projeto' });
  }
});

// GET /api/jira/issue/:key/assignable — usuários atribuíveis
router.get('/jira/issue/:key/assignable', async (req, res) => {
  try {
    const base = process.env.JIRA_BASE_URL;
    const { data } = await axios.get(
      `${base}/rest/api/3/user/assignable/search?issueKey=${req.params.key}&maxResults=50`,
      { headers: getHeaders() }
    );
    res.json(data.map((u) => ({ accountId: u.accountId, displayName: u.displayName })));
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// GET /api/jira/issue/:key/transitions — transições disponíveis
router.get('/jira/issue/:key/transitions', async (req, res) => {
  try {
    const base = process.env.JIRA_BASE_URL;
    const { data } = await axios.get(`${base}/rest/api/3/issue/${req.params.key}/transitions`, { headers: getHeaders() });
    res.json(data.transitions.map((t) => ({ id: t.id, name: t.to.name })));
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao buscar transições' });
  }
});

// PUT /api/jira/issue/:key/update — atualiza assignee e/ou story points
router.put('/jira/issue/:key/update', async (req, res) => {
  try {
    const base = process.env.JIRA_BASE_URL;
    const { assignee_account_id, story_points } = req.body;
    const fields = {};
    if (assignee_account_id !== undefined)
      fields.assignee = assignee_account_id ? { accountId: assignee_account_id } : null;
    if (story_points !== undefined)
      fields.customfield_10026 = story_points === '' || story_points === null ? null : Number(story_points);

    await axios.put(
      `${base}/rest/api/3/issue/${req.params.key}`,
      { fields },
      { headers: getHeaders() }
    );
    res.json({ ok: true });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao atualizar issue', detail: error.response?.data });
  }
});

module.exports = router;
