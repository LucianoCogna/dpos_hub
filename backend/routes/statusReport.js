const express = require('express');
const axios = require('axios');
const router = express.Router();

// ── Sprint calendar ──────────────────────────────────────────────────────────

const SPRINTS = {
  '26.2.1': ['2026-04-13', '2026-04-24'],
  '26.2.2': ['2026-04-27', '2026-05-08'],
  '26.2.3': ['2026-05-11', '2026-05-22'],
  '26.2.4': ['2026-05-25', '2026-06-05'],
  '26.2.5': ['2026-06-08', '2026-06-19'],
  '26.2.6': ['2026-06-22', '2026-07-03'],
  '26.3.1': ['2026-07-06', '2026-07-17'],
  '26.3.2': ['2026-07-20', '2026-07-31'],
  '26.3.3': ['2026-08-03', '2026-08-14'],
  '26.3.4': ['2026-08-17', '2026-08-28'],
  '26.3.5': ['2026-08-31', '2026-09-11'],
  '26.3.6': ['2026-09-14', '2026-09-25'],
  '26.4.1': ['2026-09-28', '2026-10-09'],
  '26.4.2': ['2026-10-12', '2026-10-23'],
  '26.4.3': ['2026-10-26', '2026-11-06'],
  '26.4.4': ['2026-11-09', '2026-11-20'],
  '26.4.5': ['2026-11-23', '2026-12-04'],
  '26.4.6': ['2026-12-07', '2026-12-18'],
};
const SPRINT_ORDER = Object.keys(SPRINTS);

const PI_BOUNDS = {
  '26.1': ['2000-01-01', '2026-04-12'],
  '26.2': ['2026-04-13', '2026-07-03'],
  '26.3': ['2026-07-06', '2026-09-25'],
  '26.4': ['2026-09-28', '2026-12-18'],
};

// Configuração por área
const AREA_CONFIG = {
  'G&C':                 { label: 'G&C',                denaEpic: 'DENA-747',  page3: true  },
  'CAPTACAO_ANALITICA':  { label: 'CAPTACAO_ANALITICA',  denaEpic: 'DENA-4',    page3: true  },
  'REVENUE':             { label: 'REVENUE',             denaEpic: 'DENA-2',    page3: true  },
  'ROTINAS_FINANCEIRAS': { label: 'ROTINAS_FINANCEIRAS', denaEpic: 'DENA-272',  page3: true  },
  'DMC':                 { label: 'DMC',                 denaEpic: 'DENA-1031', page3: true  },
  'REVENUE_STRATEGY':    { label: 'REVENUE_STRATEGY',    denaEpic: 'DENA-492',  page3: true  },
  'RVV':                 { label: 'RVV',                 denaEpic: null,        page3: false },
  'REPASSE':             { label: 'REPASSE',             denaEpic: null,        page3: false },
  'ALIANCA_1_SOMOS':     { label: 'ALIANCA_1_SOMOS',     denaEpic: 'DENA-768',  page3: true  },
  'ALIANCA_1_SABER':     { label: 'ALIANCA_1_SABER',     denaEpic: null,        page3: false },
  'Plurall':             { label: 'Plurall',             denaEpic: null,        page3: false },
  'MACROPROCESSO':       { label: 'MACROPROCESSO',       denaEpic: null,        page3: false },
  'ESG':                 { label: 'ESG',                 denaEpic: null,        page3: false },
};

// ── Date helpers ─────────────────────────────────────────────────────────────

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s.slice(0, 10));
  return isNaN(d) ? null : d;
}

function toISO(d) {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function sprintForDate(d) {
  if (!d) return null;
  for (const [sp, [s, e]] of Object.entries(SPRINTS)) {
    if (d >= new Date(s) && d <= new Date(e)) return sp;
  }
  return null;
}

function piForDate(d) {
  if (!d) return null;
  for (const [pi, [s, e]] of Object.entries(PI_BOUNDS)) {
    if (d >= new Date(s) && d <= new Date(e)) return pi;
  }
  return null;
}

function sprintIndex(sp) {
  return SPRINT_ORDER.indexOf(sp);
}

function deriveCurrentSprint(today) {
  const t = today || new Date();
  for (const [sp, [s, e]] of Object.entries(SPRINTS)) {
    if (t >= new Date(s) && t <= new Date(e)) return sp;
  }
  // fallback: sprint mais próxima
  for (const [sp, [s]] of Object.entries(SPRINTS)) {
    if (t < new Date(s)) return sp;
  }
  return SPRINT_ORDER[SPRINT_ORDER.length - 1];
}

function nextSprint(sp) {
  const idx = sprintIndex(sp);
  if (idx === -1 || idx + 1 >= SPRINT_ORDER.length) return null;
  return SPRINT_ORDER[idx + 1];
}

// ── Jira helpers ──────────────────────────────────────────────────────────────

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
    const { data } = await axios.post(url, payload, {
      headers: getHeaders(),
      timeout: 20000,
    });
    issues.push(...(data.issues || []));
    if (data.isLast || !data.nextPageToken || (data.issues || []).length === 0) break;
    nextPageToken = data.nextPageToken;
    page++;
  }
  return issues;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

const DAPL_FIELDS = [
  'summary', 'status', 'issuetype', 'labels',
  'duedate',
  'customfield_10015', // Story start date
  'customfield_10401', // Implantation date
  'customfield_11164', // Epic start date
  'customfield_11165', // Epic end date
  'customfield_10020', // Sprint
  'issuelinks',        // Linked work items (DDPL / DENA)
];

const INCIDENT_FIELDS = [
  'summary', 'status', 'created',
  'customfield_10009', // Término Real
  'customfield_10167', // SLA
  'customfield_10020', // Sprint
  'customfield_10050', // SN ID
];

const LINKED_PROJECTS = ['DDPL', 'DENA'];

function mapDaplItem(issue) {
  const f = issue.fields;
  const type = f.issuetype?.name?.toLowerCase().includes('epic') ? 'Epic' : 'História';
  const start = type === 'Epic'
    ? parseDate(f.customfield_11164)
    : parseDate(f.customfield_10015);
  const end = type === 'Epic'
    ? parseDate(f.customfield_11165)
    : parseDate(f.duedate);

  // Extrai DDPLs e DENAs vinculados via linked work items
  const linked_issues = (f.issuelinks || []).flatMap((link) => {
    const linked = link.outwardIssue || link.inwardIssue;
    if (!linked) return [];
    const proj = linked.key.split('-')[0];
    if (!LINKED_PROJECTS.includes(proj)) return [];
    return [{
      key:       linked.key,
      project:   proj,
      summary:   linked.fields?.summary || '',
      status:    linked.fields?.status?.name || '',
      issuetype: linked.fields?.issuetype?.name || '',
      link_type: link.type?.name || '',
      link_dir:  link.inwardIssue ? 'inward' : 'outward',
    }];
  });

  return {
    key: issue.key,
    type,
    status: f.status?.name || '',
    summary: f.summary || '',
    start,
    end,
    implant: parseDate(f.customfield_10401),
    linked_issues,
  };
}

function mapIncident(issue) {
  const f = issue.fields;
  const parseDateTime = (s) => {
    if (!s) return null;
    const d = new Date(s.slice(0, 19));
    return isNaN(d) ? null : d;
  };
  const sprints = (f.customfield_10020 || []).map((s) => {
    let nm = s.name || '';
    if (nm.startsWith('SP ')) nm = nm.slice(3);
    return nm;
  });
  const sla = parseDateTime(f.customfield_10167);
  const termino = parseDateTime(f.customfield_10009);
  const created = parseDateTime(f.created);

  let slaMet = null;
  if (sla && termino) slaMet = termino <= sla;

  return {
    key: issue.key,
    status: f.status?.name || '',
    summary: f.summary || '',
    created_dt: created,
    sla_dt: sla,
    termino_dt: termino,
    sla_met: slaMet,
    sprints,
    sn_id: f.customfield_10050 || null,
  };
}

// ── Classification logic (ported from data_logic.py) ─────────────────────────

function classify(items, today, currentSprint, nextSp) {
  const result = {
    current_upstream: [],
    current_downstream: [],
    current_homolog: [],
    current_blocked: [],
    current_done: [],
    next_upstream: [],
    next_downstream: [],
    next_homolog: [],
    finalizados: [],
    sem_priorizacao: [],
    gantt: [],
    backlog_planejado: [],
  };

  const t = today || new Date();

  for (const it of items) {
    const { status, start, end, implant, type } = it;

    // Finalizados (Em produção com implantação)
    if (status === 'Em produção' && implant) {
      result.finalizados.push(it);
    }

    // Sem priorização
    if (['Backlog', 'Funil'].includes(status) && !start && !end) {
      result.sem_priorizacao.push(it);
      continue;
    }

    // DENAs nunca entram como upstream (são demandas em execução, sempre downstream)
    const isDena = it.key.startsWith('DENA-');

    // DAPL só entra no downstream se tiver ao menos uma DENA vinculada
    const hasDenaLink = (it.linked_issues || []).some((li) => li.project === 'DENA');

    // Upstream — apenas itens não-DENA
    const spStart = sprintForDate(start);
    if (!isDena) {
      if (spStart === currentSprint) result.current_upstream.push(it);
      else if (spStart === nextSp)   result.next_upstream.push(it);
    }

    // Downstream — regra normal por data de fim (DAPL só entra se tiver DENA vinculada)
    const spEnd = sprintForDate(end);
    if ((isDena || hasDenaLink) && ['Em Andamento', 'Refinamento', 'Homologação', 'Aceito'].includes(status)) {
      if (spEnd === currentSprint) result.current_downstream.push(it);
      else if (spEnd === nextSp)   result.next_downstream.push(it);
    }

    // DENAs: usa start para determinar sprint e força downstream
    if (isDena && spStart) {
      if (spStart === currentSprint && !result.current_downstream.find((x) => x.key === it.key)) {
        result.current_downstream.push(it);
      } else if (spStart === nextSp && !result.next_downstream.find((x) => x.key === it.key)) {
        result.next_downstream.push(it);
      }
    }

    // Downstream em atraso (DAPL só entra se tiver DENA vinculada)
    if ((isDena || hasDenaLink) && status === 'Em Andamento' && end && end < t) {
      const atraso = Math.floor((t - end) / 86400000);
      const enriched = { ...it, _atraso: atraso };
      if (!result.current_downstream.find((x) => x.key === it.key)) {
        result.current_downstream.push(enriched);
      }
    }

    // Homologação atual
    if (status === 'Homologação') {
      const diasHomolog = end ? Math.floor((t - end) / 86400000) : null;
      result.current_homolog.push({ ...it, _dias_homolog: diasHomolog });

      // Homologação prevista (próxima)
      result.next_homolog.push({ ...it, _badge: 'Continua' });
    }

    // Homologação prevista (downstream termina na sprint atual)
    if (spEnd === currentSprint && ['Em Andamento', 'Refinamento'].includes(status)) {
      result.next_homolog.push({ ...it, _badge: 'Downstream → Hom.' });
    }

    // Bloqueados
    if (status === 'Bloqueado') {
      result.current_blocked.push(it);
    }

    // Concluídos nesta sprint
    if (implant && sprintForDate(implant) === currentSprint) {
      result.current_done.push(it);
    }

    // Gantt: épicos ativos
    if (type === 'Epic' && (start || end)) {
      const alreadyDelivered = status === 'Em produção' && end && end < new Date(SPRINTS[currentSprint][0]);
      if (!alreadyDelivered) result.gantt.push(it);
    }
  }

  // Backlog planejado
  result.backlog_planejado = items
    .filter((it) => it.status === 'Backlog' && it.start)
    .sort((a, b) => a.start - b.start);

  result.gantt_full = [...result.gantt, ...result.backlog_planejado];

  return result;
}

function calcPiMetrics(items, finalizados) {
  const piMetrics = { '26.1': [0, 0], '26.2': [0, 0], '26.3': [0, 0], '26.4': [0, 0] };
  for (const it of items) {
    const pi = piForDate(it.end || it.start);
    if (pi && piMetrics[pi]) piMetrics[pi][1]++;
  }
  for (const it of finalizados) {
    const pi = piForDate(it.implant);
    if (pi && piMetrics[pi]) piMetrics[pi][0]++;
  }
  return piMetrics;
}

function buildSprintsForResponse(currentSprint) {
  return Object.fromEntries(
    Object.entries(SPRINTS).map(([sp, [s, e]]) => [sp, { start: s, end: e }])
  );
}

// ── Route: GET /api/status-report ─────────────────────────────────────────────

router.get('/status-report', async (req, res) => {
  try {
    const areaKey = req.query.area || 'G&C';
    const config = AREA_CONFIG[areaKey];
    if (!config) return res.status(400).json({ error: `Área inválida: ${areaKey}` });

    const today = new Date();
    const sprintOverride = req.query.sprint;
    const currentSprint = (sprintOverride && SPRINT_ORDER.includes(sprintOverride))
      ? sprintOverride
      : deriveCurrentSprint(today);
    const nextSp = nextSprint(currentSprint);

    const [sprintEnd] = SPRINTS[currentSprint] ? [SPRINTS[currentSprint][1]] : [null];

    // Fetch DAPL — épicos + histórias separados para garantir compatibilidade de tipo
    const [epicIssues, storyIssues] = await Promise.all([
      fetchAll(`labels = "${config.label}" AND issuetype = Epic ORDER BY key ASC`, DAPL_FIELDS).catch(() => []),
      fetchAll(`labels = "${config.label}" AND issuetype in ("História (M)", História, Story) ORDER BY key ASC`, DAPL_FIELDS).catch(() => []),
    ]);
    const daplIssues = [...epicIssues, ...storyIssues];
    const items = daplIssues.map(mapDaplItem);

    // Fetch incidents (se área tiver DENA) — não bloqueia se falhar
    let incidents = [];
    if (config.page3 && config.denaEpic) {
      try {
        // Tenta com parent primeiro; fallback para "Epic Link" legado
        let incIssues = [];
        for (const jql of [
          `project = DENA AND issuetype = Incidente AND parent = ${config.denaEpic} ORDER BY created DESC`,
          `project = DENA AND issuetype = Incidente AND "Epic Link" = ${config.denaEpic} ORDER BY created DESC`,
        ]) {
          try {
            incIssues = await fetchAll(jql, INCIDENT_FIELDS, 5);
            if (incIssues.length > 0) break;
          } catch (_) { /* tenta próximo */ }
        }
        incidents = incIssues.map(mapIncident);
      } catch (e) {
        console.warn('Falha ao buscar incidentes DENA:', e.message);
      }
    }

    const cls = classify(items, today, currentSprint, nextSp);

    // TODO: remover após preencher Epic Start Date no Jira
    if (areaKey === 'ESG') {
      for (const key of ['DAPL-561', 'DAPL-562']) {
        const it = items.find((i) => i.key === key);
        if (it && !cls.current_upstream.find((i) => i.key === key)) {
          cls.current_upstream.push(it);
        }
      }
    }

    const piMetrics = calcPiMetrics(items, cls.finalizados);

    // Incidents summary
    const currentInc = incidents.filter((i) => i.sprints.includes(currentSprint));
    const incidentsSummary = {
      total: currentInc.length,
      aberto: currentInc.filter((i) => !i.termino_dt).length,
      resolvidos: currentInc.filter((i) => i.termino_dt).length,
      sla_violado: currentInc.filter((i) => i.sla_met === false).length,
    };

    // Incidents by sprint (para histórico)
    const incidentsBySprint = {};
    for (const inc of incidents) {
      const sp = inc.sprints[inc.sprints.length - 1] || 'sem sprint';
      if (!incidentsBySprint[sp]) incidentsBySprint[sp] = [];
      incidentsBySprint[sp].push(inc);
    }

    res.json({
      area: areaKey,
      current_sprint: currentSprint,
      next_sprint: nextSp,
      today: toISO(today),
      sprints_calendar: buildSprintsForResponse(currentSprint),
      sprint_order: SPRINT_ORDER,
      classification: {
        current_upstream:   cls.current_upstream.map(serializeItem),
        current_downstream: cls.current_downstream.map(serializeItem),
        current_homolog:    cls.current_homolog.map(serializeItem),
        current_blocked:    cls.current_blocked.map(serializeItem),
        current_done:       cls.current_done.map(serializeItem),
        next_upstream:      cls.next_upstream.map(serializeItem),
        next_downstream:    cls.next_downstream.map(serializeItem),
        next_homolog:       cls.next_homolog.map(serializeItem),
        finalizados:        cls.finalizados.map(serializeItem),
        sem_priorizacao:    cls.sem_priorizacao.map(serializeItem),
        gantt_full:         cls.gantt_full.map(serializeItem),
      },
      pi_metrics: piMetrics,
      incidents: incidents.map(serializeIncident),
      incidents_summary: incidentsSummary,
      incidents_by_sprint: Object.fromEntries(
        Object.entries(incidentsBySprint).map(([sp, list]) => [sp, list.map(serializeIncident)])
      ),
      has_incidents_page: config.page3,
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Erro ao gerar status report', detail: err.message });
  }
});

function serializeItem(it) {
  return {
    key: it.key,
    type: it.type,
    status: it.status,
    summary: it.summary,
    start: it.start ? toISO(it.start) : null,
    end: it.end ? toISO(it.end) : null,
    implant: it.implant ? toISO(it.implant) : null,
    _atraso: it._atraso ?? null,
    _dias_homolog: it._dias_homolog ?? null,
    _badge: it._badge ?? null,
    linked_issues: it.linked_issues ?? [],
  };
}

function serializeIncident(inc) {
  return {
    key: inc.key,
    status: inc.status,
    summary: inc.summary,
    created_dt: inc.created_dt ? inc.created_dt.toISOString() : null,
    sla_dt: inc.sla_dt ? inc.sla_dt.toISOString() : null,
    termino_dt: inc.termino_dt ? inc.termino_dt.toISOString() : null,
    sla_met: inc.sla_met,
    sprints: inc.sprints,
    sn_id: inc.sn_id,
  };
}

module.exports = router;
