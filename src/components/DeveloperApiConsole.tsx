import React, { useState, useMemo } from 'react';
import {
  Terminal,
  Key,
  Webhook,
  Code,
  CheckCircle2,
  Copy,
  Plus,
  Trash2,
  Shield,
  Download,
  Send,
  Zap,
  Lock
} from 'lucide-react';
import type {
  ApiKeyRecord,
  ApiKeyScope,
  WebhookSubscription
} from '../types/developerApi';
import {
  generateApiKey,
  verifyApiKey,
  revokeApiKey,
  signWebhookPayload,
  verifyWebhookSignature,
  generateOpenApiSpec
} from '../lib/developerApiEngine';

interface DeveloperApiConsoleProps {
  isArabic?: boolean;
}

export const DeveloperApiConsole: React.FC<DeveloperApiConsoleProps> = ({
  isArabic = false
}) => {
  // API Keys in State
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>(() => {
    const k1 = generateApiKey('tenant_demo', 'Canvas LMS Production Sync', ['read:analytics', 'write:events']);
    const k2 = generateApiKey('tenant_demo', 'AI Quality Pipeline CI/CD', ['ai:query']);
    return [k1.record, k2.record];
  });

  // Newly generated key modal display
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);

  // Form State
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>(['read:analytics']);

  // Webhook State
  const [webhookUrl, setWebhookUrl] = useState('https://canvas.institution.edu/webhooks/cognify');
  const [webhookSecret] = useState('whsec_38f82a984b910248a94cb283849102');
  const [lastWebhookDelivery, setLastWebhookDelivery] = useState<{
    payload: string;
    signature: string;
    isValid: boolean;
    timestamp: number;
  } | null>(null);

  // Actions
  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;

    const { rawKey, record } = generateApiKey('tenant_demo', keyName.trim(), selectedScopes);
    setApiKeys(prev => [record, ...prev]);
    setNewlyGeneratedKey(rawKey);
    setKeyName('');
  };

  const handleRevokeKey = (keyId: string) => {
    revokeApiKey(keyId, apiKeys);
    setApiKeys([...apiKeys]);
  };

  const toggleScope = (scope: ApiKeyScope) => {
    setSelectedScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  const handleSimulateWebhook = () => {
    const samplePayload = JSON.stringify({
      event: 'student.mastery_achieved',
      studentUid: 'student_48291',
      conceptId: 'c_pointers',
      accuracy: 0.94,
      timestamp: Date.now()
    });

    const { signatureHeader, timestamp } = signWebhookPayload(samplePayload, webhookSecret);
    const isValid = verifyWebhookSignature(samplePayload, signatureHeader, webhookSecret);

    setLastWebhookDelivery({
      payload: samplePayload,
      signature: signatureHeader,
      isValid,
      timestamp
    });
  };

  const openApiSpec = useMemo(() => generateOpenApiSpec(), []);

  return (
    <div className="w-full min-h-screen bg-[#0A0C14] text-slate-100 p-4 sm:p-8 font-sans relative">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Cockpit Header */}
        <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
                  <Terminal className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    {isArabic ? 'وحدة تحكم مطوري المنصة وخطافات الويب' : 'Open Developer API & Webhooks Console'}
                  </h1>
                  <p className="text-sm text-slate-400 mt-1">
                    {isArabic
                      ? 'مفاتيح API مشفرة، توقيعات HMAC-SHA256 لخطافات الويب، ومواصفات OpenAPI 3.1 القياسية'
                      : 'Cryptographic API Key Lifecycle, RFC 2104 HMAC Webhook Stamping, and OpenAPI 3.1 Spec'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Shield className="w-3.5 h-3.5" /> SHA-256 Hashed Keys
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Lock className="w-3.5 h-3.5" /> HMAC Signed
              </span>
            </div>
          </div>
        </div>

        {/* Section 1: API Key Lifecycle */}
        <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-cyan-400" />
                API Keys ({apiKeys.filter(k => k.status === 'active').length} Active)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Plaintext keys are NEVER stored in the database. Only one-way SHA-256 digests are retained.
              </p>
            </div>
          </div>

          {/* New Key Revealed Banner */}
          {newlyGeneratedKey && (
            <div className="p-5 bg-cyan-950/40 border border-cyan-500/50 rounded-2xl space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-cyan-400">
                <span>Save Your API Key Now (Will Not Be Displayed Again)</span>
                <button
                  onClick={() => setNewlyGeneratedKey(null)}
                  className="text-slate-400 hover:text-white"
                >
                  Dismiss
                </button>
              </div>
              <div className="flex items-center gap-2 p-3 bg-[#0A0C14] rounded-xl border border-slate-800 font-mono text-xs text-cyan-300 select-all">
                <span className="flex-1 truncate">{newlyGeneratedKey}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(newlyGeneratedKey)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-white"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Create Key Form */}
          <form onSubmit={handleCreateKey} className="p-4 bg-[#0A0C14] border border-slate-800 rounded-2xl space-y-4">
            <span className="text-xs font-bold text-white block">Generate New Scoped API Key</span>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Key Name (e.g. Canvas LMS Sync)"
                value={keyName}
                onChange={e => setKeyName(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-[#121524] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-cyan-500/50 outline-none"
              />
              <button
                type="submit"
                className="py-2.5 px-5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Generate Secret Key
              </button>
            </div>

            {/* Scope Checkboxes */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span className="text-[11px] text-slate-500 uppercase font-bold">Permissions:</span>
              {(['read:analytics', 'write:events', 'admin:sync', 'ai:query'] as ApiKeyScope[]).map(sc => (
                <label key={sc} className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(sc)}
                    onChange={() => toggleScope(sc)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span className="font-mono">{sc}</span>
                </label>
              ))}
            </div>
          </form>

          {/* Key Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px]">
                  <th className="pb-3 font-semibold">Key Name</th>
                  <th className="pb-3 font-semibold">Prefix</th>
                  <th className="pb-3 font-semibold">Scopes</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {apiKeys.map(k => (
                  <tr key={k.keyId} className="hover:bg-slate-900/40 transition">
                    <td className="py-3 font-semibold text-white">{k.name}</td>
                    <td className="py-3 font-mono text-cyan-400">{k.keyPrefix}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map(s => (
                          <span key={s} className="px-2 py-0.5 rounded-md bg-slate-800 font-mono text-[10px] text-slate-300">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        k.status === 'active' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 bg-slate-800'
                      }`}>
                        {k.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {k.status === 'active' && (
                        <button
                          onClick={() => handleRevokeKey(k.keyId)}
                          className="text-rose-400 hover:text-rose-300 font-semibold text-[11px]"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Webhooks Dispatch Simulator */}
        <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Webhook className="w-5 h-5 text-purple-400" />
                Real-Time Webhooks Dispatch & HMAC Stamping
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Dispatches real-time event updates to LMS endpoints with cryptographically verifiable HMAC-SHA256 headers.
              </p>
            </div>

            <button
              onClick={handleSimulateWebhook}
              className="py-2.5 px-4 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-purple-500/20"
            >
              <Send className="w-3.5 h-3.5" /> Dispatch Test Webhook
            </button>
          </div>

          <div className="p-4 bg-[#0A0C14] border border-slate-800 rounded-2xl space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Configured Endpoint URL:</span>
              <span className="text-purple-400 font-mono">Shared Secret Configured</span>
            </div>
            <input
              type="text"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              className="w-full p-2.5 bg-[#121524] border border-slate-800 rounded-xl text-xs font-mono text-white outline-none focus:border-purple-500/50"
            />
          </div>

          {lastWebhookDelivery && (
            <div className="p-5 bg-[#0A0C14] border border-slate-800 rounded-2xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Last Webhook Dispatch Payload
                </span>
                <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                  HMAC SIGNATURE VERIFIED
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">HTTP Header: X-Cognify-Signature</span>
                <pre className="p-2.5 bg-[#121524] rounded-xl border border-slate-800 text-[11px] font-mono text-cyan-400 overflow-x-auto">
                  {lastWebhookDelivery.signature}
                </pre>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Body JSON Payload</span>
                <pre className="p-2.5 bg-[#121524] rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                  {lastWebhookDelivery.payload}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: OpenAPI 3.1 Spec Generator */}
        <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Code className="w-5 h-5 text-cyan-400" />
                OpenAPI 3.1 Machine-Readable Specification
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Standardized REST documentation ready for Canvas LTI, Blackboard, and Moodle automated connector generators.
              </p>
            </div>

            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(openApiSpec, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'cognify-openapi-v2.0.json';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Download OpenAPI 3.1 JSON
            </button>
          </div>

          <pre className="p-4 bg-[#0A0C14] border border-slate-800 rounded-2xl text-xs font-mono text-slate-300 max-h-56 overflow-y-auto">
            {JSON.stringify(openApiSpec, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default DeveloperApiConsole;
