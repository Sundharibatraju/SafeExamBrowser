const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.EXTERNAL_DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspectAll() {
  const jobs = await pool.query('SELECT id, title, technical_assessment_questions FROM jobs;');
  for (const j of jobs.rows) {
    console.log('=== JOB:', j.title, '(', j.id, ') ===');
    const jq = j.technical_assessment_questions;
    console.log('  jobs.technical_assessment_questions:', jq ? jq.length + ' questions: ' + jq.map(q => q.title || q.questionText || q.id).join('; ') : 'null');
    
    const tas = await pool.query('SELECT id, title, questions FROM technical_assessments WHERE job_id::text = $1', [j.id]);
    for (const t of tas.rows) {
      const q = typeof t.questions === 'string' ? JSON.parse(t.questions) : t.questions;
      console.log('  TA id:', t.id, 'title:', t.title, 'q count:', q?.length, 'questions:', q?.map(x => x.questionText || x.title || x.question || x.id));
    }
    const as = await pool.query('SELECT id, title, questions FROM assessments WHERE job_id::text = $1', [j.id]);
    for (const a of as.rows) {
      const q = typeof a.questions === 'string' ? JSON.parse(a.questions) : a.questions;
      console.log('  Asmt id:', a.id, 'title:', a.title, 'q count:', q?.length, 'questions:', q?.map(x => x.questionText || x.title || x.question || x.id));
    }
  }
}

inspectAll()
  .then(() => pool.end())
  .catch(err => {
    console.error('Inspect error:', err);
    pool.end();
  });
