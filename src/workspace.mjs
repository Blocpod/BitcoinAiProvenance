import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureDir, readJson, safeChildPath, writeJsonAtomic, writeTextAtomic } from './fs-util.mjs';
import { ArtifactStore } from './artifacts.mjs';

export class ProvenanceWorkspace {
  constructor(root) {
    this.root = root;
    this.keys = join(root, 'keys');
    this.receipts = join(root, 'receipts');
    this.batches = join(root, 'batches');
    this.anchors = join(root, 'anchors');
    this.policies = join(root, 'policies');
    this.state = join(root, 'state');
    this.artifacts = new ArtifactStore(join(root, 'artifacts'));
  }

  async init() {
    await Promise.all([this.keys, this.receipts, this.batches, this.anchors, this.policies, this.state].map(ensureDir));
    await this.artifacts.init();
    await writeJsonAtomic(join(this.root, 'workspace.json'), { type: 'btc-ai-provenance-workspace', version: '1.0' });
    return this;
  }

  async saveIdentity(name, identity) {
    await this.init();
    await writeTextAtomic(safeChildPath(this.keys, `${name}.private.pem`), identity.privateKeyPem, 0o600);
    await writeTextAtomic(safeChildPath(this.keys, `${name}.public.pem`), identity.publicKeyPem, 0o644);
    await writeJsonAtomic(safeChildPath(this.keys, `${name}.json`), { label: identity.label, keyId: identity.keyId, publicKeyPem: identity.publicKeyPem });
    return safeChildPath(this.keys, `${name}.json`);
  }

  async loadIdentity(name) {
    const metadata = await readJson(safeChildPath(this.keys, `${name}.json`));
    return { ...metadata, privateKeyPem: await readFile(safeChildPath(this.keys, `${name}.private.pem`), 'utf8') };
  }

  async saveEnvelope(directory, envelope) {
    const digest = envelope.statementId.slice('sha256:'.length);
    const path = safeChildPath(directory, `${digest}.json`);
    await writeJsonAtomic(path, envelope);
    return path;
  }

  async saveReceipt(envelope) { return this.saveEnvelope(this.receipts, envelope); }
  async savePolicy(envelope) { return this.saveEnvelope(this.policies, envelope); }

  async saveBatch(batch) {
    const path = safeChildPath(this.batches, `${batch.envelope.statement.batchNumber}-${batch.envelope.statementId.slice(7)}.json`);
    await writeJsonAtomic(path, batch);
    return path;
  }

  async saveAnchor(anchor) {
    const name = `${anchor.type}-${anchor.txid ?? anchor.entryHash}.json`;
    const path = safeChildPath(this.anchors, name);
    await writeJsonAtomic(path, anchor);
    return path;
  }

  async loadJsonFiles(directory) {
    try {
      const names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
      return Promise.all(names.map((name) => readJson(safeChildPath(directory, name))));
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async inspect() {
    const [receipts, batches, anchors, policies] = await Promise.all([
      this.loadJsonFiles(this.receipts), this.loadJsonFiles(this.batches), this.loadJsonFiles(this.anchors), this.loadJsonFiles(this.policies),
    ]);
    let artifactCount = 0;
    try { artifactCount = (await readdir(this.artifacts.metadata)).filter((name) => name.endsWith('.json')).length; } catch {}
    return { root: this.root, receipts, batches, anchors, policies, artifactCount };
  }

  async exists() {
    try { return (await stat(join(this.root, 'workspace.json'))).isFile(); } catch { return false; }
  }
}
