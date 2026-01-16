/**
 * Policy Packs - Enterprise-ready configurations
 *
 * Pre-configured policy packs for different use cases:
 * - enterprise: Strict CI gating for quality/security
 * - startup: Pragmatic, catches big risks without noise
 * - oss: Open-source friendly, focus on supply-chain and correctness
 */

export type PolicyPackName = 'enterprise' | 'startup' | 'oss';

export interface SeverityCounts {
  CRITICAL?: number;
  HIGH?: number;
  MED?: number;
  LOW?: number;
}

export interface FailOnConfig {
  minHighestRisk: number;
  minBlockers: number;
  severityCounts: SeverityCounts;
}

export interface CategoryWeights {
  security: number;
  ssrBoundary: number;
  apiContract: number;
  correctness: number;
  performance: number;
  maintainability: number;
  supplyChain: number;
}

export interface PolicyPackDefaults {
  topN: number;
  details: boolean;
}

export interface PolicyPack {
  name: PolicyPackName;
  description: string;
  failOn: FailOnConfig;
  weights: CategoryWeights;
  defaults: PolicyPackDefaults;
}

/**
 * Enterprise Policy Pack
 * Strict CI gating for quality and security
 *
 * - FAIL on 1 CRITICAL or 2+ HIGH
 * - FAIL if highestRisk >= 7.5
 * - FAIL if blockers >= 1
 * - Security and SSR boundary weighted higher
 */
export const enterprisePack: PolicyPack = {
  name: 'enterprise',
  description: 'Strict CI gating for enterprise quality and security requirements',
  failOn: {
    minHighestRisk: 7.5,
    minBlockers: 1,
    severityCounts: { CRITICAL: 1, HIGH: 2 },
  },
  weights: {
    security: 1.3,
    ssrBoundary: 1.2,
    apiContract: 1.2,
    correctness: 1.1,
    performance: 1.1,
    maintainability: 0.9,
    supplyChain: 1.2,
  },
  defaults: {
    topN: 5,
    details: true,
  },
};

/**
 * Startup Policy Pack
 * Pragmatic, catches big risks without noise
 *
 * - FAIL only on CRITICAL or very high risk
 * - Less noise, faster adoption
 * - Maintainability weighted lower
 * - TOP 5 to respect noise budget
 */
export const startupPack: PolicyPack = {
  name: 'startup',
  description: 'Pragmatic policy for fast-moving teams, catches critical risks without noise',
  failOn: {
    minHighestRisk: 8.8,
    minBlockers: 1,
    severityCounts: { CRITICAL: 1 },
  },
  weights: {
    security: 1.2,
    ssrBoundary: 1.1,
    apiContract: 1.1,
    correctness: 1.0,
    performance: 1.0,
    maintainability: 0.8,
    supplyChain: 1.0,
  },
  defaults: {
    topN: 5,
    details: false,
  },
};

/**
 * OSS Policy Pack
 * Open-source friendly, focus on supply-chain and correctness
 *
 * - Doesn't block on style/maintainability
 * - Focus on security and supply-chain
 * - Maintainability weighted very low
 * - TOP 5 to respect noise budget
 */
export const ossPack: PolicyPack = {
  name: 'oss',
  description: 'Open-source friendly policy focused on security, supply-chain, and correctness',
  failOn: {
    minHighestRisk: 9.2,
    minBlockers: 1,
    severityCounts: { CRITICAL: 1 },
  },
  weights: {
    security: 1.3,
    ssrBoundary: 1.0,
    apiContract: 1.0,
    correctness: 1.1,
    performance: 1.0,
    maintainability: 0.6,
    supplyChain: 1.3,
  },
  defaults: {
    topN: 5,
    details: false,
  },
};

/**
 * All available policy packs
 */
export const policyPacks: Record<PolicyPackName, PolicyPack> = {
  enterprise: enterprisePack,
  startup: startupPack,
  oss: ossPack,
};

/**
 * Get a policy pack by name
 */
export function getPolicyPack(name: PolicyPackName): PolicyPack {
  return policyPacks[name] || policyPacks.startup;
}

/**
 * Get all available policy pack names
 */
export function getAvailablePolicyPacks(): PolicyPackName[] {
  return Object.keys(policyPacks) as PolicyPackName[];
}

/**
 * Get policy pack description
 */
export function getPolicyPackDescription(name: PolicyPackName): string {
  return policyPacks[name]?.description || 'Unknown policy pack';
}

/**
 * Check if a name is a valid policy pack
 */
export function isValidPolicyPack(name: string): name is PolicyPackName {
  return name in policyPacks;
}

/**
 * Default policy pack for new users
 */
export const DEFAULT_POLICY_PACK: PolicyPackName = 'startup';
