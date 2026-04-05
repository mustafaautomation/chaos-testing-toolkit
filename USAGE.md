## Real-World Use Cases

### 1. Resilience Testing Before Deploy
```bash
# Start chaos proxy
npx chaos proxy chaos-scenario.json --target http://staging-api:3000 --port 4001

# Run E2E tests through the proxy
BASE_URL=http://localhost:4001 npx playwright test

# Your app should handle 503s, timeouts, rate limits gracefully
```

### 2. Payment Flow Resilience
Inject timeouts on `/api/checkout` to verify the UI shows retry/error messages instead of hanging.
