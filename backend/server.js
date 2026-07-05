require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jiraRoutes = require('./routes/jira');
const sprintRoutes = require('./routes/sprint');
const reviewRoutes = require('./routes/review');
const reportRoutes = require('./routes/report');
const documentacaoRoutes = require('./routes/documentacao');
const statusReportRoutes = require('./routes/statusReport');
const entregasRoutes     = require('./routes/entregas');
const plataformaRoutes   = require('./routes/plataforma');

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  /\.vercel\.app$/,
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use('/api', jiraRoutes);
app.use('/api', sprintRoutes);
app.use('/api', reviewRoutes);
app.use('/api', reportRoutes);
app.use('/api', documentacaoRoutes);
app.use('/api', statusReportRoutes);
app.use('/api', entregasRoutes);
app.use('/api', plataformaRoutes);

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Backend rodando em http://localhost:${PORT}`));
}

module.exports = app;
