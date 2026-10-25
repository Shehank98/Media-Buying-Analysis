'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const VENDOR = {
  '/vendor/d3.min.js': path.join(__dirname, 'node_modules', 'd3', 'dist', 'd3.min.js'),
  '/vendor/xlsx.full.min.js': path.join(__dirname, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js'),
};
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon',
};

function send(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(file);
    const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' };
    const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '') && /^(\.html|\.js|\.css|\.csv|\.json|\.svg)$/.test(ext);
    if (gz) headers['Content-Encoding'] = 'gzip';
    res.writeHead(200, headers);
    const rs = fs.createReadStream(file);
    (gz ? rs.pipe(zlib.createGzip()) : rs).pipe(res);
  });
}

http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
  if (url === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (VENDOR[url]) return send(req, res, VENDOR[url]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  send(req, res, file);
}).listen(PORT, () => console.log('Media Buying Desk on port ' + PORT));
