#!/usr/bin/env node
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const started = Date.now();
const gates = [];

function gate(name, work) {
  try {
    const result = work();
    if (result && typeof result.then === 'function') return result.then((details) => gates.push({ name, passed: true, details })).catch((error) => gates.push({ name, passed: false, details: error.message }));
    gates.push({ name, passed: true, details: result });
  } catch (error) {
    gates.push({ name, passed: false, details: error.message });
  }
}

function command(executable, args, cwd = root) {
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', npm_config_cache: join(tmpdir(), 'btc-ai-npm-cache') } });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout).trim());
  return (result.stdout || '').trim();
}

async function filesUnder(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', 'demo-workspace', 'release'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(path));
    else output.push(path);
  }
  return output;
}

await gate('required-release-files', async () => {
  const required = ['README.md', 'SECURITY.md', 'LICENSE', 'program.md', 'docs/RFC-0001.md', 'docs/THREAT_MODEL.md', 'docs/ARCHITECTURE.md', 'bin/btc-ai.mjs'];
  for (const name of required) await readFile(join(root, name));
  return `${required.length} required files present`;
});

await gate('syntax-check', async () => {
  const files = (await filesUnder(root)).filter((path) => path.endsWith('.mjs'));
  for (const path of files) command(process.execPath, ['--check', path]);
  return `${files.length} modules parsed`;
});

await gate('unit-integration-adversarial-tests', async () => {
  const tests = (await filesUnder(join(root, 'test'))).filter((path) => path.endsWith('.test.mjs'));
  const output = command(process.execPath, ['--test', '--test-reporter=tap', ...tests]);
  const match = output.match(/# pass (\d+)/);
  if (!match) throw new Error('Could not read test pass count');
  return `${match[1]} tests passed`;
});

await gate('end-to-end-demo-and-verifier', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'btc-ai-gauntlet-'));
  try {
    const demo = JSON.parse(command(process.execPath, ['bin/btc-ai.mjs', 'demo', '--workspace', directory]));
    if (!demo.valid || !demo.warning.includes('local development journal')) throw new Error('Demo did not return its required validity and warning');
    const verified = JSON.parse(command(process.execPath, ['bin/btc-ai.mjs', 'workspace', 'verify', '--workspace', directory]));
    if (!verified.valid || verified.lineage.receipts !== 2 || verified.batches !== 1 || verified.artifacts !== 3) throw new Error('Workspace verifier returned unexpected counts');
    return 'demo, lineage, batch, and 3 artifacts verified';
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

await gate('secret-scan', async () => {
  const files = (await filesUnder(root)).filter((path) => !path.endsWith('GAUNTLET_REPORT.md') && !path.endsWith('gauntlet-results.json'));
  const forbidden = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /(?:rpc-password|RPC_PASSWORD)\s*[=:]\s*(?!YOUR_)[^\s]+/i, /\b(?:xprv|tprv)[1-9A-HJ-NP-Za-km-z]{20,}/];
  for (const path of files) {
    const bytes = await readFile(path);
    if (bytes.includes(0)) continue;
    const text = bytes.toString('utf8');
    for (const pattern of forbidden) if (pattern.test(text)) throw new Error(`Possible secret in ${relative(root, path)}`);
  }
  return `${files.length} files scanned`;
});

await gate('claim-hygiene', async () => {
  const files = (await filesUnder(join(root, 'docs'))).concat([join(root, 'README.md')]);
  const forbidden = [/production[- ]ready/i, /software suite complete/i, /bitcoin proves (?:truth|ownership)/i, /fully trustless/i];
  for (const path of files) {
    const text = await readFile(path, 'utf8');
    for (const pattern of forbidden) if (pattern.test(text)) throw new Error(`Overclaim ${pattern} in ${relative(root, path)}`);
  }
  return `${files.length} documents checked`;
});

await gate('package-dry-run', () => {
  const output = command('npm', ['pack', '--dry-run', '--json']);
  const result = JSON.parse(output);
  if (!result[0]?.files?.length) throw new Error('npm package dry run was empty');
  return `${result[0].files.length} release files, ${result[0].size} bytes packed`;
});

const failed = gates.filter((entry) => !entry.passed);
const report = {
  type: 'btc-ai-gauntlet-report', version: '1.0', generatedAt: new Date().toISOString(), durationMs: Date.now() - started,
  summary: { passed: gates.length - failed.length, failed: failed.length, total: gates.length }, gates,
};
await writeFile(join(root, 'docs', 'gauntlet-results.json'), `${JSON.stringify(report, null, 2)}\n`);
const markdown = `# Gauntlet Report\n\nGenerated: ${report.generatedAt}\n\nResult: **${failed.length === 0 ? 'PASS' : 'FAIL'}**\n\n| Gate | Result | Evidence |\n| --- | --- | --- |\n${gates.map((entry) => `| ${entry.name} | ${entry.passed ? 'PASS' : 'FAIL'} | ${String(entry.details ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`).join('\n')}\n\nThis report verifies the local release gates. A mocked Bitcoin Core RPC validates request and response handling; a live funded Bitcoin wallet was not available in this environment. External cryptographic review remains required before high-value deployment.\n`;
await writeFile(join(root, 'docs', 'GAUNTLET_REPORT.md'), markdown);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failed.length > 0) process.exitCode = 1;
