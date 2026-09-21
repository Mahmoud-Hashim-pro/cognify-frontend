/**
 * Milestone 22: Cognify Security & Threat Model Types
 * Defines comprehensive data contracts for:
 * - OWASP Top 10: 2025 Web Application Security
 * - OWASP API Security Top 10: 2023
 * - OWASP LLM Application Security Top 10: 2025
 * - Architectural Trust Boundaries & Isolation Layers
 */

export type TrustBoundary =
  | 'client_untrusted'       // Browser DOM, LocalStorage, untrusted user inputs
  | 'api_gateway'           // Vercel serverless HTTP edge, CORS, TLS termination
  | 'auth_guard'            // Firebase RS256 token verification, claims validation
  | 'intelligence_engine'   // StudentState, PLM, Pedagogical Orchestrator, In-Memory Caches
  | 'persistence_layer'     // Firestore, AES-256 encrypted CryptoShield storage
  | 'ai_provider_boundary'; // External AI endpoints (Google Gemini, Groq, NVIDIA, xAI)

export type OWASPWebCategory =
  | 'A01_BrokenAccessControl'
  | 'A02_CryptographicFailures'
  | 'A03_Injection'
  | 'A04_InsecureDesign'
  | 'A05_SecurityMisconfiguration'
  | 'A06_VulnerableAndOutdatedComponents'
  | 'A07_IdentificationAndAuthenticationFailures'
  | 'A08_SoftwareAndDataIntegrityFailures'
  | 'A09_SecurityLoggingAndMonitoringFailures'
  | 'A10_ServerSideRequestForgery';

export type OWASPAPICategory =
  | 'API1_BOLA'
  | 'API2_BrokenAuthentication'
  | 'API3_BOPLA'
  | 'API4_UnrestrictedResourceConsumption'
  | 'API5_BFLA'
  | 'API6_UnrestrictedAccessToSensitiveBusinessFlows'
  | 'API7_SSRF'
  | 'API8_SecurityMisconfiguration'
  | 'API9_ImproperInventoryManagement'
  | 'API10_UnsafeConsumptionOfAPIs';

export type OWASPLLMCategory =
  | 'LLM01_PromptInjection'
  | 'LLM02_SensitiveInformationDisclosure'
  | 'LLM03_SupplyChainVulnerabilities'
  | 'LLM04_DataAndModelPoisoning'
  | 'LLM05_ImproperOutputHandling'
  | 'LLM06_ExcessiveAgency'
  | 'LLM07_SystemPromptLeakage'
  | 'LLM08_VectorAndEmbeddingWeaknesses'
  | 'LLM09_Misinformation'
  | 'LLM10_UnboundedConsumption';

export type ThreatSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export type ThreatAuditStatus = 'PASS' | 'FAIL' | 'MITIGATED';

export interface ThreatAuditFinding {
  id: string;
  category: string;
  framework: 'OWASP_WEB_2025' | 'OWASP_API_2023' | 'OWASP_LLM_2025' | 'PRIVACY_ISOLATION';
  severity: ThreatSeverity;
  status: ThreatAuditStatus;
  boundary: TrustBoundary;
  description: string;
  mitigation: string;
  evidence: string;
}

export interface SecurityThreatModelReport {
  auditDate: string;
  targetEnvironment: 'production' | 'staging' | 'development';
  overallStatus: 'SECURE_HARDENED' | 'ACTION_REQUIRED';
  complianceScore: number; // 0 - 100
  trustBoundariesEnforced: number;
  totalChecks: number;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    passed: number;
    mitigated: number;
    failed: number;
  };
  findings: ThreatAuditFinding[];
}

export interface BOLAValidationAttempt {
  authenticatedUid: string;
  targetUid: string;
  resourceType: 'learning_profile' | 'spatial_memory' | 'student_state' | 'chat_history';
  action: 'read' | 'write' | 'delete';
}

export interface BOLAValidationResult {
  allowed: boolean;
  violationDetected: boolean;
  statusCode: 200 | 401 | 403;
  reason?: string;
}
