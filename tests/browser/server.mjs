// A static file server for the browser suite.
//
// `npm run serve` uses python3, which is fine on a developer's machine and a
// dependency the CI runner should not have to have. This is thirty lines of
// node that serves the same folder, so the suite brings its own server and
// works anywhere node does.
//
// It is deliberately not a general-purpose server: it serves this repository
// over loopback for the length of a test run and nothing else.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Serve `root` on a free port. Resolves to { url, close }. */
export function serve(root) {
  const server = createServer(async (req, res) => {
    try {
      // normalize collapses `..`, and the prefix check refuses anything that
      // still points outside the folder. A test server is still a server.
      const url = new URL(req.url, 'http://localhost');
      let path = normalize(join(root, decodeURIComponent(url.pathname)));
      if (!path.startsWith(normalize(root))) {
        res.writeHead(403).end('no');
        return;
      }

      const info = await stat(path).catch(() => null);
      if (info?.isDirectory()) path = join(path, 'index.html');

      const body = await readFile(path);
      res.writeHead(200, {
        'Content-Type': TYPES[extname(path)] || 'application/octet-stream',
        // The service worker is the thing under test; a cached copy of it
        // would make an update check meaningless.
        'Cache-Control': 'no-cache',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}
