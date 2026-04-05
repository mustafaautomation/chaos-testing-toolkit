export type FaultType = 'latency' | 'error' | 'timeout' | 'corrupt' | 'rate-limit';

export interface FaultRule {
  name: string;
  type: FaultType;
  target: string; // URL pattern or path glob
  probability: number; // 0-1
  config: LatencyConfig | ErrorConfig | TimeoutConfig | CorruptConfig | RateLimitConfig;
}

export interface LatencyConfig {
  minMs: number;
  maxMs: number;
}

export interface ErrorConfig {
  statusCode: number;
  body?: unknown;
}

export interface TimeoutConfig {
  afterMs: number;
}

export interface CorruptConfig {
  corruptFields?: string[];
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface ChaosScenario {
  name: string;
  description: string;
  faults: FaultRule[];
  duration?: number; // seconds
}

export interface ChaosResult {
  scenario: string;
  faultsInjected: number;
  requestsProcessed: number;
  faultBreakdown: Record<FaultType, number>;
  duration: number;
}
