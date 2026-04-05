import { FaultRule, FaultType } from './types';

export interface InjectionResult {
  faultApplied: boolean;
  faultType?: FaultType;
  faultName?: string;
  delay?: number;
  statusOverride?: number;
  bodyOverride?: unknown;
}

export function shouldInjectFault(rule: FaultRule): boolean {
  return Math.random() < rule.probability;
}

export function matchesTarget(url: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern.startsWith('/') && url.includes(pattern)) return true;
  if (url.includes(pattern)) return true;

  // Simple glob: /api/* matches /api/users, /api/orders
  const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(regexPattern).test(url);
}

export function applyFault(rule: FaultRule): InjectionResult {
  if (!shouldInjectFault(rule)) {
    return { faultApplied: false };
  }

  switch (rule.type) {
    case 'latency': {
      const config = rule.config as { minMs: number; maxMs: number };
      const delay = Math.floor(Math.random() * (config.maxMs - config.minMs) + config.minMs);
      return { faultApplied: true, faultType: 'latency', faultName: rule.name, delay };
    }
    case 'error': {
      const config = rule.config as { statusCode: number; body?: unknown };
      return {
        faultApplied: true,
        faultType: 'error',
        faultName: rule.name,
        statusOverride: config.statusCode,
        bodyOverride: config.body || { error: 'Chaos fault injected', fault: rule.name },
      };
    }
    case 'timeout': {
      const config = rule.config as { afterMs: number };
      return {
        faultApplied: true,
        faultType: 'timeout',
        faultName: rule.name,
        delay: config.afterMs,
      };
    }
    case 'rate-limit': {
      return {
        faultApplied: true,
        faultType: 'rate-limit',
        faultName: rule.name,
        statusOverride: 429,
        bodyOverride: { error: 'Too Many Requests', retryAfter: 60 },
      };
    }
    default:
      return { faultApplied: false };
  }
}

export function findMatchingRule(url: string, rules: FaultRule[]): FaultRule | undefined {
  return rules.find((rule) => matchesTarget(url, rule.target));
}
