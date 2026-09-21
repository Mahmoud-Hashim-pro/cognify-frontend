import React, { useState, useMemo } from 'react';
import {
  Shield,
  Download,
  Trash2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Key,
  FileCheck
} from 'lucide-react';
import type { StudentState } from '../types/studentState';
import {
  applyDifferentialPrivacy,
  createDefaultDPBudget,
  packageStudentExport,
  executeCascadeErasure,
  createAuditEntry,
  verifyAuditChain,
  GENESIS_PREV_HASH,
  sha256
} from '../lib/privacySecurityEngine';
import type { AuditLogEntry, CascadeErasureManifest } from '../types/privacySecurity';

interface PrivacySecurityCenterProps {
  currentStudent?: StudentState;
  isArabic?: boolean;
}

export const PrivacySecurityCenter: React.FC<PrivacySecurityCenterProps> = ({
  currentStudent,
  isArabic = false
}) => {
  const [activeTab, setActiveTab] = useState<'dp' | 'export' | 'erasure' | 'audit'>('dp');

  // Differential Privacy State
  const [epsilon, setEpsilon] = useState<number>(0.5);
  const [testMetric, setTestMetric] = useState<number>(75);
  const [dpBudget, setDpBudget] = useState(() => createDefaultDPBudget(10.0));
  const [lastPerturbation, setLastPerturbation] = useState<{
    perturbed: number;
    noise: number;
  } | null>(null);

  // Export State
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [exportChecksum, setExportChecksum] = useState<string | null>(null);

  // Erasure State
  const [erasureConfirmed, setErasureConfirmed] = useState(false);
  const [erasureManifest, setErasureManifest] = useState<CascadeErasureManifest | null>(null);

  // Audit Log State
  const [auditChain, setAuditChain] = useState<AuditLogEntry[]>(() => {
    const t0 = Date.now() - 60000;
    const e1 = createAuditEntry('admin_root', 'SECURITY_SCAN', 'system', { scan: 'daily_integrity' }, GENESIS_PREV_HASH, t0);
    const e2 = createAuditEntry('system_auth', 'PROFILE_UPDATE', currentStudent?.uid || 'student_demo', { field: 'cognitiveStage' }, e1.entryHash, t0 + 15000);
    return [e1, e2];
  });
  const [chainTampered, setChainTampered] = useState(false);

  // Mock Student State Fallback
  const activeStudent: StudentState = useMemo(() => {
    if (currentStudent) return currentStudent;
    return {
      uid: 'student_48291',
      cognitiveStage: 'proficient',
      activePedagogy: 'worked_example',
      pedagogyEffectiveness: {
        analogies: { helpfulCount: 12, unhelpfulCount: 2, score: 0.85 },
        scaffolded: { helpfulCount: 9, unhelpfulCount: 3, score: 0.75 },
        worked_example: { helpfulCount: 18, unhelpfulCount: 1, score: 0.94 },
        socratic: { helpfulCount: 8, unhelpfulCount: 4, score: 0.67 },
        advanced_rigor: { helpfulCount: 5, unhelpfulCount: 5, score: 0.5 }
      },
      learningStrain: {
        possibleStruggle: 0.2,
        confidence: 0.8,
        signals: []
      },
      struggleSignal: 0.2,
      cognitiveLoadScore: 0.2,
      conceptMastery: {
        c_pointers: {
          conceptId: 'c_pointers',
          accuracy: 0.72,
          attempts: 15,
          correct: 11,
          confidence: 0.8,
          consecutiveCorrect: 3,
          consecutiveIncorrect: 0,
          lastTested: Date.now(),
          mistakeTypes: ['memory_leak']
        }
      },
      retentionSchedules: {},
      activeInterventions: {},
      totalExercisesCompleted: 42,
      lastActiveTimestamp: Date.now()
    };
  }, [currentStudent]);

  // Handle Differential Privacy Perturbation
  const handleApplyDP = () => {
    try {
      const result = applyDifferentialPrivacy(
        testMetric,
        {
          epsilon,
          sensitivity: 1.0,
          minBounds: 0,
          maxBounds: 100
        },
        dpBudget
      );
      setLastPerturbation({ perturbed: result.perturbedValue, noise: result.noiseAdded });
      setDpBudget({ ...dpBudget });

      // Add to audit trail
      const lastEntry = auditChain[auditChain.length - 1];
      const prevH = lastEntry ? lastEntry.entryHash : GENESIS_PREV_HASH;
      const auditEntry = createAuditEntry(
        'analyst_user',
        'DP_QUERY',
        'cohort_analytics',
        { epsilon, raw: testMetric, perturbed: result.perturbedValue },
        prevH
      );
      setAuditChain(prev => [...prev, auditEntry]);
    } catch (err: any) {
      alert(err.message || 'DP Budget Error');
    }
  };

  // Handle Export Generation
  const handleGenerateExport = () => {
    const pkg = packageStudentExport(activeStudent, {
      learningEventsCount: 148,
      spatialMemoriesCount: 12,
      presenceStatus: 'active'
    });
    setExportJson(JSON.stringify(pkg, null, 2));
    setExportChecksum(pkg.integrityChecksum);

    // Audit log
    const lastEntry = auditChain[auditChain.length - 1];
    const prevH = lastEntry ? lastEntry.entryHash : GENESIS_PREV_HASH;
    const auditEntry = createAuditEntry(
      activeStudent.uid,
      'DATA_EXPORT',
      activeStudent.uid,
      { exportId: pkg.exportId, checksum: pkg.integrityChecksum },
      prevH
    );
    setAuditChain(prev => [...prev, auditEntry]);
  };

  // Handle Cascade Erasure
  const handleExecuteErasure = () => {
    const manifest = executeCascadeErasure({
      requestId: 'req_gdpr_' + Date.now(),
      studentUid: activeStudent.uid,
      requestedAt: Date.now(),
      confirmedByActor: activeStudent.uid,
      reason: 'gdpr_article_17'
    });
    setErasureManifest(manifest);
    setErasureConfirmed(false);

    // Audit log
    const lastEntry = auditChain[auditChain.length - 1];
    const prevH = lastEntry ? lastEntry.entryHash : GENESIS_PREV_HASH;
    const auditEntry = createAuditEntry(
      'compliance_officer',
      'CASCADE_ERASURE',
      activeStudent.uid,
      { receiptHash: manifest.receiptHash },
      prevH
    );
    setAuditChain(prev => [...prev, auditEntry]);
  };

  // Tamper verification
  const auditVerification = useMemo(() => {
    return verifyAuditChain(auditChain);
  }, [auditChain]);

  const simulateTampering = () => {
    if (auditChain.length > 1) {
      const copy = [...auditChain];
      // Tamper with payload digest of the middle entry
      copy[1] = {
        ...copy[1],
        payloadDigest: sha256('MALICIOUS_TAMPERED_PAYLOAD_' + Math.random())
      };
      setAuditChain(copy);
      setChainTampered(true);
    }
  };

  const repairChain = () => {
    // Recompute valid hashes
    const copy = [...auditChain];
    for (let i = 0; i < copy.length; i++) {
      const prevH = i === 0 ? GENESIS_PREV_HASH : copy[i - 1].entryHash;
      copy[i] = {
        ...copy[i],
        prevHash: prevH,
        entryHash: sha256(`${prevH}:${copy[i].timestamp}:${copy[i].action}:${copy[i].actorUid}:${copy[i].targetUid}:${copy[i].payloadDigest}`)
      };
    }
    setAuditChain(copy);
    setChainTampered(false);
  };

  return (
    <div className="w-full min-h-screen bg-[#0A0C14] text-slate-100 p-4 sm:p-8 font-sans relative">
      {/* Background glow ambiance */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Header Cockpit */}
        <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
                  <Shield className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    {isArabic ? 'مركز ذكاء الخصوصية والأمان' : 'Privacy & Security Intelligence'}
                  </h1>
                  <p className="text-sm text-slate-400 mt-1">
                    {isArabic
                      ? 'الخصوصية التفاضلية، محو البيانات الشامل GDPR/FERPA، وسجل تدقيق غير قابل للتلاعب'
                      : 'Epsilon-Differential Privacy, GDPR Article 17 Cascade Erasure, and Cryptographic Chained Audit Logging'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Lock className="w-3.5 h-3.5" /> FERPA / GDPR Compliant
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Cpu className="w-3.5 h-3.5" /> SHA-256 Guarded
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 mt-8 border-b border-slate-800 pb-4">
            {[
              { id: 'dp', label: isArabic ? 'الخصوصية التفاضلية' : 'Differential Privacy', icon: Cpu },
              { id: 'export', label: isArabic ? 'تصدير البيانات المستقل' : 'Self-Service Export', icon: Download },
              { id: 'erasure', label: isArabic ? 'محو البيانات (الحق في النسيان)' : 'Cascade Erasure', icon: Trash2 },
              { id: 'audit', label: isArabic ? 'سجل التدقيق المشفر' : 'Chained Audit Trail', icon: FileCheck }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20'
                      : 'bg-[#0A0C14] text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 1: Differential Privacy Simulator */}
        {activeTab === 'dp' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-cyan-400" />
                  {isArabic ? 'محاكي الخصوصية التفاضلية (Laplace Mechanism)' : 'Laplace Mechanism Simulator'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Perturbs raw aggregate analytics with controlled calibrated noise ($b = \Delta f / \epsilon$) so individual student records can never be reconstructed.
                </p>
              </div>

              {/* Metric Input & Epsilon Slider */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1 text-slate-300">
                    <span>Target Metric Value (e.g. Class Pointers Mastery %)</span>
                    <span className="text-cyan-400 font-mono">{testMetric}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={testMetric}
                    onChange={e => setTestMetric(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1 text-slate-300">
                    <span>Privacy Parameter ($\epsilon$): Smaller = More Noise / Greater Privacy</span>
                    <span className="text-cyan-400 font-mono">ε = {epsilon}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={epsilon}
                    onChange={e => setEpsilon(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>0.1 (High Anonymity / Strong Noise)</span>
                    <span>2.0 (High Precision / Low Noise)</span>
                  </div>
                </div>

                <button
                  onClick={handleApplyDP}
                  className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold rounded-2xl hover:opacity-95 transition shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {isArabic ? 'تطبيق ضوضاء الخصوصية وخصم الميزانية' : 'Apply Laplace Noise & Query Anonymized Aggregate'}
                </button>
              </div>

              {/* Perturbation Result Box */}
              {lastPerturbation && (
                <div className="p-4 bg-[#0A0C14] border border-cyan-500/30 rounded-2xl grid grid-cols-3 gap-4 text-center">
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase font-bold block">Raw True Value</span>
                    <span className="text-xl font-bold font-mono text-slate-200">{testMetric}%</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-cyan-400 uppercase font-bold block">Laplace Noise</span>
                    <span className={`text-xl font-bold font-mono ${lastPerturbation.noise >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {lastPerturbation.noise > 0 ? `+${lastPerturbation.noise}` : lastPerturbation.noise}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-emerald-400 uppercase font-bold block">DP Published Value</span>
                    <span className="text-xl font-bold font-mono text-white">{lastPerturbation.perturbed}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* DP Budget Card */}
            <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between">
              <div>
                <h3 className="text-md font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-400" />
                  {isArabic ? 'ميزانية الخصوصية الإجمالية' : 'Differential Privacy Budget'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Limits aggregate queries to prevent cumulative database reconstruction attacks.
                </p>

                <div className="mt-6 space-y-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400">Remaining Budget</span>
                    <span className="text-2xl font-bold font-mono text-cyan-400">
                      {dpBudget.remainingBudget.toFixed(2)} / {dpBudget.totalBudget.toFixed(1)} ε
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        dpBudget.remainingBudget > 4
                          ? 'bg-emerald-500'
                          : dpBudget.remainingBudget > 1.5
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${(dpBudget.remainingBudget / dpBudget.totalBudget) * 100}%` }}
                    />
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Consumed Budget:</span>
                      <span className="font-mono text-white">{dpBudget.consumedBudget.toFixed(2)} ε</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Executed Queries:</span>
                      <span className="font-mono text-white">{dpBudget.queryLog.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setDpBudget(createDefaultDPBudget(10.0))}
                className="mt-6 w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reset Privacy Epoch Budget
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Self-Service Data Export */}
        {activeTab === 'export' && (
          <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Download className="w-5 h-5 text-cyan-400" />
                  {isArabic ? 'تصدير البيانات الشخصية (GDPR Article 20)' : 'Self-Service Data Portability'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Export complete student history: state, cognitive stage, concept mastery, spaced retention, and spatial memories in signed JSON.
                </p>
              </div>

              <button
                onClick={handleGenerateExport}
                className="py-2.5 px-5 bg-cyan-500 text-slate-950 font-bold rounded-2xl hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20 flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                {isArabic ? 'إنشاء حزمة التصدير الآن' : 'Generate Export Package'}
              </button>
            </div>

            {exportChecksum && (
              <div className="p-4 bg-[#0A0C14] border border-emerald-500/30 rounded-2xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="overflow-hidden">
                  <span className="text-xs text-slate-400 block font-semibold">Package SHA-256 Integrity Checksum</span>
                  <span className="text-xs font-mono text-emerald-400 break-all">{exportChecksum}</span>
                </div>
              </div>
            )}

            {exportJson && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Export Package Preview</span>
                  <button
                    onClick={() => {
                      const blob = new Blob([exportJson], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `cognify_export_${activeStudent.uid}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-cyan-400 hover:underline font-semibold"
                  >
                    Download .json file
                  </button>
                </div>
                <pre className="p-4 bg-[#0A0C14] border border-slate-800 rounded-2xl text-xs font-mono text-slate-300 max-h-72 overflow-y-auto">
                  {exportJson}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Cascade Erasure */}
        {activeTab === 'erasure' && (
          <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                {isArabic ? 'الحق في المحو الكامل (GDPR Article 17)' : 'Right to be Forgotten (Cascade Erasure)'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Irreversibly deletes student state, cascades redactions across event logs, wipes spatial 2.0 object memories, and issues a cryptographic receipt.
              </p>
            </div>

            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-200 leading-relaxed">
                <strong>Permanent Cascade Warning:</strong> Initiating this action triggers cascade erasure across all learning databases. Chat logs, cognitive stage vectors, mastery profiles, and personal spatial memory files will be permanently purged.
              </div>
            </div>

            {!erasureManifest ? (
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={erasureConfirmed}
                    onChange={e => setErasureConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                  />
                  <span>
                    I confirm that I want to irrevocably erase all data for student <code className="text-white font-mono">{activeStudent.uid}</code>.
                  </span>
                </label>

                <button
                  disabled={!erasureConfirmed}
                  onClick={handleExecuteErasure}
                  className={`py-3 px-6 rounded-2xl font-bold text-sm transition flex items-center gap-2 ${
                    erasureConfirmed
                      ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/25 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  {isArabic ? 'تنفيذ المحو الشامل وإصدار الإيصال المشفر' : 'Execute Cascade Erasure & Generate Receipt'}
                </button>
              </div>
            ) : (
              <div className="p-6 bg-[#0A0C14] border border-emerald-500/30 rounded-2xl space-y-4">
                <div className="flex items-center gap-3 text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                  <h4 className="text-base font-bold">Cascade Erasure Successfully Completed</h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-[#121524] rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold">Profile Wiped</span>
                    <span className="text-sm font-bold text-emerald-400">Yes</span>
                  </div>
                  <div className="p-3 bg-[#121524] rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold">Events Redacted</span>
                    <span className="text-sm font-bold text-emerald-400">{erasureManifest.recordsWiped.learningEventsRedacted}</span>
                  </div>
                  <div className="p-3 bg-[#121524] rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold">Spatial Memories</span>
                    <span className="text-sm font-bold text-emerald-400">{erasureManifest.recordsWiped.spatialMemoriesWiped}</span>
                  </div>
                  <div className="p-3 bg-[#121524] rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold">Presence Cleaned</span>
                    <span className="text-sm font-bold text-emerald-400">Yes</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-semibold">Cryptographic Erasure Receipt Hash</span>
                  <span className="text-xs font-mono text-cyan-400 break-all">{erasureManifest.receiptHash}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Tamper-Resistant Audit Trail */}
        {activeTab === 'audit' && (
          <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-cyan-400" />
                  {isArabic ? 'سجل التدقيق المشفر بالسلاسل' : 'Tamper-Resistant Chained Audit Trail'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Every security action is cryptographically chained to previous entries via SHA-256 block hashing.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!chainTampered ? (
                  <button
                    onClick={simulateTampering}
                    className="py-2 px-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition"
                  >
                    Simulate Tampering Attack
                  </button>
                ) : (
                  <button
                    onClick={repairChain}
                    className="py-2 px-3.5 bg-cyan-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-cyan-400 transition"
                  >
                    Restore & Recalculate Chain
                  </button>
                )}
              </div>
            </div>

            {/* Live Chain Verification Status Badge */}
            <div
              className={`p-4 rounded-2xl border flex items-center gap-3 ${
                auditVerification.isValid
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {auditVerification.isValid ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0" />
              )}
              <div className="text-xs">
                <strong>Chain Integrity Status: </strong>
                {auditVerification.isValid ? (
                  <span>Verified Unbroken ({auditChain.length} blocks checked, 0 anomalies detected)</span>
                ) : (
                  <span>Tampering Detected! {auditVerification.brokenReason}</span>
                )}
              </div>
            </div>

            {/* Audit Chain Cards */}
            <div className="space-y-3">
              {auditChain.map((entry, index) => (
                <div
                  key={entry.id}
                  className="p-4 bg-[#0A0C14] border border-slate-800 rounded-2xl hover:border-slate-700 transition space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-cyan-400 font-mono font-bold">
                        Block #{index}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-semibold">
                        {entry.action}
                      </span>
                      <span className="text-slate-400 font-mono">actor: {entry.actorUid}</span>
                    </div>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="truncate">
                      <span className="text-slate-500">prevHash: </span>
                      <span className="text-slate-400">{entry.prevHash.slice(0, 24)}...</span>
                    </div>
                    <div className="truncate">
                      <span className="text-slate-500">entryHash: </span>
                      <span className="text-cyan-400">{entry.entryHash.slice(0, 24)}...</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrivacySecurityCenter;
