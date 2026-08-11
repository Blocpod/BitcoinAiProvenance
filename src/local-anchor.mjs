import { join } from 'node:path';
import { objectDigest } from './crypto.mjs';
import { readJson, withFileLock, writeJsonAtomic } from './fs-util.mjs';
import { invariant } from './errors.mjs';

export async function appendLocalAnchor(workspaceRoot, root) {
  invariant(/^[0-9a-f]{64}$/.test(root), 'INVALID_COMMITMENT_ROOT', 'Local anchor root must be 32-byte lowercase hex');
  const path = join(workspaceRoot, 'anchors', 'local-journal.json');
  const lock = `${path}.lock`;
  return withFileLock(lock, async () => {
    let journal = { type: 'local-development-anchor', version: '1.0', entries: [] };
    try { journal = await readJson(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const previousHash = journal.entries.at(-1)?.entryHash ?? null;
    const entry = { index: journal.entries.length, root, previousHash, createdAt: new Date().toISOString() };
    entry.entryHash = objectDigest(entry, 'btc-ai:local-anchor:v1');
    journal.entries.push(entry);
    await writeJsonAtomic(path, journal);
    return { type: 'local-development', version: '1.0', ...entry, warning: 'Not a Bitcoin anchor. Development use only.' };
  });
}

export function verifyLocalJournal(journal) {
  let previousHash = null;
  for (let index = 0; index < journal.entries.length; index += 1) {
    const entry = journal.entries[index];
    invariant(/^[0-9a-f]{64}$/.test(entry.root), 'INVALID_COMMITMENT_ROOT', 'Local anchor entry has an invalid root');
    invariant(entry.index === index && entry.previousHash === previousHash, 'LOCAL_ANCHOR_CHAIN_BROKEN', 'Local anchor journal chain is broken');
    const { entryHash, ...unsigned } = entry;
    invariant(objectDigest(unsigned, 'btc-ai:local-anchor:v1') === entryHash, 'LOCAL_ANCHOR_TAMPERED', 'Local anchor journal entry was modified');
    previousHash = entryHash;
  }
  return true;
}
