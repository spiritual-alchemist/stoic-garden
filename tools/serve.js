// Tiny dependency-free static server with an absolute root (avoids cwd sandbox issues).
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = '/Users/navkrishna/Desktop/mycodes/stoic-garden';
const PORT = process.env.PORT || 4321;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(fp)] || 'text/plain' });
    res.end(d);
  });
}).listen(PORT, () => console.log('garden server on ' + PORT));
