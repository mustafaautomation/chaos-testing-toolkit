import { describe, it, expect } from 'vitest';
import { applyFault, matchesTarget } from '../../src/faults/injector';
import { FaultRule } from '../../src/faults/types';

describe('applyFault — timeout fault', () => {
  it('should inject timeout with specified delay', () => {
    const rule: FaultRule = {
      name: 'timeout',
      type: 'timeout',
      target: '*',
      probability: 1,
      config: { afterMs: 5000 },
    };
    const result = applyFault(rule);
    expect(result.faultApplied).toBe(true);
    expect(result.faultType).toBe('timeout');
  });
});

describe('applyFault — corrupt fault (not yet implemented)', () => {
  it('should not inject for unimplemented fault type', () => {
    const rule: FaultRule = {
      name: 'corrupt',
      type: 'corrupt',
      target: '*',
      probability: 1,
      config: { corruptFields: ['name', 'email'] },
    };
    const result = applyFault(rule);
    // corrupt type hits default case — not implemented yet
    expect(result.faultApplied).toBe(false);
  });
});

describe('applyFault — probability edge cases', () => {
  it('should always inject at probability 1', () => {
    const rule: FaultRule = {
      name: 'always',
      type: 'error',
      target: '*',
      probability: 1,
      config: { statusCode: 500 },
    };

    // Run 10 times — all should inject
    for (let i = 0; i < 10; i++) {
      expect(applyFault(rule).faultApplied).toBe(true);
    }
  });

  it('should never inject at probability 0', () => {
    const rule: FaultRule = {
      name: 'never',
      type: 'error',
      target: '*',
      probability: 0,
      config: { statusCode: 500 },
    };

    for (let i = 0; i < 10; i++) {
      expect(applyFault(rule).faultApplied).toBe(false);
    }
  });
});

describe('applyFault — error with custom body', () => {
  it('should use custom body in error response', () => {
    const rule: FaultRule = {
      name: 'custom-error',
      type: 'error',
      target: '*',
      probability: 1,
      config: { statusCode: 429, body: { error: 'Rate limited', retryAfter: 60 } },
    };
    const result = applyFault(rule);
    expect(result.statusOverride).toBe(429);
    expect(result.bodyOverride).toEqual({ error: 'Rate limited', retryAfter: 60 });
  });
});

describe('matchesTarget — advanced patterns', () => {
  it('should match path with multiple segments', () => {
    expect(matchesTarget('/api/v2/users/123/orders', '/api/v2/*')).toBe(true);
  });

  it('should match empty target (includes check)', () => {
    // Empty string is included in every string via String.includes('')
    expect(matchesTarget('/api/users', '')).toBe(true);
  });

  it('should handle root path', () => {
    expect(matchesTarget('/', '/')).toBe(true);
  });

  it('should handle paths with query strings', () => {
    expect(matchesTarget('/api/users?limit=10&offset=0', '/api/users')).toBe(true);
  });
});
