import express, { Request, Response } from 'express';
import { ChaosScenario, ChaosResult, FaultType } from '../faults/types';
import { findMatchingRule, applyFault } from '../faults/injector';

export class ChaosProxy {
  private scenario: ChaosScenario;
  private targetUrl: string;
  private faultCounts: Record<FaultType, number> = {
    latency: 0,
    error: 0,
    timeout: 0,
    corrupt: 0,
    'rate-limit': 0,
  };
  private requestCount = 0;

  constructor(scenario: ChaosScenario, targetUrl: string) {
    this.scenario = scenario;
    this.targetUrl = targetUrl;
  }

  createApp(): express.Application {
    const app = express();
    app.use(express.json());

    app.all('*', async (req: Request, res: Response) => {
      this.requestCount++;
      const url = req.originalUrl;

      const rule = findMatchingRule(url, this.scenario.faults);
      if (rule) {
        const injection = applyFault(rule);

        if (injection.faultApplied && injection.faultType) {
          this.faultCounts[injection.faultType]++;

          if (injection.statusOverride) {
            if (injection.delay) await sleep(injection.delay);
            res.status(injection.statusOverride).json(injection.bodyOverride);
            return;
          }

          if (injection.delay) {
            await sleep(injection.delay);
          }
        }
      }

      // Proxy to real target
      try {
        const targetResponse = await fetch(`${this.targetUrl}${url}`, {
          method: req.method,
          headers: { 'Content-Type': 'application/json' },
          body: ['POST', 'PUT', 'PATCH'].includes(req.method)
            ? JSON.stringify(req.body)
            : undefined,
        });

        const body = await targetResponse.text();
        res.status(targetResponse.status);
        for (const [key, value] of targetResponse.headers.entries()) {
          if (key !== 'content-encoding' && key !== 'transfer-encoding') {
            res.setHeader(key, value);
          }
        }
        res.send(body);
      } catch (err) {
        res.status(502).json({ error: 'Proxy error', message: (err as Error).message });
      }
    });

    return app;
  }

  getResult(): ChaosResult {
    return {
      scenario: this.scenario.name,
      faultsInjected: Object.values(this.faultCounts).reduce((s, c) => s + c, 0),
      requestsProcessed: this.requestCount,
      faultBreakdown: { ...this.faultCounts },
      duration: 0,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
