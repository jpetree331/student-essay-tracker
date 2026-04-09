require('express-async-errors');
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middleware/errorHandler');

const studentsRouter = require('./routes/students');
const assignmentsRouter = require('./routes/assignments');
const entriesRouter = require('./routes/entries');
const sourceLinksRouter = require('./routes/sourceLinks');
const writingTagsRouter = require('./routes/writingTags');
const analyticsRouter = require('./routes/analytics');
const analyzeWritingRouter = require('./routes/analyzeWriting');
const compareProgressRouter = require('./routes/compareProgress');
const comparisonsRouter = require('./routes/comparisons');

const app = express();
const PORT = process.env.PORT || 3010;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ success: true, data: { ok: true }, error: null });
});

app.use('/api/students', studentsRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/entries', entriesRouter);
app.use('/api/source-links', sourceLinksRouter);
app.use('/api/writing-tags', writingTagsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/analyze-writing', analyzeWritingRouter);
app.use('/api/compare-progress', compareProgressRouter);
app.use('/api/comparisons', comparisonsRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, data: null, error: 'Not found' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Essay organizer API listening on http://localhost:${PORT}`);
});
