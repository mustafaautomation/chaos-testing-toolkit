import { describe, it, expect, vi } from 'vitest';
import { ChaosScenario, FaultRule } from '../../src/faults/types';
import { findMatchingRule, applyFault } from '../../src/faults/injector';

describe('ChaosScenario creation and validation', () => {
  it('should create a scenario with multiple fault rules', () => {
    const scenario: ChaosScenario = {
      name: 'multi-fault-test',
      description: 'Scenario with latency, error, and rate-limit faults',
      faults: [
        {
          name: 'slow-api',
          type: 'latency',
          target: '/api/users',
          probability: 1,
          config: { minMs: 200, maxMs: 500 },
        },
        {
          name: 'db-failure',
          type: 'error',
          target: '/api/orders',
          probability: 1,
          config: { statusCode: 503, body: { error: 'Database unavailable' } },
        },
        {
          name: 'throttle-search',
          type: 'rate-limit',
          target: '/api/search',
          probability: 1,
          config: { maxRequests: 5, windowMs: 10000 },
        },
      ],
      duration: 120,
    };

    expect(scenario.faults).toHaveLength(3);
    expect(scenario.faults.map((f) => f.type)).toEqual(['latency', 'error', 'rate-limit']);
    expect(scenario.duration).toBe(120);
  });

  it('should create a scenario without optional duration', () => {
    const scenario: ChaosScenario = {
      name: 'no-duration',
      description: 'Runs indefinitely',
      faults: [
        {
          name: 'always-slow',
          type: 'latency',
          target: '*',
          probability: 1,
          config: { minMs: 50, maxMs: 100 },
        },
      ],
    };

    expect(scenario.duration).toBeUndefined();
    expect(scenario.faults).toHaveLength(1);
  });

  it('should create a scenario with an empty faults array', () => {
    const scenario: ChaosScenario = {
      name: 'no-faults',
      description: 'Passthrough scenario',
      faults: [],
    };

    expect(scenario.faults).toHaveLength(0);
  });
});

describe('findMatchingRule with multiple rules', () => {
  const rules: FaultRule[] = [
    {
      name: 'latency-users',
      type: 'latency',
      target: '/api/users',
      probability: 1,
      config: { minMs: 100, maxMs: 300 },
    },
    {
      name: 'error-orders',
      type: 'error',
      target: '/api/orders',
      probability: 1,
      config: { statusCode: 500 },
    },
    {
      name: 'timeout-payments',
      type: 'timeout',
      target: '/api/payments',
      probability: 1,
      config: { afterMs: 30000 },
    },
    {
      name: 'ratelimit-search',
      type: 'rate-limit',
      target: '/api/search',
      probability: 1,
      config: { maxRequests: 10, windowMs: 60000 },
    },
    {
      name: 'wildcard-fallback',
      type: 'latency',
      target: '/api/v2/*',
      probability: 0.5,
      config: { minMs: 50, maxMs: 150 },
    },
  ];

  it('should return the first matching rule when multiple could match', () => {
    const result = findMatchingRule('/api/users', rules);
    expect(result?.name).toBe('latency-users');
  });

  it('should match each specific target correctly', () => {
    expect(findMatchingRule('/api/orders', rules)?.name).toBe('error-orders');
    expect(findMatchingRule('/api/payments', rules)?.name).toBe('timeout-payments');
    expect(findMatchingRule('/api/search', rules)?.name).toBe('ratelimit-search');
  });

  it('should match wildcard rule for nested v2 paths', () => {
    const result = findMatchingRule('/api/v2/resources', rules);
    expect(result?.name).toBe('wildcard-fallback');
  });

  it('should return undefined when no rule matches', () => {
    expect(findMatchingRule('/health', rules)).toBeUndefined();
    expect(findMatchingRule('/api/v3/nothing', rules)).toBeUndefined();
  });

  it('should match the first rule when URL matches multiple patterns', () => {
    // /api/users also contains '/api/' but the exact match comes first
    const rulesWithOverlap: FaultRule[] = [
      {
        name: 'specific',
        type: 'error',
        target: '/api/users',
        probability: 1,
        config: { statusCode: 404 },
      },
      {
        name: 'broad',
        type: 'latency',
        target: '/api/*',
        probability: 1,
        config: { minMs: 10, maxMs: 20 },
      },
    ];
    const result = findMatchingRule('/api/users', rulesWithOverlap);
    expect(result?.name).toBe('specific');
  });
});

describe('probability-based fault distribution', () => {
  it('should inject roughly 50% of the time with probability=0.5', () => {
    const rule: FaultRule = {
      name: 'half-fault',
      type: 'error',
      target: '*',
      probability: 0.5,
      config: { statusCode: 500 },
    };

    const iterations = 1000;
    let injected = 0;

    // Use a seeded approach: mock Math.random to produce uniform distribution
    let callCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      // Cycle through 0.0 to 0.999 evenly
      return (callCount++ % iterations) / iterations;
    });

    for (let i = 0; i < iterations; i++) {
      const result = applyFault(rule);
      if (result.faultApplied) injected++;
    }

    vi.restoreAllMocks();

    const ratio = injected / iterations;
    expect(ratio).toBeCloseTo(0.5, 1);
  });

  it('should inject roughly 25% of the time with probability=0.25', () => {
    const rule: FaultRule = {
      name: 'quarter-fault',
      type: 'latency',
      target: '*',
      probability: 0.25,
      config: { minMs: 10, maxMs: 20 },
    };

    const iterations = 1000;
    let injected = 0;

    let callCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      return (callCount++ % iterations) / iterations;
    });

    for (let i = 0; i < iterations; i++) {
      const result = applyFault(rule);
      if (result.faultApplied) injected++;
    }

    vi.restoreAllMocks();

    const ratio = injected / iterations;
    expect(ratio).toBeCloseTo(0.25, 1);
  });

  it('should always inject with probability=1.0', () => {
    const rule: FaultRule = {
      name: 'always',
      type: 'error',
      target: '*',
      probability: 1,
      config: { statusCode: 503 },
    };

    for (let i = 0; i < 100; i++) {
      expect(applyFault(rule).faultApplied).toBe(true);
    }
  });

  it('should never inject with probability=0.0', () => {
    const rule: FaultRule = {
      name: 'never',
      type: 'error',
      target: '*',
      probability: 0,
      config: { statusCode: 503 },
    };

    for (let i = 0; i < 100; i++) {
      expect(applyFault(rule).faultApplied).toBe(false);
    }
  });

  it('should inject roughly 80% of the time with probability=0.8', () => {
    const rule: FaultRule = {
      name: 'mostly-fault',
      type: 'rate-limit',
      target: '*',
      probability: 0.8,
      config: { maxRequests: 5, windowMs: 10000 },
    };

    const iterations = 1000;
    let injected = 0;

    let callCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      return (callCount++ % iterations) / iterations;
    });

    for (let i = 0; i < iterations; i++) {
      const result = applyFault(rule);
      if (result.faultApplied) injected++;
    }

    vi.restoreAllMocks();

    const ratio = injected / iterations;
    expect(ratio).toBeCloseTo(0.8, 1);
  });
});
