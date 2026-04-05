# Chaos Testing Toolkit

[![CI](https://github.com/mustafaautomation/chaos-testing-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/mustafaautomation/chaos-testing-toolkit/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

Application-layer chaos testing for QA teams. Inject latency, errors, timeouts, and rate limits between your app and its dependencies. No Kubernetes required.

---

## Fault Types

| Fault | What Happens | Config |
|-------|-------------|--------|
| **Latency** | Random delay on requests | `minMs`, `maxMs` |
| **Error** | Return error status code | `statusCode`, `body` |
| **Timeout** | Hang request for N ms | `afterMs` |
| **Rate Limit** | Return 429 | `maxRequests`, `windowMs` |

Each fault has a `probability` (0-1) — 0.3 means 30% of matching requests get the fault.

---

## Quick Start

```bash
# Start chaos proxy between your tests and the API
npx chaos proxy examples/api-chaos.json --target http://api.example.com --port 4001

# Point your tests at the proxy instead of the real API
BASE_URL=http://localhost:4001 npx playwright test

# Your app should handle faults gracefully — that's the test!
```

---

## Scenario Format

```json
{
  "name": "API Resilience",
  "faults": [
    {
      "name": "slow-auth",
      "type": "latency",
      "target": "/api/login",
      "probability": 0.5,
      "config": { "minMs": 2000, "maxMs": 5000 }
    },
    {
      "name": "db-error",
      "type": "error",
      "target": "/api/users",
      "probability": 0.3,
      "config": { "statusCode": 503 }
    }
  ]
}
```

---

## Library API

```typescript
import { ChaosProxy } from 'chaos-testing-toolkit';

const proxy = new ChaosProxy(scenario, 'http://api.example.com');
const app = proxy.createApp();
app.listen(4001);

// After tests
const result = proxy.getResult();
console.log(`Faults injected: ${result.faultsInjected}`);
```

---

## Project Structure

```
chaos-testing-toolkit/
├── src/
│   ├── faults/
│   │   ├── types.ts          # FaultRule, ChaosScenario, ChaosResult
│   │   └── injector.ts       # Pattern matching, fault application, probability
│   ├── runner/
│   │   └── chaos-proxy.ts    # Express proxy with fault injection
│   ├── cli.ts
│   └── index.ts
├── tests/unit/
│   └── injector.test.ts      # 11 tests — matching, injection, probability
├── examples/
│   └── api-chaos.json        # 4 fault rules example
└── .github/workflows/ci.yml
```

---

## License

MIT

---

Built by [Quvantic](https://quvantic.com)
