const { Pool } = require('pg');
require('dotenv').config();

const p = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.EXTERNAL_DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const uRes = await p.query("SELECT id FROM users WHERE email = 'tummaladhanush38@gmail.com'");
    if (uRes.rows.length === 0) {
      console.log('User not found');
      return;
    }
    const userId = uRes.rows[0].id;

    let cpRes = await p.query("SELECT id FROM candidate_profiles WHERE user_id = $1", [userId]);
    let cpId = cpRes.rows[0]?.id;
    if (!cpId) {
      const newCp = await p.query(
        "INSERT INTO candidate_profiles (id, user_id, headline, created_at, updated_at) VALUES (gen_random_uuid(), $1, 'Software Engineer', NOW(), NOW()) RETURNING id",
        [userId]
      );
      cpId = newCp.rows[0].id;
    }

    const jRes = await p.query("SELECT id FROM jobs WHERE title = 'Job 1' OR title = 'Backend Java Developer' ORDER BY title ASC LIMIT 1");
    const jobId = jRes.rows[0]?.id;
    if (!jobId) {
      console.log('Job not found');
      return;
    }

    let appRes = await p.query("SELECT id FROM job_applications WHERE candidate_id = $1 AND job_id = $2", [cpId, jobId]);
    let appId = appRes.rows[0]?.id;
    if (!appId) {
      const newApp = await p.query(
        "INSERT INTO job_applications (id, job_id, candidate_id, status, applied_at, updated_at) VALUES (gen_random_uuid(), $1, $2, 'SHORTLISTED', NOW(), NOW()) RETURNING id",
        [jobId, cpId]
      );
      appId = newApp.rows[0].id;
    }

    let regRes = await p.query("SELECT id FROM interview_registrations WHERE candidate_id = $1 AND job_id = $2", [cpId, jobId]);
    if (regRes.rows.length === 0) {
      await p.query(
        `INSERT INTO interview_registrations (
          id, application_id, candidate_id, job_id,
          interview_code, technical_assessment_code, interview_code_hash, interview_code_last4,
          registration_status, interview_status, status, registered_at, created_at,
          code_attempt_count, max_code_attempts, is_code_revoked
        ) VALUES (
          gen_random_uuid(), $1, $2, $3,
          'TECH-8023', 'TECH-8023', 'TECH-8023', '8023',
          'READY', 'READY_TO_ATTEND', 'READY', NOW(), NOW(),
          0, 5, false
        )`,
        [appId, cpId, jobId]
      );
      console.log('Registration created successfully for tummaladhanush38');
    } else {
      console.log('Registration already exists for tummaladhanush38');
    }

    await p.query("UPDATE interview_registrations SET interview_status = 'READY_TO_ATTEND', registration_status = 'READY', status = 'READY', code_attempt_count = 0");
    await p.query("UPDATE interviews SET status = 'READY', malpractice_flag = false, warning_count = 0, completed_at = NULL, terminated_at = NULL");
    console.log('ALL CANDIDATES RESET TO READY_TO_ATTEND!');
  } catch (err) {
    console.error('Error in registerCandidates:', err);
  } finally {
    await p.end();
  }
}

main();
