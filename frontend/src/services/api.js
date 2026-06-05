import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

// Sprints
export const getSprints = () => api.get('/sprints').then((r) => r.data);
export const getSprint = (id) => api.get(`/sprint/${id}`).then((r) => r.data);
export const createSprint = (data) => api.post('/sprint', data).then((r) => r.data);

// Cards dentro de uma sprint
export const addCard = (sprintId, card) =>
  api.post(`/sprint/${sprintId}/cards`, card).then((r) => r.data);
export const updateCard = (sprintId, key, data) =>
  api.put(`/sprint/${sprintId}/cards/${key}`, data).then((r) => r.data);
export const deleteCard = (sprintId, key) =>
  api.delete(`/sprint/${sprintId}/cards/${key}`).then((r) => r.data);
export const syncSprintJira = (sprintId) =>
  api.post(`/sprint/${sprintId}/sync`).then((r) => r.data);

// Jira
export const getJiraCard = (key) => api.get(`/jira/card/${key}`).then((r) => r.data);
export const getStories = () => api.get('/stories').then((r) => r.data);
export const getEpics = () => api.get('/epics').then((r) => r.data);

// Review
export const getReview = (sprintId) => api.get(`/review/${sprintId}`).then((r) => r.data);
export const syncReview = (sprintId) => api.post(`/review/${sprintId}/sincronizar`).then((r) => r.data);
export const getComparacao = (sprintId, prevId) =>
  api.get(`/review/${sprintId}/comparacao/${prevId}`).then((r) => r.data);

// Report
export const getReport = (sprintId) => api.get(`/report/${sprintId}`).then((r) => r.data);
export const saveReport = (sprintId, data) => api.post(`/report/${sprintId}`, data).then((r) => r.data);
export const syncReport = (sprintId) => api.post(`/report/${sprintId}/sincronizar`).then((r) => r.data);

// Macroprocessos
export const getMacroprocessos = () => api.get('/macroprocessos').then((r) => r.data);

// Jira transitions
export const transitionIssue = (key, targetStatus) =>
  api.post(`/jira/issue/${key}/transition`, { targetStatus }).then((r) => r.data);

// Jira issue detail & edit
export const getIssueDetail      = (key) => api.get(`/jira/issue/${key}/detail`).then((r) => r.data);
export const getIssueAssignable  = (key) => api.get(`/jira/issue/${key}/assignable`).then((r) => r.data);
export const getProjectMembers   = () => api.get('/jira/project-members').then((r) => r.data);
export const getIssueTransitions = (key) => api.get(`/jira/issue/${key}/transitions`).then((r) => r.data);
export const updateIssue         = (key, data) => api.put(`/jira/issue/${key}/update`, data).then((r) => r.data);

// Documentação
export const getDocumentacao = (sprintId) => api.get(`/documentacao/${sprintId}`).then((r) => r.data);
export const gerarDocumentacao = (sprintId) => api.post(`/documentacao/${sprintId}/gerar`).then((r) => r.data);
export const publishConfluence = (sprintId, data) => api.post(`/documentacao/${sprintId}/confluence`, data).then((r) => r.data);
export const sendEmailDoc = (sprintId, data) => api.post(`/documentacao/${sprintId}/email`, data).then((r) => r.data);
export const getDocHistorico = (projetoId) => api.get(`/documentacao/historico/${projetoId}`).then((r) => r.data);
