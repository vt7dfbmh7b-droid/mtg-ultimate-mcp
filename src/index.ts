import { createServer, type IncomingMessage } from 'node:http';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { config } from './config.js';
import { gracefulShutdown } from './lib/server-lifecycle.js';
import { createCurrentMtgServer } from './server-current.js';

const mcpHandler = createMcpHandler(() => createCurrentMtgServer());
const handleMcp = toNodeHandler(mcpHandler);

type McpIncomingMessage = IncomingMessage & { method: string; url: string };

const httpServer = createServer((request, response) => {
  void (async () => {
    try {
      const requestUrl = request.url ?? '/';
      const url = new URL(requestUrl, `http://${request.headers.host ?? 'localhost'}`);

      if (url.pathname === '/health') {
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(
          JSON.stringify({
            ok: true,
            service: 'mtg-ultimate-mcp',
            version: config.version,
            mcpEndpoint: '/mcp',
          }),
        );
        return;
      }

      if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
        if (!request.method || !request.url) {
          response.statusCode = 400;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(JSON.stringify({ error: 'HTTP method and URL are required' }));
          return;
        }
        await handleMcp(request as McpIncomingMessage, response);
        return;
      }

      if (url.pathname === '/') {
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(
          JSON.stringify({
            name: 'MTG Ultimate MCP',
            version: config.version,
            endpoints: { health: '/health', mcp: '/mcp' },
          }),
        );
        return;
      }

      response.statusCode = 404;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ error: 'Not found' }));
    } catch (error) {
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  })();
});

httpServer.listen(config.port, '0.0.0.0', () => {
  console.error(`MTG Ultimate MCP ${config.version} listening on port ${config.port}`);
  console.error(`MCP endpoint: http://0.0.0.0:${config.port}/mcp`);
});

let shutdownPromise: Promise<void> | null = null;
const shutdown = (signal: string): Promise<void> => {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    console.error(`Received ${signal}; shutting down.`);
    const result = await gracefulShutdown({
      server: httpServer,
      closeMcp: () => mcpHandler.close(),
      timeoutMs: config.shutdownTimeoutMs,
    });
    if (result.forcedHttpClose) console.error('Forced close of remaining HTTP connections after shutdown deadline.');
    if (result.mcpCloseTimedOut) console.error('MCP handler did not close before the shutdown deadline.');
    if (result.httpCloseError) console.error(`HTTP server close failed: ${result.httpCloseError.message}`);
    if (result.mcpCloseError) console.error(`MCP handler close failed: ${result.mcpCloseError.message}`);
    if (result.forcedHttpClose || result.mcpCloseTimedOut || result.httpCloseError || result.mcpCloseError) {
      process.exitCode = 1;
    }
  })();
  return shutdownPromise;
};

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
