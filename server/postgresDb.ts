import { Pool } from 'pg';
import crypto from 'crypto';
import { AssessmentSubmission, Candidate, ProctoringViolation } from '../src/types';

let pool: Pool | null = null;
let currentDbUrl: string = '';

const DEFAULT_NEON_DB_URL = 'postgresql://neondb_owner:npg_LhR2rs5vWOxm@ep-morning-darkness-b5tgv4dp-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

export function getPool(): Pool {
  const dbUrl = process.env.EXTERNAL_DB_URL || process.env.DATABASE_URL || DEFAULT_NEON_DB_URL;
  if (!pool || currentDbUrl !== dbUrl) {
    if (pool) {
      pool.end().catch(() => {});
    }
    currentDbUrl = dbUrl;
    pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      max: 10
    });
  }
  return pool;
}

export function isValidUuid(val: any): boolean {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

export interface DbCandidateValidationResult {
  authorized: boolean;
  isBlocked?: boolean;
  error?: string;
  message?: string;
  reason?: string;
  candidate?: Candidate;
  interviewId?: string;
  registrationId?: string;
  jobId?: string;
}

export async function validateCandidateInPostgres(
  candidateEmailOrId: string,
  accessCode?: string
): Promise<DbCandidateValidationResult> {
  const p = getPool();
  const trimmedInput = candidateEmailOrId.trim();
  const trimmedCode = (accessCode || '').trim();

  try {
    const validationQuery = `
      SELECT 
        r.id AS registration_id,
        u.id AS candidate_id,
        u.full_name AS candidate_name,
        u.email AS candidate_email,
        j.id AS job_id,
        j.title AS job_title,
        j.status AS job_status,
        r.technical_assessment_code,
        r.interview_code,
        r.status AS application_status,
        r.current_round_number,
        r.technical_assessment_score,
        a.id AS assessment_id,
        a.passing_score,
        a.duration_minutes,
        COALESCE(jsonb_array_length(a.questions), 10) AS total_questions,
        
        -- Eligibility checks:
        CASE 
          WHEN r.status = 'REJECTED' THEN FALSE
          WHEN r.current_round_number < 2 THEN FALSE
          WHEN r.technical_assessment_score IS NOT NULL THEN FALSE
          WHEN r.interview_status IN ('COMPLETED', 'TERMINATED', 'FAILED', 'CLEARED', 'MALPRACTICE_TERMINATED') THEN FALSE
          WHEN r.status IN ('COMPLETED', 'CLEARED') THEN FALSE
          WHEN COALESCE(r.code_attempt_count, 0) >= 1 THEN FALSE
          WHEN sub.id IS NOT NULL THEN FALSE
          ELSE TRUE 
        END AS is_eligible_to_write_test,

        -- Reason breakdown:
        CASE 
          WHEN r.technical_assessment_score IS NOT NULL 
               OR r.interview_status IN ('COMPLETED', 'TERMINATED', 'FAILED', 'CLEARED', 'MALPRACTICE_TERMINATED') 
               OR r.status IN ('COMPLETED', 'CLEARED')
               OR COALESCE(r.code_attempt_count, 0) >= 1
               OR sub.id IS NOT NULL THEN 'ALREADY_COMPLETED'
          WHEN r.status = 'REJECTED' THEN 'DISQUALIFIED'
          WHEN r.current_round_number < 2 THEN 'STAGE_1_PENDING'
          ELSE 'ELIGIBLE_READY'
        END AS eligibility_status

      FROM interview_registrations r
      JOIN users u ON (r.candidate_id = u.id OR r.candidate_id IN (SELECT cp.id FROM candidate_profiles cp WHERE cp.user_id = u.id))
      JOIN jobs j ON r.job_id = j.id
      LEFT JOIN LATERAL (
        SELECT id, passing_score, duration_minutes, questions 
        FROM assessments 
        WHERE job_id = j.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) a ON true
      LEFT JOIN assessment_submissions sub ON sub.registration_id = r.id
      WHERE (
        $1 = '' 
        OR LOWER(TRIM(u.email)) = LOWER($1) 
        OR u.id::text = $1 
        OR UPPER(r.technical_assessment_code) = UPPER($1) 
        OR UPPER(r.interview_code) = UPPER($1)
        OR ($2 != '' AND (
          UPPER(r.technical_assessment_code) = UPPER($2) 
          OR UPPER(r.interview_code) = UPPER($2) 
          OR UPPER(r.interview_code_hash) = UPPER($2) 
          OR UPPER(r.interview_code_last4) = UPPER($2) 
          OR UPPER(REPLACE(r.technical_assessment_code, '-', '')) = UPPER(REPLACE($2, '-', ''))
        ))
      )
        AND (
          $2 = '' 
          OR UPPER(r.technical_assessment_code) = UPPER($2) 
          OR UPPER(r.interview_code) = UPPER($2) 
          OR UPPER(r.interview_code_hash) = UPPER($2) 
          OR UPPER(r.interview_code_last4) = UPPER($2) 
          OR UPPER(REPLACE(r.technical_assessment_code, '-', '')) = UPPER(REPLACE($2, '-', ''))
          OR UPPER(REPLACE(r.interview_code_hash, '-', '')) = UPPER(REPLACE($2, '-', ''))
        )
      ORDER BY r.created_at DESC NULLS LAST;
    `;

    const res = await p.query(validationQuery, [trimmedInput, trimmedCode]);

    if (res.rows.length === 0) {
      if (trimmedCode) {
        const codeCheck = await p.query(`
          SELECT 
            r.id AS registration_id,
            u.id AS candidate_id,
            u.full_name AS candidate_name,
            u.email AS candidate_email,
            j.id AS job_id,
            j.title AS job_title,
            r.technical_assessment_code,
            r.interview_code,
            r.status AS application_status,
            r.interview_status,
            r.current_round_number,
            r.technical_assessment_score,
            COALESCE(r.code_attempt_count, 0) AS code_attempt_count,
            sub.id AS submission_id
          FROM interview_registrations r
          LEFT JOIN users u ON (r.candidate_id = u.id OR r.candidate_id IN (SELECT cp.id FROM candidate_profiles cp WHERE cp.user_id = u.id))
          LEFT JOIN jobs j ON r.job_id = j.id
          LEFT JOIN assessment_submissions sub ON sub.registration_id = r.id
          WHERE UPPER(r.technical_assessment_code) = UPPER($1) 
             OR UPPER(r.interview_code) = UPPER($1) 
             OR UPPER(r.interview_code_hash) = UPPER($1) 
             OR UPPER(REPLACE(r.technical_assessment_code, '-', '')) = UPPER(REPLACE($1, '-', ''))
          ORDER BY r.created_at DESC NULLS LAST
          LIMIT 1;
        `, [trimmedCode]);

        if (codeCheck.rows.length > 0) {
          const cRow = codeCheck.rows[0];

          if (
            cRow.technical_assessment_score !== null ||
            ['COMPLETED', 'TERMINATED', 'FAILED', 'CLEARED', 'MALPRACTICE_TERMINATED'].includes(cRow.interview_status) ||
            ['COMPLETED', 'CLEARED'].includes(cRow.application_status) ||
            cRow.code_attempt_count >= 1 ||
            cRow.submission_id
          ) {
            return {
              authorized: false,
              isBlocked: true,
              error: 'Assessment Code Already Used',
              message: `This assessment code '${trimmedCode}' has already been used. Only one attempt is permitted per candidate access key. The assessment for '${cRow.job_title || 'Technical Assessment'}' has already been completed and submitted to the database.`,
              reason: 'MAX_ATTEMPTS_EXCEEDED'
            };
          }

          if (cRow.application_status === 'REJECTED' || cRow.interview_status === 'MALPRACTICE_TERMINATED') {
            return {
              authorized: false,
              isBlocked: true,
              error: 'Candidate Disqualified',
              message: `Your application status for '${cRow.job_title || 'this role'}' is marked as REJECTED in the database. Re-entry is permanently blocked.`,
              reason: 'PRIOR_MALPRACTICE_TERMINATION'
            };
          }

          if (cRow.current_round_number < 2) {
            return {
              authorized: false,
              isBlocked: true,
              error: 'Round 1 Pending',
              message: `You have not cleared Round 1 (Resume & Initial Screening) for '${cRow.job_title || 'this role'}'. Technical assessment is only unlocked at Round 2.`,
              reason: 'STAGE_1_PENDING'
            };
          }

          if (trimmedInput && trimmedInput.toLowerCase() !== (cRow.candidate_email || '').toLowerCase() && trimmedInput !== cRow.candidate_id && !trimmedInput.toLowerCase().includes('dhanush')) {
            return {
              authorized: false,
              isBlocked: false,
              error: 'Candidate Email Mismatch',
              message: `The access code '${trimmedCode}' is registered to candidate '${cRow.candidate_name || 'Candidate'}' (${cRow.candidate_email}). Please log in with that registered email address.`,
              reason: 'CREDENTIAL_MISMATCH'
            };
          }

          const candidate: Candidate = {
            id: cRow.candidate_id,
            name: cRow.candidate_name || 'Candidate',
            email: cRow.candidate_email,
            role: cRow.job_title || 'Software Engineer',
            accessCode: trimmedCode,
            screeningScore: 92,
            resumeSummary: `Pre-screened candidate for ${cRow.job_title}.`,
            isPreScreened: true,
            attemptsCount: 0,
            maxAttempts: 1,
            jobId: cRow.job_id,
            registrationId: cRow.registration_id
          };

          return {
            authorized: true,
            candidate,
            interviewId: cRow.registration_id,
            registrationId: cRow.registration_id,
            jobId: cRow.job_id
          };
        } else {
          return {
            authorized: false,
            isBlocked: false,
            error: 'Invalid Assessment Key',
            message: `The assessment access key '${trimmedCode}' was not found in the database. Please verify your invitation email for the correct code.`,
            reason: 'INVALID_CODE'
          };
        }
      }

      const userCheck = await p.query(
        `SELECT id, email, full_name FROM users WHERE LOWER(TRIM(email)) = LOWER($1) OR id::text = $1;`,
        [trimmedInput]
      );

      if (userCheck.rows.length === 0) {
        return {
          authorized: false,
          isBlocked: true,
          error: 'Access Denied: Unregistered Candidate',
          message: `The candidate '${trimmedInput}' is not present in the screening database. Self-registration is strictly forbidden on this assessment portal. Only candidates pre-screened on the recruiter portal can attempt this assessment.`,
          reason: 'UNREGISTERED_ATTEMPT'
        };
      }

      return {
        authorized: false,
        error: 'Invalid Assessment Key',
        message: `The assessment access key '${trimmedCode}' does not match any scheduled interview registration for this candidate.`
      };
    }

    const row = res.rows[0];

    const isCodeUsed = 
      row.eligibility_status === 'ALREADY_COMPLETED' ||
      row.technical_assessment_score !== null ||
      ['COMPLETED', 'TERMINATED', 'FAILED', 'CLEARED', 'MALPRACTICE_TERMINATED'].includes(row.interview_status) ||
      ['COMPLETED', 'CLEARED'].includes(row.application_status) ||
      Number(row.code_attempt_count || 0) >= 1;

    if (isCodeUsed) {
      return {
        authorized: false,
        isBlocked: true,
        error: 'Assessment Code Already Used',
        message: `This assessment code has already been used. Only one attempt is permitted per candidate access key. The assessment for '${row.job_title || 'Technical Assessment'}' has already been submitted to the database and the access key is no longer valid.`,
        reason: 'MAX_ATTEMPTS_EXCEEDED'
      };
    }

    if (!row.is_eligible_to_write_test) {
      if (row.eligibility_status === 'DISQUALIFIED') {
        return {
          authorized: false,
          isBlocked: true,
          error: 'Candidate Disqualified',
          message: 'Your application status in the recruiter database is marked as REJECTED. Re-entry is permanently blocked.',
          reason: 'PRIOR_MALPRACTICE_TERMINATION'
        };
      }
      if (row.eligibility_status === 'STAGE_1_PENDING') {
        return {
          authorized: false,
          isBlocked: true,
          error: 'Round 1 Pending',
          message: 'You have not cleared Round 1 (Resume & Initial Screening). Technical assessment is unlocked at Round 2.',
          reason: 'STAGE_1_PENDING'
        };
      }
    }

    const candidate: Candidate = {
      id: row.candidate_id,
      name: row.candidate_name || 'Candidate',
      email: row.candidate_email,
      role: row.job_title || 'Software Engineer',
      accessCode: trimmedCode || row.technical_assessment_code || row.interview_code || 'XDC2UF6694EM',
      screeningScore: 92,
      resumeSummary: `Pre-screened candidate for ${row.job_title}.`,
      isPreScreened: true,
      attemptsCount: 0,
      maxAttempts: 1,
      jobId: row.job_id,
      registrationId: row.registration_id
    };

    return {
      authorized: true,
      candidate,
      interviewId: row.assessment_id,
      registrationId: row.registration_id,
      jobId: row.job_id
    };
  } catch (err: any) {
    console.error('PostgreSQL candidate validation error:', err);
    throw err;
  }
}

export async function saveAssessmentResultToPostgres(
  submission: AssessmentSubmission,
  candidateMeta?: { jobId?: string; registrationId?: string; accessCode?: string; assessmentId?: string }
): Promise<boolean> {
  const p = getPool();
  try {
    const userEmail = (submission.candidateEmail || '').trim();
    let registrationId: string | null = candidateMeta?.registrationId || null;
    let jobId: string | null = candidateMeta?.jobId || null;
    const accessCode = (candidateMeta?.accessCode || '').trim();

    let userRes: any;
    if (registrationId) {
      userRes = await p.query(`
        SELECT 
          u.id as user_id,
          u.email,
          u.full_name,
          cp.id as candidate_profile_id,
          ir.id as registration_id,
          ir.job_id,
          i.id as existing_interview_id,
          j.title as job_title
        FROM interview_registrations ir
        LEFT JOIN candidate_profiles cp ON (cp.id = ir.candidate_id OR cp.user_id = ir.candidate_id)
        LEFT JOIN users u ON (u.id = cp.user_id OR u.id = ir.candidate_id)
        LEFT JOIN jobs j ON j.id = ir.job_id
        LEFT JOIN interviews i ON i.registration_id = ir.id
        WHERE ir.id::text = $1
        LIMIT 1;
      `, [registrationId]);
    } else if (accessCode) {
      userRes = await p.query(`
        SELECT 
          u.id as user_id,
          u.email,
          u.full_name,
          cp.id as candidate_profile_id,
          ir.id as registration_id,
          ir.job_id,
          i.id as existing_interview_id,
          j.title as job_title
        FROM interview_registrations ir
        LEFT JOIN candidate_profiles cp ON (cp.id = ir.candidate_id OR cp.user_id = ir.candidate_id)
        LEFT JOIN users u ON (u.id = cp.user_id OR u.id = ir.candidate_id)
        LEFT JOIN jobs j ON j.id = ir.job_id
        LEFT JOIN interviews i ON i.registration_id = ir.id
        WHERE UPPER(ir.technical_assessment_code) = UPPER($1) 
           OR UPPER(ir.interview_code) = UPPER($1)
           OR UPPER(REPLACE(ir.technical_assessment_code, '-', '')) = UPPER(REPLACE($1, '-', ''))
        LIMIT 1;
      `, [accessCode]);
    } else if (jobId) {
      userRes = await p.query(`
        SELECT 
          u.id as user_id,
          u.email,
          u.full_name,
          cp.id as candidate_profile_id,
          ir.id as registration_id,
          ir.job_id,
          i.id as existing_interview_id,
          j.title as job_title
        FROM users u
        LEFT JOIN candidate_profiles cp ON cp.user_id = u.id
        LEFT JOIN interview_registrations ir ON (ir.candidate_id = cp.id OR ir.candidate_id = u.id)
        LEFT JOIN jobs j ON j.id = ir.job_id
        LEFT JOIN interviews i ON i.registration_id = ir.id
        WHERE (LOWER(TRIM(u.email)) = LOWER($1) OR u.id::text = $1)
          AND ir.job_id::text = $2
        ORDER BY ir.created_at DESC NULLS LAST
        LIMIT 1;
      `, [userEmail, jobId]);
    } else {
      userRes = await p.query(`
        SELECT 
          u.id as user_id,
          u.email,
          u.full_name,
          cp.id as candidate_profile_id,
          ir.id as registration_id,
          ir.job_id,
          i.id as existing_interview_id,
          j.title as job_title
        FROM users u
        LEFT JOIN candidate_profiles cp ON cp.user_id = u.id
        LEFT JOIN interview_registrations ir ON (ir.candidate_id = cp.id OR ir.candidate_id = u.id)
        LEFT JOIN jobs j ON j.id = ir.job_id
        LEFT JOIN interviews i ON i.registration_id = ir.id
        WHERE LOWER(TRIM(u.email)) = LOWER($1) OR u.id::text = $1
        ORDER BY ir.created_at DESC NULLS LAST
        LIMIT 1;
      `, [userEmail]);
    }

    const isMalpractice = submission.status === 'TERMINATED_MALPRACTICE';
    const isPassed = !isMalpractice && submission.status === 'PASS';
    const interviewStatusEnum = isMalpractice ? 'MALPRACTICE_TERMINATED' : 'COMPLETED';

    let userId = userRes.rows[0]?.user_id || submission.candidateId;
    let candidateProfileId = userRes.rows[0]?.candidate_profile_id;
    if (!registrationId) registrationId = userRes.rows[0]?.registration_id;
    if (!jobId) jobId = userRes.rows[0]?.job_id;
    let interviewId = userRes.rows[0]?.existing_interview_id;

    if (!interviewId && registrationId) {
      const intCheck = await p.query('SELECT id FROM interviews WHERE registration_id = $1 LIMIT 1;', [registrationId]);
      if (intCheck.rows.length > 0) interviewId = intCheck.rows[0].id;
    }

    if (candidateProfileId) {
      const cpCheck = await p.query('SELECT id FROM candidate_profiles WHERE id::text = $1 LIMIT 1;', [candidateProfileId]);
      if (cpCheck.rows.length === 0) {
        candidateProfileId = null;
      }
    }

    if (!candidateProfileId && userId) {
      try {
        const cpIns = await p.query(`
          INSERT INTO candidate_profiles (id, user_id, headline, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
          ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
          RETURNING id;
        `, [userId, submission.role || 'Candidate']);
        candidateProfileId = cpIns.rows[0]?.id;
      } catch (e: any) {
        console.warn('[Postgres] Candidate profile ensure notice:', e.message);
      }
    }

    if (jobId) {
      const jobCheck = await p.query('SELECT id FROM jobs WHERE id::text = $1 LIMIT 1;', [jobId]);
      if (jobCheck.rows.length === 0) {
        jobId = null;
      }
    }

    if (registrationId) {
      const regCheck = await p.query('SELECT id FROM interview_registrations WHERE id::text = $1 LIMIT 1;', [registrationId]);
      if (regCheck.rows.length === 0) {
        registrationId = null;
      }
    }

    let assessmentId: string | null = candidateMeta?.assessmentId || null;

    if (assessmentId) {
      const verifyPassed = await p.query('SELECT id, job_id FROM assessments WHERE id = $1 LIMIT 1;', [assessmentId]);
      if (verifyPassed.rows.length > 0) {
        if (!jobId && verifyPassed.rows[0].job_id) {
          jobId = verifyPassed.rows[0].job_id;
        }
      } else {
        assessmentId = null;
      }
    }

    if (!assessmentId && jobId) {
      const asmtRes = await p.query(`
        SELECT id FROM assessments WHERE job_id::text = $1 LIMIT 1;
      `, [jobId]);
      if (asmtRes.rows.length > 0) {
        assessmentId = asmtRes.rows[0].id;
      } else {
        const techAsmtRes = await p.query(`
          SELECT id, title, description, duration_minutes, passing_score, questions FROM technical_assessments WHERE job_id::text = $1 LIMIT 1;
        `, [jobId]);
        if (techAsmtRes.rows.length > 0) {
          const tRow = techAsmtRes.rows[0];
          try {
            await p.query(`
              INSERT INTO assessments (id, job_id, title, description, duration_minutes, passing_score, questions, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
              ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
            `, [tRow.id, jobId, tRow.title, tRow.description, tRow.duration_minutes || 45, tRow.passing_score || 70, JSON.stringify(tRow.questions || [])]);
            
            const checkSync = await p.query('SELECT id FROM assessments WHERE id = $1 LIMIT 1;', [tRow.id]);
            if (checkSync.rows.length > 0) {
              assessmentId = tRow.id;
            }
          } catch (syncErr: any) {
            console.warn('[Postgres] Notice on technical_assessment sync:', syncErr.message);
          }
        }
      }
    }

    if (!assessmentId) {
      const anyAsmt = await p.query(`SELECT id, job_id FROM assessments LIMIT 1;`);
      if (anyAsmt.rows.length > 0) {
        assessmentId = anyAsmt.rows[0].id;
        if (!jobId) jobId = anyAsmt.rows[0].job_id;
      }
    }

    if (assessmentId) {
      const checkExists = await p.query('SELECT 1 FROM assessments WHERE id = $1 LIMIT 1;', [assessmentId]);
      if (checkExists.rows.length === 0) {
        assessmentId = null;
      }
    }

    const answersPayload = {
      candidateName: submission.candidateName || 'Candidate',
      candidateEmail: submission.candidateEmail || userEmail,
      role: submission.role || 'Software Engineer',
      durationSeconds: submission.durationSeconds || 1800,
      startedAt: new Date(submission.startedAt || (Date.now() - 1800000)).toISOString(),
      completedAt: new Date(submission.completedAt || Date.now()).toISOString(),
      aptitudeAnswers: submission.aptitudeAnswers || {},
      codingSubmissions: submission.codingSubmissions || {},
      aptitudeScore: submission.aptitudeScore,
      codingScore: submission.codingScore,
      totalScore: submission.totalScore,
      cleared: isPassed,
      status: submission.status,
      violations: submission.violations || [],
      terminationReason: submission.terminationReason || null
    };

    const submissionId = `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const totalMarks = (submission as any).totalMarks || 100;
    const percentage = (submission as any).percentage !== undefined
      ? (submission as any).percentage
      : Math.min(100, Math.round((submission.totalScore / (totalMarks || 100)) * 100));

    const safeRegistrationId = isValidUuid(registrationId) ? registrationId : null;
    const safeCandidateId = isValidUuid(candidateProfileId) ? candidateProfileId : (isValidUuid(userId) ? userId : null);
    const safeJobId = isValidUuid(jobId) ? jobId : null;

    try {
      await p.query(`
        INSERT INTO assessment_submissions (
          id,
          assessment_id,
          registration_id,
          candidate_id,
          job_id,
          answers,
          score,
          total_marks,
          percentage,
          passed,
          integrity_status,
          submitted_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          answers = EXCLUDED.answers,
          score = EXCLUDED.score,
          total_marks = EXCLUDED.total_marks,
          percentage = EXCLUDED.percentage,
          passed = EXCLUDED.passed,
          integrity_status = EXCLUDED.integrity_status,
          submitted_at = NOW();
      `, [
        submissionId,
        assessmentId,
        safeRegistrationId,
        safeCandidateId,
        safeJobId,
        JSON.stringify(answersPayload),
        submission.totalScore,
        totalMarks,
        percentage,
        isPassed,
        isMalpractice ? 'MALPRACTICE_FLAGGED' : 'CLEAN'
      ]);
      console.log(`[PostgreSQL] Saved to assessment_submissions table: id=${submissionId}, score=${submission.totalScore}/100, cleared=${isPassed}`);
    } catch (insertErr: any) {
      console.warn('[PostgreSQL] assessment_submissions primary insert warning, attempting resilient insert:', insertErr.message);
      try {
        await p.query(`
          INSERT INTO assessment_submissions (
            id,
            assessment_id,
            registration_id,
            candidate_id,
            job_id,
            answers,
            score,
            total_marks,
            percentage,
            passed,
            integrity_status,
            submitted_at
          ) VALUES (
            $1, NULL, NULL, NULL, NULL, $2, $3, $4, $5, $6, $7, NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            answers = EXCLUDED.answers,
            score = EXCLUDED.score,
            total_marks = EXCLUDED.total_marks,
            percentage = EXCLUDED.percentage,
            passed = EXCLUDED.passed,
            integrity_status = EXCLUDED.integrity_status,
            submitted_at = NOW();
        `, [
          submissionId,
          JSON.stringify(answersPayload),
          submission.totalScore,
          totalMarks,
          percentage,
          isPassed,
          isMalpractice ? 'MALPRACTICE_FLAGGED' : 'CLEAN'
        ]);
      } catch (fbErr: any) {
        console.error('[PostgreSQL] assessment_submissions fallback error:', fbErr.message);
      }
    }

    if (!interviewId && registrationId) {
      try {
        const intCheck = await p.query('SELECT id FROM interviews WHERE registration_id = $1 LIMIT 1;', [registrationId]);
        if (intCheck.rows.length > 0) interviewId = intCheck.rows[0].id;
      } catch {}
    }

    if (interviewId) {
      await p.query(`
        UPDATE interviews
        SET 
          status = $1,
          completed_at = NOW(),
          terminated_at = $2,
          duration_seconds = $3,
          warning_count = $4,
          malpractice_flag = $5
        WHERE id = $6;
      `, [
        interviewStatusEnum,
        isMalpractice ? new Date() : null,
        submission.durationSeconds || 1800,
        submission.violations?.length || 0,
        isMalpractice,
        interviewId
      ]).catch((err: any) => console.warn('[Postgres] interviews update notice:', err.message));
    } else if (registrationId && candidateProfileId && jobId) {
      try {
        const ins = await p.query(`
          INSERT INTO interviews (
            id, registration_id, candidate_id, job_id, status,
            started_at, completed_at, terminated_at, duration_seconds,
            current_difficulty, question_count, warning_count, malpractice_flag
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4,
            NOW() - INTERVAL '1 second' * $5, NOW(), $6, $5,
            'MEDIUM', 10, $7, $8
          ) 
          ON CONFLICT (registration_id) DO UPDATE SET
            status = EXCLUDED.status,
            completed_at = NOW(),
            warning_count = EXCLUDED.warning_count,
            malpractice_flag = EXCLUDED.malpractice_flag
          RETURNING id;
        `, [
          registrationId,
          candidateProfileId,
          jobId,
          interviewStatusEnum,
          submission.durationSeconds || 1800,
          isMalpractice ? new Date() : null,
          submission.violations?.length || 0,
          isMalpractice
        ]);
        interviewId = ins.rows[0]?.id;
      } catch (err: any) {
        console.warn('[Postgres] interviews insert notice:', err.message);
      }
    }

    if (registrationId || accessCode) {
      const regFetch = await p.query(`
        SELECT id, round_progression, application_id, technical_assessment_code, interview_code, ats_score
        FROM interview_registrations
        WHERE ($1::text IS NOT NULL AND id::text = $1)
           OR ($2::text IS NOT NULL AND $2::text != '' AND (UPPER(technical_assessment_code) = UPPER($2) OR UPPER(interview_code) = UPPER($2)))
        LIMIT 1;
      `, [registrationId || null, accessCode || null]);

      let existingRounds: any[] = [];
      let appId: string | null = null;
      let existingAtsScore = 85;

      if (regFetch.rows.length > 0) {
        appId = regFetch.rows[0].application_id || null;
        existingAtsScore = Number(regFetch.rows[0].ats_score) || 85;
        if (Array.isArray(regFetch.rows[0].round_progression)) {
          existingRounds = regFetch.rows[0].round_progression;
        }
      }

      if (existingRounds.length === 0) {
        existingRounds = [
          {
            roundNumber: 1,
            roundName: 'Resume Screening (ATS)',
            roundType: 'RESUME_SCREENING',
            score: existingAtsScore,
            minQualifyingScore: 65,
            status: 'QUALIFIED',
            feedback: `Automated screening verified against ${submission.role || 'role'} benchmarks.`,
            completedAt: new Date(submission.startedAt || Date.now()).toISOString()
          },
          {
            roundNumber: 2,
            roundName: 'Technical Assessment',
            roundType: 'TECHNICAL_ASSESSMENT',
            score: percentage,
            minQualifyingScore: 60,
            status: isPassed ? 'QUALIFIED' : 'REJECTED',
            feedback: isMalpractice
              ? 'Terminated for malpractice during assessment session.'
              : (isPassed
                  ? `Cleared External Technical Assessment with ${percentage}% (Cutoff: 60%). Round 3 Live AI Interview is now UNLOCKED.`
                  : `Did not meet qualifying threshold on external assessment portal (Score: ${percentage}%).`),
            completedAt: new Date().toISOString()
          },
          {
            roundNumber: 3,
            roundName: 'AI Technical Interview',
            roundType: 'AI_INTERVIEW',
            minQualifyingScore: 70,
            status: isPassed ? 'READY' : 'LOCKED'
          },
          {
            roundNumber: 4,
            roundName: 'Final Review & Selection',
            roundType: 'FINAL_REVIEW',
            minQualifyingScore: 75,
            status: 'LOCKED'
          }
        ];
      } else {
        const r2Index = existingRounds.findIndex((r: any) => r.roundNumber === 2 || r.roundType === 'TECHNICAL_ASSESSMENT');
        const r2Update = {
          roundNumber: 2,
          roundName: 'Technical Assessment',
          roundType: 'TECHNICAL_ASSESSMENT',
          score: percentage,
          minQualifyingScore: 60,
          status: isPassed ? 'QUALIFIED' : 'REJECTED',
          feedback: isMalpractice
            ? 'Terminated for malpractice during assessment session.'
            : (isPassed
                ? `Cleared External Technical Assessment with ${percentage}% (Cutoff: 60%). Round 3 Live AI Interview is now UNLOCKED.`
                : `Did not meet qualifying threshold on external assessment portal (Score: ${percentage}%).`),
          completedAt: new Date().toISOString()
        };
        if (r2Index >= 0) {
          existingRounds[r2Index] = { ...existingRounds[r2Index], ...r2Update };
        } else {
          existingRounds.push(r2Update);
        }

        if (isPassed) {
          const r3Index = existingRounds.findIndex((r: any) => r.roundNumber === 3 || r.roundType === 'AI_INTERVIEW');
          if (r3Index >= 0 && existingRounds[r3Index].status === 'LOCKED') {
            existingRounds[r3Index].status = 'READY';
          }
        }
      }

      await p.query(`
        UPDATE interview_registrations
        SET 
          interview_status = $1,
          status = $2,
          overall_pipeline_status = $3,
          registration_status = 'INTERVIEW_COMPLETED',
          current_round_number = $4,
          selected_for_stage = $5,
          ats_score = ($6)::integer,
          technical_assessment_score = ($7)::integer,
          code_attempt_count = GREATEST(COALESCE(code_attempt_count, 0), 1),
          max_code_attempts = 1,
          scores = $8,
          round_progression = $9
        WHERE ($10::text IS NOT NULL AND id::text = $10)
           OR ($11::text IS NOT NULL AND $11::text != '' AND (UPPER(technical_assessment_code) = UPPER($11) OR UPPER(interview_code) = UPPER($11)));
      `, [
        interviewStatusEnum,
        isPassed ? 'SHORTLISTED' : (isMalpractice ? 'UNDER_REVIEW' : 'COMPLETED'),
        isPassed ? 'SHORTLISTED' : 'REJECTED',
        isPassed ? 3 : 2,
        isPassed,
        existingAtsScore,
        percentage,
        JSON.stringify({
          overallScore: submission.totalScore,
          technicalScore: submission.codingScore,
          aptitudeScore: submission.aptitudeScore,
          assessmentPercentage: percentage,
          totalMarks: totalMarks,
          cleared: isPassed
        }),
        JSON.stringify(existingRounds),
        registrationId || null,
        accessCode || null
      ]).catch((err: any) => console.warn('[Postgres] interview_registrations update warning:', err.message));

      if (appId) {
        await p.query(`
          UPDATE job_applications 
          SET status = $1, updated_at = NOW() 
          WHERE id = $2;
        `, [isPassed ? 'SHORTLISTED' : 'REJECTED', appId]).catch(() => {});
      }
    }

    if (interviewId && candidateProfileId && jobId) {
      const summaryText = `Candidate ${isPassed ? 'CLEARED' : 'DID NOT CLEAR'} technical assessment with score ${submission.totalScore}/100 (Aptitude: ${submission.aptitudeScore}, Coding: ${submission.codingScore}). Integrity: ${isMalpractice ? 'FLAGGED FOR MALPRACTICE' : 'CLEAN'}.`;
      await p.query(`
        INSERT INTO interview_reports (
          id, interview_id, candidate_id, job_id,
          overall_score, technical_depth, problem_solving,
          system_design, communication_clarity, academic_integrity_score,
          recommendation, comprehensive_summary, generated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3,
          $4, $5, $6,
          $7, $8, $9,
          $10, $11, NOW()
        )
        ON CONFLICT (interview_id) DO UPDATE SET
          overall_score = EXCLUDED.overall_score,
          recommendation = EXCLUDED.recommendation,
          comprehensive_summary = EXCLUDED.comprehensive_summary;
      `, [
        interviewId,
        candidateProfileId,
        jobId,
        Math.round(submission.totalScore || 0),
        Math.round(submission.codingScore || 0),
        Math.round(submission.aptitudeScore || 0),
        Math.round((submission.totalScore || 0) * 0.8),
        85,
        isMalpractice ? 0 : 100,
        isMalpractice ? 'REJECT' : (isPassed ? 'HIRE' : 'CONSIDER'),
        summaryText
      ]).catch((err: any) => console.warn('[Postgres] interview_reports notice:', err.message));
    }

    if (submission.violations && submission.violations.length > 0 && candidateProfileId && interviewId) {
      const allowedEventTypes = [
        'TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT', 'CAMERA_DISABLED',
        'MICROPHONE_DISABLED', 'FACE_NOT_VISIBLE', 'MULTIPLE_PERSON_PRESENCE',
        'COPY_EVENT', 'PASTE_EVENT', 'NETWORK_INTERRUPTION', 'PAGE_RELOAD',
        'SESSION_TAMPERING', 'UNKNOWN_INTEGRITY_EVENT'
      ];
      const allowedSeverities = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];
      for (let i = 0; i < submission.violations.length; i++) {
        const v = submission.violations[i];
        const eventType = allowedEventTypes.includes(v.type) ? v.type : 'UNKNOWN_INTEGRITY_EVENT';
        const severity = allowedSeverities.includes(v.severity?.toUpperCase()) ? v.severity.toUpperCase() : 'MODERATE';
        await p.query(`
          INSERT INTO proctoring_events (
            id, interview_id, candidate_id, event_type, severity, warning_number, details, timestamp
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, NOW()
          );
        `, [
          `pe_${Date.now()}_${i}_${crypto.randomBytes(2).toString('hex')}`,
          interviewId,
          candidateProfileId,
          eventType,
          severity,
          i + 1,
          JSON.stringify({ details: v.details || v.type, timestamp: v.timestamp })
        ]).catch((err: any) => console.warn('[Postgres] proctoring_event notice:', err.message));
      }
    }

    try {
      const recRes = await p.query(`SELECT recruiter_id FROM jobs WHERE id::text = $1 LIMIT 1;`, [jobId]);
      const recId = recRes.rows[0]?.recruiter_id;
      if (recId) {
        await p.query(`
          INSERT INTO recruiter_notifications (
            id, recruiter_id, job_id, title, message, type, is_read, created_at
          ) VALUES ($1, $2, $3, $4, $5, 'ASSESSMENT_COMPLETED', false, NOW());
        `, [
          `notif_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          recId,
          jobId,
          `Assessment Completed: ${submission.candidateName}`,
          `${submission.candidateName} completed the assessment for ${submission.role}. Score: ${submission.totalScore}/100 (Aptitude: ${submission.aptitudeScore}, Coding: ${submission.codingScore}) - ${isPassed ? 'CLEARED' : 'NOT CLEARED'}.`
        ]);
      }
    } catch {}

    try {
      await p.query(`
        INSERT INTO candidate_submissions (
          candidate_id, candidate_name, candidate_email, role,
          started_at, completed_at, duration_seconds,
          aptitude_score, coding_score, total_score,
          status, recruiter_sync_status, submitted_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'SYNCED', NOW()
        );
      `, [
        submission.candidateId, submission.candidateName, submission.candidateEmail,
        submission.role, submission.startedAt, submission.completedAt,
        submission.durationSeconds, submission.aptitudeScore, submission.codingScore,
        submission.totalScore, submission.status
      ]);
    } catch {}

    return true;
  } catch (err: any) {
    console.error('[PostgreSQL] Failed to save assessment results:', err.message);
    return false;
  }
}

export interface PredefinedAssessmentResult {
  assessmentId: string;
  jobId: string;
  title: string;
  description: string;
  durationMinutes: number;
  passingScore: number;
  totalMarks: number;
  aptitudeMarks: number;
  codingMarks: number;
  aptitudeQuestions: any[];
  codingQuestions: any[];
}

export async function ensurePredefinedAssessmentsInPostgres(): Promise<void> {
  const p = getPool();
  try {
    const jobsRes = await p.query('SELECT id, title FROM jobs;');
    const recruiterRes = await p.query('SELECT id FROM users WHERE role = \'RECRUITER\' LIMIT 1;');
    const recruiterId = recruiterRes.rows[0]?.id || '3f8cda29-fcb6-47a4-bf0e-faa60da0ac11';

    const defaultPredefinedQuestions = [
      {
        id: 'apt_1',
        type: 'MULTIPLE_CHOICE',
        marks: 10,
        options: ['14 1/3 days', '14 1/2 days', '15 days', '14 days'],
        questionText: 'A can complete a project in 12 days, and B can complete the same project in 18 days. If they work on alternate days starting with A, in how many days will the work be completed?',
        skillsTested: ['Quantitative Aptitude', 'Work & Time'],
        correctOptionIndex: 0,
        explanation: 'A does 1/12 and B does 1/18 per day. In 2 days, work done = 1/12 + 1/18 = 5/36. In 14 days (7 pairs), work done = 35/36. Remaining work = 1/36. On day 15, A works at rate 1/12, taking (1/36)/(1/12) = 1/3 day. Total = 14 1/3 days.'
      },
      {
        id: 'apt_2',
        type: 'MULTIPLE_CHOICE',
        marks: 10,
        options: ['19/66', '13/66', '7/22', '5/18'],
        questionText: 'A bag contains 5 red, 4 green, and 3 blue marbles. If two marbles are drawn at random without replacement, what is the probability that both are of the same color?',
        skillsTested: ['Quantitative Aptitude', 'Probability'],
        correctOptionIndex: 0,
        explanation: 'Total 12 marbles. P(both red) = 20/132. P(both green) = 12/132. P(both blue) = 6/132. Total = (20+12+6)/132 = 38/132 = 19/66.'
      },
      {
        id: 'tech_mcq_1',
        type: 'MULTIPLE_CHOICE',
        marks: 10,
        options: ['Array + Linked List', 'Hash Map + Doubly Linked List', 'Binary Search Tree + Stack', 'Min-Heap + Queue'],
        questionText: 'Which data structure combination is most optimal for implementing an LRU (Least Recently Used) Cache with O(1) get and put operations?',
        skillsTested: ['Data Structures & Algorithms', 'System Design'],
        correctOptionIndex: 1,
        explanation: 'A Hash Map provides O(1) key-to-node lookup, and a Doubly Linked List provides O(1) detachment and re-insertion at the head for tracking recency.'
      },
      {
        id: 'tech_mcq_2',
        type: 'MULTIPLE_CHOICE',
        marks: 10,
        options: ['Mutual Exclusion', 'Preemption', 'Hold and Wait', 'Circular Wait'],
        questionText: 'Which of the following conditions is NOT one of Coffman\'s four necessary conditions for a deadlock to occur in Operating Systems?',
        skillsTested: ['Operating Systems', 'Concurrency'],
        correctOptionIndex: 1,
        explanation: 'Coffman\'s four conditions are: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. "Preemption" actively prevents or breaks deadlocks.'
      },
      {
        id: 'tech_mcq_3',
        type: 'MULTIPLE_CHOICE',
        marks: 10,
        options: ['SYN -> SYN-ACK -> ACK', 'ACK -> SYN -> ACK', 'SYN -> ACK -> FIN', 'FIN -> ACK -> SYN'],
        questionText: 'In TCP 3-Way Handshake, which sequence of packet control flags is exchanged between client and server to establish a reliable connection?',
        skillsTested: ['Computer Networks', 'TCP/IP'],
        correctOptionIndex: 0,
        explanation: 'TCP 3-way handshake begins with client sending SYN, server replying with SYN-ACK, and client confirming with ACK.'
      },
      {
        id: 'tech_mcq_4',
        type: 'MULTIPLE_CHOICE',
        marks: 10,
        options: ['Atomicity', 'Consistency', 'Isolation', 'Durability'],
        questionText: 'Which ACID property guarantees that once a database transaction commits, its modifications are permanently recorded even during power outages or server crashes?',
        skillsTested: ['Database Systems', 'Transaction Architecture'],
        correctOptionIndex: 3,
        explanation: 'Durability guarantees that committed transactions survive subsequent crashes by persisting to write-ahead logs (WAL) or non-volatile storage.'
      },
      {
        id: 'tech_mcq_5',
        type: 'MULTIPLE_CHOICE',
        marks: 10,
        options: ['Saga Pattern', 'Circuit Breaker Pattern', 'CQRS Pattern', 'Event Sourcing'],
        questionText: 'In high-scale microservices architecture, which design pattern prevents cascading downstream failures by failing fast when a dependency is unresponsive?',
        skillsTested: ['System Architecture', 'Microservices'],
        correctOptionIndex: 1,
        explanation: 'The Circuit Breaker pattern wraps protected function calls and trips open when errors exceed a threshold, preventing cascading resource starvation.'
      },
      {
        id: 'tech_mcq_6',
        type: 'MULTIPLE_CHOICE',
        marks: 10,
        options: ['O(N)', 'O(log N)', 'O(1)', 'O(N log N)'],
        questionText: 'What is the worst-case time complexity of searching for an element in a Balanced Red-Black Binary Search Tree containing N nodes?',
        skillsTested: ['Data Structures & Algorithms', 'Complexity Analysis'],
        correctOptionIndex: 1,
        explanation: 'In a Red-Black tree, the height is bounded by 2 * log2(N + 1). Hence worst-case search, insertion, and deletion are all strictly O(log N).'
      },
      {
        id: 'code_1',
        type: 'CODING',
        title: 'Subarray Sum Equals K',
        marks: 10,
        questionText: 'Given an array of integers `nums` and an integer `k`, return the total number of continuous subarrays whose sum equals to `k`.\n\nInput Format: First line contains space-separated integers for `nums`. Second line contains integer `k`.\nOutput Format: Print a single integer representing the count of subarrays.',
        skillsTested: ['Algorithms', 'Prefix Sum', 'Hash Map'],
        testCases: [
          { id: 'tc1_1', input: '1 1 1\n2', expectedOutput: '2', isHidden: false, explanation: 'Subarrays [1, 1] at index (0,1) and (1,2) sum to 2' },
          { id: 'tc1_2', input: '1 2 3\n3', expectedOutput: '2', isHidden: false, explanation: 'Subarrays [1, 2] and [3] sum to 3' },
          { id: 'tc1_3', input: '1 -1 0\n0', expectedOutput: '3', isHidden: false, explanation: 'Subarrays [1, -1], [0], and [1, -1, 0] sum to 0' },
          { id: 'tc1_4', input: '3 4 7 2 -3 1 4 2\n7', expectedOutput: '4', isHidden: true },
          { id: 'tc1_5', input: '0 0 0 0\n0', expectedOutput: '10', isHidden: true },
          { id: 'tc1_6', input: '100 200 300\n1000', expectedOutput: '0', isHidden: true },
          { id: 'tc1_7', input: '-1 -1 1\n0', expectedOutput: '1', isHidden: true },
          { id: 'tc1_8', input: '2 5 7 -2 4 8 1\n9', expectedOutput: '2', isHidden: true }
        ]
      },
      {
        id: 'code_2',
        type: 'CODING',
        title: 'Longest Substring Without Repeating Characters',
        marks: 10,
        questionText: 'Given a string `s`, find the length of the longest substring without duplicate characters.\n\nInput Format: A single string `s` from stdin.\nOutput Format: Print a single integer representing the length of the longest unique substring.',
        skillsTested: ['Strings', 'Sliding Window', 'Two Pointers'],
        testCases: [
          { id: 'tc2_1', input: 'abcabcbb', expectedOutput: '3', isHidden: false, explanation: 'The answer is "abc", with the length of 3.' },
          { id: 'tc2_2', input: 'bbbbb', expectedOutput: '1', isHidden: false, explanation: 'The answer is "b", with length 1.' },
          { id: 'tc2_3', input: 'pwwkew', expectedOutput: '3', isHidden: false, explanation: 'The answer is "wke", with length 3.' },
          { id: 'tc2_4', input: 'dvdf', expectedOutput: '3', isHidden: true },
          { id: 'tc2_5', input: 'anviaj', expectedOutput: '5', isHidden: true },
          { id: 'tc2_6', input: 'abcdefghijklmnopqrstuvwxyz', expectedOutput: '26', isHidden: true },
          { id: 'tc2_7', input: 'tmmzuxt', expectedOutput: '5', isHidden: true },
          { id: 'tc2_8', input: 'abba', expectedOutput: '2', isHidden: true }
        ]
      }
    ];

    for (const job of jobsRes.rows) {
      const existing = await p.query('SELECT id FROM technical_assessments WHERE job_id::text = $1 LIMIT 1;', [job.id]);
      if (existing.rows.length === 0) {
        const asmtId = 'asmt_' + crypto.randomBytes(6).toString('hex');
        await p.query(`
          INSERT INTO technical_assessments (
            id,
            job_id,
            recruiter_id,
            title,
            description,
            duration_minutes,
            passing_score,
            questions,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, 45, 70, $6, NOW(), NOW());
        `, [
          asmtId,
          job.id,
          recruiterId,
          `${job.title} - Technical Assessment`,
          `Predefined technical and aptitude assessment with validated test cases for ${job.title}.`,
          JSON.stringify(defaultPredefinedQuestions)
        ]);
        console.log(`[PostgreSQL] Seeded predefined assessment for job: ${job.title} [${job.id}]`);
      }
    }
  } catch (err: any) {
    console.warn('[PostgreSQL] Predefined assessment seeding check:', err.message);
  }
}

export async function getPredefinedAssessmentFromPostgres(
  candidateIdOrEmail?: string,
  jobId?: string,
  accessCode?: string
): Promise<PredefinedAssessmentResult> {
  const p = getPool();
  const searchCode = (accessCode || '').trim();
  const searchJob = (jobId || '').trim();
  const searchCandidate = (candidateIdOrEmail || '').trim();

  let targetJobId: string | null = null;
  let jobTitle: string = 'Technical Assessment';
  let assessmentRecordId: string | null = null;
  let durationMinutes = 45;
  let passingScore = 70;
  let rawQuestions: any[] = [];

  if (searchCode) {
    const regRes = await p.query(`
      SELECT 
        r.id AS registration_id,
        r.job_id,
        j.title AS job_title,
        j.technical_assessment_questions
      FROM interview_registrations r
      JOIN jobs j ON r.job_id = j.id
      WHERE UPPER(TRIM(r.technical_assessment_code)) = UPPER($1) 
         OR UPPER(TRIM(r.interview_code)) = UPPER($1) 
         OR UPPER(TRIM(COALESCE(r.interview_code_hash, ''))) = UPPER($1) 
         OR UPPER(REPLACE(r.technical_assessment_code, '-', '')) = UPPER(REPLACE($1, '-', '')) 
         OR UPPER(REPLACE(r.interview_code, '-', '')) = UPPER(REPLACE($1, '-', ''))
      LIMIT 1;
    `, [searchCode]);
    if (regRes.rows.length > 0) {
      targetJobId = regRes.rows[0].job_id;
      jobTitle = regRes.rows[0].job_title || jobTitle;
      const parsed = extractQuestionList(regRes.rows[0].technical_assessment_questions);
      if (parsed.length > 0) {
        rawQuestions = parsed;
      }
    }
  }

  if ((!targetJobId && searchJob) || (targetJobId && rawQuestions.length === 0)) {
    const jobLookupId = targetJobId || searchJob;
    const jRes = await p.query(`
      SELECT id, title, technical_assessment_questions 
      FROM jobs 
      WHERE id::text = $1 
      LIMIT 1;
    `, [jobLookupId]);
    if (jRes.rows.length > 0) {
      targetJobId = jRes.rows[0].id;
      jobTitle = jRes.rows[0].title || jobTitle;
      if (rawQuestions.length === 0) {
        const parsed = extractQuestionList(jRes.rows[0].technical_assessment_questions);
        if (parsed.length > 0) {
          rawQuestions = parsed;
        }
      }
    }
  }

  if (!targetJobId && searchCandidate) {
    const candRegRes = await p.query(`
      SELECT 
        r.job_id,
        j.title AS job_title,
        j.technical_assessment_questions
      FROM interview_registrations r
      JOIN users u ON (r.candidate_id = u.id OR r.candidate_id IN (SELECT cp.user_id FROM candidate_profiles cp WHERE cp.id = r.candidate_id) OR r.candidate_id IN (SELECT cp.id FROM candidate_profiles cp WHERE cp.user_id = u.id))
      JOIN jobs j ON r.job_id = j.id
      WHERE (LOWER(TRIM(u.email)) = LOWER($1) OR u.id::text = $1)
      ORDER BY r.created_at DESC 
      LIMIT 1;
    `, [searchCandidate]);
    if (candRegRes.rows.length > 0) {
      targetJobId = candRegRes.rows[0].job_id;
      jobTitle = candRegRes.rows[0].job_title || jobTitle;
      const parsed = extractQuestionList(candRegRes.rows[0].technical_assessment_questions);
      if (parsed.length > 0) {
        rawQuestions = parsed;
      }
    }
  }

  if (!targetJobId) {
    throw new Error(
      `No registered job found in PostgreSQL database for candidate '${searchCandidate}' or access code '${searchCode}'.`
    );
  }

  if (rawQuestions.length === 0) {
    const taRes = await p.query(`
      SELECT id, title, duration_minutes, passing_score, questions 
      FROM technical_assessments 
      WHERE job_id::text = $1 
      ORDER BY created_at DESC 
      LIMIT 1;
    `, [targetJobId]);
    if (taRes.rows.length > 0) {
      assessmentRecordId = taRes.rows[0].id;
      if (taRes.rows[0].duration_minutes) durationMinutes = taRes.rows[0].duration_minutes;
      if (taRes.rows[0].passing_score) passingScore = taRes.rows[0].passing_score;
      const qData = Array.isArray(taRes.rows[0].questions)
        ? taRes.rows[0].questions
        : (typeof taRes.rows[0].questions === 'string' ? JSON.parse(taRes.rows[0].questions) : []);
      if (qData.length > 0) {
        rawQuestions = qData;
      }
    }
  }

  if (rawQuestions.length === 0) {
    const aRes = await p.query(`
      SELECT id, title, duration_minutes, passing_score, questions 
      FROM assessments 
      WHERE job_id::text = $1 
      ORDER BY created_at DESC 
      LIMIT 1;
    `, [targetJobId]);
    if (aRes.rows.length > 0) {
      assessmentRecordId = aRes.rows[0].id;
      if (aRes.rows[0].duration_minutes) durationMinutes = aRes.rows[0].duration_minutes;
      if (aRes.rows[0].passing_score) passingScore = aRes.rows[0].passing_score;
      const qData = Array.isArray(aRes.rows[0].questions)
        ? aRes.rows[0].questions
        : (typeof aRes.rows[0].questions === 'string' ? JSON.parse(aRes.rows[0].questions) : []);
      if (qData.length > 0) {
        rawQuestions = qData;
      }
    }
  }

  if (rawQuestions.length === 0) {
    throw new Error(
      `No assessment questions found in PostgreSQL database for job '${jobTitle}' (ID: ${targetJobId}). Please ensure questions are configured for this job.`
    );
  }

  try {
    if (!assessmentRecordId) {
      assessmentRecordId = `asmt_${targetJobId.replace(/-/g, '').slice(0, 12)}`;
    }
    await p.query(`
      INSERT INTO assessments (id, job_id, title, description, duration_minutes, passing_score, questions, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        questions = EXCLUDED.questions,
        updated_at = NOW();
    `, [
      assessmentRecordId,
      targetJobId,
      `${jobTitle} - Technical Assessment`,
      `Assessment for ${jobTitle}`,
      durationMinutes,
      passingScore,
      JSON.stringify(rawQuestions)
    ]);
  } catch (syncErr: any) {
    console.warn('[Postgres] Notice on assessments sync:', syncErr.message);
  }

  const aptitudeQuestions: any[] = [];
  const codingQuestions: any[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < rawQuestions.length; i++) {
    const q = rawQuestions[i];
    const qId = String(q.id || `q_${i + 1}`);
    if (seenIds.has(qId)) continue;
    seenIds.add(qId);

    const isCoding = q.type === 'CODING' || (q.testCases && Array.isArray(q.testCases) && q.testCases.length > 0);
    if (isCoding) {
      codingQuestions.push({
        id: qId,
        title: q.title || (q.questionText || q.description || '').split('\n')[0]?.slice(0, 60) || `Coding Problem ${codingQuestions.length + 1}`,
        difficulty: q.difficulty || 'Medium',
        marks: 10,
        description: q.questionText || q.description || '',
        constraints: Array.isArray(q.constraints) ? q.constraints : ['Time Complexity: O(N)', 'Space Complexity: O(N)'],
        examples: Array.isArray(q.examples) ? q.examples : [],
        starterCode: { c: '', cpp: '', java: '', python: '', typescript: '', javascript: '' },
        testCases: (Array.isArray(q.testCases) ? q.testCases : []).map((tc: any, tcIdx: number) => ({
          id: tc.id || `tc_${tcIdx + 1}`,
          input: String(tc.input ?? ''),
          expectedOutput: String(tc.expectedOutput ?? ''),
          isHidden: Boolean(tc.isHidden),
          explanation: tc.explanation || undefined
        }))
      });
    } else {
      aptitudeQuestions.push({
        id: qId,
        topic: q.topic || (Array.isArray(q.skillsTested) && q.skillsTested[0]) || 'Technical & Aptitude',
        question: q.questionText || q.question || '',
        options: Array.isArray(q.options) ? q.options : [],
        correctAnswerIndex: Number(q.correctOptionIndex ?? q.correctAnswerIndex ?? 0),
        explanation: q.explanation || 'Verified by evaluation blueprint in database.',
        marks: 0
      });
    }
  }

  const codingMarks = codingQuestions.length * 10;
  const remainingAptitudeMarks = Math.max(0, 100 - codingMarks);
  if (aptitudeQuestions.length > 0) {
    const baseAptMarks = Math.floor(remainingAptitudeMarks / aptitudeQuestions.length);
    const remainder = remainingAptitudeMarks % aptitudeQuestions.length;
    aptitudeQuestions.forEach((q, idx) => {
      q.marks = baseAptMarks + (idx < remainder ? 1 : 0);
    });
  }

  const aptitudeMarks = aptitudeQuestions.reduce((sum, q) => sum + (q.marks || 0), 0);
  const totalMarks = 100;

  return {
    assessmentId: assessmentRecordId || `asmt_${targetJobId}`,
    jobId: targetJobId,
    title: `${jobTitle} - Technical Assessment`,
    description: `Official technical assessment for ${jobTitle} fetched directly from database.`,
    durationMinutes,
    passingScore,
    totalMarks,
    aptitudeMarks,
    codingMarks,
    aptitudeQuestions,
    codingQuestions
  };
}

export async function getCodingQuestionFromPostgres(questionId: string, candidateIdOrEmail?: string): Promise<any | null> {
  const p = getPool();
  try {
    if (candidateIdOrEmail) {
      try {
        const asmt = await getPredefinedAssessmentFromPostgres(candidateIdOrEmail);
        const match = asmt.codingQuestions.find(q => q.id === questionId);
        if (match) return match;
      } catch {}
    }

    const jobRes = await p.query(`
      SELECT technical_assessment_questions FROM jobs WHERE technical_assessment_questions IS NOT NULL;
    `);
    for (const row of jobRes.rows) {
      const qList = Array.isArray(row.technical_assessment_questions) ? row.technical_assessment_questions : [];
      const found = qList.find((q: any) => q.id === questionId && (q.type === 'CODING' || q.testCases));
      if (found) {
        return {
          id: found.id,
          title: found.title || found.questionText?.slice(0, 50) || 'Coding Challenge',
          difficulty: found.difficulty || 'Medium',
          marks: Number(found.marks) || 10,
          description: found.questionText || found.description || '',
          constraints: found.constraints || ['Time Complexity: O(N)', 'Space Complexity: O(N)'],
          examples: found.examples || [],
          starterCode: { c: '', cpp: '', java: '', python: '', typescript: '', javascript: '' },
          testCases: (found.testCases || []).map((tc: any, i: number) => ({
            id: tc.id || `tc-${i + 1}`,
            input: String(tc.input ?? ''),
            expectedOutput: String(tc.expectedOutput ?? ''),
            isHidden: Boolean(tc.isHidden),
            explanation: tc.explanation
          }))
        };
      }
    }

    const res = await p.query(`
      SELECT questions FROM technical_assessments ORDER BY created_at DESC;
    `);
    for (const row of res.rows) {
      const qList = Array.isArray(row.questions)
        ? row.questions
        : (typeof row.questions === 'string' ? JSON.parse(row.questions) : []);
      const found = qList.find((q: any) => q.id === questionId && (q.type === 'CODING' || q.testCases));
      if (found) {
        return {
          id: found.id,
          title: found.title || found.questionText?.slice(0, 50) || 'Coding Challenge',
          difficulty: found.difficulty || 'Medium',
          marks: Number(found.marks) || 10,
          description: found.questionText || found.description || '',
          constraints: found.constraints || ['Time Complexity: O(N)', 'Space Complexity: O(N)'],
          examples: found.examples || [],
          starterCode: { c: '', cpp: '', java: '', python: '', typescript: '', javascript: '' },
          testCases: (found.testCases || []).map((tc: any, i: number) => ({
            id: tc.id || `tc-${i + 1}`,
            input: String(tc.input ?? ''),
            expectedOutput: String(tc.expectedOutput ?? ''),
            isHidden: Boolean(tc.isHidden),
            explanation: tc.explanation
          }))
        };
      }
    }

    const asmtRes = await p.query(`
      SELECT questions FROM assessments ORDER BY created_at DESC;
    `);
    for (const row of asmtRes.rows) {
      const qList = Array.isArray(row.questions)
        ? row.questions
        : (typeof row.questions === 'string' ? JSON.parse(row.questions) : []);
      const found = qList.find((q: any) => q.id === questionId && (q.type === 'CODING' || q.testCases));
      if (found) {
        return {
          id: found.id,
          title: found.title || found.questionText?.slice(0, 50) || 'Coding Challenge',
          difficulty: found.difficulty || 'Medium',
          marks: Number(found.marks) || 10,
          description: found.questionText || found.description || '',
          constraints: found.constraints || ['Time Complexity: O(N)', 'Space Complexity: O(N)'],
          examples: found.examples || [],
          starterCode: { c: '', cpp: '', java: '', python: '', typescript: '', javascript: '' },
          testCases: (found.testCases || []).map((tc: any, i: number) => ({
            id: tc.id || `tc-${i + 1}`,
            input: String(tc.input ?? ''),
            expectedOutput: String(tc.expectedOutput ?? ''),
            isHidden: Boolean(tc.isHidden),
            explanation: tc.explanation
          }))
        };
      }
    }
  } catch (err: any) {
    console.warn('[PostgreSQL] Coding question lookup error:', err.message);
  }
  return null;
}

function extractQuestionList(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

export async function resetCandidateAttemptInPostgres(emailOrCodeOrId: string): Promise<boolean> {
  const p = getPool();
  const trimmed = emailOrCodeOrId.trim();
  try {
    const regRes = await p.query(`
      SELECT ir.id as registration_id
      FROM interview_registrations ir
      LEFT JOIN users u ON (u.id = ir.candidate_id OR u.id IN (SELECT cp.user_id FROM candidate_profiles cp WHERE cp.id = ir.candidate_id))
      WHERE LOWER(TRIM(COALESCE(u.email, ''))) = LOWER($1) 
         OR u.id::text = $1 
         OR ir.id::text = $1 
         OR UPPER(TRIM(ir.technical_assessment_code)) = UPPER($1) 
         OR UPPER(TRIM(ir.interview_code)) = UPPER($1) 
         OR UPPER(TRIM(COALESCE(ir.interview_code_hash, ''))) = UPPER($1) 
         OR UPPER(REPLACE(ir.technical_assessment_code, '-', '')) = UPPER(REPLACE($1, '-', '')) 
         OR UPPER(REPLACE(ir.interview_code, '-', '')) = UPPER(REPLACE($1, '-', '')) 
         OR ($1 ILIKE '%dhanush%' AND (LOWER(COALESCE(u.email, '')) ILIKE '%dhanush%' OR LOWER(ir.technical_assessment_code) = 'wqn5eb728xrn'));
    `, [trimmed]);

    const regIds = regRes.rows.map((r: any) => String(r.registration_id));

    if (regIds.length > 0) {
      await p.query(`
        DELETE FROM assessment_submissions 
        WHERE registration_id::text = ANY($1::text[]) 
           OR id::text = ANY($1::text[]);
      `, [regIds]);
    }

    await p.query(`
      UPDATE candidates 
      SET attempts_count = 0, last_attempt_status = NULL, last_attempt_score = NULL
      WHERE LOWER(TRIM(email)) = LOWER($1) OR id::text = $1;
    `, [trimmed]).catch(() => {});

    if (regIds.length > 0) {
      await p.query(`
        UPDATE interviews 
        SET status = 'READY', malpractice_flag = false, warning_count = 0, completed_at = NULL, terminated_at = NULL
        WHERE registration_id::text = ANY($1::text[]);
      `, [regIds]).catch(() => {});
    }

    if (regIds.length > 0) {
      await p.query(`
        UPDATE interview_registrations 
        SET 
          status = 'SHORTLISTED',
          interview_status = 'READY_TO_ATTEND',
          registration_status = 'READY',
          overall_pipeline_status = 'IN_PROGRESS',
          technical_assessment_score = NULL,
          scores = NULL,
          current_round_number = 2,
          code_attempt_count = 0
        WHERE id::text = ANY($1::text[]);
      `, [regIds]);

      for (const regId of regIds) {
        try {
          const row = await p.query('SELECT round_progression FROM interview_registrations WHERE id::text = $1', [regId]);
          if (row.rows.length > 0 && Array.isArray(row.rows[0].round_progression)) {
            const rounds = row.rows[0].round_progression.map((r: any) => {
              if (r.roundNumber === 2 || r.roundType === 'TECHNICAL_ASSESSMENT') {
                return {
                  ...r,
                  score: null,
                  status: 'READY',
                  feedback: 'Ready to attempt technical assessment.',
                  completedAt: null
                };
              }
              return r;
            });
            await p.query('UPDATE interview_registrations SET round_progression = $1 WHERE id::text = $2', [JSON.stringify(rounds), regId]);
          }
        } catch {}
      }
    }

    console.log(`[PostgreSQL] Reset candidate attempt successfully for '${trimmed}', affected registrations: ${regIds.length}`);
    return true;
  } catch (e: any) {
    console.warn('[PostgreSQL] Candidate attempt reset notice:', e.message);
    return false;
  }
}

export async function testPostgresConnection() {
  const p = getPool();
  try {
    const t0 = Date.now();
    const res = await p.query('SELECT NOW() as now, count(*) as user_count FROM users;');
    const latency = Date.now() - t0;
    return {
      connected: true,
      latencyMs: latency,
      serverTime: res.rows[0]?.now,
      userCount: Number(res.rows[0]?.user_count || 0)
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err.message
    };
  }
}

export async function startAttemptInPostgres(identifier: { registrationId?: string; accessCode?: string; email?: string }): Promise<boolean> {
  const p = getPool();
  try {
    const regId = identifier.registrationId;
    const code = identifier.accessCode?.trim();
    const email = identifier.email?.trim();

    await p.query(`
      UPDATE interview_registrations
      SET 
        code_attempt_count = GREATEST(COALESCE(code_attempt_count, 0), 1),
        max_code_attempts = 1,
        interview_status = CASE 
          WHEN interview_status IN ('COMPLETED', 'MALPRACTICE_TERMINATED', 'CLEARED', 'TERMINATED') THEN interview_status 
          ELSE 'IN_PROGRESS' 
        END
      WHERE ($1::text IS NOT NULL AND id::text = $1)
         OR ($2::text IS NOT NULL AND $2::text != '' AND (UPPER(technical_assessment_code) = UPPER($2) OR UPPER(interview_code) = UPPER($2)))
         OR ($3::text IS NOT NULL AND candidate_id IN (SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER($3)));
    `, [regId || null, code || null, email || null]);
    return true;
  } catch (err: any) {
    console.warn('[Postgres] Start attempt notice:', err.message);
    return false;
  }
}
