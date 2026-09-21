/**
 * Milestone 20: Business & Multi-Tenant Management Types
 * Subscription Tier Modeling, Tenant Seat Allocation,
 * Token Quota Enforcement, and Cross-Tenant Isolation Safeguards.
 */

export type SubscriptionTier = 'free_spark' | 'pro_student' | 'educator_classroom' | 'institutional_enterprise';

export interface TierEntitlements {
  tier: SubscriptionTier;
  displayNameEn: string;
  displayNameAr: string;
  maxSeats: number;
  monthlyTokens: number;
  features: {
    customApiKeys: boolean;
    classroomAnalytics: boolean;
    differentiatedPlanner: boolean;
    institutionalRadar: boolean;
    kAnonymityReporting: boolean;
    dataExportGdpr: boolean;
    priorityReasoningRouting: boolean;
    slaGuaranteePercent: number;
  };
}

export type TenantStatus = 'active' | 'past_due' | 'suspended';

export interface TenantAccount {
  tenantId: string;
  name: string;
  tier: SubscriptionTier;
  activeSeats: number;
  seatLimit: number;
  monthlyTokenQuota: number;
  tokensConsumed: number;
  billingCycleStart: number;
  billingCycleEnd: number;
  status: TenantStatus;
}

export type TenantMemberRole = 'owner' | 'admin' | 'educator' | 'student';

export interface TenantMember {
  memberUid: string;
  tenantId: string;
  email: string;
  role: TenantMemberRole;
  assignedAt: number;
  status: 'active' | 'invited' | 'revoked';
}

export interface EntitlementCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface SeatAllocationResult {
  success: boolean;
  activeSeats: number;
  remainingSeats: number;
  message: string;
}

export interface TokenConsumptionResult {
  allowed: boolean;
  tokensConsumed: number;
  remainingTokens: number;
  overagePrevented: boolean;
}
