// Deduplicate extracted icons by content and emit a reviewable manifest.
const fs = require('fs');
const src = fs.readFileSync('assets/icons-src.json', 'utf8').replace(/^\uFEFF/, '');
const entries = JSON.parse(src); // array of "label||<svg ...>"
const byContent = new Map();
for (const e of entries) {
  const idx = e.indexOf('||');
  const label = e.slice(0, idx);
  const html = e.slice(idx + 2);
  if (!byContent.has(html)) byContent.set(html, new Set());
  byContent.get(html).add(label);
}
const out = [];
let i = 0;
for (const [html, labels] of byContent) {
  const w = (html.match(/width="(\d+(?:\.\d+)?)"/) || [])[1] || '?';
  const vb = (html.match(/viewBox="([^"]+)"/) || [])[1] || '';
  const cls = (html.match(/class="([^"]*)"/) || [])[1] || '';
  out.push({
    id: 'ic' + String(i++).padStart(3, '0'),
    w, vb, cls,
    labels: [...labels],
    html,
  });
}
fs.writeFileSync('assets/icons-unique.json', JSON.stringify(out, null, 1));
console.log('unique icons:', out.length);
