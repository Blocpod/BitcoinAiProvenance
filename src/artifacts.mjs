import { createReadStream } from 'node:fs';
import { copyFile, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, extname, join } from 'node:path';
import { ensureDir, safeChildPath, writeJsonAtomic } from './fs-util.mjs';
import { invariant } from './errors.mjs';

async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export class ArtifactStore {
  constructor(root) {
    this.root = root;
    this.objects = join(root, 'objects');
    this.metadata = join(root, 'metadata');
  }

  async init() {
    await Promise.all([ensureDir(this.objects), ensureDir(this.metadata)]);
  }

  async addFile(sourcePath, { mediaType = 'application/octet-stream', name = basename(sourcePath) } = {}) {
    await this.init();
    const info = await stat(sourcePath);
    invariant(info.isFile(), 'NOT_A_FILE', 'Artifact source must be a regular file');
    const digest = await hashFile(sourcePath);
    const id = `sha256:${digest}`;
    const objectPath = safeChildPath(this.objects, digest);
    try {
      const existing = await stat(objectPath);
      invariant(existing.size === info.size, 'DIGEST_COLLISION', 'Existing object has an unexpected size');
      invariant(await hashFile(objectPath) === digest, 'ARTIFACT_TAMPERED', 'Existing content-addressed object failed verification');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await copyFile(sourcePath, objectPath);
    }
    const record = { id, algorithm: 'sha256', digest, size: info.size, mediaType, name, extension: extname(name) };
    await writeJsonAtomic(safeChildPath(this.metadata, `${digest}.json`), record);
    return record;
  }

  async addBytes(bytes, { mediaType = 'application/octet-stream', name = 'artifact.bin' } = {}) {
    await this.init();
    const digest = createHash('sha256').update(bytes).digest('hex');
    const objectPath = safeChildPath(this.objects, digest);
    try {
      const existing = await readFile(objectPath);
      invariant(createHash('sha256').update(existing).digest('hex') === digest, 'ARTIFACT_TAMPERED', 'Existing content-addressed object failed verification');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const { writeFile } = await import('node:fs/promises');
      await writeFile(objectPath, bytes, { flag: 'wx', mode: 0o600 });
    }
    const record = { id: `sha256:${digest}`, algorithm: 'sha256', digest, size: bytes.length, mediaType, name, extension: extname(name) };
    await writeJsonAtomic(safeChildPath(this.metadata, `${digest}.json`), record);
    return record;
  }

  async verify(record) {
    invariant(record?.algorithm === 'sha256', 'UNSUPPORTED_DIGEST', 'Only sha256 artifacts are supported');
    invariant(record.id === `sha256:${record.digest}`, 'ARTIFACT_ID_MISMATCH', 'Artifact id and digest disagree');
    invariant(/^[0-9a-f]{64}$/.test(record.digest), 'INVALID_DIGEST', 'Artifact digest must be lowercase hex');
    const objectPath = safeChildPath(this.objects, record.digest);
    const bytes = await readFile(objectPath);
    const digest = createHash('sha256').update(bytes).digest('hex');
    invariant(digest === record.digest, 'ARTIFACT_TAMPERED', `Artifact ${record.id} failed digest verification`);
    invariant(bytes.length === record.size, 'ARTIFACT_SIZE_MISMATCH', `Artifact ${record.id} failed size verification`);
    return true;
  }
}
