const express = require('express');
const axios   = require('axios');
const router  = express.Router();

function getHeaders() {
  const token = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString('base64');
  return { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };
}

const BOARDS = {
  CRPR: { name: 'Pricing',  boardId: 8075 },
  CRVE: { name: 'Vendas',   boardId: 8145 },
  CRMI: { name: 'Mídia',    boardId: 8143 },
};

const SP_FIELD   = 'customfield_10026';
const DONE_CAT   = 'done';
const SPRINT_QTY = 9; // sprints fechadas para histórico

// tipos que pontuam SP
const SP_TYPES = new Set(['História', 'Story', 'Enabler', 'Spike', 'Débito Técnico', 'Bug', 'Feature']);

async function getSprints(boardId) {
  const base = process.env.JIRA_BASE_URL;
  try {
    const [closedRes, activeRes] = await Promise.all([
      axios.get(`${base}/rest/agile/1.0/board/${boardId}/sprint?state=closed&maxResults=50`, { headers: getHeaders(), timeout: 15000 }),
      axios.get(`${base}/rest/agile/1.0/board/${boardId}/sprint?state=active&maxResults=1`,  { headers: getHeaders(), timeout: 15000 }),
    ]);
    const closed = (closedRes.data.values || []).slice(-SPRINT_QTY);
    const active = activeRes.data.values || [];
    return [...closed, ...active];
  } catch (e) {
    console.error(`[indicadores] getSprints(${boardId}):`, e.response?.data || e.message);
    return [];
  }
}

async function getSprintIssues(boardId, sprintId) {
  const base    = process.env.JIRA_BASE_URL;
  const fields  = `summary,status,issuetype,${SP_FIELD},assignee,labels`;
  const all     = [];
  let startAt   = 0;
  for (let page = 0; page < 15; page++) {
    try {
      const { data } = await axios.get(
        `${base}/rest/agile/1.0/board/${boardId}/sprint/${sprintId}/issue?fields=${fields}&maxResults=100&startAt=${startAt}`,
        { headers: getHeaders(), timeout: 15000 }
      );
      const issues = data.issues || [];
      all.push(...issues);
      if (issues.length === 0 || startAt + 100 >= (data.total || 0)) break;
      startAt += 100;
    } catch (e) {
      console.error(`[indicadores] getSprintIssues(${boardId},${sprintId}):`, e.response?.data || e.message);
      break;
    }
  }
  return all;
}

function analyzeIssues(issues) {
  let total = 0, done = 0, spTotal = 0, spDone = 0;
  const byType     = {};
  const byTypeDone = {};
  const byAssignee = {};
  const byLabel         = {};
  const byLabelDone     = {};
  const byLabelAssignee = {};

  for (const issue of issues) {
    const f        = issue.fields || {};
    const cat      = f.status?.statusCategory?.key || '';
    const type     = f.issuetype?.name || 'Outro';
    const assignee = f.assignee?.displayName || 'Sem atribuição';
    const sp       = typeof f[SP_FIELD] === 'number' ? f[SP_FIELD] : 0;
    const isDone   = cat === DONE_CAT;
    const labels   = Array.isArray(f.labels) ? f.labels : [];

    total++;
    if (isDone) done++;

    if (SP_TYPES.has(type) && sp > 0) {
      spTotal += sp;
      if (isDone) spDone += sp;
    }

    byType[type] = (byType[type] || 0) + 1;
    if (!byTypeDone[type]) byTypeDone[type] = 0;
    if (isDone) byTypeDone[type]++;

    if (!byAssignee[assignee]) byAssignee[assignee] = { total: 0, done: 0 };
    byAssignee[assignee].total++;
    if (isDone) byAssignee[assignee].done++;

    for (const lbl of labels) {
      if (!byLabel[lbl]) { byLabel[lbl] = 0; byLabelDone[lbl] = 0; }
      byLabel[lbl]++;
      if (isDone) byLabelDone[lbl]++;

      if (!byLabelAssignee[lbl]) byLabelAssignee[lbl] = {};
      if (!byLabelAssignee[lbl][assignee]) byLabelAssignee[lbl][assignee] = { total: 0, done: 0 };
      byLabelAssignee[lbl][assignee].total++;
      if (isDone) byLabelAssignee[lbl][assignee].done++;
    }
  }

  return {
    total,
    done,
    throughput:       done,
    sp_total:         spTotal,
    sp_done:          spDone,
    completion_rate:  total > 0 ? +(done / total).toFixed(3) : 0,
    by_type:          byType,
    by_type_done:     byTypeDone,
    by_assignee:      byAssignee,
    by_label:          byLabel,
    by_label_done:     byLabelDone,
    by_label_assignee: byLabelAssignee,
  };
}

async function buildProjectData(projKey, cfg) {
  const sprints = await getSprints(cfg.boardId);
  if (!sprints.length) return { name: cfg.name, sprints: [], contributors: [], burndown: null, active_sprint: null };

  // busca issues de todas as sprints em paralelo
  const sprintResults = await Promise.all(
    sprints.map(async (sp) => {
      const issues  = await getSprintIssues(cfg.boardId, sp.id);
      const metrics = analyzeIssues(issues);
      return {
        id:    sp.id,
        name:  sp.name,
        state: sp.state,
        start: sp.startDate ? sp.startDate.slice(0, 10) : null,
        end:   sp.endDate   ? sp.endDate.slice(0, 10)   : null,
        goal:  sp.goal || null,
        ...metrics,
      };
    })
  );

  // burndown da sprint ativa
  const activeSprint = sprintResults.find(s => s.state === 'active') || null;
  const burndown = activeSprint ? {
    sprint:        activeSprint.name,
    start:         activeSprint.start,
    end:           activeSprint.end,
    total:         activeSprint.total,
    done:          activeSprint.done,
    remaining:     activeSprint.total - activeSprint.done,
    by_type:       activeSprint.by_type,
    by_type_done:  activeSprint.by_type_done,
    by_assignee:   activeSprint.by_assignee,
    by_label:          activeSprint.by_label,
    by_label_done:     activeSprint.by_label_done,
    by_label_assignee: activeSprint.by_label_assignee,
  } : null;

  // contribuição por dev agregando todas as sprints coletadas
  const contribMap = {};
  for (const sp of sprintResults) {
    for (const [name, counts] of Object.entries(sp.by_assignee)) {
      if (!contribMap[name]) contribMap[name] = { total: 0, done: 0, active: false };
      contribMap[name].total += counts.total;
      contribMap[name].done  += counts.done;
      if (sp.state === 'active' && counts.total > 0) contribMap[name].active = true;
    }
  }
  const grandTotal = Object.values(contribMap).reduce((s, c) => s + c.total, 0);
  const contributors = Object.entries(contribMap)
    .map(([name, c]) => ({ name, ...c, pct: grandTotal > 0 ? +(c.total / grandTotal).toFixed(3) : 0 }))
    .sort((a, b) => b.total - a.total);

  return {
    name:          cfg.name,
    active_sprint: activeSprint ? { name: activeSprint.name, start: activeSprint.start, end: activeSprint.end, goal: activeSprint.goal } : null,
    sprints:       sprintResults,
    burndown,
    contributors,
  };
}

// GET /api/indicadores
router.get('/indicadores', async (req, res) => {
  try {
    const entries = await Promise.all(
      Object.entries(BOARDS).map(async ([key, cfg]) => [key, await buildProjectData(key, cfg)])
    );
    const data = Object.fromEntries(entries);
    data.generated_at = new Date().toISOString();
    res.json(data);
  } catch (e) {
    console.error('[indicadores] erro:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
