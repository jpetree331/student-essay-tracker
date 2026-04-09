import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const body = error.response?.data;
    if (body && typeof body === 'object' && typeof body.error === 'string' && body.error) {
      return Promise.reject(new Error(body.error));
    }
    const msg = error.message || 'Request failed';
    return Promise.reject(error instanceof Error ? error : new Error(msg));
  }
);

function unwrap(response) {
  const body = response.data;
  if (!body || typeof body.success !== 'boolean') {
    throw new Error('Unexpected API response');
  }
  if (!body.success) {
    throw new Error(body.error || 'Request failed');
  }
  return body.data;
}

export async function getStudents() {
  const res = await api.get('/api/students');
  return unwrap(res);
}

export async function getStudentById(id) {
  const res = await api.get(`/api/students/${id}`);
  return unwrap(res);
}

export async function getStudentEntries(studentId) {
  const res = await api.get(`/api/students/${studentId}/entries`);
  return unwrap(res);
}

export async function createStudent(payload) {
  const res = await api.post('/api/students', payload);
  return unwrap(res);
}

export async function updateStudent(id, payload) {
  const res = await api.put(`/api/students/${id}`, payload);
  return unwrap(res);
}

export async function upsertWritingTags(payload) {
  const res = await api.post('/api/writing-tags', payload);
  return unwrap(res);
}

export async function getClassSummary() {
  const res = await api.get('/api/analytics/class-summary');
  return unwrap(res);
}

export async function getStudentAnalytics(studentId) {
  const res = await api.get(`/api/analytics/student/${studentId}`);
  return unwrap(res);
}

export async function getAssignments() {
  const res = await api.get('/api/assignments');
  return unwrap(res);
}

export async function createAssignment(payload) {
  const res = await api.post('/api/assignments', payload);
  return unwrap(res);
}

export async function updateAssignment(id, payload) {
  const res = await api.put(`/api/assignments/${id}`, payload);
  return unwrap(res);
}

/** Latest entry per student for print/PDF pack (writing sample + teacher notes). */
export async function getAssignmentPrintSubmissions(assignmentId) {
  const res = await api.get(`/api/assignments/${assignmentId}/print-submissions`);
  return unwrap(res);
}

export async function getEntry(id) {
  const res = await api.get(`/api/entries/${id}`);
  return unwrap(res);
}

export async function createEntry(payload) {
  const res = await api.post('/api/entries', payload);
  return unwrap(res);
}

export async function updateEntry(id, payload) {
  const res = await api.put(`/api/entries/${id}`, payload);
  return unwrap(res);
}

export async function createSourceLink(payload) {
  const res = await api.post('/api/source-links', payload);
  return unwrap(res);
}

export async function deleteSourceLink(id) {
  const res = await api.delete(`/api/source-links/${id}`);
  return unwrap(res);
}

export async function analyzeWriting(payload) {
  const res = await api.post('/api/analyze-writing', payload);
  return unwrap(res);
}

export async function getUntaggedEntriesForAnalysis() {
  const res = await api.get('/api/analyze-writing/untagged-entries');
  return unwrap(res);
}

export async function compareProgress(payload) {
  const res = await api.post('/api/compare-progress', payload);
  return unwrap(res);
}

export async function getStudentComparisons(studentId) {
  const res = await api.get(`/api/students/${studentId}/comparisons`);
  return unwrap(res);
}

export async function saveComparison(payload) {
  const res = await api.post('/api/comparisons', payload);
  return unwrap(res);
}
