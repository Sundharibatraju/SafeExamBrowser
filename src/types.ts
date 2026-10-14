export type AssessmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PASS' | 'FAIL' | 'PASSED' | 'FAILED' | 'TERMINATED_MALPRACTICE' | 'COMPLETED';

export interface Candidate {
  id: string;
  name: string;
  email: string;
  role: string;
  accessCode: string;
  screeningScore: number;
  resumeSummary?: string;
  isPreScreened: boolean;
  attemptsCount: number;
  maxAttempts: number;
  lastAttemptStatus?: AssessmentStatus;
  lastAttemptScore?: number;
  jobId?: string;
  registrationId?: string;
}

export interface AptitudeQuestion {
  id: string;
  topic: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  marks: number;
}

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  explanation?: string;
}

export type SupportedLanguage = 'c' | 'cpp' | 'java' | 'python' | 'typescript';

export interface CodingStarterCode {
  c: string;
  cpp: string;
  java: string;
  python: string;
  typescript: string;
  javascript?: string;
}

export interface CodingQuestion {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  marks: number; // 10 marks each
  description: string;
  constraints: string[];
  examples: {
    input: string;
    output: string;
    explanation?: string;
  }[];
  starterCode: CodingStarterCode;
  testCases: TestCase[];
}

export interface SingleTestResult {
  testCaseId: string;
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  passed: boolean;
  isHidden: boolean;
  error?: string;
  executionTimeMs?: number;
}

export interface CodeExecutionResponse {
  questionId: string;
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR' | 'TIME_LIMIT_EXCEEDED' | 'COMPILE_ERROR';
  totalCases: number;
  passedCases: number;
  scoreAwarded: number; // Allocated strictly based on hidden test cases (0 to 10)
  hiddenCasesTotal?: number;
  hiddenCasesPassed?: number;
  testResults: SingleTestResult[];
  outputMessage: string;
}

export interface ProctoringViolation {
  id: string;
  type: 'TAB_SWITCH' | 'EXTENSION_OR_INSPECTION_DETECTED' | 'NO_FACE_DETECTED' | 'MULTIPLE_FACES_DETECTED' | 'FULLSCREEN_EXIT' | 'WINDOW_BLUR' | 'CAMERA_REVOKED' | 'SCREENSHOT_OR_CLIPBOARD_ATTEMPT';
  timestamp: number;
  details: string;
  severity: 'WARNING' | 'CRITICAL';
}

export interface AssessmentSubmission {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  role: string;
  startedAt: number;
  completedAt: number;
  durationSeconds: number;
  aptitudeScore: number; // Max 80
  codingScore: number; // Max 20
  totalScore: number; // Max 100
  status: 'PASS' | 'FAIL' | 'TERMINATED_MALPRACTICE';
  terminationReason?: string;
  violations: ProctoringViolation[];
  aptitudeAnswers: Record<string, number>;
  codingSubmissions: Record<string, {
    code: string;
    language: 'javascript' | 'python' | 'java' | 'c' | 'cpp' | 'typescript';
    score: number;
    passedCases: number;
    totalCases: number;
  }>;
  recruiterSyncStatus: 'SYNCED' | 'PENDING' | 'LOCAL_STORED';
}

export interface DbSyncConfig {
  externalDbUrl: string;
  authHeaderKey?: string;
  authHeaderValue?: string;
  isConnected: boolean;
  lastPingAt?: number;
  lastSyncAt?: number;
  syncMode: 'REST_WEBHOOK' | 'DIRECT_JSON_ENDPOINT' | 'FIRESTORE_COMPATIBLE';
}
