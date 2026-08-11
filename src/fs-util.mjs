import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { canonicalize } from './canonical.mjs';
import { ProtocolError } from './errors.mjs';

export async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function writeJsonAtomic(path, value) {
  await ensureDir(dirname(path));
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${canonicalize(value)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

export async function writeTextAtomic(path, text, mode = 0o600) {
  await ensureDir(dirname(path));
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, text, { mode });
  await rename(temporary, path);
}

export async function withFileLock(lockPath, work, { retries = 100, delayMs = 20 } = {}) {
  await ensureDir(dirname(lockPath));
  let handle;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      handle = await open(lockPath, 'wx', 0o600);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
  }
  if (!handle) throw new ProtocolError('LOCK_TIMEOUT', `Could not acquire lock ${lockPath}`);
  try {
    return await work();
  } finally {
    await handle.close();
    await rm(lockPath, { force: true });
  }
}

export function safeChildPath(root, name) {
  const base = resolve(root);
  const candidate = resolve(base, name);
  if (candidate !== base && !candidate.startsWith(`${base}/`)) {
    throw new ProtocolError('PATH_TRAVERSAL', 'Path escapes the workspace root');
  }
  return candidate;
}
