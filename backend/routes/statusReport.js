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

// ── Size map (components field) ───────────────────────────────────────────────

const SIZE_MAP = {
  'size-PP':   { up: 1, dn: 1 },
  'size-P':    { up: 2, dn: 1 },
  'size-M':    { up: 2, dn: 2 },
  'size-G':    { up: 3, dn: 2 },
  'size-GG':   { up: 4, dn: 2 },
  'size-Epic': { up: 1, dn: null }, // TBD
};

// ── Área config ───────────────────────────────────────────────────────────────

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
  'VOOMP':               { label: 'VOOMP',               denaEpic: null,        page3: false },
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
  'duedate',             // limite da história (para badge "tombou")
  'customfield_10401',   // Data de Implantação
  'customfield_10020',   // Sprint alocada no board
  'components',          // size-PP / size-P / size-M / size-G / size-GG / size-Epic
  'parent',              // épico pai (key + summary)
];

const INCIDENT_FIELDS = [
  'summary', 'status', 'created',
  'customfield_10009', // Término Real
  'customfield_10167', // SLA
  'customfield_10020', // Sprint
  'customfield_10050', // SN ID
];

// ── Map DAPL issue ────────────────────────────────────────────────────────────

function mapDaplItem(issue) {
  const f = issue.fields;

  // Sprint: última entrada da lista = sprint atual do card
  const rawSprints = (f.customfield_10020 || []).map((s) => {
    let nm = s.name || '';
    if (nm.startsWith('SP ')) nm = nm.slice(3);
    return nm;
  });
  const sprint        = rawSprints.length ? rawSprints[rawSprints.length - 1] : null;
  const sprints_count = rawSprints.length;

  // Size via components
  const sizeComp = (f.components || []).find((c) => (c.name || '').startsWith('size-'));
  const sizeCode = sizeComp?.name || null;
  const size     = sizeCode && SIZE_MAP[sizeCode] ? { ...SIZE_MAP[sizeCode], code: sizeCode } : null;

  // Épico pai
  const parent = f.parent
    ? { key: f.parent.key, summary: f.parent.fields?.summary || '' }
    : null;

  return {
    key:           issue.key,
    type:          'História',
    status:        f.status?.name || '',
    summary:       f.summary || '',
    duedate:       f.duedate || null,
    implant:       parseDate(f.customfield_10401),
    sprint,
    sprints_count,
    size,
    parent,
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
  const sla     = parseDateTime(f.customfield_10167);
  const termino = parseDateTime(f.customfield_10009);
  const created = parseDateTime(f.created);

  let slaMet = null;
  if (sla && termino) slaMet = termino <= sla;

  return {
    key:        issue.key,
    status:     f.status?.name || '',
    summary:    f.summary || '',
    created_dt: created,
    sla_dt:     sla,
    termino_dt: termino,
    sla_met:    slaMet,
    sprints,
    sn_id:      f.customfield_10050 || null,
  };
}

// ── Classification ────────────────────────────────────────────────────────────

function classify(items, today, currentSprint, nextSp) {
  const result = {
    current_upstream:   [],
    current_downstream: [],
    current_homolog:    [],
    current_blocked:    [],
    current_done:       [],
    next_upstream:      [],
    next_downstream:    [],
    next_homolog:       [],
    finalizados:        [],
    sem_priorizacao:    [],
    all_blocked:        [],
    gantt:              [],
    backlog_planejado:  [],
  };

  const t = today || new Date();

  const DONE_STATUSES     = ['Pronto', 'Em produção', 'Aceito'];
  const HOMOLOG_STATUSES  = ['Homologação', 'Concluído'];
  const UPSTREAM_STATUSES = ['Refinamento', 'Backlog'];

  for (const it of items) {
    const { status, sprint, duedate, implant, size } = it;

    // ── Cancelados: ignorados em todas as visões ───────────────────────────
    if (status === 'Cancelado') continue;

    // ── Bloqueados ─────────────────────────────────────────────────────────
    if (status === 'Bloqueado') {
      result.all_blocked.push(it);
      if (sprint === currentSprint) result.current_blocked.push(it);
      if (sprint) result.gantt.push(it);
      continue;
    }

    // ── Finalizados ────────────────────────────────────────────────────────
    // Pronto / Em produção / Aceito — exige implant para contar como finalizado
    if (DONE_STATUSES.includes(status)) {
      if (implant) {
        result.finalizados.push(it);
        if (sprintForDate(implant) === currentSprint) {
          result.current_done.push(it);
        }
      }
      continue; // não aparece em sprint cards nem no gantt
    }

    // ── Sem priorização: sem sprint alocada ────────────────────────────────
    if (!sprint) {
      result.sem_priorizacao.push(it);
      continue;
    }

    // ── A partir daqui: item ativo com sprint ──────────────────────────────
    result.gantt.push(it);

    if (sprint === currentSprint) {

      if (UPSTREAM_STATUSES.includes(status)) {
        result.current_upstream.push(it);

        // Upstream → próxima sprint downstream (por size)
        const sizeUp    = size?.up || 1;
        const isEpicSz  = size?.code === 'size-Epic';
        if (!isEpicSz && it.sprints_count >= sizeUp) {
          result.next_downstream.push({ ...it, _badge: 'UP → DN' });
        }

      } else if (status === 'Em Andamento') {
        const atraso = duedate && new Date(duedate) < t
          ? Math.floor((t - new Date(duedate)) / 86400000)
          : null;
        result.current_downstream.push({ ...it, _atraso: atraso });
        result.next_homolog.push({ ...it, _badge: 'Downstream → Hom.' });

      } else if (HOMOLOG_STATUSES.includes(status)) {
        // Concluído (Jira) = Homologação no relatório (aguardando aceite)
        const diasHomolog = implant ? Math.floor((t - implant) / 86400000) : null;
        result.current_homolog.push({ ...it, _dias_homolog: diasHomolog });
        result.next_homolog.push({ ...it, _badge: 'Continua' });
      }
    }

    // ── Próxima sprint upstream ────────────────────────────────────────────
    if (sprint === nextSp && !DONE_STATUSES.includes(status) && status !== 'Bloqueado') {
      result.next_upstream.push(it);
    }
  }

  // Backlog com sprint futura (para sidebar PI)
  result.backlog_planejado = result.gantt.filter((it) =>
    it.status === 'Backlog' &&
    SPRINT_ORDER.indexOf(it.sprint) > SPRINT_ORDER.indexOf(currentSprint)
  );

  // Gantt full = gantt (dedup por key)
  result.gantt_full = result.gantt;

  return result;
}

// ── PI metrics ────────────────────────────────────────────────────────────────

function calcPiMetrics(items, finalizados) {
  const piMetrics = { '26.1': [0, 0], '26.2': [0, 0], '26.3': [0, 0], '26.4': [0, 0] };

  // Planejado: mapeia sprint do item → PI
  for (const it of items) {
    if (!it.sprint || !SPRINTS[it.sprint]) continue;
    const pi = piForDate(new Date(SPRINTS[it.sprint][0]));
    if (pi && piMetrics[pi]) piMetrics[pi][1]++;
  }
  // Entregue: finalizados com implant
  for (const it of finalizados) {
    const pi = it.implant ? piForDate(it.implant) : null;
    if (pi && piMetrics[pi]) piMetrics[pi][0]++;
  }
  return piMetrics;
}

function buildSprintsForResponse() {
  return Object.fromEntries(
    Object.entries(SPRINTS).map(([sp, [s, e]]) => [sp, { start: s, end: e }])
  );
}

// ── Serializers ───────────────────────────────────────────────────────────────

function serializeItem(it) {
  return {
    key:           it.key,
    type:          it.type,
    status:        it.status,
    summary:       it.summary,
    duedate:       it.duedate || null,
    implant:       it.implant ? toISO(it.implant) : null,
    sprint:        it.sprint || null,
    sprints_count: it.sprints_count || 0,
    size:          it.size || null,
    parent:        it.parent || null,
    _atraso:       it._atraso ?? null,
    _dias_homolog: it._dias_homolog ?? null,
    _badge:        it._badge ?? null,
  };
}

function serializeIncident(inc) {
  return {
    key:        inc.key,
    status:     inc.status,
    summary:    inc.summary,
    created_dt: inc.created_dt ? inc.created_dt.toISOString() : null,
    sla_dt:     inc.sla_dt    ? inc.sla_dt.toISOString()    : null,
    termino_dt: inc.termino_dt ? inc.termino_dt.toISOString() : null,
    sla_met:    inc.sla_met,
    sprints:    inc.sprints,
    sn_id:      inc.sn_id,
  };
}

// ── Route: GET /api/status-report ─────────────────────────────────────────────

router.get('/status-report', async (req, res) => {
  try {
    const areaKey = req.query.area || 'G&C';
    const config  = AREA_CONFIG[areaKey];
    if (!config) return res.status(400).json({ error: `Área inválida: ${areaKey}` });

    const today         = new Date();
    const sprintOverride = req.query.sprint;
    const currentSprint = (sprintOverride && SPRINT_ORDER.includes(sprintOverride))
      ? sprintOverride
      : deriveCurrentSprint(today);
    const nextSp = nextSprint(currentSprint);

    // Apenas Histórias do projeto DAPL — épicos nunca são exibidos, parent vem via campo "parent"
    const storyIssues = await fetchAll(
      `project = DAPL AND labels = "${config.label}" AND issuetype in ("História (M)", História, Story) ORDER BY key ASC`,
      DAPL_FIELDS
    ).catch(() => []);
    const items = storyIssues.map(mapDaplItem);

    // Incidentes (se área tiver DENA)
    let incidents = [];
    if (config.page3 && config.denaEpic) {
      try {
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

    const cls        = classify(items, today, currentSprint, nextSp);
    const piMetrics  = calcPiMetrics(items, cls.finalizados);

    const currentInc       = incidents.filter((i) => i.sprints.includes(currentSprint));
    const incidentsSummary = {
      total:       currentInc.length,
      aberto:      currentInc.filter((i) => !i.termino_dt).length,
      resolvidos:  currentInc.filter((i) => i.termino_dt).length,
      sla_violado: currentInc.filter((i) => i.sla_met === false).length,
    };

    const incidentsBySprint = {};
    for (const inc of incidents) {
      const sp = inc.sprints[inc.sprints.length - 1] || 'sem sprint';
      if (!incidentsBySprint[sp]) incidentsBySprint[sp] = [];
      incidentsBySprint[sp].push(inc);
    }

    res.json({
      area:             areaKey,
      current_sprint:   currentSprint,
      next_sprint:      nextSp,
      today:            toISO(today),
      sprints_calendar: buildSprintsForResponse(),
      sprint_order:     SPRINT_ORDER,
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
        all_blocked:        cls.all_blocked.map(serializeItem),
        backlog_planejado:  cls.backlog_planejado.map(serializeItem),
        gantt_full:         cls.gantt_full.map(serializeItem),
      },
      pi_metrics:           piMetrics,
      incidents:            incidents.map(serializeIncident),
      incidents_summary:    incidentsSummary,
      incidents_by_sprint:  Object.fromEntries(
        Object.entries(incidentsBySprint).map(([sp, list]) => [sp, list.map(serializeIncident)])
      ),
      has_incidents_page: config.page3,
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Erro ao gerar status report', detail: err.message });
  }
});

module.exports = router;
