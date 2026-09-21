/**
 * Milestone 20: Business & Multi-Tenant Management Engine
 * Subscription Tier Matrix, Seat Allocation Enforcement,
 * Token Quotas, and Cross-Tenant Data Isolation Guard.
 */

import type {
  SubscriptionTier,
  TierEntitlements,
  TenantAccount,
  TenantMember,
  TenantMemberRole,
  EntitlementCheckResult,
  SeatAllocationResult,
  TokenConsumptionResult
} from '../types/businessTenancy';

// ============================================================================
// 1. Subscription Tier Matrix
// ============================================================================

export const TIER_ENTITLEMENT_MATRIX: Record<SubscriptionTier, TierEntitlements> = {
  free_spark: {
    tier: 'free_spark',
    displayNameEn: 'Spark Free Tier',
    displayNameAr: 'باقة سبارك المجانية',
    maxSeats: 1,
    monthlyTokens: 250000,
    features: {
      customApiKeys: false,
      classroomAnalytics: false,
      differentiatedPlanner: false,
      institutionalRadar: false,
      kAnonymityReporting: false,
      dataExportGdpr: true,
      priorityReasoningRouting: false,
      slaGuaranteePercent: 0
    }
  },
  pro_student: {
    tier: 'pro_student',
    displayNameEn: 'Pro Scholar',
    displayNameAr: 'باحث محترف',
    maxSeats: 1,
    monthlyTokens: 2000000,
    features: {
      customApiKeys: true,
      classroomAnalytics: false,
      differentiatedPlanner: false,
      institutionalRadar: false,
      kAnonymityReporting: false,
      dataExportGdpr: true,
      priorityReasoningRouting: true,
      slaGuaranteePercent: 99.5
    }
  },
  educator_classroom: {
    tier: 'educator_classroom',
    displayNameEn: 'Educator Classroom',
    displayNameAr: 'الفصل التعليمي للمعلمين',
    maxSeats: 35,
    monthlyTokens: 10000000,
    features: {
      customApiKeys: true,
      classroomAnalytics: true,
      differentiatedPlanner: true,
      institutionalRadar: false,
      kAnonymityReporting: false,
      dataExportGdpr: true,
      priorityReasoningRouting: true,
      slaGuaranteePercent: 99.9
    }
  },
  institutional_enterprise: {
    tier: 'institutional_enterprise',
    displayNameEn: 'University Enterprise',
    displayNameAr: 'المؤسسة الجامعية المتقدمة',
    maxSeats: 5000,
    monthlyTokens: 100000000,
    features: {
      customApiKeys: true,
      classroomAnalytics: true,
      differentiatedPlanner: true,
      institutionalRadar: true,
      kAnonymityReporting: true,
      dataExportGdpr: true,
      priorityReasoningRouting: true,
      slaGuaranteePercent: 99.99
    }
  }
};

// ============================================================================
// 2. Tenant Account Factory
// ============================================================================

export function createTenantAccount(
  tenantId: string,
  name: string,
  tier: SubscriptionTier = 'free_spark'
): TenantAccount {
  const spec = TIER_ENTITLEMENT_MATRIX[tier];
  const now = Date.now();
  return {
    tenantId,
    name,
    tier,
    activeSeats: 1,
    seatLimit: spec.maxSeats,
    monthlyTokenQuota: spec.monthlyTokens,
    tokensConsumed: 0,
    billingCycleStart: now,
    billingCycleEnd: now + (30 * 86400000),
    status: 'active'
  };
}

// ============================================================================
// 3. Entitlement Checks
// ============================================================================

export function checkFeatureEntitlement(
  tenant: TenantAccount,
  featureKey: keyof TierEntitlements['features']
): EntitlementCheckResult {
  if (tenant.status !== 'active') {
    return {
      allowed: false,
      reason: `Tenant account status is '${tenant.status}'. Active subscription required.`
    };
  }

  const entitlements = TIER_ENTITLEMENT_MATRIX[tenant.tier];
  if (!entitlements) {
    return { allowed: false, reason: `Unknown subscription tier: ${tenant.tier}` };
  }

  const isEnabled = entitlements.features[featureKey];
  if (!isEnabled) {
    return {
      allowed: false,
      reason: `Feature '${featureKey}' is not included in ${entitlements.displayNameEn}. Please upgrade your tier.`
    };
  }

  return { allowed: true };
}

// ============================================================================
// 4. Seat Allocation Enforcement
// ============================================================================

export function assignSeat(
  tenant: TenantAccount,
  memberUid: string,
  email: string,
  role: TenantMemberRole,
  existingMembers: TenantMember[]
): { result: SeatAllocationResult; newMember?: TenantMember } {
  if (tenant.status !== 'active') {
    return {
      result: {
        success: false,
        activeSeats: tenant.activeSeats,
        remainingSeats: Math.max(0, tenant.seatLimit - tenant.activeSeats),
        message: 'Cannot assign seat to inactive or past_due tenant'
      }
    };
  }

  // Check if member already has active seat
  const existing = existingMembers.find(m => m.memberUid === memberUid && m.status === 'active');
  if (existing) {
    return {
      result: {
        success: true,
        activeSeats: tenant.activeSeats,
        remainingSeats: Math.max(0, tenant.seatLimit - tenant.activeSeats),
        message: 'User already holds an active seat'
      },
      newMember: existing
    };
  }

  if (tenant.activeSeats >= tenant.seatLimit) {
    return {
      result: {
        success: false,
        activeSeats: tenant.activeSeats,
        remainingSeats: 0,
        message: `Seat limit reached (${tenant.activeSeats}/${tenant.seatLimit}). Upgrade subscription to add more members.`
      }
    };
  }

  // Allocate seat
  tenant.activeSeats++;
  const newMember: TenantMember = {
    memberUid,
    tenantId: tenant.tenantId,
    email,
    role,
    assignedAt: Date.now(),
    status: 'active'
  };

  return {
    result: {
      success: true,
      activeSeats: tenant.activeSeats,
      remainingSeats: tenant.seatLimit - tenant.activeSeats,
      message: 'Seat allocated successfully'
    },
    newMember
  };
}

export function revokeSeat(
  tenant: TenantAccount,
  memberUid: string,
  existingMembers: TenantMember[]
): { success: boolean; activeSeats: number } {
  const member = existingMembers.find(m => m.memberUid === memberUid && m.status === 'active');
  if (!member) {
    return { success: false, activeSeats: tenant.activeSeats };
  }

  member.status = 'revoked';
  tenant.activeSeats = Math.max(1, tenant.activeSeats - 1);
  return { success: true, activeSeats: tenant.activeSeats };
}

// ============================================================================
// 5. Token Quota Enforcement
// ============================================================================

export function recordTokenConsumption(
  tenant: TenantAccount,
  tokens: number
): TokenConsumptionResult {
  if (tenant.tokensConsumed + tokens > tenant.monthlyTokenQuota) {
    return {
      allowed: false,
      tokensConsumed: tenant.tokensConsumed,
      remainingTokens: Math.max(0, tenant.monthlyTokenQuota - tenant.tokensConsumed),
      overagePrevented: true
    };
  }

  tenant.tokensConsumed += tokens;
  return {
    allowed: true,
    tokensConsumed: tenant.tokensConsumed,
    remainingTokens: tenant.monthlyTokenQuota - tenant.tokensConsumed,
    overagePrevented: false
  };
}

// ============================================================================
// 6. Cross-Tenant Data Isolation Guard
// ============================================================================

export function filterByTenantIsolation<T extends { tenantId: string }>(
  records: T[],
  currentTenantId: string
): T[] {
  if (!currentTenantId) return [];
  return records.filter(r => r.tenantId === currentTenantId);
}
