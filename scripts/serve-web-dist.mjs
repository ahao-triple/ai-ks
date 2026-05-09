#!/usr/bin/env node
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(rootDir, 'apps/web/dist');
const envPath = resolve(rootDir, '.env');

loadEnvFile(envPath);

const webPort = resolvePort(process.env.WEB_PORT, 5173, 'WEB_PORT');
const webHost = process.env.WEB_HOST?.trim() || '0.0.0.0';
const apiOrigin =
  process.env.API_PROXY_ORIGIN?.trim() ||
  `http://127.0.0.1:${resolvePort(process.env.API_PORT, 3000, 'API_PORT')}`;

const indexPath = join(distDir, 'index.html');
if (!existsSync(indexPath)) {
  console.error(
    `Missing ${indexPath}. Run "pnpm --filter web build" before starting PM2.`,
  );
  process.exit(1);
}

const server = createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (requestUrl.pathname === '/api' || requestUrl.pathname.startsWith('/api/')) {
    proxyApiRequest(req, res, requestUrl);
    return;
  }

  serveStatic(req, res, requestUrl);
});

server.on('error', (error) => {
  console.error(`AI-KS web failed to listen on ${webHost}:${webPort}`);
  console.error(error);
  process.exit(1);
});

server.listen(webPort, webHost, () => {
  console.log(`AI-KS web listening on http://${webHost}:${webPort}`);
  console.log(`Proxying /api to ${apiOrigin}`);
});

function serveStatic(req, res, requestUrl) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Method Not Allowed');
    return;
  }

  const staticPath = resolveStaticPath(requestUrl.pathname);
  if (!staticPath) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  const filePath = pickFilePath(staticPath, requestUrl.pathname);
  if (!filePath) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const headers = {
    'Content-Type': contentTypeFor(filePath),
  };

  if (filePath.includes(`${sep}assets${sep}`)) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else {
    headers['Cache-Control'] = 'no-cache';
  }

  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
}

function pickFilePath(staticPath, pathname) {
  if (existsSync(staticPath) && statSync(staticPath).isFile()) {
    return staticPath;
  }

  if (pathname.startsWith('/assets/')) {
    return null;
  }

  return indexPath;
}

function resolveStaticPath(pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
  const candidate = resolve(distDir, `.${normalizedPath}`);
  if (candidate !== distDir && !candidate.startsWith(`${distDir}${sep}`)) {
    return null;
  }

  return candidate;
}

function proxyApiRequest(req, res, requestUrl) {
  const upstream = new URL(`${requestUrl.pathname}${requestUrl.search}`, apiOrigin);
  const transport = upstream.protocol === 'https:' ? httpsRequest : httpRequest;

  const proxyReq = transport(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port,
      path: `${upstream.pathname}${upstream.search}`,
      method: req.method,
      headers: {
        ...req.headers,
        host: upstream.host,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (error) => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        message: 'API proxy failed',
        detail: error.message,
      }),
    );
  });

  req.pipe(proxyReq);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = unquoteEnvValue(trimmed.slice(separatorIndex + 1).trim());
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function resolvePort(value, defaultPort, name) {
  const rawValue = value?.trim();
  if (!rawValue) {
    return defaultPort;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`${name} must be a valid port number`);
  }

  const port = Number.parseInt(rawValue, 10);
  if (port < 1 || port > 65535) {
    throw new Error(`${name} must be a valid port number`);
  }

  return port;
}

function contentTypeFor(filePath) {
  const extension = extname(filePath).toLowerCase();
  return (
    {
      '.css': 'text/css; charset=utf-8',
      '.html': 'text/html; charset=utf-8',
      '.ico': 'image/x-icon',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.map': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.txt': 'text/plain; charset=utf-8',
      '.webp': 'image/webp',
    }[extension] || 'application/octet-stream'
  );
}
