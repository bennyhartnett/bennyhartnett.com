import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 8000;
const HOST = '127.0.0.1';
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_PORT_ATTEMPTS = 10;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8'
};

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isSafePath(filePath) {
  const relativePath = path.relative(ROOT_DIR, filePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

async function resolveFilePath(requestPath) {
  const normalizedPath = requestPath.replace(/\/+$/, '') || '/';

  if (normalizedPath === '/') {
    return path.join(ROOT_DIR, 'index.html');
  }

  if (normalizedPath === '/nuclear') {
    return path.join(ROOT_DIR, 'nuclear.html');
  }

  const candidatePath = path.normalize(path.join(ROOT_DIR, normalizedPath));
  if (!isSafePath(candidatePath)) {
    return null;
  }

  if (await pathExists(candidatePath)) {
    const candidateStats = await stat(candidatePath);
    if (candidateStats.isDirectory()) {
      const directoryIndexPath = path.join(candidatePath, 'index.html');
      return (await pathExists(directoryIndexPath)) ? directoryIndexPath : null;
    }

    return candidatePath;
  }

  if (!path.extname(normalizedPath)) {
    return path.join(ROOT_DIR, 'index.html');
  }

  return null;
}

function writeResponseHeaders(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', MIME_TYPES[extension] || 'application/octet-stream');
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    response.writeHead(400);
    response.end('Bad Request');
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method Not Allowed');
    return;
  }

  let requestPath;

  try {
    requestPath = decodeURIComponent(new URL(request.url, `http://${HOST}`).pathname);
  } catch {
    response.writeHead(400);
    response.end('Bad Request');
    return;
  }

  try {
    const filePath = await resolveFilePath(requestPath);

    if (!filePath) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not Found');
      return;
    }

    writeResponseHeaders(response, filePath);
    response.writeHead(200);

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    const stream = createReadStream(filePath);
    stream.on('error', () => {
      if (!response.headersSent) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      } else {
        response.statusCode = 500;
      }
      response.end('Internal Server Error');
    });
    stream.pipe(response);
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Internal Server Error');
  }
});

function listenOnPort(port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, HOST);
  });
}

async function startServer() {
  const preferredPort = Number.parseInt(process.env.PORT ?? `${DEFAULT_PORT}`, 10) || DEFAULT_PORT;
  const allowPortFallback = !process.env.PORT;

  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt += 1) {
    const port = preferredPort + attempt;

    try {
      await listenOnPort(port);
      if (attempt > 0) {
        console.log(`Port ${preferredPort} is in use. Using ${port} instead.`);
      }
      console.log(`Local server running at http://${HOST}:${port}/`);
      return;
    } catch (error) {
      if (error.code === 'EADDRINUSE' && allowPortFallback) {
        continue;
      }

      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the existing server or set PORT to a different value.`);
      } else {
        console.error(error);
      }
      process.exit(1);
    }
  }

  console.error(`Could not find an open port between ${preferredPort} and ${preferredPort + MAX_PORT_ATTEMPTS - 1}.`);
  process.exit(1);
}

startServer();

function shutdown() {
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
