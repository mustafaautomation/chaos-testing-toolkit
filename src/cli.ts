#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import { ChaosProxy } from './runner/chaos-proxy';
import { ChaosScenario } from './faults/types';

const program = new Command();
program.name('chaos').description('Application-layer chaos testing').version('1.0.0');

program
  .command('proxy')
  .description('Start chaos proxy that injects faults between your app and its dependencies')
  .argument('<scenario>', 'Chaos scenario JSON file')
  .option('--target <url>', 'Target URL to proxy', 'http://localhost:3000')
  .option('--port <port>', 'Proxy port', '4001')
  .action((scenarioFile: string, options) => {
    if (!fs.existsSync(scenarioFile)) {
      console.error(`Not found: ${scenarioFile}`);
      process.exit(1);
    }

    const scenario: ChaosScenario = JSON.parse(fs.readFileSync(scenarioFile, 'utf-8'));
    const proxy = new ChaosProxy(scenario, options.target);
    const app = proxy.createApp();
    const port = parseInt(options.port);

    app.listen(port, () => {
      console.log(`\nChaos Proxy: http://localhost:${port} → ${options.target}`);
      console.log(`Scenario: ${scenario.name} (${scenario.faults.length} fault rules)`);
      console.log(`\nPoint your tests at http://localhost:${port} instead of the real API\n`);
    });
  });

program.parse();
