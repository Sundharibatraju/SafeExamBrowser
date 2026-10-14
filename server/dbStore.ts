import fs from 'fs';
import path from 'path';
import { Candidate, AssessmentSubmission, ProctoringViolation, DbSyncConfig, AptitudeQuestion, CodingQuestion, AssessmentStatus } from '../src/types';
import { INITIAL_PRE_SCREENED_CANDIDATES } from '../src/data/mockData';
import { APTITUDE_QUESTION_BANK, CODING_QUESTION_BANK } from './questionBank';

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'db_records.json');

interface StoreSchema {
  candidates: Candidate[];
  submissions: AssessmentSubmission[];
  violations: { candidateId: string; violation: ProctoringViolation }[];
  dbConfig: DbSyncConfig;
  aptitudeQuestions: AptitudeQuestion[];
  codingQuestions: CodingQuestion[];
}

const DEFAULT_NEON_DB_URL = 'postgresql://neondb_owner:npg_LhR2rs5vWOxm@ep-morning-darkness-b5tgv4dp-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

class DatabaseStore {
  private data: StoreSchema;

  constructor() {
    this.data = {
      candidates: [...INITIAL_PRE_SCREENED_CANDIDATES],
      submissions: [],
      violations: [],
      dbConfig: {
        externalDbUrl: process.env.EXTERNAL_DB_URL || process.env.DATABASE_URL || DEFAULT_NEON_DB_URL,
        authHeaderKey: 'Authorization',
        authHeaderValue: process.env.RECRUITER_SECRET ? `Bearer ${process.env.RECRUITER_SECRET}` : '',
        isConnected: false,
        syncMode: 'REST_WEBHOOK'
      },
      aptitudeQuestions: [...APTITUDE_QUESTION_BANK],
      codingQuestions: [...CODING_QUESTION_BANK]
    };
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.candidates && Array.isArray(parsed.candidates)) {
          const existingIds = new Set(parsed.candidates.map((c: Candidate) => c.id));
          for (const initC of INITIAL_PRE_SCREENED_CANDIDATES) {
            if (!existingIds.has(initC.id)) {
              parsed.candidates.push(initC);
            }
          }
          this.data.candidates = parsed.candidates;
        }
        if (parsed.submissions && Array.isArray(parsed.submissions)) {
          this.data.submissions = parsed.submissions;
        }
        if (parsed.violations && Array.isArray(parsed.violations)) {
          this.data.violations = parsed.violations;
        }
        if (parsed.dbConfig) {
          this.data.dbConfig = parsed.dbConfig;
        }
        if (parsed.aptitudeQuestions && Array.isArray(parsed.aptitudeQuestions) && parsed.aptitudeQuestions.length > 0) {
          this.data.aptitudeQuestions = parsed.aptitudeQuestions;
        } else {
          this.data.aptitudeQuestions = [...APTITUDE_QUESTION_BANK];
        }
        if (parsed.codingQuestions && Array.isArray(parsed.codingQuestions) && parsed.codingQuestions.length > 0) {
          this.data.codingQuestions = parsed.codingQuestions;
        } else {
          this.data.codingQuestions = [...CODING_QUESTION_BANK];
        }
      } else {
        this.saveToDisk();
      }
    } catch (e) {
      console.error('Error loading db store, using memory fallback:', e);
    }
  }

  private saveToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving db store:', e);
    }
  }

  // Candidates
  public getCandidate(idOrEmailOrCode: string): Candidate | undefined {
    const query = idOrEmailOrCode.trim().toLowerCase();
    return this.data.candidates.find(
      c => c.id.toLowerCase() === query || c.email.toLowerCase() === query || (c.accessCode && c.accessCode.toLowerCase() === query)
    );
  }

  public getAllCandidates(): Candidate[] {
    return this.data.candidates;
  }

  public addScreenedCandidate(candidate: Candidate): void {
    const existingIdx = this.data.candidates.findIndex(c => c.id === candidate.id || c.email === candidate.email);
    if (existingIdx >= 0) {
      this.data.candidates[existingIdx] = candidate;
    } else {
      this.data.candidates.unshift(candidate);
    }
    this.saveToDisk();
  }

  public updateCandidateStatus(id: string, status: AssessmentSubmission['status'], score?: number): void {
    const candidate = this.data.candidates.find(c => c.id === id);
    if (candidate) {
      candidate.lastAttemptStatus = status;
      candidate.attemptsCount = (candidate.attemptsCount || 0) + 1;
      if (score !== undefined) candidate.lastAttemptScore = score;
      this.saveToDisk();
    }
  }

  // Submissions
  public addSubmission(submission: AssessmentSubmission): void {
    this.data.submissions = this.data.submissions.filter(s => s.candidateId !== submission.candidateId);
    this.data.submissions.unshift(submission);
    this.updateCandidateStatus(submission.candidateId, submission.status, submission.totalScore);
    this.saveToDisk();

    if (this.data.dbConfig.externalDbUrl) {
      this.syncSubmissionToExternal(submission).catch(err => {
        console.error('External DB sync error:', err.message);
      });
    }
  }

  public getAllSubmissions(): AssessmentSubmission[] {
    return this.data.submissions;
  }

  public getCandidateSubmission(candidateId: string): AssessmentSubmission | undefined {
    return this.data.submissions.find(s => s.candidateId === candidateId);
  }

  // Proctoring Violations
  public logViolation(candidateId: string, violation: ProctoringViolation): void {
    this.data.violations.unshift({ candidateId, violation });
    this.saveToDisk();
  }

  public getCandidateViolations(candidateId: string): ProctoringViolation[] {
    return this.data.violations.filter(v => v.candidateId === candidateId).map(v => v.violation);
  }

  public clearCandidateViolations(candidateId: string): void {
    this.data.violations = this.data.violations.filter(v => v.candidateId !== candidateId);
    this.saveToDisk();
  }

  public clearCandidateSubmissions(candidateId: string): void {
    this.data.submissions = this.data.submissions.filter(s => s.candidateId !== candidateId);
    this.saveToDisk();
  }

  // Database Connection Config
  public getDbConfig(): DbSyncConfig {
    return this.data.dbConfig;
  }

  public updateDbConfig(config: Partial<DbSyncConfig>): DbSyncConfig {
    this.data.dbConfig = {
      ...this.data.dbConfig,
      ...config
    };
    this.saveToDisk();
    return this.data.dbConfig;
  }

  public async syncSubmissionToExternal(submission: AssessmentSubmission): Promise<boolean> {
    const dbUrl = this.data.dbConfig.externalDbUrl;
    if (!dbUrl) return false;

    // 1. Direct PostgreSQL / Neon Database Sync
    if (
      dbUrl.startsWith('postgresql://') ||
      dbUrl.startsWith('postgres://') ||
      dbUrl.includes('neon.tech') ||
      dbUrl.includes(':5432')
    ) {
      try {
        const { saveAssessmentResultToPostgres } = await import('./postgresDb');
        const ok = await saveAssessmentResultToPostgres(submission);
        if (ok) {
          submission.recruiterSyncStatus = 'SYNCED';
          this.data.dbConfig.isConnected = true;
          this.data.dbConfig.lastSyncAt = Date.now();
          this.saveToDisk();
          return true;
        }
      } catch (err: any) {
        console.warn('[Postgres direct sync note]:', err.message);
      }
      return false;
    }

    // 2. Guard against non-HTTP URLs that would crash WHATWG fetch
    if (!dbUrl.startsWith('http://') && !dbUrl.startsWith('https://')) {
      console.warn('External DB URL is not a recognized HTTP(S) endpoint:', dbUrl);
      return false;
    }

    try {
      // Parse URL and strip credentials to avoid WHATWG fetch error
      const parsedUrl = new URL(dbUrl);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (parsedUrl.username || parsedUrl.password) {
        const auth = Buffer.from(
          `${decodeURIComponent(parsedUrl.username)}:${decodeURIComponent(parsedUrl.password)}`
        ).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
        parsedUrl.username = '';
        parsedUrl.password = '';
      }

      if (this.data.dbConfig.authHeaderKey && this.data.dbConfig.authHeaderValue) {
        headers[this.data.dbConfig.authHeaderKey] = this.data.dbConfig.authHeaderValue;
      }

      const payload = {
        event: 'TECHNICAL_ASSESSMENT_COMPLETED',
        schemaVersion: '2.0',
        timestamp: new Date().toISOString(),
        candidate: {
          candidateId: submission.candidateId,
          name: submission.candidateName,
          email: submission.candidateEmail,
          targetRole: submission.role
        },
        assessmentResults: {
          totalScore: submission.totalScore,
          maxScore: 100,
          aptitudeScore: submission.aptitudeScore,
          codingScore: submission.codingScore,
          status: submission.status,
          passThresholdMet: submission.status === 'PASS',
          terminationReason: submission.terminationReason || null,
          durationSeconds: submission.durationSeconds,
          completedAt: submission.completedAt
        },
        proctoringAudit: {
          violationCount: submission.violations.length,
          violations: submission.violations,
          tabSwitchDetected: submission.violations.some(v => v.type === 'TAB_SWITCH'),
          faceAbsenceDetected: submission.violations.some(v => v.type === 'NO_FACE_DETECTED'),
          extensionDetected: submission.violations.some(v => v.type === 'EXTENSION_OR_INSPECTION_DETECTED')
        },
        codingSubmissions: submission.codingSubmissions
      };

      const res = await fetch(parsedUrl.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        submission.recruiterSyncStatus = 'SYNCED';
        this.data.dbConfig.isConnected = true;
        this.data.dbConfig.lastSyncAt = Date.now();
        this.saveToDisk();
        return true;
      } else {
        console.warn(`External DB returned HTTP ${res.status}: ${await res.text()}`);
      }
    } catch (err: any) {
      console.error('Failed to dispatch external DB sync:', err.message);
    }
    return false;
  }

  public getAptitudeQuestions(): AptitudeQuestion[] {
    if (!this.data.aptitudeQuestions || this.data.aptitudeQuestions.length === 0) {
      this.data.aptitudeQuestions = [...APTITUDE_QUESTION_BANK];
      this.saveToDisk();
    }
    return this.data.aptitudeQuestions;
  }

  public getCodingQuestions(): CodingQuestion[] {
    if (!this.data.codingQuestions || this.data.codingQuestions.length === 0) {
      this.data.codingQuestions = [...CODING_QUESTION_BANK];
      this.saveToDisk();
    }
    return this.data.codingQuestions;
  }

  public getCodingQuestion(id: string): CodingQuestion | undefined {
    return this.getCodingQuestions().find(q => q.id === id);
  }

  public addAptitudeQuestion(q: AptitudeQuestion): AptitudeQuestion {
    if (!this.data.aptitudeQuestions) {
      this.data.aptitudeQuestions = [...APTITUDE_QUESTION_BANK];
    }
    const idx = this.data.aptitudeQuestions.findIndex(item => item.id === q.id);
    if (idx >= 0) {
      this.data.aptitudeQuestions[idx] = q;
    } else {
      this.data.aptitudeQuestions.unshift(q);
    }
    this.saveToDisk();
    return q;
  }

  public deleteAptitudeQuestion(id: string): boolean {
    if (!this.data.aptitudeQuestions) return false;
    const initialLen = this.data.aptitudeQuestions.length;
    this.data.aptitudeQuestions = this.data.aptitudeQuestions.filter(q => q.id !== id);
    if (this.data.aptitudeQuestions.length !== initialLen) {
      this.saveToDisk();
      return true;
    }
    return false;
  }

  public addCodingQuestion(q: CodingQuestion): CodingQuestion {
    if (!this.data.codingQuestions) {
      this.data.codingQuestions = [...CODING_QUESTION_BANK];
    }
    const idx = this.data.codingQuestions.findIndex(item => item.id === q.id);
    if (idx >= 0) {
      this.data.codingQuestions[idx] = q;
    } else {
      this.data.codingQuestions.unshift(q);
    }
    this.saveToDisk();
    return q;
  }

  public deleteCodingQuestion(id: string): boolean {
    if (!this.data.codingQuestions) return false;
    const initialLen = this.data.codingQuestions.length;
    this.data.codingQuestions = this.data.codingQuestions.filter(q => q.id !== id);
    if (this.data.codingQuestions.length !== initialLen) {
      this.saveToDisk();
      return true;
    }
    return false;
  }

  public resetQuestions(): void {
    this.data.aptitudeQuestions = [...APTITUDE_QUESTION_BANK];
    this.data.codingQuestions = [...CODING_QUESTION_BANK];
    this.saveToDisk();
  }

  public markCodeUsed(candidateIdOrEmail: string, status: AssessmentStatus = 'IN_PROGRESS'): void {
    const candidate = this.getCandidate(candidateIdOrEmail);
    if (candidate) {
      candidate.attemptsCount = Math.max(candidate.attemptsCount || 0, 1);
      candidate.lastAttemptStatus = status;
      this.saveToDisk();
    }
  }
}

export const dbStore = new DatabaseStore();
