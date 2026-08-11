import { createServer } from 'node:http';
import { verifyBatch } from './batches.mjs';
import { verifyLineage } from './receipts.mjs';
import { verifyLocalJournal } from './local-anchor.mjs';

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BTC AI Provenance Explorer</title><style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui;background:#0d1218;color:#e9f2ee}body{margin:0;padding:24px}main{max-width:1100px;margin:auto}.eyebrow{color:#80f5ba;text-transform:uppercase;letter-spacing:.18em;font-size:12px}h1{font-size:clamp(32px,7vw,72px);line-height:.95;max-width:850px}p{color:#a8b8b3}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.card{border:1px solid #28343b;background:#121a22;border-radius:18px;padding:18px;min-height:110px}.value{font-size:36px;color:#80f5ba}.row{border-top:1px solid #28343b;padding:14px 0;word-break:break-all}.ok{color:#80f5ba}.bad{color:#ff8b7b}code{color:#c9a7ff}</style></head>
<body><main><div class="eyebrow">Independent verification console</div><h1>Bitcoin-rooted AI provenance.</h1><p id="status">Loading workspace...</p><section class="grid" id="stats"></section><h2>Receipt lineage</h2><div id="receipts"></div><h2>Batches</h2><div id="batches"></div></main>
<script>const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const statusEl=document.getElementById('status'),statsEl=document.getElementById('stats'),receiptsEl=document.getElementById('receipts'),batchesEl=document.getElementById('batches');fetch('/api/workspace').then(r=>r.json()).then(d=>{statusEl.innerHTML=d.valid?'<span class="ok">All local cryptographic checks passed</span>':'<span class="bad">Verification failed</span>';statsEl.innerHTML=[['Receipts',d.counts.receipts],['Batches',d.counts.batches],['Anchors',d.counts.anchors],['Artifacts',d.counts.artifacts]].map(x=>'<div class="card"><div class="value">'+x[1]+'</div><div>'+x[0]+'</div></div>').join('');receiptsEl.innerHTML=d.receipts.map(x=>'<div class="row"><strong>'+esc(x.statement.action)+'</strong><br><code>'+esc(x.statementId)+'</code><br>'+esc(x.statement.issuedAt)+'</div>').join('')||'<p>No receipts.</p>';batchesEl.innerHTML=d.batches.map(x=>'<div class="row"><strong>Batch '+x.envelope.statement.batchNumber+'</strong><br><code>'+esc(x.envelope.statement.merkle.root)+'</code></div>').join('')||'<p>No batches.</p>'}).catch(e=>statusEl.innerHTML='<span class="bad">'+esc(e.message)+'</span>')</script></body></html>`;

export function createExplorerServer(workspace) {
  return createServer(async (request, response) => {
    try {
      if (request.url === '/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'" });
        response.end(PAGE);
        return;
      }
      if (request.url === '/api/workspace') {
        const snapshot = await workspace.inspect();
        const lineage = verifyLineage(snapshot.receipts);
        const receiptById = new Map(snapshot.receipts.map((receipt) => [receipt.statementId, receipt]));
        for (const batch of snapshot.batches) verifyBatch(batch, batch.envelope.statement.receiptIds.map((id) => receiptById.get(id)).filter(Boolean));
        for (const metadata of await workspace.loadJsonFiles(workspace.artifacts.metadata)) await workspace.artifacts.verify(metadata);
        for (const journal of snapshot.anchors.filter((anchor) => anchor.type === 'local-development-anchor')) verifyLocalJournal(journal);
        const body = JSON.stringify({ valid: true, lineage, verification: { artifacts: 'verified', localAnchors: 'verified', bitcoinAnchors: 'requires Bitcoin RPC' }, counts: { receipts: snapshot.receipts.length, batches: snapshot.batches.length, anchors: snapshot.anchors.length, policies: snapshot.policies.length, artifacts: snapshot.artifactCount }, receipts: snapshot.receipts, batches: snapshot.batches });
        response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        response.end(body);
        return;
      }
      response.writeHead(404).end('Not found');
    } catch (error) {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ valid: false, code: error.code ?? 'INTERNAL', error: error.message }));
    }
  });
}
