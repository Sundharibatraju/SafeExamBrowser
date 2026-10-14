import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { dbStore } from './server/dbStore';
import { executeJavaScript, executePython } from './server/sandbox';
import { compileAndRun, executeAgainstTestCases, SupportedLanguage, ensureNativeToolchain } from './server/realCompiler';
import { getCandidateAssessmentQuestions, CODING_QUESTION_BANK, APTITUDE_QUESTION_BANK } from './server/questionBank';
import { generateAptitudeQuestions } from './server/geminiService';
import { DEFAULT_CODING_QUESTIONS, DEFAULT_APTITUDE_QUESTIONS } from './src/data/mockData';
import { AssessmentSubmission, Candidate, ProctoringViolation, AptitudeQuestion, CodingQuestion, AssessmentStatus } from './src/types';
import {
  validateCandidateInPostgres,
  saveAssessmentResultToPostgres,
  testPostgresConnection,
  ensurePredefinedAssessmentsInPostgres,
  getPredefinedAssessmentFromPostgres,
  getCodingQuestionFromPostgres,
  resetCandidateAttemptInPostgres,
  startAttemptInPostgres,
  getPool
} from './server/postgresDb';
import { initialize22TablesSchema } from './server/schemaMigration';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

function ensureCompilerToolchainsInstalled() {
  ensureNativeToolchain('java').catch(err => {
    console.warn('[Compiler Engine] Background toolchain bootstrap notice:', err);
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Test direct PostgreSQL connection on boot & verify 22-table schema & predefined assessments in DB
  testPostgresConnection().then(async res => {
    if (res.connected) {
      console.log(`[Database] Connected successfully to Neon PostgreSQL database (${res.userCount} candidates in DB)`);
      dbStore.updateDbConfig({ isConnected: true, lastPingAt: Date.now() });
      await initialize22TablesSchema().catch(e => console.warn('[SchemaMigration] Notice on boot:', e.message));
      await ensurePredefinedAssessmentsInPostgres().catch(e => console.warn('[Assessments] Notice on boot:', e.message));
    } else {
      console.warn(`[Database] PostgreSQL connection notice:`, res.error);
    }
  });

  console.log('[Compiler Engine] Multi-Language Execution Engine ready (Python, TypeScript, Java, C, C++).');
  ensureCompilerToolchainsInstalled();

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Technical Assessment & Coding Proctor Engine'
    });
  });

  // 1. Candidate Validation (Direct DB Match & Strict Registration Block)
  app.post('/api/candidate/validate', async (req, res) => {
    const { candidateIdOrEmail, accessCode } = req.body;
    if (!candidateIdOrEmail && !accessCode) {
      return res.status(400).json({ error: 'Candidate ID, Email, or Access Code is required.' });
    }

    const trimmedInput = (candidateIdOrEmail || accessCode || '').trim();

    try {
      const pgResult = await validateCandidateInPostgres(trimmedInput, accessCode);
      if (pgResult.isBlocked) {
        return res.json({
          authorized: false,
          error: pgResult.error || 'Assessment Code Already Used',
          message: pgResult.message || 'This assessment code has already been used. Only one attempt is permitted.',
          isBlocked: true,
          reason: pgResult.reason
        });
      }
      if (!pgResult.authorized && pgResult.error) {
        return res.json({
          authorized: false,
          error: pgResult.error,
          message: pgResult.message,
          isBlocked: false,
          reason: pgResult.reason
        });
      }
      if (pgResult.authorized && pgResult.candidate) {
        dbStore.addScreenedCandidate(pgResult.candidate);
        return res.json({
          authorized: true,
          candidate: pgResult.candidate,
          interviewId: pgResult.interviewId,
          registrationId: pgResult.registrationId,
          jobId: pgResult.jobId
        });
      }
    } catch (pgErr: any) {
      console.error('[Postgres DB] Real-time validation error:', pgErr.message);
      return res.status(500).json({
        error: 'Database Validation Error',
        message: pgErr.message || 'Error executing candidate validation against PostgreSQL database.'
      });
    }

    return res.json({
      authorized: false,
      error: 'Access Denied: Unregistered Candidate',
      message: 'Self-registration is strictly forbidden on this assessment portal. Only candidates pre-screened and approved by the recruiter can attempt this test.',
      isBlocked: true,
      reason: 'UNREGISTERED_ATTEMPT'
    });
  });

  // Explicit registration block endpoint
  app.post('/api/candidate/register', (req, res) => {
    return res.status(403).json({
      error: 'Self-Registration Blocked',
      message: 'Direct self-registration is permanently disabled. Candidates must first complete resume screening on the parent recruiter portal.',
      blocked: true
    });
  });

  // Re-attempts disabled endpoint
  app.post('/api/candidate/reset-attempt', (_req, res) => {
    res.status(403).json({
      reset: false,
      success: false,
      error: 'Re-attempts disabled',
      message: 'Re-attempts are strictly disabled. The examination system enforces strictly one attempt per candidate access key.'
    });
  });

  interface CandidateExtensionAuditRecord {
    isClean: boolean;
    detectedCount: number;
    extensions: any[];
    lastChecked: number;
    serverAuditId: string;
  }
  const activeExtensionAudits = new Map<string, CandidateExtensionAuditRecord>();

  // 1b. Mark exam started
  app.post('/api/assessment/start', (req, res) => {
    const { candidateId } = req.body;
    if (!candidateId) {
      return res.status(400).json({ error: 'Candidate ID is required' });
    }
    const candidate = dbStore.getCandidate(candidateId);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const idKey = candidateId.trim().toLowerCase();
    const emailKey = (candidate.email || '').trim().toLowerCase();
    const auditRecord = activeExtensionAudits.get(idKey) || activeExtensionAudits.get(emailKey);
    if (auditRecord && !auditRecord.isClean) {
      console.warn(`[Proctor Backend] Blocked assessment start for "${candidateId}": Server holds active extension record!`);
      return res.status(403).json({
        error: 'Assessment Start Blocked by Server',
        message: 'Active browser extensions are currently detected on your system. You must disable all extensions before the server permits starting the exam.',
        isBlockedByExtension: true,
        extensions: auditRecord.extensions
      });
    }

    dbStore.markCodeUsed(candidateId, 'IN_PROGRESS');
    res.json({ started: true, message: 'Assessment session started. Access code marked as used.' });
  });

  // 2. Fetch Assessment Questions
  app.post('/api/assessment/questions', async (req, res) => {
    try {
      const { candidateId, email, role, jobId, accessCode } = req.body;
      const targetRole = role || 'Full Stack Software Engineer';

      const pgAssessment = await getPredefinedAssessmentFromPostgres(candidateId || email, jobId, accessCode);

      for (const q of pgAssessment.codingQuestions) {
        dbStore.addCodingQuestion(q);
      }
      for (const q of pgAssessment.aptitudeQuestions) {
        dbStore.addAptitudeQuestion(q);
      }

      const sanitizedCoding = pgAssessment.codingQuestions.map(q => ({
        ...q,
        starterCode: {
          c: '',
          cpp: '',
          java: '',
          python: '',
          typescript: '',
          javascript: ''
        },
        testCases: q.testCases.map((tc: any) => ({
          id: tc.id,
          input: tc.isHidden ? '[HIDDEN SPECIFICATION]' : tc.input,
          expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
          isHidden: tc.isHidden
        }))
      }));

      console.log(`[Assessment API] Served ${pgAssessment.aptitudeQuestions.length} predefined Aptitude MCQs (${pgAssessment.aptitudeMarks} marks) and ${sanitizedCoding.length} Coding Problems (${pgAssessment.codingMarks} marks) fetched strictly from PostgreSQL database.`);

      res.json({
        assessmentId: pgAssessment.assessmentId,
        title: pgAssessment.title,
        role: targetRole,
        totalMarks: pgAssessment.totalMarks,
        aptitudeMarks: pgAssessment.aptitudeMarks,
        codingMarks: pgAssessment.codingMarks,
        aptitudeQuestions: pgAssessment.aptitudeQuestions,
        codingQuestions: sanitizedCoding
      });
    } catch (err: any) {
      console.error('[Assessment API] Error fetching questions directly from database:', err.message);
      return res.status(404).json({
        error: 'Assessment Questions Not Found In Database',
        message: err.message || 'No assessment questions found in PostgreSQL database for this candidate registration. Fallback questions are disabled.'
      });
    }
  });

  // 3. Real Multi-Language Compiler Execution
  app.post('/api/compiler/execute', async (req, res) => {
    try {
      const { questionId, code, language = 'python' } = req.body;
      if (!code || !questionId) {
        return res.status(400).json({ error: 'Code and questionId are required.' });
      }

      const rawLang = String(language || 'python').toLowerCase().trim();
      const normLanguage: SupportedLanguage =
        (rawLang === 'javascript' || rawLang === 'js') ? 'javascript' as any :
        (rawLang === 'typescript' || rawLang === 'ts') ? 'typescript' :
        (rawLang === 'python' || rawLang === 'py' || rawLang === 'python3') ? 'python' :
        (rawLang === 'c') ? 'c' :
        (rawLang === 'cpp' || rawLang === 'c++') ? 'cpp' :
        (rawLang === 'java') ? 'java' : 'typescript';

      let fullQuestion =
        dbStore.getCodingQuestion(questionId) ||
        CODING_QUESTION_BANK.find(q => q.id === questionId) ||
        DEFAULT_CODING_QUESTIONS.find(q => q.id === questionId);

      if (!fullQuestion) {
        fullQuestion = await getCodingQuestionFromPostgres(questionId);
        if (fullQuestion) {
          dbStore.addCodingQuestion(fullQuestion);
        }
      }

      if (!fullQuestion) {
        return res.status(404).json({ error: 'Coding question not found.' });
      }

      const result = await executeAgainstTestCases(
        code,
        normLanguage,
        fullQuestion
      );
      res.json(result);
    } catch (err: any) {
      console.error('Sandbox execution error:', err);
      res.status(500).json({
        error: 'Execution failed',
        message: err.message
      });
    }
  });

  // 3b. Online GDB-style Custom Input Run (stdin)
  app.post('/api/compiler/custom-run', async (req, res) => {
    try {
      const { code, language = 'python', stdin = '' } = req.body;
      if (!code) {
        return res.status(400).json({ error: 'Source code is required.' });
      }

      const rawLang = String(language || 'python').toLowerCase().trim();
      const normLanguage: SupportedLanguage =
        (rawLang === 'javascript' || rawLang === 'js') ? 'javascript' as any :
        (rawLang === 'typescript' || rawLang === 'ts') ? 'typescript' :
        (rawLang === 'python' || rawLang === 'py' || rawLang === 'python3') ? 'python' :
        (rawLang === 'c') ? 'c' :
        (rawLang === 'cpp' || rawLang === 'c++') ? 'cpp' :
        (rawLang === 'java') ? 'java' : 'typescript';

      const result = await compileAndRun(
        code,
        normLanguage,
        stdin
      );
      res.json(result);
    } catch (err: any) {
      console.error('Custom run error:', err);
      res.status(500).json({
        status: 'RUNTIME_ERROR',
        stdout: '',
        stderr: err.message || 'Execution failed',
        executionTimeMs: 0,
        exitCode: 1
      });
    }
  });

  // 4. Real-time Browser Extension Verification & Audit Endpoint
  app.post('/api/proctor/verify-extension-audit', (req, res) => {
    const { candidateId, candidateEmail, clientTelemetry } = req.body || {};
    const detectedCount = clientTelemetry?.detectedCount || 0;
    const detectedExtensions = clientTelemetry?.detectedExtensions || [];
    const injectedDomElements = clientTelemetry?.injectedDomElements || [];
    const globalObjectFlags = clientTelemetry?.globalObjectFlags || [];
    const uriMatches = clientTelemetry?.uriMatches || [];

    const hasExtensionArtifacts =
      detectedCount > 0 ||
      detectedExtensions.length > 0 ||
      injectedDomElements.length > 0 ||
      globalObjectFlags.length > 0 ||
      uriMatches.length > 0;

    const isClean = !hasExtensionArtifacts;
    const auditId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const idKey = (candidateId || '').trim().toLowerCase();
    const emailKey = (candidateEmail || '').trim().toLowerCase();
    const auditRecord: CandidateExtensionAuditRecord = {
      isClean,
      detectedCount: detectedExtensions.length,
      extensions: detectedExtensions,
      lastChecked: Date.now(),
      serverAuditId: auditId
    };

    if (idKey) activeExtensionAudits.set(idKey, auditRecord);
    if (emailKey) activeExtensionAudits.set(emailKey, auditRecord);

    console.log(
      `[Proctor Backend] Extension Audit Verification for candidate "${candidateId || candidateEmail || 'anonymous'}": ${
        isClean ? 'VERIFIED CLEAN (0 extensions active)' : `STRICTLY BLOCKED (${detectedExtensions.length} extension(s) detected)`
      }`
    );

    if (isClean) {
      return res.json({
        success: true,
        clean: true,
        blocked: false,
        message: 'Real-time server verification passed: No browser extensions or injected scripts detected. Environment is secure.',
        verifiedExtensions: [],
        serverAuditId: auditId,
        timestamp: Date.now()
      });
    } else {
      return res.json({
        success: true,
        clean: false,
        blocked: true,
        message: `Real-time server verification failed: ${detectedExtensions.length} active extension(s) detected. All browser extensions must be turned off to proceed.`,
        verifiedExtensions: detectedExtensions,
        serverAuditId: auditId,
        timestamp: Date.now()
      });
    }
  });

  // 5. Real-time Proctoring Violation Logger & Instant Termination
  app.post('/api/proctor/violation', (req, res) => {
    const { candidateId, violation } = req.body as { candidateId: string; violation: ProctoringViolation };
    if (!candidateId || !violation) {
      return res.status(400).json({ error: 'candidateId and violation are required.' });
    }

    dbStore.logViolation(candidateId, violation);

    const isCritical =
      (violation.type === 'TAB_SWITCH' && violation.severity === 'CRITICAL') ||
      (violation.type === 'WINDOW_BLUR' && violation.severity === 'CRITICAL') ||
      (violation.type === 'FULLSCREEN_EXIT' && violation.severity === 'CRITICAL') ||
      violation.type === 'CAMERA_REVOKED' ||
      violation.type === 'EXTENSION_OR_INSPECTION_DETECTED' ||
      violation.type === 'SCREENSHOT_OR_CLIPBOARD_ATTEMPT' ||
      (violation.type === 'NO_FACE_DETECTED' && violation.severity === 'CRITICAL');

    if (isCritical) {
      const reason = `Terminated by Malpractice Protocol: ${violation.details} [${violation.type}]`;
      dbStore.updateCandidateStatus(candidateId, 'TERMINATED_MALPRACTICE');

      const existing = dbStore.getCandidateSubmission(candidateId);
      const candidate = dbStore.getCandidate(candidateId);

      const terminatedRecord: AssessmentSubmission = {
        candidateId,
        candidateName: candidate?.name || 'Candidate',
        candidateEmail: candidate?.email || '',
        role: candidate?.role || 'Applicant',
        startedAt: existing?.startedAt || Date.now() - 60000,
        completedAt: Date.now(),
        durationSeconds: Math.round(((Date.now() - (existing?.startedAt || Date.now())) / 1000)),
        aptitudeScore: 0,
        codingScore: 0,
        totalScore: 0,
        status: 'TERMINATED_MALPRACTICE',
        terminationReason: reason,
        violations: dbStore.getCandidateViolations(candidateId),
        aptitudeAnswers: {},
        codingSubmissions: {},
        recruiterSyncStatus: 'LOCAL_STORED'
      };
      dbStore.addSubmission(terminatedRecord);

      saveAssessmentResultToPostgres(terminatedRecord).catch(e => {
        console.warn('[Postgres] Error saving malpractice record:', e.message);
      });

      return res.json({
        terminated: true,
        status: 'TERMINATED_MALPRACTICE',
        reason,
        timestamp: Date.now()
      });
    }

    res.json({ recorded: true, count: dbStore.getCandidateViolations(candidateId).length });
  });

  // Start Assessment Attempt
  app.post('/api/assessment/start-attempt', async (req, res) => {
    try {
      const { registrationId, accessCode, candidateEmail, candidateId } = req.body;
      await startAttemptInPostgres({ registrationId, accessCode, email: candidateEmail }).catch(() => {});
      const identifier = candidateId || accessCode || candidateEmail;
      if (identifier) {
        dbStore.clearCandidateViolations(identifier);
        const cand = dbStore.getCandidate(identifier) || (accessCode ? dbStore.getCandidate(accessCode) : null);
        if (cand) {
          dbStore.clearCandidateViolations(cand.id);
          cand.attemptsCount = Math.max(cand.attemptsCount || 0, 1);
          cand.maxAttempts = 1;
          cand.lastAttemptStatus = 'IN_PROGRESS';
        }
      }
      res.json({ started: true });
    } catch {
      res.json({ started: true });
    }
  });

  // 5. Submit Final Assessment Result & Calculate Total Marks (out of 100)
  app.post('/api/assessment/submit', async (req, res) => {
    try {
      const {
        candidateId,
        candidateEmail,
        jobId: reqJobId,
        registrationId: reqRegId,
        accessCode: reqAccessCode,
        role,
        durationSeconds,
        aptitudeAnswers,
        codingResults,
        violations = []
      } = req.body;

      const candidate: Candidate = dbStore.getCandidate(candidateId) || (reqAccessCode ? dbStore.getCandidate(reqAccessCode) : null) || {
        id: candidateId,
        name: 'Candidate',
        email: candidateEmail || '',
        role: role || 'Candidate',
        accessCode: reqAccessCode || 'TECH-8023',
        screeningScore: 92,
        isPreScreened: true,
        attemptsCount: 1,
        maxAttempts: 1,
        jobId: reqJobId,
        registrationId: reqRegId,
        lastAttemptStatus: undefined
      };

      const jobId = reqJobId || candidate.jobId;
      const registrationId = reqRegId || candidate.registrationId;
      const accessCode = reqAccessCode || candidate.accessCode;

      let asmt: any = null;
      try {
        asmt = await getPredefinedAssessmentFromPostgres(candidateId || candidateEmail, jobId, accessCode);
      } catch (e: any) {
        console.warn('[Assessment Submit] Could not fetch assessment directly:', e.message);
      }

      const activeAptitudeList = (asmt && asmt.aptitudeQuestions?.length > 0)
        ? asmt.aptitudeQuestions
        : dbStore.getAptitudeQuestions();
      const activeCodingList = (asmt && asmt.codingQuestions?.length > 0)
        ? asmt.codingQuestions
        : dbStore.getCodingQuestions();

      const codingTotalMarks = activeCodingList.length * 10;
      const remainingAptitudeMarks = Math.max(0, 100 - codingTotalMarks);
      activeCodingList.forEach((q: any) => { q.marks = 10; });
      if (activeAptitudeList.length > 0) {
        const baseApt = Math.floor(remainingAptitudeMarks / activeAptitudeList.length);
        const remApt = remainingAptitudeMarks % activeAptitudeList.length;
        activeAptitudeList.forEach((q: any, i: number) => {
          q.marks = baseApt + (i < remApt ? 1 : 0);
        });
      }

      const totalPossible = 100;

      let aptitudeScore = 0;
      if (aptitudeAnswers && typeof aptitudeAnswers === 'object') {
        for (const [qId, selectedIdx] of Object.entries(aptitudeAnswers)) {
          const question = activeAptitudeList.find((q: any) => q.id === qId) || dbStore.getAptitudeQuestions().find((q: any) => q.id === qId);
          if (question) {
            const correctIdx = question.correctAnswerIndex !== undefined
              ? Number(question.correctAnswerIndex)
              : (question.correctOptionIndex !== undefined ? Number(question.correctOptionIndex) : Number((question as any).correct_answer_index ?? 0));
            if (correctIdx === Number(selectedIdx)) {
              aptitudeScore += (Number(question.marks) || 0);
            }
          }
        }
      }

      let codingScore = 0;
      const finalCodingMap: AssessmentSubmission['codingSubmissions'] = {};
      const codingSrc = codingResults || (req.body as any).codingSubmissions;
      if (codingSrc && typeof codingSrc === 'object') {
        const entries = Object.entries(codingSrc as Record<string, any>);
        for (const [qId, resItem] of entries) {
          const targetQ = activeCodingList.find((q: any) => q.id === qId) || dbStore.getCodingQuestions().find((q: any) => q.id === qId);
          const maxQMarks = 10;
          let passedCases = Number(resItem?.passedCases) || 0;
          let totalCases = Number(resItem?.totalCases) || (targetQ?.testCases?.length || 8);
          
          let itemScore = 0;
          if (resItem?.scoreAwarded !== undefined) {
            itemScore = Number(resItem.scoreAwarded);
          } else if (resItem?.score !== undefined) {
            itemScore = Number(resItem.score);
          } else if (totalCases > 0) {
            itemScore = passedCases === totalCases ? maxQMarks : Math.round((passedCases / totalCases) * maxQMarks);
          }

          // If unrun code was submitted or test cases not run, evaluate against test cases so candidate gets their earned marks
          if (itemScore === 0 && passedCases === 0 && resItem?.code && String(resItem.code).trim().length > 0 && targetQ) {
            try {
              const autoEval = await executeAgainstTestCases(
                String(resItem.code),
                (resItem.language || 'python') as any,
                targetQ
              );
              if (autoEval) {
                const autoPassed = Number(autoEval.passedCases || 0);
                const autoTotal = Number(autoEval.totalCases || totalCases);
                const autoScore = autoEval.scoreAwarded !== undefined
                  ? Number(autoEval.scoreAwarded)
                  : (autoTotal > 0 ? (autoPassed === autoTotal ? maxQMarks : Math.round((autoPassed / autoTotal) * maxQMarks)) : 0);
                if (autoScore > itemScore) {
                  itemScore = Math.min(maxQMarks, Math.max(0, autoScore));
                  passedCases = autoPassed;
                  totalCases = autoTotal;
                }
              }
            } catch (e) {
              console.warn('Backend auto-evaluation notice:', e);
            }
          }

          itemScore = Math.min(maxQMarks, Math.max(0, itemScore));
          codingScore += itemScore;
          finalCodingMap[qId] = {
            code: String(resItem?.code || ''),
            language: (resItem?.language || 'python') as any,
            score: itemScore,
            passedCases,
            totalCases
          };
        }
      }

      const totalScore = Math.min(100, Math.max(0, aptitudeScore + codingScore));
      const percentage = totalScore;
      const passingCutoff = Number(asmt?.passingScore) || 60;

      const allViolations = dbStore.getCandidateViolations(candidateId).concat(violations || []);
      const hasCriticalViolation = allViolations.some(v =>
        v.type === 'TAB_SWITCH' ||
        v.type === 'WINDOW_BLUR' ||
        (v.type === 'NO_FACE_DETECTED' && v.severity === 'CRITICAL')
      );

      let finalStatus: AssessmentSubmission['status'] = 'FAIL';
      let terminationReason: string | undefined;

      if (hasCriticalViolation) {
        finalStatus = 'TERMINATED_MALPRACTICE';
        terminationReason = 'Malpractice detected during assessment session.';
      } else if (percentage >= passingCutoff) {
        finalStatus = 'PASS';
      } else {
        finalStatus = 'FAIL';
      }

      const submission: AssessmentSubmission = {
        candidateId: candidate.id,
        candidateName: candidate.name,
        candidateEmail: candidateEmail || candidate.email,
        role: role || candidate.role,
        startedAt: Date.now() - (durationSeconds || 1800) * 1000,
        completedAt: Date.now(),
        durationSeconds: durationSeconds || 1800,
        aptitudeScore,
        codingScore,
        totalScore,
        status: finalStatus,
        terminationReason,
        violations: allViolations,
        aptitudeAnswers: aptitudeAnswers || {},
        codingSubmissions: finalCodingMap,
        recruiterSyncStatus: 'LOCAL_STORED'
      };

      (submission as any).totalMarks = totalPossible;
      (submission as any).percentage = percentage;

      dbStore.addSubmission(submission);
      dbStore.updateCandidateStatus(candidateId, finalStatus, totalScore);

      const candRec = dbStore.getCandidate(candidateId) || (accessCode ? dbStore.getCandidate(accessCode) : null);
      if (candRec) {
        candRec.attemptsCount = Math.max(candRec.attemptsCount || 0, 1);
        candRec.maxAttempts = 1;
        candRec.lastAttemptStatus = finalStatus;
        candRec.lastAttemptScore = totalScore;
      }

      const pgSaved = await saveAssessmentResultToPostgres(submission, {
        jobId,
        registrationId,
        accessCode,
        assessmentId: (req.body as any)?.assessmentId || asmt?.assessmentId
      }).catch(e => {
        console.warn('[Postgres] Error saving assessment to DB:', e.message);
        return false;
      });

      if (pgSaved) {
        submission.recruiterSyncStatus = 'SYNCED';
      }

      res.json({
        success: true,
        message: 'Assessment submitted successfully. Your evaluation has been saved.',
        submission: {
          ...submission,
          candidateId: candidate.id,
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          role: role || candidate.role,
          startedAt: submission.startedAt,
          completedAt: submission.completedAt,
          durationSeconds: submission.durationSeconds,
          violations: allViolations,
          status: submission.status
        }
      });
    } catch (err: any) {
      console.error('Error submitting assessment:', err);
      res.status(500).json({ error: 'Failed to record assessment results.' });
    }
  });

  // 6. Recruiter Portal: Get all candidate scores & submissions
  app.get('/api/results/all', async (req, res) => {
    try {
      const p = getPool();
      const pgSubs = await p.query(`
        SELECT 
          sub.id,
          sub.assessment_id,
          sub.registration_id,
          sub.candidate_id,
          sub.job_id,
          sub.score,
          sub.total_marks,
          sub.percentage,
          sub.passed,
          sub.integrity_status,
          sub.answers,
          sub.submitted_at,
          COALESCE(u.full_name, 'Candidate') as candidate_name,
          COALESCE(u.email, '') as candidate_email,
          COALESCE(j.title, 'Software Engineer') as role,
          r.technical_assessment_code as access_code
        FROM assessment_submissions sub
        LEFT JOIN candidate_profiles cp ON cp.id = sub.candidate_id
        LEFT JOIN users u ON u.id = cp.user_id
        LEFT JOIN jobs j ON j.id = sub.job_id
        LEFT JOIN interview_registrations r ON r.id = sub.registration_id
        ORDER BY sub.submitted_at DESC;
      `);

      const memorySubs = dbStore.getAllSubmissions();
      const memoryCands = dbStore.getAllCandidates();

      const formattedPgSubs: AssessmentSubmission[] = pgSubs.rows.map((row: any) => {
        const answersObj = row.answers || {};
        return {
          candidateId: row.candidate_id || row.id,
          candidateName: row.candidate_name,
          candidateEmail: row.candidate_email,
          role: row.role,
          startedAt: new Date(row.submitted_at).getTime() - 1800000,
          completedAt: new Date(row.submitted_at).getTime(),
          durationSeconds: 1800,
          aptitudeScore: answersObj.aptitudeScore || 0,
          codingScore: answersObj.codingScore || 0,
          totalScore: Number(row.score) || 0,
          status: row.integrity_status === 'MALPRACTICE_FLAGGED' ? 'TERMINATED_MALPRACTICE' : (row.passed ? 'PASS' : 'FAIL'),
          violations: answersObj.violations || [],
          aptitudeAnswers: answersObj.aptitudeAnswers || {},
          codingSubmissions: answersObj.codingSubmissions || {},
          recruiterSyncStatus: 'SYNCED'
        };
      });

      const combinedSubs = [...formattedPgSubs];
      for (const m of memorySubs) {
        if (!combinedSubs.some(s => s.candidateEmail === m.candidateEmail && Math.abs(s.completedAt - m.completedAt) < 60000)) {
          combinedSubs.push(m);
        }
      }

      const pgCands = await p.query(`
        SELECT 
          r.id as registration_id,
          u.id as candidate_id,
          u.full_name as name,
          u.email,
          j.id as job_id,
          j.title as role,
          r.technical_assessment_code as access_code,
          r.technical_assessment_score as last_attempt_score,
          r.status,
          r.interview_status,
          r.code_attempt_count as attempts_count
        FROM interview_registrations r
        LEFT JOIN candidate_profiles cp ON cp.id = r.candidate_id
        LEFT JOIN users u ON (u.id = cp.user_id OR u.id = r.candidate_id)
        LEFT JOIN jobs j ON j.id = r.job_id
        ORDER BY r.created_at DESC;
      `);

      const formattedPgCands = pgCands.rows.map((row: any) => ({
        id: row.candidate_id,
        name: row.name,
        email: row.email,
        role: row.role,
        accessCode: row.access_code,
        screeningScore: 90,
        isPreScreened: true,
        attemptsCount: Number(row.attempts_count) || (row.last_attempt_score !== null ? 1 : 0),
        maxAttempts: 1,
        jobId: row.job_id,
        registrationId: row.registration_id,
        lastAttemptStatus: row.interview_status === 'MALPRACTICE_TERMINATED' ? ('TERMINATED_MALPRACTICE' as const) : (row.status === 'SHORTLISTED' || row.status === 'CLEARED' ? ('PASS' as const) : (row.last_attempt_score !== null ? ('FAIL' as const) : undefined)),
        lastAttemptScore: row.last_attempt_score !== null ? Number(row.last_attempt_score) : undefined
      }));

      const combinedCands: any[] = [...formattedPgCands];
      for (const m of memoryCands) {
        if (!combinedCands.some((c: any) => c.email === m.email)) {
          combinedCands.push(m);
        }
      }

      res.json({
        submissions: combinedSubs,
        candidates: combinedCands,
        stats: {
          totalEvaluated: combinedSubs.length,
          passed: combinedSubs.filter(s => s.status === 'PASS').length,
          failed: combinedSubs.filter(s => s.status === 'FAIL').length,
          terminatedMalpractice: combinedSubs.filter(s => s.status === 'TERMINATED_MALPRACTICE').length,
          averageScore: combinedSubs.length > 0
            ? Math.round(combinedSubs.reduce((acc, s) => acc + s.totalScore, 0) / combinedSubs.length)
            : 0
        }
      });
    } catch (e: any) {
      console.warn('[Postgres] Falling back to memory store for /api/results/all:', e.message);
      const submissions = dbStore.getAllSubmissions();
      const candidates = dbStore.getAllCandidates();
      res.json({
        submissions,
        candidates,
        stats: {
          totalEvaluated: submissions.length,
          passed: submissions.filter(s => s.status === 'PASS').length,
          failed: submissions.filter(s => s.status === 'FAIL').length,
          terminatedMalpractice: submissions.filter(s => s.status === 'TERMINATED_MALPRACTICE').length,
          averageScore: submissions.length > 0
            ? Math.round(submissions.reduce((acc, s) => acc + s.totalScore, 0) / submissions.length)
            : 0
        }
      });
    }
  });

  // 7. Add pre-screened candidate
  app.post('/api/candidates/add-screened', (req, res) => {
    const { name, email, role, screeningScore, resumeSummary } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    let code12 = Math.floor(1 + Math.random() * 9).toString();
    for (let i = 1; i < 12; i++) {
      code12 += Math.floor(Math.random() * 10).toString();
    }
    const assignedCode = req.body.accessCode && req.body.accessCode.replace(/\D/g, '').length === 12
      ? req.body.accessCode.replace(/\D/g, '')
      : code12;
    const newId = `CAN-${Math.floor(1000 + Math.random() * 9000)}`;
    const newCandidate = {
      id: newId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: role?.trim() || 'Software Engineer',
      accessCode: assignedCode,
      screeningScore: Number(screeningScore) || 85,
      resumeSummary: resumeSummary || 'Screened and approved candidate from resume pipeline.',
      isPreScreened: true,
      attemptsCount: 0,
      maxAttempts: 1
    };
    dbStore.addScreenedCandidate(newCandidate);
    res.json({
      success: true,
      message: 'Candidate registered into authorized technical assessment pool.',
      candidate: newCandidate
    });
  });

  // 8. Database Link Configuration
  app.get('/api/db/config', (req, res) => {
    res.json(dbStore.getDbConfig());
  });

  app.post('/api/db/config', (req, res) => {
    const { externalDbUrl, authHeaderKey, authHeaderValue, syncMode } = req.body;
    const updated = dbStore.updateDbConfig({
      externalDbUrl,
      authHeaderKey: authHeaderKey || 'Authorization',
      authHeaderValue,
      syncMode: syncMode || 'REST_WEBHOOK'
    });
    res.json({ success: true, config: updated });
  });

  app.post('/api/db/test-connection', async (req, res) => {
    const { externalDbUrl } = req.body;
    if (!externalDbUrl || externalDbUrl.startsWith('postgres') || externalDbUrl.includes('@')) {
      const pgCheck = await testPostgresConnection();
      if (pgCheck.connected) {
        dbStore.updateDbConfig({
          externalDbUrl: externalDbUrl || process.env.EXTERNAL_DB_URL,
          isConnected: true,
          lastPingAt: Date.now()
        });
        return res.json({
          success: true,
          statusCode: 200,
          message: `Successfully connected directly to PostgreSQL Database (${pgCheck.userCount} candidates registered in screening DB, ping latency ${pgCheck.latencyMs}ms). No recruiter secret required.`
        });
      } else {
        return res.json({
          success: false,
          error: `PostgreSQL connection error: ${pgCheck.error}`
        });
      }
    }

    try {
      const parsedUrl = new URL(externalDbUrl);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'TechnicalAssessment-Proctor-Sync/2.0'
      };

      if (parsedUrl.username || parsedUrl.password) {
        const auth = Buffer.from(
          `${decodeURIComponent(parsedUrl.username)}:${decodeURIComponent(parsedUrl.password)}`
        ).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
        parsedUrl.username = '';
        parsedUrl.password = '';
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(parsedUrl.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ping: true,
          source: 'Technical Assessment & Coding Proctor',
          timestamp: new Date().toISOString()
        }),
        signal: controller.signal
      }).catch(() => {
        return fetch(parsedUrl.toString(), { method: 'GET', signal: controller.signal });
      });
      clearTimeout(timeoutId);

      const isConnected = Boolean(response && response.status < 500);
      dbStore.updateDbConfig({
        externalDbUrl,
        isConnected,
        lastPingAt: Date.now()
      });
      res.json({
        success: isConnected,
        statusCode: response?.status || 200,
        message: isConnected
          ? `Successfully reached external recruiter database endpoint (${response.status})`
          : `External endpoint responded with status ${response?.status}`
      });
    } catch (err: any) {
      res.json({
        success: false,
        error: `Could not reach endpoint: ${err.message}`
      });
    }
  });

  app.post('/api/db/sync-all', async (req, res) => {
    const submissions = dbStore.getAllSubmissions();
    let syncedCount = 0;
    for (const sub of submissions) {
      const ok = await dbStore.syncSubmissionToExternal(sub);
      if (ok) syncedCount++;
    }
    res.json({
      total: submissions.length,
      synced: syncedCount,
      message: `Synchronized ${syncedCount} of ${submissions.length} results to recruiter DB.`
    });
  });

  // 9. Recruiter Authentication Gate
  app.post('/api/recruiter/verify', (req, res) => {
    const { passcode } = req.body;
    const validCodes = ['recruiter2026', 'admin8023', 'admin2026'];
    if (passcode && validCodes.includes(passcode.trim())) {
      return res.json({ authorized: true, message: 'Recruiter credentials verified.' });
    }
    return res.status(401).json({
      authorized: false,
      error: 'Unauthorized Access',
      message: 'Invalid Recruiter Master Passcode. Candidates are strictly not permitted to view this screen.'
    });
  });

  // 10. Recruiter Question Management
  app.get('/api/recruiter/questions', (req, res) => {
    res.json({
      aptitudeQuestions: dbStore.getAptitudeQuestions(),
      codingQuestions: dbStore.getCodingQuestions()
    });
  });

  app.post('/api/recruiter/questions/aptitude', (req, res) => {
    const { id, topic, question, options, correctAnswerIndex, explanation, marks = 10 } = req.body;
    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'Question text and at least two options are required.' });
    }
    const newQ: AptitudeQuestion = {
      id: id || `apt-db-${Date.now()}`,
      topic: topic || 'General Technical',
      question: question.trim(),
      options: options.map((opt: string) => opt.trim()),
      correctAnswerIndex: Number(correctAnswerIndex) || 0,
      explanation: explanation ? explanation.trim() : 'Correct answer verified by recruiter.',
      marks: Number(marks) || 10
    };
    const saved = dbStore.addAptitudeQuestion(newQ);
    res.json({ success: true, message: 'MCQ question saved to database.', question: saved });
  });

  app.delete('/api/recruiter/questions/aptitude/:id', (req, res) => {
    const { id } = req.params;
    const ok = dbStore.deleteAptitudeQuestion(id);
    if (ok) {
      res.json({ success: true, message: 'Aptitude question deleted from database.' });
    } else {
      res.status(404).json({ error: 'Question not found' });
    }
  });

  app.post('/api/recruiter/questions/coding', (req, res) => {
    const { id, title, difficulty, marks = 10, description, constraints, examples, testCases } = req.body;
    if (!title || !description || !testCases || !Array.isArray(testCases) || testCases.length === 0) {
      return res.status(400).json({ error: 'Title, problem description, and at least one test case are required.' });
    }

    const starterCode = {
      c: `#include <stdio.h>\n#include <stdlib.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}`,
      cpp: `#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}`,
      java: `import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}`,
      python: `import sys\n\ndef main():\n    # Write your solution here\n    pass\n\nif __name__ == '__main__':\n    main()`,
      typescript: `// TypeScript Solution\n// Write your solution here\n`
    };

    const newCoding: CodingQuestion = {
      id: id || `algo-db-${Date.now()}`,
      title: title.trim(),
      difficulty: difficulty || 'Medium',
      marks: Number(marks) || 10,
      description: description.trim(),
      constraints: Array.isArray(constraints) && constraints.length > 0 ? constraints : ['Standard time and memory constraints apply.'],
      examples: Array.isArray(examples) && examples.length > 0 ? examples : [
        { input: testCases[0]?.input || '1', output: testCases[0]?.expectedOutput || '1' }
      ],
      starterCode,
      testCases: testCases.map((tc: any, idx: number) => ({
        id: tc.id || `tc-db-${idx + 1}`,
        input: tc.input || '',
        expectedOutput: tc.expectedOutput || '',
        isHidden: Boolean(tc.isHidden)
      }))
    };
    const saved = dbStore.addCodingQuestion(newCoding);
    res.json({ success: true, message: 'Coding question and test cases stored in database.', question: saved });
  });

  app.delete('/api/recruiter/questions/coding/:id', (req, res) => {
    const { id } = req.params;
    const ok = dbStore.deleteCodingQuestion(id);
    if (ok) {
      res.json({ success: true, message: 'Coding question deleted from database.' });
    } else {
      res.status(404).json({ error: 'Question not found' });
    }
  });

  app.post('/api/recruiter/questions/reset-defaults', (req, res) => {
    dbStore.resetQuestions();
    res.json({
      success: true,
      message: 'Question banks reset to default curated assessment pool.',
      aptitudeCount: dbStore.getAptitudeQuestions().length,
      codingCount: dbStore.getCodingQuestions().length
    });
  });

  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[API Error Handler]', err);
    res.setHeader('Content-Type', 'application/json');
    res.status(err.status || 500).json({
      error: err.name || 'InternalServerError',
      message: err.message || 'An unexpected error occurred during request processing.'
    });
  });

  app.all('/api/*', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(404).json({
      error: 'NotFound',
      message: `API endpoint ${req.method} ${req.path} was not found.`
    });
  });

  // --- VITE / STATIC SERVING ---
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
  const isProduction = process.env.NODE_ENV === 'production' || hasDist;

  if (isProduction && hasDist) {
    console.log(`[Server] Serving production static assets from ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log('[Server] Starting Vite development middleware server');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Technical Assessment & Proctor Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
