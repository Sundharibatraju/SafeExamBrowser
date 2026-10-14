import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Send, Plus, Search, Filter, Eye, ArrowLeft, ExternalLink, Code, Layers, FileQuestion, RotateCcw } from 'lucide-react';
import { AssessmentSubmission, Candidate, DbSyncConfig } from '../types';
import { RecruiterQuestionManager } from './RecruiterQuestionManager';

interface RecruiterPortalProps {
  onClose: () => void;
}

export const RecruiterPortal: React.FC<RecruiterPortalProps> = ({ onClose }) => {
  const [portalTab, setPortalTab] = useState<'EVALUATIONS' | 'QUESTIONS'>('EVALUATIONS');
  const [submissions, setSubmissions] = useState<AssessmentSubmission[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState({
    totalEvaluated: 0,
    passed: 0,
    failed: 0,
    terminatedMalpractice: 0,
    averageScore: 0
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSubmission, setSelectedSubmission] = useState<AssessmentSubmission | null>(null);

  // DB Configuration State
  const [dbConfig, setDbConfig] = useState<DbSyncConfig>({
    externalDbUrl: '',
    authHeaderKey: 'Authorization',
    authHeaderValue: '',
    isConnected: false,
    syncMode: 'REST_WEBHOOK'
  });
  const [dbInputUrl, setDbInputUrl] = useState('');
  const [testingDb, setTestingDb] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // New Candidate Modal
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [newCandidateForm, setNewCandidateForm] = useState({
    name: '',
    email: '',
    role: 'Full Stack Software Engineer',
    screeningScore: 88,
    resumeSummary: 'Passed resume screening: Proficient in algorithms, backend architectures, and APIs.'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resResults, resDb] = await Promise.all([
        fetch('/api/results/all'),
        fetch('/api/db/config')
      ]);
      const dataResults = await resResults.json();
      const dataDb = await resDb.json();

      setSubmissions(dataResults.submissions || []);
      setCandidates(dataResults.candidates || []);
      if (dataResults.stats) setStats(dataResults.stats);
      if (dataDb) {
        setDbConfig(dataDb);
        setDbInputUrl(dataDb.externalDbUrl || '');
      }
    } catch (err) {
      console.error('Failed to load recruiter data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveDbConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingDb(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/db/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalDbUrl: dbInputUrl.trim(),
          authHeaderKey: dbConfig.authHeaderKey,
          authHeaderValue: dbConfig.authHeaderValue,
          syncMode: dbConfig.syncMode
        })
      });
      const data = await res.json();
      if (data.config) setDbConfig(data.config);

      if (dbInputUrl.trim()) {
        const pingRes = await fetch('/api/db/test-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            externalDbUrl: dbInputUrl.trim(),
            authHeaderKey: dbConfig.authHeaderKey,
            authHeaderValue: dbConfig.authHeaderValue
          })
        });
        const pingData = await pingRes.json();
        setTestResult({
          success: pingData.success,
          message: pingData.message || pingData.error
        });
        setDbConfig(prev => ({ ...prev, isConnected: pingData.success }));
      } else {
        setTestResult({
          success: true,
          message: 'Saved in local database mode.'
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection attempt failed.'
      });
    } finally {
      setTestingDb(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/db/sync-all', { method: 'POST' });
      const data = await res.json();
      setSyncMessage(data.message || 'Synchronization complete.');
      fetchData();
    } catch {
      setSyncMessage('Failed to trigger bulk synchronization.');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleAddCandidateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/candidates/add-screened', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCandidateForm)
      });
      if (res.ok) {
        setShowAddCandidate(false);
        setNewCandidateForm({
          name: '',
          email: '',
          role: 'Full Stack Software Engineer',
          screeningScore: 88,
          resumeSummary: ''
        });
        fetchData();
      }
    } catch (e) {
      console.error('Failed to add candidate:', e);
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    const matchesFilter =
      filterStatus === 'ALL' ||
      sub.status === filterStatus;
    const matchesSearch =
      sub.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.candidateId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.candidateEmail.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Recruiter Dashboard & DB Console</h1>
                <span className="text-xs px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                  LIVE RECRUITER MODE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                View candidate technical performance (0-100), malpractice audit trails, and manage recruiter database connection.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {portalTab === 'EVALUATIONS' && (
              <>
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh Data
                </button>
                <button
                  onClick={() => setShowAddCandidate(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-900/30 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Pre-Screened Candidate
                </button>
              </>
            )}
          </div>
        </div>

        {/* Master Portal View Switcher */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => setPortalTab('EVALUATIONS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              portalTab === 'EVALUATIONS'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Candidate Evaluations & Integrations</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950/80 font-mono text-cyan-300">
              {candidates.length} Registered
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPortalTab('QUESTIONS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              portalTab === 'QUESTIONS'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Question Bank Management (Stored in Database)</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950/80 font-mono text-cyan-300">
              Active Store
            </span>
          </button>
        </div>

        {portalTab === 'QUESTIONS' ? (
          <RecruiterQuestionManager />
        ) : (
          <>
            {/* Database Connection Settings Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                  <Database className="w-4 h-4 text-cyan-400" />
                  External Database / Webhook Link Configuration
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${
                      dbConfig.isConnected
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border-amber-800'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${dbConfig.isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {dbConfig.isConnected ? 'Connected to External DB' : 'Local Fallback Store Active'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveDbConfig} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-8">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Recruiter Database Endpoint URL (REST API / Webhook / DB Listener)
                  </label>
                  <input
                    type="text"
                    value={dbInputUrl}
                    onChange={(e) => setDbInputUrl(e.target.value)}
                    placeholder="e.g. https://your-recruiter-portal.com/api/technical-assessments/sync"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 text-xs font-mono"
                  />
                </div>
                <div className="md:col-span-4 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={testingDb}
                    className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {testingDb ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Database className="w-3.5 h-3.5" />
                    )}
                    Save & Test Connection
                  </button>
                  <button
                    type="button"
                    onClick={handleSyncAll}
                    disabled={syncingAll || !dbInputUrl}
                    className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition disabled:opacity-40 cursor-pointer flex items-center gap-1"
                    title="Sync all results to the external DB"
                  >
                    <Send className="w-3 h-3 text-cyan-400" />
                    Sync All
                  </button>
                </div>
              </form>

              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    testResult.success
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/60 border-rose-800 text-rose-300'
                  }`}
                >
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              {syncMessage && (
                <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-800 text-cyan-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{syncMessage}</span>
                </div>
              )}
            </div>

            {/* Stats Bento Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Total Candidates Evaluated</span>
                <div className="text-2xl font-black text-white font-mono">{stats.totalEvaluated}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[11px] font-mono text-emerald-400 uppercase">Passed (&ge; 70 Marks)</span>
                <div className="text-2xl font-black text-emerald-400 font-mono">{stats.passed}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[11px] font-mono text-amber-400 uppercase">Failed (&lt;70 Marks)</span>
                <div className="text-2xl font-black text-amber-400 font-mono">{stats.failed}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[11px] font-mono text-rose-400 uppercase">Terminated (Malpractice)</span>
                <div className="text-2xl font-black text-rose-400 font-mono">{stats.terminatedMalpractice}</div>
              </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1">
                {['ALL', 'PASS', 'FAIL', 'TERMINATED_MALPRACTICE'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      filterStatus === status
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {status === 'ALL' ? 'All Records' : status === 'TERMINATED_MALPRACTICE' ? 'Malpractice' : status}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search candidate name, ID, or role..."
                  className="pl-8 pr-4 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 w-full sm:w-64"
                />
              </div>
            </div>

            {/* Submissions & Scores Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Candidate</th>
                      <th className="py-3 px-4">Target Role</th>
                      <th className="py-3 px-4 text-center">Aptitude (80M)</th>
                      <th className="py-3 px-4 text-center">Coding (20M)</th>
                      <th className="py-3 px-4 text-center">Total Score</th>
                      <th className="py-3 px-4">Assessment Status</th>
                      <th className="py-3 px-4">Proctor Audit</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {filteredSubmissions.length > 0 ? (
                      filteredSubmissions.map((sub) => {
                        const isPass = sub.status === 'PASS';
                        const isTerm = sub.status === 'TERMINATED_MALPRACTICE';
                        return (
                          <tr key={sub.candidateId} className="hover:bg-slate-850/50 transition">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-white">{sub.candidateName}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{sub.candidateId} &bull; {sub.candidateEmail}</div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-300 max-w-[180px] truncate">
                              {sub.role}
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono font-bold text-cyan-400">
                              {sub.aptitudeScore} / 80
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono font-bold text-blue-400">
                              {sub.codingScore} / 20
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono text-sm font-black">
                              <span
                                className={`px-2 py-0.5 rounded ${
                                  isPass
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : isTerm
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                                }`}
                              >
                                {sub.totalScore} / 100
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] border ${
                                  isPass
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                    : isTerm
                                    ? 'bg-rose-950 text-rose-300 border-rose-800'
                                    : 'bg-amber-950/80 text-amber-300 border-amber-800'
                                }`}
                              >
                                {isPass && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                                {isTerm && <XCircle className="w-3 h-3 text-rose-400" />}
                                {sub.status === 'TERMINATED_MALPRACTICE' ? 'Terminated (Malpractice)' : sub.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-[11px]">
                              {sub.violations.length === 0 ? (
                                <span className="text-emerald-400 font-medium">Clean Record (0)</span>
                              ) : (
                                <span className="text-rose-400 font-medium">
                                  {sub.violations.length} Violation(s) Logged
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-2">
                              <button
                                onClick={() => setSelectedSubmission(sub)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer inline-flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                Details
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          No assessment results match current filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Inspector Drawer/Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono uppercase text-cyan-400 font-semibold">Candidate Assessment Dossier</span>
                <h3 className="text-xl font-bold text-white mt-0.5">{selectedSubmission.candidateName}</h3>
                <p className="text-xs text-slate-400">
                  {selectedSubmission.candidateId} &bull; {selectedSubmission.candidateEmail} &bull; {selectedSubmission.role}
                </p>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="text-slate-400 hover:text-white text-xs font-semibold p-1"
              >
                &times; Close
              </button>
            </div>

            {/* Score Breakdown */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block uppercase font-mono">Aptitude Score</span>
                <span className="text-xl font-bold text-cyan-400 font-mono">{selectedSubmission.aptitudeScore} / 80</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block uppercase font-mono">Coding Score</span>
                <span className="text-xl font-bold text-blue-400 font-mono">{selectedSubmission.codingScore} / 20</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block uppercase font-mono">Final Result</span>
                <span className="text-xl font-bold text-white font-mono">{selectedSubmission.totalScore} / 100</span>
              </div>
            </div>

            {/* Termination Reason if Malpractice */}
            {selectedSubmission.status === 'TERMINATED_MALPRACTICE' && (
              <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Malpractice Disqualification Reason:
                </div>
                <div className="font-mono text-[11px]">{selectedSubmission.terminationReason}</div>
              </div>
            )}

            {/* Proctoring Violations Log */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Proctoring Timeline Audit</h4>
              {selectedSubmission.violations.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedSubmission.violations.map((v) => (
                    <div key={v.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="font-bold text-rose-400 font-mono text-[11px] block">[{v.type}]</span>
                        <span className="text-slate-300 text-[11px]">{v.details}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                        {new Date(v.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-emerald-400 flex items-center gap-1.5 bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-900/60">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  No proctoring violations recorded. 100% integrity session.
                </div>
              )}
            </div>

            {/* Coding Submissions Preview */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Coding Solutions Submitted</h4>
              {Object.keys(selectedSubmission.codingSubmissions).length > 0 ? (
                Object.entries(selectedSubmission.codingSubmissions).map(([qId, sub]) => (
                  <div key={qId} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-300">{qId} ({sub.language})</span>
                      <span className="font-mono text-blue-400 font-bold">{sub.score} / 10 Marks ({sub.passedCases}/{sub.totalCases} tests passed)</span>
                    </div>
                    <pre className="text-[11px] font-mono text-slate-400 bg-black p-2.5 rounded-lg max-h-32 overflow-y-auto overflow-x-auto">
                      {sub.code || '// No code submitted'}
                    </pre>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 italic">No code submissions recorded.</div>
              )}
            </div>

            <div className="pt-2 flex justify-end items-center">
              <button
                onClick={() => setSelectedSubmission(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Pre-Screened Candidate Modal */}
      {showAddCandidate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div>
              <span className="text-xs font-mono uppercase text-cyan-400 font-semibold">Recruiter Screening Pipeline</span>
              <h3 className="text-lg font-bold text-white">Import Approved Candidate</h3>
              <p className="text-xs text-slate-400">
                Register a candidate who passed resume screening to authorize them for this technical assessment.
              </p>
            </div>

            <form onSubmit={handleAddCandidateSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Candidate Full Name</label>
                <input
                  type="text"
                  required
                  value={newCandidateForm.name}
                  onChange={(e) => setNewCandidateForm({ ...newCandidateForm, name: e.target.value })}
                  placeholder="e.g. Maya Patel"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Application Email</label>
                <input
                  type="email"
                  required
                  value={newCandidateForm.email}
                  onChange={(e) => setNewCandidateForm({ ...newCandidateForm, email: e.target.value })}
                  placeholder="e.g. maya.p@example.com"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Engineering Role</label>
                <input
                  type="text"
                  required
                  value={newCandidateForm.role}
                  onChange={(e) => setNewCandidateForm({ ...newCandidateForm, role: e.target.value })}
                  placeholder="e.g. Senior Backend Engineer"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Resume Screening Match Score (%)</label>
                <input
                  type="number"
                  min="60"
                  max="100"
                  value={newCandidateForm.screeningScore}
                  onChange={(e) => setNewCandidateForm({ ...newCandidateForm, screeningScore: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCandidate(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition shadow-md shadow-cyan-900/30 cursor-pointer"
                >
                  Authorize Candidate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
