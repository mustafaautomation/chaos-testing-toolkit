import { describe, it, expect } from 'vitest';
import { matchesTarget, applyFault, findMatchingRule } from '../../src/faults/injector';
import { FaultRule } from '../../src/faults/types';

describe('matchesTarget', () => {
  it('should match exact path', () => {
    expect(matchesTarget('/api/users', '/api/users')).toBe(true);
  });

  it('should match wildcard', () => {
    expect(matchesTarget('/api/users/123', '/api/*')).toBe(true);
  });

  it('should match all with *', () => {
    expect(matchesTarget('/anything', '*')).toBe(true);
  });

  it('should not match different paths', () => {
    expect(matchesTarget('/api/orders', '/api/users')).toBe(false);
  });

  it('should match partial path', () => {
    expect(matchesTarget('/api/users?page=1', '/api/users')).toBe(true);
  });
});

describe('applyFault', () => {
  it('should inject latency fault', () => {
    const rule: FaultRule = {
      name: 'slow',
      type: 'latency',
      target: '*',
      probability: 1,
      config: { minMs: 100, maxMs: 200 },
    };
    const result = applyFault(rule);
    expect(result.faultApplied).toBe(true);
    expect(result.faultType).toBe('latency');
    expect(result.delay).toBeGreaterThanOrEqual(100);
    expect(result.delay).toBeLessThanOrEqual(200);
  });

  it('should inject error fault', () => {
    const rule: FaultRule = {
      name: 'db-down',
      type: 'error',
      target: '*',
      probability: 1,
      config: { statusCode: 503 },
    };
    const result = applyFault(rule);
    expect(result.faultApplied).toBe(true);
    expect(result.statusOverride).toBe(503);
  });

  it('should inject rate-limit fault', () => {
    const rule: FaultRule = {
      name: 'throttle',
      type: 'rate-limit',
      target: '*',
      probability: 1,
      config: { maxRequests: 10, windowMs: 60000 },
    };
    const result = applyFault(rule);
    expect(result.statusOverride).toBe(429);
  });

  it('should respect probability 0 (never inject)', () => {
    const rule: FaultRule = {
      name: 'never',
      type: 'error',
      target: '*',
      probability: 0,
      config: { statusCode: 500 },
    };
    const result = applyFault(rule);
    expect(result.faultApplied).toBe(false);
  });
});

describe('findMatchingRule', () => {
  const rules: FaultRule[] = [
    {
      name: 'a',
      type: 'latency',
      target: '/api/users',
      probability: 1,
      config: { minMs: 100, maxMs: 200 },
    },
    {
      name: 'b',
      type: 'error',
      target: '/api/orders',
      probability: 1,
      config: { statusCode: 500 },
    },
  ];

  it('should find matching rule', () => {
    expect(findMatchingRule('/api/users', rules)?.name).toBe('a');
  });

  it('should return undefined for no match', () => {
    expect(findMatchingRule('/api/unknown', rules)).toBeUndefined();
  });
});
