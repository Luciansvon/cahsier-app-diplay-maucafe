import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  addProduct,
  callOrder,
  cancelOrder,
  completeOrder,
  createInitialState,
  createOrder,
  resetQueue,
  updateProduct,
} from './queue.js';
import { JsonStore } from './store.js';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = dirname(MODULE_DIR);
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) {
      const error = new Error('Request terlalu besar');
      error.status = 413;
      throw error;
    }
  }
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error('Format JSON tidak valid');
    error.status = 400;
    throw error;
  }
}

async function serveFile(response, filePath) {
  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    response.end(content);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    sendJson(response, 404, { error: 'Halaman tidak ditemukan' });
  }
}

export async function createQueueServer({
  dataFile = join(PROJECT_DIR, 'data', 'state.json'),
  publicDir = join(PROJECT_DIR, 'public'),
  initialState = createInitialState(),
} = {}) {
  const store = await new JsonStore(dataFile, initialState).init();
  const clients = new Set();

  function broadcast(state) {
    const message = `data: ${JSON.stringify(state)}\n\n`;
    for (const client of clients) client.write(message);
  }

  async function mutate(transform) {
    let output;
    const state = await store.update((current) => {
      output = transform(current);
      return output.state ?? output;
    });
    broadcast(state);
    return { state, output };
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const path = url.pathname;

    try {
      if (request.method === 'GET' && path === '/') {
        response.writeHead(302, { location: '/admin' });
        response.end();
        return;
      }

      const staticFiles = new Map([
        ['/admin', 'admin.html'],
        ['/display', 'display.html'],
        ['/admin.js', 'admin.js'],
        ['/sales.js', 'sales.js'],
        ['/display.js', 'display.js'],
        ['/styles.css', 'styles.css'],
      ]);
      if (request.method === 'GET' && staticFiles.has(path)) {
        await serveFile(response, join(publicDir, staticFiles.get(path)));
        return;
      }

      if (request.method === 'GET' && path === '/api/state') {
        sendJson(response, 200, store.get());
        return;
      }

      if (request.method === 'GET' && path === '/api/events') {
        response.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        clients.add(response);
        response.write(`data: ${JSON.stringify(store.get())}\n\n`);
        request.on('close', () => clients.delete(response));
        return;
      }

      if (request.method === 'POST' && path === '/api/orders') {
        const body = await readJson(request);
        const { state, output } = await mutate((current) => createOrder(current, body));
        sendJson(response, 201, { state, order: output.order });
        return;
      }

      const orderAction = path.match(/^\/api\/orders\/([^/]+)\/(call|complete|cancel)$/);
      if (request.method === 'POST' && orderAction) {
        await readJson(request);
        const [, orderId, action] = orderAction;
        const actions = { call: callOrder, complete: completeOrder, cancel: cancelOrder };
        const { state, output } = await mutate((current) => actions[action](current, orderId));
        sendJson(response, 200, { state, order: output.order });
        return;
      }

      if (request.method === 'POST' && path === '/api/reset') {
        await readJson(request);
        const { state } = await mutate((current) => resetQueue(current));
        sendJson(response, 200, { state });
        return;
      }

      if (request.method === 'POST' && path === '/api/products') {
        const body = await readJson(request);
        const { state, output } = await mutate((current) => addProduct(current, body));
        sendJson(response, 201, { state, product: output.product });
        return;
      }

      const productRoute = path.match(/^\/api\/products\/([^/]+)$/);
      if (request.method === 'PATCH' && productRoute) {
        const body = await readJson(request);
        const { state, output } = await mutate((current) => updateProduct(current, productRoute[1], body));
        sendJson(response, 200, { state, product: output.product });
        return;
      }

      sendJson(response, 404, { error: 'Route tidak ditemukan' });
    } catch (error) {
      sendJson(response, error.status ?? 400, { error: error.message || 'Request gagal' });
    }
  });

  const keepAlive = setInterval(() => {
    for (const client of clients) client.write(': keep-alive\n\n');
  }, 20_000);
  keepAlive.unref();

  return {
    server,
    store,
    listen(port = 3000, host = '0.0.0.0') {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve();
        });
      });
    },
    close() {
      clearInterval(keepAlive);
      for (const client of clients) client.end();
      return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

async function start() {
  const example = JSON.parse(await readFile(join(PROJECT_DIR, 'data', 'state.example.json'), 'utf8'));
  const app = await createQueueServer({ initialState: example });
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`Coffee Queue aktif di http://localhost:${port}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
