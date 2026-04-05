import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const CLI_PATH = path.resolve(ROOT, 'dist/cli.js');

function runCli(args: string): string {
  return execSync(`node ${CLI_PATH} ${args}`, {
    encoding: 'utf-8',
    timeout: 10000,
  }).trim();
}

describe('CLI integration', () => {
  beforeAll(() => {
    execSync('npm run build', { cwd: ROOT, stdio: 'pipe' });
  });
  it('should display help output with --help', () => {
    const output = runCli('--help');

    expect(output).toContain('chaos');
    expect(output).toContain('Application-layer chaos testing');
    expect(output).toContain('proxy');
    expect(output).toContain('-V, --version');
    expect(output).toContain('-h, --help');
  });

  it('should display version with --version', () => {
    const output = runCli('--version');

    expect(output).toBe('1.0.0');
  });

  it('should display proxy command help', () => {
    const output = runCli('proxy --help');

    expect(output).toContain('Start chaos proxy');
    expect(output).toContain('<scenario>');
    expect(output).toContain('--target');
    expect(output).toContain('--port');
  });
});
