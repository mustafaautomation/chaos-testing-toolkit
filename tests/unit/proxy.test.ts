import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import { ChaosProxy } from '../../src/runner/chaos-proxy';
import { ChaosScenario } from '../../src/faults/types';

let targetServer: http.Server;
let targetPort: number;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/users', (_req, res) => res.json([{ id: 1, name: 'Alice' }]));

  await new Promise<void>((resolve) => {
    targetServer = app.listen(0, () => {
      targetPort = (targetServer.address() as { port: number }).port;
      resolve();
    });
  });
});

afterAll(() => {
  targetServer.close();
});

describe('ChaosProxy', () => {
  it('should proxy requests to target when no fault matches', async () => {
    const scenario: ChaosScenario = { name: 'test', description: '', faults: [] };
    const proxy = new ChaosProxy(scenario, `http://localhost:${targetPort}`);
    const app = proxy.createApp();

    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;

    const res = await fetch(`http://localhost:${port}/api/health`);
    const body = await res.json();
    expect(body.status).toBe('ok');

    server.close();
  });

  it('should inject error fault when rule matches', async () => {
    const scenario: ChaosScenario = {
      name: 'error-test',
      description: '',
      faults: [
        {
          name: 'fail',
          type: 'error',
          target: '/api/users',
          probability: 1,
          config: { statusCode: 503 },
        },
      ],
    };
    const proxy = new ChaosProxy(scenario, `http://localhost:${targetPort}`);
    const app = proxy.createApp();

    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;

    const res = await fetch(`http://localhost:${port}/api/users`);
    expect(res.status).toBe(503);

    server.close();
  });

  it('should track fault counts in results', async () => {
    const scenario: ChaosScenario = {
      name: 'count-test',
      description: '',
      faults: [
        {
          name: 'err',
          type: 'error',
          target: '/api/users',
          probability: 1,
          config: { statusCode: 500 },
        },
      ],
    };
    const proxy = new ChaosProxy(scenario, `http://localhost:${targetPort}`);
    const app = proxy.createApp();

    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;

    await fetch(`http://localhost:${port}/api/users`);
    await fetch(`http://localhost:${port}/api/users`);

    const result = proxy.getResult();
    expect(result.faultsInjected).toBe(2);
    expect(result.requestsProcessed).toBe(2);
    expect(result.faultBreakdown.error).toBe(2);

    server.close();
  });
});
